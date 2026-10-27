import assert from 'node:assert';
import { DIET_RECIPES } from '../src/data/dietRecipes.js';
import { analyzeRecipe } from '../src/services/ruleEngine.js';
import { LID_DATABASE, FOOD_DATABASE } from '../src/data/lidDatabase.js';

console.log('🧪 Starting Multi-Diet Collections & Reactive Explanation Tests...\n');

// 1. Verify DIET_RECIPES Schema
console.log('Test 1: Verify DIET_RECIPES covers all 5 protocols with complete schemas');
const expectedDiets = ['lid', 'diabetic', 'low_purine', 'low_sodium', 'pinoy_keto'];
for (const diet of expectedDiets) {
  const data = DIET_RECIPES[diet];
  assert.ok(data, `Diet ${diet} should exist in DIET_RECIPES`);
  assert.ok(typeof data.title === 'string' && data.title.length > 0, `Diet ${diet} must have title`);
  assert.ok(typeof data.description === 'string' && data.description.length > 0, `Diet ${diet} must have description`);
  assert.ok(data.sampleAudit && typeof data.sampleAudit.name === 'string', `Diet ${diet} must have sampleAudit`);
  assert.strictEqual(data.sampleAudit.violations, 0, `Diet ${diet} sample audit must target 0 violations`);
  assert.ok(Array.isArray(data.meals) && data.meals.length >= 3, `Diet ${diet} must have at least 3 meals`);
  
  for (const meal of data.meals) {
    assert.ok(meal.id, `Meal must have id in diet ${diet}`);
    assert.ok(meal.name, `Meal must have name in diet ${diet}`);
    assert.ok(meal.type, `Meal must have type (e.g. Mains, Soups & Stews, Snacks & Sides) in diet ${diet}`);
    assert.ok(meal.prepTime, `Meal must have prepTime in diet ${diet}`);
    assert.ok(meal.cookTime, `Meal must have cookTime in diet ${diet}`);
    assert.ok(meal.tag, `Meal must have tag in diet ${diet}`);
    assert.ok(Array.isArray(meal.ingredients) && meal.ingredients.length > 0, `Meal must have ingredients in diet ${diet}`);
  }
}
console.log('  ✅ All 5 dietary collections and meal schemas verified successfully.\n');

// 2. Verify Sample Audits for each diet produce 0 violations on their corresponding protocol
console.log('Test 2: Sample Audits for all diets produce 0 violations on active protocol');
for (const diet of expectedDiets) {
  const currentDietData = DIET_RECIPES[diet];
  const sampleMeal = currentDietData.meals.find(m => 
    m.name.toLowerCase().includes(currentDietData.sampleAudit.name.toLowerCase()) ||
    currentDietData.sampleAudit.name.toLowerCase().includes(m.name.toLowerCase())
  ) || currentDietData.meals[0];

  const recipeText = sampleMeal.ingredients.join('\n');
  const audit = analyzeRecipe(currentDietData.sampleAudit.name, recipeText, diet);
  
  assert.strictEqual(audit.avoidCount, 0, `Sample audit for ${diet} (${currentDietData.sampleAudit.name}) should have 0 avoid violations, got ${audit.avoidCount}`);
  assert.strictEqual(audit.overallStatus, 'SAFE', `Sample audit for ${diet} should be SAFE`);
}
console.log('  ✅ All sample audits return 0 violations on active protocol.\n');

// 3. Verify Risky Recipe is caught with violations across diets
console.log('Test 3: Risky non-compliant recipe catches violations across protocols');
const riskyRecipeText = `1 lb beef chuck roast cubes\n2 tbsp brown sugar\n2 tbsp commercial bouillon\n2 tbsp soy sauce (toyo)\n1 tsp iodized table salt`;
for (const diet of expectedDiets) {
  const audit = analyzeRecipe('Careless Stew', riskyRecipeText, diet);
  assert.ok(audit.avoidCount > 0, `Careless Stew must have violations on diet ${diet}`);
  assert.strictEqual(audit.overallStatus, 'AVOID', `Careless Stew must be AVOID on diet ${diet}`);
}
console.log('  ✅ Non-compliant recipe violations detected accurately across protocols.\n');

// 4. Verify Reactive Ingredient Card Descriptions
console.log('Test 4: Ingredient card descriptions react to active diet');
const iodizedSalt = LID_DATABASE.find(item => item.id === 'salt-iodized');
assert.ok(iodizedSalt, 'salt-iodized must exist in database');

// Under Diabetic
const diabeticNote = iodizedSalt.dietaryStatus?.diabetic?.note;
assert.ok(diabeticNote.includes('Zero carbs, but monitor sodium intake to protect cardiovascular health.'), 'Diabetic note for iodized salt must match prompt specification');

// Under Low-Sodium
const lowSodiumNote = iodizedSalt.dietaryStatus?.low_sodium?.note;
assert.ok(lowSodiumNote.includes('Strictly avoid — use fresh herbs, calamansi, and garlic instead.'), 'Low-sodium note for iodized salt must match prompt specification');

// Under LID
const lidNote = iodizedSalt.dietaryStatus?.lid?.note;
assert.ok(lidNote.includes('Severe contraindication for RAI'), 'LID note for iodized salt must be present');

console.log('  ✅ Ingredient card reactive explanations strictly verified.\n');

// 5. Verify Optimized Image URLs on FOOD_DATABASE and DIET_RECIPES
console.log('Test 5: Verify optimized imageUrl properties on FOOD_DATABASE and DIET_RECIPES');
assert.ok(FOOD_DATABASE, 'FOOD_DATABASE must be exported as alias for LID_DATABASE');

// Check that FOOD_DATABASE items have imageUrl with sizing parameters
for (const item of FOOD_DATABASE) {
  assert.ok(item.imageUrl, `Food item ${item.id} must have an imageUrl`);
  assert.ok(item.imageUrl.includes('auto=format'), `Food item ${item.id} imageUrl must include auto=format parameter`);
  assert.ok(item.imageUrl.includes('w='), `Food item ${item.id} imageUrl must include responsive width parameter`);
}
console.log(`  ✅ All ${FOOD_DATABASE.length} food items have verified responsive imageUrl properties.`);

// Check that all meals in DIET_RECIPES have imageUrl with sizing parameters
for (const [diet, dietData] of Object.entries(DIET_RECIPES)) {
  for (const meal of dietData.meals) {
    assert.ok(meal.imageUrl, `Meal ${meal.id} under ${diet} must have an imageUrl`);
    assert.ok(meal.imageUrl.includes('auto=format'), `Meal ${meal.id} imageUrl must include auto=format parameter`);
    assert.ok(meal.imageUrl.includes('w='), `Meal ${meal.id} imageUrl must include responsive width parameter`);
  }
}
console.log('  ✅ All DIET_RECIPES meals have verified responsive imageUrl properties.\n');

console.log('🎉 ALL MULTI-DIET REFACTOR & IMAGE THUMBNAIL TESTS PASSED SUCCESSFULLY!');
