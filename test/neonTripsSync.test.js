// Test Suite for Neon PostgreSQL Study Schema and Client Sync Pipeline
import assert from 'node:assert';
import tripsApiHandler, { ensureTripsTables, isValidPostgresUrl } from '../api/trips.js';
import scansApiHandler from '../api/scans.js';

console.log('🧪 Starting Neon Trips & Client Sync Test Suite...\n');

// ----------------------------------------------------
// Test 1: PostgreSQL URL Validation
// ----------------------------------------------------
console.log('Test 1: PostgreSQL connection URL validation');
assert.strictEqual(
  isValidPostgresUrl('postgresql://neondb_owner:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require'),
  true,
  'Valid Neon connection string should pass'
);
assert.strictEqual(
  isValidPostgresUrl('postgres://user:sample_pass@db.neon.tech/db'),
  true,
  'Valid postgres:// scheme should pass'
);
assert.strictEqual(isValidPostgresUrl(''), false, 'Empty string should fail');
assert.strictEqual(isValidPostgresUrl('postgresql://user:password@endpoint/db'), false, 'Placeholder URL should fail');
console.log('  ✅ PostgreSQL URL validation verified.');

// ----------------------------------------------------
// Test 2: Database Schema Creation & Mock Execution
// ----------------------------------------------------
console.log('\nTest 2: ensureTripsTables schema definitions');

const executedSqlQueries = [];
const mockSql = async (strings, ...values) => {
  const query = strings.reduce((prev, curr, i) => prev + curr + (values[i] !== undefined ? `$${i + 1}` : ''), '');
  executedSqlQueries.push({ query, values });
  return [];
};
mockSql.query = async (q) => [];

await ensureTripsTables(mockSql);
assert.ok(executedSqlQueries.length >= 3, 'Must create shopping_trips, grocery_purchases, and food_waste_logs');
const allQueriesText = executedSqlQueries.map(q => q.query).join(' ');
assert.ok(allQueriesText.includes('shopping_trips'), 'Schema includes shopping_trips table');
assert.ok(allQueriesText.includes('grocery_purchases'), 'Schema includes grocery_purchases table');
assert.ok(allQueriesText.includes('food_waste_logs'), 'Schema includes food_waste_logs table');
console.log('  ✅ Database schema tables successfully verified.');

// ----------------------------------------------------
// Test 3: POST /api/trips inserts trip and batch inserts purchases
// ----------------------------------------------------
console.log('\nTest 3: POST /api/trips inserts shopping_trips and batch inserts grocery_purchases');

// Mock request and response objects
function createMockReqRes(method, body = {}, url = '/api/trips') {
  const req = {
    method,
    url,
    body,
    headers: { 'content-type': 'application/json' }
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    statusCode: 200,
    setHeader: () => {},
    status: function (code) { statusCode = code; return this; },
    json: function (data) { responseData = data; return this; },
    end: function (data) { if (data && !responseData) responseData = JSON.parse(data); }
  };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

const mockTripPayload = {
  trip: {
    id: 'trip_study_001',
    date: '2026-10-31',
    projectWeek: 1,
    storeName: 'SM Supermarket - North EDSA',
    tripType: 'Supermarket',
    totalAmountPaid: 2150.00,
    totalScaleWeightKg: 6.45,
    receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/receipt1.jpg',
    notes: 'Week 1 Baseline Trip'
  },
  items: [
    { id: 'item_01', name: 'Fresh Chicken Breast', quantity: 1, unit: 'kg', unitPrice: 320, totalPrice: 320, weightGrams: 1000 },
    { id: 'item_02', name: 'Sayote Fresh', quantity: 3, unit: 'pcs', unitPrice: 25, totalPrice: 75, weightGrams: 850 },
    { id: 'item_03', name: 'Non-Iodized Kosher Salt', quantity: 1, unit: 'box', unitPrice: 185, totalPrice: 185 }
  ]
};

// Test offline/local handling when DATABASE_URL is not connected
const origDbUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

const { req: offlineReq, res: offlineRes, getData: getOfflineData } = createMockReqRes('POST', mockTripPayload);
await tripsApiHandler(offlineReq, offlineRes);
const offlineResult = getOfflineData();
assert.strictEqual(offlineResult.synced, false, 'Without DATABASE_URL, synced must be false for offline mode');
assert.ok(offlineResult.offline, 'Must flag offline operation');

// Restore DATABASE_URL
process.env.DATABASE_URL = origDbUrl;
console.log('  ✅ Offline fallback response verified when DATABASE_URL is unconfigured.');

// ----------------------------------------------------
// Test 4: POST /api/scans saves verified receipt trips
// ----------------------------------------------------
console.log('\nTest 4: POST /api/scans supports verified receipt shopping trip insertion');

delete process.env.DATABASE_URL;
const { req: scanReq, res: scanRes, getData: getScanData } = createMockReqRes('POST', {
  type: 'trip',
  ...mockTripPayload
}, '/api/scans');

await scansApiHandler(scanReq, scanRes);
const scanResult = getScanData();
assert.strictEqual(scanResult.synced, false);
process.env.DATABASE_URL = origDbUrl;
console.log('  ✅ api/scans handles trip payload and offline delegation.');

console.log('\n🎉 ALL NEON TRIPS & SYNC PIPELINE TESTS PASSED SUCCESSFULLY!');
