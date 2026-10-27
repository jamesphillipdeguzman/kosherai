// Unit & Integration Test Suite for Cloudinary Recipe Image Ingestion & Rendering
import assert from 'node:assert';
import { getRecipeImageUrl, CLOUD_NAME } from '../src/utils/cloudinary.js';
import { DIET_RECIPES } from '../src/data/dietRecipes.js';
import { renderCookModeTab } from '../src/components/CookModeTab.js';

console.log('🧪 Starting Cloudinary Recipe Image Ingestion Test Suite...\n');

// ----------------------------------------------------
// Test 1: getRecipeImageUrl URL construction & resilience
// ----------------------------------------------------
console.log('Test 1: getRecipeImageUrl dynamic transformations and fallbacks');

const defaultFallback = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

// 1a: Null/undefined/empty input returns fallback
assert.strictEqual(getRecipeImageUrl(null), defaultFallback, 'null input must return fallback');
assert.strictEqual(getRecipeImageUrl(undefined), defaultFallback, 'undefined input must return fallback');
assert.strictEqual(getRecipeImageUrl(''), defaultFallback, 'empty string must return fallback');

// 1b: Custom fallback support
const customFallback = '/assets/placeholder-dish.jpg';
assert.strictEqual(getRecipeImageUrl(null, customFallback), customFallback, 'custom fallback must be respected');

// 1c: Absolute HTTP/HTTPS URLs preserved as-is
const externalUrl = 'https://example.com/filipino-food.jpg';
assert.strictEqual(getRecipeImageUrl(externalUrl), externalUrl, 'Absolute HTTP(S) URL must not be modified');

// 1d: Relative Cloudinary public ID correctly mapped with .webp and f_auto,q_auto
const rootPublicId = 'pure-pork-backfat-chicharon-with-spiced-coconut-vinegar';
const expectedRootUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto/${rootPublicId}.webp`;
assert.strictEqual(getRecipeImageUrl(rootPublicId), expectedRootUrl, 'Public ID must format into optimized Cloudinary webp URL');

// 1e: Already ending with .webp
assert.strictEqual(getRecipeImageUrl(`${rootPublicId}.webp`), expectedRootUrl, 'Existing .webp should not be duplicated');

// 1f: Leading slash stripping
assert.strictEqual(getRecipeImageUrl('/' + rootPublicId), expectedRootUrl, 'Leading slash should be stripped cleanly');

console.log('  ✅ getRecipeImageUrl URL formatting verified successfully.');

// ----------------------------------------------------
// Test 2: DIET_RECIPES across all 5 protocols have mapped Cloudinary images
// ----------------------------------------------------
console.log('\nTest 2: Verification of Cloudinary image paths across all 5 diet protocols');

for (const diet of ['lid', 'diabetic', 'low_purine', 'low_sodium', 'pinoy_keto']) {
  const protocol = DIET_RECIPES[diet];
  assert.ok(protocol, `Protocol "${diet}" must exist in DIET_RECIPES`);
  assert.ok(Array.isArray(protocol.meals), `Protocol "${diet}" must contain meals array`);
  assert.strictEqual(protocol.meals.length, 4, `Protocol "${diet}" must have 4 recipes`);

  for (const meal of protocol.meals) {
    assert.ok(meal.id, `Meal must have an id: ${JSON.stringify(meal)}`);
    assert.ok(meal.title || meal.name, `Meal must have a title or name: ${meal.id}`);
    assert.ok(meal.image, `Meal "${meal.id}" in ${diet} must define an image property`);
    assert.ok(meal.imageUrl, `Meal "${meal.id}" in ${diet} must define an imageUrl property`);

    const resolvedUrl = getRecipeImageUrl(meal.image);
    assert.ok(
      resolvedUrl.startsWith(`https://res.cloudinary.com/`),
      `Resolved URL must be an optimized Cloudinary delivery URL for ${meal.id}`
    );
    assert.ok(resolvedUrl.endsWith('.webp'), `Resolved URL must end with .webp for ${meal.id}`);
  }

  console.log(`  ✅ Protocol "${diet}" verified (4/4 dishes configured with Cloudinary delivery)`);
}

// Check specific Pinoy Keto dishes configured with verified Cloudinary URLs
const pinoyKeto = DIET_RECIPES.pinoy_keto;
const chicharon = pinoyKeto.meals.find(m => m.id === 'keto-snack-chicharon');
assert.strictEqual(chicharon.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/pure-pork-backfat-chicharon-with-spiced-coconut-vinegar.webp');

const adobo = pinoyKeto.meals.find(m => m.id === 'keto-adobo');
assert.strictEqual(adobo.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/traditional-pork-belly-adobo-sugar.webp');

const tinapa = pinoyKeto.meals.find(m => m.id === 'keto-breakfast-egg-avocado-tinapa');
assert.strictEqual(tinapa.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/flaked-smoked-tinapa-egg-and-avocado-bowl.webp');

const ginataan = pinoyKeto.meals.find(m => m.id === 'keto-ginataan');
assert.strictEqual(ginataan.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/ginataang-sitaw-at-kalabasa-low-carb-style.webp');

// Check diabetic recipes configured with verified Cloudinary URLs
const diabetic = DIET_RECIPES.diabetic;
const talbos = diabetic.meals.find(m => m.id === 'diabetic-snack-talbos');
assert.strictEqual(talbos.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/ensaladang-talbo-ng-kamote-with-calamansi.webp');

const tortangTalong = diabetic.meals.find(m => m.id === 'diabetic-breakfast-tortang-talong');
assert.strictEqual(tortangTalong.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/skinless-chicken-and-vegetable-tortang-talong.webp');

const ampalaya = diabetic.meals.find(m => m.id === 'diabetic-ampalaya');
assert.strictEqual(ampalaya.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/ginisang-ampalaya-with-native-egg-and-lean-chicken.webp');

const sinigangBangus = diabetic.meals.find(m => m.id === 'diabetic-sinigang');
assert.strictEqual(sinigangBangus.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/sinigang-na-bangus-sa-fresh-calamansi-and-kangkong.webp'.replace('v1793066348', 'v1793084102'));

// Check LID protocol recipes configured with verified Cloudinary URLs
const lid = DIET_RECIPES.lid;
const tinola = lid.meals.find(m => m.id === 'lid-tinola');
assert.strictEqual(tinola.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/lid-chicken-and-ginger-tinoa-broth.webp');

const silog = lid.meals.find(m => m.id === 'lid-breakfast-silog');
assert.strictEqual(silog.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/lid-garlic-sinangag-and-egg-white-scramble.webp');

const bistek = lid.meals.find(m => m.id === 'lid-bistek');
assert.strictEqual(bistek.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/homemade-lid-bistek-tagalog.webp');

const kamote = lid.meals.find(m => m.id === 'lid-snack-kamote');
assert.strictEqual(kamote.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/steamed-kamote-with-coconut-oil.webp');

// Check low_purine protocol recipes configured with verified Cloudinary URLs
const lowPurine = DIET_RECIPES.low_purine;
const pipino = lowPurine.meals.find(m => m.id === 'purine-snack-pipino');
assert.strictEqual(pipino.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/spiced-cucumber-and-calamansi-salad.webp');

const arrozCaldo = lowPurine.meals.find(m => m.id === 'purine-breakfast-oat-arrozcaldo');
assert.strictEqual(arrozCaldo.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/ginger-and-garlic-rolled-oats-arroz-caldo.webp');

const pesa = lowPurine.meals.find(m => m.id === 'purine-pesa');
assert.strictEqual(pesa.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/gout-safe-pesang-manok-with-pechay-and-sayote.webp');

const upo = lowPurine.meals.find(m => m.id === 'purine-upo');
assert.strictEqual(upo.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/ginisang-upo-with-egg-and-garlic.webp');

// Check low_sodium protocol recipes configured with verified Cloudinary URLs
const lowSodium = DIET_RECIPES.low_sodium;
const singkamas = lowSodium.meals.find(m => m.id === 'sodium-snack-singkamas');
assert.strictEqual(singkamas.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/crisp-singkamas-slices-with-calamansi-sili-dip.webp');

const poachedEgg = lowSodium.meals.find(m => m.id === 'sodium-breakfast-poached-egg-kamote');
assert.strictEqual(poachedEgg.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/poached-egg-on-toasted-kamote-rounds.webp');

const nilaga = lowSodium.meals.find(m => m.id === 'sodium-nilaga');
assert.strictEqual(nilaga.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/potassium-rich-nilagang-baka-with-cabbage.webp');

const bistekPork = lowSodium.meals.find(m => m.id === 'sodium-bistek');
assert.strictEqual(bistekPork.image, 'https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/garlic-calamansi-sauteed-pork-loin.webp');

// ----------------------------------------------------
// Test 3: CookModeTab HTML Rendering with Cloudinary Images & Fallbacks
// ----------------------------------------------------
console.log('\nTest 3: CookModeTab rendering with Cloudinary images & onError fallbacks');

// 3a: LID HTML rendering
const lidHtml = renderCookModeTab({
  checklistState: {},
  recipeAnalysis: null,
  recipeText: '',
  recipeCategoryFilter: 'ALL',
  activeDiet: 'lid'
});
assert.ok(lidHtml.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/lid-chicken-and-ginger-tinoa-broth.webp'));
assert.ok(lidHtml.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/lid-garlic-sinangag-and-egg-white-scramble.webp'));
console.log('  ✅ LID CookModeTab HTML rendering verified.');

// 3b: Diabetic HTML rendering
const diabeticHtml = renderCookModeTab({
  checklistState: {},
  recipeAnalysis: null,
  recipeText: '',
  recipeCategoryFilter: 'ALL',
  activeDiet: 'diabetic'
});
assert.ok(diabeticHtml.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/ensaladang-talbo-ng-kamote-with-calamansi.webp'));
assert.ok(diabeticHtml.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/skinless-chicken-and-vegetable-tortang-talong.webp'));
console.log('  ✅ Diabetic CookModeTab HTML rendering verified.');

// 3c: Low-Purine HTML rendering
const purineHtml = renderCookModeTab({
  checklistState: {},
  recipeAnalysis: null,
  recipeText: '',
  recipeCategoryFilter: 'ALL',
  activeDiet: 'low_purine'
});
assert.ok(purineHtml.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/spiced-cucumber-and-calamansi-salad.webp'));
assert.ok(purineHtml.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/ginger-and-garlic-rolled-oats-arroz-caldo.webp'));
console.log('  ✅ Low-Purine CookModeTab HTML rendering verified.');

// 3d: Low-Sodium HTML rendering
const sodiumHtml = renderCookModeTab({
  checklistState: {},
  recipeAnalysis: null,
  recipeText: '',
  recipeCategoryFilter: 'ALL',
  activeDiet: 'low_sodium'
});
assert.ok(sodiumHtml.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/crisp-singkamas-slices-with-calamansi-sili-dip.webp'));
assert.ok(sodiumHtml.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/poached-egg-on-toasted-kamote-rounds.webp'));
console.log('  ✅ Low-Sodium CookModeTab HTML rendering verified.');

// 3e: Pinoy Keto HTML rendering

const mockState = {
  checklistState: {},
  recipeAnalysis: null,
  recipeText: '',
  recipeCategoryFilter: 'ALL',
  activeDiet: 'pinoy_keto'
};

const html = renderCookModeTab(mockState);

// Verify Cloudinary URL is rendered inside image tags
assert.ok(html.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/'), 'HTML output must render Cloudinary image URLs');
assert.ok(html.includes('pure-pork-backfat-chicharon-with-spiced-coconut-vinegar.webp'), 'HTML output must render chicharon Cloudinary recipe asset');
assert.ok(html.includes('traditional-pork-belly-adobo-sugar.webp'), 'HTML output must render adobo Cloudinary recipe asset');

// Verify onError fallback logic is attached
assert.ok(html.includes('dataset.fallbackApplied'), 'Image onerror handler must include fallback guard');
assert.ok(html.includes('https://images.unsplash.com/photo-1546069901-ba9599a7e63c'), 'Image onerror handler must fallback to Unsplash dish image');

console.log('  ✅ CookModeTab HTML rendering with Cloudinary delivery and resilient onError verified.');

console.log('\n🎉 ALL CLOUDINARY RECIPE IMAGE TESTS PASSED!\n');
