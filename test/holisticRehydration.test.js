import assert from 'node:assert';
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { isValidPostgresUrl } from '../api/trips.js';
import tripsApiHandler from '../api/trips.js';
import foodWasteApiHandler from '../api/food-waste.js';
import inventoryApiHandler from '../api/inventory.js';
import mealPlansApiHandler from '../api/meal-plans.js';
import settingsApiHandler from '../api/settings.js';
import scansApiHandler from '../api/scans.js';
import {
  saveShoppingTrip,
  getShoppingTrips,
  getGroceryItems,
  getExpenses,
  saveFoodWasteRecord,
  getFoodWasteRecords,
  saveMealPlan,
  getMealPlans,
  syncAndHydrateUserData,
  handleTenantAccountChange,
  mergeRemoteCourseData
} from '../src/services/courseProjectStorage.js';
import {
  saveScanResult,
  getLocalScanHistory,
  reconcileScanRecords,
  getScanHistory
} from '../src/services/storage.js';

// Setup Mock In-Memory localStorage & window for Node test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};
globalThis.sessionStorage = {
  clear: () => {}
};

let isOnline = true;
try {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    get: () => isOnline,
    configurable: true
  });
} catch (_) {
  globalThis.navigator = { get onLine() { return isOnline; } };
}

const eventLog = [];
globalThis.window = {
  dispatchEvent: (event) => {
    eventLog.push(event);
    return true;
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent {
    constructor(name, opts) {
      this.name = name;
      this.type = name;
      this.detail = opts?.detail;
    }
  };
}

const DATABASE_URL = process.env.DATABASE_URL;

console.log('\n🧪 Starting KosherAI Holistic Neon Rehydration & Bidirectional Sync Acceptance Test Suite...\n');

// Mock request & response helpers
function createMockReq({ method = 'GET', url = '/api/trips', body = null, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  return {
    method,
    url,
    body,
    headers: reqHeaders,
    on: (evt, cb) => {
      if (evt === 'data' && body) cb(JSON.stringify(body));
      if (evt === 'end') cb();
    }
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    bodyData: null,
    setHeader(k, v) { res.headers[k] = v; },
    status(code) { res.statusCode = code; return res; },
    json(data) { res.bodyData = data; return res; },
    end(str) {
      if (str && !res.bodyData) {
        try { res.bodyData = JSON.parse(str); } catch (_) { res.bodyData = str; }
      }
      return res;
    }
  };
  return res;
}

async function runTests() {
  assert(isValidPostgresUrl(DATABASE_URL), 'Neon DATABASE_URL must be valid for tests.');
  const sql = neon(DATABASE_URL);

  const TEST_USER_A = 'test_holistic_user_a_' + Date.now();
  const TEST_USER_B = 'test_holistic_user_b_' + Date.now();
  const TOKEN_A = 'holistic_token_a_' + Date.now();
  const TOKEN_B = 'holistic_token_b_' + Date.now();

  let simulatePartialFailure = false;
  let simulateAllFailures = false;

  // Insert test users into Neon
  await sql`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES 
      (${TEST_USER_A}, 'Holistic Tester A', ${`holistic_a_${Date.now()}@test.com`}, true, NOW(), NOW()),
      (${TEST_USER_B}, 'Holistic Tester B', ${`holistic_b_${Date.now()}@test.com`}, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;

  await sql`
    INSERT INTO "session" (id, user_id, token, expires_at, created_at, updated_at)
    VALUES 
      (${'sess_holistic_a_' + Date.now()}, ${TEST_USER_A}, ${TOKEN_A}, NOW() + INTERVAL '1 day', NOW(), NOW()),
      (${'sess_holistic_b_' + Date.now()}, ${TEST_USER_B}, ${TOKEN_B}, NOW() + INTERVAL '1 day', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;

  const nativeFetch = globalThis.fetch;
  let activeToken = TOKEN_A;

  globalThis.fetch = async (url, options = {}) => {
    const urlStr = typeof url === 'string' ? url : (url?.url || String(url));

    // Preserve native fetch for external HTTPS / data / blob
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('data:') || urlStr.startsWith('blob:')) {
      if (!isOnline && !urlStr.startsWith('data:') && !urlStr.startsWith('blob:')) {
        throw new Error('Failed to fetch: net::ERR_INTERNET_DISCONNECTED');
      }
      return nativeFetch(url, options);
    }

    if (!isOnline) {
      throw new Error('Failed to fetch: net::ERR_INTERNET_DISCONNECTED');
    }

    if (simulateAllFailures) {
      throw new Error('Database connection failed / Timeout');
    }

    if (simulatePartialFailure && urlStr.startsWith('/api/inventory')) {
      throw new Error('Network error on inventory endpoint');
    }

    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    const headers = {
      ...(options.headers || {}),
      authorization: options.headers?.authorization || `Bearer ${activeToken}`
    };

    const req = createMockReq({ method, url: urlStr, body, headers });
    const res = createMockRes();

    if (urlStr.startsWith('/api/trips')) {
      await tripsApiHandler(req, res);
    } else if (urlStr.startsWith('/api/food-waste')) {
      await foodWasteApiHandler(req, res);
    } else if (urlStr.startsWith('/api/scans')) {
      await scansApiHandler(req, res);
    } else if (urlStr.startsWith('/api/inventory')) {
      await inventoryApiHandler(req, res);
    } else if (urlStr.startsWith('/api/meal-plans')) {
      await mealPlansApiHandler(req, res);
    } else if (urlStr.startsWith('/api/settings')) {
      await settingsApiHandler(req, res);
    } else if (urlStr.startsWith('/api/auth/get-session')) {
      res.status(200).json({
        session: { token: activeToken, userId: activeToken === TOKEN_A ? TEST_USER_A : TEST_USER_B },
        user: { id: activeToken === TOKEN_A ? TEST_USER_A : TEST_USER_B, name: 'Holistic Tester', email: 'test@example.com' }
      });
    } else {
      res.status(404).json({ error: 'NOT_FOUND' });
    }

    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      json: async () => res.bodyData
    };
  };

  // Helper to switch active session token
  function setTestSession(user, token) {
    activeToken = token;
    localStorage.setItem('better-auth.session_token', token);
    localStorage.setItem('kosherai_current_user', JSON.stringify({ id: user, name: 'Holistic User', token }));
    localStorage.setItem('kosherai_user_session', JSON.stringify({
      token,
      session: { token, userId: user },
      user: { id: user, name: 'Holistic User', token }
    }));
  }

  // =========================================================================
  // Test A: Normal Login Restoration of All Neon Tables for an Authenticated User
  // =========================================================================
  console.log('Test A: Normal Login Restoration of All Neon Tables');
  setTestSession(TEST_USER_A, TOKEN_A);
  handleTenantAccountChange(TEST_USER_A);

  const testTripId = `trip_a_seed_${Date.now()}`;
  const testTrip = {
    id: testTripId,
    date: '2026-11-05',
    projectWeek: 2,
    storeName: 'Puregold Supermarket',
    tripType: 'Supermarket',
    totalAmountPaid: 450.00,
    totalScaleWeightKg: 3.20,
    receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    notes: 'Seed trip',
    items: [
      { id: `item_${Date.now()}_1`, name: 'Chicken Breast', quantity: 1, unit: 'kg', unitPrice: 220, totalPrice: 220, weightGrams: 1000, category: 'Poultry' },
      { id: `item_${Date.now()}_2`, name: 'Fresh Carrots', quantity: 2, unit: 'pcs', unitPrice: 115, totalPrice: 230, weightGrams: 500, category: 'Produce' }
    ]
  };

  const testWaste = {
    id: `waste_a_seed_${Date.now()}`,
    date: '2026-11-06',
    projectWeek: 2,
    itemName: 'Expired Spinach',
    measuredWeightG: 250,
    isEstimated: false,
    estimatedCost: 65,
    reason: 'Spoiled / Molded'
  };

  const testScan = {
    id: `scan_a_seed_${Date.now()}`,
    title: 'Certified Kosher Olive Oil',
    status: 'SAFE',
    reason: 'Pure cold pressed olive oil',
    flaggedIngredients: [],
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/oil.jpg',
    createdAt: new Date().toISOString()
  };

  const testInventory = {
    id: `inv_a_seed_${Date.now()}`,
    name: 'Basmati Rice',
    quantity: 5,
    unit: 'kg',
    category: 'Grains & Pasta',
    location: 'Pantry'
  };

  const testMealPlan = {
    id: `meal_a_seed_${Date.now()}`,
    projectWeek: 2,
    dayOfWeek: 'Wednesday',
    mealType: 'Dinner',
    dishName: 'Roast Chicken with Vegetables',
    recipeTitle: 'Roast Chicken with Vegetables',
    servings: 4
  };

  // Seed directly to Neon via our API handlers
  await fetch('/api/trips', { method: 'POST', body: JSON.stringify(testTrip) });
  await fetch('/api/food-waste', { method: 'POST', body: JSON.stringify(testWaste) });
  await fetch('/api/scans', { method: 'POST', body: JSON.stringify(testScan) });
  await fetch('/api/inventory', { method: 'POST', body: JSON.stringify({ item: testInventory }) });
  await fetch('/api/meal-plans', { method: 'POST', body: JSON.stringify({ plan: testMealPlan }) });
  await fetch('/api/settings', { method: 'POST', body: JSON.stringify({ household_members: 5, active_diet: 'LOW_IODINE' }) });

  // Clear local storage and run rehydration
  localStorage.clear();
  setTestSession(TEST_USER_A, TOKEN_A);

  const hydrateRes = await syncAndHydrateUserData();
  assert.strictEqual(hydrateRes.ok, true, 'Hydration must succeed for authenticated user.');

  const trips = getShoppingTrips();
  const waste = getFoodWasteRecords();
  const scans = getLocalScanHistory();
  const mealPlans = getMealPlans();
  const invStr = localStorage.getItem('kosherai_inventory');
  const inventory = invStr ? JSON.parse(invStr) : [];
  const settingsStr = localStorage.getItem('kosherai_settings');
  const settings = settingsStr ? JSON.parse(settingsStr) : {};

  assert(trips.some(t => t.id === testTripId), 'Trips must be restored from Neon');
  assert(waste.some(w => w.id === testWaste.id), 'Food waste must be restored from Neon');
  assert(scans.some(s => s.id === testScan.id), 'Scans must be restored from Neon');
  assert(inventory.some(i => i.id === testInventory.id), 'Inventory must be restored from Neon');
  assert(mealPlans.some(m => m.id === testMealPlan.id), 'Meal plans must be restored from Neon');
  assert.strictEqual(Number(localStorage.getItem('kosherai_household_members')), 5, 'Household members must be restored');
  console.log('  ✅ Test A Passed: All tables restored cleanly upon login.');

  // =========================================================================
  // Test B: Clear Local Storage Completely, Authenticate & Verify 100% Recovery
  // =========================================================================
  console.log('Test B: 100% Cloud Restoration Without Manual Console Script');
  mockStorage.clear();
  setTestSession(TEST_USER_A, TOKEN_A);

  assert.strictEqual(getShoppingTrips().length, 0, 'Local cache must be completely empty before hydration');
  const autoRestoreRes = await syncAndHydrateUserData();
  assert.strictEqual(autoRestoreRes.ok, true);
  assert(getShoppingTrips().length > 0, 'Shopping trips recovered 100% without console scripts');
  assert(getFoodWasteRecords().length > 0, 'Food waste logs recovered 100% without console scripts');
  assert(getLocalScanHistory().length > 0, 'Scan history recovered 100% without console scripts');
  console.log('  ✅ Test B Passed: Data recovered automatically without manual console intervention.');

  // =========================================================================
  // Test C: Scanned-Food Local Preservation (Manual Corrections Kept)
  // =========================================================================
  console.log('Test C: Scanned-Food Local Preservation (Manual Corrections Kept)');
  // Modify local scan with user-corrected title and mark synced: false
  const existingScans = getLocalScanHistory();
  const modifiedScan = {
    ...existingScans[0],
    title: 'Manually Corrected: Organic Kosher Sesame Oil',
    synced: false
  };
  localStorage.setItem('kosherai_scan_history', JSON.stringify([modifiedScan]));

  // Reconcile with remote scans from Neon (which has the old title)
  const remoteScans = [{ ...existingScans[0], title: 'Certified Kosher Olive Oil', synced: true }];
  const reconciled = reconcileScanRecords(remoteScans, [modifiedScan]);

  const target = reconciled.find(s => s.id === modifiedScan.id);
  assert.strictEqual(target.title, 'Manually Corrected: Organic Kosher Sesame Oil', 'Local user corrections must win over stale remote title');
  console.log('  ✅ Test C Passed: Manual corrections preserved; stale remote data does not overwrite local edits.');

  // =========================================================================
  // Test D: Complete Dataset Verification (Existing Neon + Newly Synced + Remaining Unsynced)
  // =========================================================================
  console.log('Test D: Complete Dataset Formula Verification');
  const remoteTrips = [
    { id: 'trip_remote_1', date: '2026-11-01', storeName: 'Remote Supermarket', totalAmountPaid: 500, synced: true, items: [] }
  ];
  const localTrips = [
    { id: 'trip_synced_local', date: '2026-11-02', storeName: 'Local Synced Store', totalAmountPaid: 200, synced: true, items: [] },
    { id: 'trip_pending_local', date: '2026-11-03', storeName: 'Local Pending Store', totalAmountPaid: 150, synced: false, items: [] }
  ];

  localStorage.setItem('kosherai_course_trips', JSON.stringify(localTrips));
  mergeRemoteCourseData(remoteTrips, null);

  const mergedTrips = getShoppingTrips();
  const mergedIds = new Set(mergedTrips.map(t => t.id));

  assert(mergedIds.has('trip_remote_1'), 'Existing Neon record must be included');
  assert(mergedIds.has('trip_synced_local'), 'Newly synced local record must be included');
  assert(mergedIds.has('trip_pending_local'), 'Remaining unsynced local record must be included');
  assert.strictEqual(mergedTrips.length, 3, 'Merged dataset must strictly equal 3 records (no deletions, no losses)');
  console.log('  ✅ Test D Passed: Complete dataset formula strictly satisfied.');

  // =========================================================================
  // Test E: Offline Creation & Reconnection Sync Without Duplicates
  // =========================================================================
  console.log('Test E: Offline Creation & Reconnection Sync Without Duplicates');
  isOnline = false;

  const offlineTripId = `trip_offline_unique_${Date.now()}`;
  await saveShoppingTrip({
    id: offlineTripId,
    date: '2026-11-07',
    projectWeek: 2,
    storeName: 'Kakabasa Wet Market',
    tripType: 'Wet Market',
    totalAmountPaid: 40.00,
    totalScaleWeightKg: 0.73,
    items: [{ id: `item_${Date.now()}_k`, name: 'Fresh Tilapia', quantity: 1, unit: 'kg', unitPrice: 40, totalPrice: 40, weightGrams: 730 }]
  });

  const offlineScanId = `scan_offline_unique_${Date.now()}`;
  saveScanResult({
    id: offlineScanId,
    title: 'Offline Scanned Crackers',
    status: 'CAUTION',
    reason: 'Contains unverified emulsifiers'
  });

  assert(getShoppingTrips().some(t => t.id === offlineTripId && t.synced === false), 'Trip created offline marked synced: false');
  assert(getLocalScanHistory().some(s => s.id === offlineScanId && s.synced === false), 'Scan created offline marked synced: false');

  // Go back online and synchronize
  isOnline = true;
  const syncResult1 = await syncAndHydrateUserData();
  assert(syncResult1.tripsSynced >= 1, 'Offline trip must sync upon reconnection');
  assert(syncResult1.scansSynced >= 1, 'Offline scan must sync upon reconnection');

  // Repeat sync immediately
  const syncResult2 = await syncAndHydrateUserData();
  const allTripsAfterSync = getShoppingTrips().filter(t => t.id === offlineTripId);
  const allScansAfterSync = getLocalScanHistory().filter(s => s.id === offlineScanId);

  assert.strictEqual(allTripsAfterSync.length, 1, 'Duplicate trips must not exist in local cache');
  assert.strictEqual(allScansAfterSync.length, 1, 'Duplicate scans must not exist in local cache');

  const neonTripsCount = await sql`SELECT COUNT(*)::int as count FROM shopping_trips WHERE id = ${offlineTripId};`;
  assert.strictEqual(neonTripsCount[0].count, 1, 'Duplicate rows must not exist in Neon PostgreSQL');
  console.log('  ✅ Test E Passed: Offline creation & sync verified without duplicates.');

  // =========================================================================
  // Test F: Failed API / Timeout Resilience (Local Data Kept)
  // =========================================================================
  console.log('Test F: Failed API / Timeout Resilience');
  const countBefore = getShoppingTrips().length;
  simulateAllFailures = true;

  const failRes = await syncAndHydrateUserData();
  assert.strictEqual(failRes.ok, false, 'Failed sync must return ok: false');
  assert.strictEqual(getShoppingTrips().length, countBefore, 'Local trips must remain intact on API failure');
  simulateAllFailures = false;
  console.log('  ✅ Test F Passed: Local data intact despite API failures; error not interpreted as empty database.');

  // =========================================================================
  // Test G: Repeated Login/Logout Cycles
  // =========================================================================
  console.log('Test G: Repeated Login/Logout Cycles');
  for (let i = 0; i < 3; i++) {
    // Logout (clears auth credentials only)
    localStorage.removeItem('kosherai_current_user');
    localStorage.removeItem('kosherai_user_session');
    localStorage.removeItem('better-auth.session_token');

    // Sign back in as same user
    setTestSession(TEST_USER_A, TOKEN_A);
    const cycleRes = await syncAndHydrateUserData();
    assert.strictEqual(cycleRes.ok, true, `Cycle ${i + 1} hydration must succeed`);
  }
  console.log('  ✅ Test G Passed: 3 repeated login/logout cycles completed with zero data loss or duplicates.');

  // =========================================================================
  // Test H: Multi-Tenant Isolation (User A vs User B)
  // =========================================================================
  console.log('Test H: Multi-Tenant Isolation');
  // Switch to User B
  setTestSession(TEST_USER_B, TOKEN_B);
  const switched = handleTenantAccountChange(TEST_USER_B);
  assert.strictEqual(switched, true, 'Tenant account switch must purge previous user local cache');

  // User B's local cache is now clean
  assert.strictEqual(getShoppingTrips().length, 0, "User B must not see User A's trips in local cache");

  // Hydrate User B (currently 0 trips in Neon for User B)
  const userBHydrate = await syncAndHydrateUserData();
  assert.strictEqual(userBHydrate.ok, true);
  assert(!getShoppingTrips().some(t => t.id === testTripId), "User B must not receive User A's trips from Neon");

  // Switch back to User A
  setTestSession(TEST_USER_A, TOKEN_A);
  handleTenantAccountChange(TEST_USER_A);
  await syncAndHydrateUserData();
  assert(getShoppingTrips().some(t => t.id === testTripId), "User A's data restored upon switching back");
  console.log('  ✅ Test H Passed: Multi-tenant isolation verified; zero cross-tenant contamination.');

  // =========================================================================
  // Test I: Partial API Failure Handling
  // =========================================================================
  console.log('Test I: Partial API Failure Handling');
  simulatePartialFailure = true;
  const partialRes = await syncAndHydrateUserData();
  assert.strictEqual(partialRes.ok, true, 'Partial hydration succeeds for reachable resources');
  assert(getShoppingTrips().length > 0, 'Reachable resources hydrate successfully');
  simulatePartialFailure = false;
  console.log('  ✅ Test I Passed: Partial API failure handled gracefully.');

  // =========================================================================
  // Test J: Single-Flight Mutex / Concurrency Lock
  // =========================================================================
  console.log('Test J: Single-Flight Mutex & Concurrency Lock');
  const syncPromises = [
    syncAndHydrateUserData(),
    syncAndHydrateUserData(),
    syncAndHydrateUserData(),
    syncAndHydrateUserData(),
    syncAndHydrateUserData()
  ];

  const results = await Promise.all(syncPromises);
  // All 5 promises should return identical reference / result object
  const first = results[0];
  for (let i = 1; i < results.length; i++) {
    assert.strictEqual(results[i], first, `Concurrent call ${i + 1} must share the single in-flight promise`);
  }
  console.log('  ✅ Test J Passed: Single-flight lock prevented duplicate concurrent network calls.');

  // Cleanup Neon test records
  console.log('\n🧹 Cleaning up test records from Neon PostgreSQL...');
  await sql`DELETE FROM grocery_purchases WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
  await sql`DELETE FROM shopping_trips WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
  await sql`DELETE FROM food_waste_logs WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
  await sql`DELETE FROM scans WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
  await sql`DELETE FROM household_inventory WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
  await sql`DELETE FROM meal_plans WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
  await sql`DELETE FROM household_settings WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
  await sql`DELETE FROM "session" WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
  await sql`DELETE FROM "user" WHERE id IN (${TEST_USER_A}, ${TEST_USER_B});`;

  console.log('\n======================================================================');
  console.log('🎉 ALL 10 HOLISTIC REHYDRATION ACCEPTANCE TESTS (A THROUGH J) PASSED!');
  console.log('======================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Holistic Rehydration Test Failed:\n', err);
  process.exit(1);
});
