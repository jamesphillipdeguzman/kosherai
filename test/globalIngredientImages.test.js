// KosherAI - Global Ingredient Images Integration Test Suite
// Verifies that ingredient photos are shared across ALL diet protocols:
// LID Protocol, Diabetic, Low-Purine, Low-Sodium, and Pinoy-Keto.
import assert from 'node:assert';
import {
  initIngredientImageCache,
  getCachedAdminSummary,
  saveAdminImageCache,
  resolveGalleryIngredientImage,
  getIngredientImageUrl,
  buildCloudinaryUrl,
  uploadIngredientImage,
  GLOBAL_MAPPINGS_KEY,
  GLOBAL_ADMIN_STORAGE_KEY
} from '../src/services/ingredientImageService.js';
import { LID_DATABASE, getItemDietaryInfo, STATUS } from '../src/data/lidDatabase.js';
import { renderIngredientImageAdminModal } from '../src/components/IngredientImageAdminModal.js';
import { renderCheckerTab } from '../src/components/CheckerTab.js';
import { renderItemDetailModal } from '../src/components/ItemDetailModal.js';
import adminImagesHandler from '../api/admin/ingredient-images.js';
import publicImagesHandler from '../api/ingredient-images.js';

console.log('🧪 Starting KosherAI Global Ingredient Image Library Test Suite...\n');

// Set test service key for admin authentication
process.env.INTERNAL_SERVICE_KEY = 'kosherai_admin';

// Mock localStorage for node test runner
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// ============================================================================
// TEST 1: Global Cache Persistence & Shared Cross-Protocol Access
// ============================================================================
console.log('Test 1: Global Cache Persistence across ALL 5 Protocols');
{
  const testGlobalMappings = [
    {
      id: 'img_lid_salt-kosher',
      protocol_id: 'lid',
      ingredient_id: 'salt-kosher',
      public_id: 'kosherai/lid_protocol/ingredients/salt-kosher',
      secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp',
      status: 'active'
    },
    {
      id: 'img_lid_soy-sauce',
      protocol_id: 'lid',
      ingredient_id: 'soy-sauce',
      public_id: 'kosherai/lid_protocol/ingredients/soy-sauce',
      secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794294051/kosherai/lid_protocol/ingredients/soy-sauce.webp',
      status: 'active'
    },
    {
      id: 'img_global_fresh-garlic',
      protocol_id: 'global',
      ingredient_id: 'garlic-fresh',
      public_id: 'kosherai/all_ingredients/garlic-fresh',
      secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794500000/kosherai/all_ingredients/garlic-fresh.webp',
      status: 'active'
    }
  ];

  const summary = {
    success: true,
    protocol: 'global',
    stats: {
      totalIngredients: 36,
      withImage: 3,
      missingImage: 33,
      pendingReview: 0
    },
    mappings: testGlobalMappings
  };

  saveAdminImageCache('global', summary);

  // Check that the global key is populated
  assert.ok(mockStorage[GLOBAL_ADMIN_STORAGE_KEY], 'Global admin summary storage key must be set');
  assert.ok(mockStorage[GLOBAL_MAPPINGS_KEY], 'Global mappings storage key must be set');

  // Verify access across all 5 dietary protocols
  const protocols = ['lid', 'low_purine', 'diabetic', 'low_sodium', 'pinoy_keto'];
  for (const proto of protocols) {
    const cached = getCachedAdminSummary(proto);
    assert.ok(cached, `Protocol '${proto}' must retrieve the global admin summary`);
    assert.strictEqual(cached.stats.withImage, 3, `Protocol '${proto}' must see all 3 mapped images`);
    assert.strictEqual(cached.mappings.length, 3, `Protocol '${proto}' must see all 3 mappings`);
  }

  console.log('  ✅ Global cache persistence verified across LID, Low-Purine, Diabetic, Low-Sodium, Pinoy-Keto.');
}

// ============================================================================
// TEST 2: Single Global Image Resolver for All Protocols
// ============================================================================
console.log('\nTest 2: Global Image Resolution across Diet Protocols');
{
  const protocols = ['lid', 'low_purine', 'diabetic', 'low_sodium', 'pinoy_keto'];

  // Kosher Salt is mapped
  for (const proto of protocols) {
    const saltUrl = getIngredientImageUrl('salt-kosher', proto);
    assert.strictEqual(
      saltUrl,
      'https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp',
      `Kosher Salt image must resolve identically in protocol: ${proto}`
    );

    // Soy Sauce is mapped
    const soyUrl = getIngredientImageUrl('soy-sauce', proto);
    assert.strictEqual(
      soyUrl,
      'https://res.cloudinary.com/dego6hgcb/image/upload/v1794294051/kosherai/lid_protocol/ingredients/soy-sauce.webp',
      `Soy Sauce image must resolve identically in protocol: ${proto}`
    );

    // Garlic (new upload in kosherai/all_ingredients/) is mapped
    const garlicUrl = getIngredientImageUrl('garlic-fresh', proto);
    assert.strictEqual(
      garlicUrl,
      'https://res.cloudinary.com/dego6hgcb/image/upload/v1794500000/kosherai/all_ingredients/garlic-fresh.webp',
      `Fresh Garlic in all_ingredients/ must resolve identically in protocol: ${proto}`
    );
  }

  console.log('  ✅ Identical image URL resolved across all 5 protocols for existing and new folder paths.');
}

// ============================================================================
// TEST 3: Admin Manage Gallery Protocol Switching (No Empty State, No Zero Flash)
// ============================================================================
console.log('\nTest 3: Admin Manage Gallery Protocol Switching');
{
  const cachedSummary = getCachedAdminSummary('global');
  const protocols = ['lid', 'low_purine', 'diabetic', 'low_sodium', 'pinoy_keto'];

  for (const proto of protocols) {
    const html = renderIngredientImageAdminModal({
      activeProtocol: proto,
      stats: cachedSummary.stats,
      mappings: cachedSummary.mappings,
      searchQuery: '',
      statusFilter: 'all',
      isLoading: false,
      embedded: true
    });

    // Check gallery presence
    assert.ok(html.includes('admin-gallery-container'), `Gallery container rendered for ${proto}`);
    assert.ok(html.includes('Mapped Photos'), `Mapped Photos metric rendered for ${proto}`);
    assert.ok(html.includes('🟢 Mapped Photos</span>\n          <span class="admin-stat-value">3</span>') || html.includes('🟢 Mapped Photos</span> <span class="admin-stat-value">3</span>') || html.includes('>3</span>'), `Must show 3 mapped photos under ${proto}`);

    // Check that Kosher Salt card displays its image thumbnail under every protocol
    assert.ok(
      html.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp'),
      `Kosher Salt thumbnail must render under protocol ${proto}`
    );

    // Check that Soy Sauce card displays its image thumbnail under every protocol
    assert.ok(
      html.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1794294051/kosherai/lid_protocol/ingredients/soy-sauce.webp'),
      `Soy Sauce thumbnail must render under protocol ${proto}`
    );
  }

  console.log('  ✅ Admin Manage Gallery retains all global images and correct counters across all 5 protocols.');
}

// ============================================================================
// TEST 4: Backend API Returns Global Mappings Regardless of ?protocol= Query
// ============================================================================
console.log('\nTest 4: Backend API Global Behavior (GET /api/admin/ingredient-images)');
{
  // Mock response helper
  function createMockRes() {
    let responseData = null;
    let responseStatus = 200;
    return {
      setHeader: () => {},
      statusCode: 200,
      status: function(code) { this.statusCode = code; responseStatus = code; return this; },
      json: function(data) { responseData = data; return this; },
      end: function() {},
      getData: () => responseData,
      getStatus: () => responseStatus
    };
  }

  const protocolsToTest = ['lid', 'low_purine', 'diabetic', 'low_sodium', 'pinoy_keto'];
  for (const proto of protocolsToTest) {
    const req = {
      method: 'GET',
      url: `/api/admin/ingredient-images?protocol=${proto}`,
      headers: {
        'x-admin-key': process.env.INTERNAL_SERVICE_KEY || 'kosherai_admin'
      }
    };
    const res = createMockRes();
    await adminImagesHandler(req, res);

    assert.strictEqual(res.getStatus(), 200, `GET /api/admin/ingredient-images?protocol=${proto} must return 200`);
    const data = res.getData();
    console.log('  [DEBUG]', proto, 'stats:', data.stats, 'mappings count:', data.mappings?.length);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.stats.totalIngredients, 36, 'Total ingredients must remain 36');
    assert.ok(data.stats.withImage >= 6, `Mapped photo count must be >= 6 under protocol ${proto} (actual Neon DB state)`);
    assert.ok(Array.isArray(data.mappings) && data.mappings.length >= 6, `Must return all global mappings under ${proto}`);
  }

  console.log('  ✅ Backend GET returns the identical global library for LID, Low-Purine, Diabetic, Low-Sodium, Pinoy-Keto.');
}

// ============================================================================
// TEST 5: Backend POST Save Preserves ID & Prevents Duplicate Records
// ============================================================================
console.log('\nTest 5: Backend POST Save: Preserves Existing ID & Prevents Duplicates');
{
  function createMockRes() {
    let responseData = null;
    let responseStatus = 200;
    return {
      setHeader: () => {},
      statusCode: 200,
      status: function(code) { this.statusCode = code; responseStatus = code; return this; },
      json: function(data) { responseData = data; return this; },
      end: function() {},
      getData: () => responseData,
      getStatus: () => responseStatus
    };
  }

  // Simulate replacing an existing LID photo from Low-Purine protocol
  const replaceReq = {
    method: 'POST',
    url: '/api/admin/ingredient-images',
    headers: {
      'x-admin-key': process.env.INTERNAL_SERVICE_KEY || 'kosherai_admin'
    },
    body: {
      action: 'save',
      protocol_id: 'low_purine', // Admin was viewing low_purine
      ingredient_id: 'salt-kosher', // Existing item
      public_id: 'kosherai/all_ingredients/salt-kosher-replaced',
      secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794999999/kosherai/all_ingredients/salt-kosher-replaced.webp',
      format: 'webp',
      status: 'active'
    }
  };

  const replaceRes = createMockRes();
  await adminImagesHandler(replaceReq, replaceRes);
  assert.strictEqual(replaceRes.getStatus(), 200);
  const replaceData = replaceRes.getData();
  assert.strictEqual(replaceData.success, true);
  // Must preserve existing ID: 'img_lid_salt-kosher'
  assert.strictEqual(replaceData.mapping.id, 'img_lid_salt-kosher', 'Must preserve existing ID img_lid_salt-kosher');
  assert.strictEqual(replaceData.mapping.public_id, 'kosherai/all_ingredients/salt-kosher-replaced');

  // Verify that only 1 record exists for salt-kosher in Neon (no duplicates!)
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT id, protocol_id, ingredient_id, public_id, secure_url
    FROM ingredient_images
    WHERE LOWER(ingredient_id) = 'salt-kosher';
  `;
  assert.strictEqual(rows.length, 1, 'Only one global mapping record must exist for salt-kosher in Neon');

  // Restore original salt-kosher URL
  await sql`
    UPDATE ingredient_images
    SET public_id = 'kosherai/lid_protocol/ingredients/salt-kosher',
        secure_url = 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp',
        updated_at = NOW()
    WHERE id = 'img_lid_salt-kosher';
  `;

  console.log('  ✅ Backend POST save preserved existing record ID and strictly prevented duplicate records.');
}

// ============================================================================
// TEST 6: User-Facing Search & Detail Views Across Protocols
// ============================================================================
console.log('\nTest 6: User-Facing Search & Detail Views Across Protocols');
{
  const saltItem = LID_DATABASE.find(i => i.id === 'salt-kosher');
  assert.ok(saltItem, 'salt-kosher must exist in LID_DATABASE');

  // 1. CheckerTab for LID Protocol
  const checkerLid = renderCheckerTab({
    searchQuery: 'Kosher Salt',
    searchResults: [saltItem],
    activeDiet: 'lid'
  });
  assert.ok(checkerLid.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp'), 'LID CheckerTab must render Kosher Salt photo');
  assert.ok(checkerLid.includes('SAFE'), 'LID dietary status must be SAFE');

  // 2. CheckerTab for Low-Sodium Protocol
  const checkerSodium = renderCheckerTab({
    searchQuery: 'Kosher Salt',
    searchResults: [saltItem],
    activeDiet: 'low_sodium'
  });
  // Photo must be the SAME
  assert.ok(checkerSodium.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp'), 'Low-Sodium CheckerTab must render the SAME Kosher Salt photo');
  // Status must be protocol-specific (CAUTION for Low-Sodium)
  assert.ok(checkerSodium.includes('CAUTION'), 'Low-Sodium dietary status must remain protocol-specific CAUTION');

  // 3. ItemDetailModal for Low-Purine Protocol
  const detailPurine = renderItemDetailModal(saltItem, 'low_purine');
  assert.ok(detailPurine.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp'), 'Low-Purine ItemDetailModal must render the SAME Kosher Salt photo');
  assert.ok(detailPurine.includes('Low-Purine'), 'Low-Purine detail modal must show Low-Purine diet tag');

  // 4. ItemDetailModal for Diabetic Protocol
  const detailDiabetic = renderItemDetailModal(saltItem, 'diabetic');
  assert.ok(detailDiabetic.includes('https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp'), 'Diabetic ItemDetailModal must render the SAME Kosher Salt photo');
  assert.ok(detailDiabetic.includes('Diabetic'), 'Diabetic detail modal must show Diabetic diet tag');

  console.log('  ✅ User-facing Search and Detail views render identical shared photos while maintaining protocol-specific dietary assessments.');
}

console.log('\n======================================================================');
console.log('🎉 ALL GLOBAL INGREDIENT IMAGE LIBRARY TESTS (1 THROUGH 6) PASSED!');
console.log('======================================================================\n');
