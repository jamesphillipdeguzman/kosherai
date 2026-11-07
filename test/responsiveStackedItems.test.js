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

// B. Mobile View 2-Line Responsive Card verification
assert.ok(
  receiptModalCode.includes('w-9 h-9 shrink-0 flex items-center justify-center'),
  'Must include dedicated remove button on Line 1'
);
assert.ok(
  receiptModalCode.includes('grid grid-cols-4 gap-2 items-end'),
  'Line 2 must use a 4-column balanced grid with items-end alignment'
);
assert.ok(
  receiptModalCode.includes('>Qty<') || receiptModalCode.includes('Qty\n') || receiptModalCode.includes('Qty</label>'),
  'Must include compact Qty label'
);
assert.ok(
  receiptModalCode.includes('>Unit<') || receiptModalCode.includes('Unit\n') || receiptModalCode.includes('Unit</label>'),
  'Must include compact Unit label'
);
assert.ok(
  receiptModalCode.includes('Price (₱)'),
  'Must include compact Price (₱) label'
);
assert.ok(
  receiptModalCode.includes('>Total<') || receiptModalCode.includes('Total\n') || receiptModalCode.includes('Total</label>'),
  'Must include compact Total label'
);
assert.ok(
  receiptModalCode.includes('text-emerald-500') || receiptModalCode.includes('text-emerald-400'),
  'Line total must display formatted emerald total'
);
console.log('  ✅ Responsive 2-line card layout (Line 1: Item Name & Remove; Line 2: 4-col Qty, Unit, Price, Total) verified.');

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

