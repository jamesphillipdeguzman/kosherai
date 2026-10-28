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

// 1. Verify sections with 0 matches are completely hidden (not rendered)
assert.ok(!filteredKetoHtml.includes('id="protocol-permitted-section"'), 'Permitted section with 0 matches must be hidden');
assert.ok(!filteredKetoHtml.includes('id="protocol-additives-section"'), 'Additives section with 0 matches must be hidden');
assert.ok(!filteredKetoHtml.includes('0 items'), 'Should not display empty section containers showing "0 items"');

// 2. Verify static dining warning banner is hidden when searching
assert.ok(!filteredKetoHtml.includes('Dining Out'), 'Static dining warning banner must be hidden when searching');

const filteredDiabeticHtml = renderProtocolTab({ activeDiet: 'diabetic', cheatSearch: 'rice' });
assert.ok(filteredDiabeticHtml.includes('Refined Grains') && filteredDiabeticHtml.includes('White Rice'), 'Filter "rice" on diabetic must match Refined Grains & White Rice');
assert.ok(!filteredDiabeticHtml.includes('Refined Sugars'), 'Filter "rice" must not show Refined Sugars');
assert.ok(!filteredDiabeticHtml.includes('Dining Out'), 'Dining warning must be hidden during search');

// 3. Verify global empty state when ALL sections have 0 matches
const emptyProtocolHtml = renderProtocolTab({ activeDiet: 'lid', cheatSearch: 'unobtainium99' });
assert.ok(!emptyProtocolHtml.includes('id="protocol-prohibited-section"'), 'Prohibited section must not render when 0 matches');
assert.ok(!emptyProtocolHtml.includes('id="protocol-permitted-section"'), 'Permitted section must not render when 0 matches');
assert.ok(!emptyProtocolHtml.includes('id="protocol-additives-section"'), 'Additives section must not render when 0 matches');
assert.ok(!emptyProtocolHtml.includes('Dining Out'), 'Dining warning must not render during search');
assert.ok(emptyProtocolHtml.includes('No ingredients or guidelines found for "unobtainium99"'), 'Must render global empty state message with search query');
assert.ok(emptyProtocolHtml.includes('Try searching for generic terms like "salt", "sauce", "fish", or an E-number.'), 'Must render empty state tip text');
assert.ok(emptyProtocolHtml.includes('py-12 text-center text-slate-500 dark:text-slate-400'), 'Must have correct empty state container classes');

// 4. Verify initial state (no search) shows all sections and warning banner
const defaultProtocolHtml = renderProtocolTab({ activeDiet: 'lid' });
assert.ok(defaultProtocolHtml.includes('id="protocol-prohibited-section"'), 'Prohibited section must render on initial view');
assert.ok(defaultProtocolHtml.includes('id="protocol-permitted-section"'), 'Permitted section must render on initial view');
assert.ok(defaultProtocolHtml.includes('id="protocol-additives-section"'), 'Additives section must render on initial view');
assert.ok(defaultProtocolHtml.includes('Dining Out'), 'Dining warning banner must render on initial view');
assert.ok(!defaultProtocolHtml.includes('No ingredients or guidelines found for'), 'Global empty state must not render when there is no search');

console.log('  ✅ Search filter responsiveness strictly verified.\n');

// Test 6: Verify Food Additives & E-Numbers Reference is reactive to active diet protocol
console.log('Test 6: Verify Food Additives & E-Numbers Reference Reactivity across all 5 Protocols');

// Verify schema on PROTOCOL_GUIDELINES
for (const diet of expectedDiets) {
  const p = PROTOCOL_GUIDELINES[diet];
  assert.ok(Array.isArray(p.additives) && p.additives.length >= 8, `Protocol ${diet} must have at least 8 additives defined`);
  for (const add of p.additives) {
    assert.ok(add.code, `Additive in ${diet} must have a code`);
    assert.ok(add.name, `Additive in ${diet} must have a name`);
    assert.ok(add.status, `Additive in ${diet} must have a status`);
    assert.ok(add.reason, `Additive in ${diet} must have a clinical rationale / reason`);
  }
}

// 1. Low-Purine Additives Verification
const purineAdds = PROTOCOL_GUIDELINES.low_purine.additives;
assert.ok(purineAdds.some(a => a.code === 'E627' || a.name.includes('Guanylate')), 'Low-Purine must include E627 Disodium Guanylate');
assert.ok(purineAdds.some(a => a.code === 'E631' || a.name.includes('Inosinate')), 'Low-Purine must include E631 Disodium Inosinate');
assert.ok(purineAdds.some(a => a.code.includes('621') || a.name.includes('MSG')), 'Low-Purine must include E621 MSG/Yeast extract');
assert.ok(purineAdds.some(a => a.code === 'HFCS' || a.name.includes('High-Fructose')), 'Low-Purine must include High-Fructose Corn Syrup');

const purineAddsHtml = renderProtocolTab({ activeDiet: 'low_purine' });
assert.ok(purineAddsHtml.includes('Disodium Guanylate') && purineAddsHtml.includes('E627'), 'Low-Purine UI must render Disodium Guanylate');
assert.ok(purineAddsHtml.includes('Disodium Inosinate') && purineAddsHtml.includes('E631'), 'Low-Purine UI must render Disodium Inosinate');
assert.ok(purineAddsHtml.includes('High-Fructose Corn Syrup'), 'Low-Purine UI must render High-Fructose Corn Syrup');
assert.ok(!purineAddsHtml.includes('Erythrosine / FD&C Red #3'), 'Low-Purine UI must NOT render Erythrosine');

// 2. Diabetic / Low-GI Additives Verification
const diabeticAdds = PROTOCOL_GUIDELINES.diabetic.additives;
assert.ok(diabeticAdds.some(a => a.name.includes('Maltodextrin')), 'Diabetic must include Maltodextrin');
assert.ok(diabeticAdds.some(a => a.name.includes('Dextrose')), 'Diabetic must include Dextrose');
assert.ok(diabeticAdds.some(a => a.name.includes('Maltitol')), 'Diabetic must include Maltitol');
assert.ok(diabeticAdds.some(a => a.name.includes('Glucose Syrups') || a.name.includes('Corn Syrup Solids')), 'Diabetic must include Glucose syrups');
assert.ok(diabeticAdds.some(a => a.name.includes('Stevia') || a.code.includes('960')), 'Diabetic must include Stevia');
assert.ok(diabeticAdds.some(a => a.name.includes('Erythritol') || a.code.includes('968')), 'Diabetic must include Erythritol');

const diabeticAddsHtml = renderProtocolTab({ activeDiet: 'diabetic' });
assert.ok(diabeticAddsHtml.includes('Maltodextrin'), 'Diabetic UI must render Maltodextrin');
assert.ok(diabeticAddsHtml.includes('Dextrose / Pure D-Glucose'), 'Diabetic UI must render Dextrose');
assert.ok(diabeticAddsHtml.includes('Maltitol') && diabeticAddsHtml.includes('Maltitol Syrup'), 'Diabetic UI must render Maltitol');
assert.ok(diabeticAddsHtml.includes('Steviol Glycosides (Pure Stevia)'), 'Diabetic UI must render Stevia');
assert.ok(diabeticAddsHtml.includes('Erythritol'), 'Diabetic UI must render Erythritol');
assert.ok(!diabeticAddsHtml.includes('Carrageenan'), 'Diabetic UI must NOT render Carrageenan');

// 3. Low-Sodium Additives Verification
const sodiumAdds = PROTOCOL_GUIDELINES.low_sodium.additives;
assert.ok(sodiumAdds.some(a => a.code === 'E211' || a.name.includes('Sodium Benzoate')), 'Low-Sodium must include Sodium Benzoate');
assert.ok(sodiumAdds.some(a => a.code === 'E250' || a.name.includes('Sodium Nitrite')), 'Low-Sodium must include Sodium Nitrite');
assert.ok(sodiumAdds.some(a => a.code.includes('621') || a.name.includes('MSG')), 'Low-Sodium must include E621 MSG');
assert.ok(sodiumAdds.some(a => a.name.includes('Disodium Phosphate')), 'Low-Sodium must include Disodium Phosphate');

const sodiumAddsHtml = renderProtocolTab({ activeDiet: 'low_sodium' });
assert.ok(sodiumAddsHtml.includes('Sodium Benzoate') && sodiumAddsHtml.includes('E211'), 'Low-Sodium UI must render Sodium Benzoate');
assert.ok(sodiumAddsHtml.includes('Sodium Nitrite') && sodiumAddsHtml.includes('E250'), 'Low-Sodium UI must render Sodium Nitrite');
assert.ok(sodiumAddsHtml.includes('Monosodium Glutamate (MSG / Vetsin)'), 'Low-Sodium UI must render MSG');
assert.ok(sodiumAddsHtml.includes('Disodium Phosphate'), 'Low-Sodium UI must render Disodium Phosphate');
assert.ok(!sodiumAddsHtml.includes('Calcium Iodate'), 'Low-Sodium UI must NOT render Calcium Iodate');

// 4. Pinoy Keto Additives Verification
const ketoAdds = PROTOCOL_GUIDELINES.pinoy_keto.additives;
assert.ok(ketoAdds.some(a => a.name.includes('Modified Food Starch')), 'Keto must include modified cornstarch / food starch');
assert.ok(ketoAdds.some(a => a.name.includes('Tapioca')), 'Keto must include tapioca flour');
assert.ok(ketoAdds.some(a => a.name.includes('Maltitol')), 'Keto must include maltitol');
assert.ok(ketoAdds.some(a => a.name.includes('Erythritol')), 'Keto must include erythritol');

const ketoAddsHtml = renderProtocolTab({ activeDiet: 'pinoy_keto' });
assert.ok(ketoAddsHtml.includes('Modified Food Starch'), 'Keto UI must render Modified Food Starch');
assert.ok(ketoAddsHtml.includes('Cassava / Tapioca Starch'), 'Keto UI must render Tapioca Starch');
assert.ok(ketoAddsHtml.includes('Maltitol') && ketoAddsHtml.includes('Maltitol Syrup'), 'Keto UI must render Maltitol');
assert.ok(ketoAddsHtml.includes('Erythritol'), 'Keto UI must render Erythritol');
assert.ok(!ketoAddsHtml.includes('Agar-Agar (Gulaman)'), 'Keto UI must NOT render Agar-Agar');

// 5. LID Additives Verification
const lidAddsHtml = renderProtocolTab({ activeDiet: 'lid' });
assert.ok(lidAddsHtml.includes('Erythrosine') && lidAddsHtml.includes('E127'), 'LID UI must render Erythrosine E127');
assert.ok(lidAddsHtml.includes('Carrageenan') && lidAddsHtml.includes('E407'), 'LID UI must render Carrageenan E407');
assert.ok(lidAddsHtml.includes('Agar-Agar (Gulaman)') && lidAddsHtml.includes('E406'), 'LID UI must render Agar-Agar E406');
assert.ok(lidAddsHtml.includes('Calcium Iodate') && lidAddsHtml.includes('E916'), 'LID UI must render Calcium Iodate E916');
assert.ok(lidAddsHtml.includes('Potassium Iodate') && lidAddsHtml.includes('E917'), 'LID UI must render Potassium Iodate E917');

// 6. Search Filter inside Additives Table
const searchedAdditivesHtml = renderProtocolTab({ activeDiet: 'diabetic', cheatSearch: 'Stevia' });
assert.ok(searchedAdditivesHtml.includes('Steviol Glycosides (Pure Stevia)'), 'Searching Stevia must render Stevia in additives table');
assert.ok(!searchedAdditivesHtml.includes('Dextrose / Pure D-Glucose'), 'Searching Stevia must NOT show Dextrose');

console.log('  ✅ Food Additives reactivity and clinical rationale strictly verified across all 5 protocols.\n');

console.log('🎉 ALL MULTI-DIET PROTOCOL & GUIDELINES TESTS PASSED SUCCESSFULLY!');
