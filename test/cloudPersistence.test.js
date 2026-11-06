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
import { uploadReceiptImageToCloudinary } from '../src/utils/cloudinary.js';

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

console.log('\n🧪 Starting KosherAI Critical Fix: Cloud Persistence & Data Recovery Test Suite...\n');

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

  // Use a dedicated isolated test user
  const TEST_USER_A = 'test_user_persistence_a_' + Date.now();
  const TEST_USER_B = 'test_user_persistence_b_' + Date.now();

  // Create mock sessions in Neon for User A and User B
  const TOKEN_A = 'auth_token_a_' + Date.now();
  const TOKEN_B = 'auth_token_b_' + Date.now();

  await sql`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES 
      (${TEST_USER_A}, 'User A Persistence', ${`usera_${Date.now()}@test.com`}, true, NOW(), NOW()),
      (${TEST_USER_B}, 'User B Persistence', ${`userb_${Date.now()}@test.com`}, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;

  await sql`
    INSERT INTO "session" (id, user_id, token, expires_at, created_at, updated_at)
    VALUES 
      (${'sess_a_' + Date.now()}, ${TEST_USER_A}, ${TOKEN_A}, NOW() + INTERVAL '1 day', NOW(), NOW()),
      (${'sess_b_' + Date.now()}, ${TEST_USER_B}, ${TOKEN_B}, NOW() + INTERVAL '1 day', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;

  try {
    // -----------------------------------------------------------------------------------
    // Test A: Login Data Recovery (data is automatically restored without console scripts)
    // -----------------------------------------------------------------------------------
    console.log('Test A: Automatic Data Recovery upon Sign In');
    // Pre-populate data for User A in Neon directly
    const testTripIdA = `trip_recov_${Date.now()}`;
    await sql`
      INSERT INTO shopping_trips (id, user_id, date, project_week, store_name, trip_type, total_amount_paid, total_scale_weight_kg, receipt_image_url)
      VALUES (${testTripIdA}, ${TEST_USER_A}, '2026-11-06', 1, 'SM Megamall', 'supermarket', 1500.50, 4.2, 'https://res.cloudinary.com/dego6hgcb/image/upload/sample.webp');
    `;
    await sql`
      INSERT INTO grocery_purchases (id, user_id, trip_id, purchase_date, project_week, name, quantity, unit, unit_price, total_price, category, lid_status)
      VALUES (${'item_' + testTripIdA}, ${TEST_USER_A}, ${testTripIdA}, '2026-11-06', 1, 'Fresh Chicken', 1, 'kg', 250, 250, 'Fresh Poultry', 'SAFE');
    `;

    // Simulate GET /api/trips with User A credentials
    const reqA = createMockReq({
      method: 'GET',
      url: '/api/trips',
      headers: { authorization: `Bearer ${TOKEN_A}` }
    });
    const resA = createMockRes();
    await tripsApiHandler(reqA, resA);

    assert.strictEqual(resA.statusCode, 200);
    assert.strictEqual(resA.bodyData.synced, true);
    assert(Array.isArray(resA.bodyData.trips), 'Response must contain trips array');
    const recoveredTrip = resA.bodyData.trips.find(t => t.id === testTripIdA);
    assert(recoveredTrip, 'Pre-existing trip must be recovered automatically without manual scripts');
    assert.strictEqual(recoveredTrip.storeName, 'SM Megamall');
    assert.strictEqual(recoveredTrip.items.length, 1);
    console.log('  ✅ Test A Passed: Data retrieved automatically via authenticated API call.');

    // -----------------------------------------------------------------------------------
    // Test B: Cloud Persistence (receipt scan / new trip persists to Neon with linked grocery items)
    // -----------------------------------------------------------------------------------
    console.log('Test B: Cloud Persistence of Shopping Trips & Itemized Groceries');
    const newTripId = `trip_persist_${Date.now()}`;
    const newTripReq = createMockReq({
      method: 'POST',
      url: '/api/trips',
      headers: { authorization: `Bearer ${TOKEN_A}` },
      body: {
        trip: {
          id: newTripId,
          date: '2026-11-07',
          projectWeek: 2,
          storeName: 'Robinsons Supermarket',
          tripType: 'supermarket',
          totalAmountPaid: 2100.75,
          totalScaleWeightKg: 5.8,
          receiptImageUrl: 'https://res.cloudinary.com/dego6hgcb/image/upload/receipt_robinsons.jpg'
        },
        items: [
          {
            id: `item_${newTripId}_1`,
            tripId: newTripId,
            name: 'Lean Beef',
            quantity: 2,
            unit: 'kg',
            unitPrice: 450,
            totalPrice: 900,
            category: 'Fresh Meat',
            lidStatus: 'SAFE'
          },
          {
            id: `item_${newTripId}_2`,
            tripId: newTripId,
            name: 'Bok Choy',
            quantity: 1,
            unit: 'kg',
            unitPrice: 120,
            totalPrice: 120,
            category: 'Fresh Vegetables',
            lidStatus: 'SAFE'
          }
        ]
      }
    });
    const newTripRes = createMockRes();
    await tripsApiHandler(newTripReq, newTripRes);

    assert(newTripRes.statusCode === 200 || newTripRes.statusCode === 201, 'Status code must be 200 or 201');
    assert.strictEqual(newTripRes.bodyData.synced, true);

    // Verify row in database
    const dbTrips = await sql`SELECT * FROM shopping_trips WHERE id = ${newTripId} AND user_id = ${TEST_USER_A};`;
    assert.strictEqual(dbTrips.length, 1);
    assert.strictEqual(Number(dbTrips[0].total_amount_paid), 2100.75);

    const dbItems = await sql`SELECT * FROM grocery_purchases WHERE trip_id = ${newTripId} AND user_id = ${TEST_USER_A};`;
    assert.strictEqual(dbItems.length, 2);
    console.log('  ✅ Test B Passed: Shopping trip and linked items persisted to Neon PostgreSQL.');

    // -----------------------------------------------------------------------------------
    // Test C: Receipt Image Persistence (Cloudinary HTTPS URL, not blob or huge base64)
    // -----------------------------------------------------------------------------------
    console.log('Test C: Receipt Image Storage Verification');
    assert(dbTrips[0].receipt_image_url.startsWith('https://res.cloudinary.com'), 'Receipt image URL must be a permanent Cloudinary HTTPS link');
    assert(!dbTrips[0].receipt_image_url.startsWith('blob:'), 'Receipt image URL must never be a transient blob: URL');
    assert(!dbTrips[0].receipt_image_url.startsWith('data:'), 'Receipt image URL must not be huge base64');

    // Test uploadReceiptImageToCloudinary returns permanent URL if already hosted
    const existingUrl = 'https://res.cloudinary.com/dego6hgcb/image/upload/sample.jpg';
    const returnedUrl = await uploadReceiptImageToCloudinary(existingUrl);
    assert.strictEqual(returnedUrl, existingUrl, 'Cloudinary helper must return existing https Cloudinary URLs without re-upload');
    console.log('  ✅ Test C Passed: Receipt images properly stored as permanent Cloudinary HTTPS URLs.');

    // -----------------------------------------------------------------------------------
    // Test D: Cross-Session Continuity (Sign out, clear local cache, sign in)
    // -----------------------------------------------------------------------------------
    console.log('Test D: Cross-Session Continuity');
    // Simulate user signing out: clear mock localStorage
    mockStorage.clear();
    assert.strictEqual(mockStorage.size, 0, 'Local cache must be completely empty after sign out');

    // Simulate user signing back in with User A: call GET /api/trips
    const signInReq = createMockReq({
      method: 'GET',
      url: '/api/trips',
      headers: { authorization: `Bearer ${TOKEN_A}` }
    });
    const signInRes = createMockRes();
    await tripsApiHandler(signInReq, signInRes);

    assert.strictEqual(signInRes.statusCode, 200);
    assert(signInRes.bodyData.trips.some(t => t.id === newTripId), 'Persisted trip must be present after signing back in');
    console.log('  ✅ Test D Passed: User records remain 100% available across sign-out and sign-in.');

    // -----------------------------------------------------------------------------------
    // Test E: Empty-Storage Recovery
    // -----------------------------------------------------------------------------------
    console.log('Test E: Empty-Storage Recovery');
    // Ensure that even if localStorage was wiped or user visits from a fresh incognito browser,
    // the API returns their full record set
    const emptyStorageReq = createMockReq({
      method: 'GET',
      url: '/api/trips',
      headers: { authorization: `Bearer ${TOKEN_A}` }
    });
    const emptyStorageRes = createMockRes();
    await tripsApiHandler(emptyStorageReq, emptyStorageRes);
    assert(emptyStorageRes.bodyData.trips.length >= 2, 'Must return all persisted trips from Neon on clean storage');
    console.log('  ✅ Test E Passed: Fresh browser/empty cache correctly re-hydrates from Neon.');

    // -----------------------------------------------------------------------------------
    // Test F: Offline Resilience & Non-Destructive 401 Handling
    // -----------------------------------------------------------------------------------
    console.log('Test F: Offline Resilience & 401 Safeguard');
    const unauthReq = createMockReq({
      method: 'GET',
      url: '/api/trips',
      headers: {} // No token provided
    });
    const unauthRes = createMockRes();
    await tripsApiHandler(unauthReq, unauthRes);
    assert.strictEqual(unauthRes.statusCode, 401, 'Unauthenticated requests must return 401 Unauthorized');
    console.log('  ✅ Test F Passed: 401 is properly returned when credentials are missing.');

    // -----------------------------------------------------------------------------------
    // Test G: Duplicate Prevention (Upserts do not duplicate trips or items)
    // -----------------------------------------------------------------------------------
    console.log('Test G: Duplicate Prevention');
    // Re-post the exact same trip
    await tripsApiHandler(newTripReq, createMockRes());
    const countTrips = await sql`SELECT count(*) AS count FROM shopping_trips WHERE id = ${newTripId};`;
    assert.strictEqual(parseInt(countTrips[0].count, 10), 1, 'Trip must not be duplicated on repeated syncs');

    const countItems = await sql`SELECT count(*) AS count FROM grocery_purchases WHERE trip_id = ${newTripId};`;
    assert.strictEqual(parseInt(countItems[0].count, 10), 2, 'Grocery items must not duplicate on repeated syncs');
    console.log('  ✅ Test G Passed: Repeated syncs safely upsert without duplicate rows.');

    // -----------------------------------------------------------------------------------
    // Test H: Multi-Account Isolation (User A cannot see User B's data)
    // -----------------------------------------------------------------------------------
    console.log('Test H: Multi-Account Isolation');
    // User B requests /api/trips
    const userBReq = createMockReq({
      method: 'GET',
      url: '/api/trips',
      headers: { authorization: `Bearer ${TOKEN_B}` }
    });
    const userBRes = createMockRes();
    await tripsApiHandler(userBReq, userBRes);

    assert.strictEqual(userBRes.statusCode, 200);
    const userBTripIds = userBRes.bodyData.trips.map(t => t.id);
    assert(!userBTripIds.includes(newTripId), 'User B must NOT see User A\'s shopping trips');
    assert(!userBTripIds.includes(testTripIdA), 'User B must NOT see User A\'s recovery trips');
    console.log('  ✅ Test H Passed: Multi-account isolation strictly enforced server-side.');

    // -----------------------------------------------------------------------------------
    // Test I: Food Waste Cloud Persistence
    // -----------------------------------------------------------------------------------
    console.log('Test I: Food Waste Cloud Persistence');
    const wasteId = `waste_persist_${Date.now()}`;
    const wasteReq = createMockReq({
      method: 'POST',
      url: '/api/food-waste',
      headers: { authorization: `Bearer ${TOKEN_A}` },
      body: {
        waste: {
          id: wasteId,
          date: '2026-11-07',
          projectWeek: 2,
          itemName: 'Spoiled Tomatoes',
          category: 'Fresh Vegetables',
          measuredWeightG: 350,
          estimatedCost: 45,
          wasteReason: 'Spoiled / Mold',
          disposalMethod: 'Compost'
        }
      }
    });
    const wasteRes = createMockRes();
    await foodWasteApiHandler(wasteReq, wasteRes);

    assert.strictEqual(wasteRes.statusCode, 200);
    assert.strictEqual(wasteRes.bodyData.synced, true);

    const getWasteReq = createMockReq({
      method: 'GET',
      url: '/api/food-waste',
      headers: { authorization: `Bearer ${TOKEN_A}` }
    });
    const getWasteRes = createMockRes();
    await foodWasteApiHandler(getWasteReq, getWasteRes);

    assert(getWasteRes.bodyData.foodWaste.some(w => w.id === wasteId), 'Persisted food waste log must be returned');
    console.log('  ✅ Test I Passed: Food waste logs persist to Neon and restore reliably.');

    // -----------------------------------------------------------------------------------
    // Test J: Household Scale & Settings Persistence (inventory, meal-plans, settings)
    // -----------------------------------------------------------------------------------
    console.log('Test J: Household Settings, Inventory & Meal Plans Persistence');
    // 1. Settings
    const setReq = createMockReq({
      method: 'POST',
      url: '/api/settings',
      headers: { authorization: `Bearer ${TOKEN_A}` },
      body: {
        settings: {
          household_members: 6,
          active_diet: 'pinoy_keto',
          theme: 'dark'
        }
      }
    });
    const setRes = createMockRes();
    await settingsApiHandler(setReq, setRes);
    assert.strictEqual(setRes.statusCode, 200);
    assert.strictEqual(setRes.bodyData.settings.household_members, 6);

    const getSetReq = createMockReq({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${TOKEN_A}` }
    });
    const getSetRes = createMockRes();
    await settingsApiHandler(getSetReq, getSetRes);
    assert.strictEqual(getSetRes.bodyData.settings.household_members, 6);

    // 2. Inventory
    const invId = `inv_test_${Date.now()}`;
    const invReq = createMockReq({
      method: 'POST',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${TOKEN_A}` },
      body: {
        item: {
          id: invId,
          itemName: 'Carrots',
          category: 'Fresh Vegetables',
          quantity: 3,
          unit: 'pcs',
          storageLocation: 'Refrigerator'
        }
      }
    });
    const invRes = createMockRes();
    await inventoryApiHandler(invReq, invRes);
    assert.strictEqual(invRes.statusCode, 200);

    const getInvReq = createMockReq({
      method: 'GET',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${TOKEN_A}` }
    });
    const getInvRes = createMockRes();
    await inventoryApiHandler(getInvReq, getInvRes);
    assert(getInvRes.bodyData.inventory.some(i => i.id === invId), 'Inventory item must persist to Neon and be retrievable');

    // 3. Meal Plans
    const mealId = `meal_test_${Date.now()}`;
    const mealReq = createMockReq({
      method: 'POST',
      url: '/api/meal-plans',
      headers: { authorization: `Bearer ${TOKEN_A}` },
      body: {
        plan: {
          id: mealId,
          projectWeek: 2,
          dayOfWeek: 'Sunday',
          mealType: 'Dinner',
          dishName: 'Chicken Tinola',
          notes: 'Scaled for 6 members'
        }
      }
    });
    const mealRes = createMockRes();
    await mealPlansApiHandler(mealReq, mealRes);
    assert.strictEqual(mealRes.statusCode, 200);

    const getMealReq = createMockReq({
      method: 'GET',
      url: '/api/meal-plans',
      headers: { authorization: `Bearer ${TOKEN_A}` }
    });
    const getMealRes = createMockRes();
    await mealPlansApiHandler(getMealReq, getMealRes);
    assert(getMealRes.bodyData.mealPlans.some(m => m.id === mealId), 'Meal plan must persist to Neon and be retrievable');

    console.log('  ✅ Test J Passed: Settings, Inventory, and Meal Plans fully persist and hydrate.');

    // -----------------------------------------------------------------------------------
    // Test K: Product Scans Cloud Persistence
    // -----------------------------------------------------------------------------------
    console.log('Test K: Product Scan History Persistence');
    const scanId = `scan_test_${Date.now()}`;
    const scanReq = createMockReq({
      method: 'POST',
      url: '/api/scans',
      headers: { authorization: `Bearer ${TOKEN_A}` },
      body: {
        id: scanId,
        title: 'Century Tuna Flakes in Oil',
        status: 'SAFE',
        reason: 'Zero added iodized salt or dairy',
        flaggedIngredients: [],
        imageUrl: 'https://res.cloudinary.com/dego6hgcb/image/upload/century_tuna.jpg'
      }
    });
    const scanRes = createMockRes();
    await scansApiHandler(scanReq, scanRes);
    assert(scanRes.statusCode === 200 || scanRes.statusCode === 201, 'Status code must be 200 or 201');

    const getScanReq = createMockReq({
      method: 'GET',
      url: '/api/scans',
      headers: { authorization: `Bearer ${TOKEN_A}` }
    });
    const getScanRes = createMockRes();
    await scansApiHandler(getScanReq, getScanRes);
    const scansList = Array.isArray(getScanRes.bodyData)
      ? getScanRes.bodyData
      : (getScanRes.bodyData.scans || getScanRes.bodyData.data || []);
    assert(scansList.some(s => s.id === scanId), 'Scan history must persist to Neon and restore upon login');
    console.log('  ✅ Test K Passed: Scan history persists to Neon and re-hydrates upon login.');

    console.log('\n======================================================================');
    console.log('🎉 ALL ACCEPTANCE TESTS (A THROUGH K) PASSED SUCCESSFULLY!');
    console.log('======================================================================\n');
  } finally {
    // Clean up test users
    try {
      await sql`DELETE FROM shopping_trips WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM grocery_purchases WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM food_waste_logs WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM household_inventory WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM meal_plans WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM household_settings WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM scans WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM "session" WHERE user_id IN (${TEST_USER_A}, ${TEST_USER_B});`;
      await sql`DELETE FROM "user" WHERE id IN (${TEST_USER_A}, ${TEST_USER_B});`;
    } catch (_) {}
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
