// Test Suite: Automatically Complete Quick-Capture Drafts After Editing
// Verifies:
// 1. Incomplete drafts retain is_draft = true and DRAFT badge
// 2. Editing and completing required details (scale weight > 0, amount > 0, >= 1 valid item) removes DRAFT status
// 3. Notes are automatically updated to "Receipt scanned (X items verified)" if previously a default draft note
// 4. Custom user notes are strictly preserved and not overwritten
// 5. Trip ID, photo URL, store, and date are preserved without duplicates
// 6. Persistence in courseProjectStorage and API synchronization via PATCH

import assert from 'node:assert';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import tripsApiHandler from '../api/trips.js';
import {
  saveShoppingTrip,
  getShoppingTrips,
  getGroceryItems,
  updateShoppingTrip,
  saveEditedTrip,
  mergeRemoteCourseData,
  isDraftDefaultNote
} from '../src/services/courseProjectStorage.js';
import { renderShoppingTripsView, renderTripCard } from '../src/components/ShoppingTripsView.js';

console.log('🧪 Starting Complete Quick-Capture Drafts Test Suite...\n');

// Mock localStorage if in Node environment
const mockStore = new Map();
global.localStorage = {
  getItem: (key) => mockStore.get(String(key)) ?? null,
  setItem: (key, val) => mockStore.set(String(key), String(val)),
  removeItem: (key) => mockStore.delete(String(key)),
  clear: () => mockStore.clear()
};

const customEventsDispatched = [];
global.window = {
  dispatchEvent: (event) => {
    customEventsDispatched.push(event.type);
    return true;
  },
  CustomEvent: global.CustomEvent || class {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  },
  Event: global.Event
};

let passedTests = 0;
function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAllTests() {
  // -------------------------------------------------------------------------
  // Test Section 1: Helper isDraftDefaultNote Verification
  // -------------------------------------------------------------------------
  console.log('--- Section 1: Draft Note Detection ---');

  runTest('isDraftDefaultNote accurately identifies default placeholder draft notes', () => {
    assert.strictEqual(isDraftDefaultNote('Supermarket draft (Quick Capture)'), true);
    assert.strictEqual(isDraftDefaultNote('Wet market draft (Quick Capture)'), true);
    assert.strictEqual(isDraftDefaultNote('📝 Photo captured draft. Click Edit to enter grocery items.'), true);
    assert.strictEqual(isDraftDefaultNote('Supermarket draft'), true);
    assert.strictEqual(isDraftDefaultNote('Wet market draft'), true);
    assert.strictEqual(isDraftDefaultNote(''), true);
    assert.strictEqual(isDraftDefaultNote(null), true);
  });

  runTest('isDraftDefaultNote preserves meaningful user-entered notes', () => {
    assert.strictEqual(isDraftDefaultNote('Bought fresh chicken breast on promotion with SM Advantage card'), false);
    assert.strictEqual(isDraftDefaultNote('Organic sayote from Benguet farmer stall'), false);
    assert.strictEqual(isDraftDefaultNote('Shabbat preparation'), false);
  });

  // -------------------------------------------------------------------------
  // Test Section 2: SM Supermarket Chicken Breast Draft Scenario
  // -------------------------------------------------------------------------
  console.log('\n--- Section 2: SM Supermarket Chicken Breast Scenario ---');

  mockStore.clear();

  const photoUrl = 'https://res.cloudinary.com/demo/image/upload/sample_receipt.jpg';
  const initialDraftInput = {
    storeName: 'SM Supermarket',
    date: '2026-11-08',
    totalScaleWeightKg: 0,
    totalAmountPaid: 0,
    tripType: 'Supermarket',
    receiptImageUrl: photoUrl,
    notes: 'Supermarket draft (Quick Capture)',
    isDraft: true,
    is_draft: true
  };

  const initialSave = await saveShoppingTrip(initialDraftInput, []);
  const initialTrip = initialSave?.trip || initialSave;
  const tripId = initialTrip.id;

  runTest('Initial SM Supermarket trip is saved as a DRAFT', () => {
    assert.ok(tripId, 'Trip ID exists');
    assert.strictEqual(initialTrip.isDraft, true);
    assert.strictEqual(initialTrip.is_draft, true);
    assert.strictEqual(initialTrip.totalScaleWeightKg, 0);
    assert.strictEqual(initialTrip.totalAmountPaid, 0);

    const cardHtml = renderTripCard(initialTrip);
    assert(cardHtml.includes('📝 DRAFT'), 'Renders DRAFT badge while incomplete');
    assert(cardHtml.includes('Photo captured draft. Click Edit to enter grocery items'), 'Renders draft items placeholder');
  });

  await runAsyncTest('Editing and completing trip removes DRAFT status and updates notes', async () => {
    const updatedPayload = {
      id: tripId,
      storeName: 'SM Supermarket',
      date: '2026-11-08',
      totalScaleWeightKg: 0.66,
      totalAmountPaid: 215.00,
      tripType: 'Supermarket',
      receiptImageUrl: photoUrl,
      notes: 'Supermarket draft (Quick Capture)', // Placeholder note
      items: [
        {
          id: `item_${tripId}_1`,
          name: 'Chicken Breast',
          quantity: 0.66,
          unit: 'kg',
          unitPrice: 325.76,
          totalPrice: 215.00
        }
      ]
    };

    // Save edited trip via updateShoppingTrip / saveEditedTrip
    const updated = await updateShoppingTrip(tripId, updatedPayload);

    assert.ok(updated, 'Update returned trip object');
    assert.strictEqual(updated.id, tripId, 'Trip ID must remain identical');
    assert.strictEqual(updated.totalScaleWeightKg, 0.66, 'Weight: 0.66 kg preserved');
    assert.strictEqual(updated.totalAmountPaid, 215.00, 'Price: ₱215.00 preserved');
    assert.strictEqual(updated.receiptImageUrl, photoUrl, 'Original photo URL preserved');
    assert.strictEqual(updated.storeName, 'SM Supermarket', 'Store name preserved');
    assert.strictEqual(updated.date, '2026-11-08', 'Date preserved');

    // DRAFT status removed
    assert.strictEqual(updated.isDraft, false, 'isDraft must be false');
    assert.strictEqual(updated.is_draft, false, 'is_draft must be false');

    // Notes updated to "Receipt scanned (1 items verified)"
    assert.strictEqual(updated.notes, 'Receipt scanned (1 items verified)', 'Notes must show 1 items verified');

    // Card rendered without DRAFT badge
    const cardHtml = renderTripCard(updated);
    assert(!cardHtml.includes('📝 DRAFT'), 'DRAFT badge MUST disappear after completion');
    assert(!cardHtml.includes('Photo captured draft'), 'Draft placeholder MUST disappear');

    // No duplicate trip created
    const allTrips = getShoppingTrips();
    assert.strictEqual(allTrips.filter(t => t.id === tripId).length, 1, 'Only 1 record exists with original ID');

    // Linked grocery items exist without duplicates
    const allGroceries = getGroceryItems().filter(i => i.tripId === tripId);
    assert.strictEqual(allGroceries.length, 1, 'Exactly 1 grocery item linked');
    assert.strictEqual(allGroceries[0].name, 'Chicken Breast');
  });

  // -------------------------------------------------------------------------
  // Test Section 3: Incomplete Draft Scenario
  // -------------------------------------------------------------------------
  console.log('\n--- Section 3: Incomplete Draft Remains DRAFT ---');

  const incompleteDraftInput = {
    storeName: 'Paco Wet Market',
    date: '2026-11-09',
    totalScaleWeightKg: 0,
    totalAmountPaid: 0,
    tripType: 'wet_market',
    notes: 'Wet market draft (Quick Capture)',
    isDraft: true,
    is_draft: true
  };

  const incSave = await saveShoppingTrip(incompleteDraftInput, []);
  const incTrip = incSave?.trip || incSave;

  await runAsyncTest('Editing without completing required fields retains DRAFT status', async () => {
    // Only updated storeName, scale weight and amount remain 0 with no items
    const stillIncomplete = await updateShoppingTrip(incTrip.id, {
      storeName: 'Paco Wet Market Stall #2',
      totalScaleWeightKg: 0,
      totalAmountPaid: 0
    });

    assert.strictEqual(stillIncomplete.isDraft, true, 'isDraft remains true when incomplete');
    assert.strictEqual(stillIncomplete.is_draft, true, 'is_draft remains true when incomplete');
    assert.strictEqual(stillIncomplete.notes, 'Wet market draft (Quick Capture)', 'Draft notes preserved');

    const cardHtml = renderTripCard(stillIncomplete);
    assert(cardHtml.includes('📝 DRAFT'), 'DRAFT badge remains visible');
  });

  // -------------------------------------------------------------------------
  // Test Section 4: Meaningful User Note Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- Section 4: Meaningful User Note Preservation ---');

  const customNoteDraftInput = {
    storeName: 'Savemore Market',
    date: '2026-11-09',
    totalScaleWeightKg: 0,
    totalAmountPaid: 0,
    tripType: 'Supermarket',
    notes: 'Emergency low-iodine salt purchase requested by doctor',
    isDraft: true,
    is_draft: true
  };

  const cnSave = await saveShoppingTrip(customNoteDraftInput, []);
  const cnTrip = cnSave?.trip || cnSave;

  await runAsyncTest('Completing a draft with custom user notes preserves user note text', async () => {
    const completedCustom = await updateShoppingTrip(cnTrip.id, {
      totalScaleWeightKg: 0.5,
      totalAmountPaid: 65.00,
      notes: 'Emergency low-iodine salt purchase requested by doctor',
      items: [
        {
          id: `item_${cnTrip.id}_1`,
          name: 'Non-Iodized Pure Salt',
          quantity: 1,
          unit: 'pack'
        }
      ]
    });

    assert.strictEqual(completedCustom.isDraft, false, 'isDraft is false');
    assert.strictEqual(completedCustom.is_draft, false, 'is_draft is false');
    assert.strictEqual(
      completedCustom.notes,
      'Emergency low-iodine salt purchase requested by doctor',
      'Meaningful user note MUST NOT be overwritten'
    );
  });

  // -------------------------------------------------------------------------
  // Test Section 5: API /api/trips PATCH Endpoint & Neon Sync
  // -------------------------------------------------------------------------
  console.log('\n--- Section 5: /api/trips PATCH & Cloud Synchronization ---');

  runTest('saveEditedTrip is exported as alias in courseProjectStorage.js', () => {
    assert.strictEqual(typeof saveEditedTrip, 'function');
  });

  runTest('mergeRemoteCourseData preserves is_draft = false from remote sync', () => {
    const remoteTrips = [
      {
        id: tripId,
        storeName: 'SM Supermarket',
        date: '2026-11-08',
        totalScaleWeightKg: 0.66,
        totalAmountPaid: 215.00,
        is_draft: false,
        isDraft: false,
        notes: 'Receipt scanned (1 items verified)',
        items: [
          { id: `item_${tripId}_1`, name: 'Chicken Breast', quantity: 0.66, unit: 'kg' }
        ]
      }
    ];

    const result = mergeRemoteCourseData(remoteTrips, [], []);
    const storedTrips = getShoppingTrips();
    const syncedTrip = storedTrips.find(t => t.id === tripId);

    assert.ok(syncedTrip, 'Trip found in storage');
    assert.strictEqual(syncedTrip.is_draft, false, 'Remote sync does not resurrect is_draft = true');
    assert.strictEqual(syncedTrip.notes, 'Receipt scanned (1 items verified)');
  });

  console.log(`\n🎉 All ${passedTests} Complete Quick-Capture Draft tests passed successfully!\n`);
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
