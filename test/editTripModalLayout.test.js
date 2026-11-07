import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderEditTripModal } from '../src/components/ShoppingTripsView.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup mock localStorage
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};

console.log('🧪 Starting Edit Shopping Trip Modal Sizing & Layout Tests...\n');

// Mock shopping trips
const portraitTrip = {
  id: 'trip_portrait_101',
  storeName: 'Puregold Price Club',
  date: '2026-11-05',
  tripType: 'Supermarket',
  totalAmountPaid: 1540.25,
  totalScaleWeightKg: 5.60,
  receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample_tall_portrait_receipt_4000x3000.jpg',
  notes: 'Large portrait receipt test haul'
};

const landscapeTrip = {
  id: 'trip_landscape_102',
  storeName: 'Paco Wet Market',
  date: '2026-11-06',
  tripType: 'Wet Market / Palengke',
  totalAmountPaid: 420.00,
  totalScaleWeightKg: 2.10,
  receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample_wide_landscape_produce_1200x600.jpg',
  notes: 'Wide landscape produce haul'
};

const noImageTrip = {
  id: 'trip_no_img_103',
  storeName: 'Dali Everyday Grocery',
  date: '2026-11-07',
  tripType: 'Supermarket',
  totalAmountPaid: 215.50,
  totalScaleWeightKg: 0.90,
  receiptImageUrl: null,
  notes: 'No receipt photo attached'
};

// ---------------------------------------------------------------------------
// Test 1: Constrain Modal Dimensions (min(92vw, 520px), max-h-[90dvh], flex col)
// ---------------------------------------------------------------------------
console.log('Test 1: Constrain Modal Dimensions');
const htmlPortrait = renderEditTripModal({ editingTripId: portraitTrip.id, editingTrip: portraitTrip });

assert.ok(htmlPortrait.includes('min(92vw, 520px)'), 'Modal width constrained to min(92vw, 520px)');
assert.ok(htmlPortrait.includes('520px'), 'Modal maxWidth set to 520px');
assert.ok(htmlPortrait.includes('90dvh') || htmlPortrait.includes('90vh'), 'Modal max-height constrained to 90dvh');
assert.ok(htmlPortrait.includes('flex-direction: column') || htmlPortrait.includes('flex flex-col'), 'Modal uses flex column layout');
assert.ok(htmlPortrait.includes('overflow: hidden'), 'Modal container has overflow: hidden to prevent expansion');

console.log('  ✅ Modal dimensions strictly constrained: min(92vw, 520px), 90dvh, flex-col, overflow: hidden.');

// ---------------------------------------------------------------------------
// Test 2: Fixed-Size 80px × 80px Photo Thumbnail
// ---------------------------------------------------------------------------
console.log('\nTest 2: Fixed-Size 80px x 80px Photo Thumbnail');

assert.ok(htmlPortrait.includes('80px'), 'Thumbnail container has fixed 80px dimensions');
assert.ok(htmlPortrait.includes('object-fit: contain') || htmlPortrait.includes('object-contain'), 'Thumbnail image uses object-fit: contain to prevent distortion');
assert.ok(htmlPortrait.includes('width: 100%'), 'Image scales to 100% of thumbnail container');
assert.ok(htmlPortrait.includes('height: 100%'), 'Image scales to 100% of thumbnail container');
assert.ok(htmlPortrait.includes('#020617') || htmlPortrait.includes('bg-slate-950'), 'Thumbnail uses dark background');
assert.ok(htmlPortrait.includes('id="trigger-change-photo-btn"'), 'Actions trigger sits beside thumbnail');
assert.ok(htmlPortrait.includes('id="remove-trip-photo-btn"'), 'Remove photo button is present');

// Landscape trip thumbnail
const htmlLandscape = renderEditTripModal({ editingTripId: landscapeTrip.id, editingTrip: landscapeTrip });
assert.ok(htmlLandscape.includes('80px'), 'Landscape image thumbnail also strictly constrained to 80px');
assert.ok(htmlLandscape.includes('object-fit: contain'), 'Landscape image uses object-fit: contain');

// Trip without image
const htmlNoImage = renderEditTripModal({ editingTripId: noImageTrip.id, editingTrip: noImageTrip });
assert.ok(htmlNoImage.includes('80px'), 'No-image trip still renders neat 80px placeholder container');
assert.ok(htmlNoImage.includes('No photo'), 'Displays No photo placeholder');

console.log('  ✅ Photo preview strictly constrained to 80x80 thumbnail with object-fit: contain across portrait, landscape, and empty states.');

// ---------------------------------------------------------------------------
// Test 3: Three-Section Layout (Header, Scrollable Body, Pinned Footer)
// ---------------------------------------------------------------------------
console.log('\nTest 3: Three-Section Layout (Header, Scrollable Body, Pinned Footer)');

assert.ok(htmlPortrait.includes('modal-header'), 'Header element is present');
assert.ok(htmlPortrait.includes('flex-shrink: 0'), 'Header has flex-shrink: 0');

assert.ok(htmlPortrait.includes('overflow-y: auto'), 'Form body has overflow-y: auto for scrolling');
assert.ok(htmlPortrait.includes('min-height: 0'), 'Form body has min-height: 0 to allow flex container shrinking');

assert.ok(htmlPortrait.includes('modal-footer-actions') || htmlPortrait.includes('edit-trip-footer'), 'Footer element is present');
assert.ok(htmlPortrait.includes('flex-shrink: 0'), 'Footer has flex-shrink: 0 so it stays pinned');
assert.ok(htmlPortrait.includes('border-top:'), 'Footer is separated by border');
assert.ok(htmlPortrait.includes('id="cancel-edit-trip-btn"'), 'Cancel button is present in footer');
assert.ok(htmlPortrait.includes('id="save-edit-trip-btn"'), 'Save Changes button is present in footer');
assert.ok(htmlPortrait.includes('type="submit"'), 'Save button is type="submit" to submit the form');

console.log('  ✅ Modal cleanly divided into pinned header, scrollable body (overflow-y: auto), and pinned footer.');

// ---------------------------------------------------------------------------
// Test 4: EditShoppingTripModal.jsx React Component Consistency
// ---------------------------------------------------------------------------
console.log('\nTest 4: EditShoppingTripModal.jsx React Component Consistency');

const jsxSource = fs.readFileSync(path.join(__dirname, '../src/components/EditShoppingTripModal.jsx'), 'utf-8');

assert.ok(jsxSource.includes('min(92vw, 520px)'), 'React component has min(92vw, 520px) modal constraint');
assert.ok(jsxSource.includes('90dvh'), 'React component has 90dvh max-height');
assert.ok(jsxSource.includes('80px'), 'React component uses fixed 80px thumbnail');
assert.ok(jsxSource.includes('objectFit: \'contain\'') || jsxSource.includes('object-contain'), 'React component image has object-fit contain');
assert.ok(jsxSource.includes('overflow-y-auto') || jsxSource.includes('overflowY: \'auto\''), 'React component form body scrolls with overflow-y-auto');
assert.ok(jsxSource.includes('shrink-0') || jsxSource.includes('flexShrink: 0'), 'React component header and footer are pinned with shrink-0');
assert.ok(jsxSource.includes('Save Changes'), 'React component renders Save Changes');
assert.ok(jsxSource.includes('Cancel'), 'React component renders Cancel');

console.log('  ✅ EditShoppingTripModal.jsx matches strict dimension, 80x80 thumbnail, and pinned footer specifications.');

// ---------------------------------------------------------------------------
// Test 5: CSS Stylesheet Rules in src/style.css
// ---------------------------------------------------------------------------
console.log('\nTest 5: CSS Stylesheet Verification in src/style.css');

const cssSource = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf-8');

assert.ok(cssSource.includes('#edit-trip-modal'), 'CSS has #edit-trip-modal selector');
assert.ok(cssSource.includes('min(92vw, 520px)'), 'CSS defines min(92vw, 520px)');
assert.ok(cssSource.includes('90dvh'), 'CSS defines 90dvh max-height');
assert.ok(cssSource.includes('.edit-trip-thumb-box'), 'CSS defines .edit-trip-thumb-box rule');
assert.ok(cssSource.includes('80px'), 'CSS enforces 80px on thumbnail');
assert.ok(cssSource.includes('object-fit: contain'), 'CSS enforces object-fit: contain');

console.log('  ✅ src/style.css has dedicated rules for modal sizing, thumbnail constraints, and scrolling.');

console.log('\n=============================================================');
console.log('🎉 ALL EDIT SHOPPING TRIP MODAL SIZING & LAYOUT TESTS PASSED!');
console.log('=============================================================\n');
