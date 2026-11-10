// KosherAI - Authentication URL Cleanup & Navigation Test Suite
import assert from 'node:assert';
import {
  isAuthPathname,
  getAuthModeFromPathname,
  getAuthRedirectDestination,
  cleanAuthUrlIfAuthenticated,
  setAuthUrl,
  clearAuthUrlIfOnAuthPath,
  AUTH_PATHNAMES
} from '../src/services/authNavigation.js';

console.log('🧪 Starting KosherAI Auth URL Cleanup & Navigation Test Suite...\n');

// Mock browser globals for test environment
let historyEntries = [];
let replaceStateCalls = [];
let pushStateCalls = [];

function setupMockWindow(initialPath = '/', initialSearch = '') {
  historyEntries = [initialPath];
  replaceStateCalls = [];
  pushStateCalls = [];

  const locationObj = {
    pathname: initialPath,
    search: initialSearch,
    hash: '',
    get href() {
      return `https://kosherai.test${this.pathname}${this.search}`;
    },
    set href(val) {
      const u = new URL(val, 'https://kosherai.test');
      this.pathname = u.pathname;
      this.search = u.search;
    }
  };

  const historyObj = {
    state: {},
    replaceState: (state, title, url) => {
      replaceStateCalls.push({ state, title, url });
      locationObj.pathname = url.split('?')[0];
      locationObj.search = url.includes('?') ? '?' + url.split('?')[1] : '';
    },
    pushState: (state, title, url) => {
      pushStateCalls.push({ state, title, url });
      historyEntries.push(url);
      locationObj.pathname = url.split('?')[0];
      locationObj.search = url.includes('?') ? '?' + url.split('?')[1] : '';
    }
  };

  global.window = {
    location: locationObj,
    history: historyObj,
    dispatchEvent: () => true
  };
}

// ============================================================================
// TEST 1: Pathname & Mode Recognition
// ============================================================================
console.log('Test 1: isAuthPathname & getAuthModeFromPathname');
{
  assert.strictEqual(isAuthPathname('/login'), true);
  assert.strictEqual(isAuthPathname('/login/'), true);
  assert.strictEqual(isAuthPathname('/LOGIN'), true);
  assert.strictEqual(isAuthPathname('/sign-up'), true);
  assert.strictEqual(isAuthPathname('/signup'), true);
  assert.strictEqual(isAuthPathname('/signin'), true);
  assert.strictEqual(isAuthPathname('/sign-in'), true);

  assert.strictEqual(isAuthPathname('/'), false);
  assert.strictEqual(isAuthPathname('/checker'), false);
  assert.strictEqual(isAuthPathname('/manage'), false);
  assert.strictEqual(isAuthPathname('/login-something'), false);

  assert.strictEqual(getAuthModeFromPathname('/login'), 'signin');
  assert.strictEqual(getAuthModeFromPathname('/sign-in'), 'signin');
  assert.strictEqual(getAuthModeFromPathname('/signin'), 'signin');
  assert.strictEqual(getAuthModeFromPathname('/sign-up'), 'signup');
  assert.strictEqual(getAuthModeFromPathname('/signup'), 'signup');
  assert.strictEqual(getAuthModeFromPathname('/'), null);
  assert.strictEqual(getAuthModeFromPathname('/settings'), null);

  console.log('  ✅ Auth route and modal mode mapping verified.\n');
}

// ============================================================================
// TEST 2: Scenario 1 - Open /sign-up while signed out
// ============================================================================
console.log('Test 2: Scenario 1 - Open /sign-up while signed out (sign-up remains accessible)');
{
  setupMockWindow('/sign-up');

  // Verify that signed-out state does NOT redirect
  const user = null;
  const replaced = cleanAuthUrlIfAuthenticated(user);

  assert.strictEqual(replaced, false, 'Must not clean or redirect when user is signed out');
  assert.strictEqual(window.location.pathname, '/sign-up', 'URL must remain /sign-up for signed-out visitor');
  assert.strictEqual(replaceStateCalls.length, 0, 'No replaceState must be executed while unauthenticated');
  assert.strictEqual(getAuthModeFromPathname(window.location.pathname), 'signup', 'Sign-up modal mode must be accessible');

  console.log('  ✅ Scenario 1 Passed: /sign-up remains accessible while signed out.\n');
}

// ============================================================================
// TEST 3: Scenario 2 - Complete sign-up successfully -> URL becomes /
// ============================================================================
console.log('Test 3: Scenario 2 - Complete sign-up successfully (URL becomes / without reload)');
{
  setupMockWindow('/sign-up');

  const newUser = { id: 'usr_new_123', email: 'patient@example.com', name: 'Maria' };
  const replaced = cleanAuthUrlIfAuthenticated(newUser);

  assert.strictEqual(replaced, true, 'cleanAuthUrlIfAuthenticated must return true upon successful cleanup');
  assert.strictEqual(window.location.pathname, '/', 'URL must become /');
  assert.strictEqual(replaceStateCalls.length, 1, 'replaceState must be called exactly once');
  assert.strictEqual(replaceStateCalls[0].url, '/', 'replaceState destination must be /');
  assert.strictEqual(pushStateCalls.length, 0, 'Must NOT create additional browser history entry');

  console.log('  ✅ Scenario 2 Passed: Successful sign-up replaces /sign-up with / via replaceState.\n');
}

// ============================================================================
// TEST 4: Scenario 3 - Open /login while signed out
// ============================================================================
console.log('Test 4: Scenario 3 - Open /login while signed out (login remains accessible)');
{
  setupMockWindow('/login');

  const user = null;
  const replaced = cleanAuthUrlIfAuthenticated(user);

  assert.strictEqual(replaced, false, 'Must not clean or redirect when user is signed out');
  assert.strictEqual(window.location.pathname, '/login', 'URL must remain /login for signed-out visitor');
  assert.strictEqual(replaceStateCalls.length, 0, 'No replaceState while signed out');
  assert.strictEqual(getAuthModeFromPathname(window.location.pathname), 'signin', 'Sign-in modal mode must be accessible');

  console.log('  ✅ Scenario 3 Passed: /login remains accessible while signed out.\n');
}

// ============================================================================
// TEST 5: Scenario 4 - Sign in successfully -> URL becomes /
// ============================================================================
console.log('Test 5: Scenario 4 - Sign in successfully (URL becomes / without reload)');
{
  setupMockWindow('/login');

  const authenticatedUser = { id: 'usr_auth_456', email: 'doctor@example.com', name: 'Dr. Ramos' };
  const replaced = cleanAuthUrlIfAuthenticated(authenticatedUser);

  assert.strictEqual(replaced, true, 'cleanAuthUrlIfAuthenticated must return true');
  assert.strictEqual(window.location.pathname, '/', 'URL must become /');
  assert.strictEqual(replaceStateCalls.length, 1, 'replaceState must be called once');
  assert.strictEqual(replaceStateCalls[0].url, '/', 'replaceState destination must be /');
  assert.strictEqual(pushStateCalls.length, 0, 'Must NOT push new history entry');

  console.log('  ✅ Scenario 4 Passed: Successful sign-in replaces /login with / via replaceState.\n');
}

// ============================================================================
// TEST 6: Scenario 5 - Refresh browser while authenticated
// ============================================================================
console.log('Test 6: Scenario 5 - Refresh browser while authenticated');
{
  // 6a. Authenticated user reloads directly on /login
  setupMockWindow('/login');
  const verifiedUser = { id: 'usr_verified_789', email: 'user@example.com' };

  // Session hydration confirms active session
  cleanAuthUrlIfAuthenticated(verifiedUser);
  assert.strictEqual(window.location.pathname, '/', 'URL must be cleaned up to / without page reload');

  // 6b. Authenticated user reloads directly on /sign-up
  setupMockWindow('/sign-up');
  cleanAuthUrlIfAuthenticated(verifiedUser);
  assert.strictEqual(window.location.pathname, '/', 'URL must be cleaned up to / without page reload');

  // 6c. Authenticated user reloads on non-auth route /checker
  setupMockWindow('/checker');
  const nonAuthReplaced = cleanAuthUrlIfAuthenticated(verifiedUser);
  assert.strictEqual(nonAuthReplaced, false, 'Must not alter unrelated routes');
  assert.strictEqual(window.location.pathname, '/checker', 'Non-auth routes must remain unchanged');

  console.log('  ✅ Scenario 5 Passed: Browser refresh while authenticated cleanly cleans up auth URLs.\n');
}

// ============================================================================
// TEST 7: Scenario 6 - Sign out behavior remains unchanged
// ============================================================================
console.log('Test 7: Scenario 6 - Sign out preservation');
{
  setupMockWindow('/');
  // Clear user state upon sign out
  let currentUser = { id: 'usr_active' };
  currentUser = null;

  // Verify cleanAuthUrl does not attempt any redirects
  const replaced = cleanAuthUrlIfAuthenticated(currentUser);
  assert.strictEqual(replaced, false);
  assert.strictEqual(window.location.pathname, '/');

  console.log('  ✅ Scenario 6 Passed: Sign-out preserves existing behavior without unexpected redirects.\n');
}

// ============================================================================
// TEST 8: Scenario 7 - Return URL Preservation & Open-Redirect Protection
// ============================================================================
console.log('Test 8: Return URL preservation & security sanitization');
{
  // 8a. Legitimate local return URL (?returnUrl=/manage)
  setupMockWindow('/login', '?returnUrl=/manage');
  const userA = { id: 'usr_admin' };
  cleanAuthUrlIfAuthenticated(userA);
  assert.strictEqual(window.location.pathname, '/manage', 'Must preserve legitimate local return URL');

  // 8b. ?redirect=/settings
  setupMockWindow('/sign-up', '?redirect=%2Fsettings');
  cleanAuthUrlIfAuthenticated(userA);
  assert.strictEqual(window.location.pathname, '/settings', 'Must preserve URL-encoded return URL');

  // 8c. ?next=/course
  setupMockWindow('/login', '?next=/course');
  cleanAuthUrlIfAuthenticated(userA);
  assert.strictEqual(window.location.pathname, '/course', 'Must preserve ?next destination');

  // 8d. Malicious protocol-relative open redirect (//evil.com) -> must safely default to '/'
  setupMockWindow('/login', '?returnUrl=//evil.com/phish');
  cleanAuthUrlIfAuthenticated(userA);
  assert.strictEqual(window.location.pathname, '/', 'Open redirect //evil.com must fallback safely to /');

  // 8e. Absolute external URL (https://evil.com) -> must safely default to '/'
  setupMockWindow('/login', '?returnUrl=https://evil.com');
  cleanAuthUrlIfAuthenticated(userA);
  assert.strictEqual(window.location.pathname, '/', 'External absolute URL must fallback safely to /');

  console.log('  ✅ Return URL handling safely routes to intended destinations and blocks open redirects.\n');
}

// ============================================================================
// TEST 9: Modal Dismissal URL Reset
// ============================================================================
console.log('Test 9: clearAuthUrlIfOnAuthPath resets auth URL to / on dismissal');
{
  setupMockWindow('/login');
  clearAuthUrlIfOnAuthPath();
  assert.strictEqual(window.location.pathname, '/', 'Closing login modal must revert URL to /');

  setupMockWindow('/sign-up');
  clearAuthUrlIfOnAuthPath();
  assert.strictEqual(window.location.pathname, '/', 'Closing sign-up modal must revert URL to /');

  setupMockWindow('/settings');
  clearAuthUrlIfOnAuthPath();
  assert.strictEqual(window.location.pathname, '/settings', 'Non-auth paths must not be affected by dismissal');

  console.log('  ✅ clearAuthUrlIfOnAuthPath resets auth URL to / on modal dismissal.\n');
}

console.log('======================================================================');
console.log('🎉 ALL AUTH URL CLEANUP & NAVIGATION TESTS PASSED SUCCESSFULLY!');
console.log('======================================================================\n');

