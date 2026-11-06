import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { renderCookModeTab } from '../src/components/CookModeTab.js';

console.log('\n🧪 Starting KosherAI Household Member Stepper Modernization Test Suite...\n');

// 1. Verify RecipeScalingControl.jsx
console.log('Test 1: RecipeScalingControl.jsx Component Source Integrity');
const scalingControlSource = fs.readFileSync(path.resolve('src/components/RecipeScalingControl.jsx'), 'utf8');
assert(scalingControlSource.includes('w-8 h-8'), 'Must use touch-friendly w-8 h-8 button sizing');
assert(scalingControlSource.includes('rounded-full'), 'Must use rounded-full pill buttons');
assert(scalingControlSource.includes('min-w-[7rem]'), 'Must use min-w-[7rem] dynamic count display');
assert(scalingControlSource.includes('Recipe Ratio'), 'Must render recipe ratio context badge');
console.log('  ✅ Test 1 Passed: RecipeScalingControl.jsx implements the modern pill stepper specifications.');

// 2. Verify CookModeTab.jsx
console.log('Test 2: CookModeTab.jsx Implementation');
const cookModeJsxSource = fs.readFileSync(path.resolve('src/components/CookModeTab.jsx'), 'utf8');
assert(cookModeJsxSource.includes('w-8 h-8'), 'CookModeTab.jsx must use w-8 h-8 button sizing');
assert(cookModeJsxSource.includes('Recipe Ratio'), 'CookModeTab.jsx must render Recipe Ratio badge');
assert(cookModeJsxSource.includes('min-w-[7rem]'), 'CookModeTab.jsx must render min-w-[7rem] member count wrapper');
console.log('  ✅ Test 2 Passed: CookModeTab.jsx correctly upgraded with the modern pill stepper.');

// 3. Verify CookModeTab.js (Vanilla DOM Renderer)
console.log('Test 3: CookModeTab.js HTML Output');
const renderedCookTab = renderCookModeTab({
  household_members: 5,
  activeDiet: 'lid'
});
assert(renderedCookTab.includes('w-8 h-8'), 'Rendered CookModeTab.js must include w-8 h-8 buttons');
assert(renderedCookTab.includes('household-dec-btn'), 'Must include household-dec-btn class');
assert(renderedCookTab.includes('household-inc-btn'), 'Must include household-inc-btn class');
assert(renderedCookTab.includes('5 Members'), 'Must display 5 Members');
assert(renderedCookTab.includes('1.25x Recipe Ratio'), '5 members should display 1.25x Recipe Ratio (5/4)');
console.log('  ✅ Test 3 Passed: CookModeTab.js renders the modern pill stepper with exact ratio multiplier.');

// 4. Verify boundary conditions (1 member and 20 members)
console.log('Test 4: Boundary Limits (1 member and 20 members)');
const tabAt1 = renderCookModeTab({ household_members: 1, activeDiet: 'lid' });
assert(tabAt1.includes('1 Member'), 'Singular "Member" formatted for 1');
assert(tabAt1.includes('0.25x Recipe Ratio'), '1 member should display 0.25x Recipe Ratio (1/4)');
assert(tabAt1.includes('disabled'), 'Decrement button must be disabled at 1 member');

const tabAt20 = renderCookModeTab({ household_members: 20, activeDiet: 'lid' });
assert(tabAt20.includes('20 Members'), '20 Members formatted');
assert(tabAt20.includes('5.00x Recipe Ratio'), '20 members should display 5.00x Recipe Ratio (20/4)');
console.log('  ✅ Test 4 Passed: Bounds (1–20) and singular/plural formatting verified.');

// 5. Verify SettingsModal.js
console.log('Test 5: SettingsModal.js Stepper Modernization');
const settingsSource = fs.readFileSync(path.resolve('src/components/SettingsModal.js'), 'utf8');
assert(settingsSource.includes('w-8 h-8'), 'SettingsModal.js must use w-8 h-8 buttons');
assert(settingsSource.includes('settings-household-dec-btn'), 'SettingsModal.js must retain settings-household-dec-btn id');
assert(settingsSource.includes('settings-household-inc-btn'), 'SettingsModal.js must retain settings-household-inc-btn id');
assert(settingsSource.includes('settings-household-ratio'), 'SettingsModal.js must render settings-household-ratio badge');
console.log('  ✅ Test 5 Passed: SettingsModal.js reflects modern stepper styling and ratio badge.');

console.log('\n======================================================================');
console.log('🎉 ALL HOUSEHOLD STEPPER MODERNIZATION TESTS PASSED!');
console.log('======================================================================\n');

