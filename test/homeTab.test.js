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
  assert.ok(homeHtml.includes('home-hero-bleed'), 'Hero must use full-bleed wrapper');
  assert.ok(homeHtml.includes('home-hero-bg-img'), 'Hero must use background image class');
  assert.ok(homeHtml.includes('home-hero-gradient'), 'Hero must include gradient overlay');
  assert.ok(homeHtml.includes('home-hero-glow'), 'Hero must include subtle radial glow');
  assert.ok(homeHtml.includes('SMART KITCHEN COMPANION'), 'Hero must display brand subtitle');
  assert.ok(homeHtml.includes('Eat Smart.'), 'Hero must display line 1');
  assert.ok(homeHtml.includes('Spend Wisely.'), 'Hero must display line 2');
  assert.ok(homeHtml.includes('Waste Less.'), 'Hero must display line 3');
  assert.ok(homeHtml.includes('Smarter Food Choices for Every Filipino Household.'), 'Hero must display supporting subtitle');
  assert.ok(homeHtml.includes('Smart Food Budgeting') && homeHtml.includes('Food Waste Reduction') && homeHtml.includes('Healthy Eating'), 'Hero must display 3 feature pills');
  assert.ok(homeHtml.includes('Explore Your Kitchen'), 'Hero must include Explore Your Kitchen CTA');
  assert.ok(homeHtml.includes('Browse Recipes'), 'Hero must include Browse Recipes CTA');
  assert.ok(homeHtml.includes('data-home-explore-kitchen="true"'), 'Primary CTA must have navigation attribute');
  assert.ok(homeHtml.includes('data-home-diet-tab="cook"'), 'Secondary CTA must navigate to cook recipes');
  assert.ok(homeHtml.includes('Specialized dietary support, including low-iodine diets.'), 'Hero must include footer note');

  // Four Core Benefits
  for (const title of ['Smart Food Budgeting', 'Reduce Food Waste', 'Healthy Meal Planning', 'Specialized Dietary Support']) {
    assert.ok(homeHtml.includes(title), `Benefit card "${title}" must be rendered`);
  }

  // Three Steps
  for (const step of ['01 — PLAN', '02 — TRACK', '03 — IMPROVE']) {
    assert.ok(homeHtml.includes(step), `Step "${step}" must be rendered`);
  }

  // Existing Features Access
  for (const feature of [
    'Dashboard & Insights',
    'Shopping Trips & Receipts',
    'Grocery Purchases',
    'Food Waste Log',
    'Weekly Meal Planner',
    'CSV Export & Reports'
  ]) {
    assert.ok(homeHtml.includes(feature), `Feature link "${feature}" must be rendered`);
  }

  // Specialized Dietary Support mention
  assert.ok(homeHtml.includes('low-iodine diets'), 'Specialized dietary card must mention low-iodine diets');
  assert.ok(fs.existsSync(path.resolve('src/styles/home.css')), 'src/styles/home.css must exist');
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
