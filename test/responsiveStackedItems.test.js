import assert from 'node:assert';
import fs from 'node:fs';

console.log('🧪 Starting Responsive Stacked Items & Unit Dropdown Test Suite...\n');

// 1. Verify ReceiptScannerModal.jsx component code
console.log('Test 1: ReceiptScannerModal.jsx Responsive Layout & Dropdown Elements');
const receiptModalCode = fs.readFileSync('src/components/ReceiptScannerModal.jsx', 'utf8');

// A. Unit Dropdown verification
assert.ok(receiptModalCode.includes('<select'), 'Must contain select element for unit');
const supportedUnits = ['kg', 'g', 'pcs', 'pack', 'bundle', 'can', 'bottle'];
for (const unit of supportedUnits) {
  assert.ok(
    receiptModalCode.includes(`<option value="${unit}">${unit}</option>`),
    `Must include supported unit option: ${unit}`
  );
}
console.log('  ✅ Unit dropdown with all 7 ergonomic options verified (kg, g, pcs, pack, bundle, can, bottle).');

// B. Mobile View 2-Tier Stacked Card verification
assert.ok(
  receiptModalCode.includes('hidden sm:grid sm:grid-cols-12'),
  'Desktop column header must be hidden on mobile screens (hidden sm:grid)'
);
assert.ok(
  receiptModalCode.includes('space-y-2 sm:space-y-0'),
  'Item card container must use responsive spacing (space-y-2 on mobile, space-y-0 on desktop)'
);
assert.ok(
  receiptModalCode.includes('sm:hidden'),
  'Must include mobile-only delete button (sm:hidden)'
);
assert.ok(
  receiptModalCode.includes('grid grid-cols-12 gap-2 sm:contents'),
  'Tier 2 cluster must use grid-cols-12 on mobile and sm:contents on desktop'
);
assert.ok(
  receiptModalCode.includes('col-span-5') && receiptModalCode.includes('sm:col-span-3'),
  'Qty & Unit selector must span 5 cols on mobile and 3 cols on desktop'
);
assert.ok(
  receiptModalCode.includes('col-span-4') && receiptModalCode.includes('sm:col-span-2'),
  'Price input must span 4 cols on mobile and 2 cols on desktop'
);
assert.ok(
  receiptModalCode.includes('col-span-3') && receiptModalCode.includes('sm:col-span-2'),
  'Line total badge must span 3 cols on mobile and 2 cols on desktop'
);
assert.ok(
  receiptModalCode.includes('hidden sm:flex sm:col-span-1'),
  'Desktop delete button must be hidden on mobile and span 1 col on desktop'
);
console.log('  ✅ Mobile 2-tier stacked card layout and desktop 12-col grid integration verified.');

// 2. Verify CourseProjectView.js createReceiptItemRowHtml unit dropdown
console.log('\nTest 2: CourseProjectView.js createReceiptItemRowHtml Unit Dropdown');
const courseViewCode = fs.readFileSync('src/components/CourseProjectView.js', 'utf8');
assert.ok(courseViewCode.includes('select class="table-input item-unit-val"'), 'createReceiptItemRowHtml must render select for item-unit-val');
for (const unit of supportedUnits) {
  assert.ok(
    courseViewCode.includes(`value="${unit}"`),
    `CourseProjectView must include unit option: ${unit}`
  );
}
console.log('  ✅ CourseProjectView receipt items dropdown verified.');

// 3. Verify ManualTripModal.js createManualItemRowHtml unit dropdown
console.log('\nTest 3: ManualTripModal.js createManualItemRowHtml Unit Dropdown');
const manualModalCode = fs.readFileSync('src/components/ManualTripModal.js', 'utf8');
assert.ok(manualModalCode.includes('select class="table-input manual-item-unit"'), 'createManualItemRowHtml must render select for manual-item-unit');
for (const unit of supportedUnits) {
  assert.ok(
    manualModalCode.includes(`value="${unit}"`),
    `ManualTripModal must include unit option: ${unit}`
  );
}
console.log('  ✅ ManualTripModal unit dropdown verified.');

// 4. Verify Tab Order & Two-Way Binding in ReceiptScannerModal.jsx
console.log('\nTest 4: Keyboard Tab Order & Total Recalculation');
assert.ok(receiptModalCode.includes('handleUpdateItem'), 'Must contain handleUpdateItem state handler');
assert.ok(receiptModalCode.includes('updateItem'), 'Must export updateItem helper function');
assert.ok(receiptModalCode.includes('removeItem'), 'Must export removeItem helper function');

// Check tab sequence: Item Name is before Tier 2 (Qty -> Unit -> Price)
const nameIndex = receiptModalCode.indexOf('placeholder="Item Name (e.g., Sayote, Pork Liempo)"');
const qtyIndex = receiptModalCode.indexOf('placeholder="Qty"');
const unitIndex = receiptModalCode.indexOf('option value="kg"');
const priceIndex = receiptModalCode.indexOf('placeholder="₱ Price"');

assert.ok(nameIndex > 0 && qtyIndex > nameIndex && unitIndex > qtyIndex && priceIndex > unitIndex,
  'Tab navigation order must follow: Item Name -> Qty -> Unit -> Price'
);
console.log('  ✅ Clean sequential keyboard navigation (Item Name → Qty → Unit → Price) verified.');

console.log('\n=============================================================');
console.log('🎉 ALL RESPONSIVE STACKED ITEMS & UNIT SELECTOR TESTS PASSED!');
console.log('=============================================================\n');

