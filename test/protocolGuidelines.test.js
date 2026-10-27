import assert from 'node:assert';
import { 
  PROTOCOL_GUIDELINES, 
  normalizeDietProtocolKey, 
  getProtocolGuidelines 
} from '../src/data/protocolGuidelines.js';
import { renderProtocolTab, renderCheatSheetTab } from '../src/components/ProtocolTab.js';

console.log('🧪 Starting Multi-Diet Protocol & Guidelines Test Suite...\n');

// Test 1: Verify PROTOCOL_GUIDELINES covers all 5 protocols with complete schemas
console.log('Test 1: Verify PROTOCOL_GUIDELINES covers all 5 protocols with complete schemas');
const expectedDiets = ['lid', 'diabetic', 'low_purine', 'low_sodium', 'pinoy_keto'];

for (const diet of expectedDiets) {
  const p = PROTOCOL_GUIDELINES[diet];
  assert.ok(p, `Protocol ${diet} must exist in PROTOCOL_GUIDELINES`);
  assert.ok(typeof p.name === 'string' && p.name.length > 0, `Protocol ${diet} must have name`);
  assert.ok(typeof p.dailyTarget === 'string' && p.dailyTarget.length > 0, `Protocol ${diet} must have dailyTarget`);
  assert.ok(typeof p.duration === 'string' && p.duration.length > 0, `Protocol ${diet} must have duration`);
  assert.ok(typeof p.permittedSeasoning === 'string' && p.permittedSeasoning.length > 0, `Protocol ${diet} must have permittedSeasoning`);
  assert.ok(typeof p.rationale === 'string' && p.rationale.length > 0, `Protocol ${diet} must have rationale`);
  assert.ok(typeof p.prohibitedSubtitle === 'string' && p.prohibitedSubtitle.length > 0, `Protocol ${diet} must have prohibitedSubtitle`);
  assert.ok(Array.isArray(p.prohibited) && p.prohibited.length >= 5, `Protocol ${diet} must have at least 5 prohibited entries`);

  for (const item of p.prohibited) {
    assert.ok(item.name, `Prohibited item in ${diet} must have name`);
    assert.ok(item.desc, `Prohibited item in ${diet} must have desc`);
  }
}
console.log('  ✅ All 5 protocol guideline schemas verified successfully.\n');

// Test 2: Verify Exact Clinical Targets and Ground Truth per Protocol
console.log('Test 2: Verify Exact Clinical Targets and Ground Truth per Protocol');

// LID Protocol
const lid = PROTOCOL_GUIDELINES.lid;
assert.strictEqual(lid.dailyTarget, '< 50 mcg Iodine / Day');
assert.strictEqual(lid.duration, '14 Days (Pre-RAI)');
assert.strictEqual(lid.permittedSeasoning, 'Pure Kosher / Non-Iodized Salt');
assert.ok(lid.prohibited.some(i => i.name.includes('Iodized Salt & Sea Salt')));
assert.ok(lid.prohibited.some(i => i.name.includes('Marine Seafood & Seaweeds')));
assert.ok(lid.prohibited.some(i => i.name.includes('Dairy & Whey Products')));
assert.ok(lid.prohibited.some(i => i.name.includes('Egg Yolks & Whole Eggs')));
assert.ok(lid.prohibited.some(i => i.name.includes('Soy & Commercial Sauces')));
assert.ok(lid.prohibited.some(i => i.name.includes('Commercial Bakery & Food Dyes')));

// Diabetic Protocol
const diabetic = PROTOCOL_GUIDELINES.diabetic;
assert.strictEqual(diabetic.dailyTarget, '< 130g Total Carbs / Day (Low-GI)');
assert.strictEqual(diabetic.duration, 'Ongoing Lifestyle');
assert.strictEqual(diabetic.permittedSeasoning, 'Natural Herbs, Calamansi, Garlic, Bitter Melon');
assert.ok(diabetic.prohibited.some(i => i.name.includes('Refined Sugars & Syrups')));
assert.ok(diabetic.prohibited.some(i => i.name.includes('Refined Grains & White Rice')));
assert.ok(diabetic.prohibited.some(i => i.name.includes('Sweetened Drinks & Desserts')));
assert.ok(diabetic.prohibited.some(i => i.name.includes('Deep-Fried Battered Foods')));
assert.ok(diabetic.prohibited.some(i => i.name.includes('High-GI Root Vegetables')));

// Low-Purine Protocol
const purine = PROTOCOL_GUIDELINES.low_purine;
assert.strictEqual(purine.dailyTarget, '< 100-150 mg Purines / Day');
assert.strictEqual(purine.duration, 'Ongoing Flare Prevention');
assert.strictEqual(purine.permittedSeasoning, 'Ginger, Calamansi, Pechay, Sayote Infusions');
assert.ok(purine.prohibited.some(i => i.name.includes('Organ Meats (Offal)')));
assert.ok(purine.prohibited.some(i => i.name.includes('High-Purine Seafood')));
assert.ok(purine.prohibited.some(i => i.name.includes('Concentrated Bone & Meat Broths')));
assert.ok(purine.prohibited.some(i => i.name.includes('Alcohol & High-Fructose Syrups')));
assert.ok(purine.prohibited.some(i => i.name.includes('Yeast Extracts')));

// Low-Sodium Protocol
const sodium = PROTOCOL_GUIDELINES.low_sodium;
assert.strictEqual(sodium.dailyTarget, '< 1,500 - 2,000 mg Sodium / Day');
assert.strictEqual(sodium.duration, 'Ongoing Cardiovascular Care');
assert.strictEqual(sodium.permittedSeasoning, 'Calamansi, Garlic, Roasted Ginger, Siling Labuyo');
assert.ok(sodium.prohibited.some(i => i.name.includes('Traditional Fermented Sauces')));
assert.ok(sodium.prohibited.some(i => i.name.includes('Cured & Processed Pinoy Meats')));
assert.ok(sodium.prohibited.some(i => i.name.includes('Bouillon Cubes & Monosodium Glutamate')));
assert.ok(sodium.prohibited.some(i => i.name.includes('Preserved / Salted Seafood')));
assert.ok(sodium.prohibited.some(i => i.name.includes('Instant Noodles & Canned Soups')));

// Pinoy Keto Protocol
const keto = PROTOCOL_GUIDELINES.pinoy_keto;
assert.strictEqual(keto.dailyTarget, '< 20-50g Net Carbs / Day');
assert.strictEqual(keto.duration, 'Ketogenic Phase');
assert.strictEqual(keto.permittedSeasoning, 'Pure Coconut Oil, Sukang Paombong, Coconut Aminos');
assert.ok(keto.prohibited.some(i => i.name.includes('All Dietary Sugars & Sweeteners')));
assert.ok(keto.prohibited.some(i => i.name.includes('Starchy Staples & Grains')));
assert.ok(keto.prohibited.some(i => i.name.includes('Starchy Root Vegetables')));
assert.ok(keto.prohibited.some(i => i.name.includes('Sweet Fruits & Tropical Juices')));
assert.ok(keto.prohibited.some(i => i.name.includes('Starch Thickeners & Sweet Sauces')));

console.log('  ✅ Clinical targets and exact ground truth guidelines verified.\n');

// Test 3: Normalization helper handles all formats
console.log('Test 3: Normalization helper handles all formats');
assert.strictEqual(normalizeDietProtocolKey('lid'), 'lid');
assert.strictEqual(normalizeDietProtocolKey('LID Protocol (Default)'), 'lid');
assert.strictEqual(normalizeDietProtocolKey('diabetic'), 'diabetic');
assert.strictEqual(normalizeDietProtocolKey('Diabetic / Low-GI'), 'diabetic');
assert.strictEqual(normalizeDietProtocolKey('low_purine'), 'low_purine');
assert.strictEqual(normalizeDietProtocolKey('Low-Purine / Anti-Uric Acid'), 'low_purine');
assert.strictEqual(normalizeDietProtocolKey('low_sodium'), 'low_sodium');
assert.strictEqual(normalizeDietProtocolKey('Low-Sodium / Heart-Care (DASH)'), 'low_sodium');
assert.strictEqual(normalizeDietProtocolKey('pinoy_keto'), 'pinoy_keto');
assert.strictEqual(normalizeDietProtocolKey('Pinoy Keto / Low-Carb'), 'pinoy_keto');
assert.strictEqual(normalizeDietProtocolKey(undefined), 'lid');
console.log('  ✅ normalizeDietProtocolKey mapping strictly verified.\n');

// Test 4: Dynamic UI re-rendering based on activeDiet
console.log('Test 4: Dynamic UI re-rendering based on activeDiet');

// Test LID rendering
const lidHtml = renderProtocolTab({ activeDiet: 'lid' });
assert.ok(lidHtml.includes('50 mcg Iodine / Day'), 'LID Protocol tab must display 50 mcg Iodine / Day');
assert.ok(lidHtml.includes('Pure Kosher / Non-Iodized Salt'), 'LID Protocol tab must display Pure Kosher / Non-Iodized Salt');
assert.ok(lidHtml.includes('Iodized Salt') && lidHtml.includes('Sea Salt'), 'LID Protocol tab must include Iodized Salt & Sea Salt');
assert.ok(lidHtml.includes('6 items'), 'LID Protocol tab must show 6 prohibited items');

// Test Diabetic rendering
const diabeticHtml = renderProtocolTab({ activeDiet: 'diabetic' });
assert.ok(diabeticHtml.includes('130g Total Carbs / Day (Low-GI)'), 'Diabetic Protocol tab must display 130g Total Carbs / Day');
assert.ok(diabeticHtml.includes('Natural Herbs, Calamansi, Garlic, Bitter Melon'), 'Diabetic Protocol tab must display Bitter Melon seasoning');
assert.ok(diabeticHtml.includes('Refined Sugars') && diabeticHtml.includes('Syrups'), 'Diabetic Protocol tab must include Refined Sugars & Syrups');
assert.ok(diabeticHtml.includes('Refined Grains') && diabeticHtml.includes('White Rice'), 'Diabetic Protocol tab must include Refined Grains & White Rice');
assert.ok(!diabeticHtml.includes('50 mcg Iodine'), 'Diabetic Protocol tab must NOT display Low-Iodine target');

// Test Low-Purine rendering
const purineHtml = renderProtocolTab({ activeDiet: 'low_purine' });
assert.ok(purineHtml.includes('100-150 mg Purines / Day'), 'Purine Protocol tab must display purine target');
assert.ok(purineHtml.includes('Ginger, Calamansi, Pechay, Sayote Infusions'), 'Purine Protocol tab must display purine seasonings');
assert.ok(purineHtml.includes('Organ Meats (Offal)'), 'Purine Protocol tab must include Organ Meats (Offal)');
assert.ok(purineHtml.includes('Concentrated Bone') && purineHtml.includes('Meat Broths'), 'Purine Protocol tab must include Bone & Meat Broths');
assert.ok(!purineHtml.includes('50 mcg Iodine'), 'Purine Protocol tab must NOT display Low-Iodine target');

// Test Low-Sodium rendering
const sodiumHtml = renderProtocolTab({ activeDiet: 'low_sodium' });
assert.ok(sodiumHtml.includes('1,500 - 2,000 mg Sodium / Day'), 'Sodium Protocol tab must display sodium target');
assert.ok(sodiumHtml.includes('Traditional Fermented Sauces'), 'Sodium Protocol tab must include Traditional Fermented Sauces');
assert.ok(sodiumHtml.includes('Bouillon Cubes') && sodiumHtml.includes('Monosodium Glutamate'), 'Sodium Protocol tab must include Bouillon Cubes & MSG');
assert.ok(!sodiumHtml.includes('50 mcg Iodine'), 'Sodium Protocol tab must NOT display Low-Iodine target');

// Test Pinoy Keto rendering
const ketoHtml = renderProtocolTab({ activeDiet: 'pinoy_keto' });
assert.ok(ketoHtml.includes('20-50g Net Carbs / Day'), 'Keto Protocol tab must display Net Carbs target');
assert.ok(ketoHtml.includes('Pure Coconut Oil, Sukang Paombong, Coconut Aminos'), 'Keto Protocol tab must display keto seasonings');
assert.ok(ketoHtml.includes('All Dietary Sugars') && ketoHtml.includes('Sweeteners'), 'Keto Protocol tab must include All Dietary Sugars & Sweeteners');
assert.ok(ketoHtml.includes('Starchy Staples') && ketoHtml.includes('Grains'), 'Keto Protocol tab must include Starchy Staples & Grains');
assert.ok(!ketoHtml.includes('50 mcg Iodine'), 'Keto Protocol tab must NOT display Low-Iodine target');

// Test renderCheatSheetTab alias behaves identically
const aliasHtml = renderCheatSheetTab({ activeDiet: 'diabetic' });
assert.strictEqual(aliasHtml, diabeticHtml, 'renderCheatSheetTab alias must produce identical output to renderProtocolTab');

console.log('  ✅ Dynamic UI rendering verified across all 5 protocols.\n');

// Test 5: Dynamic Search / Filter Input
console.log('Test 5: Dynamic Search / Filter Input');
const filteredKetoHtml = renderProtocolTab({ activeDiet: 'pinoy_keto', cheatSearch: 'Root' });
assert.ok(filteredKetoHtml.includes('Starchy Root Vegetables'), 'Filter "Root" must match Starchy Root Vegetables');
assert.ok(!filteredKetoHtml.includes('Starchy Staples & Grains'), 'Filter "Root" must NOT show Starchy Staples & Grains in prohibited list');
assert.ok(filteredKetoHtml.includes('1 items') || filteredKetoHtml.includes('1 item'), 'Filter "Root" count badge should show 1 item');

const filteredDiabeticHtml = renderProtocolTab({ activeDiet: 'diabetic', cheatSearch: 'rice' });
assert.ok(filteredDiabeticHtml.includes('Refined Grains') && filteredDiabeticHtml.includes('White Rice'), 'Filter "rice" on diabetic must match Refined Grains & White Rice');
assert.ok(!filteredDiabeticHtml.includes('Refined Sugars'), 'Filter "rice" must not show Refined Sugars');

console.log('  ✅ Search filter responsiveness strictly verified.\n');

console.log('🎉 ALL MULTI-DIET PROTOCOL & GUIDELINES TESTS PASSED SUCCESSFULLY!');
