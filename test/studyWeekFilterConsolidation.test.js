import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCourseProjectView } from '../src/components/CourseProjectView.js';
import { renderShoppingTripsView } from '../src/components/ShoppingTripsView.js';
import { saveShoppingTrip, getShoppingTrips, getGroceryItems } from '../src/services/courseProjectStorage.js';
import { normalizeWeek, resolveItemWeek, isWeekMatch } from '../src/utils/weekNormalization.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

console.log('🧪 Starting Six-Week Study Week Filters Consolidation Tests...\n');

// ---------------------------------------------------------------------------
// Test 1: Week Value Normalization Heuristics
// ---------------------------------------------------------------------------
console.log('Test 1: Week Value Normalization Heuristics');

assert.strictEqual(normalizeWeek(1), 1);
assert.strictEqual(normalizeWeek('1'), 1);
assert.strictEqual(normalizeWeek('W1'), 1);
assert.strictEqual(normalizeWeek('W01'), 1);
assert.strictEqual(normalizeWeek('w02'), 2);
assert.strictEqual(normalizeWeek(6), 6);
assert.strictEqual(normalizeWeek('W06'), 6);
assert.strictEqual(normalizeWeek('all'), 'all');
assert.strictEqual(normalizeWeek('All Weeks'), 'all');
assert.strictEqual(normalizeWeek(null), 'all');
assert.strictEqual(normalizeWeek(undefined), 'all');
assert.strictEqual(normalizeWeek(99), 'all'); // out of study range defaults to 'all'

assert.strictEqual(isWeekMatch(1, 'all'), true);
assert.strictEqual(isWeekMatch(1, 'W01'), true);
assert.strictEqual(isWeekMatch(2, 'W01'), false);
assert.strictEqual(isWeekMatch('W02', 2), true);

console.log('  ✅ normalizeWeek and isWeekMatch correctly normalize numeric and formatted strings.');

// ---------------------------------------------------------------------------
// Test 2: Large Week Cards Include "All Weeks" at Beginning
// ---------------------------------------------------------------------------
console.log('\nTest 2: Large Week Cards Include "All Weeks" at Beginning');

localStorage.clear();

const tripW1 = {
  id: 'trip_study_w1',
  storeName: 'Puregold W1',
  date: '2026-11-02',
  projectWeek: 1,
  tripType: 'Supermarket',
  totalAmountPaid: 800.00,
  totalScaleWeightKg: 3.5,
  receiptImageUrl: null,
  notes: 'Week 1 baseline'
};

const itemsW1 = [
  {
    id: 'item_w1_1',
    tripId: 'trip_study_w1',
    name: 'Bok Choy W1',
    quantity: 2,
    unit: 'kg',
    unitPrice: 40,
    totalPrice: 80,
    lidStatus: 'SAFE'
  }
];

const tripW2 = {
  id: 'trip_study_w2',
  storeName: 'Paco Market W2',
  date: '2026-11-09',
  projectWeek: 2,
  tripType: 'Wet Market / Palengke',
  totalAmountPaid: 450.00,
  totalScaleWeightKg: 1.8,
  receiptImageUrl: null,
  notes: 'Week 2 intervention'
};

const itemsW2 = [
  {
    id: 'item_w2_1',
    tripId: 'trip_study_w2',
    name: 'Tilapia W2',
    quantity: 1,
    unit: 'kg',
    unitPrice: 160,
    totalPrice: 160,
    lidStatus: 'SAFE'
  }
];

await saveShoppingTrip(tripW1, itemsW1);
await saveShoppingTrip(tripW2, itemsW2);

const projectHtmlDefault = renderCourseProjectView({
  courseSubTab: 'trips',
  selectedWeekView: 'all'
});

// Verify All Weeks card is present
assert.ok(projectHtmlDefault.includes('data-week-select="all"'), 'Must render All Weeks card with data-week-select="all"');
assert.ok(projectHtmlDefault.includes('All Weeks'), 'All Weeks card must have "All Weeks" label');
assert.ok(projectHtmlDefault.includes('Overview'), 'All Weeks card must display "Overview" subtitle');
assert.ok(projectHtmlDefault.includes('2 Trips') || projectHtmlDefault.includes('2 trips'), 'All Weeks card displays total trip count (2 Trips)');

// Verify W1-W6 cards are present
for (let w = 1; w <= 6; w++) {
  assert.ok(projectHtmlDefault.includes(`data-week-select="${w}"`), `Must render study card for Week ${w} with data-week-select="${w}"`);
  assert.ok(projectHtmlDefault.includes(`W${w}`), `Must display W${w} label`);
}

// Verify All Weeks card appears BEFORE W1 card in the DOM
const allIdx = projectHtmlDefault.indexOf('data-week-select="all"');
const w1Idx = projectHtmlDefault.indexOf('data-week-select="1"');
assert.ok(allIdx !== -1 && w1Idx !== -1 && allIdx < w1Idx, 'All Weeks card must be positioned at the beginning before W1');

console.log('  ✅ Large study cards include "All Weeks" at the beginning followed by W1 through W6.');

// ---------------------------------------------------------------------------
// Test 3: Secondary Text-Based Filter Row is Completely Removed
// ---------------------------------------------------------------------------
console.log('\nTest 3: Secondary Text-Based Filter Row Removed');

// Check ShoppingTripsView HTML
const tripsViewHtml = renderShoppingTripsView({ selectedWeekView: 'all' });
assert.ok(!tripsViewHtml.includes('class="week-filter-bar"'), 'Must NOT contain week-filter-bar container');
assert.ok(!tripsViewHtml.includes('Week Filter:'), 'Must NOT contain "Week Filter:" secondary label');

// Check ShoppingTripsView.js source
const jsSource = fs.readFileSync(path.join(__dirname, '../src/components/ShoppingTripsView.js'), 'utf-8');
assert.ok(!jsSource.includes('class="week-filter-bar"'), 'ShoppingTripsView.js must not contain week-filter-bar');
assert.ok(!jsSource.includes('Week Filter:'), 'ShoppingTripsView.js must not contain "Week Filter:"');

// Check ShoppingTripsView.jsx source
const jsxSource = fs.readFileSync(path.join(__dirname, '../src/components/ShoppingTripsView.jsx'), 'utf-8');
assert.ok(!jsxSource.includes('className="week-filter-bar"'), 'ShoppingTripsView.jsx must not contain week-filter-bar');
assert.ok(!jsxSource.includes('Week Filter:'), 'ShoppingTripsView.jsx must not contain "Week Filter:"');

console.log('  ✅ Redundant secondary text-based filter row is completely removed from JS and JSX.');

// ---------------------------------------------------------------------------
// Test 4: Shopping Trips Filtered by Shared Week State
// ---------------------------------------------------------------------------
console.log('\nTest 4: Shopping Trips Filtered by Shared Week State');

// All Weeks: Shows both W1 and W2 trips
const tripsHtmlAll = renderShoppingTripsView({ selectedWeekView: 'all' });
assert.ok(tripsHtmlAll.includes('Puregold W1'), 'All weeks shows W1 trip');
assert.ok(tripsHtmlAll.includes('Paco Market W2'), 'All weeks shows W2 trip');

// Week 1: Shows ONLY W1 trip
const tripsHtmlW1 = renderShoppingTripsView({ selectedWeekView: 1 });
assert.ok(tripsHtmlW1.includes('Puregold W1'), 'Week 1 filter shows W1 trip');
assert.ok(!tripsHtmlW1.includes('Paco Market W2'), 'Week 1 filter excludes W2 trip');

// Week 2: Shows ONLY W2 trip
const tripsHtmlW2 = renderShoppingTripsView({ selectedWeekView: 2 });
assert.ok(!tripsHtmlW2.includes('Puregold W1'), 'Week 2 filter excludes W1 trip');
assert.ok(tripsHtmlW2.includes('Paco Market W2'), 'Week 2 filter shows W2 trip');

// Week 3 (Empty): Excludes both
const tripsHtmlW3 = renderShoppingTripsView({ selectedWeekView: 3 });
assert.ok(!tripsHtmlW3.includes('Puregold W1'), 'Week 3 excludes W1 trip');
assert.ok(!tripsHtmlW3.includes('Paco Market W2'), 'Week 3 excludes W2 trip');

console.log('  ✅ Shopping trips accurately filter according to shared selectedWeek (all, 1, 2, 3..6).');

// ---------------------------------------------------------------------------
// Test 5: Grocery Purchases Follow Parent Trip Week
// ---------------------------------------------------------------------------
console.log('\nTest 5: Grocery Purchases Follow Parent Trip Week');

// All Weeks Groceries
const groceriesAll = renderCourseProjectView({
  courseSubTab: 'groceries',
  selectedWeekView: 'all'
});
assert.ok(groceriesAll.includes('Bok Choy W1'), 'All weeks groceries shows W1 item');
assert.ok(groceriesAll.includes('Tilapia W2'), 'All weeks groceries shows W2 item');

// Week 1 Groceries
const groceriesW1 = renderCourseProjectView({
  courseSubTab: 'groceries',
  selectedWeekView: 1
});
assert.ok(groceriesW1.includes('Bok Choy W1'), 'Week 1 groceries shows W1 item');
assert.ok(!groceriesW1.includes('Tilapia W2'), 'Week 1 groceries excludes W2 item');

// Week 2 Groceries
const groceriesW2 = renderCourseProjectView({
  courseSubTab: 'groceries',
  selectedWeekView: 2
});
assert.ok(!groceriesW2.includes('Bok Choy W1'), 'Week 2 groceries excludes W1 item');
assert.ok(groceriesW2.includes('Tilapia W2'), 'Week 2 groceries shows W2 item');

console.log('  ✅ Grocery records follow parent shopping trip\'s week and correctly filter.');

// ---------------------------------------------------------------------------
// Test 6: Verify SixWeekStudyView.jsx and GroceryPurchasesView.jsx Components
// ---------------------------------------------------------------------------
console.log('\nTest 6: SixWeekStudyView.jsx and GroceryPurchasesView.jsx Components');

assert.ok(fs.existsSync(path.join(__dirname, '../src/components/SixWeekStudyView.jsx')), 'SixWeekStudyView.jsx must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../src/components/GroceryPurchasesView.jsx')), 'GroceryPurchasesView.jsx must exist');

const sixWeekStudySource = fs.readFileSync(path.join(__dirname, '../src/components/SixWeekStudyView.jsx'), 'utf-8');
assert.ok(sixWeekStudySource.includes('data-week-select="all"'), 'SixWeekStudyView renders All Weeks card');
assert.ok(sixWeekStudySource.includes('normalizeWeek'), 'SixWeekStudyView uses normalizeWeek');

const groceryPurchasesSource = fs.readFileSync(path.join(__dirname, '../src/components/GroceryPurchasesView.jsx'), 'utf-8');
assert.ok(groceryPurchasesSource.includes('resolveItemWeek'), 'GroceryPurchasesView resolves week from parent trip');
assert.ok(groceryPurchasesSource.includes('normalizeWeek'), 'GroceryPurchasesView normalizes week');

console.log('  ✅ SixWeekStudyView.jsx and GroceryPurchasesView.jsx clean React components verified.');

console.log('\n======================================================================');
console.log('🎉 ALL SIX-WEEK STUDY WEEK FILTERS CONSOLIDATION TESTS PASSED!');
console.log('======================================================================\n');
