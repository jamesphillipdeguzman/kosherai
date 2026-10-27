// Comprehensive Test Suite for PaddleOCR Pipeline & Receipt Parsing
import assert from 'node:assert';
import {
  parseReceiptAmount,
  parseStructuredReceiptText,
  aggregateStructuredLines,
  loadModelBuffer,
  loadModelBufferWithCache,
  OCR_MODELS,
  CACHE_NAME
} from '../src/services/paddleOcrReceipt.js';

console.log('🧪 Starting PaddleOCR Receipt Parsing Test Suite...\n');

// ----------------------------------------------------
// Test 1: parseReceiptAmount currency and symbol handling
// ----------------------------------------------------
console.log('Test 1: parseReceiptAmount handling P/₱ currency prefixes and thousands commas');

assert.strictEqual(parseReceiptAmount('P1,757.50'), 1757.5, 'Should parse P1,757.50 as 1757.5');
assert.strictEqual(parseReceiptAmount('₱466.07'), 466.07, 'Should parse ₱466.07 as 466.07');
assert.strictEqual(parseReceiptAmount('1,757.50 V'), 1757.5, 'Should strip trailing VAT indicator V');
assert.strictEqual(parseReceiptAmount('P 280.00'), 280.0, 'Should parse space after P prefix');
assert.strictEqual(parseReceiptAmount('PHP 1,250.75'), 1250.75, 'Should parse PHP prefix');
assert.strictEqual(parseReceiptAmount('Php 336.00'), 336.0, 'Should parse Php prefix');
assert.strictEqual(parseReceiptAmount('466.07'), 466.07, 'Should parse plain decimal 466.07');
assert.strictEqual(parseReceiptAmount('P466.07'), 466.07, 'Should parse P466.07 without space');
assert.strictEqual(parseReceiptAmount(''), 0, 'Empty string returns 0');
assert.strictEqual(parseReceiptAmount(null), 0, 'Null returns 0');
console.log('  ✅ parseReceiptAmount verified successfully.');

// ----------------------------------------------------
// Test 2: Structured Line Aggregation for Columns
// ----------------------------------------------------
console.log('\nTest 2: aggregateStructuredLines horizontal line alignment');
const mockTokens = [
  { text: 'CALSAN CHEW TAB 60S', x: 20, y: 120, w: 200, h: 18, centerY: 129, confidence: 0.96 },
  { text: 'P1,757.50', x: 380, y: 121, w: 90, h: 18, centerY: 130, confidence: 0.95 },
  { text: 'CHICKEN BREAST 1KG', x: 22, y: 160, w: 180, h: 18, centerY: 169, confidence: 0.94 },
  { text: 'P466.07', x: 382, y: 162, w: 75, h: 18, centerY: 171, confidence: 0.97 }
];

const aggregated = aggregateStructuredLines(mockTokens);
assert.strictEqual(aggregated.lines.length, 2, 'Should group 4 tokens into 2 horizontal receipt lines');
assert.ok(aggregated.lines[0].text.includes('CALSAN CHEW TAB 60S') && aggregated.lines[0].text.includes('P1,757.50'));
assert.ok(aggregated.lines[1].text.includes('CHICKEN BREAST 1KG') && aggregated.lines[1].text.includes('P466.07'));
console.log('  ✅ Structured line aggregation verified successfully.');

// ----------------------------------------------------
// Test 3: Thermal Receipt Multi-Line Item Recognition
// ----------------------------------------------------
console.log('\nTest 3: Thermal receipt multi-line item extraction without dropping items or letter P');

const sampleMercuryReceipt = `
MERCURY DRUG CORPORATION
STORE 0124 - QUEZON CITY
DATE: 2026-10-31

CALSAN CHEW TAB 60S
2 PC @ 878.75    P1,757.50
BIOFLU 500MG CAP
10 PC @ 9.50     P95.00
CEELIN PLUS 100ML
1 PC @ 165.00    P165.00

SUBTOTAL: P2,017.50
PWD DISCOUNT: P466.07
TOTAL AMOUNT DUE: P1,551.43
CASH TENDERED: P2,000.00
CHANGE: P448.57
`;

const parsedMercury = parseStructuredReceiptText(sampleMercuryReceipt);

assert.strictEqual(parsedMercury.storeName, 'Mercury Drug');
assert.strictEqual(parsedMercury.purchaseDate, '2026-10-31');
assert.strictEqual(parsedMercury.items.length, 3, 'Should identify all 3 pharmaceutical products');

const calsan = parsedMercury.items.find(i => i.name.includes('CALSAN CHEW TAB'));
assert.ok(calsan, 'CALSAN CHEW TAB must be extracted');
assert.strictEqual(calsan.unitPrice, 878.75, 'Unit price must be 878.75');
assert.strictEqual(calsan.totalPrice, 1757.5, 'Line total must be 1,757.50');
assert.strictEqual(calsan.quantity, 2, 'Quantity must be 2');

assert.strictEqual(parsedMercury.totalAmountPaid, 1551.43, 'Final Amount Due must be 1,551.43');
assert.strictEqual(parsedMercury.discounts, 466.07, 'PWD discount must be 466.07');
console.log('  ✅ Thermal multi-line receipt parsing passed with exact prices.');

// ----------------------------------------------------
// Test 4: Single-Line Supermarket Receipt Format
// ----------------------------------------------------
console.log('\nTest 4: Single-line supermarket receipt format');

const sampleSupermarketReceipt = `
SM SUPERMARKET - NORTH EDSA
DATE: 2026-11-02

NIDO JR MILK POWDER 1.2KG   1,757.50 V
CHICKEN BREAST FRESH        P466.07
SAYOTE 1KG                  P45.00
KALABASA LOCAL              P62.50

TOTAL AMOUNT DUE: P2,331.07
BDO MASTERCARD: 2,331.07
`;

const parsedSm = parseStructuredReceiptText(sampleSupermarketReceipt);

assert.strictEqual(parsedSm.storeName, 'SM Supermarket');
assert.strictEqual(parsedSm.purchaseDate, '2026-11-02');
assert.strictEqual(parsedSm.items.length, 4, 'Should extract 4 items');
assert.strictEqual(parsedSm.items[0].name, 'NIDO JR MILK POWDER 1.2KG');
assert.strictEqual(parsedSm.items[0].totalPrice, 1757.5, 'Price with V suffix should parse as 1757.50');
assert.strictEqual(parsedSm.items[1].name, 'CHICKEN BREAST FRESH');
assert.strictEqual(parsedSm.items[1].totalPrice, 466.07, 'Price with P prefix should parse as 466.07');
assert.strictEqual(parsedSm.totalAmountPaid, 2331.07, 'Total amount must match 2,331.07');
console.log('  ✅ Supermarket single-line receipt parsing passed.');

// ----------------------------------------------------
// Test 5: Verify OCR_MODELS Hugging Face Repository Structure & Cache Name
// ----------------------------------------------------
console.log('\nTest 5: OCR_MODELS Hugging Face URLs and cache name');

assert.strictEqual(
  OCR_MODELS.detUrl,
  'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/detection/v5/det.onnx',
  'Detection URL must match monkt/paddleocr-onnx detection/v5/det.onnx'
);

assert.strictEqual(
  OCR_MODELS.recUrl,
  'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/english/rec.onnx',
  'Recognition URL must match monkt/paddleocr-onnx languages/english/rec.onnx'
);

assert.strictEqual(
  OCR_MODELS.dictUrl,
  'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/english/dict.txt',
  'Dictionary URL must match monkt/paddleocr-onnx languages/english/dict.txt'
);

assert.strictEqual(CACHE_NAME, 'kosherai-ocr-weights', 'Cache name must be kosherai-ocr-weights');
console.log('  ✅ OCR_MODELS URLs and kosherai-ocr-weights cache name verified.');

// ----------------------------------------------------
// Test 6: Verify loadModelBuffer HTTP status checks & error handling
// ----------------------------------------------------
console.log('\nTest 6: loadModelBuffer HTTP status checks and rejection handling');

const originalFetch = globalThis.fetch;

// 6a: 404 Not Found throws descriptive error
globalThis.fetch = async (url) => ({
  ok: false,
  status: 404,
  headers: new Map(),
  arrayBuffer: async () => new ArrayBuffer(0)
});

await assert.rejects(
  async () => {
    await loadModelBuffer(OCR_MODELS.detUrl);
  },
  {
    name: 'Error',
    message: new RegExp(`Failed to load OCR model from ${OCR_MODELS.detUrl.replace(/[\/\.]/g, '\\$&')}: 404`)
  },
  'Should reject on 404 status with exact status code message'
);
console.log('  ✅ 404 Not Found error properly caught and rejected.');

// 6b: HTML response (e.g., SPA 404 fallback page) throws error
globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  headers: {
    get: (header) => (header.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null)
  },
  arrayBuffer: async () => new TextEncoder().encode('<!DOCTYPE html><html><body>404 Not Found</body></html>').buffer
});

await assert.rejects(
  async () => {
    await loadModelBuffer(OCR_MODELS.detUrl);
  },
  {
    name: 'Error',
    message: /returned HTML instead of binary model/
  },
  'Should reject when server returns HTML instead of binary model'
);
console.log('  ✅ HTML fallback routing properly rejected.');

// 6c: Valid binary model buffer resolves successfully
const dummyModelBytes = new Uint8Array(10240); // 10 KB mock ONNX model
dummyModelBytes[0] = 0x08; // ONNX protobuf header byte
globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  headers: {
    get: (header) => (header.toLowerCase() === 'content-type' ? 'application/octet-stream' : null)
  },
  arrayBuffer: async () => dummyModelBytes.buffer
});

const validBuffer = await loadModelBuffer(OCR_MODELS.detUrl);
assert.ok(validBuffer instanceof ArrayBuffer, 'Should return valid ArrayBuffer');
assert.strictEqual(validBuffer.byteLength, 10240, 'Should load full binary buffer size');
console.log('  ✅ Valid binary ONNX buffer loaded successfully.');

// ----------------------------------------------------
// Test 7: Verify Browser Cache API Storage ('kosherai-ocr-weights')
// ----------------------------------------------------
console.log('\nTest 7: Cache API storage for kosherai-ocr-weights');

// Mock browser Cache API
const mockCacheStorage = new Map();
const mockCache = {
  match: async (url) => {
    const data = mockCacheStorage.get(url);
    if (!data) return null;
    return {
      ok: true,
      arrayBuffer: async () => data
    };
  },
  put: async (url, response) => {
    const buf = await response.arrayBuffer();
    mockCacheStorage.set(url, buf);
  }
};

globalThis.caches = {
  open: async (name) => {
    assert.strictEqual(name, 'kosherai-ocr-weights', 'Must open kosherai-ocr-weights cache');
    return mockCache;
  }
};

let fetchCallCount = 0;
globalThis.fetch = async (url) => {
  fetchCallCount++;
  return {
    ok: true,
    status: 200,
    headers: {
      get: () => 'application/octet-stream'
    },
    arrayBuffer: async () => dummyModelBytes.buffer.slice(0)
  };
};

// First call: Not in cache -> Fetches from network and puts into cache
const firstBuffer = await loadModelBufferWithCache(OCR_MODELS.detUrl, () => {}, 'det model');
assert.strictEqual(fetchCallCount, 1, 'Should fetch over network on cache miss');
assert.strictEqual(firstBuffer.byteLength, 10240, 'Should return correct buffer');
assert.ok(mockCacheStorage.has(OCR_MODELS.detUrl), 'Model buffer must be saved to kosherai-ocr-weights cache');

// Second call: In cache -> Returns cached buffer without network fetch
const secondBuffer = await loadModelBufferWithCache(OCR_MODELS.detUrl, () => {}, 'det model');
assert.strictEqual(fetchCallCount, 1, 'Should NOT fetch over network on cache hit');
assert.strictEqual(secondBuffer.byteLength, 10240, 'Should return cached buffer');
console.log('  ✅ Cache API prevents repeated downloads (~15MB saved after first scan).');

// Clean up mocks
globalThis.fetch = originalFetch;
delete globalThis.caches;

console.log('\n🎉 ALL PADDLEOCR RECEIPT PARSING TESTS PASSED SUCCESSFULLY!');
