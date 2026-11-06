// Comprehensive Test Suite for KosherAI Recipe Portion Scaling Service
// Validates scaling formulas, unit rounding rules, persistence, and dietary compliance

import assert from 'node:assert';

// Mock localStorage and window for Node environment
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

const dispatchedEvents = [];
global.window = {
  dispatchEvent: (event) => { dispatchedEvents.push(event); }
};
global.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail || {};
  }
};

import {
  parseQuantity,
  parseIngredient,
  roundScaledQuantity,
  scaleIngredient,
  scaleRecipe,
  formatQuantity
} from '../src/services/recipeScaler.js';

import {
  getHouseholdMembers,
  setHouseholdMembers,
  getSettings,
  saveSettings
} from '../src/services/storage.js';

import { analyzeRecipe } from '../src/services/ruleEngine.js';
import { DIET_RECIPES } from '../src/data/dietRecipes.js';

console.log('🧪 Starting KosherAI Recipe Scaler Test Suite...\n');

// ----------------------------------------------------
// Test A: Scaling Up (4 -> 6 members, Multiplier = 1.5)
// ----------------------------------------------------
console.log('Test A: Scaling Up from 4 to 6 servings (1.5x multiplier)');
const baseRecipeA = {
  id: 'test_chicken_tinola',
  name: 'Low-Iodine Chicken Tinola',
  base_servings: 4,
  ingredients: [
    '500 g chicken cutlets, cut into cubes',
    '200 g green beans (fresh or frozen)',
    '400 g sayote (chayote), peeled and sliced',
    '1 stalk fresh lemongrass',
    '2 pure egg whites',
    '1.5 tbsp non-iodized vegetable oil'
  ]
};

const scaledUp = scaleRecipe(baseRecipeA, 6);
assert.strictEqual(scaledUp.base_servings, 4, 'Base servings should remain 4');
assert.strictEqual(scaledUp.household_members, 6, 'Household members should be 6');
assert.strictEqual(scaledUp.scaling_multiplier, 1.5, 'Scaling multiplier must be exactly 1.5');

// Check 500g -> 750g
assert.strictEqual(scaledUp.scaledIngredients[0].scaledQty, 750, '500g * 1.5 should be 750g');
assert.ok(scaledUp.scaledIngredients[0].scaledText.startsWith('750 g'), 'Scaled text should begin with "750 g"');

// Check 200g -> 300g
assert.strictEqual(scaledUp.scaledIngredients[1].scaledQty, 300, '200g * 1.5 should be 300g');
assert.ok(scaledUp.scaledIngredients[1].scaledText.startsWith('300 g'), 'Scaled text should begin with "300 g"');

// Check 400g -> 600g
assert.strictEqual(scaledUp.scaledIngredients[2].scaledQty, 600, '400g * 1.5 should be 600g');
assert.ok(scaledUp.scaledIngredients[2].scaledText.startsWith('600 g'), 'Scaled text should begin with "600 g"');

// Check whole stalk: 1 * 1.5 = 1.5 -> Math.ceil = 2 stalks
assert.strictEqual(scaledUp.scaledIngredients[3].scaledQty, 2, 'Pieces should round up: ceil(1.5) = 2');

// Check eggs: 2 * 1.5 = 3 eggs
assert.strictEqual(scaledUp.scaledIngredients[4].scaledQty, 3, '2 eggs * 1.5 = 3 eggs');

// Check tablespoons: 1.5 * 1.5 = 2.25 tbsp
assert.strictEqual(scaledUp.scaledIngredients[5].scaledQty, 2.25, '1.5 tbsp * 1.5 = 2.25 tbsp');
console.log('  ✅ Test A Passed: Scaling up (4 -> 6) calculated correctly with proper rounding.\n');

// ----------------------------------------------------
// Test B: Scaling Down (4 -> 2 members, Multiplier = 0.5)
// ----------------------------------------------------
console.log('Test B: Scaling Down from 4 to 2 servings (0.5x multiplier)');
const scaledDown = scaleRecipe(baseRecipeA, 2);
assert.strictEqual(scaledDown.base_servings, 4);
assert.strictEqual(scaledDown.household_members, 2);
assert.strictEqual(scaledDown.scaling_multiplier, 0.5);

// Check 500g -> 250g
assert.strictEqual(scaledDown.scaledIngredients[0].scaledQty, 250, '500g * 0.5 should be 250g');
assert.ok(scaledDown.scaledIngredients[0].scaledText.startsWith('250 g'));

// Check 200g -> 100g
assert.strictEqual(scaledDown.scaledIngredients[1].scaledQty, 100, '200g * 0.5 should be 100g');

// Check 1 stalk ceil(0.5) = 1
assert.strictEqual(scaledDown.scaledIngredients[3].scaledQty, 1, 'ceil(0.5 stalk) should round up to 1 stalk');
console.log('  ✅ Test B Passed: Scaling down (4 -> 2) calculated correctly.\n');

// ----------------------------------------------------
// Test C: Repeated Scaling / Immutability (4 -> 6 -> 2 -> 8 -> 4)
// ----------------------------------------------------
console.log('Test C: Repeated changes (4 -> 6 -> 2 -> 8 -> 4) preserving original base values');
const originalIngredientsJson = JSON.stringify(baseRecipeA.ingredients);

const step1 = scaleRecipe(baseRecipeA, 6);
const step2 = scaleRecipe(baseRecipeA, 2);
const step3 = scaleRecipe(baseRecipeA, 8);
const step4 = scaleRecipe(baseRecipeA, 4);

// Ensure baseRecipeA was not mutated in any way
assert.strictEqual(JSON.stringify(baseRecipeA.ingredients), originalIngredientsJson, 'Original recipe ingredients array must remain immutable');
assert.strictEqual(step4.scaling_multiplier, 1, 'Multiplier at 4 members must be exactly 1');
assert.strictEqual(step4.scaledIngredients[0].scaledQty, 500, '500g chicken must return cleanly to 500g');
assert.strictEqual(step4.scaledIngredients[1].scaledQty, 200, '200g green beans must return cleanly to 200g');
assert.strictEqual(step4.scaledIngredients[2].scaledQty, 400, '400g sayote must return cleanly to 400g');
console.log('  ✅ Test C Passed: Zero drift across repeated scaling; base recipe is strictly immutable.\n');

// ----------------------------------------------------
// Test D: Persistence & Clamping (1 to 20)
// ----------------------------------------------------
console.log('Test D: Household size persistence and boundaries');
localStorage.clear();
assert.strictEqual(getHouseholdMembers(), 4, 'Default household size should be 4');

// Set to 6
setHouseholdMembers(6);
assert.strictEqual(getHouseholdMembers(), 6, 'Household size should update to 6 in localStorage');
assert.strictEqual(localStorage.getItem('kosherai_household_members'), '6');

// Check settings sync
const settings = getSettings();
assert.strictEqual(settings.household_members, 6, 'Settings object should reflect household_members = 6');

// Boundary clamping: Min 1
setHouseholdMembers(0);
assert.strictEqual(getHouseholdMembers(), 1, 'Household size below 1 should clamp to 1');

setHouseholdMembers(-5);
assert.strictEqual(getHouseholdMembers(), 1, 'Negative size should clamp to 1');

// Boundary clamping: Max 20
setHouseholdMembers(25);
assert.strictEqual(getHouseholdMembers(), 20, 'Household size above 20 should clamp to 20');

// Reset to 4
setHouseholdMembers(4);
assert.strictEqual(getHouseholdMembers(), 4);
console.log('  ✅ Test D Passed: Persistence, clamping (1–20), and settings synchronization verified.\n');

// ----------------------------------------------------
// Test E: Missing or Invalid Base Servings
// ----------------------------------------------------
console.log('Test E: Missing or invalid base servings handling');
const recipeNoServings = {
  id: 'no_servings_recipe',
  name: 'Dish Without Base Servings',
  ingredients: ['300 g beef brisket', '1 onion']
};

const scaledFallback = scaleRecipe(recipeNoServings, 6);
assert.strictEqual(scaledFallback.base_servings, 4, 'Missing base_servings must default to 4');
assert.strictEqual(scaledFallback.scaling_multiplier, 1.5, 'Multiplier should be 6 / 4 = 1.5');
assert.strictEqual(scaledFallback.scaledIngredients[0].scaledQty, 450, '300g * 1.5 = 450g');
console.log('  ✅ Test E Passed: Missing base servings successfully defaults to 4.\n');

// ----------------------------------------------------
// Test F: Comprehensive Measurement Handling
// ----------------------------------------------------
console.log('Test F: Precision and measurement units handling');

// Grams (round to whole number): 155g * 1.5 = 232.5 -> 233g
assert.strictEqual(roundScaledQuantity(232.5, 'grams', 'g'), 233);
assert.strictEqual(roundScaledQuantity(100.2, 'grams', 'g'), 100);

// Milliliters (round to whole number): 333.33ml -> 333ml
assert.strictEqual(roundScaledQuantity(333.33, 'milliliters', 'ml'), 333);

// Kilograms (up to 2 decimal places): 1.234kg -> 1.23kg, 0.375kg -> 0.38kg
assert.strictEqual(roundScaledQuantity(1.234, 'kilograms', 'kg'), 1.23);
assert.strictEqual(roundScaledQuantity(0.375, 'kilograms', 'kg'), 0.38);

// Pieces (round up with Math.ceil): 1.2 pieces -> 2 pieces, 0.3 heads -> 1 head
assert.strictEqual(roundScaledQuantity(1.2, 'pieces', 'pcs'), 2);
assert.strictEqual(roundScaledQuantity(0.3, 'pieces', 'pcs'), 1);

// Eggs (round up with Math.ceil): 1.5 eggs -> 2 eggs, 2.1 egg whites -> 3 egg whites
assert.strictEqual(roundScaledQuantity(1.5, 'eggs', 'eggs'), 2);
assert.strictEqual(roundScaledQuantity(2.1, 'eggs', 'eggs'), 3);

// Mixed fractions parsing: "1 1/2 cups water", "½ tsp black pepper"
const parsedMixed = parseIngredient('1 1/2 cups water');
assert.strictEqual(parsedMixed.quantity, 1.5);
assert.strictEqual(parsedMixed.unitCategory, 'cups');

const parsedVulgar = parseIngredient('½ tsp ground black pepper');
assert.strictEqual(parsedVulgar.quantity, 0.5);
assert.strictEqual(parsedVulgar.unitCategory, 'teaspoons');

// Unstructured / qualitative strings
const unstruct1 = scaleIngredient('Pinch of pure non-iodized kosher salt', 1.5);
assert.strictEqual(unstruct1.structured, false);
assert.strictEqual(unstruct1.scaledText, 'Pinch of pure non-iodized kosher salt');

const unstruct2 = scaleIngredient('Fresh calamansi wedges for serving (to taste)', 2);
assert.strictEqual(unstruct2.structured, false);
assert.strictEqual(unstruct2.scaledText, 'Fresh calamansi wedges for serving (to taste)');
console.log('  ✅ Test F Passed: All measurement categories, fractions, and unstructured lines handled properly.\n');

// ----------------------------------------------------
// Test G: Dietary Compliance & Clinical Safety
// ----------------------------------------------------
console.log('Test G: Scaled recipes maintain dietary compliance');
const lidSampleMeal = DIET_RECIPES.lid.meals[0];
assert.ok(lidSampleMeal, 'LID meal exists');

// Scale LID meal to 8 members (2x)
const scaledLidMeal = scaleRecipe(lidSampleMeal, 8);
const lidAudit = analyzeRecipe(scaledLidMeal.name, scaledLidMeal.scaledIngredientLines.join('\n'), 'lid');

assert.strictEqual(lidAudit.overallStatus, 'SAFE', 'Scaled LID recipe must remain strictly SAFE');
assert.strictEqual(lidAudit.avoidCount, 0, 'No non-compliant ingredients should be flagged in scaled recipe');

// Scale Keto meal to 6 members
const ketoSampleMeal = DIET_RECIPES.pinoy_keto.meals[0];
const scaledKetoMeal = scaleRecipe(ketoSampleMeal, 6);
const ketoAudit = analyzeRecipe(scaledKetoMeal.name, scaledKetoMeal.scaledIngredientLines.join('\n'), 'pinoy_keto');
assert.strictEqual(ketoAudit.overallStatus, 'SAFE', 'Scaled Keto recipe must remain SAFE');
assert.strictEqual(ketoAudit.avoidCount, 0, 'No avoid ingredients in scaled Keto recipe');

console.log('  ✅ Test G Passed: Scaled recipes fully preserve clinical safety and dietary compliance.\n');

// ----------------------------------------------------
// Test H: Summary
// ----------------------------------------------------
console.log('════════════════════════════════════════════════════');
console.log('🎉 ALL RECIPE PORTION SCALING TESTS PASSED CLEANLY!');
console.log('════════════════════════════════════════════════════\n');
