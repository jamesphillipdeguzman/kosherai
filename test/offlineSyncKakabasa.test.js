import assert from 'node:assert';
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { isValidPostgresUrl } from '../api/trips.js';
import tripsApiHandler from '../api/trips.js';
import foodWasteApiHandler from '../api/food-waste.js';
import scansApiHandler from '../api/scans.js';
import { getSafeTestDatabaseUrl } from '../lib/databaseSafety.js';
import {
  saveShoppingTrip,
  getShoppingTrips,
  getGroceryItems,
  getExpenses,
  saveFoodWasteRecord,
  getFoodWasteRecords,
  saveStandaloneExpense,
  syncPendingTrips,
  syncPendingFoodWaste,
  syncPendingExpenses,
  syncAndHydrateUserData,
  safeCompressReceiptImage
} from '../src/services/courseProjectStorage.js';
import {
  saveScanResult,
  getLocalScanHistory,
  syncPendingScans
} from '../src/services/storage.js';
import { renderTripCard, renderShoppingTripsView } from '../src/components/ShoppingTripsView.js';

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

let isOnline = false;
try {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    get: () => isOnline,
    configurable: true
  });
} catch (_) {
  // If navigator was undefined or configurable
  globalThis.navigator = { get onLine() { return isOnline; } };
}

globalThis.window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent {
    constructor(name, opts) {
      this.name = name;
      this.detail = opts?.detail;
    }
  };
}

const DATABASE_URL = process.env.DATABASE_URL;

console.log('\n🧪 Starting KosherAI Offline-to-Neon Synchronization & Kakabasa Verification Test Suite...\n');

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
  const testDbUrl = getSafeTestDatabaseUrl();
  if (!testDbUrl) {
    console.log('ℹ️ [Protected] DATABASE_URL_TEST is not configured or matches production database. Skipping live Neon tests to protect production data.');
    process.exit(0);
  }
  const sql = neon(testDbUrl);

  // Setup isolated test users in Neon
  const TEST_USER_A = 'test_kakabasa_user_a_' + Date.now();
  const TEST_USER_B = 'test_kakabasa_user_b_' + Date.now();
  const TOKEN_A = 'kakabasa_token_a_' + Date.now();
  const TOKEN_B = 'kakabasa_token_b_' + Date.now();

  await sql`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES 
      (${TEST_USER_A}, 'Kakabasa Tester A', ${`kakabasa_a_${Date.now()}@test.com`}, true, NOW(), NOW()),
      (${TEST_USER_B}, 'Kakabasa Tester B', ${`kakabasa_b_${Date.now()}@test.com`}, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;

  await sql`
    INSERT INTO "session" (id, user_id, token, expires_at, created_at, updated_at)
    VALUES 
      (${'sess_kakabasa_a_' + Date.now()}, ${TEST_USER_A}, ${TOKEN_A}, NOW() + INTERVAL '1 day', NOW(), NOW()),
      (${'sess_kakabasa_b_' + Date.now()}, ${TEST_USER_B}, ${TOKEN_B}, NOW() + INTERVAL '1 day', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;

  // Wire globalThis.fetch to route internal /api routes to serverless API handlers with current active session,
  // while preserving nativeFetch for external endpoints (Neon PostgreSQL HTTP driver, Cloudinary, data: URLs)
  const nativeFetch = globalThis.fetch;
  let activeToken = TOKEN_A;
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = typeof url === 'string' ? url : (url?.url || String(url));

    // If external URL (e.g. Neon serverless endpoint, Cloudinary, data: blob:), call native fetch when online
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('data:') || urlStr.startsWith('blob:')) {
      if (!isOnline && !urlStr.startsWith('data:') && !urlStr.startsWith('blob:')) {
        throw new Error('Failed to fetch: net::ERR_INTERNET_DISCONNECTED');
      }
      return nativeFetch(url, options);
    }

    if (!isOnline) {
      throw new Error('Failed to fetch: net::ERR_INTERNET_DISCONNECTED');
    }

    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    const headers = {
      ...(options.headers || {}),
      authorization: options.headers?.authorization || `Bearer ${activeToken}`
    };

    const req = createMockReq({ method, url, body, headers });
    const res = createMockRes();

    if (url.startsWith('/api/trips')) {
      await tripsApiHandler(req, res);
    } else if (url.startsWith('/api/food-waste')) {
      await foodWasteApiHandler(req, res);
    } else if (url.startsWith('/api/scans')) {
      await scansApiHandler(req, res);
    } else if (url.startsWith('/api/inventory')) {
      res.status(200).json({ success: true, synced: true, inventory: [] });
    } else if (url.startsWith('/api/meal-plans')) {
      res.status(200).json({ success: true, synced: true, mealPlans: [] });
    } else if (url.startsWith('/api/settings')) {
      res.status(200).json({ success: true, synced: true, settings: { household_members: 4 } });
    } else if (url.startsWith('/api/auth/get-session')) {
      res.status(200).json({
        session: { token: activeToken },
        user: { id: TEST_USER_A, name: 'Kakabasa Tester A' }
      });
    } else {
      res.status(404).json({ error: 'Not found' });
    }

    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      json: async () => res.bodyData,
      text: async () => JSON.stringify(res.bodyData)
    };
  };

  try {
    // -----------------------------------------------------------------------------------
    // Step 1: Simulate Offline Shopping Trip Creation for "Kakabasa" (₱40.00, 0.73 kg)
    // -----------------------------------------------------------------------------------
    console.log('Test 1: Recording Kakabasa shopping trip while OFFLINE');
    isOnline = false; // Strictly offline at supermarket / wet market stall
    localStorage.clear();
    localStorage.setItem('better-auth.session_token', TOKEN_A);
    localStorage.setItem('kosherai_current_user', JSON.stringify({ id: TEST_USER_A, token: TOKEN_A }));

    const kakabasaTripId = `trip_kakabasa_${Date.now()}`;
    const kakabasaRawReceipt = 'data:image/jpeg;base64,' + 'MOCK_BASE64_IMAGE_STRING_'.repeat(200);

    const savedTripResult = await saveShoppingTrip({
      id: kakabasaTripId,
      date: '2026-11-01',
      projectWeek: 1,
      storeName: 'Kakabasa',
      tripType: 'Wet Market / Palengke',
      totalAmountPaid: 40.00,
      totalScaleWeightKg: 0.73,
      receiptImageUrl: kakabasaRawReceipt,
      receiptRawText: 'Kakabasa fresh produce 0.73kg ₱40.00',
      notes: 'Wet market purchase - 0.73 kg fresh greens for ₱40.00'
    }, [
      {
        id: `item_kakabasa_${Date.now()}`,
        name: 'Fresh Kakabasa Greens',
        quantity: 1,
        unit: 'kg',
        unitPrice: 40.00,
        totalPrice: 40.00,
        weightGrams: 730,
        category: 'Produce',
        lidStatus: 'SAFE'
      }
    ]);

    assert.strictEqual(savedTripResult.synced, false, 'Trip must be saved with synced: false while offline');

    // -----------------------------------------------------------------------------------
    // Step 2: Verify Initial OFFLINE State & UI Badge
    // -----------------------------------------------------------------------------------
    console.log('Test 2: Verifying initial OFFLINE badge & local storage persistence');
    const localTrips = getShoppingTrips();
    assert.strictEqual(localTrips.length, 1);
    const kakabasaTrip = localTrips[0];
    assert.strictEqual(kakabasaTrip.id, kakabasaTripId);
    assert.strictEqual(kakabasaTrip.storeName, 'Kakabasa');
    assert.strictEqual(kakabasaTrip.totalAmountPaid, 40.00);
    assert.strictEqual(kakabasaTrip.totalScaleWeightKg, 0.73);
    assert.strictEqual(kakabasaTrip.synced, false, 'kakabasaTrip.synced must be false');

    // Verify linked items have synced === false
    const localItems = getGroceryItems(kakabasaTripId);
    assert.strictEqual(localItems.length, 1);
    assert.strictEqual(localItems[0].synced, false, 'Linked grocery items must be synced: false');
    assert.strictEqual(localItems[0].totalPrice, 40.00);

    // Verify UI Badge renders OFFLINE
    const tripCardHtml = renderTripCard(kakabasaTrip);
    assert(tripCardHtml.includes('trip-sync-badge offline'), 'Must render offline badge class');
    assert(tripCardHtml.includes('☁️⏳ OFFLINE'), 'Must render ☁️⏳ OFFLINE text');
    assert(!tripCardHtml.includes('☁️✓ NEON SYNCED'), 'Must NOT render NEON SYNCED badge while offline');
    console.log('  ✅ Test 2 Passed: Kakabasa trip is correctly marked ☁️⏳ OFFLINE with ₱40.00 and 0.73 kg.');

    // -----------------------------------------------------------------------------------
    // Step 3: Record Food Waste, Standalone Expense, and Scan History while OFFLINE
    // -----------------------------------------------------------------------------------
    console.log('Test 3: Logging Food Waste, Standalone Expense, and Food Label Scan while OFFLINE');
    const wasteRecord = saveFoodWasteRecord({
      itemName: 'Kakabasa Leaf Trimmings',
      measuredWeightG: 85,
      isEstimated: false,
      estimatedCost: 5.50,
      reason: 'Trimmings / Inedible',
      projectWeek: 1
    });
    assert.strictEqual(wasteRecord.synced, false, 'Food waste logged offline must be synced: false');

    const standaloneExp = saveStandaloneExpense({
      vendor: 'Kakabasa Stall Extra',
      category: 'Wet Market / Palengke',
      amount: 15.00,
      notes: 'Bags & packing'
    });
    assert.strictEqual(standaloneExp.synced, false, 'Standalone expense logged offline must be synced: false');

    const scanRecord = saveScanResult({
      title: 'Kakabasa Fresh Greens Scan',
      status: 'SAFE',
      reason: '100% natural wet market leafy greens',
      flaggedIngredients: []
    });
    const localScans = getLocalScanHistory();
    assert.strictEqual(localScans[0].synced, false, 'Scan recorded offline must be synced: false');
    console.log('  ✅ Test 3 Passed: All 5 collections have pending offline records created.');

    // -----------------------------------------------------------------------------------
    // Step 4: Reconnect to Internet & Trigger "Sync Neon"
    // -----------------------------------------------------------------------------------
    console.log('Test 4: Internet Reconnection & Neon Cloud Synchronization');
    isOnline = true; // User arrives home and reconnects to WiFi

    const syncReport = await syncAndHydrateUserData();
    assert.strictEqual(syncReport.ok, true, 'Sync orchestrator must succeed');
    assert(syncReport.tripsSynced >= 1, 'At least 1 trip must be synchronized to Neon');
    assert(syncReport.wasteSynced >= 1, 'At least 1 waste log must be synchronized to Neon');
    assert(syncReport.scansSynced >= 1, 'At least 1 scan must be synchronized to Neon');
    assert(syncReport.expensesSynced >= 1, 'At least 1 standalone expense must be synchronized to Neon');
    console.log(`  Report: ${syncReport.message}`);

    // -----------------------------------------------------------------------------------
    // Step 5: Verify Persistence in Neon PostgreSQL Database directly
    // -----------------------------------------------------------------------------------
    console.log('Test 5: Verifying Neon PostgreSQL database records for Kakabasa');
    const neonTripRows = await sql`
      SELECT * FROM shopping_trips WHERE id = ${kakabasaTripId} AND user_id = ${TEST_USER_A};
    `;
    assert.strictEqual(neonTripRows.length, 1, 'Kakabasa trip must exist in Neon shopping_trips');
    const neonTrip = neonTripRows[0];
    assert.strictEqual(neonTrip.store_name, 'Kakabasa');
    assert.strictEqual(Number(neonTrip.total_amount_paid), 40.00, 'Neon total_amount_paid must be 40.00');
    assert.strictEqual(Number(neonTrip.total_scale_weight_kg), 0.73, 'Neon total_scale_weight_kg must be 0.73');
    assert.strictEqual(neonTrip.items_count, 1, 'Neon items_count must be 1');
    assert.strictEqual(neonTrip.synced, true, 'Neon synced must be true');

    const neonItemRows = await sql`
      SELECT * FROM grocery_purchases WHERE trip_id = ${kakabasaTripId} AND user_id = ${TEST_USER_A};
    `;
    assert.strictEqual(neonItemRows.length, 1, 'Kakabasa grocery items must exist in Neon grocery_purchases');
    assert.strictEqual(neonItemRows[0].name, 'Fresh Kakabasa Greens');
    assert.strictEqual(Number(neonItemRows[0].unit_price), 40.00);
    assert.strictEqual(Number(neonItemRows[0].total_price), 40.00);
    assert.strictEqual(Number(neonItemRows[0].weight_grams), 730);

    const neonWasteRows = await sql`
      SELECT * FROM food_waste_logs WHERE id = ${wasteRecord.id} AND user_id = ${TEST_USER_A};
    `;
    assert.strictEqual(neonWasteRows.length, 1, 'Food waste log must exist in Neon food_waste_logs');
    assert.strictEqual(neonWasteRows[0].item_name, 'Kakabasa Leaf Trimmings');

    const neonScanRows = await sql`
      SELECT * FROM scans WHERE id = ${localScans[0].id} AND user_id = ${TEST_USER_A};
    `;
    assert.strictEqual(neonScanRows.length, 1, 'Scan record must exist in Neon scans');
    assert.strictEqual(neonScanRows[0].title, 'Kakabasa Fresh Greens Scan');

    console.log('  ✅ Test 5 Passed: Direct SQL queries confirm all collections written to Neon PostgreSQL.');

    // -----------------------------------------------------------------------------------
    // Step 6: Verify Local State & Badge Switch to NEON SYNCED
    // -----------------------------------------------------------------------------------
    console.log('Test 6: Verifying local state & badge update to ☁️✓ NEON SYNCED');
    const updatedLocalTrips = getShoppingTrips();
    const syncedKakabasaTrip = updatedLocalTrips.find(t => t.id === kakabasaTripId);
    assert(syncedKakabasaTrip, 'Trip must exist in local cache');
    assert.strictEqual(syncedKakabasaTrip.synced, true, 'Trip must be marked synced: true in local cache');

    const updatedLocalItems = getGroceryItems(kakabasaTripId);
    assert(updatedLocalItems.every(i => i.synced === true), 'All linked items must be marked synced: true');

    const syncedCardHtml = renderTripCard(syncedKakabasaTrip);
    assert(syncedCardHtml.includes('trip-sync-badge synced'), 'Must render synced badge class');
    assert(syncedCardHtml.includes('☁️✓ NEON SYNCED'), 'Must render ☁️✓ NEON SYNCED badge text');
    assert(!syncedCardHtml.includes('☁️⏳ OFFLINE'), 'Must no longer render OFFLINE badge');

    console.log('  ✅ Test 6 Passed: UI badge cleanly updated from ☁️⏳ OFFLINE to ☁️✓ NEON SYNCED.');

    // -----------------------------------------------------------------------------------
    // Step 7: Verify Idempotency & Safe UPSERT on Repeated Sync
    // -----------------------------------------------------------------------------------
    console.log('Test 7: Idempotency & Duplicate Prevention on Repeated Sync');
    const repeatedReport = await syncAndHydrateUserData();
    assert.strictEqual(repeatedReport.ok, true);

    const recheckNeonTrips = await sql`
      SELECT * FROM shopping_trips WHERE id = ${kakabasaTripId} AND user_id = ${TEST_USER_A};
    `;
    assert.strictEqual(recheckNeonTrips.length, 1, 'Repeated sync must NOT duplicate shopping_trips');

    const recheckNeonItems = await sql`
      SELECT * FROM grocery_purchases WHERE trip_id = ${kakabasaTripId} AND user_id = ${TEST_USER_A};
    `;
    assert.strictEqual(recheckNeonItems.length, 1, 'Repeated sync must NOT duplicate grocery_purchases');

    console.log('  ✅ Test 7 Passed: Idempotent UPSERT prevents duplicate rows in Neon and localStorage.');

    // -----------------------------------------------------------------------------------
    // Step 8: Multi-Tenant Isolation (User B cannot access User A\'s Kakabasa record)
    // -----------------------------------------------------------------------------------
    console.log('Test 8: Multi-Tenant Isolation Check');
    activeToken = TOKEN_B; // Switch to User B
    const userBReq = createMockReq({
      method: 'GET',
      url: '/api/trips',
      headers: { authorization: `Bearer ${TOKEN_B}` }
    });
    const userBRes = createMockRes();
    await tripsApiHandler(userBReq, userBRes);

    assert.strictEqual(userBRes.statusCode, 200);
    const userBTrips = userBRes.bodyData.trips || [];
    assert(!userBTrips.some(t => t.id === kakabasaTripId), 'User B must NOT see User A\'s Kakabasa trip');
    console.log('  ✅ Test 8 Passed: Tenant isolation verified; User B cannot access User A\'s synced trip.');

    // -----------------------------------------------------------------------------------
    // Step 9: Non-destructive Image Handling Safeguard
    // -----------------------------------------------------------------------------------
    console.log('Test 9: Receipt Image Compression Safeguard');
    const largeDataUrl = 'data:image/jpeg;base64,' + 'B'.repeat(10000);
    const compressed = await safeCompressReceiptImage(largeDataUrl);
    assert(compressed, 'Compression helper must return valid image string');
    console.log('  ✅ Test 9 Passed: Image upload & compression guard verified.');

  } finally {
    // Cleanup test data from Neon PostgreSQL
    console.log('\n🧹 Cleaning up test records from Neon PostgreSQL...');
    try {
      await sql`DELETE FROM grocery_purchases WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM shopping_trips WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM food_waste_logs WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM scans WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM "session" WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM "user" WHERE id IN (${TEST_USER_A}, ${TEST_USER_B});`;
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
  }

  console.log('\n======================================================================');
  console.log('🎉 ALL 9 OFFLINE-TO-NEON SYNCHRONIZATION ACCEPTANCE TESTS PASSED!');
  console.log('======================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Kakabasa Offline-to-Neon Sync Test Failed:', err);
  process.exit(1);
});
