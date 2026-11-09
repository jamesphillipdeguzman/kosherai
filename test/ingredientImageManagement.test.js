// KosherAI - Cloudinary Ingredient Image Integration & Admin Management Tests
import assert from 'node:assert';
import {
  normalizeToken,
  inferProtocolFromPath,
  matchAssetToIngredient
} from '../lib/ingredientImageMatcher.js';
import { LID_DATABASE } from '../src/data/lidDatabase.js';
import {
  getIngredientImageUrl,
  initIngredientImageCache
} from '../src/services/ingredientImageService.js';
import { renderCheckerTab } from '../src/components/CheckerTab.js';
import { renderItemDetailModal } from '../src/components/ItemDetailModal.js';
import { renderSettingsModal } from '../src/components/SettingsModal.js';
import { renderIngredientImageAdminModal } from '../src/components/IngredientImageAdminModal.js';
import publicImagesHandler, { ensureIngredientImagesTable } from '../api/ingredient-images.js';
import adminImagesHandler from '../api/admin/ingredient-images.js';
import { isAdminUser } from '../lib/auth.js';

console.log('🧪 Starting KosherAI Cloudinary Ingredient Image Management Test Suite...\n');

// Mock in-memory localStorage for Node test runner
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// ============================================================================
// TEST 1: Token Normalization & Protocol Inference
// ============================================================================
console.log('Test 1: Token Normalization & Protocol Path Inference');
{
  assert.strictEqual(normalizeToken('Salt_Kosher.WEBP'), 'salt-kosher');
  assert.strictEqual(normalizeToken('v17938467/fresh_chicken_breast.jpg'), 'fresh-chicken-breast');
  assert.strictEqual(normalizeToken('Sayote (Chayote Squash).png'), 'sayote-chayote-squash');

  assert.strictEqual(inferProtocolFromPath('kosherai/lid/ingredients/salt-kosher'), 'lid');
  assert.strictEqual(inferProtocolFromPath('kosherai/pinoy_keto/ingredients/chicharon'), 'pinoy_keto');
  assert.strictEqual(inferProtocolFromPath('kosherai/low_purine/ingredients/sayote'), 'low_purine');
  assert.strictEqual(inferProtocolFromPath('kosherai/low_sodium/ingredients/lemon'), 'low_sodium');
  assert.strictEqual(inferProtocolFromPath('kosherai/diabetic/ingredients/kamote'), 'diabetic');
  console.log('  ✅ Normalization and protocol inference passed.');
}

// ============================================================================
// TEST 2: Asset Matching Engine Tiers
// ============================================================================
console.log('Test 2: Asset Matching Engine Hierarchy');
{
  // 1. Exact ID Match
  const asset1 = {
    public_id: 'kosherai/lid_protocol/ingredients/salt-kosher',
    secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1234/kosherai/lid_protocol/ingredients/salt-kosher.webp'
  };
  const match1 = matchAssetToIngredient(asset1, LID_DATABASE, 'lid');
  assert.strictEqual(match1.matched, true);
  assert.strictEqual(match1.ingredientId, 'salt-kosher');
  assert.strictEqual(match1.status, 'active');
  assert.strictEqual(match1.confidence, 1.0);
  assert.strictEqual(match1.matchType, 'exact_id');

  // 2. Exact Name Match
  const asset2 = {
    public_id: 'kosherai/lid/ingredients/kosher-salt-non-iodized',
    secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1234/kosher-salt.webp'
  };
  const match2 = matchAssetToIngredient(asset2, LID_DATABASE, 'lid');
  assert.strictEqual(match2.matched, true);
  assert.strictEqual(match2.ingredientId, 'salt-kosher');
  assert.strictEqual(match2.status, 'active');

  // 3. Verified Alias Match
  const asset3 = {
    public_id: 'kosherai/lid/ingredients/diamond-crystal-kosher-salt',
    secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1234/diamond.webp'
  };
  const match3 = matchAssetToIngredient(asset3, LID_DATABASE, 'lid');
  assert.strictEqual(match3.matched, true);
  assert.strictEqual(match3.ingredientId, 'salt-kosher');
  assert.strictEqual(match3.matchType, 'alias_match');

  // 4. Ambiguous / Low Match (Must be flagged as pending_review)
  const assetAmbiguous = {
    public_id: 'kosherai/lid/ingredients/salt',
    secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1234/salt.webp'
  };
  const matchAmbiguous = matchAssetToIngredient(assetAmbiguous, LID_DATABASE, 'lid');
  assert.strictEqual(matchAmbiguous.status, 'pending_review', 'Ambiguous asset must require admin review');

  // 5. Unmatched asset
  const assetUnmatched = {
    public_id: 'kosherai/lid/ingredients/completely_unknown_xyz123',
    secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1234/unknown.webp'
  };
  const matchUnmatched = matchAssetToIngredient(assetUnmatched, LID_DATABASE, 'lid');
  assert.strictEqual(matchUnmatched.matched, false);
  assert.strictEqual(matchUnmatched.ingredientId, null);
  assert.strictEqual(matchUnmatched.status, 'pending_review');

  console.log('  ✅ Matching hierarchy (exact ID -> exact name -> alias -> fuzzy/pending review) passed.');
}

// ============================================================================
// TEST 3: Client Ingredient Image URL Resolution & Recipe Version Protection
// ============================================================================
console.log('Test 3: Synchronous Image Resolution & URL Integrity');
{
  // Pre-seed local cache
  mockStorage['kosherai_ingredient_images_lid'] = JSON.stringify({
    'salt-kosher': {
      secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v99999/kosherai/lid/salt-kosher.webp',
      status: 'active'
    }
  });
  initIngredientImageCache('lid');

  const resolved = getIngredientImageUrl('salt-kosher', 'lid');
  assert.strictEqual(resolved, 'https://res.cloudinary.com/dego6hgcb/image/upload/v99999/kosherai/lid/salt-kosher.webp');

  // Verify that resolution never constructs fake recipe versions (e.g. 1793066348, 1793084102)
  const missingResolved = getIngredientImageUrl('non-existent-item-12345', 'lid');
  assert.strictEqual(missingResolved, null);

  console.log('  ✅ Synchronous URL resolution and recipe version protection passed.');
}

// ============================================================================
// TEST 4: Admin Authorization Guard
// ============================================================================
console.log('Test 4: Admin Authorization Guard Verification');
{
  const nonAdminUser = { id: 'usr_normal', email: 'user@example.com', role: 'user' };
  const adminUser = { id: 'usr_admin', email: 'admin@kosherai.com', role: 'admin' };

  // Set production environment temporarily to test strict checks
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_EMAILS = 'admin@kosherai.com';

  const isNormalAdmin = await isAdminUser(nonAdminUser);
  const isActualAdmin = await isAdminUser(adminUser);

  assert.strictEqual(isNormalAdmin, false, 'Non-admin user must not be granted admin privileges');
  assert.strictEqual(isActualAdmin, true, 'Admin user must be granted admin privileges');

  // Verify internal admin secret header
  const reqWithSecret = {
    headers: { 'x-admin-key': 'kosherai_admin' }
  };
  process.env.INTERNAL_SERVICE_KEY = 'kosherai_admin';
  const isSecretAdmin = await isAdminUser(reqWithSecret);
  assert.strictEqual(isSecretAdmin, true, 'Internal service key header grants admin privileges');

  process.env.NODE_ENV = prevEnv;
  console.log('  ✅ Authorization guards passed.');
}

// ============================================================================
// TEST 5: Public API Route (/api/ingredient-images)
// ============================================================================
console.log('Test 5: Public API Route Query');
{
  const req = {
    method: 'GET',
    url: '/api/ingredient-images?protocol=lid',
    headers: {}
  };

  let responseData = null;
  let responseStatus = 0;
  const res = {
    setHeader: () => {},
    statusCode: 200,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { responseData = data; responseStatus = this.statusCode; return this; },
    end: function() {}
  };

  await publicImagesHandler(req, res);
  assert.strictEqual(responseStatus, 200);
  assert.strictEqual(responseData.success, true);
  assert.strictEqual(responseData.protocol, 'lid');
  assert.ok(typeof responseData.images === 'object');
  console.log('  ✅ Public endpoint returned active mappings with 200 OK.');
}

// ============================================================================
// TEST 6: Admin API Route Discovery & Upsert Simulation
// ============================================================================
console.log('Test 6: Admin API Discovery & Upsert Verification');
{
  const mockAssets = [
    {
      public_id: 'kosherai/lid/salt-kosher',
      secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v12345/salt-kosher.webp',
      format: 'webp',
      original_filename: 'salt-kosher.webp'
    },
    {
      public_id: 'kosherai/lid/banana-ketchup',
      secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v12345/banana-ketchup.webp',
      format: 'webp',
      original_filename: 'banana-ketchup.webp'
    }
  ];

  const req = {
    method: 'POST',
    url: '/api/admin/ingredient-images',
    headers: {
      'x-admin-key': process.env.INTERNAL_SERVICE_KEY || 'kosherai_admin'
    },
    body: {
      action: 'discover',
      protocol: 'lid',
      assets: mockAssets
    }
  };

  let responseData = null;
  let responseStatus = 0;
  const res = {
    setHeader: () => {},
    statusCode: 200,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { responseData = data; responseStatus = this.statusCode; return this; },
    end: function() {}
  };

  await adminImagesHandler(req, res);
  assert.strictEqual(responseStatus, 200);
  assert.strictEqual(responseData.success, true);
  assert.strictEqual(responseData.discoveredCount, 2);
  assert.strictEqual(responseData.matchedCount, 2);
  assert.ok(responseData.results.some(r => r.ingredientId === 'salt-kosher' && r.status === 'active'));
  assert.ok(responseData.results.some(r => r.ingredientId === 'banana-ketchup' && r.status === 'active'));
  console.log('  ✅ Admin discovery & matching executed with 2/2 matched assets.');
}

// ============================================================================
// TEST 7: UI Rendering Verification (CheckerTab, SettingsModal, AdminModal)
// ============================================================================
console.log('Test 7: UI Component Rendering');
{
  // 1. CheckerTab image rendering
  const checkerHtml = renderCheckerTab({
    searchQuery: 'Kosher Salt',
    searchResults: LID_DATABASE.filter(i => i.id === 'salt-kosher'),
    activeDiet: 'lid'
  });
  assert.ok(checkerHtml.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v99999/kosherai/lid/salt-kosher.webp'), 'CheckerTab must render Cloudinary image URL');
  assert.ok(checkerHtml.includes('onerror="this.style.display=\'none\''), 'CheckerTab must include resilient onerror fallback');

  // 2. SettingsModal Admin Trigger
  const settingsHtml = renderSettingsModal({}, 'dark', true, 'lid');
  assert.ok(settingsHtml.includes('id="open-ingredient-admin-btn"'), 'SettingsModal must render Manage Photos button');

  // 3. AdminModal Dashboard Stats & Action Controls
  const adminHtml = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    stats: { totalIngredients: 36, withImage: 1, missingImage: 35, pendingReview: 0 },
    mappings: [
      { id: 'img_lid_salt-kosher', protocol_id: 'lid', ingredient_id: 'salt-kosher', secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v99999/salt-kosher.webp', status: 'active' }
    ]
  });

  assert.ok(adminHtml.includes('id="admin-image-discover-btn"'), 'AdminModal must render Auto-Discover button');
  assert.ok(adminHtml.includes('id="admin-image-toggle-upload-btn"'), 'AdminModal must render Upload button');
  assert.ok(adminHtml.includes('id="admin-image-protocol-select"'), 'AdminModal must render Protocol selector');
  assert.ok(adminHtml.includes('🟢 Mapped Photos'), 'AdminModal must render Mapped Photos stat');

  console.log('  ✅ UI component rendering verified.');
}

console.log('\n======================================================================');
console.log('🎉 ALL INGREDIENT IMAGE MANAGEMENT TESTS (1 THROUGH 7) PASSED!');
console.log('======================================================================\n');

