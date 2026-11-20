/**
 * test/foodScannerOptimization.test.js
 * Verification suite for KosherAI Gemini 3.8 Flash Integration & Mobile Scanner Reliability
 */

import assert from 'node:assert';
import fs from 'node:fs';
import {
  GEMINI_PRIMARY_MODEL,
  GEMINI_FALLBACK_MODELS,
  GEMINI_MODELS,
  buildGeminiRequestConfig,
  classifyGeminiError
} from '../lib/geminiConfig.js';
import {
  evaluateFoodForProtocol,
  dataUrlToBlob
} from '../src/services/aiVerification.js';
import {
  renderScannerTab,
  executeScanWorkflow,
  cancelActiveScan,
  recheckFoodName
} from '../src/components/ScannerTab.js';
import {
  saveScannerSessionState,
  loadScannerSessionState,
  clearScannerSessionState
} from '../src/services/scannerPersistence.js';
import handler, { parseGeminiJson } from '../api/receipt-scan.js';

// Minimal browser globals for testing
class MockStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}
globalThis.localStorage = new MockStorage();
globalThis.sessionStorage = new MockStorage();
globalThis.window = { dispatchEvent: () => { } };
globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; } };

console.log('🧪 Starting KosherAI Gemini 3.8 & Mobile Scanner Test Suite...\n');

// Test 1: Centralized Gemini 3.8 model configuration & no retired models
{
  assert.strictEqual(GEMINI_PRIMARY_MODEL, 'gemini-3.8-flash', 'Primary model must be gemini-3.8-flash');
  assert.ok(!GEMINI_MODELS.includes('gemini-2.0-flash'), 'Retired gemini-2.0-flash must not be in GEMINI_MODELS');
  assert.ok(!GEMINI_MODELS.includes('gemini-2.5-flash'), 'Deprecated gemini-2.5-flash must not be in GEMINI_MODELS');
  assert.deepStrictEqual(GEMINI_FALLBACK_MODELS, ['gemini-3.6-flash', 'gemini-3.5-flash']);

  const cfg = buildGeminiRequestConfig({ thinkingLevel: 'LOW', maxOutputTokens: 512 });
  assert.strictEqual(cfg.thinkingConfig.thinkingLevel, 'LOW');
  assert.strictEqual(cfg.responseMimeType, 'application/json');
  assert.strictEqual(cfg.temperature, undefined, 'Unsupported legacy temperature must not be set');
  assert.strictEqual(cfg.top_p, undefined, 'Unsupported legacy top_p must not be set');
  assert.strictEqual(cfg.top_k, undefined, 'Unsupported legacy top_k must not be set');
  assert.strictEqual(cfg.candidate_count, undefined, 'Unsupported candidate_count must not be set');
  assert.strictEqual(cfg.frequency_penalty, undefined, 'Unsupported frequency_penalty must not be set');
  assert.strictEqual(cfg.presence_penalty, undefined, 'Unsupported presence_penalty must not be set');
  assert.strictEqual(cfg.thinkingConfig.thinkingBudget, undefined, 'thinkingBudget must not be set');

  const aiSrc = fs.readFileSync(new URL('../src/services/aiVerification.js', import.meta.url), 'utf8');
  const apiSrc = fs.readFileSync(new URL('../api/receipt-scan.js', import.meta.url), 'utf8');
  assert.ok(!aiSrc.includes('gemini-2.0-flash'), 'gemini-2.0-flash must be removed from aiVerification.js');
  assert.ok(!apiSrc.includes('gemini-2.0-flash'), 'gemini-2.0-flash must be removed from api/receipt-scan.js');
  assert.ok(!aiSrc.includes('VITE_GEMINI_API_KEY'), 'Browser must not read VITE_GEMINI_API_KEY');
  console.log('  ✅ Test 1 Passed: Gemini 3.8 config, thinkingLevel=LOW, no retired models or legacy params.');
}

// Test 2: Error classification & Markdown-wrapped JSON parsing
{
  assert.strictEqual(classifyGeminiError(401, 'API key not valid').retryable, false);
  assert.strictEqual(classifyGeminiError(401, 'API key not valid').httpStatus, 401);
  assert.strictEqual(classifyGeminiError(429, 'Quota exceeded').httpStatus, 429);
  assert.strictEqual(classifyGeminiError(0, 'aborted', 'AbortError').httpStatus, 504);

  const mdJson = '```json\n{"foodName":"Sweet Potato","localName":"Kamote"}\n```';
  const parsed = parseGeminiJson(mdJson);
  assert.strictEqual(parsed.foodName, 'Sweet Potato');
  assert.strictEqual(parsed.localName, 'Kamote');
  assert.strictEqual(parseGeminiJson('not json at all'), null);
  console.log('  ✅ Test 2 Passed: Error classification and Markdown-wrapped JSON parsing verified.');
}

// Test 3: /api/receipt-scan structured JSON responses on validation & error cases
{
  const makeRes = () => {
    const out = {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader: (k, v) => { out.headers[k] = v; },
      status: (c) => { out.statusCode = c; return out; },
      json: (d) => { out.body = d; return out; },
      end: (s) => { if (s && !out.body) { try { out.body = JSON.parse(s); } catch { } } return out; }
    };
    return out;
  };

  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-server-key';
  try {
    // Missing image -> 400 structured JSON
    const r1 = await handler({ method: 'POST', headers: {}, body: {} }, makeRes());
    assert.strictEqual(r1.statusCode, 400);
    assert.strictEqual(r1.body.error, 'MISSING_IMAGE');

    // Unsupported mimeType -> 400 structured JSON
    const r2 = await handler({ method: 'POST', headers: {}, body: { imageBase64: 'a'.repeat(64), mimeType: 'image/gif' } }, makeRes());
    assert.strictEqual(r2.statusCode, 400);
    assert.strictEqual(r2.body.error, 'UNSUPPORTED_IMAGE_TYPE');
  } finally {
    if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    else delete process.env.GEMINI_API_KEY;
  }
  console.log('  ✅ Test 3 Passed: /api/receipt-scan returns structured JSON errors without crashing.');
}

// Test 4: Stage 2 dietary evaluation & food name correction
{
  const kamoteRec = { foodName: 'Sweet Potato', localName: 'Kamote', confidence: 0.94 };
  assert.strictEqual(evaluateFoodForProtocol(kamoteRec, 'lid').status, 'SAFE');
  assert.strictEqual(evaluateFoodForProtocol(kamoteRec, 'pinoy_keto').status, 'AVOID');

  const state = { activeDiet: 'pinoy_keto', scanAnalysis: { productName: 'Kamote', status: 'AVOID' } };
  recheckFoodName('Malunggay', state, () => { });
  assert.strictEqual(state.scanAnalysis.status, 'SAFE');
  console.log('  ✅ Test 4 Passed: Stage 2 evaluation & recheckFoodName verified.');
}

// Test 5: Mobile scanner session persistence (sessionStorage) & cleanup
{
  globalThis.sessionStorage.clear();
  saveScannerSessionState({ scannerTab: 'receipt', scanTarget: 'receipt', activeDiet: 'lid', scannerEnabled: true });
  const restored = loadScannerSessionState();
  assert.strictEqual(restored.activeTab, 'scanner');
  assert.strictEqual(restored.scannerTab, 'receipt');
  assert.strictEqual(restored.scanTarget, 'receipt');

  clearScannerSessionState();
  assert.strictEqual(loadScannerSessionState(), null, 'Leaving scanner must clear session restoration state');
  console.log('  ✅ Test 5 Passed: sessionStorage scanner tab restoration and cleanup verified.');
}

// Test 6: Failed scan preserves imagePreviewUrl, stays on scanner tab, and allows Retry Scan
{
  const origFetch = globalThis.fetch;
  const origNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  globalThis.fetch = async () => ({
    ok: false,
    status: 504,
    json: async () => ({ error: 'TIMEOUT', message: 'AI analysis timed out. Please retry with the captured image.' })
  });

  const state = {
    appMode: 'diet',
    activeTab: 'scanner',
    scannerTab: 'food_label',
    activeDiet: 'lid',
    aiLoading: false
  };
  const fakeDataUrl = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-data-for-test').toString('base64');

  try {
    await executeScanWorkflow(fakeDataUrl, { state, render: () => { } });
    assert.strictEqual(state.appMode, 'diet', 'Must remain in diet mode on failure');
    assert.strictEqual(state.activeTab, 'scanner', 'Must remain on scanner tab on failure');
    assert.strictEqual(state.imagePreviewUrl, fakeDataUrl, 'Captured image preview must be preserved on failure');
    assert.strictEqual(state.lastScannedDataUrl, fakeDataUrl, 'Captured dataUrl must be preserved for Retry');
    assert.strictEqual(state.aiLoading, false, 'Loading state must reset on failure');
    assert.ok(state.scanError.includes('timed out'), 'Error banner message must be populated');

    const errorHtml = renderScannerTab({ ...state, scannerEnabled: true });
    assert.ok(errorHtml.includes('id="retry-scan-btn"'), 'Retry Scan button must render using preserved image');
    assert.ok(errorHtml.includes('id="manual-food-entry-btn"'), 'Manual Food Entry must remain accessible');
  } finally {
    globalThis.fetch = origFetch;
    if (origNavDesc) Object.defineProperty(globalThis, 'navigator', origNavDesc);
  }
  console.log('  ✅ Test 6 Passed: Failed scan stays on Scanner, preserves image, resets loading, and renders Retry.');
}

// Test 7: Scanner buttons have type="button" & cancelActiveScan resets cleanly
{
  const tabSrc = fs.readFileSync(new URL('../src/components/ScannerTab.js', import.meta.url), 'utf8');
  assert.ok(tabSrc.includes('type="button" id="toggle-label-mode"'), 'Mode toggle must have type="button"');
  assert.ok(tabSrc.includes('type="button" id="toggle-receipt-mode"'), 'Receipt toggle must have type="button"');
  assert.ok(tabSrc.includes('type="button" id="toggle-text-mode"'), 'Text toggle must have type="button"');
  assert.ok(tabSrc.includes('type="button" id="rescan-btn"'), 'Rescan button must have type="button"');
  assert.ok(tabSrc.includes('if (isSubmittingScan || state.aiLoading)'), 'Duplicate submission guard must exist');

  const blob = dataUrlToBlob('data:image/jpeg;base64,' + Buffer.from('ok').toString('base64'));
  assert.ok(blob instanceof Blob);

  const cancelState = { aiLoading: true, ocrStatus: { message: 'Identifying food...' }, scanError: null };
  cancelActiveScan(cancelState, () => { });
  assert.strictEqual(cancelState.aiLoading, false);
  assert.strictEqual(cancelState.ocrStatus, null);
  console.log('  ✅ Test 7 Passed: Scanner button types, duplicate guard, and cancelActiveScan verified.');
}

console.log('\n🎉 All KosherAI Gemini 3.8 & Mobile Scanner Tests Passed!');
