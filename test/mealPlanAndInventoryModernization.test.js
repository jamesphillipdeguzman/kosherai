/**
 * KosherAI - Meal Plan & Inventory UI Modernization Test Suite
 * Tests acceptance criteria for:
 * 1. Add Inventory button dark mode text contrast & icon visibility
 * 2. Modernized top action buttons (Add Inventory vs Plan a Meal)
 * 3. Modernized week selector pills with active emerald accent and non-color indicator
 * 4. Modernized 7-day meal schedule cards, day badges, meal type pills, compliance tags
 * 5. Modernized destructive Remove buttons with rose styling and icon
 * 6. Responsive layout, mobile wrapping, and empty day placeholders
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup Mock LocalStorage
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Import view renderer
import { renderSmartMealPlanner } from '../src/components/SmartMealPlanningView.js';

console.log('🧪 Starting Meal Plan & Inventory Modernization Test Suite...\n');

// Load CSS file
const styleCss = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf-8');
const mainJs = fs.readFileSync(path.resolve(__dirname, '../src/main.js'), 'utf-8');

// =========================================================================
// Test 1: Add Inventory Button Dark Mode Text Contrast & Styling
// =========================================================================
console.log('--- Section 1: Add Inventory Button Dark Mode Contrast & Styling ---');
{
  const html = renderSmartMealPlanner({ mealPlanWeek: 2 });

  // 1.1 Button ID preserved
  assert.ok(html.includes('id="open-inventory-modal-btn"'), 'Must preserve #open-inventory-modal-btn ID');

  // 1.2 Text contrast in dark mode
  assert.ok(
    html.includes('dark:text-slate-100') || html.includes('dark:text-white'),
    '#open-inventory-modal-btn must have explicit light text in dark mode (dark:text-slate-100 or dark:text-white)'
  );

  // 1.3 Icon visible
  assert.ok(html.includes('📦'), 'Must include inventory box icon');
  assert.ok(html.includes('Add Inventory'), 'Must include Add Inventory label');

  // 1.4 Dedicated CSS rules in style.css for dark mode contrast
  assert.ok(
    styleCss.includes('html.dark #open-inventory-modal-btn') || styleCss.includes('.btn-inventory-action'),
    'style.css must have dedicated dark mode CSS for #open-inventory-modal-btn'
  );
  assert.ok(
    styleCss.includes('#open-inventory-modal-btn:hover') || styleCss.includes('.btn-inventory-action:hover'),
    'style.css must define hover states for #open-inventory-modal-btn'
  );

  console.log('  ✅ Section 1 Passed: Add Inventory button has explicit dark mode text contrast, visible icon, and border.');
}

// =========================================================================
// Test 2: Modernized Top Action Buttons (Add Inventory vs Plan a Meal)
// =========================================================================
console.log('\n--- Section 2: Modernized Top Action Buttons Consistency & Ergonomics ---');
{
  const html = renderSmartMealPlanner({ mealPlanWeek: 2 });

  // 2.1 Both buttons exist
  assert.ok(html.includes('id="open-inventory-modal-btn"'), 'Add Inventory button present');
  assert.ok(html.includes('id="open-mealplan-modal-btn"'), 'Plan a Meal button present');

  // 2.2 Visual distinction: secondary vs primary
  assert.ok(
    html.includes('bg-slate-100') && (html.includes('dark:bg-slate-800') || html.includes('btn-inventory-action')),
    'Add Inventory must use subtle secondary slate background'
  );
  assert.ok(
    html.includes('bg-emerald-600') && html.includes('text-white'),
    'Plan a Meal must use primary emerald action background and white text'
  );

  // 2.3 Modern corners and comfortable padding
  assert.ok(html.includes('rounded-xl'), 'Action buttons must use rounded-xl modern corners');

  // 2.4 Container wrapping
  assert.ok(
    html.includes('mealplan-top-actions') || html.includes('flex-wrap'),
    'Top action bar must support flex-wrapping to prevent mobile crowding'
  );

  console.log('  ✅ Section 2 Passed: Top actions have clear visual distinction, modern corners, and responsive wrapping.');
}

// =========================================================================
// Test 3: Redesigned Week Selector Pills with Non-Color Indicators
// =========================================================================
console.log('\n--- Section 3: Redesigned Week Selector Buttons ---');
{
  const htmlWeek2 = renderSmartMealPlanner({ mealPlanWeek: 2 });
  const htmlWeek4 = renderSmartMealPlanner({ mealPlanWeek: 4 });

  // 3.1 All weeks present (2 through 6)
  for (let w = 2; w <= 6; w++) {
    assert.ok(htmlWeek2.includes(`data-mealplan-week="${w}"`), `Week ${w} selector must be present with data-mealplan-week="${w}"`);
  }

  // 3.2 Week labels preserved
  assert.ok(htmlWeek2.includes('Week 2 (Intervene)'), 'Week 2 must preserve "(Intervene)" indicator');
  assert.ok(htmlWeek2.includes('Week 3'), 'Week 3 label preserved');
  assert.ok(htmlWeek2.includes('Week 4'), 'Week 4 label preserved');

  // 3.3 Active week distinction
  assert.ok(htmlWeek2.includes('bg-emerald-600'), 'Active week must have emerald background');
  assert.ok(
    htmlWeek2.includes('mealplan-week-pill') || htmlWeek2.includes('rounded-xl'),
    'Week buttons must use modern pill styling'
  );

  // 3.4 Non-color indicator for active week (checkmark dot/badge)
  assert.ok(
    htmlWeek2.includes('✓') || htmlWeek2.includes('active') || htmlWeek2.includes('Currently Selected'),
    'Active week must have a clear visual non-color indicator (e.g. checkmark badge or active state)'
  );

  // 3.5 Horizontal scroll container
  assert.ok(
    htmlWeek2.includes('overflow-x-auto'),
    'Week selector container must be horizontally scrollable on mobile'
  );
  assert.ok(
    htmlWeek2.includes('flex-shrink-0') || styleCss.includes('.mealplan-week-pill'),
    'Week buttons must not shrink or clip on mobile'
  );

  console.log('  ✅ Section 3 Passed: Week selector pills modern, scrollable, and active week recognizable without color alone.');
}

// =========================================================================
// Test 4: Modern Daily Meal Schedule Cards & Empty Slot Styling
// =========================================================================
console.log('\n--- Section 4: Modern Daily Meal Schedule Cards ---');
{
  // Setup sample mock meal plan in Week 2
  const samplePlans = [
    {
      id: 'meal_test_1',
      projectWeek: 2,
      dayOfWeek: 'Saturday',
      mealType: 'Dinner',
      dishName: 'LID Chicken Tinola',
      lidVerified: true
    },
    {
      id: 'meal_test_2',
      projectWeek: 2,
      dayOfWeek: 'Monday',
      mealType: 'Lunch',
      dishName: 'LID Sinigang Na Isda',
      lidVerified: true
    }
  ];
  localStorage.setItem('kosherai_course_meal_plans', JSON.stringify(samplePlans));

  const html = renderSmartMealPlanner({ mealPlanWeek: 2, activeDiet: 'lid' });

  // 4.1 Distinct day card surface
  assert.ok(
    html.includes('mealplan-day-column') || html.includes('rounded-2xl'),
    'Each day must have a distinct rounded card surface'
  );

  // 4.2 Day badge
  assert.ok(html.includes('Saturday'), 'Saturday present');
  assert.ok(html.includes('Sunday'), 'Sunday present');

  // 4.3 Planned meal cards
  assert.ok(html.includes('LID Chicken Tinola'), 'Planned dish name rendered');
  assert.ok(html.includes('Dinner'), 'Meal type rendered');
  assert.ok(html.includes('LID Sinigang Na Isda'), 'Monday dish rendered');

  // 4.4 Compliance tag preserved
  assert.ok(html.includes('Compliant') || html.includes('LID'), 'Dietary compliance indicator preserved');

  // 4.5 Empty day styling & quick plan action
  assert.ok(
    html.includes('quick-plan-day-btn') || html.includes('data-plan-day'),
    'Empty days must render a styled quick Plan button'
  );
  assert.ok(html.includes('No meals planned') || html.includes('Empty'), 'Empty day placeholder text rendered');

  console.log('  ✅ Section 4 Passed: Daily meal schedule structured as modern cards with day badges, meal type tags, and quick plan actions.');
}

// =========================================================================
// Test 5: Modern Destructive Remove Buttons
// =========================================================================
console.log('\n--- Section 5: Modernized Destructive Remove Buttons ---');
{
  const html = renderSmartMealPlanner({ mealPlanWeek: 2 });

  // 5.1 Remove button exists with correct data attribute
  assert.ok(html.includes('data-delete-meal="meal_test_1"'), 'Remove button must have data-delete-meal attribute');
  assert.ok(html.includes('delete-meal-btn'), 'Remove button must retain delete-meal-btn class for click handling');

  // 5.2 Destructive rose styling in markup
  assert.ok(
    html.includes('text-rose-700') || html.includes('text-rose-300') || html.includes('bg-rose-50'),
    'Remove button must use subtle rose styling'
  );

  // 5.3 Remove icon
  assert.ok(
    html.includes('🗑️') || html.includes('✕'),
    'Remove button must include a clear removal icon'
  );

  // 5.4 Dedicated CSS in style.css for light and dark modes
  assert.ok(styleCss.includes('.delete-meal-btn'), 'style.css must have dedicated .delete-meal-btn rules');
  assert.ok(
    styleCss.includes('html.dark .delete-meal-btn') || styleCss.includes(':root:not(.light) .delete-meal-btn'),
    'style.css must have dark mode rules for .delete-meal-btn'
  );

  console.log('  ✅ Section 5 Passed: Remove buttons styled with modern destructive rose appearance and icon.');
}

// =========================================================================
// Test 6: Event Listener Wiring & Functional Preservation
// =========================================================================
console.log('\n--- Section 6: Functional Preservation & Event Listener Wiring ---');
{
  // 6.1 main.js binds [data-mealplan-week]
  assert.ok(mainJs.includes('[data-mealplan-week]'), 'main.js must listen for [data-mealplan-week] clicks');

  // 6.2 main.js binds .delete-meal-btn[data-delete-meal]
  assert.ok(mainJs.includes('.delete-meal-btn[data-delete-meal]'), 'main.js must listen for .delete-meal-btn clicks');

  // 6.3 main.js binds #open-inventory-modal-btn
  assert.ok(mainJs.includes('#open-inventory-modal-btn'), 'main.js must listen for #open-inventory-modal-btn clicks');

  // 6.4 main.js binds #open-mealplan-modal-btn
  assert.ok(mainJs.includes('#open-mealplan-modal-btn'), 'main.js must listen for #open-mealplan-modal-btn clicks');

  // 6.5 main.js binds .quick-plan-day-btn
  assert.ok(mainJs.includes('.quick-plan-day-btn'), 'main.js must handle .quick-plan-day-btn clicks for quick day planning');

  console.log('  ✅ Section 6 Passed: All event handlers, modal bindings, and data attributes preserved and extended.');
}

console.log('\n======================================================================');
console.log('🎉 ALL MEAL PLAN & INVENTORY MODERNIZATION TESTS PASSED!');
console.log('======================================================================\n');

