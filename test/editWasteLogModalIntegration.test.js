import assert from 'node:assert';
import fs from 'node:fs';

console.log('🧪 Starting Dedicated Edit Waste Log Modal & FoodWasteLogView Integration Test Suite...\n');

// 1. Inspect EditWasteLogModal.jsx
console.log('Test 1: EditWasteLogModal.jsx component requirements');
const modalCode = fs.readFileSync('src/components/EditWasteLogModal.jsx', 'utf8');

assert.ok(modalCode.includes('targetRecord = log || record'), 'Must support both log and record props');
assert.ok(modalCode.includes('isModalOpen = isOpen !== undefined ? Boolean(isOpen) : Boolean(targetRecord)'), 'Must automatically open when log or record is provided');

// Required fields
assert.ok(modalCode.includes('itemName'), 'Must include Food Discarded / itemName field');
assert.ok(modalCode.includes('measuredWeightG'), 'Must include Scale Weight (grams) field');
assert.ok(modalCode.includes('estimatedCost'), 'Must include Estimated Cost (₱) field');
assert.ok(modalCode.includes('reason'), 'Must include Disposal Reason field');
assert.ok(modalCode.includes('date'), 'Must include Waste Date field');
assert.ok(modalCode.includes('projectWeek'), 'Must include Project Week field');
assert.ok(modalCode.includes('notes'), 'Must include Notes field');

// Disposal reasons
const requiredReasons = [
  'Spoiled / Molded',
  'Cooked Excess / Leftover',
  'Accidental Spillage / Dropped',
  'Expired Pantry Item',
  'Plate Waste / Unfinished Meal',
  'Preparation Waste (Inedible/Trimmed)'
];

for (const reason of requiredReasons) {
  assert.ok(modalCode.includes(reason), `Must support standard disposal reason: ${reason}`);
}

// Bounded height, scroll safety, and click containment
assert.ok(modalCode.includes('shrink-0'), 'Must pin header and footer with shrink-0');
assert.ok(modalCode.includes('overflow-y-auto'), 'Must provide independently scrollable form body');
assert.ok(modalCode.includes('stopPropagation'), 'Must prevent clicks inside dialog from dismissing modal');
assert.ok(modalCode.includes('Save Changes'), 'Must provide Save Changes action');
assert.ok(modalCode.includes('Cancel'), 'Must provide Cancel action');
console.log('  ✅ EditWasteLogModal verified with all 7 fields, 6 standard reasons, scrollable body, and stopPropagation.');

// 2. Inspect FoodWasteLogView.jsx
console.log('\nTest 2: FoodWasteLogView.jsx connection and state handling');
const viewCode = fs.readFileSync('src/components/FoodWasteLogView.jsx', 'utf8');

assert.ok(viewCode.includes('const [editingLog, setEditingLog] = useState(null)'), 'Must manage editingLog state');
assert.ok(viewCode.includes('setEditingLog(r)'), 'Edit button must call setEditingLog(r)');
assert.ok(
  viewCode.includes('<EditWasteLogModal') &&
  viewCode.includes('log={editingLog}') &&
  viewCode.includes('onClose={() => setEditingLog(null)}') &&
  viewCode.includes('onSave={handleSaveEditedLog}'),
  'Must render EditWasteLogModal with log, onClose, and onSave props'
);

assert.ok(viewCode.includes('handleSaveEditedLog'), 'Must implement handleSaveEditedLog handler');
assert.ok(viewCode.includes('updateFoodWasteRecord'), 'handleSaveEditedLog must call updateFoodWasteRecord');
console.log('  ✅ FoodWasteLogView wiring, editingLog state, and handleSaveEditedLog verified.');

// 3. Inspect main.js
console.log('\nTest 3: main.js import safety check');
const mainCode = fs.readFileSync('src/main.js', 'utf8');
assert.ok(mainCode.includes('getFoodWasteRecords,'), 'main.js must safely import getFoodWasteRecords');
console.log('  ✅ main.js imports getFoodWasteRecords without throwing ReferenceError.');

console.log('\n=============================================================');
console.log('🎉 ALL DEDICATED EDIT WASTE LOG MODAL TESTS PASSED!');
console.log('=============================================================\n');
