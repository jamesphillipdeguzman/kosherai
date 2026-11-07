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

assert.ok(html.includes('max-w-lg'), 'Modal container constrained to max-w-lg');
assert.ok(html.includes('max-h-[85dvh]'), 'Modal container constrained to max-h-[85dvh]');
assert.ok(html.includes('z-[200]') || html.includes('z-index: 200'), 'Overlay z-index (200) places it above bottom navigation (z-index: 100)');
assert.ok(html.includes('safe-area-inset-bottom'), 'Overlay respects mobile safe-area insets');
assert.ok(html.includes('onclick="event.stopPropagation();"'), 'Modal content prevents click propagation from closing modal');

console.log('  ✅ Modal constrained to max-w-lg and max-h-[85dvh] with z-index above bottom nav and safe-area insets.');

// ---------------------------------------------------------------------------
// Test 2: Image Sizing & Neutral Background
// ---------------------------------------------------------------------------
console.log('\nTest 2: Image Sizing & Neutral Background');

assert.ok(html.includes('object-contain'), 'Uses object-contain so receipts are never cropped or stretched');
assert.ok(!html.includes('object-cover'), 'Never uses object-cover on receipt lightbox image');
assert.ok(html.includes('max-h-[50dvh]') || html.includes('max-h-[52dvh]'), 'Image height constrained to ~50-52dvh');
assert.ok(html.includes('bg-slate-950'), 'Image wrapper has dark neutral slate-950 background');
assert.ok(html.includes('max-w-full'), 'Image uses max-w-full to fit horizontally');

console.log('  ✅ Receipt image uses object-contain, dark slate-950 background, and 50-52dvh height limits.');

// ---------------------------------------------------------------------------
// Test 3: Footer and Details Layout (No Overlap, Opaque Background)
// ---------------------------------------------------------------------------
console.log('\nTest 3: Footer and Details Layout');

assert.ok(html.includes('lightbox-footer'), 'Includes lightbox-footer section');
assert.ok(html.includes('shrink-0'), 'Footer uses shrink-0 in normal flex layout');
assert.ok(html.includes('bg-slate-900'), 'Footer has solid opaque bg-slate-900 background');
assert.ok(!html.includes('position: absolute') && !html.includes('fixed bottom'), 'Footer is part of normal flex flow, not fixed or absolute');

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

assert.ok(jsxSource.includes('max-w-lg'), 'JSX lightbox modal has max-w-lg');
assert.ok(jsxSource.includes('max-h-[85dvh]'), 'JSX lightbox modal has max-h-[85dvh]');
assert.ok(jsxSource.includes('z-[200]') || jsxSource.includes('zIndex: 200'), 'JSX overlay has z-index 200');
assert.ok(jsxSource.includes('safe-area-inset-bottom'), 'JSX overlay respects safe area insets');
assert.ok(jsxSource.includes('max-h-[50dvh]') || jsxSource.includes('max-h-[52dvh]'), 'JSX image has 50-52dvh constraint');
assert.ok(jsxSource.includes('object-contain'), 'JSX image uses object-contain');
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

