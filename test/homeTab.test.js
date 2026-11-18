// Test Suite for KosherAI Home Tab & Navigation
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { renderHeader } from '../src/components/Header.js';
import { renderBottomNav } from '../src/components/BottomNav.js';
import { renderHomeTab } from '../src/components/HomeTab.js';

console.log('🧪 Starting KosherAI Home Tab Test Suite...\n');

// ----------------------------------------------------
// Test 1: Header Navigation (Home is First & Active)
// ----------------------------------------------------
console.log('Test 1: Header renders Home as first top-level tab');
{
  const htmlProjectOff = renderHeader(true, 'home', false, 'lid', 'dark');
  const firstModeMatch = htmlProjectOff.match(/data-app-mode="([^"]+)"/);
  assert.ok(firstModeMatch && firstModeMatch[1] === 'home', 'First mode tab must be home when project tab is off');
  assert.ok(htmlProjectOff.includes('🏠 Home'), 'Header must display Home label');
  assert.ok(!htmlProjectOff.includes('protocol-banner'), 'Home mode must not render clinical protocol banner');

  const htmlProjectOn = renderHeader(true, 'home', true, 'lid', 'dark');
  const modeMatches = [...htmlProjectOn.matchAll(/data-app-mode="([^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(modeMatches, ['home', 'diet', 'course'], 'Mode tabs order must be home, diet, course');
}
console.log('  ✅ Header Home tab placement and order verified.');

// ----------------------------------------------------
// Test 2: BottomNav Mobile Navigation
// ----------------------------------------------------
console.log('\nTest 2: BottomNav supports Home mode without breaking Diet or Course modes');
{
  const homeNav = renderBottomNav('checker', 'home', false);
  assert.ok(homeNav.includes('data-tab="home"'), 'Home mode bottom nav includes Home tab');
  assert.ok(homeNav.includes('data-tab="checker"'), 'Home mode bottom nav includes Search tab');

  const dietNav = renderBottomNav('cook', 'diet', false);
  assert.ok(dietNav.includes('data-tab="cook"'), 'Diet mode bottom nav preserves Cook Mode');

  const courseNav = renderBottomNav('dashboard', 'course', false);
  assert.ok(courseNav.includes('data-tab="dashboard"'), 'Course mode bottom nav preserves Dashboard');
}
console.log('  ✅ BottomNav mobile navigation verified.');

// ----------------------------------------------------
// Test 3: HomeTab Content & Destinations
// ----------------------------------------------------
console.log('\nTest 3: HomeTab renders Hero, 4 Benefits, 3 Steps, Feature Links, and Dietary Note');
{
  const homeHtml = renderHomeTab({ showProjectTab: false });

  // Hero
  assert.ok(homeHtml.includes('/hero.jpg'), 'Hero must use /hero.jpg');
  assert.ok(homeHtml.includes('/favicon.svg'), 'Hero must incorporate KosherAI logo');
  assert.ok(homeHtml.includes('Eat Smart. Spend Wisely.'), 'Hero must display main headline');
  assert.ok(homeHtml.includes('Waste Less.'), 'Hero must display Waste Less.');
  assert.ok(homeHtml.includes('Explore Your Kitchen'), 'Hero must include Explore Your Kitchen CTA');
  assert.ok(homeHtml.includes('data-home-explore-kitchen="true"'), 'CTA must have navigation attribute');

  // Four Core Benefits
  for (const title of ['Smart Food Budgeting', 'Reduce Food Waste', 'Healthy Meal Planning', 'Specialized Dietary Support']) {
    assert.ok(homeHtml.includes(title), `Benefit card "${title}" must be rendered`);
  }

  // Three Steps
  for (const step of ['Plan', 'Track', 'Improve']) {
    assert.ok(homeHtml.includes(step), `Step "${step}" must be rendered`);
  }

  // Existing Features Access
  for (const feature of [
    'Dashboard &amp; Insights',
    'Dashboard & Insights',
    'Shopping Trips & Receipts',
    'Grocery Purchases',
    'Food Waste Log',
    'Weekly Meal Planner',
    'CSV Export & Reports'
  ]) {
    if (feature === 'Dashboard &amp; Insights') continue;
    assert.ok(homeHtml.includes(feature), `Feature link "${feature}" must be rendered`);
  }

  // Secondary Specialized Dietary Support
  assert.ok(homeHtml.includes('low-iodine diets'), 'Secondary section must mention low-iodine diets');
  assert.ok(homeHtml.includes('does not replace professional medical advice'), 'Must include non-medical disclaimer');
}
console.log('  ✅ HomeTab sections and destinations verified.');

// ----------------------------------------------------
// Test 4: main.js Default Landing View
// ----------------------------------------------------
console.log('\nTest 4: main.js defaults appMode to home and renders HomeTab');
{
  const mainSrc = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
  assert.ok(mainSrc.includes("appMode: 'home'"), 'main.js must default appMode to home');
  assert.ok(mainSrc.includes("state.appMode === 'home'"), 'main.js must render HomeTab when appMode is home');
  assert.ok(fs.existsSync(path.resolve('public/hero.jpg')), 'public/hero.jpg must exist');
}
console.log('  ✅ main.js default Home landing verified.');

console.log('\n🎉 ALL HOME TAB TESTS PASSED!');
