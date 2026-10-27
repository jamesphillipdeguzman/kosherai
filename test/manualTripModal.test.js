import assert from 'node:assert';

// Mock localStorage for Node testing environment
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

import {
  parseQuantityAndUnit,
  createManualItemRowHtml,
  renderManualTripModal
} from '../src/components/ManualTripModal.js';

import { renderManualTripModal as reExportedModal } from '../src/components/CourseProjectView.js';

import {
  saveShoppingTrip,
  getShoppingTrips,
  getGroceryItems
} from '../src/services/courseProjectStorage.js';

import tripsApiHandler from '../api/trips.js';

console.log('🧪 Starting Manual Trip Modal & Itemized Purchases Tests...\n');

// ----------------------------------------------------
// Test 1: parseQuantityAndUnit Helper Function
// ----------------------------------------------------
console.log('Test 1: parseQuantityAndUnit parsing heuristics');

const p1 = parseQuantityAndUnit('2 pcs');
assert.strictEqual(p1.quantity, 2);
assert.strictEqual(p1.unit, 'pcs');
assert.strictEqual(p1.weightGrams, 0);

const p2 = parseQuantityAndUnit('1 kg');
assert.strictEqual(p2.quantity, 1);
assert.strictEqual(p2.unit, 'kg');
assert.strictEqual(p2.weightGrams, 1000);

const p3 = parseQuantityAndUnit('500 g');
assert.strictEqual(p3.quantity, 500);
assert.strictEqual(p3.unit, 'g');
assert.strictEqual(p3.weightGrams, 500);

const p4 = parseQuantityAndUnit('1.5 kg');
assert.strictEqual(p4.quantity, 1.5);
assert.strictEqual(p4.unit, 'kg');
assert.strictEqual(p4.weightGrams, 1500);

const p5 = parseQuantityAndUnit('3');
assert.strictEqual(p5.quantity, 3);
assert.strictEqual(p5.unit, 'pcs');

const p6 = parseQuantityAndUnit('');
assert.strictEqual(p6.quantity, 1);
assert.strictEqual(p6.unit, 'pcs');

console.log('  ✅ parseQuantityAndUnit correctly handles pcs, kg, g, and decimals.');

// ----------------------------------------------------
// Test 2: renderManualTripModal Component Structure
// ----------------------------------------------------
console.log('\nTest 2: renderManualTripModal template markup');

const modalHtml = renderManualTripModal();
assert.ok(modalHtml.includes('Manual Shopping Trip Entry'), 'Contains modal title');
assert.ok(modalHtml.includes('Itemized Purchases'), 'Contains Itemized Purchases header');
assert.ok(modalHtml.includes('(Optional)'), 'Section clearly labeled Optional');
assert.ok(modalHtml.includes('id="manual-items-table"'), 'Contains items table');
assert.ok(modalHtml.includes('id="manual-items-tbody"'), 'Contains items tbody');
assert.ok(modalHtml.includes('id="add-manual-item-row"'), 'Contains Add Item Row button');
assert.ok(modalHtml.includes('manual-item-name'), 'Contains item name class');
assert.ok(modalHtml.includes('manual-item-qty-unit'), 'Contains qty & unit class');
assert.ok(modalHtml.includes('manual-item-price'), 'Contains line price class');
assert.ok(modalHtml.includes('remove-manual-item-btn'), 'Contains remove item button');
assert.ok(modalHtml.includes('id="manual-sum-to-total-btn"'), 'Contains Apply Sum button');

// Verify re-export from CourseProjectView.js works identically
const reExportedHtml = reExportedModal();
assert.strictEqual(reExportedHtml, modalHtml, 'CourseProjectView re-exports identical modal markup');
console.log('  ✅ Modal markup contains all required inputs and optional section elements.');

// ----------------------------------------------------
// Test 3: Manual Trip with Wet Market Line Items
// ----------------------------------------------------
console.log('\nTest 3: Saving manual wet market trip with itemized purchases');

localStorage.clear();

const manualItems = [
  {
    name: 'Sayote',
    quantity: 2,
    unit: 'pcs',
    unitPrice: 22.50,
    totalPrice: 45.00,
    rawReceiptText: 'Sayote (2 pcs)',
    weightGrams: 0
  },
  {
    name: 'Fresh Pork Belly',
    quantity: 1,
    unit: 'kg',
    unitPrice: 380.00,
    totalPrice: 380.00,
    rawReceiptText: 'Fresh Pork Belly (1 kg)',
    weightGrams: 1000
  }
];

const savedTrip = await saveShoppingTrip({
  storeName: 'Paco Wet Market',
  date: '2026-11-01',
  tripType: 'Wet Market / Palengke',
  totalScaleWeightKg: 2.85,
  totalAmountPaid: 425.00,
  notes: 'Manual wet market shopping trip',
  items: manualItems
}, manualItems);

const allTrips = getShoppingTrips();
assert.strictEqual(allTrips.length, 1);
assert.strictEqual(allTrips[0].storeName, 'Paco Wet Market');
assert.strictEqual(allTrips[0].itemsCount, 2, 'Trip record reflects 2 itemized purchases');
assert.strictEqual(allTrips[0].totalAmountPaid, 425.00);
assert.strictEqual(allTrips[0].totalScaleWeightKg, 2.85);

const linkedItems = getGroceryItems(allTrips[0].id);
assert.strictEqual(linkedItems.length, 2, '2 items saved to grocery inventory');
assert.strictEqual(linkedItems[0].name, 'Sayote');
assert.strictEqual(linkedItems[0].quantity, 2);
assert.strictEqual(linkedItems[0].unit, 'pcs');
assert.strictEqual(linkedItems[0].totalPrice, 45.00);

assert.strictEqual(linkedItems[1].name, 'Fresh Pork Belly');
assert.strictEqual(linkedItems[1].quantity, 1);
assert.strictEqual(linkedItems[1].unit, 'kg');
assert.strictEqual(linkedItems[1].totalPrice, 380.00);
assert.strictEqual(linkedItems[1].weightGrams, 1000);

console.log('  ✅ Manual wet market items successfully linked to trip and stored in inventory.');

// ----------------------------------------------------
// Test 4: Verify Payload Compatibility with /api/trips
// ----------------------------------------------------
console.log('\nTest 4: /api/trips receives items array from manual shopping trip');

function createMockReqRes(method, body = {}, url = '/api/trips') {
  const req = { method, url, body, headers: { 'content-type': 'application/json' } };
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

const mockPayload = {
  trip: {
    id: allTrips[0].id,
    date: allTrips[0].date,
    projectWeek: allTrips[0].projectWeek,
    storeName: allTrips[0].storeName,
    tripType: allTrips[0].tripType,
    totalAmountPaid: allTrips[0].totalAmountPaid,
    totalScaleWeightKg: allTrips[0].totalScaleWeightKg,
    notes: allTrips[0].notes
  },
  items: linkedItems
};

delete process.env.DATABASE_URL;
const { req, res, getData } = createMockReqRes('POST', mockPayload);
await tripsApiHandler(req, res);
const result = getData();

assert.strictEqual(result.trip.id, allTrips[0].id);
assert.strictEqual(result.items.length, 2, 'API correctly receives and preserves 2 items');
assert.ok(result.offline, 'Handled offline gracefully when DATABASE_URL is not set');

console.log('  ✅ POST /api/trips successfully accepts bundled manual items payload.');

// ----------------------------------------------------
// Test 5: Optionality - Saving without items preserves high-level metadata
// ----------------------------------------------------
console.log('\nTest 5: Optionality test - trip without itemized purchases');

const emptyTrip = await saveShoppingTrip({
  storeName: 'Corner Sari-Sari Store',
  date: '2026-11-02',
  tripType: 'Convenience Store',
  totalScaleWeightKg: 0.5,
  totalAmountPaid: 65.00,
  notes: 'Quick salt purchase'
}, []);

const tripsNow = getShoppingTrips();
assert.strictEqual(tripsNow.length, 2);
const emptyTripItems = getGroceryItems(emptyTrip.trip.id);
assert.strictEqual(emptyTripItems.length, 0, 'No items created when itemized purchases are omitted');

console.log('  ✅ Trip without line items saves successfully with 0 items.');

console.log('\n=========================================');
console.log('🎉 ALL MANUAL TRIP MODAL TESTS PASSED!');
console.log('=========================================\n');
