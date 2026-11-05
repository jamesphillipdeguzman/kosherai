import assert from 'node:assert';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import tripsApiHandler from '../api/trips.js';
import scansApiHandler from '../api/scans.js';
import foodWasteApiHandler from '../api/food-waste.js';

console.log('🧪 Starting API Authentication Credentials Injection Tests...\n');

const sql = neon(process.env.DATABASE_URL);
const sessionRows = await sql`
  SELECT s.id, s."userId", s.token, u.email, u.name
  FROM "session" s 
  JOIN "user" u ON (u.id = s."userId" OR u.id = s.user_id)
  WHERE s."userId" = 'O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL'
  LIMIT 1;
`;

assert.ok(sessionRows.length > 0, 'Active session for user O60CsFIZ1P1Qiv7oQID1vlhN55vJmcrL must exist in database');
const activeSession = sessionRows[0];
console.log(`✅ Located active session for ${activeSession.name} (${activeSession.userId})`);

function createMockReqRes(method, headers = {}, url = '/api/trips') {
  const req = {
    method,
    url,
    body: null,
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

// 1. Test Bearer Authorization header on /api/trips
console.log('\nTest 1: GET /api/trips with Authorization: Bearer <token>');
const { req: r1, res: s1, getStatus: status1, getData: data1 } = createMockReqRes('GET', {
  authorization: `Bearer ${activeSession.token}`
}, '/api/trips');
await tripsApiHandler(r1, s1);
assert.strictEqual(status1(), 200, 'GET /api/trips with Bearer token must return 200');
assert.strictEqual(data1().success, true);
console.log(`  ✅ 200 OK returned with ${data1().trips.length} shopping trips.`);

// 2. Test Cookie header on /api/trips
console.log('\nTest 2: GET /api/trips with Cookie: better-auth.session_token=<token>');
const { req: r2, res: s2, getStatus: status2, getData: data2 } = createMockReqRes('GET', {
  cookie: `better-auth.session_token=${activeSession.token}`
}, '/api/trips');
await tripsApiHandler(r2, s2);
assert.strictEqual(status2(), 200, 'GET /api/trips with Cookie must return 200');
assert.strictEqual(data2().success, true);
console.log(`  ✅ 200 OK returned with ${data2().trips.length} shopping trips.`);

// 3. Test Signed Cookie header on /api/scans
console.log('\nTest 3: GET /api/scans with signed cookie credentials');
const { req: r3, res: s3, getStatus: status3, getData: data3 } = createMockReqRes('GET', {
  cookie: `better-auth.session_token=s:${activeSession.token}.signedsignature987`
}, '/api/scans');
await scansApiHandler(r3, s3);
assert.strictEqual(status3(), 200, 'GET /api/scans with signed cookie must return 200');
const scanList = Array.isArray(data3()) ? data3() : (data3().scans || data3().data || []);
console.log(`  ✅ 200 OK returned with ${scanList.length} scans.`);

// 4. Test Cookie header on /api/food-waste
console.log('\nTest 4: GET /api/food-waste with Bearer token');
const { req: r4, res: s4, getStatus: status4, getData: data4 } = createMockReqRes('GET', {
  authorization: `Bearer ${activeSession.token}`
}, '/api/food-waste');
await foodWasteApiHandler(r4, s4);
assert.strictEqual(status4(), 200, 'GET /api/food-waste with Bearer token must return 200');
assert.strictEqual(data4().success, true);
console.log(`  ✅ 200 OK returned with ${data4().foodWaste.length} food waste entries.`);

// 5. Test Unauthenticated request fails with 401
console.log('\nTest 5: GET /api/trips without credentials returns 401');
const { req: r5, res: s5, getStatus: status5 } = createMockReqRes('GET', {}, '/api/trips');
await tripsApiHandler(r5, s5);
assert.strictEqual(status5(), 401, 'Request without credentials must return 401');
console.log('  ✅ 401 UNAUTHORIZED correctly returned for unauthenticated request.');

// 6. Test Legacy mock Bearer token (tok_...) does NOT override __Secure-better-auth.session_token cookie
console.log('\nTest 6: GET /api/trips with legacy mock Bearer token AND __Secure cookie succeeds with 200 OK');
const { req: r6, res: s6, getStatus: status6, getData: data6 } = createMockReqRes('GET', {
  authorization: 'Bearer tok_1793848293021_mock_legacy',
  cookie: `__Secure-better-auth.session_token=s:${activeSession.token}.signedsignature987; other=123`
}, '/api/trips');
await tripsApiHandler(r6, s6);
assert.strictEqual(status6(), 200, 'Mock Bearer token must not override valid __Secure cookie');
assert.strictEqual(data6().success, true);
console.log(`  ✅ 200 OK returned successfully (${data6().trips.length} trips resolved via __Secure cookie).`);

console.log('\n======================================================');
console.log('🎉 ALL API AUTHENTICATION INJECTION TESTS PASSED!');
console.log('======================================================\n');

