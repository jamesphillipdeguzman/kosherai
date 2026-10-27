// IndexedDB Offline-First Storage Service for Sustaining Human Life Project
// Stores shopping_trips, grocery_purchases, and food_waste_logs locally with sync tracking

const DB_NAME = 'kosherai_offline_db';
const DB_VERSION = 1;

export const STORES = {
  TRIPS: 'shopping_trips',
  GROCERY_PURCHASES: 'grocery_purchases',
  FOOD_WASTE: 'food_waste_logs'
};

let dbInstance = null;

/**
 * Opens or initializes the KosherAI IndexedDB instance
 */
export async function openIndexedDB() {
  if (dbInstance) return dbInstance;
  if (typeof indexedDB === 'undefined') {
    return null;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. shopping_trips store
      if (!db.objectStoreNames.contains(STORES.TRIPS)) {
        const tripStore = db.createObjectStore(STORES.TRIPS, { keyPath: 'id' });
        tripStore.createIndex('synced', 'synced', { unique: false });
        tripStore.createIndex('date', 'date', { unique: false });
        tripStore.createIndex('projectWeek', 'projectWeek', { unique: false });
      }

      // 2. grocery_purchases store
      if (!db.objectStoreNames.contains(STORES.GROCERY_PURCHASES)) {
        const groceryStore = db.createObjectStore(STORES.GROCERY_PURCHASES, { keyPath: 'id' });
        groceryStore.createIndex('tripId', 'tripId', { unique: false });
        groceryStore.createIndex('synced', 'synced', { unique: false });
        groceryStore.createIndex('purchaseDate', 'purchaseDate', { unique: false });
      }

      // 3. food_waste_logs store
      if (!db.objectStoreNames.contains(STORES.FOOD_WASTE)) {
        const wasteStore = db.createObjectStore(STORES.FOOD_WASTE, { keyPath: 'id' });
        wasteStore.createIndex('synced', 'synced', { unique: false });
        wasteStore.createIndex('date', 'date', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.warn('[IndexedDB] Failed to open database:', event.target.error);
      resolve(null);
    };
  });
}

/**
 * Saves a shopping trip and its itemized grocery purchases into IndexedDB.
 * Sets synced: true if confirmed by Neon API, or synced: false if offline/pending.
 */
export async function saveTripToIndexedDB(trip, items = [], synced = false) {
  const db = await openIndexedDB();
  if (!db) return false;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORES.TRIPS, STORES.GROCERY_PURCHASES], 'readwrite');
      const tripStore = tx.objectStore(STORES.TRIPS);
      const groceryStore = tx.objectStore(STORES.GROCERY_PURCHASES);

      const tripRecord = {
        ...trip,
        synced: Boolean(synced),
        updatedAt: new Date().toISOString()
      };

      tripStore.put(tripRecord);

      // Clean existing purchases for this trip in IndexedDB, then save updated items
      const tripIndex = groceryStore.index('tripId');
      const req = tripIndex.getAllKeys(trip.id);
      req.onsuccess = () => {
        const keys = req.result || [];
        keys.forEach(k => groceryStore.delete(k));

        // Insert items
        items.forEach(item => {
          groceryStore.put({
            ...item,
            tripId: trip.id,
            synced: Boolean(synced)
          });
        });
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.warn('[IndexedDB] Transaction error saving trip:', e);
        resolve(false);
      };
    } catch (err) {
      console.warn('[IndexedDB] Exception saving trip:', err);
      resolve(false);
    }
  });
}

/**
 * Retrieves all shopping trips from IndexedDB
 */
export async function getTripsFromIndexedDB() {
  const db = await openIndexedDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.TRIPS, 'readonly');
      const store = tx.objectStore(STORES.TRIPS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Retrieves itemized grocery items from IndexedDB (optionally filtered by tripId)
 */
export async function getGroceryItemsFromIndexedDB(tripId = null) {
  const db = await openIndexedDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.GROCERY_PURCHASES, 'readonly');
      const store = tx.objectStore(STORES.GROCERY_PURCHASES);
      if (tripId) {
        const index = store.index('tripId');
        const req = index.getAll(tripId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } else {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      }
    } catch {
      resolve([]);
    }
  });
}

/**
 * Retrieves all trips where synced === false for auto-retry
 */
export async function getUnsyncedTripsFromIndexedDB() {
  const db = await openIndexedDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.TRIPS, 'readonly');
      const store = tx.objectStore(STORES.TRIPS);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        resolve(all.filter(t => t.synced === false));
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Marks a shopping trip and its linked items as synced: true in IndexedDB
 */
export async function markTripAsSyncedInIndexedDB(tripId) {
  const db = await openIndexedDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORES.TRIPS, STORES.GROCERY_PURCHASES], 'readwrite');
      const tripStore = tx.objectStore(STORES.TRIPS);
      const groceryStore = tx.objectStore(STORES.GROCERY_PURCHASES);

      // Update trip
      const tripReq = tripStore.get(tripId);
      tripReq.onsuccess = () => {
        if (tripReq.result) {
          const updatedTrip = { ...tripReq.result, synced: true };
          tripStore.put(updatedTrip);
        }
      };

      // Update linked items
      const tripIndex = groceryStore.index('tripId');
      const itemsReq = tripIndex.getAll(tripId);
      itemsReq.onsuccess = () => {
        const items = itemsReq.result || [];
        items.forEach(it => {
          groceryStore.put({ ...it, synced: true });
        });
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Deletes a trip and linked grocery purchases from IndexedDB
 */
export async function deleteTripFromIndexedDB(tripId) {
  const db = await openIndexedDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORES.TRIPS, STORES.GROCERY_PURCHASES], 'readwrite');
      const tripStore = tx.objectStore(STORES.TRIPS);
      const groceryStore = tx.objectStore(STORES.GROCERY_PURCHASES);

      tripStore.delete(tripId);

      const tripIndex = groceryStore.index('tripId');
      const req = tripIndex.getAllKeys(tripId);
      req.onsuccess = () => {
        (req.result || []).forEach(k => groceryStore.delete(k));
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Saves a food waste record into IndexedDB
 */
export async function saveFoodWasteToIndexedDB(wasteRecord, synced = false) {
  const db = await openIndexedDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.FOOD_WASTE, 'readwrite');
      const store = tx.objectStore(STORES.FOOD_WASTE);
      store.put({
        ...wasteRecord,
        synced: Boolean(synced)
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Retrieves all food waste records from IndexedDB
 */
export async function getFoodWasteFromIndexedDB() {
  const db = await openIndexedDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.FOOD_WASTE, 'readonly');
      const store = tx.objectStore(STORES.FOOD_WASTE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export default {
  openIndexedDB,
  saveTripToIndexedDB,
  getTripsFromIndexedDB,
  getGroceryItemsFromIndexedDB,
  getUnsyncedTripsFromIndexedDB,
  markTripAsSyncedInIndexedDB,
  deleteTripFromIndexedDB,
  saveFoodWasteToIndexedDB,
  getFoodWasteFromIndexedDB,
  STORES
};
