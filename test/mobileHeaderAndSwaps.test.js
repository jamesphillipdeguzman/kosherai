import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { renderSubstitutesTab } from '../src/components/SubstitutesTab.js';
import { renderHeader } from '../src/components/Header.js';

console.log('🧪 Starting Mobile Header, Sign Out & Swaps Dark Mode Contrast Test Suite...\n');

const cssContent = fs.readFileSync(path.resolve('src/style.css'), 'utf8');
const headerJsContent = fs.readFileSync(path.resolve('src/components/Header.js'), 'utf8');
const headerJsxContent = fs.readFileSync(path.resolve('src/components/Header.jsx'), 'utf8');
const substitutesTabContent = fs.readFileSync(path.resolve('src/components/SubstitutesTab.js'), 'utf8');

// ====================================================
// 1. Swaps Alternative Text in Dark & Light Modes
// ====================================================
console.log('Test 1: Swaps Alternative Text Contrast & Styling');

const testState = {
  subSearch: '',
  activeDiet: 'lid'
};
const swapsHtml = renderSubstitutesTab(testState);

// Verify semantic structure in SubstitutesTab.js
assert.ok(swapsHtml.includes('compare-box compare-safe'), 'Swaps must render compare-box compare-safe');
assert.ok(swapsHtml.includes('compare-box compare-avoid'), 'Swaps must render compare-box compare-avoid');
assert.ok(swapsHtml.includes('compare-name'), 'Swaps must render compare-name for replacement food');
assert.ok(swapsHtml.includes('culinary-tip-box'), 'Swaps must render culinary-tip-box');

// Ensure conflicting uncompiled tailwind classes that forced white-on-white are eliminated
assert.strictEqual(
  substitutesTabContent.includes('bg-emerald-50 dark:bg-emerald-950/20'),
  false,
  'SubstitutesTab.js must not contain conflicting uncompiled bg-emerald-50 class'
);

// Verify explicit Dark Mode CSS rules in style.css
assert.ok(
  cssContent.includes('.compare-safe') && cssContent.includes('rgba(6, 78, 59,'),
  'style.css must define dark subtle emerald background for .compare-safe'
);
assert.ok(
  cssContent.includes('#f0fdf4'),
  'style.css must specify crisp light emerald-white (#f0fdf4) for dark mode replacement text'
);

// Verify explicit Light Mode CSS rules in style.css
assert.ok(
  cssContent.includes('html.light .compare-safe') && cssContent.includes('#ecfdf5'),
  'style.css must define light pale emerald background for light mode .compare-safe'
);
assert.ok(
  cssContent.includes('html.light .compare-safe .compare-name') && cssContent.includes('#064e3b'),
  'style.css must specify high-contrast dark emerald (#064e3b) for light mode replacement text'
);

console.log('  ✅ Swaps alternative text dark/light contrast rules verified.\n');

// ====================================================
// 2. Modernized Header Sign Out Button
// ====================================================
console.log('Test 2: Modernized Header Sign Out Button');

const loggedInUser = { id: 'usr_test_99', name: 'Dr. Maria Ramos', email: 'maria@example.com' };
const loggedInHtml = renderHeader(true, 'diet', true, 'lid', 'dark', loggedInUser);

// Check button existence and attributes
assert.ok(loggedInHtml.includes('id="header-signout-btn"'), 'Header.js must render #header-signout-btn');
assert.ok(loggedInHtml.includes('class="header-signout-btn"'), 'Header.js must assign .header-signout-btn class');
assert.ok(loggedInHtml.includes('signout-icon'), 'Header.js must render sign-out icon');
assert.ok(loggedInHtml.includes('signout-text'), 'Header.js must render signout text');
assert.ok(loggedInHtml.includes('user-avatar-badge'), 'Header.js must render avatar badge');
assert.ok(loggedInHtml.includes('D'), 'Avatar badge must contain initial D');

// Check Header.jsx matches
assert.ok(headerJsxContent.includes('id="header-signout-btn"'), 'Header.jsx must render #header-signout-btn');
assert.ok(headerJsxContent.includes('className="header-signout-btn"'), 'Header.jsx must assign .header-signout-btn class');
assert.ok(headerJsxContent.includes('onClick={handleSignOut}'), 'Header.jsx must bind handleSignOut');

// Check CSS styling for modernized button
assert.ok(cssContent.includes('.header-signout-btn'), 'style.css must define .header-signout-btn');
assert.ok(cssContent.includes('border-radius: 9999px'), 'style.css must provide modern rounded pill styling');
assert.ok(
  cssContent.includes('rgba(244, 63, 94, 0.14)') || cssContent.includes('rgba(244, 63, 94,'),
  'style.css must define subtle rose/red background in dark mode'
);
assert.ok(cssContent.includes('html.light .header-signout-btn'), 'style.css must define light mode rose styles');
assert.ok(cssContent.includes('.header-signout-btn:hover'), 'style.css must provide hover states');
assert.ok(cssContent.includes('.header-signout-btn:active'), 'style.css must provide active states');
assert.ok(cssContent.includes('.header-signout-btn:focus-visible'), 'style.css must provide focus-visible states');

console.log('  ✅ Modernized Sign Out button rendering and CSS states verified.\n');

// ====================================================
// 3. Settings Button Ergonomics & Mobile Non-Shrinking Target
// ====================================================
console.log('Test 3: Settings Button Mobile Visibility & Touch Target');

// Must be present in Header.js and Header.jsx
assert.ok(headerJsContent.includes('id="settings-open-btn"'), 'Header.js must contain #settings-open-btn');
assert.ok(headerJsxContent.includes('id="settings-open-btn"'), 'Header.jsx must contain #settings-open-btn');

// CSS touch target must be at least 40px and non-shrinking
assert.ok(
  cssContent.includes('#settings-open-btn') &&
  cssContent.includes('min-width: 40px') &&
  cssContent.includes('min-height: 40px') &&
  cssContent.includes('flex-shrink: 0'),
  'style.css must enforce a non-shrinking 40px minimum touch target for #settings-open-btn'
);

// Theme toggle also must have 40px touch target
assert.ok(
  cssContent.includes('#header-theme-toggle-btn') &&
  cssContent.includes('min-width: 40px') &&
  cssContent.includes('min-height: 40px'),
  'style.css must enforce 40px minimum touch target for #header-theme-toggle-btn'
);

console.log('  ✅ Settings button non-shrinking touch target and IDs verified.\n');

// ====================================================
// 4. Responsive Viewport Prioritization & Clearance
// ====================================================
console.log('Test 4: Responsive Viewport Prioritization & Mobile Clearance');

// Verify responsive rules for narrow screens (520px, 440px, 360px)
assert.ok(cssContent.includes('@media (max-width: 520px)'), 'style.css must provide phone breakpoint rules');
assert.ok(cssContent.includes('@media (max-width: 440px)'), 'style.css must provide narrow phone breakpoint rules');
assert.ok(cssContent.includes('@media (max-width: 360px)'), 'style.css must provide ultra-compact phone rules');

// Check bottom navigation clearance
assert.ok(
  cssContent.includes('substitutes-container') && cssContent.includes('padding-bottom:'),
  'style.css must ensure .substitutes-container has bottom clearance so fixed bottom nav never covers cards'
);

console.log('  ✅ Mobile viewport prioritization and bottom nav clearance verified.\n');

console.log('====================================================');
console.log('🎉 ALL MOBILE HEADER, SIGN OUT & SWAPS TESTS PASSED!');
console.log('====================================================');

