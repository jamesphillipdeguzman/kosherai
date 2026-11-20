/**
 * test/scanHistoryDeduplication.test.js
 * Verification suite for KosherAI Duplicate Scan History Prevention & Idempotency
 */

import assert from 'node:assert';
import fs from 'node:fs';
import {
  generateScanId,
  saveScanResult,
  updateScanRecordImage,
  reconcileScanRecords,
  cleanupDuplicateScans,
  syncPendingScans,
  getLocalScanHistory
} from '../src/services/storage.js';
import {
  executeScanWorkflow,
  renderScannerTab
} from '../src/components/ScannerTab.js';

class MockStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

globalThis.localStorage = new MockStorage();
globalThis.sessionStorage = new MockStorage();
globalThis.window = { dispatchEvent: () => {} };
globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; } };

console.log('🧪 Starting KosherAI Duplicate Scan History Prevention Test Suite...\n');

// Test 1: generateScanId produces unique canonical IDs & saveScanResult preserves ID
{
  globalThis.localStorage.clear();
  const id1 = generateScanId();
  const id2 = generateScanId();
  assert.ok(id1 && id2 && id1 !== id2, 'Each new scan must receive a unique canonical ID');

  const origFetch = globalThis.fetch;
  let postCount = 0;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/api/scans') && opts?.method === 'POST') {
      postCount++;
      const body = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ ...body, synced: true }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  try {
    // Save same scan ID twice -> must remain 1 local record and 1 in-flight POST
    const ts = '2026-11-20T12:00:00.000Z';
    saveScanResult({ id: id1, title: 'Kamote', status: 'SAFE', reason: 'Fresh produce', createdAt: ts });
    saveScanResult({ id: id1, title: 'Kamote', status: 'SAFE', reason: 'Fresh produce', createdAt: ts });
    const history = getLocalScanHistory();
    assert.strictEqual(history.length, 1, 'Repeated save with same ID must produce exactly 1 local record');
    assert.strictEqual(history[0].id, id1);
    assert.strictEqual(postCount, 1, 'In-flight guard must prevent duplicate concurrent POST /api/scans');
  } finally {
    globalThis.fetch = origFetch;
  }
  console.log('  ✅ Test 1 Passed: Canonical ID preserved & duplicate concurrent POSTs blocked.');
}

// Test 2: Rapid repeated taps on executeScanWorkflow produce only 1 scan
{
  globalThis.localStorage.clear();
  const origFetch = globalThis.fetch;
  const origNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

  let recognitionCalls = 0;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/api/receipt-scan')) {
      recognitionCalls++;
      await new Promise(r => setTimeout(r, 30));
      return { ok: true, status: 200, json: async () => ({ foodName: 'Sweet Potato', localName: 'Kamote', confidence: 0.95 }) };
    }
    if (String(url).includes('/api/scans') && opts?.method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ ...JSON.parse(opts.body), synced: true }) };
    }
    return { ok: true, status: 200, json: async () => ([]) };
  };

  const state = { appMode: 'diet', activeTab: 'scanner', scannerTab: 'food_label', activeDiet: 'lid', aiLoading: false };
  const fakeDataUrl = 'data:image/jpeg;base64,' + Buffer.from('kamote-test').toString('base64');

  try {
    await Promise.all([
      executeScanWorkflow(fakeDataUrl, { state, render: () => {} }),
      executeScanWorkflow(fakeDataUrl, { state, render: () => {} }),
      executeScanWorkflow(fakeDataUrl, { state, render: () => {} })
    ]);
    assert.strictEqual(recognitionCalls, 1, 'Rapid repeated taps must trigger only 1 recognition request');
    assert.strictEqual(getLocalScanHistory().length, 1, 'Rapid repeated taps must create only 1 scan history record');
  } finally {
    globalThis.fetch = origFetch;
    if (origNavDesc) Object.defineProperty(globalThis, 'navigator', origNavDesc);
  }
  console.log('  ✅ Test 2 Passed: Rapid repeated taps on executeScanWorkflow produce 1 record.');
}

// Test 3: updateScanRecordImage attaches Cloudinary URL to existing scan ID without duplicating
{
  globalThis.localStorage.clear();
  const scanId = generateScanId();
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => ({
    ok: true,
    status: 200,
    json: async () => ({ ...JSON.parse(opts?.body || '{}'), synced: true })
  });

  try {
    saveScanResult({ id: scanId, title: 'Malunggay', status: 'SAFE', reason: 'Safe produce', imageUrl: null });
    await new Promise(r => setTimeout(r, 10));
    const updated = updateScanRecordImage(scanId, 'https://res.cloudinary.com/demo/image/upload/malunggay.jpg');
    assert.strictEqual(updated.length, 1, 'Updating Cloudinary URL must not add a second scan record');
    assert.strictEqual(updated[0].id, scanId);
    assert.strictEqual(updated[0].imageUrl, 'https://res.cloudinary.com/demo/image/upload/malunggay.jpg');
  } finally {
    globalThis.fetch = origFetch;
  }
  console.log('  ✅ Test 3 Passed: Cloudinary upload updates existing scan ID without duplication.');
}

// Test 4: reconcileScanRecords merges local + remote by ID & repeated syncs are idempotent
{
  const id = 'scan-uuid-123';
  const local = [{
    id,
    title: 'Kamote (Sweet Potato)',
    status: 'SAFE',
    reason: 'Fresh produce',
    imageUrl: 'data:image/jpeg;base64,abc',
    synced: false,
    createdAt: '2026-11-20T10:00:00.000Z'
  }];
  const remote = [{
    id,
    title: 'Scanned Food Label',
    status: 'SAFE',
    reason: 'Fresh produce',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/kamote.jpg',
    createdAt: '2026-11-20T10:00:00.000Z'
  }];

  const merged1 = reconcileScanRecords(remote, local);
  assert.strictEqual(merged1.length, 1, 'Local and remote copies with same ID must merge into 1 record');
  assert.strictEqual(merged1[0].title, 'Kamote (Sweet Potato)', 'Custom local title preserved');
  assert.strictEqual(merged1[0].imageUrl, 'https://res.cloudinary.com/demo/image/upload/kamote.jpg', 'Remote HTTP URL preferred over data URI');

  const merged2 = reconcileScanRecords(remote, merged1);
  const merged3 = reconcileScanRecords(remote, merged2);
  assert.strictEqual(merged3.length, 1, 'Repeated synchronization cycles must remain idempotent');
  console.log('  ✅ Test 4 Passed: Local/remote reconciliation and repeated sync cycles are idempotent.');
}

// Test 5: Offline-created scans synchronize with same ID & distinct scans with same timestamp are preserved
{
  globalThis.localStorage.clear();
  const offlineId = generateScanId();
  const distinctId = generateScanId();
  const sharedTs = '2026-11-20T11:00:00.000Z';

  // Save offline
  const origNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  saveScanResult({ id: offlineId, title: 'Offline Scan 1', status: 'SAFE', createdAt: sharedTs });
  saveScanResult({ id: distinctId, title: 'Offline Scan 2', status: 'CAUTION', createdAt: sharedTs });
  assert.strictEqual(cleanupDuplicateScans(getLocalScanHistory()).length, 2, 'Distinct scans with same timestamp must NOT be deleted');

  // Come back online and sync
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  const origFetch = globalThis.fetch;
  const postedIds = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/api/scans') && opts?.method === 'POST') {
      const b = JSON.parse(opts.body);
      postedIds.push(b.id);
      return { ok: true, status: 200, json: async () => ({ ...b, synced: true }) };
    }
    return { ok: true, status: 200, json: async () => ([]) };
  };

  try {
    const syncRes = await syncPendingScans();
    assert.strictEqual(syncRes.syncedCount, 2);
    assert.ok(postedIds.includes(offlineId) && postedIds.includes(distinctId), 'Offline scans must sync with original IDs');
  } finally {
    globalThis.fetch = origFetch;
    if (origNavDesc) Object.defineProperty(globalThis, 'navigator', origNavDesc);
  }
  console.log('  ✅ Test 5 Passed: Offline scans sync with original IDs & distinct scans are preserved.');
}

// Test 6: Remote Photo badge only appears for HTTP(S) URLs, not local data URIs; api/scans.js has ownership guard
{
  const htmlLocal = renderScannerTab({
    scannerEnabled: true,
    scanHistory: [{ id: '1', title: 'Local', status: 'SAFE', imageUrl: 'data:image/jpeg;base64,abc', timestamp: '2026-11-20T12:00:00Z' }]
  });
  assert.ok(!htmlLocal.includes('Remote Photo'), 'data: URI must not show Remote Photo badge');

  const htmlRemote = renderScannerTab({
    scannerEnabled: true,
    scanHistory: [{ id: '2', title: 'Remote', status: 'SAFE', imageUrl: 'https://res.cloudinary.com/demo/img.jpg', timestamp: '2026-11-20T12:00:00Z' }]
  });
  assert.ok(htmlRemote.includes('Remote Photo'), 'HTTPS Cloudinary URL must show Remote Photo badge');

  const apiSrc = fs.readFileSync(new URL('../api/scans.js', import.meta.url), 'utf8');
  assert.ok(apiSrc.includes('ON CONFLICT (id) DO UPDATE SET'), 'api/scans.js must use idempotent ON CONFLICT upsert');
  assert.ok(apiSrc.includes('WHERE scans.user_id = ${userId} OR scans.user_id IS NULL'), 'api/scans.js must enforce ownership on upsert');

  const mainSrc = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(mainSrc.includes('processScanTextInFlight'), 'Manual/preset text submission must have in-flight lock');
  console.log('  ✅ Test 6 Passed: Remote Photo badge accuracy, API ownership upsert, and manual submission lock verified.');
}

console.log('\n🎉 All Duplicate Scan History Prevention Tests Passed!');
