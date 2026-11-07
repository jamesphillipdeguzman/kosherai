import assert from 'node:assert';
import { parseQuantityAndUnit } from '../src/components/ManualTripModal.js';
import { renderReceiptLightboxModal, renderEditTripModal } from '../src/components/ShoppingTripsView.js';
import { saveShoppingTrip, getShoppingTrips, updateShoppingTrip, getGroceryItems } from '../src/services/courseProjectStorage.js';
import tripsApiHandler from '../api/trips.js';

// Setup mock localStorage
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};
globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

console.log('🧪 Starting Grocery Scanning, Photo Management & Weight Entry Tests...\n');

// ----------------------------------------------------
// Test 1: Default Grocery Units to `kg`
// ----------------------------------------------------
console.log('Test 1: Default Grocery Units to `kg`');

// When no unit is specified or empty input, defaults to kg
const pEmpty = parseQuantityAndUnit('');
assert.strictEqual(pEmpty.unit, 'kg');
assert.strictEqual(pEmpty.quantity, 1);
assert.strictEqual(pEmpty.weightGrams, 1000);

const pNumberOnly = parseQuantityAndUnit('2.5');
assert.strictEqual(pNumberOnly.unit, 'kg');
assert.strictEqual(pNumberOnly.quantity, 2.5);
assert.strictEqual(pNumberOnly.weightGrams, 2500);

// Explicit units are preserved
const pGrams = parseQuantityAndUnit('750 g');
assert.strictEqual(pGrams.unit, 'g');
assert.strictEqual(pGrams.quantity, 750);
assert.strictEqual(pGrams.weightGrams, 750);

const pPcs = parseQuantityAndUnit('6 pcs');
assert.strictEqual(pPcs.unit, 'pcs');
assert.strictEqual(pPcs.quantity, 6);

const pPack = parseQuantityAndUnit('2 packs');
assert.strictEqual(pPack.unit, 'packs');
assert.strictEqual(pPack.quantity, 2);

console.log('  ✅ Default unit correctly resolves to kg while preserving explicit units (g, pcs, pack).');

// ----------------------------------------------------
// Test 2: Full Image Preview in Lightbox
// ----------------------------------------------------
console.log('\nTest 2: Full Image Preview in Lightbox');

const testTripWithImage = {
  id: 'trip-lightbox-1',
  storeName: 'Paco Wet Market',
  date: '2026-11-05',
  totalAmountPaid: 450.75,
  totalScaleWeightKg: 2.35,
  itemsCount: 3,
  tripType: 'Wet Market / Palengke',
  notes: 'Bought pork belly, sayote, tomatoes',
  receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample_receipt.jpg'
};

const lightboxHtml = renderReceiptLightboxModal(testTripWithImage);
assert.ok(lightboxHtml.includes('id="receipt-lightbox-overlay"'), 'Includes lightbox overlay container');
assert.ok(lightboxHtml.includes('id="close-lightbox-btn"'), 'Includes close button');
assert.ok(lightboxHtml.includes('object-contain'), 'Uses object-contain to prevent cropping');
assert.ok(lightboxHtml.includes('https://res.cloudinary.com/demo/image/upload/sample_receipt.jpg'), 'Renders image URL');
assert.ok(lightboxHtml.includes('Paco Wet Market'), 'Renders store name');
assert.ok(lightboxHtml.includes('450.75'), 'Renders total amount');
assert.ok(lightboxHtml.includes('2.35 kg'), 'Renders scale weight');
assert.ok(lightboxHtml.includes('Esc to close'), 'Includes accessible keyboard hint');

// Trip without image should return empty string
const tripNoImage = { id: 'trip-no-img', receiptImageUrl: null };
assert.strictEqual(renderReceiptLightboxModal(tripNoImage), '', 'Returns empty string if trip has no image');

console.log('  ✅ Lightbox modal correctly renders full image with object-contain and trip metadata.');

// ----------------------------------------------------
// Test 3: Rescan / Replace Photo Controls in Edit Modal
// ----------------------------------------------------
console.log('\nTest 3: Rescan / Replace Photo in Edit Shopping Trip Modal');

const editModalHtml = renderEditTripModal({ editingTripId: testTripWithImage.id, editingTrip: testTripWithImage });
assert.ok(editModalHtml.includes('Receipt / Produce Photo'), 'Includes Receipt / Produce Photo section');
assert.ok(editModalHtml.includes('id="trigger-change-photo-btn"'), 'Includes Rescan / Change Photo trigger');
assert.ok(editModalHtml.includes('id="remove-trip-photo-btn"'), 'Includes Remove Photo button');
assert.ok(editModalHtml.includes('id="edit-trip-file-input"'), 'Includes file input with camera capture support');
assert.ok(editModalHtml.includes('id="rerun-ocr-edit-btn"'), 'Includes Rerun OCR button');
assert.ok(editModalHtml.includes('id="edit-trip-photo-preview-img"'), 'Includes thumbnail preview of photo');

console.log('  ✅ Edit modal contains photo thumbnail, replacement trigger, camera picker, and removal.');

// ----------------------------------------------------
// Test 4: Photo Replacement & Removal Persistence in Storage and API
// ----------------------------------------------------
console.log('\nTest 4: Photo Replacement & Removal Persistence');

localStorage.clear();

// Save initial trip
const initialSave = await saveShoppingTrip({
  storeName: 'Metro Supermarket',
  date: '2026-11-06',
  tripType: 'Supermarket',
  totalScaleWeightKg: 1.8,
  totalAmountPaid: 520.00,
  receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/original.jpg',
  notes: 'Original trip'
}, []);

let savedTrips = getShoppingTrips();
assert.strictEqual(savedTrips.length, 1);
assert.strictEqual(savedTrips[0].receiptImageUrl, 'https://res.cloudinary.com/demo/image/upload/original.jpg');

// Update trip with replaced photo
await updateShoppingTrip(initialSave.trip.id, {
  storeName: 'Metro Supermarket',
  date: '2026-11-06',
  tripType: 'Supermarket',
  totalScaleWeightKg: 1.8,
  totalAmountPaid: 520.00,
  receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/replaced_photo.jpg',
  notes: 'Photo replaced'
});

savedTrips = getShoppingTrips();
assert.strictEqual(savedTrips[0].receiptImageUrl, 'https://res.cloudinary.com/demo/image/upload/replaced_photo.jpg');

// Remove photo
await updateShoppingTrip(initialSave.trip.id, {
  storeName: 'Metro Supermarket',
  date: '2026-11-06',
  tripType: 'Supermarket',
  totalScaleWeightKg: 1.8,
  totalAmountPaid: 520.00,
  receiptImageUrl: null,
  notes: 'Photo removed'
});

savedTrips = getShoppingTrips();
assert.strictEqual(savedTrips[0].receiptImageUrl, null);

// Test API PATCH handler preserves receipt_image_url
function createMockReqRes(method, body = {}, url = '/api/trips') {
  let statusCode = 200;
  let responseData = null;
  const req = { method, url, body, headers: { 'content-type': 'application/json' } };
  const res = {
    statusCode: 200,
    setHeader: () => {},
    status: function(code) { statusCode = code; return this; },
    json: function(data) { responseData = data; return this; },
    end: function(data) { if (data && !responseData) responseData = JSON.parse(data); }
  };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

delete process.env.DATABASE_URL;

const { req, res, getData } = createMockReqRes('PATCH', {
  id: initialSave.trip.id,
  receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/new_api_url.jpg',
  totalAmountPaid: 520.00
});

await tripsApiHandler(req, res);
const apiResult = getData();
assert.ok(apiResult.offline, 'Handled offline gracefully');
assert.strictEqual(apiResult.trip.receiptImageUrl, 'https://res.cloudinary.com/demo/image/upload/new_api_url.jpg');

console.log('  ✅ Storage and API handlers cleanly support updating and removing receiptImageUrl.');

console.log('\n======================================================');
console.log('🎉 ALL SCANNING, PHOTO & WEIGHT ENTRY TESTS PASSED!');
console.log('======================================================\n');
