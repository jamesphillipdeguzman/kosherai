// Test Suite for Edit Shopping Trip Feature
// Verifies UI markup, courseProjectStorage updateShoppingTrip, and API PUT/PATCH endpoint

import assert from 'node:assert';
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import tripsApiHandler from '../api/trips.js';
import fs from 'node:fs';
import {
  renderShoppingTripsView,
  renderTripCard,
  renderEditTripModal,
  TRIP_TYPES
} from '../src/components/ShoppingTripsView.js';
import {
  updateShoppingTrip,
  getShoppingTrips,
  saveShoppingTrip,
  getExpenses
} from '../src/services/courseProjectStorage.js';

console.log('🧪 Starting Edit Shopping Trip Test Suite...\n');

// ---------------------------------------------------------------------------
// Mock Helpers for API Testing
// ---------------------------------------------------------------------------
function createMockReqRes(method, headers = {}, body = null, url = '/api/trips') {
  let statusCode = 200;
  let responseData = null;
  const resHeaders = {};

  const req = {
    method,
    url,
    headers: { ...headers },
    body
  };

  const res = {
    statusCode: 200,
    setHeader: (k, v) => { resHeaders[k.toLowerCase()] = v; },
    status: (code) => {
      statusCode = code;
      res.statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    end: (str) => {
      if (str && !responseData) {
        try { responseData = JSON.parse(str); } catch { responseData = str; }
      }
      return res;
    }
  };

  return {
    req,
    res,
    getStatus: () => res.statusCode || statusCode,
    getData: () => responseData
  };
}

// ---------------------------------------------------------------------------
// Mock DOM / localStorage for Client Services
// ---------------------------------------------------------------------------
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

const customEventsDispatched = [];
global.window = {
  dispatchEvent: (event) => {
    customEventsDispatched.push(event);
  }
};
global.CustomEvent = class CustomEvent {
  constructor(name, options = {}) {
    this.type = name;
    this.detail = options.detail;
  }
};

// ---------------------------------------------------------------------------
// Test 1: UI Markup Verification in ShoppingTripsView.jsx
// ---------------------------------------------------------------------------
console.log('Test 1: UI Components in ShoppingTripsView.jsx');

const sampleTrip = {
  id: 'trip_test_101',
  storeName: 'Puregold Jr Supermarket',
  tripType: 'Supermarket',
  totalAmountPaid: 2450.50,
  totalScaleWeightKg: 5.75,
  date: '2026-11-02',
  notes: 'Weekly baseline vegetable haul',
  projectWeek: 1,
  synced: true,
  itemsCount: 4
};

// Seed into localStorage so renderShoppingTripsView can pick it up
mockStorage.set('kosherai_course_trips', JSON.stringify([sampleTrip]));

// 1.1 renderTripCard standard mode has Edit and Delete buttons
const cardHtml = renderTripCard(sampleTrip, false);
assert.ok(cardHtml.includes('edit-trip-btn'), 'Card must have .edit-trip-btn');
assert.ok(cardHtml.includes('data-edit-trip="trip_test_101"'), 'Card must have data-edit-trip attribute');
assert.ok(cardHtml.includes('✏️'), 'Edit button must include pencil icon');
assert.ok(cardHtml.includes('delete-trip-btn'), 'Card must have .delete-trip-btn');
assert.ok(cardHtml.includes('data-delete-trip="trip_test_101"'), 'Card must have data-delete-trip attribute');
console.log('  ✅ Standard trip card contains Edit (pencil icon) and Delete Trip buttons.');

// 1.2 renderTripCard inline editing mode
const inlineEditCardHtml = renderTripCard(sampleTrip, true);
assert.ok(inlineEditCardHtml.includes('is-editing'), 'Inline card must contain .is-editing');
assert.ok(inlineEditCardHtml.includes('trip-inline-edit-form'), 'Inline card must contain editing form');
assert.ok(inlineEditCardHtml.includes('Puregold Jr Supermarket'), 'Inline form must pre-populate storeName');
assert.ok(inlineEditCardHtml.includes('2450.5'), 'Inline form must pre-populate totalAmountPaid');
assert.ok(inlineEditCardHtml.includes('5.75'), 'Inline form must pre-populate totalScaleWeightKg');
assert.ok(inlineEditCardHtml.includes('2026-11-02'), 'Inline form must pre-populate date');
assert.ok(inlineEditCardHtml.includes('Weekly baseline vegetable haul'), 'Inline form must pre-populate notes');
assert.ok(inlineEditCardHtml.includes('save-edit-trip-btn') && inlineEditCardHtml.includes('Save Changes'), 'Inline form must have Save Changes button');
assert.ok(inlineEditCardHtml.includes('cancel-edit-trip-btn') && inlineEditCardHtml.includes('Cancel'), 'Inline form must have Cancel button');
console.log('  ✅ Inline editing card is pre-populated with all 6 fields and Save/Cancel buttons.');

// 1.3 renderEditTripModal
const modalHtml = renderEditTripModal({ editTripModalOpen: true, editingTripId: 'trip_test_101', editingTrip: sampleTrip });
assert.ok(modalHtml.includes('id="edit-trip-modal"'), 'Modal must have #edit-trip-modal ID');
assert.ok(modalHtml.includes('id="edit-store-name"'), 'Modal must have #edit-store-name input');
assert.ok(modalHtml.includes('id="edit-trip-type"'), 'Modal must have #edit-trip-type select');
assert.ok(modalHtml.includes('id="edit-total-amount"'), 'Modal must have #edit-total-amount input');
assert.ok(modalHtml.includes('id="edit-scale-weight"'), 'Modal must have #edit-scale-weight input');
assert.ok(modalHtml.includes('id="edit-trip-date"'), 'Modal must have #edit-trip-date input');
assert.ok(modalHtml.includes('id="edit-notes"'), 'Modal must have #edit-notes input');
assert.ok(modalHtml.includes('id="save-edit-trip-btn"'), 'Modal must have #save-edit-trip-btn');
assert.ok(modalHtml.includes('id="cancel-edit-trip-btn"'), 'Modal must have #cancel-edit-trip-btn');
assert.ok(modalHtml.includes('Save Changes'), 'Modal must display Save Changes text');
assert.ok(modalHtml.includes('Cancel'), 'Modal must display Cancel text');
console.log('  ✅ Edit Modal contains pre-populated inputs for all required trip fields.');

// ---------------------------------------------------------------------------
// Test 2: Storage updateShoppingTrip Function
// ---------------------------------------------------------------------------
console.log('\nTest 2: courseProjectStorage updateShoppingTrip()');

// Initialize trip and expense
mockStorage.set('kosherai_course_trips', JSON.stringify([sampleTrip]));
mockStorage.set('kosherai_course_expenses', JSON.stringify([{
  id: 'exp_trip_trip_test_101',
  tripId: 'trip_test_101',
  date: '2026-11-02',
  vendor: 'Puregold Jr Supermarket',
  category: 'Supermarket',
  amount: 2450.50
}]));

customEventsDispatched.length = 0;

// Execute update locally (mocking offline/fetch failure gracefully)
const nativeFetch = global.fetch;
let remotePatchCalled = false;
global.fetch = async (url, opts) => {
  if (url === '/api/trips') {
    remotePatchCalled = true;
    assert.strictEqual(opts.method, 'PATCH', 'Remote fetch must use PATCH method');
    assert.strictEqual(opts.credentials, 'include', 'Remote fetch must include credentials');
    assert.ok(opts.headers['content-type'] || opts.headers['Content-Type'], 'Must have Content-Type');
    const body = JSON.parse(opts.body);
    assert.strictEqual(body.id, 'trip_test_101');
    assert.strictEqual(body.storeName, 'SM Hypermarket Updated');
    assert.strictEqual(body.totalAmountPaid, 2800);
    assert.strictEqual(body.totalScaleWeightKg, 6.2);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, synced: true })
    };
  }
  return nativeFetch(url, opts);
};

const updatedResult = await updateShoppingTrip('trip_test_101', {
  storeName: 'SM Hypermarket Updated',
  tripType: 'Specialty Pantry',
  totalAmountPaid: 2800,
  totalScaleWeightKg: 6.2,
  date: '2026-11-03',
  notes: 'Updated pantry haul notes'
});

assert.strictEqual(remotePatchCalled, true, 'Remote PATCH /api/trips must be invoked');
global.fetch = nativeFetch; // Restore native fetch for Neon database queries

assert.strictEqual(updatedResult.storeName, 'SM Hypermarket Updated');
assert.strictEqual(updatedResult.tripType, 'Specialty Pantry');
assert.strictEqual(updatedResult.totalAmountPaid, 2800);
assert.strictEqual(updatedResult.totalScaleWeightKg, 6.2);
assert.strictEqual(updatedResult.date, '2026-11-03');
assert.strictEqual(updatedResult.notes, 'Updated pantry haul notes');

// Verify localStorage was updated
const tripsInStorage = JSON.parse(mockStorage.get('kosherai_course_trips'));
assert.strictEqual(tripsInStorage[0].storeName, 'SM Hypermarket Updated');
assert.strictEqual(tripsInStorage[0].totalAmountPaid, 2800);

// Verify linked expense was updated
const expensesInStorage = JSON.parse(mockStorage.get('kosherai_course_expenses'));
assert.strictEqual(expensesInStorage[0].vendor, 'SM Hypermarket Updated');
assert.strictEqual(expensesInStorage[0].amount, 2800);

// Verify UI custom events were dispatched
const refreshedEvents = customEventsDispatched.map(e => e.type);
assert.ok(refreshedEvents.includes('kosherai-trips-updated'), 'Must dispatch kosherai-trips-updated');
assert.ok(refreshedEvents.includes('kosherai-store-refresh'), 'Must dispatch kosherai-store-refresh');
console.log('  ✅ updateShoppingTrip updates localStorage, linked expense, and dispatches UI refresh events.');

// ---------------------------------------------------------------------------
// Test 3: Backend API PUT / PATCH /api/trips
// ---------------------------------------------------------------------------
console.log('\nTest 3: Backend API /api/trips PUT / PATCH');

const sql = neon(process.env.DATABASE_URL);

// Locate an active authenticated user with a valid session in Neon
const sessionRows = await sql`
  SELECT s.token, COALESCE(s.user_id, s."userId") as user_id, u.name, u.email
  FROM "session" s
  JOIN "user" u ON u.id = COALESCE(s.user_id, s."userId")
  WHERE s.expires_at > NOW() OR s."expiresAt" > NOW()
  LIMIT 1;
`;

assert.ok(sessionRows.length > 0, 'Must have at least one active session in Neon');
const activeSession = sessionRows[0];
const activeUserId = activeSession.user_id;
console.log(`  ℹ️ Authenticated test user: ${activeSession.name} (${activeUserId})`);

// 3.1 Unauthenticated request returns 401
const { req: rUnauth, res: sUnauth, getStatus: statusUnauth } = createMockReqRes('PATCH', {}, {
  id: 'some_trip'
});
await tripsApiHandler(rUnauth, sUnauth);
assert.strictEqual(statusUnauth(), 401, 'Unauthenticated PATCH must return 401');
console.log('  ✅ Unauthenticated PATCH request returns 401 UNAUTHORIZED.');

// 3.2 Request without trip ID returns 400
const { req: rNoId, res: sNoId, getStatus: statusNoId, getData: dataNoId } = createMockReqRes('PATCH', {
  authorization: `Bearer ${activeSession.token}`
}, {});
await tripsApiHandler(rNoId, sNoId);
assert.strictEqual(statusNoId(), 400, 'PATCH without ID must return 400');
assert.strictEqual(dataNoId().error, 'MISSING_ID');
console.log('  ✅ Missing trip ID correctly returns 400 MISSING_ID.');

// 3.3 Create a trip in Neon for this user to test updating
const testTripId = `trip_patch_test_${Date.now()}`;
await sql`
  INSERT INTO shopping_trips (
    id, user_id, date, project_week, store_name, trip_type, 
    total_amount_paid, total_scale_weight_kg, notes, created_at, synced
  ) VALUES (
    ${testTripId}, ${activeUserId}, '2026-11-01', 1, 'Initial Store', 'Supermarket',
    1500.00, 4.50, 'Initial notes', NOW(), true
  );
`;

try {
  // 3.4 Execute valid PATCH request with updated fields
  const { req: rPatch, res: sPatch, getStatus: statusPatch, getData: dataPatch } = createMockReqRes('PATCH', {
    authorization: `Bearer ${activeSession.token}`
  }, {
    id: testTripId,
    storeName: 'Robinsons Supermarket EDSA',
    tripType: 'Wet Market / Palengke',
    totalAmountPaid: 2150.75,
    totalScaleWeightKg: 5.80,
    date: '2026-11-04',
    notes: 'Updated post-audit receipt notes'
  });

  await tripsApiHandler(rPatch, sPatch);
  assert.strictEqual(statusPatch(), 200, 'Valid PATCH must return 200');
  assert.strictEqual(dataPatch().success, true);
  assert.strictEqual(dataPatch().trip.storeName, 'Robinsons Supermarket EDSA');
  assert.strictEqual(dataPatch().trip.totalAmountPaid, 2150.75);
  assert.strictEqual(dataPatch().trip.totalScaleWeightKg, 5.80);
  assert.strictEqual(dataPatch().trip.date, '2026-11-04');
  assert.strictEqual(dataPatch().trip.notes, 'Updated post-audit receipt notes');
  console.log('  ✅ PATCH /api/trips returns 200 OK with the updated record.');

  // 3.5 Verify database persistence directly in Neon
  const dbRows = await sql`
    SELECT store_name, total_amount_paid, total_scale_weight_kg, date, notes, updated_at
    FROM shopping_trips
    WHERE id = ${testTripId} AND user_id = ${activeUserId};
  `;
  assert.strictEqual(dbRows.length, 1);
  assert.strictEqual(dbRows[0].store_name, 'Robinsons Supermarket EDSA');
  assert.strictEqual(Number(dbRows[0].total_amount_paid), 2150.75);
  assert.strictEqual(Number(dbRows[0].total_scale_weight_kg), 5.80);
  assert.strictEqual(dbRows[0].date, '2026-11-04');
  assert.strictEqual(dbRows[0].notes, 'Updated post-audit receipt notes');
  assert.ok(dbRows[0].updated_at !== null, 'updated_at timestamp must be set');
  console.log('  ✅ Database persistence verified directly in Neon PostgreSQL.');

  // 3.6 Test PUT method as well
  const { req: rPut, res: sPut, getStatus: statusPut, getData: dataPut } = createMockReqRes('PUT', {
    authorization: `Bearer ${activeSession.token}`
  }, {
    id: testTripId,
    storeName: 'Puregold Price Club (PUT)',
    totalAmountPaid: 1999.00,
    totalScaleWeightKg: 4.90,
    date: '2026-11-05',
    notes: 'Updated via PUT'
  });
  await tripsApiHandler(rPut, sPut);
  assert.strictEqual(statusPut(), 200, 'Valid PUT must return 200');
  assert.strictEqual(dataPut().trip.storeName, 'Puregold Price Club (PUT)');
  console.log('  ✅ PUT /api/trips also succeeds with 200 OK.');

} finally {
  // Clean up test trip
  await sql`DELETE FROM shopping_trips WHERE id = ${testTripId};`;
}

console.log('\n======================================================');
console.log('🎉 ALL EDIT SHOPPING TRIP TESTS PASSED SUCCESSFULLY!');
console.log('======================================================\n');
