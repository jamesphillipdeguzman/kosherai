import assert from 'node:assert';
import { renderHeader } from '../src/components/Header.js';
import { DIET_PROFILES } from '../src/data/dietProfiles.js';

console.log('Testing Header Refactor...\n');

for (const diet of Object.keys(DIET_PROFILES)) {
  const profile = DIET_PROFILES[diet];
  const html = renderHeader(true, 'diet', true, diet, 'dark');

  // 1. Verify duplicate top selector row is completely removed
  assert.strictEqual(html.includes('diet-selector-strip'), false, 'Must not contain diet-selector-strip');
  assert.strictEqual(html.includes('header-diet-picker-wrap'), false, 'Must not contain old header-diet-picker-wrap');

  // 2. Verify top app bar is clean
  assert.ok(html.includes('app-header'), 'Must have app-header');
  assert.ok(html.includes('KosherAI'), 'Must have KosherAI title');
  assert.ok(html.includes('status-pill'), 'Must have status pill');
  assert.ok(html.includes('header-theme-toggle-btn'), 'Must have theme toggle');
  assert.ok(html.includes('settings-open-btn'), 'Must have settings gear');

  // 3. Verify protocol banner has embedded interactive dropdown
  assert.ok(html.includes('protocol-banner'), 'Must have protocol-banner in diet mode');
  assert.ok(html.includes(profile.target), 'Must have clinical target text: ' + profile.target);
  assert.ok(html.includes('banner-target-interactive'), 'Must have interactive banner target container');
  assert.ok(html.includes('protocol-pill-btn'), 'Must have styled protocol pill button');
  assert.ok(html.includes(profile.icon), 'Must have profile icon: ' + profile.icon);
  assert.ok(html.includes(profile.shortName), 'Must have profile shortName: ' + profile.shortName);
  assert.ok(html.includes('protocol-pill-chevron'), 'Must have chevron caret');
  assert.ok(html.includes('id="header-diet-selector"'), 'Must contain #header-diet-selector');
  assert.ok(html.includes('protocol-select-native'), 'Must have native select for interaction');

  // 4. Verify 6-Week Project / Protocol toggle spacing and layout
  assert.ok(html.includes('mode-switcher-bar'), 'Must contain mode switcher bar');
  assert.ok(html.includes('6-Week Project (Oct 31)'), 'Must contain 6-Week Project toggle button');
  assert.ok(html.includes('active-diet-tagline'), 'Must contain dynamic tagline');
}

console.log('✅ All Header & Protocol Selector checks PASSED successfully!');
