import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage & sessionStorage for Node testing environment
const mockLocalStorage = {};
global.localStorage = {
  getItem: (key) => mockLocalStorage[key] || null,
  setItem: (key, val) => { mockLocalStorage[key] = String(val); },
  removeItem: (key) => { delete mockLocalStorage[key]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

const mockSessionStorage = {};
global.sessionStorage = {
  getItem: (key) => mockSessionStorage[key] || null,
  setItem: (key, val) => { mockSessionStorage[key] = String(val); },
  removeItem: (key) => { delete mockSessionStorage[key]; },
  clear: () => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); }
};

import {
  renderCourseProjectView,
  renderReceiptScanModal,
  createReceiptItemRowHtml
} from '../src/components/CourseProjectView.js';

import {
  saveShoppingTrip,
  getShoppingTrips,
  getGroceryItems
} from '../src/services/courseProjectStorage.js';

console.log('🧪 Starting Grocery Intake Flow Refactor Test Suite...\n');

// ----------------------------------------------------
// Test 1: Unified Modal Trigger Button ("Scan Food")
// ----------------------------------------------------
console.log('Test 1: Unified Modal Trigger Button ("Scan Food") in CourseProjectView');

localStorage.clear();
const tripsHtml = renderCourseProjectView({ courseSubTab: 'trips' });

// 1a: Actions bar has single primary button labeled "Scan Food"
assert.ok(tripsHtml.includes('id="open-receipt-scanner-btn"'), 'Actions bar contains open-receipt-scanner-btn');
assert.ok(tripsHtml.includes('Scan Food'), 'Primary action button is labeled "Scan Food"');
assert.ok(!tripsHtml.includes('Scan Supermarket Receipt'), 'Dual button "Scan Supermarket Receipt" has been replaced');
assert.ok(!tripsHtml.includes('Manual Trip Entry (Wet Market)'), 'Dual button "Manual Trip Entry (Wet Market)" has been replaced');

// 1b: Empty state card has unified "Scan Food" button
assert.ok(tripsHtml.includes('id="empty-scan-btn"'), 'Empty state card contains empty-scan-btn');
assert.ok(tripsHtml.includes('>📷 Scan Food</button>'), 'Empty state button is labeled "📷 Scan Food"');
assert.ok(!tripsHtml.includes('id="empty-manual-btn"'), 'Dual empty manual button has been replaced');

console.log('  ✅ Dual buttons replaced with unified "Scan Food" primary action button.');

// ----------------------------------------------------
// Test 2: In-Modal Venue Mode Toggle & State Transitions
// ----------------------------------------------------
console.log('\nTest 2: In-Modal Venue Mode Toggle & State Transitions');

// 2a: Default / Supermarket Mode
const supermarketModalHtml = renderReceiptScanModal({
  receiptModalOpen: true,
  groceryVenueMode: 'supermarket'
});

assert.ok(supermarketModalHtml.includes('class="venue-mode-toggle"'), 'Modal contains segmented venue mode toggle');
assert.ok(supermarketModalHtml.includes('data-venue="supermarket"'), 'Toggle includes Supermarket option');
assert.ok(supermarketModalHtml.includes('data-venue="wet_market"'), 'Toggle includes Wet Market option');
assert.ok(supermarketModalHtml.includes('receipt-dropzone'), 'Supermarket mode renders OCR upload dropzone');
assert.ok(supermarketModalHtml.includes('split-left-pane'), 'Supermarket mode renders left split pane');
assert.ok(!supermarketModalHtml.includes('Physical Scale Weight Reconciliation:'), 'Supermarket mode does not show wet market reconciliation callout');

// 2b: Wet Market Mode State Transition
const wetMarketModalHtml = renderReceiptScanModal({
  receiptModalOpen: true,
  groceryVenueMode: 'wet_market'
});

assert.ok(wetMarketModalHtml.includes('Wet Market Food Intake & Manual Log'), 'Wet market mode has dedicated modal title');
assert.ok(!wetMarketModalHtml.includes('receipt-dropzone'), 'Wet market mode hides OCR dropzone');
assert.ok(!wetMarketModalHtml.includes('split-left-pane'), 'Wet market mode omits left upload pane');
assert.ok(wetMarketModalHtml.includes('Physical Scale Weight Reconciliation:'), 'Wet market mode displays scale reconciliation callout');
assert.ok(wetMarketModalHtml.includes('Paco Wet Market') || wetMarketModalHtml.includes('Wet Market / Palengke'), 'Wet market mode provides market stall placeholder');
assert.ok(wetMarketModalHtml.includes('🥬 Itemized Purchases'), 'Wet market mode displays itemized market purchases label');

console.log('  ✅ Segmented toggle transitions layout cleanly between Supermarket OCR and Wet Market manual mode.');

// ----------------------------------------------------
// Test 3: Mobile Horizontal Space Resolution (Responsive Item Rows)
// ----------------------------------------------------
console.log('\nTest 3: Mobile Responsive 2-Tier Card Layout & Portrait Tip');

const sampleItem = {
  name: 'Sayote Fresh',
  quantity: 2.5,
  unit: 'kg',
  unitPrice: 35.00,
  totalPrice: 87.50,
  category: 'Wet Market Produce'
};

const rowHtml = createReceiptItemRowHtml(sampleItem, 0, null, true);

// 3a: Tier 1 - Item Name + Delete Button
assert.ok(rowHtml.includes('class="receipt-item-row"'), 'Row has receipt-item-row class');
assert.ok(rowHtml.includes('class="item-cell-name"'), 'Row contains Tier 1 item-cell-name');
assert.ok(rowHtml.includes('class="item-cell-delete"'), 'Row contains Tier 1 item-cell-delete inline');
assert.ok(rowHtml.includes('remove-item-row-btn'), 'Row contains remove-item-row-btn');

// 3b: Tier 2 - 3-Column Cluster
assert.ok(rowHtml.includes('class="item-cell-qty"'), 'Row contains Tier 2 item-cell-qty');
assert.ok(rowHtml.includes('class="item-cell-unit"'), 'Row contains Tier 2 item-cell-unit');
assert.ok(rowHtml.includes('class="item-cell-price"'), 'Row contains Tier 2 item-cell-price');
assert.ok(rowHtml.includes('class="item-cell-total"'), 'Row contains Tier 2 item-cell-total');
assert.ok(rowHtml.includes('class="mobile-cell-label"'), 'Row contains mobile-cell-label for mobile viewports');

// 3c: Portrait Orientation Tip Banner
assert.ok(supermarketModalHtml.includes('id="portrait-orientation-tip"'), 'Modal contains portrait orientation tip');
assert.ok(supermarketModalHtml.includes('Rotate to landscape for an expanded spreadsheet view'), 'Tip contains rotation suggestion');
assert.ok(supermarketModalHtml.includes('id="dismiss-portrait-tip-btn"'), 'Tip contains dismiss button');

// 3d: Dismissed tip is not rendered
sessionStorage.setItem('kosherai_portrait_tip_dismissed', '1');
const dismissedModalHtml = renderReceiptScanModal({ receiptModalOpen: true });
assert.ok(!dismissedModalHtml.includes('id="portrait-orientation-tip"'), 'Dismissed portrait tip is omitted');
sessionStorage.clear();

// 3e: Verify CSS rules exist in style.css
const styleCss = fs.readFileSync(path.resolve('src/style.css'), 'utf-8');
assert.ok(styleCss.includes('.receipt-item-row'), 'style.css defines .receipt-item-row');
assert.ok(styleCss.includes('.portrait-orientation-tip'), 'style.css defines .portrait-orientation-tip');
assert.ok(styleCss.includes('(orientation: portrait)'), 'style.css contains portrait media query');
assert.ok(styleCss.includes('.venue-mode-toggle'), 'style.css defines .venue-mode-toggle');

console.log('  ✅ Responsive 2-tier card layout and dismissible portrait orientation prompt verified.');

// ----------------------------------------------------
// Test 4: Form Integrity, Scale Weight & trip_type Tagging
// ----------------------------------------------------
console.log('\nTest 4: Form Integrity, Scale Weight & Transaction Classification Tagging');

localStorage.clear();

// 4a: Supermarket Trip submission with trip_type: "supermarket"
const supermarketTrip = await saveShoppingTrip({
  storeName: 'Puregold Price Club',
  date: '2026-11-05',
  trip_type: 'supermarket',
  tripType: 'supermarket',
  totalScaleWeightKg: 5.75,
  totalAmountPaid: 1250.00,
  notes: 'Supermarket scanned trip',
  items: [
    { name: 'Purefoods Corned Beef', quantity: 2, unit: 'pcs', unitPrice: 85, totalPrice: 170 }
  ]
}, [
  { name: 'Purefoods Corned Beef', quantity: 2, unit: 'pcs', unitPrice: 85, totalPrice: 170 }
]);

// 4b: Wet Market Trip submission with trip_type: "wet_market"
const wetMarketTrip = await saveShoppingTrip({
  storeName: 'Paco Public Wet Market',
  date: '2026-11-05',
  trip_type: 'wet_market',
  tripType: 'wet_market',
  totalScaleWeightKg: 4.10,
  totalAmountPaid: 620.00,
  notes: 'Wet market manual trip',
  items: [
    { name: 'Fresh Sayote', quantity: 1, unit: 'kg', unitPrice: 40, totalPrice: 40 },
    { name: 'Pork Kasim', quantity: 1.5, unit: 'kg', unitPrice: 320, totalPrice: 480 }
  ]
}, [
  { name: 'Fresh Sayote', quantity: 1, unit: 'kg', unitPrice: 40, totalPrice: 40 },
  { name: 'Pork Kasim', quantity: 1.5, unit: 'kg', unitPrice: 320, totalPrice: 480 }
]);

const recordedTrips = getShoppingTrips();
assert.strictEqual(recordedTrips.length, 2, 'Both trips saved');

const recordedSupermarket = recordedTrips.find(t => t.storeName === 'Puregold Price Club');
assert.ok(recordedSupermarket, 'Found supermarket trip');
assert.strictEqual(recordedSupermarket.totalScaleWeightKg, 5.75, 'Whole-grocery scale weight preserved (5.75 kg)');
assert.strictEqual(recordedSupermarket.trip_type, 'supermarket', 'trip_type tagged as supermarket');
assert.strictEqual(recordedSupermarket.tripType, 'supermarket', 'tripType tagged as supermarket');

const recordedWetMarket = recordedTrips.find(t => t.storeName === 'Paco Public Wet Market');
assert.ok(recordedWetMarket, 'Found wet market trip');
assert.strictEqual(recordedWetMarket.totalScaleWeightKg, 4.10, 'Whole-grocery scale weight preserved (4.10 kg)');
assert.strictEqual(recordedWetMarket.trip_type, 'wet_market', 'trip_type tagged as wet_market');
assert.strictEqual(recordedWetMarket.tripType, 'wet_market', 'tripType tagged as wet_market');

// 4c: Check item inventory linkage
const wetMarketItems = getGroceryItems(recordedWetMarket.id);
assert.strictEqual(wetMarketItems.length, 2, '2 line items linked to wet market trip');
assert.strictEqual(wetMarketItems[0].name, 'Fresh Sayote');
assert.strictEqual(wetMarketItems[1].name, 'Pork Kasim');

console.log('  ✅ Two-way binding, scale weights, and dynamic trip_type ("supermarket" | "wet_market") tagging verified.');

console.log('\n=========================================');
console.log('🎉 ALL GROCERY INTAKE FLOW TESTS PASSED!');
console.log('=========================================');

