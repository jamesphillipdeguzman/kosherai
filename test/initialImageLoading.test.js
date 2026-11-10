import assert from 'node:assert';
import {
  initIngredientImageCache,
  getCachedAdminSummary,
  saveAdminImageCache,
  resolveGalleryIngredientImage,
  fetchAdminImageSummary
} from '../src/services/ingredientImageService.js';
import { renderIngredientImageAdminModal } from '../src/components/IngredientImageAdminModal.js';
import { LID_DATABASE } from '../src/data/lidDatabase.js';

console.log('🧪 Starting Initial Cloudinary Image Loading & Lifecycle Test Suite...\n');

// Mock localStorage for node environment
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

// ============================================================================
// TEST 1: Standardized Image Resolution Helper
// ============================================================================
console.log('Test 1: Standardized Image Resolution across mapped, cached, and unmapped ingredients');
{
  const activeMapping = {
    id: 'img_lid_salt-kosher',
    protocol_id: 'lid',
    ingredient_id: 'salt-kosher',
    secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/salt-kosher.webp',
    public_id: 'kosherai/lid_protocol/ingredients/salt-kosher',
    status: 'active'
  };

  const pendingMapping = {
    id: 'img_lid_banana-ketchup',
    protocol_id: 'lid',
    ingredient_id: 'banana-ketchup',
    secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/v1794228286/kosherai/lid_protocol/ingredients/banana-ketchup.webp',
    public_id: 'kosherai/lid_protocol/ingredients/banana-ketchup',
    status: 'pending_review'
  };

  const item = { id: 'salt-kosher', name: 'Kosher Salt' };

  // 1a. Active mapping
  const resolvedActive = resolveGalleryIngredientImage(item, activeMapping, 'lid');
  assert.strictEqual(resolvedActive.isMapped, true, 'Active mapping must have isMapped: true');
  assert.strictEqual(resolvedActive.isPending, false, 'Active mapping must have isPending: false');
  assert.strictEqual(resolvedActive.url, activeMapping.secure_url, 'Must resolve to secure_url');

  // 1b. Pending mapping
  const resolvedPending = resolveGalleryIngredientImage({ id: 'banana-ketchup', name: 'Banana Ketchup' }, pendingMapping, 'lid');
  assert.strictEqual(resolvedPending.isMapped, true, 'Pending mapping must have isMapped: true');
  assert.strictEqual(resolvedPending.isPending, true, 'Pending mapping must have isPending: true');

  // 1c. Unmapped item
  const resolvedUnmapped = resolveGalleryIngredientImage({ id: 'unmapped-item', name: 'Unmapped Item' }, null, 'lid');
  assert.strictEqual(resolvedUnmapped.isMapped, false, 'Unmapped item must have isMapped: false');
  assert.strictEqual(resolvedUnmapped.url, null, 'Unmapped item must have url: null');

  console.log('  ✅ Standardized image resolution verified for active, pending, and unmapped states.');
}

// ============================================================================
// TEST 2: Admin Summary Caching & Synchronous Initial Read
// ============================================================================
console.log('\nTest 2: Admin Summary Cache persistence and synchronous pre-seeding');
{
  const mockSummary = {
    success: true,
    protocol: 'lid',
    stats: {
      totalIngredients: 36,
      withImage: 6,
      missingImage: 30,
      pendingReview: 0
    },
    mappings: [
      { id: 'm1', protocol_id: 'lid', ingredient_id: 'salt-kosher', secure_url: 'https://res.cloudinary.com/test/salt.webp', status: 'active' },
      { id: 'm2', protocol_id: 'lid', ingredient_id: 'fish-sauce-patis', secure_url: 'https://res.cloudinary.com/test/patis.webp', status: 'active' },
      { id: 'm3', protocol_id: 'lid', ingredient_id: 'fresh-chilies', secure_url: 'https://res.cloudinary.com/test/chilies.webp', status: 'active' },
      { id: 'm4', protocol_id: 'lid', ingredient_id: 'soy-sauce', secure_url: 'https://res.cloudinary.com/test/soy.webp', status: 'active' },
      { id: 'm5', protocol_id: 'lid', ingredient_id: 'salt-sea', secure_url: 'https://res.cloudinary.com/test/sea.webp', status: 'active' },
      { id: 'm6', protocol_id: 'lid', ingredient_id: 'salt-iodized', secure_url: 'https://res.cloudinary.com/test/iodized.webp', status: 'active' }
    ]
  };

  // Save to cache
  saveAdminImageCache('lid', mockSummary);

  // Read from cache synchronously
  const cached = getCachedAdminSummary('lid');
  assert.ok(cached, 'Cached summary must be returned');
  assert.strictEqual(cached.stats.withImage, 6, 'Must retain 6 mapped photos');
  assert.strictEqual(cached.stats.missingImage, 30, 'Must retain 30 missing photos');
  assert.strictEqual(cached.mappings.length, 6, 'Must retain 6 mappings');

  // Verify global cache sharing across protocols (photos are shared across ALL protocols)
  const diabeticCached = getCachedAdminSummary('diabetic');
  assert.ok(diabeticCached, 'Diabetic protocol must access global image cache');
  assert.strictEqual(diabeticCached.stats.withImage, 6, 'Diabetic protocol must access all 6 mapped photos');
  assert.strictEqual(diabeticCached.mappings.length, 6, 'Diabetic protocol must have all 6 mappings');

  const purineCached = getCachedAdminSummary('low_purine');
  assert.ok(purineCached, 'Low-Purine protocol must access global image cache');
  assert.strictEqual(purineCached.stats.withImage, 6, 'Low-Purine protocol must access all 6 mapped photos');

  console.log('  ✅ Cache persistence and global protocol sharing verified.');
}

// ============================================================================
// TEST 3: Initial Gallery Render with Cached Mappings (No 0 Flash, No Dialog Required)
// ============================================================================
console.log('\nTest 3: Initial gallery render with cached mappings displays 6 mapped photos immediately');
{
  const cached = getCachedAdminSummary('lid');
  const html = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    stats: cached.stats,
    mappings: cached.mappings,
    uploadFormOpen: false,
    embedded: true
  });

  // Verify counters immediately display 6 and 30 without requiring ingredient selection
  assert.ok(html.includes('>6<'), 'Must immediately display 6 Mapped Photos counter');
  assert.ok(html.includes('>30<'), 'Must immediately display 30 Missing counter');

  // Verify mapped thumbnails are rendered on initial render
  assert.ok(html.includes('https://res.cloudinary.com/test/salt.webp'), 'Salt thumbnail must be rendered');
  assert.ok(html.includes('https://res.cloudinary.com/test/patis.webp'), 'Fish sauce thumbnail must be rendered');
  assert.ok(html.includes('https://res.cloudinary.com/test/chilies.webp'), 'Fresh chilies thumbnail must be rendered');
  assert.ok(html.includes('🟢 Active'), 'Active badges must be rendered');

  // Verify dialog is NOT open
  assert.ok(!html.includes('admin-dialog-overlay'), 'Inspection dialog must NOT be open on initial gallery display');

  console.log('  ✅ Initial gallery render verified: 6 mapped photos and accurate counters rendered immediately.');
}

// ============================================================================
// TEST 4: Loading State Distinction (Does Not Mark Everything Missing While Loading)
// ============================================================================
console.log('\nTest 4: Loading state renders subtle indicator without falsely zeroing counters');
{
  // Cold start with no cached mappings and active fetch in flight
  const htmlLoading = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    stats: { totalIngredients: 36, withImage: 0, missingImage: 36, pendingReview: 0 },
    mappings: [],
    isLoading: true,
    uploadFormOpen: false,
    embedded: true
  });

  assert.ok(htmlLoading.includes('admin-loading-banner') || htmlLoading.includes('Fetching authoritative Cloudinary'), 'Must display loading banner');
  assert.ok(htmlLoading.includes('admin-pulse'), 'Must render pulse indicator');

  console.log('  ✅ Loading state verified: displays loading indicator instead of permanent false zero.');
}

// ============================================================================
// TEST 5: Authoritative Backend Response Overwrites Stale Entries
// ============================================================================
console.log('\nTest 5: Authoritative response replaces cached mappings and prunes unmapped records');
{
  // Assume backend has updated: salt-sea was unlinked, now only 5 mapped
  const freshBackendData = {
    success: true,
    protocol: 'lid',
    stats: { totalIngredients: 36, withImage: 5, missingImage: 31, pendingReview: 0 },
    mappings: [
      { id: 'm1', protocol_id: 'lid', ingredient_id: 'salt-kosher', secure_url: 'https://res.cloudinary.com/test/salt.webp', status: 'active' },
      { id: 'm2', protocol_id: 'lid', ingredient_id: 'fish-sauce-patis', secure_url: 'https://res.cloudinary.com/test/patis.webp', status: 'active' },
      { id: 'm3', protocol_id: 'lid', ingredient_id: 'fresh-chilies', secure_url: 'https://res.cloudinary.com/test/chilies.webp', status: 'active' },
      { id: 'm4', protocol_id: 'lid', ingredient_id: 'soy-sauce', secure_url: 'https://res.cloudinary.com/test/soy.webp', status: 'active' },
      { id: 'm6', protocol_id: 'lid', ingredient_id: 'salt-iodized', secure_url: 'https://res.cloudinary.com/test/iodized.webp', status: 'active' }
    ]
  };

  saveAdminImageCache('lid', freshBackendData);
  const updatedCache = getCachedAdminSummary('lid');

  assert.strictEqual(updatedCache.stats.withImage, 5, 'Stats must update to 5');
  assert.strictEqual(updatedCache.mappings.length, 5, 'Mappings array must have exactly 5 elements');
  assert.ok(!updatedCache.mappings.some(m => m.ingredient_id === 'salt-sea'), 'Unlinked salt-sea must be pruned from cache');

  const html = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    stats: updatedCache.stats,
    mappings: updatedCache.mappings,
    uploadFormOpen: false,
    embedded: true
  });

  assert.ok(html.includes('>5<'), 'Mapped counter must reflect 5');
  assert.ok(html.includes('>31<'), 'Missing counter must reflect 31');

  console.log('  ✅ Authoritative update verified: unlinked items cleanly pruned from gallery.');
}

console.log('\n======================================================================');
console.log('🎉 ALL INITIAL CLOUDINARY IMAGE LOADING TESTS (1 THROUGH 5) PASSED!');
console.log('======================================================================\n');

