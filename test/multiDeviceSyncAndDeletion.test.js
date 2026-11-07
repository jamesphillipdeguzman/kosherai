import assert from 'node:assert';
import {
  generateRecordId,
  getPendingDeletions,
  addPendingDeletion,
  removePendingDeletion,
  clearPendingDeletions,
  syncPendingDeletions,
  deleteShoppingTrip,
  deleteGroceryItem,
  mergeRemoteCourseData,
  syncPendingTrips,
  handleTenantAccountChange,
  getShoppingTrips,
  getGroceryItems,
  getExpenses,
  saveShoppingTrip
} from '../src/services/courseProjectStorage.js';

// Setup Mock Browser Environment
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};

global.window = {
  dispatchEvent: () => true
};
global.CustomEvent = class {
  constructor(type, detail) {
    this.type = type;
    this.detail = detail;
  }
};
function setOnline(status) {
  try {
    Object.defineProperty(global.navigator, 'onLine', {
      value: status,
      configurable: true,
      writable: true
    });
  } catch (_) {
    global.navigator.onLine = status;
  }
}
setOnline(true);

async function runTests() {
  console.log('--- RUNNING MULTI-DEVICE SYNC & DELETION TESTS ---');

  // Test 1: Stable UUID generation
  console.log('Test 1: Stable UUID generation');
  const id1 = generateRecordId('trip');
  const id2 = generateRecordId('trip');
  assert(id1.startsWith('trip_'), 'ID must start with trip_');
  assert.notStrictEqual(id1, id2, 'Generated IDs must be unique');
  assert(id1.length > 15, 'ID must have sufficient entropy');

  // Test 2: Persistent Deletion Queue
  console.log('Test 2: Persistent Deletion Queue');
  clearPendingDeletions();
  assert.strictEqual(getPendingDeletions().length, 0);

  addPendingDeletion('trip_123', 'trip');
  addPendingDeletion('item_456', 'grocery');
  let deletions = getPendingDeletions();
  assert.strictEqual(deletions.length, 2);
  assert.strictEqual(deletions[0].id, 'trip_123');
  assert.strictEqual(deletions[0].type, 'trip');
  assert.strictEqual(deletions[1].id, 'item_456');
  assert.strictEqual(deletions[1].type, 'grocery');

  removePendingDeletion('trip_123');
  deletions = getPendingDeletions();
  assert.strictEqual(deletions.length, 1);
  assert.strictEqual(deletions[0].id, 'item_456');
  clearPendingDeletions();

  // Test 3: Offline deletion enqueues tombstone
  console.log('Test 3: Offline deletion enqueues tombstone');
  clearPendingDeletions();
  localStorage.setItem('kosherai_course_trips', JSON.stringify([
    { id: 'trip_offline_1', storeName: 'SM Supermarket', totalAmountPaid: 200, synced: true }
  ]));
  localStorage.setItem('kosherai_course_grocery_items', JSON.stringify([
    { id: 'item_offline_1', tripId: 'trip_offline_1', name: 'Pork Pata', totalPrice: 200, synced: true }
  ]));

  // Simulate offline
  setOnline(false);
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true };
  };

  await deleteShoppingTrip('trip_offline_1');

  // Must be removed from localStorage immediately
  assert.strictEqual(getShoppingTrips().length, 0, 'Trip should be removed from local cache immediately');
  assert.strictEqual(getGroceryItems().length, 0, 'Items should be removed from local cache immediately');

  // Must be recorded in pending deletions queue
  const pendingAfterDel = getPendingDeletions();
  assert(pendingAfterDel.some(d => d.id === 'trip_offline_1'), 'Trip must be in pending deletions queue');
  assert(pendingAfterDel.some(d => d.id === 'item_offline_1'), 'Linked grocery item must be in pending deletions queue');
  assert.strictEqual(fetchCalled, false, 'Fetch should not be called when offline');

  // Test 4: mergeRemoteCourseData prevents resurrection of tombstoned records
  console.log('Test 4: mergeRemoteCourseData prevents resurrection of tombstoned records');
  const remoteTripsFromNeon = [
    {
      id: 'trip_offline_1', // deleted offline on this device, still on Neon
      storeName: 'SM Supermarket',
      date: '2026-11-07',
      totalAmountPaid: 200,
      items: [
        { id: 'item_offline_1', name: 'Pork Pata', totalPrice: 200 }
      ]
    },
    {
      id: 'trip_legit_2',
      storeName: 'Wet Market',
      date: '2026-11-07',
      totalAmountPaid: 50,
      items: [
        { id: 'item_legit_2', name: 'Kalabasa', totalPrice: 50 }
      ]
    }
  ];

  // Merge remote data with tombstone present
  mergeRemoteCourseData(remoteTripsFromNeon, null, []);

  const mergedTrips = getShoppingTrips();
  const mergedItems = getGroceryItems();

  assert(!mergedTrips.some(t => t.id === 'trip_offline_1'), 'Deleted trip MUST NOT be resurrected from remote Neon trips');
  assert(!mergedItems.some(i => i.id === 'item_offline_1'), 'Deleted item MUST NOT be resurrected from remote Neon items');
  assert(mergedTrips.some(t => t.id === 'trip_legit_2'), 'Legitimate trip should be restored');
  assert(mergedItems.some(i => i.id === 'item_legit_2'), 'Legitimate item should be restored');

  // Test 5: Server remoteDeletedIds blocks resurrection even if pending deletion queue was cleared
  console.log('Test 5: Remote deletedIds blocks resurrection');
  clearPendingDeletions();
  // Neon server informs client that trip_server_del was deleted on another device
  const serverDeletedIds = ['trip_server_del', 'item_server_del'];
  const incomingRemoteTrips = [
    {
      id: 'trip_server_del',
      storeName: 'SM Supermarket',
      date: '2026-11-07',
      totalAmountPaid: 150,
      items: [{ id: 'item_server_del', name: 'Chicken', totalPrice: 150 }]
    }
  ];

  mergeRemoteCourseData(incomingRemoteTrips, null, serverDeletedIds);
  assert(!getShoppingTrips().some(t => t.id === 'trip_server_del'), 'Server-deleted trip must not be restored');

  // Test 6: syncPendingDeletions drains queue when online
  console.log('Test 6: syncPendingDeletions drains queue when online');
  setOnline(true);
  addPendingDeletion('trip_to_sync', 'trip');
  addPendingDeletion('item_to_sync', 'grocery');

  const deletedEndpoints = [];
  global.fetch = async (url, options) => {
    if (options && options.method === 'DELETE') {
      deletedEndpoints.push(url);
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }
    return { ok: false };
  };

  const syncResult = await syncPendingDeletions();
  assert.strictEqual(syncResult.syncedCount, 2, 'All pending deletions should be synced');
  assert.strictEqual(syncResult.pendingCount, 0, 'No pending deletions should remain');
  assert.strictEqual(getPendingDeletions().length, 0, 'Pending deletions queue should be empty');
  assert(deletedEndpoints.some(u => u.includes('trip_to_sync')), 'Should call DELETE for trip');
  assert(deletedEndpoints.some(u => u.includes('item_to_sync')), 'Should call DELETE for item');

  // Test 7: deleteGroceryItem removes item, updates trip count, and enqueues deletion
  console.log('Test 7: deleteGroceryItem individual item deletion');
  localStorage.setItem('kosherai_course_trips', JSON.stringify([
    { id: 'trip_multi', storeName: 'Supermarket', itemsCount: 2, synced: true }
  ]));
  localStorage.setItem('kosherai_course_grocery_items', JSON.stringify([
    { id: 'item_a', tripId: 'trip_multi', name: 'Item A' },
    { id: 'item_b', tripId: 'trip_multi', name: 'Item B' }
  ]));

  let groceryDeleteCalled = false;
  global.fetch = async (url, options) => {
    if (url.includes('item_a') && options?.method === 'DELETE') {
      groceryDeleteCalled = true;
      return { ok: true };
    }
    return { ok: false };
  };

  await deleteGroceryItem('item_a');
  assert.strictEqual(getGroceryItems().length, 1, 'Only one item should remain');
  assert.strictEqual(getGroceryItems()[0].id, 'item_b');
  assert.strictEqual(getShoppingTrips()[0].itemsCount, 1, 'Parent trip itemsCount should decrement to 1');
  assert.strictEqual(groceryDeleteCalled, true, 'Remote DELETE should be dispatched for item_a');

  // Test 8: Tenant Account Change clears cache when switching accounts
  console.log('Test 8: Tenant Account Change clears cache when switching accounts');
  localStorage.setItem('kosherai_last_auth_user_id', 'previous_tenant_user');
  localStorage.setItem('kosherai_course_trips', JSON.stringify([
    { id: 'previous_trip', storeName: 'Previous Store' }
  ]));

  const purged = handleTenantAccountChange('new_tenant_user');
  assert.strictEqual(purged, true, 'Switching accounts should purge previous tenant data');
  assert.strictEqual(getShoppingTrips().length, 0, 'Previous trips should be purged');
  assert.strictEqual(localStorage.getItem('kosherai_last_auth_user_id'), 'new_tenant_user');

  // Logging in as the same user preserves data
  localStorage.setItem('kosherai_course_trips', JSON.stringify([
    { id: 'same_user_trip', storeName: 'Same Store' }
  ]));
  const purgedSame = handleTenantAccountChange('new_tenant_user');
  assert.strictEqual(purgedSame, false, 'Same user login should NOT purge data');
  assert.strictEqual(getShoppingTrips().length, 1, 'Same user trips must be preserved');

  console.log('\n--- ALL MULTI-DEVICE SYNC & DELETION TESTS PASSED! ---');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
