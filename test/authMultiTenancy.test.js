// Verification & Integrity Test Suite for Authentication & Tenant-Scoped Data Architecture
import assert from 'node:assert';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { auth, getAuthenticatedUser } from '../lib/auth.ts';
import tripsApiHandler from '../api/trips.js';
import scansApiHandler from '../api/scans.js';
import foodWasteApiHandler from '../api/food-waste.js';
import recipeInteractionsHandler from '../api/recipe-interactions.js';

console.log('🧪 Starting Tenant-Scoped Multi-Tenancy & Better Auth Test Suite...\n');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not configured in .env. Cannot run live Neon multi-tenancy tests.');
  process.exit(1);
}

const sql = neon(databaseUrl);

// Helper to create mock request and response
function createMockReqRes(method, body = null, headers = {}, url = '/api/trips') {
  const req = {
    method,
    url,
    body,
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    statusCode: 200,
    setHeader: () => {},
    status: function (code) { statusCode = code; return this; },
    json: function (data) { responseData = data; return this; },
    end: function (data) {
      if (data && !responseData) {
        try { responseData = JSON.parse(data); } catch { responseData = data; }
      }
    }
  };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTests() {
  // ----------------------------------------------------
  // Test 1: Better Auth Server Instance & Neon Users Sync
  // ----------------------------------------------------
  console.log('Test 1: Better Auth Initialization & Database Tables Verification');
  assert.ok(auth, 'Better Auth server instance must be initialized');
  assert.ok(typeof auth.api.getSession === 'function', 'auth.api.getSession must be available');
  console.log('  ✅ Better Auth server instance and session API initialized.');

  // Verify usr_primary_admin exists in both Neon "user" and "users"
  const adminRows = await sql`SELECT id, email, full_name as name FROM users WHERE id = 'usr_primary_admin'`;
  assert.strictEqual(adminRows.length, 1, 'usr_primary_admin must exist in users table');
  const adminId = adminRows[0].id;
  console.log(`  ✅ usr_primary_admin verified (ID: ${adminId})`);

  // ----------------------------------------------------
  // Test 2: Provisioning Secondary Tenant User B
  // ----------------------------------------------------
  console.log('\nTest 2: Registering Tenant User B (Isolated Partition)');
  const testEmail = `user_b_${Date.now()}@kosherai.local`;
  const userBId = `usr_tenant_b_${Date.now()}`;

  // Insert User B into user and users tables
  await sql`
    INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    VALUES (${userBId}, 'User B (Caregiver)', ${testEmail}, true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  `;
  await sql`
    INSERT INTO users (id, email, full_name, created_at, updated_at)
    VALUES (${userBId}, ${testEmail}, 'User B (Caregiver)', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  `;

  // Create an active session token for User B
  const sessionTokenB = `token_b_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await sql`
    INSERT INTO "session" (id, "userId", token, "expiresAt", "createdAt", "updatedAt")
    VALUES (${`sess_${Date.now()}`}, ${userBId}, ${sessionTokenB}, NOW() + INTERVAL '1 day', NOW(), NOW());
  `;

  console.log(`  ✅ User B created with isolated session (ID: ${userBId})`);

  // ----------------------------------------------------
  // Test 3: User B starts with empty dashboard (0 trips, 0 scans, 0 waste)
  // ----------------------------------------------------
  console.log('\nTest 3: Initial Empty State Verification for User B');

  // Query Trips for User B
  const { req: tripsReqB, res: tripsResB, getData: getTripsB } = createMockReqRes(
    'GET', null, { 'authorization': `Bearer ${sessionTokenB}` }, '/api/trips'
  );
  await tripsApiHandler(tripsReqB, tripsResB);
  const userBTrips = getTripsB();
  assert.strictEqual(userBTrips.success, true, 'Trips fetch must succeed');
  assert.strictEqual(userBTrips.trips.length, 0, 'New User B must have 0 trips in initial state');

  // Query Scans for User B
  const { req: scansReqB, res: scansResB, getData: getScansB } = createMockReqRes(
    'GET', null, { 'authorization': `Bearer ${sessionTokenB}` }, '/api/scans'
  );
  await scansApiHandler(scansReqB, scansResB);
  const userBScans = getScansB();
  const scansList = Array.isArray(userBScans) ? userBScans : (userBScans.scans || userBScans.data || []);
  assert.strictEqual(scansList.length, 0, 'New User B must have 0 scans in initial state');

  // Query Food Waste for User B
  const { req: wasteReqB, res: wasteResB, getData: getWasteB } = createMockReqRes(
    'GET', null, { 'authorization': `Bearer ${sessionTokenB}` }, '/api/food-waste'
  );
  await foodWasteApiHandler(wasteReqB, wasteResB);
  const userBWaste = getWasteB();
  assert.strictEqual(userBWaste.success, true, 'Food waste fetch must succeed');
  assert.strictEqual((userBWaste.foodWaste || []).length, 0, 'New User B must have 0 waste logs in initial state');

  console.log('  ✅ Verified: User B begins with 0 trips, 0 scans, and 0 waste logs.');

  // ----------------------------------------------------
  // Test 4: Isolation Verification (Admin data invisible to User B)
  // ----------------------------------------------------
  console.log('\nTest 4: Cross-Tenant Data Isolation');

  // Query trips for Admin
  const { req: adminTripsReq, res: adminTripsRes, getData: getAdminTrips } = createMockReqRes(
    'GET', null, { 'x-user-id': adminId }, '/api/trips'
  );
  await tripsApiHandler(adminTripsReq, adminTripsRes);
  const adminTrips = getAdminTrips();
  assert.ok(adminTrips.trips.length > 0, 'Admin must have existing study trips');
  const adminTripIds = new Set(adminTrips.trips.map(t => t.id));
  console.log(`  ℹ️ Admin has ${adminTrips.trips.length} recorded shopping trips.`);

  // Verify none of Admin trips appear in User B's result
  const crossTenantLeak = userBTrips.trips.some(t => adminTripIds.has(t.id));
  assert.strictEqual(crossTenantLeak, false, 'No Admin trips may leak into User B response');
  console.log('  ✅ Verified: Admin data is strictly isolated and invisible to User B.');

  // ----------------------------------------------------
  // Test 5: User B Data Creation & Mutual Boundary Check
  // ----------------------------------------------------
  console.log('\nTest 5: Tenant-Scoped Record Creation for User B');

  // 5a. User B records a shopping trip
  const tripBId = `trip_user_b_${Date.now()}`;
  const { req: postTripBReq, res: postTripBRes, getData: getPostTripB } = createMockReqRes(
    'POST',
    {
      trip: {
        id: tripBId,
        date: '2026-11-05',
        projectWeek: 1,
        storeName: 'Puregold - User B Market',
        tripType: 'Supermarket',
        totalAmountPaid: 850.00,
        totalScaleWeightKg: 2.3
      },
      items: [
        { id: `item_b_1`, name: 'Fresh Sayote', quantity: 2, unit: 'kg', unitPrice: 40, totalPrice: 80 }
      ]
    },
    { 'authorization': `Bearer ${sessionTokenB}` },
    '/api/trips'
  );
  await tripsApiHandler(postTripBReq, postTripBRes);
  const postTripBResult = getPostTripB();
  assert.strictEqual(postTripBResult.success, true, 'User B trip insertion must succeed');

  // 5b. User B saves a food label scan
  const scanBId = `scan_user_b_${Date.now()}`;
  const { req: postScanBReq, res: postScanBRes, getData: getPostScanB } = createMockReqRes(
    'POST',
    {
      id: scanBId,
      title: 'Kosher Roast Beef Sample B',
      status: 'SAFE',
      reason: 'Verified permissible ingredients'
    },
    { 'authorization': `Bearer ${sessionTokenB}` },
    '/api/scans'
  );
  await scansApiHandler(postScanBReq, postScanBRes);
  const postScanBResult = getPostScanB();
  assert.ok(postScanBResult.id, 'User B scan insertion must succeed');

  // 5c. User B saves a food waste log
  const wasteBId = `waste_user_b_${Date.now()}`;
  const { req: postWasteBReq, res: postWasteBRes, getData: getPostWasteB } = createMockReqRes(
    'POST',
    {
      waste: {
        id: wasteBId,
        date: '2026-11-05',
        itemName: 'Carrot Peels',
        measuredWeightG: 120,
        estimatedCost: 15.00
      }
    },
    { 'authorization': `Bearer ${sessionTokenB}` },
    '/api/food-waste'
  );
  await foodWasteApiHandler(postWasteBReq, postWasteBRes);
  const postWasteBResult = getPostWasteB();
  assert.strictEqual(postWasteBResult.success, true, 'User B waste insertion must succeed');

  // 5d. User B posts a recipe comment
  const { req: postCommentBReq, res: postCommentBRes, getData: getPostCommentB } = createMockReqRes(
    'POST',
    {
      action: 'comment',
      recipeId: 'rec_low_iodine_chicken_soup',
      comment: 'Excellent recipe for Week 1 baseline!'
    },
    { 'authorization': `Bearer ${sessionTokenB}` },
    '/api/recipe-interactions'
  );
  await recipeInteractionsHandler(postCommentBReq, postCommentBRes);
  const postCommentBResult = getPostCommentB();
  assert.strictEqual(postCommentBResult.success, true, 'User B comment insertion must succeed');
  assert.strictEqual(postCommentBResult.comment.userId, userBId, 'Comment must be tagged with User B ID');

  console.log('  ✅ User B created trip, scan, waste log, and comment successfully.');

  // ----------------------------------------------------
  // Test 6: Verify Mutual Isolation (Admin cannot see User B's records)
  // ----------------------------------------------------
  console.log('\nTest 6: Mutual Isolation Verification');

  // Re-fetch Admin trips
  const { req: adminTripsCheckReq, res: adminTripsCheckRes, getData: getAdminTripsCheck } = createMockReqRes(
    'GET', null, { 'x-user-id': adminId }, '/api/trips'
  );
  await tripsApiHandler(adminTripsCheckReq, adminTripsCheckRes);
  const adminTripsCheck = getAdminTripsCheck();
  assert.strictEqual(
    adminTripsCheck.trips.some(t => t.id === tripBId),
    false,
    "User B's trip must NOT appear in Admin's query results"
  );

  // Re-fetch User B trips
  const { req: userBTripsCheckReq, res: userBTripsCheckRes, getData: getUserBTripsCheck } = createMockReqRes(
    'GET', null, { 'authorization': `Bearer ${sessionTokenB}` }, '/api/trips'
  );
  await tripsApiHandler(userBTripsCheckReq, userBTripsCheckRes);
  const userBTripsCheck = getUserBTripsCheck();
  assert.strictEqual(userBTripsCheck.trips.length, 1, 'User B must see exactly their 1 created trip');
  assert.strictEqual(userBTripsCheck.trips[0].id, tripBId, 'User B must see their own trip');

  console.log('  ✅ Mutual boundary confirmed: Admin and User B data are 100% mutually isolated.');

  // ----------------------------------------------------
  // Test 7: Mobile Multi-Device Session Scoping
  // ----------------------------------------------------
  console.log('\nTest 7: Mobile Multi-Device Session Scoping');

  // Simulate mobile browser sending session token in cookie header
  const { req: mobileReq, res: mobileRes, getData: getMobileTrips } = createMockReqRes(
    'GET', null, { 'cookie': `better-auth.session_token=${sessionTokenB}` }, '/api/trips'
  );
  await tripsApiHandler(mobileReq, mobileRes);
  const mobileTrips = getMobileTrips();
  assert.strictEqual(mobileTrips.success, true, 'Mobile request with cookie session must succeed');
  assert.strictEqual(mobileTrips.trips.length, 1, 'Mobile session must access the same isolated tenant partition');
  assert.strictEqual(mobileTrips.trips[0].id, tripBId, 'Mobile session sees matching tenant trip without collision');

  console.log('  ✅ Mobile session verification passed without database collisions.');

  // Cleanup User B test records from Neon
  await sql`DELETE FROM grocery_purchases WHERE user_id = ${userBId};`;
  await sql`DELETE FROM shopping_trips WHERE user_id = ${userBId};`;
  await sql`DELETE FROM scans WHERE user_id = ${userBId};`;
  await sql`DELETE FROM food_waste_logs WHERE user_id = ${userBId};`;
  await sql`DELETE FROM recipe_comments WHERE user_id = ${userBId};`;
  await sql`DELETE FROM "session" WHERE "userId" = ${userBId};`;
  await sql`DELETE FROM "user" WHERE id = ${userBId};`;
  await sql`DELETE FROM users WHERE id = ${userBId};`;

  console.log('\n======================================================');
  console.log('🎉 ALL AUTHENTICATION & MULTI-TENANCY TESTS PASSED!');
  console.log('======================================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failure:', err);
    process.exit(1);
  });
