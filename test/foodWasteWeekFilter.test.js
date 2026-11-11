import assert from 'node:assert';
import { renderCourseProjectView } from '../src/components/CourseProjectView.js';
import {
  saveFoodWasteRecord,
  getFoodWasteRecords,
  deleteFoodWasteRecord,
  updateFoodWasteRecord,
  PROJECT_CONFIG
} from '../src/services/courseProjectStorage.js';
import {
  normalizeWeek,
  resolveWasteWeek,
  isWasteLogMatchWeek
} from '../src/utils/weekNormalization.js';

// Mock localStorage
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

console.log('🧪 Starting Food Waste Week Filtering Tests...\n');

// Clear storage
localStorage.clear();

// ---------------------------------------------------------------------------
// Test 1: Week Normalization & Resolution for Food Waste Records
// ---------------------------------------------------------------------------
console.log('Test 1: Week Normalization and Resolution for Food Waste');

const config = { startDate: '2026-10-31' };

const wasteW1 = {
  id: 'waste_w1_001',
  itemName: 'Spoiled Strawberries',
  date: '2026-11-06', // Week 1 (Day 7)
  measuredWeightG: 250,
  estimatedCost: 120,
  reason: 'Spoiled / Molded'
};

const wasteW2 = {
  id: 'waste_w2_001',
  itemName: 'Stale Whole Wheat Bread',
  date: '2026-11-10', // Week 2 (Day 11)
  measuredWeightG: 400,
  estimatedCost: 85,
  reason: 'Expired'
};

const wasteExplicitW3 = {
  id: 'waste_w3_001',
  itemName: 'Cooked Rice Excess',
  date: '2026-11-10',
  projectWeek: 3, // Explicitly override date
  measuredWeightG: 150,
  estimatedCost: 35,
  reason: 'Cooked Excess'
};

assert.strictEqual(resolveWasteWeek(wasteW1, config), 1, 'wasteW1 on 2026-11-06 should resolve to Week 1');
assert.strictEqual(resolveWasteWeek(wasteW2, config), 2, 'wasteW2 on 2026-11-10 should resolve to Week 2');
assert.strictEqual(resolveWasteWeek(wasteExplicitW3, config), 3, 'wasteExplicitW3 should resolve to Week 3');

// isWasteLogMatchWeek
assert.strictEqual(isWasteLogMatchWeek(wasteW1, 'all', config), true);
assert.strictEqual(isWasteLogMatchWeek(wasteW1, 1, config), true);
assert.strictEqual(isWasteLogMatchWeek(wasteW1, 'W1', config), true);
assert.strictEqual(isWasteLogMatchWeek(wasteW1, 'w1', config), true);
assert.strictEqual(isWasteLogMatchWeek(wasteW1, 2, config), false);
assert.strictEqual(isWasteLogMatchWeek(wasteW1, 'W2 INTERVENE', config), false);

assert.strictEqual(isWasteLogMatchWeek(wasteW2, 2, config), true);
assert.strictEqual(isWasteLogMatchWeek(wasteW2, 'W2 INTERVENE', config), true);
assert.strictEqual(isWasteLogMatchWeek(wasteW2, 'w2', config), true);
assert.strictEqual(isWasteLogMatchWeek(wasteW2, 1, config), false);

console.log('  ✅ resolveWasteWeek and isWasteLogMatchWeek work correctly for dates, explicit weeks, and string formats.');

// ---------------------------------------------------------------------------
// Test 2: CourseProjectView Food Waste Filtering for W2 INTERVENE
// ---------------------------------------------------------------------------
console.log('\nTest 2: CourseProjectView Filtering for Week 2 (W2 INTERVENE)');

localStorage.clear();
saveFoodWasteRecord(wasteW1);
saveFoodWasteRecord(wasteW2);

// Render Week 2
const htmlW2 = renderCourseProjectView({
  courseSubTab: 'waste',
  selectedWeekView: 'W2 INTERVENE'
});

// Week 2 record must be present
assert.ok(htmlW2.includes('Stale Whole Wheat Bread'), 'Week 2 record must appear in Week 2 view');
assert.ok(htmlW2.includes('400 g'), 'Week 2 weight must appear');
assert.ok(htmlW2.includes('₱85.00') || htmlW2.includes('₱85'), 'Week 2 cost must appear');

// Week 1 record must NOT be present
assert.ok(!htmlW2.includes('Spoiled Strawberries'), 'Week 1 record must NOT appear in Week 2 view');

// Summary Banner check for Week 2
assert.ok(htmlW2.includes('0.40 kg') || htmlW2.includes('400 g'), 'Total weight should be 0.40 kg (400 g)');
assert.ok(htmlW2.includes('1 logs'), 'Total entries should be 1 log');
assert.ok(htmlW2.includes('Filtered for Week 2'), 'Card subtext should reflect Week 2');

console.log('  ✅ Selecting W2 INTERVENE displays only Week 2 records and updates all 3 summary cards.');

// ---------------------------------------------------------------------------
// Test 3: CourseProjectView Food Waste Filtering for Week 1
// ---------------------------------------------------------------------------
console.log('\nTest 3: CourseProjectView Filtering for Week 1 (W1)');

const htmlW1 = renderCourseProjectView({
  courseSubTab: 'waste',
  selectedWeekView: 'w1'
});

// Week 1 record must be present
assert.ok(htmlW1.includes('Spoiled Strawberries'), 'Week 1 record must appear in Week 1 view');
assert.ok(htmlW1.includes('250 g'), 'Week 1 weight must appear');

// Week 2 record must NOT be present
assert.ok(!htmlW1.includes('Stale Whole Wheat Bread'), 'Week 2 record must NOT appear in Week 1 view');

// Summary Banner check for Week 1
assert.ok(htmlW1.includes('0.25 kg') || htmlW1.includes('250 g'), 'Total weight should be 0.25 kg (250 g)');
assert.ok(htmlW1.includes('1 logs'), 'Total entries should be 1 log');
assert.ok(htmlW1.includes('Filtered for Week 1'), 'Card subtext should reflect Week 1');

console.log('  ✅ Selecting W1 displays only Week 1 records and recalculates summary metrics.');

// ---------------------------------------------------------------------------
// Test 4: CourseProjectView Displaying All Weeks
// ---------------------------------------------------------------------------
console.log('\nTest 4: CourseProjectView Displaying All Weeks');

const htmlAll = renderCourseProjectView({
  courseSubTab: 'waste',
  selectedWeekView: 'all'
});

// Both records must be present
assert.ok(htmlAll.includes('Spoiled Strawberries'), 'Week 1 record must appear in All Weeks view');
assert.ok(htmlAll.includes('Stale Whole Wheat Bread'), 'Week 2 record must appear in All Weeks view');

// Summary Banner check for All Weeks
// Total weight = 250 + 400 = 650 g = 0.65 kg
// Total cost = 120 + 85 = 205
assert.ok(htmlAll.includes('0.65 kg') || htmlAll.includes('650 g'), 'Total weight should be 0.65 kg (650 g)');
assert.ok(htmlAll.includes('2 logs'), 'Total entries should be 2 logs');
assert.ok(htmlAll.includes('All logs (2)'), 'Card subtext should show All logs');

console.log('  ✅ Selecting All Weeks restores all records and all-time summary totals.');

// ---------------------------------------------------------------------------
// Test 5: Empty Week State (e.g. Week 3 with no records)
// ---------------------------------------------------------------------------
console.log('\nTest 5: Empty Week State Handling');

const htmlW3 = renderCourseProjectView({
  courseSubTab: 'waste',
  selectedWeekView: 3
});

// Neither Week 1 nor Week 2 records must appear
assert.ok(!htmlW3.includes('Spoiled Strawberries'), 'Week 1 record must NOT leak into Week 3');
assert.ok(!htmlW3.includes('Stale Whole Wheat Bread'), 'Week 2 record must NOT leak into Week 3');

// Summary metrics must be 0
assert.ok(htmlW3.includes('0.00 kg'), 'Total weight should be 0.00 kg');
assert.ok(htmlW3.includes('0 logs'), 'Total entries should be 0 logs');

// Empty state message
assert.ok(htmlW3.includes('No food waste logs recorded for Week 3'), 'Empty state must identify Week 3');

console.log('  ✅ Empty week displays 0 summary metrics and appropriate empty state without leaking records.');

// ---------------------------------------------------------------------------
// Test 6: Preserving Original Record IDs for Edit and Delete
// ---------------------------------------------------------------------------
console.log('\nTest 6: Preserving Original Record IDs for Actions');

assert.ok(htmlAll.includes('data-edit-waste="waste_w1_001"'), 'Edit button must have original waste_w1_001 ID');
assert.ok(htmlAll.includes('data-delete-waste="waste_w1_001"'), 'Delete button must have original waste_w1_001 ID');
assert.ok(htmlAll.includes('data-edit-waste="waste_w2_001"'), 'Edit button must have original waste_w2_001 ID');
assert.ok(htmlAll.includes('data-delete-waste="waste_w2_001"'), 'Delete button must have original waste_w2_001 ID');

console.log('  ✅ Action buttons retain original record IDs for edit and delete operations.');

console.log('\n🎉 ALL FOOD WASTE WEEK FILTERING TESTS PASSED SUCCESSFULLY!\n');

