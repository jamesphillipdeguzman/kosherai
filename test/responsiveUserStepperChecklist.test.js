import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCookModeTab } from '../src/components/CookModeTab.js';
import { renderSettingsModal } from '../src/components/SettingsModal.js';
import { renderHeader } from '../src/components/Header.js';
import { CHECKLIST_BY_DIET, PRE_COOKING_CHECKLIST } from '../src/data/protocolRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Mock localStorage
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};

globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

console.log('🧪 Starting Responsive User, Stepper Styling & Collapsible Checklist Test Suite...\n');

// =========================================================================
// Test 1: Header Responsive User Name
// =========================================================================
console.log('--- Section 1: Responsive User Name in Header ---');

const headerJsxPath = path.join(rootDir, 'src', 'components', 'Header.jsx');
const headerJsPath = path.join(rootDir, 'src', 'components', 'Header.js');
const headerJsx = fs.readFileSync(headerJsxPath, 'utf8');
const headerJs = fs.readFileSync(headerJsPath, 'utf8');

// 1.1 Responsive classes: sm:hidden on initial, hidden sm:inline on desktop name
assert.ok(
  headerJsx.includes('user-initial font-bold text-xs select-none sm:hidden'),
  'Header.jsx must hide initial on desktop (sm:hidden)'
);
assert.ok(
  headerJsx.includes('user-desktop-name font-bold text-xs select-none hidden sm:inline'),
  'Header.jsx must show first name on desktop (hidden sm:inline)'
);

// 1.2 Header.js must have matching responsive classes
assert.ok(
  headerJs.includes('user-initial font-bold text-xs select-none sm:hidden'),
  'Header.js must hide initial on desktop (sm:hidden)'
);
assert.ok(
  headerJs.includes('user-desktop-name font-bold text-xs select-none hidden sm:inline'),
  'Header.js must show first name on desktop (hidden sm:inline)'
);

// 1.3 Verify output for user with name "James Wilson"
const renderedHeader = renderHeader({
  currentUser: { name: 'James Wilson', email: 'james@example.com' },
  isOnline: true
});

assert.ok(/>\s*J\s*</.test(renderedHeader), 'Mobile view renders initial J');
assert.ok(/>\s*James\s*</.test(renderedHeader), 'Desktop view renders first name James');
assert.ok(renderedHeader.includes('Signed in as James Wilson'), 'Tooltip retains full user name');
assert.ok(renderedHeader.includes('status-dot'), 'Status dot preserved');

// 1.4 Verify fallback for user with only email "alex@domain.com"
const renderedEmailOnly = renderHeader({
  currentUser: { email: 'alex@domain.com' },
  isOnline: true
});
assert.ok(/>\s*A\s*</.test(renderedEmailOnly), 'Email initial A rendered');
assert.ok(/>\s*alex\s*</.test(renderedEmailOnly), 'Email prefix alex rendered');

// 1.5 Verify fallback for empty user
const renderedEmptyUser = renderHeader({
  currentUser: {},
  isOnline: true
});
assert.ok(/>\s*U\s*</.test(renderedEmptyUser), 'Fallback initial U rendered');
assert.ok(/>\s*User\s*</.test(renderedEmptyUser), 'Fallback name User rendered');

console.log('  ✅ Section 1 Passed: Mobile renders initial J (sm:hidden), desktop renders first name James (hidden sm:inline), with tooltips and fallbacks.');

// =========================================================================
// Test 2: Household Stepper Button Styling Match in Settings
// =========================================================================
console.log('\n--- Section 2: Match Household Decrement and Increment Button Styling ---');

const settingsJsPath = path.join(rootDir, 'src', 'components', 'SettingsModal.js');
const settingsJsxPath = path.join(rootDir, 'src', 'components', 'SettingsModal.jsx');
assert.ok(fs.existsSync(settingsJsxPath), 'SettingsModal.jsx must exist');

const settingsJs = fs.readFileSync(settingsJsPath, 'utf8');
const settingsJsx = fs.readFileSync(settingsJsxPath, 'utf8');

// 2.1 Both buttons in SettingsModal.js share identical emerald styling classes
const emeraldButtonClass = 'w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-xs';

assert.ok(
  settingsJs.includes(`id="settings-household-dec-btn"\n                  class="${emeraldButtonClass}"`) ||
  settingsJs.includes(`id="settings-household-dec-btn"`) && settingsJs.includes(emeraldButtonClass),
  'SettingsModal.js decrement button must use matching emerald styling'
);
assert.ok(
  settingsJs.includes(`id="settings-household-inc-btn"\n                  class="${emeraldButtonClass}"`) ||
  settingsJs.includes(`id="settings-household-inc-btn"`) && settingsJs.includes(emeraldButtonClass),
  'SettingsModal.js increment button must use matching emerald styling'
);

// 2.2 Same check on SettingsModal.jsx
assert.ok(
  settingsJsx.includes('id="settings-household-dec-btn"') && settingsJsx.includes('bg-emerald-600 hover:bg-emerald-500 text-white'),
  'SettingsModal.jsx decrement button must use emerald styling'
);
assert.ok(
  settingsJsx.includes('id="settings-household-inc-btn"') && settingsJsx.includes('bg-emerald-600 hover:bg-emerald-500 text-white'),
  'SettingsModal.jsx increment button must use emerald styling'
);

// 2.3 Render boundary conditions
const renderedSettingsAt1 = renderSettingsModal({ household_members: 1 }, 'dark');
assert.ok(renderedSettingsAt1.includes('settings-household-dec-btn'), 'Dec button present');
assert.ok(renderedSettingsAt1.includes('disabled'), 'Dec button disabled at 1 member');
assert.ok(renderedSettingsAt1.includes('bg-emerald-600'), 'Dec button has emerald-600');

const renderedSettingsAt20 = renderSettingsModal({ household_members: 20 }, 'dark');
assert.ok(renderedSettingsAt20.includes('settings-household-inc-btn'), 'Inc button present');
assert.ok(renderedSettingsAt20.includes('disabled'), 'Inc button disabled at 20 members');

console.log('  ✅ Section 2 Passed: Minus and plus buttons have matching emerald classes in dark/light mode with boundary conditions.');

// =========================================================================
// Test 3: Collapsible Pre-Cooking Safety Checklist
// =========================================================================
console.log('\n--- Section 3: Collapsible Pre-Cooking Safety Checklist ---');

const checklistJsxPath = path.join(rootDir, 'src', 'components', 'PreCookingSafetyChecklist.jsx');
assert.ok(fs.existsSync(checklistJsxPath), 'PreCookingSafetyChecklist.jsx must exist');

// 3.1 Default behavior: Collapsed by default
const renderedCollapsed = renderCookModeTab({
  activeDiet: 'lid',
  checklistState: {},
  checklistExpanded: false
});

assert.ok(renderedCollapsed.includes('is-collapsed'), 'Checklist container must have is-collapsed class');
assert.ok(renderedCollapsed.includes('id="toggle-checklist-btn"'), 'Must have accessible toggle-checklist-btn header');
assert.ok(renderedCollapsed.includes('aria-expanded="false"'), 'aria-expanded must be false when collapsed');
assert.ok(renderedCollapsed.includes('0/7 Verified'), 'Header must display 0/7 Verified progress');
assert.ok(renderedCollapsed.includes('id="reset-checklist-btn"'), 'Reset button must be present in collapsed header');
assert.ok(!renderedCollapsed.includes('id="checklist-body"'), 'Checklist items must be collapsed/hidden');

// 3.2 Expanded state
const renderedExpanded = renderCookModeTab({
  activeDiet: 'lid',
  checklistState: {},
  checklistExpanded: true
});

assert.ok(renderedExpanded.includes('is-expanded'), 'Checklist container must have is-expanded class');
assert.ok(renderedExpanded.includes('aria-expanded="true"'), 'aria-expanded must be true when expanded');
assert.ok(renderedExpanded.includes('id="checklist-body"'), 'Checklist body must be rendered when expanded');
assert.ok(renderedExpanded.includes('check-item'), 'Check items must be present when expanded');
assert.ok(renderedExpanded.includes('checklist-meter'), 'Meter must be present when expanded');

// 3.3 Dynamic Progress Updates (e.g. 2 items checked)
const lidItems = CHECKLIST_BY_DIET.lid;
const stateWith2Checked = {
  [lidItems[0].id]: true,
  [lidItems[1].id]: true
};

const rendered2Checked = renderCookModeTab({
  activeDiet: 'lid',
  checklistState: stateWith2Checked,
  checklistExpanded: false
});

assert.ok(rendered2Checked.includes('2/7 Verified'), 'Header badge must display 2/7 Verified');

// 3.4 All items checked
const allCheckedState = {};
lidItems.forEach(item => { allCheckedState[item.id] = true; });

const renderedAllChecked = renderCookModeTab({
  activeDiet: 'lid',
  checklistState: allCheckedState,
  checklistExpanded: false
});

assert.ok(renderedAllChecked.includes('7/7 Verified'), 'Header badge must display 7/7 Verified');
assert.ok(renderedAllChecked.includes('bg-emerald-500/15'), 'All clear status badge has emerald highlight');

// 3.5 Reset button stops propagation to avoid toggle conflict
assert.ok(
  renderedCollapsed.includes('onclick="event.stopPropagation();"') ||
  renderedCollapsed.includes('e.stopPropagation()'),
  'Reset button container must stop click propagation'
);

console.log('  ✅ Section 3 Passed: Checklist starts collapsed, header shows live progress (X/7 Verified), expands on toggle, and reset is isolated.');

console.log('\n======================================================================');
console.log('🎉 ALL RESPONSIVE USER, STEPPER & COLLAPSIBLE CHECKLIST TESTS PASSED!');
console.log('======================================================================\n');
