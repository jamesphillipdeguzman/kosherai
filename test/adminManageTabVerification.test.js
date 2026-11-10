import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderBottomNav } from '../src/components/BottomNav.js';
import { renderIngredientImageAdminModal } from '../src/components/IngredientImageAdminModal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Starting Admin Manage Tab & Image Management Verification Suite...\n');

// ============================================================================
// TEST 1: Bottom Navigation Admin Tab Display
// ============================================================================
console.log('Test 1: Bottom Navigation Manage Tab Display based on isAdmin');
{
  // 1a: LID Diet Mode - Regular User
  const dietNavUser = renderBottomNav('checker', 'diet', false);
  assert.ok(!dietNavUser.includes('data-tab="manage"'), 'Regular user must NOT see Manage tab in diet mode');
  assert.ok(!dietNavUser.includes('>Manage<'), 'Regular user must NOT see Manage label in diet mode');

  // 1b: LID Diet Mode - Admin User
  const dietNavAdmin = renderBottomNav('checker', 'diet', true);
  assert.ok(dietNavAdmin.includes('data-tab="manage"'), 'Admin user MUST see Manage tab in diet mode');
  assert.ok(dietNavAdmin.includes('data-mode="diet"'), 'Manage tab in diet mode must have data-mode="diet"');
  // Verify Manage tab appears after cook mode
  const cookIndex = dietNavAdmin.indexOf('data-tab="cook"');
  const manageDietIndex = dietNavAdmin.indexOf('data-tab="manage"');
  assert.ok(cookIndex !== -1, 'Cook tab must be present in diet nav');
  assert.ok(manageDietIndex !== -1, 'Manage tab must be present in diet nav for admin');
  assert.ok(manageDietIndex > cookIndex, 'Manage tab must be placed after Cook tab in diet nav');

  // 1c: 6-Week Course Mode - Regular User
  const courseNavUser = renderBottomNav('dashboard', 'course', false);
  assert.ok(!courseNavUser.includes('data-tab="manage"'), 'Regular user must NOT see Manage tab in course mode');

  // 1d: 6-Week Course Mode - Admin User
  const courseNavAdmin = renderBottomNav('dashboard', 'course', true);
  assert.ok(courseNavAdmin.includes('data-tab="manage"'), 'Admin user MUST see Manage tab in course mode');
  assert.ok(courseNavAdmin.includes('data-mode="course"'), 'Manage tab in course mode must have data-mode="course"');
  // Verify Manage tab appears beside / after meal plan
  const mealPlanIndex = courseNavAdmin.indexOf('data-tab="mealplan"');
  const manageCourseIndex = courseNavAdmin.indexOf('data-tab="manage"');
  assert.ok(mealPlanIndex !== -1, 'Meal plan tab must be present in course nav');
  assert.ok(manageCourseIndex !== -1, 'Manage tab must be present in course nav for admin');
  assert.ok(manageCourseIndex > mealPlanIndex, 'Manage tab must be placed beside/after Meal Plan in course nav');

  console.log('  ✅ Bottom navigation tabs correctly gated by isAdmin across both Diet and Course modes.');
}

// ============================================================================
// TEST 2: Dedicated Embedded Manage View vs Modal Mode
// ============================================================================
console.log('\nTest 2: Dedicated Embedded Manage View vs Modal Mode Rendering');
{
  // 2a: Modal Mode (embedded: false)
  const modalHtml = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    embedded: false
  });
  assert.ok(modalHtml.includes('modal-overlay'), 'Modal mode must render .modal-overlay');
  assert.ok(modalHtml.includes('id="admin-image-close-btn"'), 'Modal mode must include close button');
  assert.ok(modalHtml.includes('id="admin-image-done-btn"'), 'Modal mode must include Done button');

  // 2b: Embedded View Mode (embedded: true)
  const embeddedHtml = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    embedded: true
  });
  assert.ok(!embeddedHtml.includes('modal-overlay'), 'Embedded view must NOT render modal-overlay');
  assert.ok(embeddedHtml.includes('admin-manage-page-container'), 'Embedded view must render .admin-manage-page-container');
  assert.ok(embeddedHtml.includes('Ingredient Image Management'), 'Embedded view must render title: Ingredient Image Management');
  assert.ok(embeddedHtml.includes('Manage, upload, replace, and review Cloudinary ingredient images.'), 'Embedded view must render required description');
  assert.ok(embeddedHtml.includes('admin-image-metrics-bar'), 'Embedded view must retain metrics bar');
  assert.ok(embeddedHtml.includes('id="admin-image-protocol-select"'), 'Embedded view must retain protocol selector');
  assert.ok(embeddedHtml.includes('id="admin-image-discover-btn"'), 'Embedded view must retain auto-discover button');

  console.log('  ✅ Dedicated embedded Manage view renders correctly with required title, description, and management controls.');
}

// ============================================================================
// TEST 3: Image Containment & Responsive Sizing (h-48 sm:h-56, object-contain)
// ============================================================================
console.log('\nTest 3: Image Containment & Responsive Sizing Rules');
{
  const uploadHtml = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    uploadFormOpen: true,
    uploadPreviewUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
  });

  assert.ok(uploadHtml.includes('admin-image-preview-container'), 'Upload preview must have .admin-image-preview-container');
  assert.ok(uploadHtml.includes('h-48 sm:h-56'), 'Preview container must use h-48 sm:h-56');
  assert.ok(uploadHtml.includes('object-contain'), 'Preview image must use object-contain');
  assert.ok(!uploadHtml.includes('object-cover'), 'Preview image must NEVER use object-cover');

  // Check style.css rules
  const cssContent = fs.readFileSync(path.join(rootDir, 'src', 'style.css'), 'utf-8');
  assert.ok(cssContent.includes('.admin-image-preview-container'), 'CSS must define .admin-image-preview-container');
  assert.ok(cssContent.includes('object-fit: contain !important;'), 'CSS must enforce object-fit: contain !important');
  assert.ok(cssContent.includes('height: 12rem !important;'), 'CSS must enforce h-48 (12rem) height');

  console.log('  ✅ Bounded image containment (h-48 sm:h-56, object-contain) verified across templates and CSS.');
}

// ============================================================================
// TEST 4: Verification of No Authentication Circular Imports
// ============================================================================
console.log('\nTest 4: Verification of Circular Imports Elimination');
{
  // 4a: Stubs must not exist
  assert.ok(!fs.existsSync(path.join(rootDir, 'lib', 'auth.ts')), 'lib/auth.ts must not exist');
  assert.ok(!fs.existsSync(path.join(rootDir, 'lib', 'auth-client.ts')), 'lib/auth-client.ts must not exist');
  assert.ok(!fs.existsSync(path.join(rootDir, 'api', 'auth', '[...all].ts')), 'api/auth/[...all].ts must not exist');

  // 4b: Canonical JS files must exist
  assert.ok(fs.existsSync(path.join(rootDir, 'lib', 'auth.js')), 'Canonical lib/auth.js must exist');
  assert.ok(fs.existsSync(path.join(rootDir, 'api', 'auth', '[...all].js')), 'Canonical api/auth/[...all].js must exist');

  const handlerContent = fs.readFileSync(path.join(rootDir, 'api', 'auth', '[...all].js'), 'utf-8');
  assert.ok(handlerContent.includes('lib/auth.js'), 'API handler must import canonical auth.js');

  const libAuthContent = fs.readFileSync(path.join(rootDir, 'lib', 'auth.js'), 'utf-8');
  assert.ok(!libAuthContent.includes('[...all]'), 'lib/auth.js must not import API handler');

  console.log('  ✅ Authentication circular dependencies eliminated.');
}

console.log('\n🎉 ALL ADMIN MANAGE TAB & IMAGE MANAGEMENT VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
