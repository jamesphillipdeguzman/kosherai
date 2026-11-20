// Test Suite for Scan Food Primary Navigation Tab & Guest Accessibility
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { renderCourseProjectView } from '../src/components/CourseProjectView.js';

console.log('🧪 Starting Scan Food Primary Tab Test Suite...\n');

// Setup mock localStorage
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

// 1. Scan Food appears immediately after Dashboard & Insights in .course-subnav
console.log('Test 1: Scan Food tab placement and subtle emphasis');
{
  const dashHtml = renderCourseProjectView({ courseSubTab: 'dashboard', user: null });
  const subtabMatches = [...dashHtml.matchAll(/data-subtab="([^"]+)"/g)].map(m => m[1]);
  assert.strictEqual(subtabMatches[0], 'dashboard', 'First tab must be dashboard');
  assert.strictEqual(subtabMatches[1], 'scan', 'Second tab immediately after Dashboard must be scan');
  assert.strictEqual(subtabMatches[2], 'trips', 'Third tab must be trips');
  assert.ok(dashHtml.includes('subnav-scan-highlight'), 'Scan Food tab must have subtle discovery highlight when inactive');
  assert.ok(dashHtml.includes('Scan Food'), 'Scan Food label must be present');
}
console.log('  ✅ Scan Food tab placement and emphasis verified.');

// 2. Scan Food tab reuses the exact existing scanner & supports all 5 dietary protocols
console.log('\nTest 2: Scan Food tab renders embedded scanner with all 5 dietary protocols');
{
  const scanHtml = renderCourseProjectView({ courseSubTab: 'scan', user: null, activeDiet: 'lid' });
  assert.ok(scanHtml.includes('id="receipt-scanner-embedded"'), 'Embedded scanner wrapper must render');
  assert.ok(!scanHtml.includes('id="receipt-modal-overlay"'), 'Embedded tab must not render modal overlay');
  assert.ok(scanHtml.includes('id="receipt-camera-input"'), 'Camera input preserved');
  assert.ok(scanHtml.includes('id="receipt-gallery-input"'), 'Gallery input preserved');
  assert.ok(scanHtml.includes('id="ocr-scan-toggle"'), 'OCR toggle preserved');
  assert.ok(scanHtml.includes('id="receipt-verification-form"'), 'Verification form preserved');
  assert.ok(scanHtml.includes('id="scan-diet-selector"'), 'In-scanner dietary protocol selector present');
  for (const proto of ['lid', 'low_purine', 'low_sodium', 'diabetic', 'pinoy_keto']) {
    assert.ok(scanHtml.includes(`value="${proto}"`), `Protocol option "${proto}" must be available`);
  }
  assert.ok(scanHtml.includes('id="scan-guest-signin-btn"'), 'Guest notice with Sign In prompt shown when unauthenticated');
}
console.log('  ✅ Embedded scanner and 5 dietary protocols verified.');

// 3. Authenticated user does not see guest prompt; original Shopping Trips button preserved
console.log('\nTest 3: Authenticated user & Shopping Trips entry point preserved');
{
  const authScanHtml = renderCourseProjectView({
    courseSubTab: 'scan',
    user: { id: 'u1', name: 'Alice' }
  });
  assert.ok(!authScanHtml.includes('id="scan-guest-signin-btn"'), 'Authenticated user must not see guest sign-in notice');

  const tripsHtml = renderCourseProjectView({
    courseSubTab: 'trips',
    receiptModalOpen: true,
    user: { id: 'u1', name: 'Alice' }
  });
  assert.ok(tripsHtml.includes('id="receipt-modal-overlay"'), 'Modal entry point from Shopping Trips still works');
}
console.log('  ✅ Authenticated state and Shopping Trips modal entry point verified.');

// 4. Mobile horizontal scroll & hidden scrollbar CSS + guest save guard in main.js
console.log('\nTest 4: Mobile scrollbar CSS and guest save guard in main.js');
{
  const styleCss = fs.readFileSync(path.resolve('src/style.css'), 'utf8');
  assert.ok(styleCss.includes('scrollbar-width: none'), 'course-subnav must hide scrollbar');
  assert.ok(styleCss.includes('.course-subnav::-webkit-scrollbar'), 'course-subnav must hide webkit scrollbar');

  const mainJs = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
  assert.ok(mainJs.includes('#scan-diet-selector'), 'main.js must wire #scan-diet-selector');
  assert.ok(mainJs.includes('#scan-guest-signin-btn'), 'main.js must wire #scan-guest-signin-btn');
}
console.log('  ✅ CSS and main.js wiring verified.');

console.log('\n🎉 ALL SCAN FOOD TAB TESTS PASSED!');
