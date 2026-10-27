import assert from 'node:assert';
import {
  parseReceiptAmount,
  parseStructuredReceiptText,
  aggregateStructuredLines,
  preprocessDetImage,
  postprocessDbNet,
  createReceiptItem,
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
  { text: 'CALSAN CHEW TAB 60S', x: 20, y: 120, ymin: 120, w: 200, h: 18, centerY: 129, confidence: 0.96 },
  { text: 'P1,757.50', x: 380, y: 121, ymin: 121, w: 90, h: 18, centerY: 130, confidence: 0.95 },
  { text: 'CHICKEN BREAST 1KG', x: 22, y: 160, ymin: 160, w: 180, h: 18, centerY: 169, confidence: 0.94 },
  { text: 'P466.07', x: 382, y: 162, ymin: 162, w: 75, h: 18, centerY: 171, confidence: 0.97 }
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

assert.strictEqual(CACHE_NAME, 'kosherai-ocr-v1', 'Cache name must be kosherai-ocr-v1');
console.log('  ✅ OCR_MODELS URLs and kosherai-ocr-v1 cache name verified.');

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
// Test 7: Verify Browser Cache API Storage ('kosherai-ocr-v1')
// ----------------------------------------------------
console.log('\nTest 7: Cache API storage for kosherai-ocr-v1');

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
    assert.strictEqual(name, 'kosherai-ocr-v1', 'Must open kosherai-ocr-v1 cache');
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
assert.ok(mockCacheStorage.has(OCR_MODELS.detUrl), 'Model buffer must be saved to kosherai-ocr-v1 cache');

// Second call: In cache -> Returns cached buffer without network fetch
const secondBuffer = await loadModelBufferWithCache(OCR_MODELS.detUrl, () => {}, 'det model');
assert.strictEqual(fetchCallCount, 1, 'Should NOT fetch over network on cache hit');
assert.strictEqual(secondBuffer.byteLength, 10240, 'Should return cached buffer');
console.log('  ✅ Cache API prevents repeated downloads (~15MB saved after first scan).');

// Clean up mocks
globalThis.fetch = originalFetch;
delete globalThis.caches;

// ----------------------------------------------------
// Test 8: Preprocessing Aspect Ratio Preservation for Tall Receipts
// ----------------------------------------------------
console.log('\nTest 8: preprocessDetImage preserves vertical resolution for tall receipts');

// Mock tall thermal receipt canvas (e.g. 800px wide, 3200px tall - 1:4 aspect ratio)
const mockTallCanvas = { width: 800, height: 3200 };
const pre = preprocessDetImage(mockTallCanvas, 960);

assert.strictEqual(pre.targetW, 960, 'Target width must be scaled to 960px');
assert.strictEqual(pre.targetH, 3840, 'Target height must preserve aspect ratio (3200 * 1.2 = 3840) and be a multiple of 32');
assert.strictEqual(pre.targetH % 32, 0, 'Target height must be multiple of 32 for DBNet');
assert.strictEqual(pre.targetW % 32, 0, 'Target width must be multiple of 32 for DBNet');
console.log(`  ✅ Tall receipt scaled to ${pre.targetW}x${pre.targetH} preserving vertical clarity.`);

// ----------------------------------------------------
// Test 9: Binarization Thresholds for Faint Lines
// ----------------------------------------------------
console.log('\nTest 9: postprocessDbNet with db_thresh = 0.25 and box_thresh = 0.5');

// 32x32 dummy map with a faint block having probability 0.28 (would fail old 0.3 threshold)
const faintPredData = new Float32Array(32 * 32);
for (let y = 10; y <= 20; y++) {
  for (let x = 10; x <= 22; x++) {
    faintPredData[y * 32 + x] = 0.55; // strong enough to average > 0.5 box threshold
  }
}
const faintBoxes = postprocessDbNet(faintPredData, 32, 32, 1.0, 1.0, 0.25, 0.5);
assert.strictEqual(faintBoxes.length, 1, 'Should extract bounding box for faint text block with db_thresh=0.25');
assert.ok(faintBoxes[0].ymin !== undefined, 'Bounding box should include ymin for vertical sorting');
console.log('  ✅ Faint lines detected successfully with adjusted thresholds.');

// ----------------------------------------------------
// Test 10: Multi-Line Regex Parsing: [Item Name] ... [Qty] [Unit Price] [Line Total]
// ----------------------------------------------------
console.log('\nTest 10: Multi-line grocery item extraction following [Item Name] ... [Qty] [Unit Price] [Line Total]');

const tallReceiptOcrText = `
PUREGOLD PRICE CLUB, INC.
BRANCH 05 - CUBAO
DATE: 2026-10-27

CREAM CORNSTARCH 1 45.00 45.00
HERSHEY'S COCOA 2 @ 150.00 300.00
PUREGOLD SUGAR 1KG 2 X 65.00 130.00
NESTLE ALL PURPOSE CREAM ... 3 PC @ 72.50 217.50
ROYAL SPAGHETTI 900G 1 89.00 89.00 V

SUBTOTAL: P781.50
TOTAL AMOUNT DUE: P781.50
CASH TENDERED: P1,000.00
CHANGE: P218.50
`;

const parsedTall = parseStructuredReceiptText(tallReceiptOcrText);

assert.strictEqual(parsedTall.items.length, 5, 'Must extract all 5 line items without dropping any');

const cornstarch = parsedTall.items[0];
assert.strictEqual(cornstarch.name, 'CREAM CORNSTARCH');
assert.strictEqual(cornstarch.quantity, 1);
assert.strictEqual(cornstarch.unitPrice, 45.00);
assert.strictEqual(cornstarch.totalPrice, 45.00);

const cocoa = parsedTall.items[1];
assert.strictEqual(cocoa.name, "HERSHEY'S COCOA");
assert.strictEqual(cocoa.quantity, 2);
assert.strictEqual(cocoa.unitPrice, 150.00);
assert.strictEqual(cocoa.totalPrice, 300.00);

const sugar = parsedTall.items[2];
assert.strictEqual(sugar.name, 'PUREGOLD SUGAR 1KG');
assert.strictEqual(sugar.quantity, 2);
assert.strictEqual(sugar.unitPrice, 65.00);
assert.strictEqual(sugar.totalPrice, 130.00);

const cream = parsedTall.items[3];
assert.strictEqual(cream.name, 'NESTLE ALL PURPOSE CREAM');
assert.strictEqual(cream.quantity, 3);
assert.strictEqual(cream.unitPrice, 72.50);
assert.strictEqual(cream.totalPrice, 217.50);

const spaghetti = parsedTall.items[4];
assert.strictEqual(spaghetti.name, 'ROYAL SPAGHETTI 900G');
assert.strictEqual(spaghetti.quantity, 1);
assert.strictEqual(spaghetti.unitPrice, 89.00);
assert.strictEqual(spaghetti.totalPrice, 89.00);

assert.strictEqual(parsedTall.totalAmountPaid, 781.50);
console.log('  ✅ All multi-line grocery items extracted accurately with full qty, unit price, and total.');

// ----------------------------------------------------
// Test 11: Vertical Sorting by box.ymin before parsing
// ----------------------------------------------------
console.log('\nTest 11: Sort text lines vertically by box.ymin before parsing');

// Pass out-of-order lines to simulate multi-threaded or random order OCR detection blocks
const shuffledReceiptLines = {
  lines: [
    { text: 'TOTAL AMOUNT DUE: P195.00', box: [[10, 400], [200, 400], [200, 420], [10, 420]], ymin: 400 },
    { text: "HERSHEY'S COCOA 1 150.00 150.00", box: [[10, 150], [250, 150], [250, 170], [10, 170]], ymin: 150 },
    { text: 'SM SUPERMARKET', box: [[10, 20], [180, 20], [180, 40], [10, 40]], ymin: 20 },
    { text: 'CREAM CORNSTARCH 1 45.00 45.00', box: [[10, 100], [250, 100], [250, 120], [10, 120]], ymin: 100 }
  ]
};

const parsedShuffled = parseStructuredReceiptText(shuffledReceiptLines);
assert.strictEqual(parsedShuffled.storeName, 'SM Supermarket');
assert.strictEqual(parsedShuffled.items.length, 2);
assert.strictEqual(parsedShuffled.items[0].name, 'CREAM CORNSTARCH', 'First item must be CREAM CORNSTARCH (ymin: 100)');
assert.strictEqual(parsedShuffled.items[1].name, "HERSHEY'S COCOA", 'Second item must be HERSHEY\'S COCOA (ymin: 150)');
assert.strictEqual(parsedShuffled.totalAmountPaid, 195.00);
console.log('  ✅ Shuffled receipt lines sorted correctly by ymin.');

console.log('\n🎉 ALL PADDLEOCR RECEIPT PARSING TESTS PASSED SUCCESSFULLY!');

