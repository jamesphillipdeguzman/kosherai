// Comprehensive Test Suite for Six-Week Food Cost & Waste Tracking System
// Runs on Node.js to validate calculations, weekly calendars, double-counting safeguards, and CSV exports

import assert from 'node:assert';

// Mock localStorage for Node testing environment
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Import storage service
import {
  PROJECT_CONFIG,
  getProjectWeekSchedule,
  getProjectWeekForDate,
  getCourseConfig,
  saveCourseConfig,
  saveShoppingTrip,
  getShoppingTrips,
  getGroceryItems,
  getExpenses,
  deleteShoppingTrip,
  detectDuplicateReceipt,
  saveFoodWasteRecord,
  getFoodWasteRecords,
  getSixWeekComparison,
  saveMealPlan,
  getMealPlans,
  exportAllCourseCsvs,
  triggerCsvDownload,
  handleExportWeeklySummary,
  handleExportShoppingTrips,
  handleExportItemizedGroceries,
  handleExportFoodWaste,
  hasCourseData,
  EMPTY_EXPORT_MESSAGE
} from '../src/services/courseProjectStorage.js';

import { renderCourseProjectView, handleDownloadClick } from '../src/components/CourseProjectView.js';

console.log('🧪 Starting KosherAI Six-Week Project Test Suite...\n');

// ----------------------------------------------------
// Test 1: Project Week Calendar Schedule
// ----------------------------------------------------
console.log('Test 1: Project calendar schedule starting Saturday, Oct 31, 2026');
const schedule = getProjectWeekSchedule('2026-10-31');
assert.strictEqual(schedule.length, 6, 'Schedule must contain exactly 6 weeks');

assert.strictEqual(schedule[0].weekNumber, 1);
assert.strictEqual(schedule[0].startDate, '2026-10-31', 'Week 1 starts on Oct 31, 2026');
assert.strictEqual(schedule[0].endDate, '2026-11-06', 'Week 1 ends on Nov 6, 2026');
assert.strictEqual(schedule[0].isBaseline, true, 'Week 1 is Baseline');

assert.strictEqual(schedule[1].weekNumber, 2);
assert.strictEqual(schedule[1].startDate, '2026-11-07', 'Week 2 starts on Nov 7, 2026');
assert.strictEqual(schedule[1].endDate, '2026-11-13', 'Week 2 ends on Nov 13, 2026');
assert.strictEqual(schedule[1].isIntervention, true, 'Week 2 is Intervention');

assert.strictEqual(schedule[5].weekNumber, 6);
assert.strictEqual(schedule[5].startDate, '2026-12-05', 'Week 6 starts on Dec 5, 2026');
assert.strictEqual(schedule[5].endDate, '2026-12-11', 'Week 6 ends on Dec 11, 2026');
console.log('  ✅ 6-Week schedule successfully matches project specifications.');

// ----------------------------------------------------
// Test 2: Date-to-Week Resolution
// ----------------------------------------------------
console.log('\nTest 2: Date-to-week resolution');
assert.strictEqual(getProjectWeekForDate('2026-10-31'), 1, 'Oct 31 is Week 1');
assert.strictEqual(getProjectWeekForDate('2026-11-03'), 1, 'Nov 3 is Week 1');
assert.strictEqual(getProjectWeekForDate('2026-11-06'), 1, 'Nov 6 is Week 1');
assert.strictEqual(getProjectWeekForDate('2026-11-07'), 2, 'Nov 7 is Week 2');
assert.strictEqual(getProjectWeekForDate('2026-11-13'), 2, 'Nov 13 is Week 2');
assert.strictEqual(getProjectWeekForDate('2026-11-14'), 3, 'Nov 14 is Week 3');
assert.strictEqual(getProjectWeekForDate('2026-12-05'), 6, 'Dec 5 is Week 6');
console.log('  ✅ Date-to-week boundary mappings are strictly verified.');

// ----------------------------------------------------
// Test 3: Whole-Grocery Scale Weight vs Item Line Weights
// ----------------------------------------------------
console.log('\nTest 3: Whole-grocery scale weight recording');
localStorage.clear();

const trip1 = await saveShoppingTrip({
  storeName: 'SM Supermarket',
  date: '2026-10-31',
  tripType: 'Supermarket',
  totalScaleWeightKg: 6.45, // Whole grocery physical scale weight
  totalAmountPaid: 2150.00
}, [
  { name: 'Fresh Chicken Breast', quantity: 1, unit: 'kg', unitPrice: 320, totalPrice: 320, weightGrams: 1000 },
  { name: 'Sayote', quantity: 3, unit: 'pcs', unitPrice: 25, totalPrice: 75, weightGrams: 850 },
  { name: 'Pure Non-Iodized Kosher Salt', quantity: 1, unit: 'box', unitPrice: 185, totalPrice: 185 }
]);

const savedTrips = getShoppingTrips();
assert.strictEqual(savedTrips.length, 1);
assert.strictEqual(savedTrips[0].totalScaleWeightKg, 6.45, 'Whole grocery scale weight preserved');
assert.strictEqual(savedTrips[0].totalAmountPaid, 2150.00);

const savedItems = getGroceryItems(savedTrips[0].id);
assert.strictEqual(savedItems.length, 3, 'Exactly 3 grocery items linked to trip');
console.log('  ✅ Whole grocery scale weight (6.45 kg) stored distinct from item weights.');

// ----------------------------------------------------
// Test 4: Strict Double-Counting Safeguard
// ----------------------------------------------------
console.log('\nTest 4: Strict double-counting safeguard');
const allExpenses = getExpenses();
assert.strictEqual(allExpenses.length, 1, 'Only ONE expense record created for the whole trip');
assert.strictEqual(allExpenses[0].amount, 2150.00, 'Expense amount matches trip final total paid');
assert.strictEqual(allExpenses[0].isTripExpense, true);

// Verify total expenses do NOT include item totals (which would be 2150 + 580 = 2730)
const totalExpensesAmount = allExpenses.reduce((sum, e) => sum + e.amount, 0);
assert.strictEqual(totalExpensesAmount, 2150.00, 'Expenses count trip total exactly ONCE');
console.log('  ✅ Double-counting strictly prevented: trip total counted once; items are inventory-only.');

// ----------------------------------------------------
// Test 5: Duplicate Receipt Detection
// ----------------------------------------------------
console.log('\nTest 5: Duplicate receipt detection');
const dup1 = detectDuplicateReceipt('SM Supermarket', '2026-10-31', 2150.00);
assert.ok(dup1, 'Should detect duplicate with same store, date, and amount');

const nonDup = detectDuplicateReceipt('Puregold', '2026-11-01', 500.00);
assert.strictEqual(nonDup, undefined, 'Different store/date should not be flagged');
console.log('  ✅ Duplicate detection correctly flags matching receipts.');

// ----------------------------------------------------
// Test 6: Food Waste Tracking & Isolation from Expenses
// ----------------------------------------------------
console.log('\nTest 6: Food waste logging & expense isolation');
saveFoodWasteRecord({
  itemName: 'Spoiled leafy greens',
  date: '2026-11-04',
  measuredWeightG: 180, // 180 grams on scale
  isEstimated: false,
  estimatedCost: 35.00,
  reason: 'Spoiled / Molded'
});

const wasteRecords = getFoodWasteRecords();
assert.strictEqual(wasteRecords.length, 1);
assert.strictEqual(wasteRecords[0].measuredWeightG, 180);
assert.strictEqual(wasteRecords[0].estimatedCost, 35.00);

// Crucial: verify food waste cost is NOT in expenses table
const expensesAfterWaste = getExpenses();
assert.strictEqual(expensesAfterWaste.length, 1, 'Expenses count unchanged after logging waste');
assert.strictEqual(expensesAfterWaste[0].amount, 2150.00, 'Food expense total untouched by waste cost');
console.log('  ✅ Food waste cost is strictly isolated from household expense totals.');

// ----------------------------------------------------
// Test 7: Six-Week Comparative Analytics (Week 1 Baseline vs Weeks 2-6)
// ----------------------------------------------------
console.log('\nTest 7: Six-week comparative analytics & baseline variance');

// Add a Week 2 shopping trip (Intervention)
await saveShoppingTrip({
  storeName: 'Puregold',
  date: '2026-11-08', // Week 2
  totalScaleWeightKg: 5.80,
  totalAmountPaid: 1650.00 // Lower than Week 1 (2150 - 1650 = 500 savings)
}, []);

// Add Week 2 food waste (reduced waste)
saveFoodWasteRecord({
  itemName: 'Plate leftover rice',
  date: '2026-11-10', // Week 2
  measuredWeightG: 60, // 60 grams vs 180 grams in Week 1
  isEstimated: false,
  estimatedCost: 10.00,
  reason: 'Cooked Excess'
});

const comparison = getSixWeekComparison();
assert.strictEqual(comparison.weeklyData.length, 6);

const w1 = comparison.weeklyData[0];
const w2 = comparison.weeklyData[1];

assert.strictEqual(w1.weekNumber, 1);
assert.strictEqual(w1.totalExpense, 2150.00);
assert.strictEqual(w1.totalWasteGrams, 180);

assert.strictEqual(w2.weekNumber, 2);
assert.strictEqual(w2.totalExpense, 1650.00);
assert.strictEqual(w2.totalWasteGrams, 60);

// Savings vs Week 1 Baseline: 2150 - 1650 = 500.00
assert.strictEqual(w2.savingsVsBaseline, 500.00, 'Week 2 savings vs baseline is ₱500.00');
const expectedPct = ((2150 - 1650) / 2150) * 100;
assert.ok(Math.abs(w2.savingsPercent - expectedPct) < 0.01, 'Week 2 savings % calculated correctly');

// Waste reduction: 0.180 kg - 0.060 kg = 0.120 kg
assert.ok(Math.abs(w2.wasteReductionVsBaselineKg - 0.12) < 0.001, 'Waste reduction vs baseline is 0.12 kg');
console.log('  ✅ Comparative metrics, baseline differences, and savings calculate accurately.');

// ----------------------------------------------------
// Test 8: CSV Export Generator
// ----------------------------------------------------
console.log('\nTest 8: CSV export generator validation');
const csvs = exportAllCourseCsvs();

assert.ok(csvs.summaryCsv.includes('Project Week,Phase,Date Range'), 'Summary CSV has proper headers');
assert.ok(csvs.summaryCsv.includes('Week 1'), 'Summary CSV contains Week 1 data');
assert.ok(csvs.summaryCsv.includes('Week 2'), 'Summary CSV contains Week 2 data');

assert.ok(csvs.tripsCsv.includes('Trip ID,Purchase Date,Project Week,Store Name'), 'Trips CSV has proper headers');
assert.ok(csvs.tripsCsv.includes('Whole Grocery Scale Weight (kg)'), 'Trips CSV includes whole grocery scale weight');
assert.ok(csvs.tripsCsv.includes('SM Supermarket'), 'Trips CSV contains SM Supermarket');

assert.ok(csvs.itemsCsv.includes('Item ID,Trip ID,Purchase Date,Project Week'), 'Items CSV has proper headers');
assert.ok(csvs.itemsCsv.includes('Fresh Chicken Breast'), 'Items CSV includes line item');

assert.ok(csvs.wasteCsv.includes('Waste ID,Date Discarded,Project Week,Food Item'), 'Waste CSV has proper headers');
assert.ok(csvs.wasteCsv.includes('Spoiled leafy greens'), 'Waste CSV includes discarded item');
console.log('  ✅ All 4 CSV export structures and contents formatted validly for academic reporting.');

// ----------------------------------------------------
// Test 9: Active State Fallback, Toast Notifications & Export Card Bindings
// ----------------------------------------------------
console.log('\nTest 9: Active state fallback, empty notification, and export card bindings');

// 9a: Fallback to active React/cloud state when localStorage is empty
localStorage.clear();
assert.strictEqual(getShoppingTrips().length, 0, 'LocalStorage trips must be empty');

const mockActiveState = {
  trips: [
    {
      id: 'active-trip-1',
      date: '2026-11-01',
      projectWeek: 1,
      storeName: 'Robinsons Supermarket',
      tripType: 'Supermarket',
      totalScaleWeightKg: 5.2,
      totalAmountPaid: 1850.00,
      itemsCount: 1,
      notes: 'Active in-memory state'
    }
  ],
  groceryItems: [
    {
      id: 'active-item-1',
      tripId: 'active-trip-1',
      purchaseDate: '2026-11-01',
      projectWeek: 1,
      name: 'Lean Beef Sirloin',
      quantity: 1,
      unit: 'kg',
      unitPrice: 420,
      totalPrice: 420,
      weightGrams: 1000,
      lidStatus: 'SAFE',
      category: 'Fresh Meat'
    }
  ]
};

const activeCsvs = exportAllCourseCsvs(mockActiveState);
assert.ok(activeCsvs.tripsCsv.includes('Robinsons Supermarket'), 'Export falls back to activeState trips when localStorage is empty');
assert.ok(activeCsvs.itemsCsv.includes('Lean Beef Sirloin'), 'Export falls back to activeState groceryItems when localStorage is empty');
assert.strictEqual(hasCourseData(mockActiveState), true, 'hasCourseData returns true for activeState');

// 9b: When both localStorage and activeState are empty, warning is triggered and no silent failure
const emptyState = { trips: [], groceryItems: [], foodWaste: [] };
assert.strictEqual(hasCourseData(emptyState), false, 'hasCourseData returns false when completely empty');
assert.strictEqual(handleExportWeeklySummary(emptyState), false, 'Weekly summary returns false when empty');
assert.strictEqual(handleExportShoppingTrips(emptyState), false, 'Shopping trips returns false when empty');
assert.strictEqual(handleExportItemizedGroceries(emptyState), false, 'Itemized groceries returns false when empty');
assert.strictEqual(EMPTY_EXPORT_MESSAGE, "No records available to export. Please record a trip or restore from Neon first.");

// 9c: UI Card bindings & styling in renderCourseProjectView export tab
const exportTabHtml = renderCourseProjectView({ courseSubTab: 'export' });
assert.ok(exportTabHtml.includes('cursor-pointer hover:border-emerald-500 transition-all'), 'Export cards have cursor-pointer and hover:border-emerald-500 styling');
assert.ok(exportTabHtml.includes('handleExportWeeklySummary'), 'Card 1 is wired to handleExportWeeklySummary');
assert.ok(exportTabHtml.includes('handleExportShoppingTrips'), 'Card 2 is wired to handleExportShoppingTrips');
assert.ok(exportTabHtml.includes('handleExportItemizedGroceries'), 'Card 3 is wired to handleExportItemizedGroceries');
assert.ok(exportTabHtml.includes('Download CSV'), 'Cards have explicit Download CSV buttons');

// 9d: handleDownloadClick prevents event bubbling and runs callback exactly once
let stopped = false;
let exportRanCount = 0;
const mockEvent = {
  stopPropagation: () => { stopped = true; },
  preventDefault: () => {}
};
handleDownloadClick(mockEvent, () => { exportRanCount++; });
assert.strictEqual(stopped, true, 'handleDownloadClick calls stopPropagation()');
assert.strictEqual(exportRanCount, 1, 'handleDownloadClick executes callback exactly once');
assert.ok(exportTabHtml.includes('handleDownloadClick'), 'Export buttons use handleDownloadClick to stop event bubbling');
assert.ok(exportTabHtml.includes('w-5 h-5 flex-shrink-0 mr-2'), 'Download SVG icon uses standard compact dimensions');

// 9e: Course Sub-Tab Navigation Pill styling for light and dark modes
assert.ok(exportTabHtml.includes('bg-white border border-slate-200 text-slate-700'), 'Inactive subnav tabs have light mode styling');
assert.ok(exportTabHtml.includes('dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300'), 'Inactive subnav tabs have dark mode styling');
assert.ok(exportTabHtml.includes('bg-emerald-600 text-white font-bold border border-emerald-600 shadow-sm'), 'Active subnav tab has emerald styling');
assert.ok(exportTabHtml.includes('text-xs font-semibold'), 'Subnav tabs have proportional text-xs font-semibold sizing');

console.log('  ✅ Active state fallback, empty export handling, and card click bindings verified.');

console.log('\n=========================================');
console.log('🎉 ALL 9 TEST SUITES PASSED SUCCESSFULLY!');
console.log('=========================================');
