import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCookModeTab } from '../src/components/CookModeTab.js';
import { renderIngredientImageAdminModal } from '../src/components/IngredientImageAdminModal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Starting Cook Mode Manage Tab Direct Navigation Test Suite...\n');

// ----------------------------------------------------------------------------
// Test 1: CookModeTab.jsx Code Inspection
// ----------------------------------------------------------------------------
console.log('1. CookModeTab.jsx Inspection');
{
  const jsxCode = fs.readFileSync(path.join(rootDir, 'src/components/CookModeTab.jsx'), 'utf8');

  // 1.1 Must NOT import AdminIngredientImagesModal
  assert.strictEqual(
    jsxCode.includes("import AdminIngredientImagesModal"),
    false,
    'CookModeTab.jsx must NOT import AdminIngredientImagesModal'
  );

  // 1.2 Must NOT maintain showAdminImageModal local state
  assert.strictEqual(
    jsxCode.includes('showAdminImageModal'),
    false,
    'CookModeTab.jsx must NOT have showAdminImageModal state'
  );

  // 1.3 Must NOT render AdminIngredientImagesModal component
  assert.strictEqual(
    jsxCode.includes('<AdminIngredientImagesModal'),
    false,
    'CookModeTab.jsx must NOT render <AdminIngredientImagesModal'
  );

  // 1.4 Must accept setActiveTab prop and invoke it with 'manage'
  assert.ok(
    jsxCode.includes('setActiveTab') || jsxCode.includes('onNavigateTab'),
    'CookModeTab.jsx must accept tab navigation prop'
  );
  assert.ok(
    jsxCode.includes("setActiveTab('manage')") || jsxCode.includes("detail: 'manage'"),
    'CookModeTab.jsx must navigate to manage tab'
  );

  // 1.5 Must preserve admin permission check
  assert.ok(
    jsxCode.includes('effectiveIsAdmin'),
    'CookModeTab.jsx must preserve admin permission check'
  );

  console.log('  ✅ CookModeTab.jsx completely removed modal state and uses tab navigation.');
}

// ----------------------------------------------------------------------------
// Test 2: CookModeTab.js HTML Output
// ----------------------------------------------------------------------------
console.log('\n2. CookModeTab.js HTML Output');
{
  // Admin user
  const adminHtml = renderCookModeTab({
    isAdmin: true,
    activeDiet: 'lid'
  });

  assert.ok(
    adminHtml.includes('id="open-ingredient-admin-cook-btn"'),
    'Admin must see open-ingredient-admin-cook-btn'
  );
  assert.ok(
    adminHtml.includes('data-tab="manage"'),
    'Button must specify data-tab="manage"'
  );
  assert.ok(
    adminHtml.includes('Manage Ingredient Photos'),
    'Button must retain label Manage Ingredient Photos'
  );

  // Non-admin user
  const nonAdminHtml = renderCookModeTab({
    isAdmin: false,
    activeDiet: 'lid'
  });
  assert.strictEqual(
    nonAdminHtml.includes('id="open-ingredient-admin-cook-btn"'),
    false,
    'Non-admin must NOT see open-ingredient-admin-cook-btn'
  );

  console.log('  ✅ CookModeTab.js renders shortcut with data-tab="manage" for admins only.');
}

// ----------------------------------------------------------------------------
// Test 3: main.js Handler Verification
// ----------------------------------------------------------------------------
console.log('\n3. main.js Handler Verification');
{
  const mainJs = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf8');

  // 3.1 Click listener must set activeTab = 'manage'
  assert.ok(
    mainJs.includes("state.activeTab = 'manage'") &&
    mainJs.includes('openIngredientAdminCookBtn'),
    'openIngredientAdminCookBtn must set state.activeTab = "manage"'
  );

  // 3.2 Must NOT open modal (adminImageModalOpen must be false)
  const cookBtnHandlerSection = mainJs.slice(
    mainJs.indexOf('const openIngredientAdminCookBtn'),
    mainJs.indexOf('const openIngredientAdminCookBtn') + 400
  );
  assert.ok(
    cookBtnHandlerSection.includes("state.adminImageModalOpen = false"),
    'Handler must explicitly set state.adminImageModalOpen = false'
  );
  assert.strictEqual(
    cookBtnHandlerSection.includes("state.adminImageModalOpen = true"),
    false,
    'Handler must NOT set state.adminImageModalOpen = true'
  );

  console.log('  ✅ main.js navigates directly to manage tab without opening modal.');
}

// ----------------------------------------------------------------------------
// Test 4: Full-Page Manage Tab Rendering
// ----------------------------------------------------------------------------
console.log('\n4. Full-Page Manage Tab Experience');
{
  const managePageHtml = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    embedded: true
  });

  assert.ok(
    managePageHtml.includes('admin-manage-page-container'),
    'Manage tab must render full-page container (admin-manage-page-container)'
  );
  assert.ok(
    managePageHtml.includes('admin-gallery-header'),
    'Manage tab must include header'
  );
  assert.ok(
    managePageHtml.includes('Ingredient Image Gallery'),
    'Manage tab must display gallery heading'
  );
  assert.ok(
    managePageHtml.includes('admin-stats-grid'),
    'Manage tab must display stats grid'
  );
  assert.ok(
    !managePageHtml.includes('id="admin-image-modal-overlay"'),
    'Full-page manage tab must NOT render floating modal overlay'
  );

  console.log('  ✅ Full-page Manage tab displays normal layout without cramped modal.');
}

console.log('\n======================================================================');
console.log('🎉 ALL COOK MODE MANAGE TAB NAVIGATION TESTS PASSED!');
console.log('======================================================================\n');

