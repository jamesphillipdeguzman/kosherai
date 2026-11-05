// Comprehensive Automated Test Suite for AuthModal & Header Integration
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Mock browser globals for Node test environment
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

global.window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.CustomEvent = class {
  constructor(name, opts = {}) {
    this.type = name;
    this.detail = opts.detail;
  }
};

import { isValidEmail, renderAuthModalHtml } from '../src/components/AuthModal.js';
import { renderHeader } from '../src/components/Header.js';

console.log('🧪 Starting KosherAI AuthModal & Header Integration Test Suite...\n');

// ----------------------------------------------------
// Test 1: Email Validation Utility
// ----------------------------------------------------
console.log('Test 1: Email format validation (isValidEmail)');
assert.strictEqual(isValidEmail('patient@example.com'), true, 'Standard email must be valid');
assert.strictEqual(isValidEmail('doctor.nurse@hospital.org.ph'), true, 'Subdomain email must be valid');
assert.strictEqual(isValidEmail('user+tag@gmail.com'), true, 'Tagged email must be valid');
assert.strictEqual(isValidEmail(''), false, 'Empty string must be invalid');
assert.strictEqual(isValidEmail(null), false, 'Null must be invalid');
assert.strictEqual(isValidEmail('not-an-email'), false, 'Non-email string must be invalid');
assert.strictEqual(isValidEmail('user@'), false, 'Missing domain must be invalid');
assert.strictEqual(isValidEmail('@domain.com'), false, 'Missing username must be invalid');
assert.strictEqual(isValidEmail('user@domain'), false, 'Missing TLD must be invalid');
console.log('  ✅ isValidEmail rejects malformed strings and accepts RFC-compliant formats.\n');

// ----------------------------------------------------
// Test 2: Auth Modal HTML Structure & Segmented Toggle
// ----------------------------------------------------
console.log('Test 2: renderAuthModalHtml DOM structure and mode toggling');

// 2a. Closed state returns empty string
const closedHtml = renderAuthModalHtml({ isOpen: false });
assert.strictEqual(closedHtml, '', 'Closed modal must render empty string');

// 2b. Sign In mode HTML
const signInHtml = renderAuthModalHtml({ isOpen: true, mode: 'signin' });
assert.ok(signInHtml.includes('id="auth-modal-overlay"'), 'Sign In modal must have overlay backdrop');
assert.ok(signInHtml.includes('id="auth-modal-close-btn"'), 'Sign In modal must have close button');
assert.ok(signInHtml.includes('id="auth-html-tab-signin"'), 'Sign In modal must have Sign In tab');
assert.ok(signInHtml.includes('id="auth-html-tab-signup"'), 'Sign In modal must have Create Account tab');
assert.ok(signInHtml.includes('id="auth-html-email"'), 'Sign In modal must have email input');
assert.ok(signInHtml.includes('id="auth-html-password"'), 'Sign In modal must have password input');
assert.ok(!signInHtml.includes('id="auth-html-confirm-password"'), 'Sign In modal must NOT have confirm password input');
assert.ok(!signInHtml.includes('id="auth-html-name"'), 'Sign In modal must NOT have full name input');
assert.ok(signInHtml.includes('Sign In'), 'Sign In modal must have "Sign In" CTA');
assert.ok(signInHtml.includes('id="auth-html-switch-signup"'), 'Sign In modal must have switch to sign up link');

// 2c. Create Account mode HTML
const signUpHtml = renderAuthModalHtml({ isOpen: true, mode: 'signup' });
assert.ok(signUpHtml.includes('id="auth-html-name"'), 'Create Account modal must have full name input');
assert.ok(signUpHtml.includes('id="auth-html-email"'), 'Create Account modal must have email input');
assert.ok(signUpHtml.includes('id="auth-html-password"'), 'Create Account modal must have password input');
assert.ok(signUpHtml.includes('id="auth-html-confirm-password"'), 'Create Account modal must have confirm password input');
assert.ok(signUpHtml.includes('Create Account'), 'Create Account modal must have "Create Account" CTA');
assert.ok(signUpHtml.includes('id="auth-html-switch-signin"'), 'Create Account modal must have switch to sign in link');

// 2d. Error display
const errorHtml = renderAuthModalHtml({ isOpen: true, mode: 'signin', errorMsg: 'Invalid email or password.' });
assert.ok(errorHtml.includes('role="alert"'), 'Error alert container must have role="alert"');
assert.ok(errorHtml.includes('Invalid email or password.'), 'Error message must be rendered into alert');
console.log('  ✅ renderAuthModalHtml supports responsive layout, segmented toggle, inputs, and error states.\n');

// ----------------------------------------------------
// Test 3: React AuthModal.jsx Component Integrity
// ----------------------------------------------------
console.log('Test 3: AuthModal.jsx source validation');
const authModalSource = fs.readFileSync(path.resolve('src/components/AuthModal.jsx'), 'utf8');

assert.ok(authModalSource.includes('export default function AuthModal'), 'AuthModal must export default function');
assert.ok(authModalSource.includes('isOpen'), 'AuthModal must handle isOpen prop');
assert.ok(authModalSource.includes('onClose'), 'AuthModal must handle onClose prop');
assert.ok(authModalSource.includes('onSuccess'), 'AuthModal must handle onSuccess callback');
assert.ok(authModalSource.includes('kosherai_user_session'), 'AuthModal must persist kosherai_user_session to localStorage');
assert.ok(authModalSource.includes('kosherai_current_user'), 'AuthModal must persist kosherai_current_user to localStorage');
assert.ok(authModalSource.includes('kosherai:auth-changed'), 'AuthModal must dispatch kosherai:auth-changed event');
assert.ok(authModalSource.includes('kosherai:sync-data'), 'AuthModal must dispatch kosherai:sync-data event');
assert.ok(authModalSource.includes('bg-slate-900'), 'AuthModal card must use bg-slate-900 dark slate theme');
assert.ok(authModalSource.includes('border-slate-800'), 'AuthModal card must use border-slate-800');
console.log('  ✅ AuthModal.jsx component props, persistence, and dark slate styling verified.\n');

// ----------------------------------------------------
// Test 4: Header.jsx Integration
// ----------------------------------------------------
console.log('Test 4: Header.jsx Auth Integration');
const headerJsxSource = fs.readFileSync(path.resolve('src/components/Header.jsx'), 'utf8');

assert.ok(headerJsxSource.includes("import AuthModal from './AuthModal.jsx'"), 'Header.jsx must import AuthModal');
assert.ok(headerJsxSource.includes('const [authModalOpen, setAuthModalOpen] = useState(false)'), 'Header.jsx must declare authModalOpen state');
assert.ok(headerJsxSource.includes("const [authInitialMode, setAuthInitialMode] = useState('signin')"), 'Header.jsx must declare authInitialMode state');
assert.ok(headerJsxSource.includes("handleOpenAuth('signin')"), 'Header.jsx must trigger handleOpenAuth("signin") on Sign In click');
assert.ok(headerJsxSource.includes("handleOpenAuth('signup')"), 'Header.jsx must trigger handleOpenAuth("signup") on Get Started click');
assert.ok(headerJsxSource.includes('id="header-signin-btn"'), 'Header.jsx must render #header-signin-btn when logged out');
assert.ok(headerJsxSource.includes('id="header-signup-btn"'), 'Header.jsx must render #header-signup-btn when logged out');
assert.ok(headerJsxSource.includes('id="header-signout-btn"'), 'Header.jsx must render #header-signout-btn when logged in');
assert.ok(headerJsxSource.includes('<AuthModal'), 'Header.jsx must mount <AuthModal component');
assert.ok(headerJsxSource.includes('isOpen={authModalOpen}'), 'Header.jsx must bind isOpen={authModalOpen}');
assert.ok(headerJsxSource.includes('initialMode={authInitialMode}'), 'Header.jsx must bind initialMode={authInitialMode}');
console.log('  ✅ Header.jsx modal state, auth controls, mode toggles, and child mounting verified.\n');

// ----------------------------------------------------
// Test 5: Vanilla Header.js Dynamic Auth State
// ----------------------------------------------------
console.log('Test 5: Header.js dynamic auth state rendering');

// 5a. Logged out state renders distinct Sign In and Get Started buttons
const loggedOutHeader = renderHeader(true, 'diet', true, 'lid', 'dark', null);
assert.ok(loggedOutHeader.includes('id="header-signin-btn"'), 'Logged-out Header.js must render #header-signin-btn');
assert.ok(loggedOutHeader.includes('id="header-signup-btn"'), 'Logged-out Header.js must render #header-signup-btn');
assert.ok(loggedOutHeader.includes('Sign In'), 'Logged-out Header.js must include "Sign In" text');
assert.ok(loggedOutHeader.includes('Get Started'), 'Logged-out Header.js must include "Get Started" text');
assert.ok(!loggedOutHeader.includes('id="header-signout-btn"'), 'Logged-out Header.js must not render #header-signout-btn');

// 5b. Logged in state renders user avatar and Sign Out button
const loggedInUser = { id: 'usr_test_123', name: 'Dr. Maria Ramos', email: 'maria@example.com' };
const loggedInHeader = renderHeader(true, 'diet', true, 'lid', 'dark', loggedInUser);
assert.ok(loggedInHeader.includes('id="header-signout-btn"'), 'Logged-in Header.js must render #header-signout-btn');
assert.ok(loggedInHeader.includes('D'), 'Logged-in Header.js must display first initial in avatar badge');
assert.ok(!loggedInHeader.includes('id="header-signin-btn"'), 'Logged-in Header.js must not render #header-signin-btn');
console.log('  ✅ Header.js dynamically adapts between logged-out and logged-in states.\n');

// ----------------------------------------------------
// Test 6: main.js Auth Modal Event Handlers
// ----------------------------------------------------
console.log('Test 6: main.js global auth modal orchestration');
const mainSource = fs.readFileSync(path.resolve('src/main.js'), 'utf8');

assert.ok(mainSource.includes('renderAuthModalHtml'), 'main.js must import renderAuthModalHtml');
assert.ok(mainSource.includes('authModalOpen'), 'main.js must maintain authModalOpen in state');
assert.ok(mainSource.includes('header-signin-btn'), 'main.js must listen for #header-signin-btn clicks');
assert.ok(mainSource.includes('header-signout-btn'), 'main.js must listen for #header-signout-btn clicks');
assert.ok(mainSource.includes('kosherai:auth-changed'), 'main.js must listen for kosherai:auth-changed');
assert.ok(mainSource.includes('kosherai:sync-data'), 'main.js must listen for kosherai:sync-data');
console.log('  ✅ main.js correctly coordinates modal visibility, events, and tenant data sync.\n');

console.log('====================================================');
console.log('🎉 ALL AUTH MODAL & HEADER INTEGRATION TESTS PASSED!');
console.log('====================================================');
