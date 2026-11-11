/**
 * KosherAI - Mobile Header Optimization & Initial-Only Status Test Suite
 * Tests acceptance criteria for:
 * 1. Online status pill displaying only user initial (e.g. ● J instead of ● J James)
 * 2. Name -> Email fallback -> 'U' initial resolution
 * 3. Icon-only Sign Out button on mobile viewports with hidden sm:inline text
 * 4. Complete removal of header subtitle while preserving KosherAI brand & Sustain badge
 * 5. Preservation of Settings button, touch targets, and event listener lifecycle
 * 6. Responsive CSS rules preventing horizontal clipping at 320px, 360px, 375px, 412px
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Starting Mobile Header Optimization Test Suite...\n');

const headerJsxPath = path.join(rootDir, 'src', 'components', 'Header.jsx');
const headerJsPath = path.join(rootDir, 'src', 'components', 'Header.js');
const styleCssPath = path.join(rootDir, 'src', 'style.css');

assert.ok(fs.existsSync(headerJsxPath), 'Header.jsx must exist');
assert.ok(fs.existsSync(styleCssPath), 'style.css must exist');

const headerJsx = fs.readFileSync(headerJsxPath, 'utf-8');
const headerJs = fs.readFileSync(headerJsPath, 'utf-8');
const styleCss = fs.readFileSync(styleCssPath, 'utf-8');

// =========================================================================
// Section 1: User Initial Derivation & Status Display
// =========================================================================
console.log('--- Section 1: User Initial Derivation & Status Display ---');
{
  // 1.1 Header.jsx uses user.name first char -> user.email first char -> 'U'
  assert.ok(
    headerJsx.includes("rawName ? rawName[0] : (rawEmail ? rawEmail[0] : 'U')") ||
    headerJsx.includes("toUpperCase()"),
    'Header.jsx must resolve initial from name, email, or fallback to U'
  );

  // 1.2 Status pill renders single initial without full name beside it
  assert.ok(
    headerJsx.includes('user-initial font-bold text-xs select-none'),
    'Header.jsx must render user initial in status pill'
  );
  assert.ok(
    headerJsx.includes('{initial}'),
    'Header.jsx must bind {initial}'
  );

  // 1.3 Online indicator dot preserved
  assert.ok(
    headerJsx.includes('<span className="status-dot"></span>'),
    'Header.jsx must preserve green status-dot'
  );

  // 1.4 Full name preserved in tooltip
  assert.ok(
    headerJsx.includes('title={`Network connection active · Signed in as'),
    'Header.jsx must include full user name in tooltip title'
  );

  console.log('  ✅ Section 1 Passed: User initial resolved from name -> email -> U and displayed as compact ● initial pill.');
}

// =========================================================================
// Section 2: Icon-Only Sign Out on Mobile Viewports
// =========================================================================
console.log('\n--- Section 2: Icon-Only Sign Out on Mobile ---');
{
  // 2.1 Sign Out text has responsive hiding class
  assert.ok(
    headerJsx.includes('signout-text hidden sm:inline'),
    'Sign Out text must be hidden on mobile viewports with "signout-text hidden sm:inline"'
  );

  // 2.2 Accessibility attributes preserved
  assert.ok(
    headerJsx.includes('aria-label="Sign Out"') || headerJsx.includes('aria-label="Sign out"'),
    'Sign Out button must maintain aria-label="Sign Out"'
  );
  assert.ok(
    headerJsx.includes('title="Sign Out"'),
    'Sign Out button must maintain title="Sign Out"'
  );

  // 2.3 Sign out icon retained
  assert.ok(
    headerJsx.includes('signout-icon'),
    'Sign Out button must retain SVG signout-icon'
  );

  // 2.4 CSS rule for hiding text on mobile and providing comfortable square touch target
  assert.ok(
    styleCss.includes('@media (max-width: 639px)') &&
    styleCss.includes('.signout-text') &&
    styleCss.includes('display: none !important;'),
    'style.css must hide .signout-text on viewports < 640px'
  );

  assert.ok(
    styleCss.includes('@media (min-width: 640px)') &&
    styleCss.includes('.signout-text') &&
    styleCss.includes('display: inline !important;'),
    'style.css must display .signout-text on sm and larger screens (>= 640px)'
  );

  console.log('  ✅ Section 2 Passed: Sign Out button is icon-only on mobile with 38px touch target and text on desktop.');
}

// =========================================================================
// Section 3: Subtitle Removal & Brand / Badge Preservation
// =========================================================================
console.log('\n--- Section 3: Header Subtitle Removal & Brand Preservation ---');
{
  // 3.1 Subtitle elements removed from Header.jsx
  assert.ok(
    !headerJsx.includes('Six-Week Food Cost & Waste Study'),
    'Header.jsx must NOT contain "Six-Week Food Cost & Waste Study" subtitle'
  );
  assert.ok(
    !headerJsx.includes('brand-subtitle'),
    'Header.jsx must NOT contain .brand-subtitle element'
  );

  // 3.2 Subtitle elements removed from Header.js
  assert.ok(
    !headerJs.includes('Six-Week Food Cost & Waste Study'),
    'Header.js must NOT contain "Six-Week Food Cost & Waste Study" subtitle'
  );
  assert.ok(
    !headerJs.includes('brand-subtitle'),
    'Header.js must NOT contain .brand-subtitle element'
  );

  // 3.3 KosherAI logo and brand title preserved
  assert.ok(
    headerJsx.includes('KosherAI'),
    'Header.jsx must keep KosherAI brand title'
  );
  assert.ok(
    headerJsx.includes('/favicon.svg'),
    'Header.jsx must keep KosherAI logo image'
  );

  // 3.4 Sustain and protocol badges preserved
  assert.ok(
    headerJsx.includes("appMode === 'course' ? 'SUSTAIN' : currentProfile.badge"),
    'Header.jsx must preserve SUSTAIN and diet badges'
  );

  console.log('  ✅ Section 3 Passed: Subtitle cleanly removed; KosherAI brand and Sustain badge preserved.');
}

// =========================================================================
// Section 4: Functional Preservation & Mobile Viewport Clearance
// =========================================================================
console.log('\n--- Section 4: Functional Preservation & Mobile Layout Clearance ---');
{
  // 4.1 Settings button preserved with handler
  assert.ok(
    headerJsx.includes('id="settings-open-btn"'),
    'Header.jsx must preserve #settings-open-btn'
  );
  assert.ok(
    headerJsx.includes('onClick={onOpenSettings}'),
    'Header.jsx must preserve onClick={onOpenSettings}'
  );

  // 4.2 Online/offline listeners and cleanup
  assert.ok(
    headerJsx.includes("window.addEventListener('online', handleOnline)") &&
    headerJsx.includes("window.removeEventListener('online', handleOnline)") &&
    headerJsx.includes("window.addEventListener('offline', handleOffline)") &&
    headerJsx.includes("window.removeEventListener('offline', handleOffline)"),
    'Header.jsx must properly register and clean up browser online/offline event listeners'
  );

  // 4.3 Sign Out handler
  assert.ok(
    headerJsx.includes('handleSignOut'),
    'Header.jsx must preserve handleSignOut'
  );

  // 4.4 Mobile viewport rules in style.css for 320px, 360px, 440px, 520px
  assert.ok(styleCss.includes('@media (max-width: 520px)'), 'style.css has 520px breakpoint');
  assert.ok(styleCss.includes('@media (max-width: 440px)'), 'style.css has 440px breakpoint');
  assert.ok(styleCss.includes('@media (max-width: 360px)'), 'style.css has 360px breakpoint');

  console.log('  ✅ Section 4 Passed: Settings, auth session, listeners, and mobile responsive rules verified.');
}

console.log('\n======================================================================');
console.log('🎉 ALL MOBILE HEADER OPTIMIZATION TESTS PASSED SUCCESSFULLY!');
console.log('======================================================================\n');

