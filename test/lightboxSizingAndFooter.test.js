import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReceiptLightboxModal } from '../src/components/ShoppingTripsView.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Starting Lightbox Sizing & Footer Readability Tests...\n');

// Mock trip with landscape/portrait receipt
const trip = {
  id: 'trip_lightbox_test_1',
  storeName: 'Puregold Price Club',
  date: '2026-11-05',
  tripType: 'Supermarket',
  totalAmountPaid: 1250.75,
  totalScaleWeightKg: 4.80,
  itemsCount: 6,
  receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample_receipt.jpg',
  notes: 'Weekly fresh vegetables, chicken breast, and cooking oil haul'
};

const html = renderReceiptLightboxModal(trip);

// ---------------------------------------------------------------------------
// Test 1: Modal Constraints & Z-Index Positioning
// ---------------------------------------------------------------------------
console.log('Test 1: Modal Constraints & Z-Index Positioning');

assert.ok(html.includes('min(92vw, 420px)'), 'Modal dialog constrained to width min(92vw, 420px)');
assert.ok(html.includes('80dvh') || html.includes('80vh'), 'Modal dialog constrained to max-height 80dvh');
assert.ok(html.includes('z-index: 2000') || html.includes('z-index: 200') || html.includes('z-[200]'), 'Overlay z-index (2000) places it above bottom navigation (z-index: 100)');
assert.ok(html.includes('safe-area-inset-bottom'), 'Overlay respects mobile safe-area insets');
assert.ok(html.includes('onclick="event.stopPropagation();"') || html.includes('e.stopPropagation()'), 'Modal content prevents click propagation from closing modal');

console.log('  ✅ Modal constrained to min(92vw, 420px) and max-height 80dvh with z-index 2000 above bottom nav and safe-area insets.');

// ---------------------------------------------------------------------------
// Test 2: Image Sizing & Neutral Background
// ---------------------------------------------------------------------------
console.log('\nTest 2: Image Sizing & Neutral Background');

assert.ok(html.includes('object-fit: contain') || html.includes('object-contain'), 'Uses object-fit: contain so receipts are never cropped or stretched');
assert.ok(!html.includes('object-cover'), 'Never uses object-cover on receipt lightbox image');
assert.ok(html.includes('35dvh') || html.includes('35vh'), 'Image height strictly constrained to 35dvh');
assert.ok(html.includes('#020617') || html.includes('bg-slate-950'), 'Image stage has dark neutral background');
assert.ok(html.includes('max-width: 100%') || html.includes('max-w-full'), 'Image fits horizontally within stage');

console.log('  ✅ Receipt image strictly constrained to max 35dvh with object-fit: contain and dark neutral background.');

// ---------------------------------------------------------------------------
// Test 3: Footer and Details Layout (No Overlap, Opaque Background)
// ---------------------------------------------------------------------------
console.log('\nTest 3: Footer and Details Layout');

assert.ok(html.includes('lightbox-footer'), 'Includes lightbox-footer section');
assert.ok(html.includes('flex-shrink: 0'), 'Footer uses flex-shrink: 0 in normal flex layout');
assert.ok(html.includes('#0f172a') || html.includes('bg-slate-900'), 'Footer has solid opaque background');
assert.ok(!html.includes('position: absolute') && !html.includes('position: fixed; bottom'), 'Footer is part of normal flex flow, not fixed or absolute');

// 3 Metadata cards
assert.ok(html.includes('Amount Paid'), 'Contains Amount Paid card label');
assert.ok(html.includes('1,250.75'), 'Renders formatted amount paid');
assert.ok(html.includes('Scale Weight'), 'Contains Scale Weight card label');
assert.ok(html.includes('4.80 kg'), 'Renders formatted scale weight');
assert.ok(html.includes('Items Count'), 'Contains Items Count card label');
assert.ok(html.includes('6 items'), 'Renders items count');

// Notes
assert.ok(html.includes('Notes:'), 'Contains notes section');
assert.ok(html.includes('Weekly fresh vegetables, chicken breast'), 'Renders notes content');

console.log('  ✅ Footer is in normal flex flow with opaque background and 3 distinct metadata cards.');

// ---------------------------------------------------------------------------
// Test 4: ShoppingTripsView.jsx Component Consistency
// ---------------------------------------------------------------------------
console.log('\nTest 4: ShoppingTripsView.jsx Consistency');

const jsxSource = fs.readFileSync(path.join(__dirname, '../src/components/ShoppingTripsView.jsx'), 'utf-8');

assert.ok(jsxSource.includes('min(92vw, 420px)'), 'JSX lightbox modal has min(92vw, 420px)');
assert.ok(jsxSource.includes('80dvh'), 'JSX lightbox modal has 80dvh max-height');
assert.ok(jsxSource.includes('zIndex: 2000'), 'JSX overlay has z-index 2000');
assert.ok(jsxSource.includes('safe-area-inset-bottom'), 'JSX overlay respects safe area insets');
assert.ok(jsxSource.includes('35dvh'), 'JSX image has 35dvh constraint');
assert.ok(jsxSource.includes('contain'), 'JSX image uses contain object-fit');
assert.ok(jsxSource.includes("document.body.style.overflow = 'hidden'"), 'JSX locks body scroll when open');
assert.ok(jsxSource.includes('document.body.style.overflow = originalOverflow'), 'JSX restores body scroll when closed');

console.log('  ✅ ShoppingTripsView.jsx matches all constraints, z-index, and scroll lock specifications.');

// ---------------------------------------------------------------------------
// Test 5: Graceful Handling of Trips without Image or Optional Metadata
// ---------------------------------------------------------------------------
console.log('\nTest 5: Trips Without Image or Optional Notes');

const tripNoNotes = {
  id: 'trip_no_notes',
  storeName: 'Aling Nena Sari-sari',
  date: '2026-11-06',
  tripType: 'Convenience Store',
  totalAmountPaid: 85.00,
  totalScaleWeightKg: 0,
  itemsCount: 1,
  receiptImageUrl: 'https://res.cloudinary.com/demo/image/upload/tiny.jpg',
  notes: ''
};

const htmlNoNotes = renderReceiptLightboxModal(tripNoNotes);
assert.ok(htmlNoNotes.includes('—'), 'Scale weight defaults to em-dash when 0');
assert.ok(!htmlNoNotes.includes('Notes:'), 'Notes row omitted cleanly when empty');

console.log('  ✅ Empty scale weight and notes handled gracefully without broken layouts.');

console.log('\n=============================================================');
console.log('🎉 ALL LIGHTBOX SIZING & FOOTER READABILITY TESTS PASSED!');
console.log('=============================================================\n');

