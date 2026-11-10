// Verification test suite for: Move Admin Ingredient Image Management to Cook Mode & Fix Image Scaling
import assert from 'node:assert';
import fs from 'node:fs';
import { renderCookModeTab } from '../src/components/CookModeTab.js';
import { renderSettingsModal } from '../src/components/SettingsModal.js';
import { renderIngredientImageAdminModal } from '../src/components/IngredientImageAdminModal.js';
import adminImagesHandler from '../api/admin/ingredient-images.js';

console.log('🧪 Starting Cook Mode Admin Image & Scaling Verification Suite...\n');

// ----------------------------------------------------------------------------
// 1. SettingsModal Verification: Shortcut Removed
// ----------------------------------------------------------------------------
console.log('1. SettingsModal Verification');
{
  const settingsHtml = renderSettingsModal({}, 'dark', true, 'lid');
  assert.strictEqual(
    settingsHtml.includes('id="open-ingredient-admin-btn"'),
    false,
    'SettingsModal must NOT contain open-ingredient-admin-btn'
  );
  assert.strictEqual(
    settingsHtml.includes('Ingredient Image Management</span>'),
    false,
    'SettingsModal must NOT contain Ingredient Image Management heading'
  );
  console.log('  ✅ Admin photo shortcut completely removed from SettingsModal.');
}

// ----------------------------------------------------------------------------
// 2. CookModeTab Verification: Admin vs Regular User
// ----------------------------------------------------------------------------
console.log('\n2. CookModeTab Verification (Admin vs Regular User)');
{
  // Admin user
  const adminCookHtml = renderCookModeTab({
    isAdmin: true,
    activeDiet: 'lid'
  });
  assert.ok(
    adminCookHtml.includes('id="open-ingredient-admin-cook-btn"'),
    'CookModeTab must render open-ingredient-admin-cook-btn when isAdmin is true'
  );
  assert.ok(
    adminCookHtml.includes('Manage Ingredient Photos'),
    'CookModeTab must render Manage Ingredient Photos label for admin'
  );

  // Regular user (isAdmin: false)
  const regularCookHtml = renderCookModeTab({
    isAdmin: false,
    activeDiet: 'lid'
  });
  assert.strictEqual(
    regularCookHtml.includes('id="open-ingredient-admin-cook-btn"'),
    false,
    'CookModeTab must NOT render open-ingredient-admin-cook-btn for regular user'
  );

  // Logged-out user (no user, no isAdmin)
  const loggedOutCookHtml = renderCookModeTab({
    activeDiet: 'lid'
  });
  assert.strictEqual(
    loggedOutCookHtml.includes('id="open-ingredient-admin-cook-btn"'),
    false,
    'CookModeTab must NOT render open-ingredient-admin-cook-btn for logged-out user'
  );

  console.log('  ✅ Cook Mode action properly restricted to authenticated admin only.');
}

// ----------------------------------------------------------------------------
// 3. AdminIngredientImagesModal.jsx Code Inspection
// ----------------------------------------------------------------------------
console.log('\n3. AdminIngredientImagesModal.jsx Code Inspection');
{
  const jsxCode = fs.readFileSync('src/components/AdminIngredientImagesModal.jsx', 'utf8');

  // Grid Gallery constraints: responsive grid columns
  assert.ok(
    jsxCode.includes('grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3'),
    'Must render responsive grid (grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3)'
  );

  // Thumbnail container: h-24 sm:h-28, overflow-hidden, dark bg, centered
  assert.ok(
    jsxCode.includes('h-24 sm:h-28'),
    'Thumbnail container must use h-24 sm:h-28'
  );
  assert.ok(
    jsxCode.includes('overflow-hidden') && jsxCode.includes('bg-slate-950') && jsxCode.includes('flex items-center justify-center'),
    'Thumbnail container must use overflow-hidden, dark background, and centering'
  );

  // Thumbnail scaling: object-contain (never object-cover)
  assert.ok(
    jsxCode.includes('object-contain'),
    'Thumbnail image must use object-contain'
  );
  assert.ok(
    !jsxCode.includes('object-cover'),
    'Thumbnail image must NEVER use object-cover'
  );

  // Quick Replace / Upload
  assert.ok(
    jsxCode.includes('Replace') && jsxCode.includes('+ Upload'),
    'Card must provide quick Replace / + Upload'
  );

  console.log('  ✅ React AdminIngredientImagesModal Grid Gallery verified.');
}

// ----------------------------------------------------------------------------
// 4. IngredientImageAdminModal.js Code Inspection
// ----------------------------------------------------------------------------
console.log('\n4. IngredientImageAdminModal.js Code Inspection');
{
  const jsModalHtml = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    uploadFormOpen: true,
    uploadPreviewUrl: 'https://res.cloudinary.com/test/image/upload/sample.webp'
  });

  assert.ok(
    jsModalHtml.includes('max-w-') || jsModalHtml.includes('max-h-'),
    'Vanilla modal must enforce layout constraints'
  );
  assert.ok(
    jsModalHtml.includes('overflow-hidden') && (jsModalHtml.includes('bg-black/60') || jsModalHtml.includes('bg-slate-950')) && jsModalHtml.includes('flex items-center justify-center') &&
    (jsModalHtml.includes('h-72 sm:h-80') || jsModalHtml.includes('h-48 sm:h-56') || jsModalHtml.includes('h-44 sm:h-48')),
    'Vanilla modal must use standardized container'
  );
  assert.ok(
    jsModalHtml.includes('object-contain'),
    'Vanilla modal must enforce object-contain'
  );

  console.log('  ✅ Vanilla IngredientImageAdminModal constraints verified.');
}

// ----------------------------------------------------------------------------
// 5. CSS Rules Verification in style.css
// ----------------------------------------------------------------------------
console.log('\n5. style.css Rules Verification');
{
  const css = fs.readFileSync('src/style.css', 'utf8');

  assert.ok(
    css.includes('.admin-image-modal-box {') || css.includes('.admin-manage-page-container'),
    'style.css must constrain modal or manage container'
  );
  assert.ok(
    (css.includes('height: 18rem !important;') || css.includes('height: 12rem !important;')),
    'style.css must enforce preview container height'
  );
  assert.ok(
    css.includes('object-fit: contain !important;'),
    'style.css must enforce object-fit: contain on preview images'
  );

  console.log('  ✅ CSS constraints verified.');
}

// ----------------------------------------------------------------------------
// 6. Server Admin Route Security Verification
// ----------------------------------------------------------------------------
console.log('\n6. Server Admin Route Security Verification');
{
  let unauthCode = null;
  const mockUnauthRes = {
    setHeader: () => {},
    status: (code) => { unauthCode = code; return mockUnauthRes; },
    json: () => {}
  };
  await adminImagesHandler({ method: 'GET', url: '/api/admin/ingredient-images' }, mockUnauthRes);
  assert.strictEqual(unauthCode, 401, 'Unauthenticated request to admin endpoint must return 401');

  console.log('  ✅ Server-side admin authorization guard intact (401 Unauthorized for unauthenticated requests).');
}

console.log('\n======================================================================');
console.log('🎉 ALL COOK MODE & IMAGE SCALING VERIFICATION CHECKS PASSED!');
console.log('======================================================================\n');

