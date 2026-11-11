import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHeader } from '../src/components/Header.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Starting Mobile Header First Name Hidden Test Suite...\n');

const headerJsx = fs.readFileSync(path.join(rootDir, 'src/components/Header.jsx'), 'utf8');
const headerJs = fs.readFileSync(path.join(rootDir, 'src/components/Header.js'), 'utf8');
const styleCss = fs.readFileSync(path.join(rootDir, 'src/style.css'), 'utf8');

// ----------------------------------------------------------------------------
// Test 1: Markup Inspection (Header.jsx & Header.js)
// ----------------------------------------------------------------------------
console.log('Test 1: Initial Always Visible & First Name Hidden on Mobile');
{
  // 1.1 Initial must be visible across all screen sizes (NO sm:hidden)
  assert.ok(
    headerJsx.includes('user-initial font-bold text-xs select-none'),
    'Header.jsx must render user initial'
  );
  assert.strictEqual(
    headerJsx.includes('user-initial font-bold text-xs select-none sm:hidden'),
    false,
    'Header.jsx must NOT hide user initial on desktop (no sm:hidden)'
  );

  assert.ok(
    headerJs.includes('user-initial font-bold text-xs select-none'),
    'Header.js must render user initial'
  );
  assert.strictEqual(
    headerJs.includes('user-initial font-bold text-xs select-none sm:hidden'),
    false,
    'Header.js must NOT hide user initial on desktop (no sm:hidden)'
  );

  // 1.2 First name must be hidden on mobile (hidden sm:inline)
  assert.ok(
    headerJsx.includes('user-desktop-name font-bold text-xs select-none hidden sm:inline'),
    'Header.jsx must hide first name on mobile with "hidden sm:inline"'
  );
  assert.ok(
    headerJs.includes('user-desktop-name font-bold text-xs select-none hidden sm:inline'),
    'Header.js must hide first name on mobile with "hidden sm:inline"'
  );

  console.log('  ✅ Markup correctly keeps initial always visible and hides first name on mobile.');
}

// ----------------------------------------------------------------------------
// Test 2: CSS Enforcement (style.css)
// ----------------------------------------------------------------------------
console.log('\nTest 2: CSS Responsive Visibility Rules');
{
  assert.ok(
    styleCss.includes('@media (max-width: 639.98px)') &&
    styleCss.includes('.user-desktop-name {\n    display: none !important;\n  }'),
    'style.css must enforce display: none !important for .user-desktop-name on mobile (< 640px)'
  );

  assert.ok(
    styleCss.includes('.user-desktop-name {\n    display: inline !important;\n  }'),
    'style.css must enforce display: inline !important for .user-desktop-name on desktop (>= 640px)'
  );

  console.log('  ✅ CSS rules strictly enforce mobile hiding and desktop display.');
}

// ----------------------------------------------------------------------------
// Test 3: Rendered Header Content (Desktop & Mobile Simulation)
// ----------------------------------------------------------------------------
console.log('\nTest 3: Rendered Identity Pill with James Wilson');
{
  const html = renderHeader({
    currentUser: { name: 'James Wilson', email: 'james@example.com' },
    isOnline: true
  });

  // Pill contains status dot
  assert.ok(html.includes('class="status-dot"'), 'Online status dot must be present');

  // Pill contains initial 'J' in user-initial element (visible on mobile and desktop)
  assert.ok(
    html.includes('user-avatar-badge status-label user-initial') &&
    />\s*J\s*</.test(html),
    'Initial J must be present inside user-initial'
  );

  // Pill contains first name 'James' inside user-desktop-name element (hidden on mobile)
  assert.ok(
    html.includes('user-desktop-name') &&
    />\s*James\s*</.test(html),
    'First name James must be present inside user-desktop-name'
  );

  // Together on desktop (>= 640px), initial (J) and first name (James) are displayed: "● J James"
  // On mobile (< 640px), user-desktop-name is hidden via hidden sm:inline and CSS display: none !important: "● J"

  // Tooltip title preserves full user identity
  assert.ok(
    html.includes('Signed in as James Wilson (james@example.com)'),
    'Tooltip title must preserve full user name and email'
  );

  // All other controls present on the same line:
  assert.ok(html.includes('id="header-signout-btn"'), 'Sign Out button present');
  assert.ok(html.includes('id="header-theme-toggle-btn"'), 'Theme toggle present');
  assert.ok(html.includes('id="settings-open-btn"'), 'Settings button present');

  console.log('  ✅ Rendered identity pill contains ● J on mobile and ● J James on desktop.');
}

// ----------------------------------------------------------------------------
// Test 4: Offline State Preservation
// ----------------------------------------------------------------------------
console.log('\nTest 4: Offline State Preservation');
{
  const offlineHtml = renderHeader({
    currentUser: { name: 'James Wilson', email: 'james@example.com' },
    isOnline: false
  });

  assert.ok(offlineHtml.includes('status-pill-offline offline'), 'Offline pill rendered');
  assert.ok(offlineHtml.includes('Offline'), 'Offline label rendered');
  assert.ok(offlineHtml.includes('status-dot offline'), 'Offline dot rendered');

  console.log('  ✅ Offline state functions correctly without regression.');
}

console.log('\n======================================================================');
console.log('🎉 ALL MOBILE HEADER FIRST NAME HIDDEN TESTS PASSED!');
console.log('======================================================================\n');

