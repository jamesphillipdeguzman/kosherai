import assert from 'node:assert';
import { CHECKLIST_BY_DIET } from '../src/data/protocolRules.js';
import { SMART_SUBSTITUTES_BY_DIET } from '../src/data/protocolRules.js';
import { DIET_PROFILES } from '../src/data/dietProfiles.js';
import { renderCookModeTab } from '../src/components/CookModeTab.js';
import { renderSubstitutesTab } from '../src/components/SubstitutesTab.js';
import { renderHeader } from '../src/components/Header.js';
import { renderScannerTab } from '../src/components/ScannerTab.js';

console.log('🧪 Starting Multi-Diet Desynchronization, Contrast & Theme Toggle Tests...\n');

// 1. Pre-Cooking Safety Checklist Reactivity
console.log('Test 1: Verify CHECKLIST_BY_DIET covers all 5 diets with specific requirements');
const expectedDiets = ['pinoy_keto', 'low_purine', 'low_sodium', 'diabetic', 'lid'];
for (const diet of expectedDiets) {
  const list = CHECKLIST_BY_DIET[diet];
  assert.ok(Array.isArray(list) && list.length >= 4, `Checklist for ${diet} must have at least 4 rules`);
  for (const item of list) {
    assert.ok(item.id, `Item in ${diet} checklist must have id`);
    assert.ok(item.text, `Item in ${diet} checklist must have text`);
    assert.strictEqual(item.critical, true, `Item in ${diet} checklist must be critical`);
  }
}

// Verify Pinoy Keto specific rules
const ketoTexts = CHECKLIST_BY_DIET.pinoy_keto.map(i => i.text.toLowerCase());
assert.ok(ketoTexts.some(t => t.includes('sugar')), 'Keto must check for zero sugar added');
assert.ok(ketoTexts.some(t => t.includes('starch') || t.includes('cornstarch')), 'Keto must check for zero high-starch thickeners');
assert.ok(ketoTexts.some(t => t.includes('healthy fat') || t.includes('coconut oil')), 'Keto must check healthy fats');
assert.ok(ketoTexts.some(t => t.includes('low-carb') || t.includes('sayote')), 'Keto must check low-carb vegetables');
assert.ok(ketoTexts.some(t => t.includes('banana ketchup') || t.includes('marinade')), 'Keto must check no sweetened marinades/ketchup');

// Verify Low Purine specific rules
const purineTexts = CHECKLIST_BY_DIET.low_purine.map(i => i.text.toLowerCase());
assert.ok(purineTexts.some(t => t.includes('organ') || t.includes('isaw')), 'Low purine must check organ meats');
assert.ok(purineTexts.some(t => t.includes('broth') || t.includes('first boil')), 'Low purine must check broth management');
assert.ok(purineTexts.some(t => t.includes('shellfish') || t.includes('tahong')), 'Low purine must check shellfish');
assert.ok(purineTexts.some(t => t.includes('yeast') || t.includes('bouillon')), 'Low purine must check yeast/bouillon');
assert.ok(purineTexts.some(t => t.includes('hydration') || t.includes('greens')), 'Low purine must check hydration greens');

// Verify Low Sodium specific rules
const sodiumTexts = CHECKLIST_BY_DIET.low_sodium.map(i => i.text.toLowerCase());
assert.ok(sodiumTexts.some(t => t.includes('patis') || t.includes('bagoong')), 'Low sodium must check patis/bagoong');
assert.ok(sodiumTexts.some(t => t.includes('calamansi') || t.includes('souring')), 'Low sodium must check natural souring/umami');
assert.ok(sodiumTexts.some(t => t.includes('low-sodium') || t.includes('soy')), 'Low sodium must check low-sodium soy sauce');
assert.ok(sodiumTexts.some(t => t.includes('bouillon') || t.includes('msg')), 'Low sodium must check no bouillon/MSG');
assert.ok(sodiumTexts.some(t => t.includes('unsalted') || t.includes('cured')), 'Low sodium must check fresh unsalted cuts');

// Verify Diabetic specific rules
const diabeticTexts = CHECKLIST_BY_DIET.diabetic.map(i => i.text.toLowerCase());
assert.ok(diabeticTexts.some(t => t.includes('sugar')), 'Diabetic must check zero refined sugar');
assert.ok(diabeticTexts.some(t => t.includes('fiber') || t.includes('talbos')), 'Diabetic must check fiber foundation');
assert.ok(diabeticTexts.some(t => t.includes('complex carbs') || t.includes('cauliflower rice')), 'Diabetic must check complex carbs');
assert.ok(diabeticTexts.some(t => t.includes('souring') || t.includes('sinigang')), 'Diabetic must check natural souring');

// Verify LID default rules
const lidTexts = CHECKLIST_BY_DIET.lid.map(i => i.text.toLowerCase());
assert.ok(lidTexts.some(t => t.includes('non-iodized salt')), 'LID must check non-iodized salt');
assert.ok(lidTexts.some(t => t.includes('raw meat')), 'LID must check fresh raw meat');
assert.ok(lidTexts.some(t => t.includes('pure oil')), 'LID must check pure oil');
assert.ok(lidTexts.some(t => t.includes('egg white')), 'LID must check pure egg whites');
assert.ok(lidTexts.some(t => t.includes('dairy')), 'LID must check zero dairy');
console.log('  ✅ CHECKLIST_BY_DIET dictionary and rules verified successfully.\n');

// 2. Verify CookModeTab rendering reactive checklist
console.log('Test 2: Verify renderCookModeTab renders active diet checklist rules');
const cookKetoHtml = renderCookModeTab({ activeDiet: 'pinoy_keto', checklistState: {} });
assert.ok(cookKetoHtml.includes('Zero high-starch thickeners'), 'CookMode in pinoy_keto must render keto rules');
assert.ok(cookKetoHtml.includes('verify these 5 safety rules'), 'CookMode in pinoy_keto must display 5 safety rules');

const cookPurineHtml = renderCookModeTab({ activeDiet: 'low_purine', checklistState: {} });
assert.ok(cookPurineHtml.includes('Zero organ meats'), 'CookMode in low_purine must render purine rules');

const cookSodiumHtml = renderCookModeTab({ activeDiet: 'low_sodium', checklistState: {} });
assert.ok(cookSodiumHtml.includes('Zero patis (fish sauce)'), 'CookMode in low_sodium must render sodium rules');

const cookLidHtml = renderCookModeTab({ activeDiet: 'lid', checklistState: {} });
assert.ok(cookLidHtml.includes('Non-iodized salt verified'), 'CookMode in lid must render lid rules');
console.log('  ✅ CookModeTab reactivity verified successfully.\n');

// 3. Verify Dropdown Emoji Deduplication & Theme Toggle in Header
console.log('Test 3: Verify Header renders clean non-duplicate dropdown options and theme toggle');
const headerHtml = renderHeader(true, 'diet', true, 'pinoy_keto', 'dark');

// Verify theme toggle button
assert.ok(headerHtml.includes('id="header-theme-toggle-btn"'), 'Header must contain #header-theme-toggle-btn');
assert.ok(headerHtml.includes('☀️'), 'Dark theme header must display Sun icon for switching to light');

const headerLightHtml = renderHeader(true, 'diet', true, 'pinoy_keto', 'light');
assert.ok(headerLightHtml.includes('🌙'), 'Light theme header must display Moon icon for switching to dark');

// Verify options do NOT duplicate emojis
for (const diet of Object.values(DIET_PROFILES)) {
  // Option text should be just the label/name, not having duplicate emoji
  const optionRegex = new RegExp(`<option value="${diet.id}"[^>]*>\\s*([^<]+)\\s*<\\/option>`);
  const match = headerHtml.match(optionRegex);
  assert.ok(match, `Option for ${diet.id} must exist in header`);
  const optionContent = match[1].trim();
  assert.ok(!optionContent.startsWith(diet.emoji), `Option content "${optionContent}" should not start with emoji "${diet.emoji}"`);
  assert.strictEqual(optionContent, diet.label, `Option content should match diet label "${diet.label}"`);
}
console.log('  ✅ Header emoji deduplication and quick theme toggle verified.\n');

// 4. Verify ScannerTab Hero Contrast
console.log('Test 4: Verify ScannerTab Hero Container Contrast');
const scannerHtml = renderScannerTab({ isOnline: true });
assert.ok(scannerHtml.includes('rounded-2xl p-6 bg-slate-900 text-white shadow-lg border border-slate-800'), 'ScannerTab must have updated dark hero container');
assert.ok(scannerHtml.includes('text-xl font-bold text-white mb-2'), 'ScannerTab title must be crisp white');
assert.ok(scannerHtml.includes('text-xs text-slate-300 mb-6'), 'ScannerTab desc must be light slate');
console.log('  ✅ ScannerTab contrast verified successfully.\n');

// 5. Verify SubstitutesTab Multi-Diet Reactivity & High-Contrast
console.log('Test 5: Verify SubstitutesTab Multi-Diet Reactivity & High Contrast');
for (const diet of expectedDiets) {
  const subHtml = renderSubstitutesTab({ activeDiet: diet, subSearch: '' });
  assert.ok(subHtml.includes('rounded-2xl p-6 bg-slate-900 text-white shadow-lg border border-slate-800'), `SubstitutesTab for ${diet} must have dark hero container`);
  assert.ok(subHtml.includes('text-white font-bold'), `SubstitutesTab for ${diet} must have crisp white heading`);
  assert.ok(subHtml.includes('text-slate-200'), `SubstitutesTab for ${diet} must have light description`);
  assert.ok(subHtml.includes('text-slate-700 dark:text-slate-200'), `SubstitutesTab for ${diet} must have high-contrast risk/tip text`);
  
  if (diet === 'pinoy_keto') {
    assert.ok(subHtml.includes('AVOID (High Carbs)'), 'Keto substitutes must have AVOID (High Carbs) badge');
    assert.ok(subHtml.includes('Erythritol') || subHtml.includes('Cauliflower'), 'Keto substitutes must include keto swaps');
  } else if (diet === 'low_purine') {
    assert.ok(subHtml.includes('AVOID (High Purine)'), 'Purine substitutes must have AVOID (High Purine) badge');
    assert.ok(subHtml.includes('Isaw') || subHtml.includes('Mussels'), 'Purine substitutes must include purine swaps');
  } else if (diet === 'low_sodium') {
    assert.ok(subHtml.includes('AVOID (High Sodium)'), 'Sodium substitutes must have AVOID (High Sodium) badge');
    assert.ok(subHtml.includes('Patis') || subHtml.includes('Toyo'), 'Sodium substitutes must include sodium swaps');
  } else if (diet === 'diabetic') {
    assert.ok(subHtml.includes('AVOID (High Glycemic)'), 'Diabetic substitutes must have AVOID (High Glycemic) badge');
    assert.ok(subHtml.includes('Cauliflower Rice') || subHtml.includes('Jasmine Rice'), 'Diabetic substitutes must include diabetic swaps');
  } else if (diet === 'lid') {
    assert.ok(subHtml.includes('AVOID (High Iodine)'), 'LID substitutes must have AVOID (High Iodine) badge');
  }
}
console.log('  ✅ SubstitutesTab multi-diet reactivity and high contrast verified.\n');

// 6. Verify Recipe Card Orange Category Badge & High-Contrast Clinical Rationale Container
console.log('Test 6: Verify Recipe Card Orange Category Badge & High-Contrast Clinical Rationale Container');
const cookHtml = renderCookModeTab({ activeDiet: 'lid', checklistState: {} });

// Check warm orange badge
assert.ok(
  cookHtml.includes('bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25'),
  'Recipe cards must feature warm amber/orange category tag badge'
);

// Check clean light surface container for Clinical Protocol Rationale
assert.ok(
  cookHtml.includes('bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/20 dark:border-emerald-500/30'),
  'Recipe cards must feature clean theme-adaptive background for Clinical Protocol Rationale container'
);
assert.ok(
  cookHtml.includes('text-emerald-800 dark:text-emerald-400'),
  'Clinical Protocol Rationale header must use text-emerald-800 dark:text-emerald-400'
);
assert.ok(
  cookHtml.includes('text-slate-700 dark:text-slate-200 leading-relaxed'),
  'Clinical Protocol Rationale body text must use high-contrast text-slate-700 dark:text-slate-200'
);
console.log('  ✅ Recipe card orange category badge and high-contrast rationale verified.\n');

console.log('🎉 ALL MULTI-DIET DESYNCHRONIZATION, CONTRAST & THEME TOGGLE TESTS PASSED!');
