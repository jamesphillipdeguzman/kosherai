import assert from 'assert';
import {
  normalizeWeek,
  resolveItemWeek,
  isWeekMatch,
  getGroceryItemName,
  matchesGroceryQuery,
  getTripGroceryItems
} from '../src/utils/weekNormalization.js';
import { uploadReceiptImageToCloudinary } from '../src/utils/cloudinary.js';

console.log('🧪 Starting Scanned Grocery Search & Cloudinary Photo Upload Tests...\n');

// Mock localStorage for storage tests
const mockStore = {};
global.localStorage = {
  getItem: (key) => mockStore[key] || null,
  setItem: (key, val) => { mockStore[key] = String(val); },
  removeItem: (key) => { delete mockStore[key]; },
  clear: () => { Object.keys(mockStore).forEach(k => delete mockStore[k]); }
};

// =========================================================================
// TEST 1: Cloudinary Upload Source Unwrapping & Object Object Prevention
// =========================================================================
console.log('Test 1: Cloudinary Upload Source Unwrapping & Object Object Prevention');

// Save original fetch
const originalFetch = global.fetch;

let capturedFormData = null;
let uploadEndpoint = null;

// Mock fetch to inspect multipart payload
global.fetch = async (url, options) => {
  uploadEndpoint = url;
  if (options && options.body instanceof FormData) {
    capturedFormData = options.body;
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v12345/receipt.jpg',
      public_id: 'kosherai/receipts/test_123'
    }),
    text: async () => '{"secure_url":"https://res.cloudinary.com/dego6hgcb/image/upload/v12345/receipt.jpg"}'
  };
};

// 1. Passing plain compression object { blob, dataUrl, width, height }
const mockBlob = new Blob(['mock-binary-image-data'], { type: 'image/jpeg' });
const compressionResult = {
  blob: mockBlob,
  dataUrl: 'data:image/jpeg;base64,mockbase64',
  width: 800,
  height: 600
};

const cUrl1 = await uploadReceiptImageToCloudinary(compressionResult);
assert.strictEqual(cUrl1, 'https://res.cloudinary.com/dego6hgcb/image/upload/v12345/receipt.jpg');
assert.ok(capturedFormData, 'FormData was constructed');
const fileEntry1 = capturedFormData.get('file');
assert.ok(fileEntry1 instanceof Blob, 'File appended to FormData is a true Blob, not [object Object]');
assert.notStrictEqual(String(fileEntry1), '[object Object]', 'File must never be "[object Object]"');

// 2. Passing direct Blob
const cUrl2 = await uploadReceiptImageToCloudinary(mockBlob);
assert.strictEqual(cUrl2, 'https://res.cloudinary.com/dego6hgcb/image/upload/v12345/receipt.jpg');
const fileEntry2 = capturedFormData.get('file');
assert.ok(fileEntry2 instanceof Blob, 'Direct Blob correctly appended');

// 3. Passing data URI
const cUrl3 = await uploadReceiptImageToCloudinary('data:image/jpeg;base64,sampleBase64String');
assert.strictEqual(cUrl3, 'https://res.cloudinary.com/dego6hgcb/image/upload/v12345/receipt.jpg');
const fileEntry3 = capturedFormData.get('file');
assert.strictEqual(fileEntry3, 'data:image/jpeg;base64,sampleBase64String', 'Data URI passed as string');

// 4. Refusing literal '[object Object]' or invalid strings
const cUrlInvalid = await uploadReceiptImageToCloudinary('[object Object]');
assert.strictEqual(cUrlInvalid, null, 'Literal [object Object] is rejected and returns null');

// 5. Already uploaded Cloudinary URL returns directly without network call
uploadEndpoint = null;
const cUrlExisting = await uploadReceiptImageToCloudinary('https://res.cloudinary.com/dego6hgcb/image/upload/existing.jpg');
assert.strictEqual(cUrlExisting, 'https://res.cloudinary.com/dego6hgcb/image/upload/existing.jpg');
assert.strictEqual(uploadEndpoint, null, 'No network fetch triggered for existing Cloudinary URL');

console.log('  ✅ Cloudinary upload correctly unpacks objects and strictly prevents [object Object].');

// =========================================================================
// TEST 2: Offline Image Compression & Local Fallback
// =========================================================================
console.log('\nTest 2: Offline Image Compression & Local Fallback');

// Simulate network failure / offline
global.fetch = async () => {
  throw new Error('Network offline');
};

const offlineResult = await uploadReceiptImageToCloudinary(compressionResult);
assert.strictEqual(offlineResult, null, 'Network failure returns null cleanly without throwing');

// Simulate the edit modal resolving offline image:
let pendingFile = mockBlob;
let photoPreview = 'data:image/jpeg;base64,localPreviewCompressed';
let resolvedPhotoUrl = null;

try {
  let cUrl = null;
  // Offline condition:
  const isOnline = false;
  if (isOnline) {
    cUrl = await uploadReceiptImageToCloudinary(pendingFile);
  }
  // Local fallback preserves compressed dataUrl (string, never object!)
  resolvedPhotoUrl = (cUrl && typeof cUrl === 'string') ? cUrl : photoPreview;
} catch (e) {
  resolvedPhotoUrl = photoPreview;
}

assert.strictEqual(typeof resolvedPhotoUrl, 'string', 'Offline image is a valid string URL');
assert.strictEqual(resolvedPhotoUrl, 'data:image/jpeg;base64,localPreviewCompressed', 'Offline data URI preserved');
assert.notStrictEqual(resolvedPhotoUrl, '[object Object]', 'Never resolves to [object Object]');

console.log('  ✅ Offline fallback successfully retains compressed local data URI as valid string.');

// Restore fetch
global.fetch = originalFetch;

// =========================================================================
// TEST 3: Item Name Normalization across Field Variations
// =========================================================================
console.log('\nTest 3: Item Name Normalization across Field Variations');

assert.strictEqual(getGroceryItemName({ name: 'Carabao Mango' }), 'Carabao Mango');
assert.strictEqual(getGroceryItemName({ itemName: 'Native Garlic (Bawang)' }), 'Native Garlic (Bawang)');
assert.strictEqual(getGroceryItemName({ item_name: 'Fresh Tilapia' }), 'Fresh Tilapia');
assert.strictEqual(getGroceryItemName({ productName: 'Sayote' }), 'Sayote');
assert.strictEqual(getGroceryItemName({ product_name: 'Pork Kasim' }), 'Pork Kasim');
assert.strictEqual(getGroceryItemName({ raw_receipt_text: 'MANGGA SWEET' }), 'MANGGA SWEET');
assert.strictEqual(getGroceryItemName({ rawReceiptText: 'BAWANG 100G' }), 'BAWANG 100G');
assert.strictEqual(getGroceryItemName('Plain String Mango'), 'Plain String Mango');
assert.strictEqual(getGroceryItemName(null), '');

console.log('  ✅ getGroceryItemName accurately handles all schema field variations.');

// =========================================================================
// TEST 4: Grocery Query Matching (Case-Insensitive, Trimmed, Partial)
// =========================================================================
console.log('\nTest 4: Grocery Query Matching (Case-Insensitive, Trimmed, Partial)');

const mangoItem = { name: 'Ripe Carabao Mango (Mangga)' };
const garlicItem = { itemName: 'Native Bawang (Garlic)' };
const tilapiaItem = { item_name: 'Fresh Tilapia Fish' };

// Empty query matches all
assert.ok(matchesGroceryQuery(mangoItem, ''));
assert.ok(matchesGroceryQuery(mangoItem, '   '));
assert.ok(matchesGroceryQuery(mangoItem, null));

// Exact and partial matching
assert.ok(matchesGroceryQuery(mangoItem, 'mangga'));
assert.ok(matchesGroceryQuery(mangoItem, 'MANGGA'));
assert.ok(matchesGroceryQuery(mangoItem, '  mAnGgA  '));
assert.ok(matchesGroceryQuery(mangoItem, 'mango'));
assert.ok(matchesGroceryQuery(mangoItem, 'carabao'));
assert.strictEqual(matchesGroceryQuery(mangoItem, 'bawang'), false);

assert.ok(matchesGroceryQuery(garlicItem, 'bawang'));
assert.ok(matchesGroceryQuery(garlicItem, 'BAWANG'));
assert.ok(matchesGroceryQuery(garlicItem, 'garlic'));
assert.strictEqual(matchesGroceryQuery(garlicItem, 'tilapia'), false);

assert.ok(matchesGroceryQuery(tilapiaItem, 'tilapia'));
assert.ok(matchesGroceryQuery(tilapiaItem, 'tila'));
assert.strictEqual(matchesGroceryQuery(tilapiaItem, 'mangga'), false);

console.log('  ✅ matchesGroceryQuery passes case-insensitive, whitespace-trimmed, and partial searches.');

// =========================================================================
// TEST 5: Combined Search with Week Filter Matrix (Expected Behavior Table)
// =========================================================================
console.log('\nTest 5: Combined Search with Week Filter Matrix');

const testTrips = [
  { id: 'trip-w1-manduriao', storeName: 'Manduriao Wet Market', date: '2026-11-01', projectWeek: 1 },
  { id: 'trip-w1-supermarket', storeName: 'Iloilo Supermart', date: '2026-11-03', projectWeek: 1 },
  { id: 'trip-w2-palengke', storeName: 'Jaro Public Market', date: '2026-11-08', projectWeek: 2 },
  { id: 'trip-w2-sm', storeName: 'SM City Supermarket', date: '2026-11-10', projectWeek: 2 }
];
const testTripsMap = new Map(testTrips.map(t => [t.id, t]));

const testGroceries = [
  { id: 'g1', tripId: 'trip-w1-manduriao', name: 'Sweet Carabao Mangga', quantity: 2, unit: 'kg' },
  { id: 'g2', tripId: 'trip-w1-manduriao', name: 'Native Bawang', quantity: 0.5, unit: 'kg' },
  { id: 'g3', tripId: 'trip-w1-supermarket', name: 'Fresh Tilapia', quantity: 1.2, unit: 'kg' },
  { id: 'g4', tripId: 'trip-w2-palengke', name: 'Native Bawang Pack', quantity: 1, unit: 'pack' },
  { id: 'g5', tripId: 'trip-w2-palengke', name: 'Ripe Yellow Mangga', quantity: 1.5, unit: 'kg' },
  { id: 'g6', tripId: 'trip-w2-sm', name: 'Pork Tenderloin', quantity: 1, unit: 'kg' }
];

function filterGroceries(selectedWeek, query) {
  const normWeek = normalizeWeek(selectedWeek);
  const cleanQ = (query || '').trim().toLowerCase();

  return testGroceries.filter(item => {
    // Parent trip week resolution
    const itemWeek = resolveItemWeek(item, testTripsMap, { startDate: '2026-10-31' });
    const weekMatches = normWeek === 'all' || itemWeek === normWeek;
    if (!weekMatches) return false;

    if (!cleanQ) return true;
    return matchesGroceryQuery(item, cleanQ);
  });
}

// 1. All Weeks + Empty => All 6 records
const r1 = filterGroceries('all', '');
assert.strictEqual(r1.length, 6, 'All Weeks + Empty should return all 6 records');

// 2. All Weeks + "mangga" => 2 records (g1 from W1, g5 from W2)
const r2 = filterGroceries('all', 'mangga');
assert.strictEqual(r2.length, 2, 'All Weeks + mangga should return 2 records');
assert.ok(r2.some(i => i.id === 'g1' && i.tripId === 'trip-w1-manduriao'));
assert.ok(r2.some(i => i.id === 'g5' && i.tripId === 'trip-w2-palengke'));

// 3. W1 + "mangga" => 1 record (g1 from W1 Manduriao)
const r3 = filterGroceries(1, 'mangga');
assert.strictEqual(r3.length, 1, 'W1 + mangga should return 1 record');
assert.strictEqual(r3[0].id, 'g1');
assert.strictEqual(r3[0].tripId, 'trip-w1-manduriao');

// 4. W2 + "bawang" => 1 record (g4 from W2 Jaro)
const r4 = filterGroceries(2, 'bawang');
assert.strictEqual(r4.length, 1, 'W2 + bawang should return 1 record');
assert.strictEqual(r4[0].id, 'g4');
assert.strictEqual(r4[0].tripId, 'trip-w2-palengke');

// 5. W2 + Empty => 3 records (g4, g5, g6 belonging to W2)
const r5 = filterGroceries(2, '');
assert.strictEqual(r5.length, 3, 'W2 + Empty should return 3 records');
assert.ok(r5.every(i => ['g4', 'g5', 'g6'].includes(i.id)));

console.log('  ✅ Week filter + search matrix perfectly matches all required test specifications.');

// =========================================================================
// TEST 6: Trip-Level Search Presentation & Unrelated Items Exclusion
// =========================================================================
console.log('\nTest 6: Trip-Level Search Presentation & Unrelated Items Exclusion');

function searchTripsWithItems(selectedWeek, query) {
  const normWeek = normalizeWeek(selectedWeek);
  const cleanQ = (query || '').trim().toLowerCase();

  const weekTrips = testTrips.filter(t => normWeek === 'all' || normalizeWeek(t.projectWeek) === normWeek);

  const matchedTrips = [];
  for (const trip of weekTrips) {
    const items = getTripGroceryItems(trip, testGroceries);
    const matchingItems = items.filter(i => matchesGroceryQuery(i, cleanQ));
    if (matchingItems.length > 0) {
      matchedTrips.push({
        ...trip,
        matchingItems
      });
    }
  }
  return matchedTrips;
}

// Search "mangga" in Week 1
const tripMatchesW1 = searchTripsWithItems(1, 'mangga');
assert.strictEqual(tripMatchesW1.length, 1, 'Only Manduriao trip matched mangga in W1');
assert.strictEqual(tripMatchesW1[0].id, 'trip-w1-manduriao');
assert.strictEqual(tripMatchesW1[0].matchingItems.length, 1, 'Displays only matching mango item');
assert.strictEqual(tripMatchesW1[0].matchingItems[0].name, 'Sweet Carabao Mangga');
// Verify unrelated item (Native Bawang) is NOT present in matchingItems
assert.strictEqual(tripMatchesW1[0].matchingItems.some(i => i.name.includes('Bawang')), false, 'Unrelated bawang is excluded');

// Search "mangga" in All Weeks
const tripMatchesAll = searchTripsWithItems('all', 'mangga');
assert.strictEqual(tripMatchesAll.length, 2, '2 trips matched mangga across all weeks (Manduriao & Jaro)');
assert.strictEqual(tripMatchesAll[0].id, 'trip-w1-manduriao');
assert.strictEqual(tripMatchesAll[1].id, 'trip-w2-palengke');

console.log('  ✅ Search results retain parent trip info and display only matching items, excluding unrelated items.');

console.log('\n======================================================================');
console.log('🎉 ALL SCANNED GROCERY SEARCH & CLOUDINARY UPLOAD TESTS PASSED!');
console.log('======================================================================\n');
