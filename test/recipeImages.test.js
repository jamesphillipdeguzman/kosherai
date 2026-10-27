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

// 1d: Relative Cloudinary public ID correctly mapped with optimization parameters
const publicId = 'kosherai/pinoy-keto/recipes/chicharon';
const expectedCloudinaryUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_800/${publicId}`;
assert.strictEqual(getRecipeImageUrl(publicId), expectedCloudinaryUrl, 'Public ID must format into optimized Cloudinary URL');

// 1e: Leading slash stripping
assert.strictEqual(getRecipeImageUrl('/' + publicId), expectedCloudinaryUrl, 'Leading slash should be stripped cleanly');

console.log('  ✅ getRecipeImageUrl URL formatting verified successfully.');

// ----------------------------------------------------
// Test 2: DIET_RECIPES across all 5 protocols have mapped Cloudinary images
// ----------------------------------------------------
console.log('\nTest 2: Verification of Cloudinary image paths across all 5 diet protocols');

const expectedDietFolders = {
  lid: 'kosherai/lid_protocol/recipes',
  diabetic: 'kosherai/diabetic/recipes',
  low_purine: 'kosherai/low-purine/recipes',
  low_sodium: 'kosherai/low-sodium/recipes',
  pinoy_keto: 'kosherai/pinoy-keto/recipes'
};

const dietKeys = Object.keys(expectedDietFolders);

for (const diet of dietKeys) {
  const protocol = DIET_RECIPES[diet];
  assert.ok(protocol, `Protocol "${diet}" must exist in DIET_RECIPES`);
  assert.ok(Array.isArray(protocol.meals), `Protocol "${diet}" must contain meals array`);
  assert.strictEqual(protocol.meals.length, 4, `Protocol "${diet}" must have 4 recipes`);

  const targetFolder = expectedDietFolders[diet];

  for (const meal of protocol.meals) {
    assert.ok(meal.id, `Meal must have an id: ${JSON.stringify(meal)}`);
    assert.ok(meal.title || meal.name, `Meal must have a title or name: ${meal.id}`);
    assert.ok(meal.image, `Meal "${meal.id}" in ${diet} must define an image property`);
    assert.ok(meal.imageUrl, `Meal "${meal.id}" in ${diet} must define an imageUrl property`);
    
    // Check that it points to the designated Cloudinary folder
    assert.ok(
      meal.image.startsWith(targetFolder),
      `Meal "${meal.id}" image "${meal.image}" must start with folder "${targetFolder}"`
    );

    // Verify URL resolution works
    const resolvedUrl = getRecipeImageUrl(meal.image);
    assert.ok(
      resolvedUrl.includes(`https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_800/${targetFolder}`),
      `Resolved URL must be an optimized Cloudinary delivery URL for ${meal.id}`
    );
  }

  console.log(`  ✅ Protocol "${diet}" verified (4/4 dishes configured with Cloudinary folder "${targetFolder}")`);
}

// ----------------------------------------------------
// Test 3: CookModeTab HTML Rendering with Cloudinary Images & Fallbacks
// ----------------------------------------------------
console.log('\nTest 3: CookModeTab rendering with Cloudinary images & onError fallbacks');

const mockState = {
  checklistState: {},
  recipeAnalysis: null,
  recipeText: '',
  recipeCategoryFilter: 'ALL',
  activeDiet: 'pinoy_keto'
};

const html = renderCookModeTab(mockState);

// Verify Cloudinary URL is rendered inside image tags
assert.ok(html.includes('https://res.cloudinary.com/'), 'HTML output must render Cloudinary image URLs');
assert.ok(html.includes('kosherai/pinoy-keto/recipes/chicharon'), 'HTML output must render chicharon Cloudinary recipe asset');
assert.ok(html.includes('kosherai/pinoy-keto/recipes/keto_adobo'), 'HTML output must render keto_adobo Cloudinary recipe asset');
assert.ok(html.includes('kosherai/pinoy-keto/recipes/sinigang'), 'HTML output must render sinigang Cloudinary recipe asset');
assert.ok(html.includes('kosherai/pinoy-keto/recipes/keto_silog'), 'HTML output must render keto_silog Cloudinary recipe asset');

// Verify onError fallback logic is attached
assert.ok(html.includes('dataset.fallbackApplied'), 'Image onerror handler must include fallback guard');
assert.ok(html.includes('https://images.unsplash.com/photo-1546069901-ba9599a7e63c'), 'Image onerror handler must fallback to Unsplash dish image');

console.log('  ✅ CookModeTab HTML rendering with Cloudinary delivery and resilient onError verified.');

console.log('\n🎉 ALL CLOUDINARY RECIPE IMAGE TESTS PASSED!\n');
