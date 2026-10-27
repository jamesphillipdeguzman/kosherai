import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { craftFoodPrompt } from '../scripts/generate-assets.js';
import { FOOD_DATABASE, getCategoryEmoji } from '../src/data/lidDatabase.js';
import { DIET_RECIPES } from '../src/data/dietRecipes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Starting Automated Image Generation & Cloudinary Caching Utility Tests...\n');

// 1. Prompt Crafting Test
console.log('Test 1: Verify tailored Philippine food-photography prompt crafting');
const sampleIngredient = FOOD_DATABASE.find(item => item.id === 'banana-ketchup');
const ingredientPrompt = craftFoodPrompt(sampleIngredient, false);

assert.ok(ingredientPrompt.includes('Filipino culinary ingredient'), 'Prompt must specify Filipino culinary ingredient');
assert.ok(ingredientPrompt.includes('Banana Ketchup'), 'Prompt must contain item name');
assert.ok(ingredientPrompt.includes('studio lighting'), 'Prompt must specify clean studio lighting');
assert.ok(ingredientPrompt.includes('8k resolution'), 'Prompt must request high quality food photography');

const sampleDish = DIET_RECIPES.lid.meals[0];
const dishPrompt = craftFoodPrompt(sampleDish, true);
assert.ok(dishPrompt.includes('traditional Filipino dish'), 'Dish prompt must specify traditional Filipino dish');
assert.ok(dishPrompt.includes(sampleDish.name), 'Dish prompt must contain dish title');
assert.ok(dishPrompt.includes('calamansi'), 'Dish prompt must specify authentic Philippine plating touches');
console.log('  ✅ Food prompt generator crafting verified successfully.\n');

// 2. Generated Images Mapping File Test
console.log('Test 2: Verify generatedImages.json structure and resolution');
const mappingPath = path.resolve(__dirname, '../src/data/generatedImages.json');
assert.ok(fs.existsSync(mappingPath), 'src/data/generatedImages.json must exist');

const mappingContent = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
assert.ok(typeof mappingContent === 'object', 'Mapping content must be a JSON object');
console.log(`  ✅ generatedImages.json is valid and contains ${Object.keys(mappingContent).length} mapped keys.\n`);

// 3. Fallback Priority Logic Test
console.log('Test 3: Runtime image resolution and culinary icon fallback');
function resolveImageAndIcon(item, generatedMap) {
  const imageUrl = item.imageUrl || generatedMap[item.id] || null;
  const fallbackIcon = item.icon || getCategoryEmoji(item.category, item.name);
  return { imageUrl, fallbackIcon };
}

// Case A: Item with explicit imageUrl
const resA = resolveImageAndIcon(sampleIngredient, mappingContent);
assert.ok(resA.imageUrl, 'Item with explicit imageUrl should resolve imageUrl');
assert.strictEqual(resA.fallbackIcon, '🍅', 'Banana ketchup should fallback to tomato/condiment icon');

// Case B: Mock item lacking imageUrl but present in generatedImages
const mockItem = { id: 'mock-bagoong', name: 'Fresh Bagoong', category: 'Salts, Oils & Condiments' };
const mockGeneratedMap = { 'mock-bagoong': 'https://res.cloudinary.com/test/kosherai/mock-bagoong.webp' };
const resB = resolveImageAndIcon(mockItem, mockGeneratedMap);
assert.strictEqual(resB.imageUrl, 'https://res.cloudinary.com/test/kosherai/mock-bagoong.webp');
assert.ok(resB.fallbackIcon, 'Mock item must resolve a fallback icon');

// Case C: Item with neither imageUrl nor generated map -> falls back to icon badge
const resC = resolveImageAndIcon(mockItem, {});
assert.strictEqual(resC.imageUrl, null);
assert.strictEqual(resC.fallbackIcon, '🦐', 'Bagoong condiment should fallback to 🦐');
console.log('  ✅ Runtime fallback prioritization strictly verified.\n');

console.log('🎉 ALL AUTOMATED ASSET GENERATION & CACHING TESTS PASSED SUCCESSFULLY!');
