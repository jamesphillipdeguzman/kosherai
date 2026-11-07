// Test Suite for Edit Food Waste Log Feature
// Verifies:
// 1. Storage update function: updateFoodWasteRecord (field updates, preservation of id, non-negative inputs)
// 2. Offline-first persistence and event emission
// 3. Neon synchronization and offline queuing
// 4. Tombstone deletion and multi-device prevention of resurrection
// 5. API /api/food-waste PUT/PATCH/DELETE endpoints
// 6. UI integration in EditWasteLogModal, FoodWasteLogView, CourseProjectView, and SixWeekStudyView

import assert from 'node:assert';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import foodWasteApiHandler from '../api/food-waste.js';
import {
  saveFoodWasteRecord,
  getFoodWasteRecords,
  updateFoodWasteRecord,
  deleteFoodWasteRecord,
  markFoodWasteSynced,
  syncPendingFoodWaste,
  getPendingDeletions,
  clearPendingDeletions,
  mergeRemoteCourseData
} from '../src/services/courseProjectStorage.js';

console.log('🧪 Starting Edit Food Waste Log Test Suite...\n');

// ---------------------------------------------------------------------------
// Mock Helpers & Environment Setup
// ---------------------------------------------------------------------------
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

const customEventsDispatched = [];
global.window = {
  dispatchEvent: (event) => {
    customEventsDispatched.push(event.type);
    return true;
  },
  CustomEvent: class {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
};
global.CustomEvent = global.window.CustomEvent;

// Ensure navigator.onLine is configurable in Node 22
if (typeof global.navigator === 'undefined') {
  global.navigator = {};
}
Object.defineProperty(global.navigator, 'onLine', {
  value: true,
  configurable: true,
  writable: true
});

function setOnline(status) {
  Object.defineProperty(global.navigator, 'onLine', {
    value: Boolean(status),
    configurable: true,
    writable: true
  });
}

function createMockReqRes(method, headers = {}, body = null, url = '/api/food-waste') {
  let statusCode = 200;
  let responseData = null;
  const resHeaders = {};

  const req = {
    method,
    url,
    headers: { ...headers },
    body
  };

  const res = {
    statusCode: 200,
    setHeader: (k, v) => { resHeaders[k.toLowerCase()] = v; },
    status: (code) => {
      statusCode = code;
      res.statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    end: (str) => {
      if (str && !responseData) {
        try { responseData = JSON.parse(str); } catch { responseData = str; }
      }
      return res;
    }
  };

  return {
    req,
    res,
    getStatus: () => res.statusCode || statusCode,
    getData: () => responseData
  };
}

let passedTests = 0;
function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAllTests() {
  // -------------------------------------------------------------------------
  // Test Section 1: Storage updateFoodWasteRecord
  // -------------------------------------------------------------------------
  console.log('--- Section 1: LocalStorage and updateFoodWasteRecord ---');

  mockStorage.clear();
  customEventsDispatched.length = 0;

  const initialRecord = saveFoodWasteRecord({
    itemName: 'Spoiled Tomatoes',
    date: '2026-11-01',
    projectWeek: 1,
    measuredWeightG: 320,
    isEstimated: false,
    estimatedCost: 45,
    reason: 'Spoiled / Molded',
    notes: 'Bought at market'
  });

  runTest('Initial food waste record is saved and retrievable', () => {
    const records = getFoodWasteRecords();
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].id, initialRecord.id);
    assert.strictEqual(records[0].itemName, 'Spoiled Tomatoes');
    assert.strictEqual(records[0].measuredWeightG, 320);
    assert.strictEqual(records[0].estimatedCost, 45);
  });

  await runAsyncTest('updateFoodWasteRecord updates fields and preserves original id', async () => {
    customEventsDispatched.length = 0;

    const updated = await updateFoodWasteRecord(initialRecord.id, {
      itemName: 'Heavily Spoiled Tomatoes',
      measuredWeightG: 410,
      estimatedCost: 55,
      reason: 'Expired Package',
      notes: 'Trimmed and discarded',
      projectWeek: 2
    });

    assert(updated, 'Returned updated record');
    assert.strictEqual(updated.id, initialRecord.id, 'Preserves original record id');
    assert.strictEqual(updated.itemName, 'Heavily Spoiled Tomatoes');
    assert.strictEqual(updated.measuredWeightG, 410);
    assert.strictEqual(updated.estimatedCost, 55);
    assert.strictEqual(updated.reason, 'Expired Package');
    assert.strictEqual(updated.projectWeek, 2);
    assert.strictEqual(updated.synced, false, 'Pending sync is marked false until server confirmation');

    // Check localStorage reflects the update
    const records = getFoodWasteRecords();
    const stored = records.find(r => r.id === initialRecord.id);
    assert.strictEqual(stored.itemName, 'Heavily Spoiled Tomatoes');
    assert.strictEqual(stored.measuredWeightG, 410);

    // Verify events were dispatched
    assert(customEventsDispatched.includes('kosherai-foodwaste-updated'), 'dispatched kosherai-foodwaste-updated');
    assert(customEventsDispatched.includes('kosherai_storage_updated'), 'dispatched kosherai_storage_updated');
  });

  await runAsyncTest('updateFoodWasteRecord enforces non-negative scale weight and cost', async () => {
    const updated = await updateFoodWasteRecord(initialRecord.id, {
      measuredWeightG: -250,
      estimatedCost: -99.5
    });

    assert.strictEqual(updated.measuredWeightG, 0, 'Negative weight is clamped to 0');
    assert.strictEqual(updated.estimatedCost, 0, 'Negative cost is clamped to 0');
  });

  await runAsyncTest('updateFoodWasteRecord returns null for non-existent record', async () => {
    const res = await updateFoodWasteRecord('non-existent-waste-id', { itemName: 'Ghost Waste' });
    assert.strictEqual(res, null);
  });

  // -------------------------------------------------------------------------
  // Test Section 2: Offline Resilience & Sync Queue
  // -------------------------------------------------------------------------
  console.log('\n--- Section 2: Offline Resilience & Sync Queue ---');

  await runAsyncTest('syncPendingFoodWaste safely handles offline state without throwing', async () => {
    setOnline(false);

    // Mock fetch to simulate offline
    const origFetch = global.fetch;
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      throw new Error('Network offline');
    };

    try {
      const result = await syncPendingFoodWaste();
      const syncedCount = typeof result === 'object' ? result.syncedCount : result;
      assert.strictEqual(syncedCount, 0, 'No records synced while offline');
      assert.strictEqual(fetchCalled, false, 'Fetch was not called when navigator.onLine is false');

      const records = getFoodWasteRecords();
      const rec = records.find(r => r.id === initialRecord.id);
      assert.strictEqual(rec.synced, false, 'Record remains unsynced in offline queue');
    } finally {
      global.fetch = origFetch;
      setOnline(true);
    }
  });

  await runAsyncTest('syncPendingFoodWaste syncs pending records and marks synced: true', async () => {
    setOnline(true);

    const origFetch = global.fetch;
    let payloadSent = null;

    global.fetch = async (url, options) => {
      payloadSent = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ success: true, synced: true, waste: payloadSent })
      };
    };

    try {
      const result = await syncPendingFoodWaste();
      const syncedCount = typeof result === 'object' ? result.syncedCount : result;
      assert(syncedCount >= 1, 'Synced at least 1 pending waste entry');
      assert(payloadSent, 'Sent waste payload to server');
      assert.strictEqual(payloadSent.id, initialRecord.id);

      const records = getFoodWasteRecords();
      const rec = records.find(r => r.id === initialRecord.id);
      assert.strictEqual(rec.synced, true, 'Record is marked synced: true after server confirmation');
    } finally {
      global.fetch = origFetch;
    }
  });

  // -------------------------------------------------------------------------
  // Test Section 3: Tombstone Deletion & Resurrection Prevention
  // -------------------------------------------------------------------------
  console.log('\n--- Section 3: Tombstone Deletion & Multi-Device Sync ---');

  await runAsyncTest('deleteFoodWasteRecord removes from storage and registers waste tombstone', async () => {
    clearPendingDeletions();

    deleteFoodWasteRecord(initialRecord.id);

    const records = getFoodWasteRecords();
    assert.strictEqual(records.find(r => r.id === initialRecord.id), undefined, 'Record removed locally');

    const pendingDeletions = getPendingDeletions();
    const wasteTombstone = pendingDeletions.find(d => d.id === initialRecord.id && d.type === 'waste');
    assert(wasteTombstone, 'Registered pending deletion tombstone of type "waste"');
  });

  runTest('mergeRemoteCourseData filters out tombstoned food waste records', () => {
    const remoteWaste = [
      { id: initialRecord.id, itemName: 'Resurrected Tomatoes', measuredWeightG: 300 },
      { id: 'legit-waste-2', itemName: 'Leftover Bread', measuredWeightG: 120 }
    ];

    const result = mergeRemoteCourseData([], remoteWaste, []);
    assert.strictEqual(result.wasteRestored, 1, 'Only 1 non-tombstoned record restored');

    const stored = getFoodWasteRecords();
    assert.strictEqual(
      stored.find(w => w.id === initialRecord.id),
      undefined,
      'Deleted record was blocked from resurrecting by tombstone'
    );
    assert(
      stored.find(w => w.id === 'legit-waste-2'),
      'Legitimate non-deleted record was merged successfully'
    );
  });

  // -------------------------------------------------------------------------
  // Test Section 4: API Handler Endpoint (/api/food-waste)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 4: /api/food-waste PUT / PATCH Endpoint ---');

  await runAsyncTest('API PUT/PATCH rejects unauthenticated requests', async () => {
    const { req, res, getStatus, getData } = createMockReqRes('PUT', {}, {
      id: 'test-waste-unauth',
      itemName: 'Spoiled Milk'
    });

    await foodWasteApiHandler(req, res);
    assert.strictEqual(getStatus(), 401, 'Returns 401 when unauthenticated');
    assert.strictEqual(getData().error, 'UNAUTHORIZED');
  });

  await runAsyncTest('API handles OPTIONS preflight with 204 No Content', async () => {
    const { req, res, getStatus } = createMockReqRes('OPTIONS');
    await foodWasteApiHandler(req, res);
    assert.strictEqual(getStatus(), 204);
  });

  // -------------------------------------------------------------------------
  // Test Section 5: UI Components and Architecture Inspection
  // -------------------------------------------------------------------------
  console.log('\n--- Section 5: Component and Architecture Integration ---');

  runTest('EditWasteLogModal.jsx exists and has fixed header, scrollable body, and pinned footer', () => {
    const modalPath = path.resolve('src/components/EditWasteLogModal.jsx');
    assert(fs.existsSync(modalPath), 'EditWasteLogModal.jsx exists');

    const content = fs.readFileSync(modalPath, 'utf8');
    assert(content.includes('export default function EditWasteLogModal'), 'Exports EditWasteLogModal component');
    assert(content.includes('shrink-0'), 'Uses shrink-0 for fixed header and footer');
    assert(content.includes('overflow-y-auto'), 'Uses scrollable form body');
    assert(content.includes('updateFoodWasteRecord'), 'Calls updateFoodWasteRecord on submission');
    assert(content.includes('WASTE_REASONS'), 'Exports or uses WASTE_REASONS');
    assert(content.includes('Save Changes'), 'Provides Save Changes button');
  });

  runTest('FoodWasteLogView.jsx provides summary metrics, responsive table, and edit action', () => {
    const viewPath = path.resolve('src/components/FoodWasteLogView.jsx');
    assert(fs.existsSync(viewPath), 'FoodWasteLogView.jsx exists');

    const content = fs.readFileSync(viewPath, 'utf8');
    assert(content.includes('export default function FoodWasteLogView'), 'Exports FoodWasteLogView component');
    assert(content.includes('EditWasteLogModal'), 'Integrates EditWasteLogModal');
    assert(content.includes('deleteFoodWasteRecord'), 'Integrates deleteFoodWasteRecord');
    assert(content.includes('totalGrams'), 'Computes total waste grams');
    assert(content.includes('totalCost'), 'Computes total waste cost');
  });

  runTest('SixWeekStudyView.jsx integrates FoodWasteLogView and week filtering', () => {
    const studyViewPath = path.resolve('src/components/SixWeekStudyView.jsx');
    const content = fs.readFileSync(studyViewPath, 'utf8');
    assert(content.includes('FoodWasteLogView'), 'Imports FoodWasteLogView');
    assert(content.includes("activeSubTab === 'waste'"), 'Renders FoodWasteLogView when subtab is waste');
    assert(content.includes('kosherai-foodwaste-updated'), 'Listens for food waste update events');
  });

  runTest('CourseProjectView.js and main.js support Edit Waste button and modal', () => {
    const courseViewPath = path.resolve('src/components/CourseProjectView.js');
    const courseContent = fs.readFileSync(courseViewPath, 'utf8');
    assert(courseContent.includes('edit-waste-btn'), 'CourseProjectView renders edit-waste-btn');
    assert(courseContent.includes('renderEditWasteModal'), 'CourseProjectView defines renderEditWasteModal');

    const mainPath = path.resolve('src/main.js');
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    assert(mainContent.includes('editWasteModalOpen'), 'main.js maintains editWasteModalOpen state');
    assert(mainContent.includes('updateFoodWasteRecord'), 'main.js imports updateFoodWasteRecord');
    assert(mainContent.includes('.edit-waste-btn[data-edit-waste]'), 'main.js wires edit waste button click');
  });

  console.log(`\n🎉 All ${passedTests} Edit Food Waste tests passed successfully!\n`);
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
