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
  assert.deepStrictEqual(modeMatches, ['home', 'diet', 'course', 'guide'], 'Mode tabs order must be home, diet, course, guide');
  assert.ok(htmlProjectOn.includes('Tool Guide'), 'Header must display Tool Guide as 4th primary tab');
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

  // 6-Week Project Spotlight
  assert.ok(homeHtml.includes('Make Every Meal Count.'), 'Spotlight heading must be rendered');
  assert.ok(homeHtml.includes('Explore the 6-Week Project'), 'Spotlight CTA must be rendered');
  for (const item of ['Build Healthy Habits', 'Plan with Purpose', 'Manage Your Budget', 'Reduce Food Waste']) {
    assert.ok(homeHtml.includes(item), `Spotlight benefit "${item}" must be rendered`);
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

// ----------------------------------------------------
// Test 5: ToolGuideTab Documentation, Flowchart & Live Visualizations
// ----------------------------------------------------
console.log('\nTest 5: ToolGuideTab renders About, Collection, Workflow, Visualizations & Feature Guides');
{
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    };
  }
  const { registerHooks } = await import('node:module');
  registerHooks({
    load(url, context, nextLoad) {
      if (url.endsWith('.webp')) {
        const filename = url.split('/').pop();
        return { format: 'module', shortCircuit: true, source: `export default "/assets/${filename}";` };
      }
      return nextLoad(url, context);
    }
  });
  const { renderToolGuideTab } = await import('../src/components/ToolGuideTab.js');
  const guideHtml = renderToolGuideTab({});
  assert.ok(guideHtml.includes('A. About KosherAI'), 'Must include About section');
  assert.ok(guideHtml.includes('B. Data Collection Process'), 'Must include Data Collection section');
  assert.ok(guideHtml.includes('KosherAI Data Collection Process and Input Channels'), 'Must render data collection diagram alt text');
  assert.ok(guideHtml.includes('/assets/data-collection.webp'), 'Must render bundled dataCollectionImg src');
  assert.ok(guideHtml.includes('id="open-data-collection-lightbox-btn"'), 'Must render tap-to-expand button for data collection diagram');
  assert.ok(guideHtml.includes('C. Data Processing Workflow'), 'Must include Processing Workflow section');
  assert.ok(guideHtml.includes('KosherAI End-to-End Household Food and Waste Management Process Flow'), 'Must render process map alt text');
  assert.ok(guideHtml.includes('/assets/process-map.webp'), 'Must render bundled processMapImg src');
  assert.ok(guideHtml.includes('id="open-process-map-lightbox-btn"'), 'Must render tap-to-expand button');
  assert.ok(guideHtml.includes('D. Data Visualization'), 'Must include Data Visualization section');
  assert.ok(guideHtml.includes('E. Feature Guides'), 'Must include Feature Guides section');
  assert.ok(guideHtml.includes('01 • RECEIPT CAPTURE') && guideHtml.includes('05 • MEAL PLANNING'), 'Section B numbered badges must be present');
  assert.ok(guideHtml.includes('01 • USER INPUT') && guideHtml.includes('02 • DATA VALIDATION') && guideHtml.includes('03 • DATA ORGANIZATION') && guideHtml.includes('04 • DATA STORAGE') && guideHtml.includes('05 • DATA ANALYSIS') && guideHtml.includes('06 • USER INSIGHTS'), 'Section C 6 numbered stages must be present');
  assert.ok(!guideHtml.includes('compressImageForOCR') && !guideHtml.includes('getProjectWeekForDate') && !guideHtml.includes('/api/trips') && !guideHtml.includes('CourseProjectView.js'), 'Technical filenames, functions, and endpoints must be removed from Sections B and C');
  assert.ok(guideHtml.includes('Weekly Expenses vs.'), 'Live bar chart visualization must be rendered');
  assert.ok(guideHtml.includes('baseline-fill') && guideHtml.includes('baseline-line-indicator') && guideHtml.includes('chart-legend'), 'Weekly Expenses chart must match Dashboard Insights bar styling, dashed baseline, and legend');
  assert.ok(guideHtml.includes('Baseline (W1)') && guideHtml.includes('Under Baseline') && guideHtml.includes('Over Baseline') && guideHtml.includes('Baseline Reference'), 'Chart legend items must be rendered');
  assert.ok(guideHtml.includes('data-home-course-tab="scan"'), 'Feature guide must link to Scan Food');

  const lightboxHtml = renderToolGuideTab({ processMapLightboxOpen: true });
  assert.ok(lightboxHtml.includes('id="process-map-lightbox-overlay"'), 'Lightbox modal must render when processMapLightboxOpen is true');
  assert.ok(lightboxHtml.includes('id="close-process-map-lightbox-btn"'), 'Lightbox close button must render');
}
console.log('  ✅ ToolGuideTab verified.');

console.log('\n🎉 ALL HOME TAB TESTS PASSED!');
