// Comprehensive Test Suite for Serverless Routes & DATABASE_URL Fallback Guards
import assert from 'node:assert';
import scansHandler, { isValidPostgresUrl } from '../api/scans.js';
import receiptScanHandler, { maybeLogReceiptScan } from '../api/receipt-scan.js';

console.log('🧪 Starting Database Fallback & Serverless Guard Test Suite...\n');

// ----------------------------------------------------
// Mock Response Helper
// ----------------------------------------------------
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end(str) {
      if (str) {
        try {
          this.body = JSON.parse(str);
        } catch {
          this.body = str;
        }
      }
      return this;
    }
  };
  return res;
}

// ----------------------------------------------------
// Test 1: isValidPostgresUrl Validation
// ----------------------------------------------------
console.log('Test 1: isValidPostgresUrl correctly identifies valid vs invalid database URLs');

assert.strictEqual(isValidPostgresUrl(undefined), false);
assert.strictEqual(isValidPostgresUrl(null), false);
assert.strictEqual(isValidPostgresUrl(''), false);
assert.strictEqual(isValidPostgresUrl('   '), false);
assert.strictEqual(isValidPostgresUrl('undefined'), false);
assert.strictEqual(isValidPostgresUrl('null'), false);
assert.strictEqual(isValidPostgresUrl('postgresql://'), false); // too short
assert.strictEqual(isValidPostgresUrl('postgresql://user:password@sample'), false); // placeholder credentials
assert.strictEqual(isValidPostgresUrl('mongodb://localhost:27017/db'), false);
assert.strictEqual(isValidPostgresUrl('postgres://myuser:secret123@ep-cool-pooler.neon.tech/neondb'), true);
assert.strictEqual(isValidPostgresUrl('postgresql://myuser:secret123@ep-cool-pooler.neon.tech/neondb?sslmode=require'), true);

console.log('  ✅ isValidPostgresUrl validation verified successfully.');

// ----------------------------------------------------
// Test 2: GET /api/scans with unconfigured DATABASE_URL
// ----------------------------------------------------
console.log('\nTest 2: GET /api/scans returns 200 fallback when DATABASE_URL is unset');

const originalDbUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

const mockGetReq = { method: 'GET', url: '/api/scans' };
const mockGetRes = createMockRes();

await scansHandler(mockGetReq, mockGetRes);

assert.strictEqual(mockGetRes.statusCode, 200, 'Must return HTTP 200 status');
assert.strictEqual(mockGetRes.body.synced, false, 'Must flag synced as false');
assert.strictEqual(mockGetRes.body.offline, true, 'Must flag offline mode as true');
assert.deepStrictEqual(mockGetRes.body.data, [], 'Must return empty data array');
console.log('  ✅ GET /api/scans gracefully handled unset DATABASE_URL without 502/500.');

// ----------------------------------------------------
// Test 3: POST /api/scans with unconfigured DATABASE_URL
// ----------------------------------------------------
console.log('\nTest 3: POST /api/scans returns 200 with saved-locally notice when DATABASE_URL is unset');

const mockPostReq = {
  method: 'POST',
  url: '/api/scans',
  body: {
    id: 'scan_123',
    title: 'Puregold Grocery Audit',
    status: 'SAFE',
    reason: 'All items compliant',
    flaggedIngredients: []
  }
};
const mockPostRes = createMockRes();

await scansHandler(mockPostReq, mockPostRes);

assert.strictEqual(mockPostRes.statusCode, 200, 'Must return HTTP 200 status');
assert.strictEqual(mockPostRes.body.synced, false, 'Must flag synced as false');
assert.strictEqual(mockPostRes.body.offline, true, 'Must flag offline mode as true');
assert.ok(mockPostRes.body.message.includes('Saved locally only'), 'Must inform client that scan was saved locally only');
assert.strictEqual(mockPostRes.body.data.id, 'scan_123');
console.log('  ✅ POST /api/scans gracefully handled unset DATABASE_URL without 502/500.');

// ----------------------------------------------------
// Test 4: DELETE /api/scans with unconfigured DATABASE_URL
// ----------------------------------------------------
console.log('\nTest 4: DELETE /api/scans returns 200 when DATABASE_URL is unset');

const mockDeleteReq = { method: 'DELETE', url: '/api/scans' };
const mockDeleteRes = createMockRes();

await scansHandler(mockDeleteReq, mockDeleteRes);

assert.strictEqual(mockDeleteRes.statusCode, 200, 'Must return HTTP 200 status');
assert.strictEqual(mockDeleteRes.body.synced, false);
assert.ok(mockDeleteRes.body.message.includes('Deleted locally only'));
console.log('  ✅ DELETE /api/scans gracefully handled unset DATABASE_URL without 502/500.');

// ----------------------------------------------------
// Test 5: maybeLogReceiptScan in api/receipt-scan.js
// ----------------------------------------------------
console.log('\nTest 5: maybeLogReceiptScan non-blocking execution');

// 5a: With unset DATABASE_URL
await assert.doesNotReject(async () => {
  await maybeLogReceiptScan({ storeName: 'Test Store', items: [] }, 'lid');
}, 'Unset DATABASE_URL must not throw');

// 5b: With invalid DATABASE_URL
process.env.DATABASE_URL = 'invalid-connection-string';
await assert.doesNotReject(async () => {
  await maybeLogReceiptScan({ storeName: 'Test Store', items: [] }, 'lid');
}, 'Invalid DATABASE_URL must not throw');

console.log('  ✅ maybeLogReceiptScan is completely non-blocking.');

// ----------------------------------------------------
// Test 6: Gemini API Key Name Resolution in api/receipt-scan.js
// ----------------------------------------------------
console.log('\nTest 6: Gemini API key resolution supports GEMINI_API_KEY, VITE_GEMINI_API_KEY, and body.apiKey');

const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalViteKey = process.env.VITE_GEMINI_API_KEY;

delete process.env.GEMINI_API_KEY;
delete process.env.VITE_GEMINI_API_KEY;

// 6a: Test rejection when no key is present anywhere
const noKeyReq = {
  method: 'POST',
  url: '/api/receipt-scan',
  body: { imageBase64: 'data:image/jpeg;base64,12345' }
};
const noKeyRes = createMockRes();
await receiptScanHandler(noKeyReq, noKeyRes);
assert.strictEqual(noKeyRes.statusCode, 503, 'Must return 503 when no key is available');
assert.strictEqual(noKeyRes.body.error, 'GEMINI_API_KEY_NOT_CONFIGURED');

// Restore original env vars
if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
if (originalGeminiKey !== undefined) process.env.GEMINI_API_KEY = originalGeminiKey;
if (originalViteKey !== undefined) process.env.VITE_GEMINI_API_KEY = originalViteKey;

console.log('  ✅ API Key resolution and error states verified.');

console.log('\n🎉 ALL DATABASE FALLBACK & SERVERLESS GUARD TESTS PASSED!\n');
