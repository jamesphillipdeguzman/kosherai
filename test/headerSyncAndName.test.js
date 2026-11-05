import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { renderHeader } from '../src/components/Header.js';

console.log('🧪 Starting Header Sync Action & First Name Badge Tests...\n');

// ----------------------------------------------------
// Test 1: First Name Extraction & User Badge Rendering
// ----------------------------------------------------
console.log('Test 1: First Name Extraction in User Profile Pill');
const testUser = {
  id: 'usr_james_123',
  name: 'James Phillip De Guzman',
  email: 'jamesphillipdeguzman@gmail.com'
};

const headerHtml = renderHeader(true, 'course', true, 'lid', 'dark', testUser);

// 1a. Must display first name 'James'
assert.ok(headerHtml.includes('James'), 'Header must display user first name "James"');
assert.ok(!headerHtml.includes('James Phillip De Guzman</span>'), 'Header must not render full name in compact pill');

// 1b. Must include online session dot
assert.ok(headerHtml.includes('bg-emerald-500'), 'Header must render emerald online indicator dot');

// 1c. Must include Sign Out button
assert.ok(headerHtml.includes('id="header-signout-btn"'), 'Header must render #header-signout-btn');
assert.ok(headerHtml.includes('Sign Out'), 'Header must render "Sign Out" text');

// 1d. Tooltip contains full user details
assert.ok(
  headerHtml.includes('title="Signed in as James Phillip De Guzman (jamesphillipdeguzman@gmail.com)"'),
  'User pill must have informative tooltip with full name and email'
);
console.log('  ✅ Verified: "James" displayed alongside online indicator with clean sign-out button and tooltip.');

// ----------------------------------------------------
// Test 2: Brand Logo Sync States in Header.js
// ----------------------------------------------------
console.log('\nTest 2: Brand Logo Sync States (Idle, Syncing, Synced)');

// 2a. Idle state
const idleHeader = renderHeader(true, 'course', true, 'lid', 'dark', testUser, false, false);
assert.ok(idleHeader.includes('id="brand-logo-btn"'), 'Header must render clickable #brand-logo-btn');
assert.ok(!idleHeader.includes('syncing animate-spin'), 'Idle logo must not spin');
assert.ok(!idleHeader.includes('Synced!'), 'Idle logo must not show Synced! badge');

// 2b. Syncing state
const syncingHeader = renderHeader(true, 'course', true, 'lid', 'dark', testUser, true, false);
assert.ok(syncingHeader.includes('syncing animate-spin'), 'Logo must have spinning animation while syncing');
assert.ok(syncingHeader.includes('Syncing...'), 'Header must show Syncing... indicator');

// 2c. Just Synced state
const syncedHeader = renderHeader(true, 'course', true, 'lid', 'dark', testUser, false, true);
assert.ok(syncedHeader.includes('Synced!'), 'Header must render Synced! badge');
assert.ok(syncedHeader.includes('synced-badge'), 'Header must have .synced-badge element');
console.log('  ✅ Verified: Logo transitions between idle, spinning, and "Synced!" badge states.');

// ----------------------------------------------------
// Test 3: Header.jsx Source Validation
// ----------------------------------------------------
console.log('\nTest 3: Header.jsx Source Structure & Re-fetch Capabilities');
const headerJsx = fs.readFileSync(path.resolve('src/components/Header.jsx'), 'utf8');

assert.ok(headerJsx.includes('handleLogoClick'), 'Header.jsx must define handleLogoClick handler');
assert.ok(headerJsx.includes('/api/scans'), 'Header.jsx must re-fetch /api/scans');
assert.ok(headerJsx.includes('/api/trips'), 'Header.jsx must re-fetch /api/trips');
assert.ok(headerJsx.includes('/api/food-waste'), 'Header.jsx must re-fetch /api/food-waste');
assert.ok(headerJsx.includes("credentials: 'include'"), 'Header.jsx must pass credentials: "include"');
assert.ok(headerJsx.includes("rawName.split(' ')[0]"), 'Header.jsx must extract first name via split');
assert.ok(headerJsx.includes('{firstName}'), 'Header.jsx must render {firstName}');
assert.ok(headerJsx.includes('Synced!'), 'Header.jsx must render Synced! badge');
console.log('  ✅ Verified: Header.jsx implements cloud re-sync with credentials and first-name badge.');

// ----------------------------------------------------
// Test 4: main.js Manual Sync Click Listener
// ----------------------------------------------------
console.log('\nTest 4: main.js Cloud Sync Click Orchestration');
const mainJs = fs.readFileSync(path.resolve('src/main.js'), 'utf8');

assert.ok(mainJs.includes('brandBtn.addEventListener'), 'main.js must attach event listener to #brand-logo-btn');
assert.ok(mainJs.includes('refreshScanHistory()'), 'main.js must trigger refreshScanHistory on logo click');
assert.ok(mainJs.includes('pushThenRestoreFromNeon'), 'main.js must trigger pushThenRestoreFromNeon on logo click');
assert.ok(mainJs.includes('isSyncing: false'), 'main.js must track isSyncing state');
assert.ok(mainJs.includes('justSynced: false'), 'main.js must track justSynced state');
console.log('  ✅ Verified: main.js coordinates cloud re-sync without visual jumpiness.');

console.log('\n======================================================');
console.log('🎉 ALL HEADER SYNC & FIRST-NAME BADGE TESTS PASSED!');
console.log('======================================================\n');

