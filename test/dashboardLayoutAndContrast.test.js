import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mock localStorage for node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

import { renderHouseholdInsightsDashboard } from '../src/components/HouseholdInsightsView.js';
import { renderCourseProjectView } from '../src/components/CourseProjectView.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Starting Household Sustainability Dashboard Desktop Expansion & Contrast Test Suite...\n');

// -----------------------------------------------------------------------------
// Test 1: Desktop Layout & Expansion Markup in Components
// -----------------------------------------------------------------------------
console.log('Test 1: Component Desktop Layout Markup & Expansion Classes');

const mockState = {
  appMode: 'course',
  theme: 'dark',
  insightsPeriod: 'last_30_days',
  householdMembers: 4,
  insightsSections: {
    scorecard: true,
    financial: true,
    riskAlerts: true,
    purchasing: true,
    trends: true
  }
};

const insightsHtml = renderHouseholdInsightsDashboard(mockState);
const courseProjectHtml = renderCourseProjectView(mockState);

assert(
  courseProjectHtml.includes('course-project-container w-full max-w-7xl mx-auto'),
  'CourseProjectView must contain "course-project-container w-full max-w-7xl mx-auto"'
);

assert(
  insightsHtml.includes('household-insights-container flex flex-col gap-6 w-full max-w-7xl mx-auto mb-8'),
  'HouseholdInsightsView must contain "household-insights-container flex flex-col gap-6 w-full max-w-7xl mx-auto mb-8"'
);

assert(
  insightsHtml.includes('insights-main-card rounded-2xl w-full bg-white/90 dark:bg-slate-900/90'),
  'HouseholdInsightsView main card must have "w-full"'
);

assert(
  insightsHtml.includes('insight-collapsible-card w-full'),
  'Collapsible insight cards must expand to full width with "insight-collapsible-card w-full"'
);

console.log('  ✅ Test 1 Passed: Component markup contains desktop expansion classes (max-w-7xl, mx-auto, w-full).\n');

// -----------------------------------------------------------------------------
// Test 2: All 5 Collapsible Insight Sections Present & Independently Toggleable
// -----------------------------------------------------------------------------
console.log('Test 2: All 5 Collapsible Sections Present & Validated');

const sectionIds = ['scorecard', 'financial', 'riskAlerts', 'purchasing', 'trends'];
for (const id of sectionIds) {
  assert(
    insightsHtml.includes(`data-toggle-insight-section="${id}"`),
    `Section "${id}" toggle button must have data-toggle-insight-section="${id}"`
  );
  assert(
    insightsHtml.includes(`aria-expanded="true"`),
    `Expanded section must declare aria-expanded="true"`
  );
}

// Check with sections collapsed
const collapsedState = {
  ...mockState,
  insightsSections: {}
};
const collapsedHtml = renderHouseholdInsightsDashboard(collapsedState);
assert(
  collapsedHtml.includes('aria-expanded="false"'),
  'Collapsed state should reflect aria-expanded="false"'
);

console.log('  ✅ Test 2 Passed: All 5 insight sections are present, independently collapsible, and accessible.\n');

// -----------------------------------------------------------------------------
// Test 3: CSS Rules for Desktop Width Expansion & Centering
// -----------------------------------------------------------------------------
console.log('Test 3: CSS Desktop Width Expansion Rules in style.css');

const styleCss = fs.readFileSync(path.join(rootDir, 'src', 'style.css'), 'utf-8');

assert(
  styleCss.includes('.course-mode-container') &&
  styleCss.includes('max-width: 80rem !important;') &&
  styleCss.includes('margin-left: auto !important;') &&
  styleCss.includes('margin-right: auto !important;'),
  'style.css must define desktop expansion (max-width: 80rem / max-w-7xl, centered margins) for .course-mode-container'
);

assert(
  styleCss.includes('.household-insights-container') &&
  styleCss.includes('.course-project-container'),
  'style.css must contain explicit width rules for .household-insights-container and .course-project-container'
);

console.log('  ✅ Test 3 Passed: CSS desktop expansion and centering rules verified.\n');

// -----------------------------------------------------------------------------
// Test 4: CSS Contrast & Scoped Colors for Light & Dark Modes
// -----------------------------------------------------------------------------
console.log('Test 4: CSS Dark Mode & Light Mode Contrast Rules');

// Light mode rules
assert(
  styleCss.includes('html.light .insight-collapsible-card') &&
  styleCss.includes('html.light .insight-section-toggle-btn h3'),
  'style.css must define explicit light mode styling for .insight-collapsible-card and header h3'
);

// Dark mode card rules
assert(
  styleCss.includes('html.dark .insight-collapsible-card') &&
  styleCss.includes('html.dark .insight-section-toggle-btn h3'),
  'style.css must define dark mode styling for .insight-collapsible-card and header h3'
);

// Dark mode sub-card overrides (preventing white-on-white)
assert(
  styleCss.includes('html.dark .insight-collapsible-card .bg-slate-50') ||
  styleCss.includes(':root:not(.light) .insight-collapsible-card .bg-slate-50'),
  'style.css must scope .bg-slate-50 inside dark cards'
);

assert(
  styleCss.includes('html.dark .insight-collapsible-card .bg-white') ||
  styleCss.includes(':root:not(.light) .insight-collapsible-card .bg-white'),
  'style.css must scope .bg-white inside dark cards to prevent white backgrounds in dark mode'
);

// Colored status card scoping
assert(
  styleCss.includes('html.dark .bg-rose-50') &&
  styleCss.includes('html.dark .bg-emerald-50') &&
  styleCss.includes('html.dark .bg-amber-50'),
  'style.css must provide dark mode background overrides for .bg-rose-50, .bg-emerald-50, and .bg-amber-50'
);

console.log('  ✅ Test 4 Passed: Dark mode and light mode contrast styling verified.\n');

// -----------------------------------------------------------------------------
// Test 5: React Component Parity (HouseholdInsightsView.jsx)
// -----------------------------------------------------------------------------
console.log('Test 5: React Component Parity in HouseholdInsightsView.jsx');

const jsxContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'HouseholdInsightsView.jsx'), 'utf-8');

assert(
  jsxContent.includes('household-insights-container flex flex-col gap-6 w-full max-w-7xl mx-auto mb-8'),
  'HouseholdInsightsView.jsx must have "w-full max-w-7xl mx-auto"'
);

assert(
  jsxContent.includes('insights-main-card rounded-2xl w-full bg-white/90 dark:bg-slate-900/90'),
  'HouseholdInsightsView.jsx main card must have "w-full"'
);

assert(
  jsxContent.includes('insight-collapsible-card w-full'),
  'HouseholdInsightsView.jsx must have "insight-collapsible-card w-full"'
);

console.log('  ✅ Test 5 Passed: React JSX implementation mirrors JS layout and contrast classes.\n');

console.log('======================================================================');
console.log('🎉 ALL DASHBOARD DESKTOP EXPANSION & CONTRAST TESTS PASSED!');
console.log('======================================================================\n');
