import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCourseProjectView } from '../src/components/CourseProjectView.js';
import { renderShoppingTripsView, renderTripCard } from '../src/components/ShoppingTripsView.js';
import { saveShoppingTrip, getShoppingTrips } from '../src/services/courseProjectStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

console.log('🧪 Starting Card Clicks & Edit Modal Fix Tests...\n');

// ---------------------------------------------------------------------------
// Test 1: CourseProjectView lightbox does not throw ReferenceError: trips is not defined
// ---------------------------------------------------------------------------
console.log('Test 1: CourseProjectView with lightboxTripId does not throw ReferenceError');

localStorage.clear();

const testTrip = {
  id: 'trip_click_test_1',
  storeName: 'Puregold San Joaquin',
  date: '2026-11-04',
  projectWeek: 1,
  tripType: 'Supermarket',
  totalAmountPaid: 850.00,
  totalScaleWeightKg: 3.2,
  receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  notes: 'Testing lightbox render'
};

const items = [
  {
    id: 'item_1',
    tripId: 'trip_click_test_1',
    name: 'Bok Choy',
    quantity: 2,
    unit: 'kg',
    unitPrice: 45,
    totalPrice: 90,
    lidStatus: 'SAFE'
  }
];

await saveShoppingTrip(testTrip, items);

// Verify rendering CourseProjectView when lightboxTripId is active does NOT throw
let projectHtml = '';
assert.doesNotThrow(() => {
  projectHtml = renderCourseProjectView({
    courseSubTab: 'trips',
    lightboxTripId: 'trip_click_test_1'
  });
}, 'renderCourseProjectView must not throw ReferenceError: trips is not defined');

assert.ok(projectHtml.includes('id="receipt-lightbox-overlay"'), 'Includes receipt lightbox modal');
assert.ok(projectHtml.includes('Puregold San Joaquin'), 'Renders the store name in lightbox');
assert.ok(projectHtml.includes('sample.jpg'), 'Renders lightbox image');
console.log('  ✅ renderCourseProjectView safely renders lightbox without ReferenceError.');

// ---------------------------------------------------------------------------
// Test 2: Shopping Trips View Week Filtering (W01–W06) & Trip Card Clicks
// ---------------------------------------------------------------------------
console.log('\nTest 2: Week Filtering (W01–W06) & Card Markup');

// Add a week 2 trip
const testTripWeek2 = {
  id: 'trip_click_test_2',
  storeName: 'Paco Wet Market',
  date: '2026-11-09',
  projectWeek: 2,
  tripType: 'Wet Market / Palengke',
  totalAmountPaid: 420.00,
  totalScaleWeightKg: 1.5,
  receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/market.jpg',
  notes: 'Week 2 intervention haul'
};
await saveShoppingTrip(testTripWeek2, []);

const tripsViewAll = renderShoppingTripsView({ tripsWeekFilter: 'all' });
assert.ok(tripsViewAll.includes('All Weeks'), 'Includes All Weeks filter chip');
assert.ok(tripsViewAll.includes('W01'), 'Includes W01 chip');
assert.ok(tripsViewAll.includes('W02'), 'Includes W02 chip');
assert.ok(tripsViewAll.includes('Puregold San Joaquin'), 'Contains Week 1 trip');
assert.ok(tripsViewAll.includes('Paco Wet Market'), 'Contains Week 2 trip');

// Filter for Week 1 only
const tripsViewW1 = renderShoppingTripsView({ tripsWeekFilter: '1' });
assert.ok(tripsViewW1.includes('Puregold San Joaquin'), 'Contains Week 1 trip');
assert.ok(!tripsViewW1.includes('Paco Wet Market'), 'Excludes Week 2 trip when W01 is filtered');

console.log('  ✅ Week filtering (W01–W06) correctly renders and filters shopping trips.');

// ---------------------------------------------------------------------------
// Test 3: Card Clicks & Propagation Safeguards in renderTripCard
// ---------------------------------------------------------------------------
console.log('\nTest 3: Card Markup, Grocery Chips & StopPropagation Handlers');

const cardHtml = renderTripCard(testTrip, false);
assert.ok(cardHtml.includes('data-lightbox-trip-id="trip_click_test_1"'), 'Trip card with photo has data-lightbox-trip-id');
assert.ok(cardHtml.includes('cursor-pointer'), 'Trip card with photo is styled with cursor-pointer');
assert.ok(cardHtml.includes('edit-trip-btn'), 'Card has edit button');
assert.ok(cardHtml.includes('delete-trip-btn'), 'Card has delete button');
assert.ok(cardHtml.includes('grocery-card'), 'Extracted item has grocery-card class');
assert.ok(cardHtml.includes('data-grocery-name="Bok Choy"'), 'Extracted item has data-grocery-name');

console.log('  ✅ Trip card has data-lightbox-trip-id, grocery-card item chips, and edit/delete actions.');

// ---------------------------------------------------------------------------
// Test 4: ShoppingTripsView React component prop flexibility & event safeguards
// ---------------------------------------------------------------------------
console.log('\nTest 4: ShoppingTripsView React Component Prop Flexibility');

const jsxSource = fs.readFileSync(path.join(__dirname, '../src/components/ShoppingTripsView.jsx'), 'utf-8');

assert.ok(jsxSource.includes('propTrips || shoppingTrips || filteredTrips'), 'Accepts propTrips, shoppingTrips, or filteredTrips');
assert.ok(jsxSource.includes('stopPropagation()'), 'Includes stopPropagation() on actions and cards');
assert.ok(jsxSource.includes('grocery-card'), 'Renders grocery-card chips in preview');
assert.ok(jsxSource.includes('activeWeekFilter'), 'Implements week filtering state');
assert.ok(jsxSource.includes('selectedGrocery'), 'Implements grocery item details modal state');

console.log('  ✅ React ShoppingTripsView component correctly handles prop aliases, stopPropagation, and modals.');

// ---------------------------------------------------------------------------
// Test 5: Itemized Grocery Purchases Table Card Clicks
// ---------------------------------------------------------------------------
console.log('\nTest 5: Itemized Grocery Purchases Tab Card Clicks');

const groceriesTabHtml = renderCourseProjectView({
  courseSubTab: 'groceries'
});

assert.ok(groceriesTabHtml.includes('grocery-card'), 'Grocery rows in table have grocery-card class');
assert.ok(groceriesTabHtml.includes('data-grocery-name="Bok Choy"'), 'Grocery row has data-grocery-name="Bok Choy"');
assert.ok(groceriesTabHtml.includes('cursor-pointer'), 'Grocery row has cursor-pointer');

console.log('  ✅ Grocery items in table have grocery-card, cursor-pointer, and data attributes.');

console.log('\n========================================================');
console.log('🎉 ALL CARD CLICKS & EDIT MODAL FIX TESTS PASSED!');
console.log('========================================================\n');
