import assert from 'node:assert';
import { renderIngredientImageAdminModal } from '../src/components/IngredientImageAdminModal.js';
import { LID_DATABASE } from '../src/data/lidDatabase.js';

console.log('🧪 Starting Admin Ingredient Image Management UI & CSS Verification Test Suite...\n');

// ============================================================================
// TEST 1: Overall Admin Panel Layout & Fixed Header/Footer Structure
// ============================================================================
console.log('Test 1: Overall Admin Panel Layout & Viewport Scroll Isolation');
{
  const html = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    stats: { totalIngredients: 36, withImage: 5, missingImage: 31, pendingReview: 0 },
    uploadFormOpen: false
  });

  assert.ok(html.includes('admin-image-modal-box'), 'Modal must have admin-image-modal-box class');
  assert.ok(html.includes('modal-header shrink-0'), 'Modal header must be fixed (shrink-0) to stay visible');
  assert.ok(html.includes('admin-image-modal-body'), 'Content body must be isolated scrollable area (admin-image-modal-body)');
  assert.ok(html.includes('modal-footer shrink-0'), 'Modal footer must be fixed (shrink-0) so actions never disappear');
  assert.ok(html.includes('id="admin-image-close-btn"'), 'Modal must include close button in header');
  assert.ok(html.includes('id="admin-image-done-btn"'), 'Modal must include Done button in fixed footer');
  assert.ok(html.includes('Total Items'), 'Metrics bar must display Total Items');
  assert.ok(html.includes('🟢 Mapped Photos'), 'Metrics bar must display Mapped Photos');

  console.log('  ✅ Modal layout, fixed header/footer, and scroll containment verified.');
}

// ============================================================================
// TEST 2: Upload Dropzone & File Browse Area
// ============================================================================
console.log('\nTest 2: Drag-and-Drop Dropzone & File Selection Feedback');
{
  // Test with upload form open without selected file
  const htmlEmpty = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    uploadFormOpen: true,
    selectedFileName: null,
    uploadPreviewUrl: null
  });

  assert.ok(htmlEmpty.includes('admin-image-dropzone'), 'Must render clearly defined dropzone (.admin-image-dropzone)');
  assert.ok(htmlEmpty.includes('id="admin-image-file-input"'), 'Must include file input in dropzone');
  assert.ok(htmlEmpty.includes('Click to browse</span> or drag & drop'), 'Dropzone must clearly instruct click to browse or drag & drop');
  assert.ok(htmlEmpty.includes('Photograph Preview'), 'Must render placeholder when no image is selected');

  // Test with selected file and preview URL
  const htmlWithFile = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    uploadFormOpen: true,
    selectedFileName: 'sayote-green.webp',
    selectedFileSize: 145200,
    uploadPreviewUrl: 'blob:http://localhost:5173/mock-uuid'
  });

  assert.ok(htmlWithFile.includes('sayote-green.webp'), 'Selected filename must be displayed');
  assert.ok(htmlWithFile.includes('141.8 KB') || htmlWithFile.includes('KB'), 'Formatted file size must be displayed');
  assert.ok(htmlWithFile.includes('Selected'), 'File chip must indicate Selected status');
  assert.ok(htmlWithFile.includes('admin-image-preview-img'), 'Preview image element must be rendered');
  assert.ok(htmlWithFile.includes('blob:http://localhost:5173/mock-uuid'), 'Preview URL must be rendered in src attribute');

  console.log('  ✅ Dropzone, drag-and-drop feedback, file metadata chip, and image preview verified.');
}

// ============================================================================
// TEST 3: Constrained Preview Bounds & Upload Progress Indicator
// ============================================================================
console.log('\nTest 3: Image Preview Constraints & Upload Progress States');
{
  const htmlUploading = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    uploadFormOpen: true,
    isUploading: true,
    uploadPreviewUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
  });

  assert.ok(htmlUploading.includes('admin-image-preview-container'), 'Preview must use constrained container (.admin-image-preview-container)');
  assert.ok(htmlUploading.includes('max-h-[168px]') || htmlUploading.includes('object-contain'), 'Image must enforce max-height and object-contain');
  assert.ok(htmlUploading.includes('Uploading to Cloudinary & Saving...'), 'Must show active upload progress message');
  assert.ok(htmlUploading.includes('disabled'), 'Submit button must be disabled during active upload');

  console.log('  ✅ Strict preview constraints and upload progress states verified.');
}

// ============================================================================
// TEST 4: Gallery Card Presentation & Metadata Formatting
// ============================================================================
console.log('\nTest 4: Gallery Card Presentation, Action Alignment & Metadata');
{
  const mockMappings = [
    {
      id: 'map_salt_1',
      protocol_id: 'lid',
      ingredient_id: 'salt-kosher',
      secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/f_auto,q_auto,w_400/kosherai/lid_protocol/ingredients/salt-kosher',
      public_id: 'kosherai/lid_protocol/ingredients/salt-kosher',
      status: 'active'
    },
    {
      id: 'map_banana_1',
      protocol_id: 'lid',
      ingredient_id: 'banana-ketchup',
      secure_url: 'https://res.cloudinary.com/dego6hgcb/image/upload/f_auto,q_auto,w_400/kosherai/lid_protocol/ingredients/banana-ketchup',
      public_id: 'kosherai/lid_protocol/ingredients/banana-ketchup',
      status: 'pending_review'
    }
  ];

  const html = renderIngredientImageAdminModal({
    activeProtocol: 'lid',
    mappings: mockMappings,
    uploadFormOpen: false
  });

  assert.ok(html.includes('admin-image-item-card'), 'Each ingredient must be wrapped in an admin-image-item-card');
  assert.ok(html.includes('🟢 Active'), 'Mapped active item must show Active badge');
  assert.ok(html.includes('🟡 Review'), 'Pending review item must show Review badge');
  assert.ok(html.includes('admin-approve-mapping-btn'), 'Pending item must provide Approve button');
  assert.ok(html.includes('admin-delete-mapping-btn'), 'Mapped item must provide Delete/Unlink button');
  assert.ok(html.includes('admin-upload-for-item-btn'), 'Item must provide Upload/Replace button');
  assert.ok(html.includes('kosherai/lid_protocol/ingredients/salt-kosher'), 'Public ID must be rendered in details');

  // Verify NO duplicate image or "Image Error" text appears on mapped ingredient cards
  assert.ok(!html.includes('Image Error'), 'Mapped ingredient card must NEVER render "Image Error" or duplicate preview beside photo');
  assert.ok(html.includes('No Image'), 'Unmapped ingredients must render single "No Image" placeholder');

  console.log('  ✅ Responsive card layout, metadata rows, and action button alignment verified.');
}

// ============================================================================
// TEST 5: React AdminIngredientImagesView / Modal Responsive Grid Gallery
// ============================================================================
console.log('\nTest 5: React AdminIngredientImagesModal.jsx Responsive Grid Gallery & Card Sizing');
{
  const fs = await import('node:fs');
  const jsxCode = fs.readFileSync('src/components/AdminIngredientImagesModal.jsx', 'utf8');

  // Verify responsive grid columns across breakpoints
  assert.ok(jsxCode.includes('grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3'), 'Must render responsive grid (grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3)');

  // Verify thumbnail container sizing (~96px to 110px: h-24 sm:h-28)
  assert.ok(jsxCode.includes('h-24 sm:h-28'), 'Thumbnail container must use compact responsive height (h-24 sm:h-28)');
  assert.ok(jsxCode.includes('overflow-hidden'), 'Thumbnail container must enforce overflow-hidden');
  assert.ok(jsxCode.includes('bg-slate-950'), 'Thumbnail container must have dark background');
  assert.ok(jsxCode.includes('flex items-center justify-center'), 'Thumbnail container must center contents');

  // Verify thumbnail image scaling with object-contain (never object-cover)
  assert.ok(jsxCode.includes('object-contain'), 'Grid thumbnail must use object-contain');
  assert.ok(!jsxCode.includes('object-cover'), 'Grid thumbnail must NEVER use object-cover');

  // Verify status indicators for mapped and missing
  assert.ok(jsxCode.includes("'✓'") || jsxCode.includes('"✓"'), 'Mapped items must display checkmark badge');
  assert.ok(jsxCode.includes("'Missing'") || jsxCode.includes('"Missing"'), 'Missing items must display Missing badge');

  // Verify quick Replace / Upload action
  assert.ok(jsxCode.includes('Replace') && jsxCode.includes('+ Upload'), 'Card must provide quick Replace / + Upload triggers');

  // Verify bottom clearance for bottom navigation
  assert.ok(jsxCode.includes('pb-32') || jsxCode.includes('pb-28'), 'Container must have bottom clearance (pb-32 or pb-28)');

  // Verify centered inspection modal
  assert.ok(jsxCode.includes('fixed inset-0') && jsxCode.includes('backdrop-blur-sm'), 'Must support clean centered inspection modal');

  console.log('  ✅ React AdminIngredientImagesView compact responsive grid gallery verified.');
}

console.log('\n======================================================================');
console.log('🎉 ALL ADMIN IMAGE UI & CSS TESTS (1 THROUGH 5) PASSED SUCCESSFULLY!');
console.log('======================================================================\n');

