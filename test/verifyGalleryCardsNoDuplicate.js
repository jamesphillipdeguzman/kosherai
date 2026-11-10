import assert from 'node:assert';
import { renderIngredientImageAdminModal } from '../src/components/IngredientImageAdminModal.js';
import fs from 'node:fs';

console.log('🧪 Starting Gallery Cards No-Duplicate & Full-Thumbnail Verification Suite...\n');

const mockMappings = [
  {
    id: 'img_lid_salt-kosher',
    protocol_id: 'lid',
    ingredient_id: 'salt-kosher',
    secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/f_auto,q_auto,w_400,c_limit/kosherai/lid_protocol/ingredients/salt-kosher',
    public_id: 'kosherai/lid_protocol/ingredients/salt-kosher',
    status: 'active'
  }
];

// ============================================================================
// TEST 1: Mapped active ingredient card renders only single photo thumbnail
// ============================================================================
console.log('Test 1: Mapped active card renders single photo without duplicate preview or error panel');
{
  const html = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    mappings: mockMappings,
    uploadFormOpen: false,
    embedded: true
  });

  // 1. Must NOT include "Image Error" anywhere in the gallery
  assert.ok(!html.includes('Image Error'), 'Must NOT render "Image Error" on mapped active photo cards');

  // 2. Extract salt-kosher card
  const saltCardStart = html.indexOf('data-ingredient-id="salt-kosher"');
  assert.ok(saltCardStart !== -1, 'Salt card must exist in the gallery');
  const saltCardEnd = html.indexOf('</div>\n          </div>', saltCardStart) + 20;
  const saltCardHtml = html.substring(saltCardStart, saltCardEnd);

  // 3. Must contain the img element
  assert.ok(saltCardHtml.includes('class="admin-preview-img"'), 'Must contain photo thumbnail image');
  assert.ok(saltCardHtml.includes('https://res.cloudinary.com/dego6hgcb/image/upload/f_auto,q_auto,w_400,c_limit/kosherai/lid_protocol/ingredients/salt-kosher'), 'Must use Cloudinary secure_url');

  // 4. Must NOT contain placeholder div inside mapped thumbnail
  const saltThumbContainerStart = saltCardHtml.indexOf('class="ingredient-card__image"');
  const saltThumbContainerEnd = saltCardHtml.indexOf('class="ingredient-card__details"');
  const saltThumbHtml = saltCardHtml.substring(saltThumbContainerStart, saltThumbContainerEnd);

  assert.ok(!saltThumbHtml.includes('<div class="ingredient-card__placeholder"'), 'Mapped card thumbnail container must NOT contain placeholder div element');
  assert.ok(!saltThumbHtml.includes('Image Error'), 'Thumbnail container must NOT contain Image Error text');
  assert.ok(!saltThumbHtml.includes('No Image'), 'Mapped thumbnail container must NOT contain No Image text');

  // 5. Must have onerror fallback that replaces broken img on genuine failure
  assert.ok(saltThumbHtml.includes('onerror='), 'Must include onerror fallback handler');
  assert.ok(saltThumbHtml.includes('replaceWith'), 'Onerror must replace broken img rather than rendering a permanent secondary container');

  console.log('  ✅ Mapped active card verified: single photo thumbnail, zero secondary preview, zero error text.');
}

// ============================================================================
// TEST 2: Unmapped missing ingredient card renders clean "No Image" placeholder
// ============================================================================
console.log('\nTest 2: Unmapped ingredient card renders single "No Image" placeholder');
{
  const html = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    mappings: mockMappings, // Only salt is mapped; other ingredients are unmapped
    uploadFormOpen: false,
    embedded: true
  });

  // Extract an unmapped card, e.g., salt-iodized
  const cardStart = html.indexOf('data-ingredient-id="salt-iodized"');
  assert.ok(cardStart !== -1, 'Salt iodized card must exist');
  const cardEnd = html.indexOf('</div>\n          </div>', cardStart) + 20;
  const cardHtml = html.substring(cardStart, cardEnd);

  const thumbStart = cardHtml.indexOf('class="ingredient-card__image"');
  const thumbEnd = cardHtml.indexOf('class="ingredient-card__details"');
  const thumbHtml = cardHtml.substring(thumbStart, thumbEnd);

  assert.ok(!thumbHtml.includes('<img'), 'Unmapped card must NOT contain <img> tag');
  assert.ok(thumbHtml.includes('ingredient-card__placeholder'), 'Unmapped card must contain placeholder');
  assert.ok(thumbHtml.includes('No Image'), 'Unmapped card must display "No Image"');
  assert.ok(!thumbHtml.includes('Image Error'), 'Unmapped card must NOT display "Image Error"');

  console.log('  ✅ Unmapped card verified: single centered "No Image" placeholder, zero error text.');
}

// ============================================================================
// TEST 3: CSS Constraints in admin-ingredient-gallery.css
// ============================================================================
console.log('\nTest 3: CSS rules for full-width thumbnail container and object-fit containment');
{
  const css = fs.readFileSync('src/styles/admin-ingredient-gallery.css', 'utf8');

  // Verify thumbnail container occupies 100% width with fixed heights
  assert.ok(css.includes('.ingredient-card__image {'), 'Must define .ingredient-card__image');
  assert.ok(css.includes('height: 125px'), 'Must define mobile thumbnail height 125px');
  assert.ok(css.includes('height: 145px'), 'Must define desktop thumbnail height 145px');
  assert.ok(css.includes('overflow: hidden'), 'Must define overflow: hidden on thumbnail container');

  // Verify mandatory containment rules
  assert.ok(css.includes('object-fit: contain'), 'Must enforce object-fit: contain');
  assert.ok(!css.includes('.ingredient-card__image img {\n  object-fit: cover'), 'Must NEVER use object-fit: cover on thumbnail img');

  // Verify placeholder has no forced !important that overrides inline display
  const placeholderRule = css.substring(css.indexOf('.ingredient-card__placeholder {'), css.indexOf('}', css.indexOf('.ingredient-card__placeholder {')));
  assert.ok(!placeholderRule.includes('display: flex !important'), 'Placeholder must NOT force display: flex !important');

  console.log('  ✅ CSS constraints verified: bounded 125px/145px container, object-fit: contain, no forced !important override.');
}

// ============================================================================
// TEST 4: React Components (AdminIngredientImagesView & Modal)
// ============================================================================
console.log('\nTest 4: React AdminIngredientImagesView and Modal alignment');
{
  const viewCode = fs.readFileSync('src/components/AdminIngredientImagesView.jsx', 'utf8');
  const modalCode = fs.readFileSync('src/components/AdminIngredientImagesModal.jsx', 'utf8');

  for (const [name, code] of [['View', viewCode], ['Modal', modalCode]]) {
    assert.ok(!code.includes('Image Error'), `${name} must not render "Image Error" text`);
    assert.ok(code.includes('admin-preview-img'), `${name} must use admin-preview-img`);
    assert.ok(code.includes('ingredient-card__placeholder'), `${name} must support placeholder`);
    assert.ok(code.includes('replaceWith'), `${name} must use replaceWith on onError`);
  }

  console.log('  ✅ React components verified: synchronized with single-thumbnail and clean error handling.');
}

console.log('\n======================================================================');
console.log('🎉 ALL GALLERY NO-DUPLICATE & THUMBNAIL EXPANSION TESTS PASSED!');
console.log('======================================================================\n');
