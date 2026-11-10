import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mock localStorage for node test runner
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
import { renderHeader } from '../src/components/Header.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Starting Dashboard Dark Mode Text & Header Consolidated Status Test Suite...\n');

// =============================================================================
// SECTION 1: BLACK TEXT VISIBILITY & CONTRAST IN DARK MODE
// =============================================================================
console.log('--- Section 1: Dashboard Dark Mode Text & Badge Contrast ---');

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

// 1.1 Category names and point values in Scorecard Breakdown
assert.ok(
  insightsHtml.includes('font-bold text-slate-900 dark:text-slate-100'),
  'Scorecard indicator breakdown must use high-contrast title text (text-slate-900 dark:text-slate-100)'
);

assert.ok(
  insightsHtml.includes('text-emerald-700 dark:text-emerald-300'),
  'Scorecard points and stewardship text must have high-contrast emerald text in dark mode'
);

assert.ok(
  insightsHtml.includes('text-slate-600 dark:text-slate-300'),
  'Scorecard detail descriptions must use readable secondary text (text-slate-600 dark:text-slate-300)'
);

// 1.2 Colored Badges (Emerald, Blue, Amber, Rose, Purple)
assert.ok(
  insightsHtml.includes('text-emerald-800 dark:text-emerald-200') ||
  insightsHtml.includes('text-emerald-700 dark:text-emerald-300'),
  'Scorecard and financial badges must have clear light text in dark mode'
);

assert.ok(
  insightsHtml.includes('text-blue-800 dark:text-blue-200'),
  'Purchasing recommendation badge must have clear contrast in dark mode'
);

assert.ok(
  insightsHtml.includes('text-purple-800 dark:text-purple-200'),
  'Historical trends badge must have clear contrast in dark mode'
);

// 1.3 HouseholdSustainabilityDashboard.jsx export check
const dashboardExportPath = path.join(rootDir, 'src', 'components', 'HouseholdSustainabilityDashboard.jsx');
assert.ok(fs.existsSync(dashboardExportPath), 'src/components/HouseholdSustainabilityDashboard.jsx must exist');
const dashboardExportContent = fs.readFileSync(dashboardExportPath, 'utf-8');
assert.ok(
  dashboardExportContent.includes('HouseholdInsightsView.jsx'),
  'HouseholdSustainabilityDashboard.jsx must re-export HouseholdInsightsView.jsx'
);

console.log('  ✅ Section 1 Passed: Scorecard, breakdowns, badges, and descriptions have explicit high-contrast classes.\n');

// =============================================================================
// SECTION 2: CONSOLIDATED HEADER USER & CONNECTION STATUS
// =============================================================================
console.log('--- Section 2: Header Single Consolidated Status Pill ---');

const userWithFullName = {
  name: 'James Wilson',
  email: 'james.wilson@example.com'
};

const userWithEmailOnly = {
  name: '',
  email: 'maria.santos@company.ph'
};

// 2.1 Online + Authenticated (with full name): Displays First Name + Green Dot + Emerald Pill
const htmlUserOnline = renderHeader(true, 'diet', true, 'lid', 'dark', userWithFullName);

assert.ok(
  htmlUserOnline.includes('status-pill status-pill-user online'),
  'Header must render single consolidated status pill (.status-pill.status-pill-user.online)'
);

assert.ok(
  htmlUserOnline.includes('user-first-name font-semibold truncate max-w-[110px]">\n              James\n            </span>') ||
  htmlUserOnline.includes('user-first-name font-semibold truncate max-w-[110px]">\r\n              James\r\n            </span>') ||
  (htmlUserOnline.includes('James') && htmlUserOnline.match(/user-first-name[^>]*>\s*James\s*<\/span>/)),
  'Consolidated status pill label must display the user first name "James"'
);

const labelMatch = htmlUserOnline.match(/<span class="status-label user-first-name[^>]*>([\s\S]*?)<\/span>/);
assert.ok(labelMatch && labelMatch[1].trim() === 'James', 'The visible label text inside user-first-name must be exactly "James"');

assert.ok(
  htmlUserOnline.includes('status-dot'),
  'Consolidated status pill must include status-dot'
);

assert.ok(
  htmlUserOnline.includes('user-avatar-badge') &&
  htmlUserOnline.match(/user-avatar-badge[^>]*>\s*J\s*<\/span>/),
  'Avatar initial badge must render "J"'
);

assert.ok(
  !htmlUserOnline.includes('user-profile-pill'),
  'Separate user-profile-pill must NOT be rendered (consolidated into status pill)'
);

// 2.2 Online + Authenticated (with email only fallback): Displays email prefix
const htmlUserEmailFallback = renderHeader(true, 'diet', true, 'lid', 'dark', userWithEmailOnly);
assert.ok(
  htmlUserEmailFallback.includes('maria.santos'),
  'Consolidated status pill must fall back to email prefix when user.name is empty'
);

// 2.3 Offline + Authenticated: Displays "Offline" + Amber Dot + Amber Pill
const htmlUserOffline = renderHeader(false, 'diet', true, 'lid', 'dark', userWithFullName);

assert.ok(
  htmlUserOffline.includes('status-pill status-pill-offline offline'),
  'When offline, header must render amber offline status pill'
);

assert.ok(
  htmlUserOffline.includes('Offline'),
  'When offline, status pill must display "Offline"'
);

assert.ok(
  htmlUserOffline.includes('status-dot offline'),
  'When offline, status dot must have .offline class'
);

// 2.4 Unauthenticated + Online: Displays "Online" + Green Dot + Sign In button
const htmlLoggedOutOnline = renderHeader(true, 'diet', true, 'lid', 'dark', null);

assert.ok(
  htmlLoggedOutOnline.includes('status-pill online'),
  'When logged out and online, status pill displays Online'
);

assert.ok(
  htmlLoggedOutOnline.includes('id="header-signin-btn"'),
  'When logged out, header renders Sign In button'
);

console.log('  ✅ Section 2 Passed: Single status pill handles online user name, offline status, and unauthenticated state.\n');

// =============================================================================
// SECTION 3: PRESERVE HEADER CONTROLS & RESPONSIVENESS
// =============================================================================
console.log('--- Section 3: Header Controls Preservation & Mobile Ergonomics ---');

// 3.1 Preserved Controls
assert.ok(htmlUserOnline.includes('id="header-signout-btn"'), 'Header must retain #header-signout-btn');
assert.ok(htmlUserOnline.includes('id="settings-open-btn"'), 'Header must retain #settings-open-btn');
assert.ok(htmlUserOnline.includes('id="header-theme-toggle-btn"'), 'Header must retain #header-theme-toggle-btn');

// 3.2 CSS responsive styling in style.css
const styleCss = fs.readFileSync(path.join(rootDir, 'src', 'style.css'), 'utf-8');

assert.ok(
  styleCss.includes('.status-pill.status-pill-user.online') &&
  styleCss.includes('rgba(16, 185, 129,'),
  'style.css must define subtle emerald styling for online authenticated status pill'
);

assert.ok(
  styleCss.includes('.status-pill.status-pill-offline.offline') &&
  styleCss.includes('rgba(245, 158, 11,'),
  'style.css must define subtle amber styling for offline status pill'
);

assert.ok(
  styleCss.includes('.status-pill .user-first-name') ||
  styleCss.includes('.user-first-name'),
  'style.css must define truncation rules for user-first-name inside status pill'
);

assert.ok(
  styleCss.includes('#settings-open-btn') && styleCss.includes('min-width: 40px'),
  'style.css must enforce non-shrinking 40px touch target for #settings-open-btn so it is never pushed off screen'
);

// 3.3 Header.jsx parity check (event listeners & hooks)
const headerJsx = fs.readFileSync(path.join(rootDir, 'src', 'components', 'Header.jsx'), 'utf-8');

assert.ok(
  headerJsx.includes("window.addEventListener('online'") &&
  headerJsx.includes("window.addEventListener('offline'") &&
  headerJsx.includes("window.removeEventListener('online'") &&
  headerJsx.includes("window.removeEventListener('offline'"),
  'Header.jsx must register and clean up browser online and offline event listeners'
);

assert.ok(
  headerJsx.includes('status-pill status-pill-user online') &&
  headerJsx.includes('status-pill status-pill-offline offline'),
  'Header.jsx must render consolidated status pill with user first name when online and Offline when offline'
);

console.log('  ✅ Section 3 Passed: Controls preserved, non-shrinking targets enforced, listeners cleaned up.\n');

console.log('======================================================================');
console.log('🎉 ALL DASHBOARD DARK MODE & HEADER CONSOLIDATION TESTS PASSED!');
console.log('======================================================================\n');
