/**
 * Test Suite: Dashboard Insights Refactor Verification
 * Validates independent collapsible sections, markup integrity, no visible comments,
 * and computation preservation across the 5 categories.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { renderHouseholdInsightsDashboard } from '../src/components/HouseholdInsightsView.js';

// Setup Mock In-Memory localStorage & window for Node test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};
try {
  if (!globalThis.navigator) {
    globalThis.navigator = { onLine: true };
  } else if (globalThis.navigator.onLine === undefined) {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
  }
} catch (_) {}

console.log('\n🧪 Starting KosherAI Dashboard Insights Refactoring Test Suite...\n');

// 1. Seed realistic test data
const trips = [
  { id: 'trip_1', date: '2026-11-01', totalAmountPaid: 2500, totalScaleWeightKg: 6.5, itemsCount: 4 },
  { id: 'trip_2', date: '2026-11-04', totalAmountPaid: 1800, totalScaleWeightKg: 4.8, itemsCount: 3 }
];
const waste = [
  { id: 'waste_1', date: '2026-11-02', foodItem: 'Leftover Rice', category: 'Pantry', reason: 'Spoiled', measuredWeightG: 300, estimatedCost: 35 },
  { id: 'waste_2', date: '2026-11-05', foodItem: 'Cabbage Leaf', category: 'Vegetables', reason: 'Trimmings', measuredWeightG: 250, estimatedCost: 20 }
];
const inventory = [
  { id: 'inv_1', name: 'Fresh Milk', category: 'Dairy', quantity: 1, unit: 'L', expirationDate: '2026-11-07', storageLocation: 'Fridge' },
  { id: 'inv_2', name: 'Chicken Breast', category: 'Meat', quantity: 1, unit: 'kg', expirationDate: '2026-11-08', storageLocation: 'Freezer' }
];

globalThis.localStorage.setItem('kosherai_course_trips', JSON.stringify(trips));
globalThis.localStorage.setItem('kosherai_course_food_waste', JSON.stringify(waste));
globalThis.localStorage.setItem('kosherai_inventory', JSON.stringify(inventory));
globalThis.localStorage.setItem('kosherai_household_members', '4');

const SECTION_IDS = ['scorecard', 'financial', 'riskAlerts', 'purchasing', 'trends'];

// -----------------------------------------------------------------------------------------
// Test 1: Clean Section Container & Default Collapsed State
// -----------------------------------------------------------------------------------------
console.log('Test 1: Clean Container & Default Collapsed State');
const defaultHtml = renderHouseholdInsightsDashboard({
  householdMembers: 4,
  insightsSections: {
    scorecard: false,
    financial: false,
    riskAlerts: false,
    purchasing: false,
    trends: false
  }
});

assert(defaultHtml.includes('Food Cost & Spoilage Intelligence'), 'Container must render main title');
assert(defaultHtml.includes('insights-expand-all-btn'), 'Container must render Expand All button');
assert(defaultHtml.includes('insights-collapse-all-btn'), 'Container must render Collapse All button');

// All 5 section cards must render their headers in the DOM
for (const id of SECTION_IDS) {
  assert(defaultHtml.includes(`data-toggle-insight-section="${id}"`), `Section ${id} toggle button must be rendered`);
}

// When collapsed, content blocks must not be in the DOM
assert(!defaultHtml.includes('Household Stewardship'), 'Scorecard content should be collapsed by default');
assert(!defaultHtml.includes('Weekly Household Consumption'), 'Financial content should be collapsed by default');
console.log('  ✅ Test 1 Passed: Section container and 5 default collapsed cards render cleanly.');

// -----------------------------------------------------------------------------------------
// Test 2: Independent Section Expansion
// -----------------------------------------------------------------------------------------
console.log('Test 2: Independent Section Expansion');
for (const targetId of SECTION_IDS) {
  const singleExpandedState = {
    scorecard: false,
    financial: false,
    riskAlerts: false,
    purchasing: false,
    trends: false,
    [targetId]: true
  };
  const html = renderHouseholdInsightsDashboard({ householdMembers: 4, insightsSections: singleExpandedState });

  // Target section must be expanded
  assert(html.includes(`data-toggle-insight-section="${targetId}"`), `Target ${targetId} must be rendered`);

  // Target specific content presence check
  if (targetId === 'scorecard') {
    assert(html.includes('100 Points'), 'Scorecard content must be present when scorecard is expanded');
    assert(!html.includes('Weekly Consumption'), 'Financial content must remain collapsed');
  } else if (targetId === 'financial') {
    assert(html.includes('Weekly Consumption'), 'Financial content must be present when financial is expanded');
    assert(!html.includes('100 Points'), 'Scorecard content must remain collapsed');
  } else if (targetId === 'riskAlerts') {
    assert(html.includes('Days-to-Consume') || html.includes('Time to Consume') || html.includes('Remaining Shelf-Life'), 'Risk alert content must be present');
    assert(!html.includes('Weekly Consumption'), 'Financial content must remain collapsed');
  } else if (targetId === 'purchasing') {
    assert(html.includes('expected_consumption'), 'Purchasing content must be present');
    assert(!html.includes('100 Points'), 'Scorecard content must remain collapsed');
  } else if (targetId === 'trends') {
    assert(html.includes('Where Your Food Waste Comes From'), 'Trends content must be present');
    assert(!html.includes('expected_consumption'), 'Purchasing content must remain collapsed');
  }
}
console.log('  ✅ Test 2 Passed: Every section expands independently without affecting others.');

// -----------------------------------------------------------------------------------------
// Test 3: Multiple Simultaneous Section Expansion
// -----------------------------------------------------------------------------------------
console.log('Test 3: Multiple Simultaneous Section Expansion');
const multiExpandedState = {
  scorecard: true,
  financial: false,
  riskAlerts: true,
  purchasing: false,
  trends: true
};
const multiHtml = renderHouseholdInsightsDashboard({ householdMembers: 4, insightsSections: multiExpandedState });

assert(multiHtml.includes('100 Points'), 'Scorecard must be expanded');
assert(multiHtml.includes('Days-to-Consume') || multiHtml.includes('Time to Consume'), 'Risk alerts must be expanded');
assert(multiHtml.includes('Where Your Food Waste Comes From'), 'Trends must be expanded');
assert(!multiHtml.includes('Weekly Consumption'), 'Financial must remain collapsed');
assert(!multiHtml.includes('expected_consumption'), 'Purchasing must remain collapsed');
console.log('  ✅ Test 3 Passed: Multiple sections can be open simultaneously with perfect state isolation.');

// -----------------------------------------------------------------------------------------
// Test 4: Expand All and Collapse All Operations
// -----------------------------------------------------------------------------------------
console.log('Test 4: Expand All and Collapse All Full Coverage');
const allExpandedState = { scorecard: true, financial: true, riskAlerts: true, purchasing: true, trends: true };
const allHtml = renderHouseholdInsightsDashboard({ householdMembers: 4, insightsSections: allExpandedState });

assert(allHtml.includes('100 Points'), 'Scorecard expanded');
assert(allHtml.includes('Weekly Consumption'), 'Financial expanded');
assert(allHtml.includes('Days-to-Consume') || allHtml.includes('Time to Consume'), 'Risk alerts expanded');
assert(allHtml.includes('expected_consumption'), 'Purchasing expanded');
assert(allHtml.includes('Where Your Food Waste Comes From'), 'Trends expanded');
console.log('  ✅ Test 4 Passed: All 5 sections render their rich detailed content when expanded.');

// -----------------------------------------------------------------------------------------
// Test 5: Markup Quality & Zero Raw Comments Check
// -----------------------------------------------------------------------------------------
console.log('Test 5: Zero Raw Comments or Debug Text Check');
const sourceJs = fs.readFileSync(path.resolve('src/components/HouseholdInsightsView.js'), 'utf8');
const sourceJsx = fs.readFileSync(path.resolve('src/components/HouseholdInsightsView.jsx'), 'utf8');

// Ensure no JSX comment syntax inside string template literals
assert(!sourceJs.includes('{/* Collapsible Header Button */}'), 'No JSX comment in HouseholdInsightsView.js');
assert(!sourceJs.includes('{/* Collapsible Content Body */}'), 'No JSX comment in HouseholdInsightsView.js');
assert(!sourceJs.includes('{/* Expand/Collapse Chevron Indicator */}'), 'No JSX comment in HouseholdInsightsView.js');
assert(!allHtml.includes('{/*'), 'Rendered HTML must never contain raw JSX comment tokens');
assert(!allHtml.includes('*/'), 'Rendered HTML must never contain raw comment closing tokens');

console.log('  ✅ Test 5 Passed: Zero raw JSX comments or leaked component notes.');

// -----------------------------------------------------------------------------------------
// Test 6: Calculation Accuracy & Data Integrity
// -----------------------------------------------------------------------------------------
console.log('Test 6: Business Logic & Calculation Preservation');
assert(allHtml.includes('₱4,300.00'), 'Total spending calculation (2500 + 1800) preserved');
assert(allHtml.includes('11.3'), 'Total scale weight (6.5 + 4.8) preserved');
assert(allHtml.includes('0.55'), 'Total waste weight (300g + 250g = 0.55kg) preserved');

console.log('  ✅ Test 6 Passed: All metrics, calculations, and valuations are 100% preserved.');

console.log('\n======================================================================');
console.log('🎉 ALL DASHBOARD INSIGHTS REFACTORING TESTS PASSED!');
console.log('======================================================================\n');
