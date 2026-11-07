// Automated Test Suite: Offline Quick Capture, Optional OCR Toggle, and Draft Trips
// Verifies:
// 1. enableOcrScan preference defaults to false (OFF)
// 2. Preference persistence via isOcrScanEnabled() and setOcrScanEnabled()
// 3. Draft shopping trip creation with isDraft: true / is_draft: true
// 4. Strict exclusion of fake grocery items (no Unsorted Produce or zero-weight items)
// 5. Draft badge and placeholder rendering in ShoppingTripsView
// 6. Non-destructive draft editing and update without record duplication

import assert from 'assert';
import {
  isOcrScanEnabled,
  setOcrScanEnabled,
  getSettings,
  saveSettings
} from '../src/services/storage.js';

import {
  saveShoppingTrip,
  getShoppingTrips,
  getGroceryItems,
  updateShoppingTrip
} from '../src/services/courseProjectStorage.js';

import { renderShoppingTripsView } from '../src/components/ShoppingTripsView.js';

console.log('🧪 Starting KosherAI Offline Quick Capture & Drafts Test Suite...\n');

// Mock localStorage if in Node environment
if (typeof global.localStorage === 'undefined') {
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(String(key)) ?? null,
    setItem: (key, val) => store.set(String(key), String(val)),
    removeItem: (key) => store.delete(String(key)),
    clear: () => store.clear()
  };
}

// -------------------------------------------------------------------
// Test 1: enableOcrScan Defaults to OFF and Persists Across Sessions
// -------------------------------------------------------------------
console.log('Test 1: enableOcrScan Preference Default & Persistence');

// Clear storage to verify fresh default
localStorage.removeItem('kosherai_enable_ocr_scan');
localStorage.removeItem('kosherai_settings');

assert.strictEqual(
  isOcrScanEnabled(),
  false,
  'Default enableOcrScan preference MUST be false (OFF)'
);

const settings = getSettings();
assert.strictEqual(
  settings.enableOcrScan,
  false,
  'Settings object default enableOcrScan MUST be false'
);

// Enable OCR and verify persistence
setOcrScanEnabled(true);
assert.strictEqual(
  isOcrScanEnabled(),
  true,
  'isOcrScanEnabled() must return true after setOcrScanEnabled(true)'
);
assert.strictEqual(
  localStorage.getItem('kosherai_enable_ocr_scan'),
  'true',
  'Preference must persist to localStorage key kosherai_enable_ocr_scan'
);

// Toggle back to OFF
setOcrScanEnabled(false);
assert.strictEqual(
  isOcrScanEnabled(),
  false,
  'isOcrScanEnabled() must return false after toggling OFF'
);
assert.strictEqual(
  localStorage.getItem('kosherai_enable_ocr_scan'),
  'false',
  'localStorage must reflect false'
);

console.log('  ✅ enableOcrScan defaults to false and persists across sessions.\n');

// -------------------------------------------------------------------
// Test 2: Incomplete Quick Capture Saves Draft Without Fake Items
// -------------------------------------------------------------------
console.log('Test 2: Quick Capture Incomplete Shopping Trip Draft');

const draftPhotoDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';
const draftTripInput = {
  storeName: 'Paco Wet Market Stall #4',
  date: '2026-11-08',
  totalScaleWeightKg: 0,
  totalAmountPaid: 0,
  tripType: 'wet_market',
  receiptImageUrl: draftPhotoDataUrl,
  notes: 'Wet market draft (Quick Capture)',
  isDraft: true,
  is_draft: true
};

// Save draft with NO items entered
const saveResult = await saveShoppingTrip(draftTripInput, []);
const savedDraft = saveResult?.trip || saveResult;

assert.ok(savedDraft && savedDraft.id, 'Draft trip must be created with valid ID');
assert.strictEqual(savedDraft.isDraft, true, 'savedDraft.isDraft must be true');
assert.strictEqual(savedDraft.is_draft, true, 'savedDraft.is_draft must be true');
assert.strictEqual(savedDraft.storeName, 'Paco Wet Market Stall #4');
assert.strictEqual(savedDraft.receiptImageUrl, draftPhotoDataUrl);

// Retrieve all trips and verify draft is present
const allTrips = getShoppingTrips();
const matchedTrip = allTrips.find(t => t.id === savedDraft.id);
assert.ok(matchedTrip, 'Saved draft must exist in shopping trips storage');
assert.strictEqual(matchedTrip.isDraft, true, 'Retrieved trip must preserve isDraft = true');
assert.strictEqual(matchedTrip.is_draft, true, 'Retrieved trip must preserve is_draft = true');

// Verify NO fake grocery records were generated
const allGroceryItems = getGroceryItems();
const linkedGroceries = allGroceryItems.filter(i => i.tripId === savedDraft.id);
assert.strictEqual(
  linkedGroceries.length,
  0,
  'NO fake grocery items (e.g. Unsorted Produce or zero-weight items) should be created for empty draft'
);

console.log('  ✅ Draft trip saved with is_draft=true and zero fake grocery items.\n');

// -------------------------------------------------------------------
// Test 3: ShoppingTripsView Renders Draft Badge and Placeholder Notice
// -------------------------------------------------------------------
console.log('Test 3: ShoppingTripsView Draft Badge & Placeholder Notice');

const viewHtml = renderShoppingTripsView({
  shoppingTrips: [savedDraft],
  groceryPurchases: [],
  selectedWeek: 'all'
});

assert.ok(
  viewHtml.includes('📝 DRAFT'),
  'ShoppingTripsView must display the 📝 DRAFT badge for draft trips'
);

assert.ok(
  viewHtml.includes('Photo captured draft. Click Edit to enter grocery items'),
  'ShoppingTripsView must render placeholder notice for drafts with zero items'
);

console.log('  ✅ ShoppingTripsView displays 📝 DRAFT badge and guidance placeholder.\n');

// -------------------------------------------------------------------
// Test 4: Updating a Draft Trip Later Without Duplicating Record
// -------------------------------------------------------------------
console.log('Test 4: Non-Destructive Draft Update (Completing Details Later)');

const updatedTripPayload = {
  id: savedDraft.id,
  storeName: 'Paco Wet Market Stall #4',
  date: '2026-11-08',
  totalScaleWeightKg: 2.75,
  totalAmountPaid: 450,
  tripType: 'wet_market',
  receiptImageUrl: draftPhotoDataUrl,
  notes: 'Completed wet market purchases at home',
  isDraft: false,
  is_draft: false,
  items: [
    {
      id: `item_${Date.now()}_1`,
      name: 'Fresh Bangus (Milkfish)',
      quantity: 1.5,
      unit: 'kg',
      unitPrice: 200,
      totalPrice: 300,
      weightGrams: 1500,
      category: 'Fish & Seafood',
      lidStatus: 'AVOID'
    },
    {
      id: `item_${Date.now()}_2`,
      name: 'Kangkong Leaves',
      quantity: 2,
      unit: 'bundle',
      unitPrice: 25,
      totalPrice: 50,
      weightGrams: 300,
      category: 'Vegetables',
      lidStatus: 'SAFE'
    }
  ]
};

const completedTrip = await updateShoppingTrip(savedDraft.id, updatedTripPayload, updatedTripPayload.items);

assert.ok(completedTrip, 'Update must return completed trip');
assert.strictEqual(completedTrip.id, savedDraft.id, 'Trip ID must remain identical');
assert.strictEqual(completedTrip.isDraft, false, 'isDraft must now be false');
assert.strictEqual(completedTrip.totalScaleWeightKg, 2.75, 'Scale weight must be updated');
assert.strictEqual(completedTrip.totalAmountPaid, 450, 'Total amount must be updated');

// Check that trips list does not have duplicates
const tripsAfterUpdate = getShoppingTrips();
const matchingCount = tripsAfterUpdate.filter(t => t.id === savedDraft.id).length;
assert.strictEqual(matchingCount, 1, 'Trip must not be duplicated upon completion');

// Check that grocery items are now present
const finalGroceries = getGroceryItems().filter(i => i.tripId === savedDraft.id);
assert.strictEqual(finalGroceries.length, 2, '2 itemized grocery items must be saved');
assert.strictEqual(finalGroceries[0].name, 'Fresh Bangus (Milkfish)');

console.log('  ✅ Draft completed and updated without duplicating records.\n');

console.log('======================================================================');
console.log('🎉 ALL OFFLINE QUICK CAPTURE & DRAFT TESTS PASSED SUCCESSFULLY!');
console.log('======================================================================\n');
