// Dynamic Project Start Date & Weekly Schedule Test Suite
import assert from 'node:assert';
import {
  PROJECT_CONFIG,
  getCourseConfig,
  saveCourseConfig,
  getProjectWeekSchedule,
  getProjectWeekForDate,
  formatProjectDateDisplay,
  getWeeklyCycleLabel,
  getSixWeekComparison,
  saveShoppingTrip,
  getShoppingTrips,
  saveFoodWasteRecord
} from '../src/services/courseProjectStorage.js';
import { renderCourseProjectView } from '../src/components/CourseProjectView.js';

console.log('🧪 Starting Dynamic Project Start Date Test Suite...\n');

// Setup mock localStorage
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

// 1. Default date used only when no saved configuration exists
console.log('Test 1: Default start date (2026-10-31) when no saved config exists');
{
  localStorage.clear();
  const cfg = getCourseConfig();
  assert.strictEqual(cfg.startDate, PROJECT_CONFIG.START_DATE);
  assert.strictEqual(formatProjectDateDisplay(cfg.startDate), 'Oct 31, 2026');
  assert.strictEqual(getWeeklyCycleLabel(cfg.startDate), 'Sat – Fri Weekly Cycle');
}
console.log('  ✅ Default config verified.');

// 2. Save Nov 7, 2026 -> Week 1 Nov 7–13, Week 2 Nov 14–20 & persistence across reload
console.log('\nTest 2: Save 2026-11-07 and verify 6-week schedule + persistence');
{
  saveCourseConfig({ startDate: '2026-11-07', baselineBudget: 4200 });
  const reloaded = getCourseConfig();
  assert.strictEqual(reloaded.startDate, '2026-11-07', 'Saved startDate must persist');

  const schedule = getProjectWeekSchedule(reloaded.startDate);
  assert.strictEqual(schedule.length, 6);
  assert.strictEqual(schedule[0].startDate, '2026-11-07');
  assert.strictEqual(schedule[0].endDate, '2026-11-13');
  assert.strictEqual(schedule[0].shortRange, 'Nov 7 – Nov 13');
  assert.strictEqual(schedule[1].startDate, '2026-11-14');
  assert.strictEqual(schedule[1].endDate, '2026-11-20');
  assert.strictEqual(schedule[1].shortRange, 'Nov 14 – Nov 20');
  assert.strictEqual(schedule[5].startDate, '2026-12-12');
  assert.strictEqual(schedule[5].endDate, '2026-12-18');
}
console.log('  ✅ Nov 7 schedule and reload persistence verified.');

// 3. Different starting weekday -> Weekly Cycle label updates dynamically
console.log('\nTest 3: Different starting weekday updates Weekly Cycle label');
{
  // 2026-11-02 is a Monday
  assert.strictEqual(getWeeklyCycleLabel('2026-11-02'), 'Mon – Sun Weekly Cycle');
  // 2026-11-04 is a Wednesday
  assert.strictEqual(getWeeklyCycleLabel('2026-11-04'), 'Wed – Tue Weekly Cycle');
}
console.log('  ✅ Dynamic Weekly Cycle weekday labels verified.');

// 4. Dashboard HTML updates Project Start, W1-W6 tabs, Baseline card, and Trajectory DATES
console.log('\nTest 4: CourseProjectView reflects saved startDate across all dashboard sections');
{
  saveCourseConfig({ startDate: '2026-11-07' });
  const html = renderCourseProjectView({ courseSubTab: 'dashboard' });
  assert.ok(html.includes('Nov 7, 2026'), 'PROJECT START card must display Nov 7, 2026');
  assert.ok(!html.includes('>Oct 31, 2026<'), 'Hardcoded Oct 31, 2026 must not appear in PROJECT START card');
  assert.ok(html.includes('Nov 7 – Nov 13'), 'Week 1 range must appear in tabs, baseline card, and trajectory');
  assert.ok(html.includes('Nov 14 – Nov 20'), 'Week 2 range must appear in tabs and trajectory');
  assert.ok(html.includes('Dec 12 – Dec 18'), 'Week 6 range must appear in tabs and trajectory');
}
console.log('  ✅ Dashboard UI date synchronization verified.');

// 5. Existing trips and waste logs regrouped into recalculated weeks
console.log('\nTest 5: Existing trips and waste logs regroup when startDate changes');
{
  // Save records while startDate is 2026-10-31 (2026-11-07 is Week 2 under Oct 31)
  localStorage.clear();
  saveCourseConfig({ startDate: '2026-10-31' });
  await saveShoppingTrip({
    id: 'trip_regroup_1',
    date: '2026-11-07',
    storeName: 'SM Hypermarket',
    totalAmountPaid: 1500,
    totalScaleWeightKg: 3.2
  });
  await saveFoodWasteRecord({
    id: 'waste_regroup_1',
    date: '2026-11-15',
    itemName: 'Spinach stems',
    measuredWeightG: 200,
    estimatedCost: 40
  });

  let compOct = getSixWeekComparison();
  assert.strictEqual(compOct.weeklyData[1].tripsCount, 1, 'Under Oct 31, Nov 7 trip is in Week 2');
  assert.strictEqual(compOct.weeklyData[2].wasteEntriesCount, 1, 'Under Oct 31, Nov 15 waste is in Week 3');

  // Change startDate to 2026-11-07 -> Nov 7 becomes Week 1, Nov 15 becomes Week 2
  saveCourseConfig({ startDate: '2026-11-07' });
  let compNov = getSixWeekComparison();
  assert.strictEqual(compNov.weeklyData[0].tripsCount, 1, 'Under Nov 7, Nov 7 trip must regroup to Week 1');
  assert.strictEqual(compNov.weeklyData[1].tripsCount, 0, 'Under Nov 7, Week 2 must have 0 trips');
  assert.strictEqual(compNov.weeklyData[1].wasteEntriesCount, 1, 'Under Nov 7, Nov 15 waste must regroup to Week 2');

  const storedTrips = getShoppingTrips();
  assert.strictEqual(storedTrips[0].projectWeek, 1, 'Stored trip projectWeek updated to 1');
}
console.log('  ✅ Record regrouping on startDate change verified.');

// 6. Leap-year & year boundary transitions (timezone-safe local parsing)
console.log('\nTest 6: Leap-year and year boundary date transitions');
{
  const leapSchedule = getProjectWeekSchedule('2024-02-26');
  assert.strictEqual(leapSchedule[0].startDate, '2024-02-26');
  assert.strictEqual(leapSchedule[0].endDate, '2024-03-03'); // Includes Feb 29, 2024
  assert.strictEqual(getProjectWeekForDate('2024-02-29', '2024-02-26'), 1);

  const yearEndSchedule = getProjectWeekSchedule('2026-12-28');
  assert.strictEqual(yearEndSchedule[0].startDate, '2026-12-28');
  assert.strictEqual(yearEndSchedule[0].endDate, '2027-01-03');
  assert.strictEqual(getProjectWeekForDate('2027-01-01', '2026-12-28'), 1);
}
console.log('  ✅ Leap-year and year-end transitions verified.');

console.log('\n🎉 ALL DYNAMIC PROJECT START DATE TESTS PASSED!');
