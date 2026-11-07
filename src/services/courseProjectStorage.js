import { searchDatabase } from './ruleEngine.js';
import { LID_DATABASE, STATUS } from '../data/lidDatabase.js';
import { getAuthHeaders, getClientAuthToken } from './authHeaders.js';
import { resolveFoodCategory } from './overBuyingDetector.js';
import { uploadReceiptImageToCloudinary } from '../utils/cloudinary.js';
import { syncPendingScans, reconcileScanRecords, getLocalScanHistory } from './storage.js';
import {
  saveTripToIndexedDB,
  getTripsFromIndexedDB,
  getUnsyncedTripsFromIndexedDB,
  markTripAsSyncedInIndexedDB,
  deleteTripFromIndexedDB,
  getGroceryItemsFromIndexedDB,
  saveFoodWasteToIndexedDB,
  getFoodWasteFromIndexedDB,
  getUnsyncedFoodWasteFromIndexedDB,
  markFoodWasteAsSyncedInIndexedDB
} from './indexedDbStorage.js';

/**
 * Resilient image compressor and Cloudinary uploader for receipts.
 * Prevents HTTP 413 Payload Too Large on Neon sync routes.
 */
export async function safeCompressReceiptImage(dataUrlOrFile, maxWidth = 1024, quality = 0.72) {
  if (!dataUrlOrFile) return null;
  if (typeof dataUrlOrFile === 'string' && (dataUrlOrFile.startsWith('http://') || dataUrlOrFile.startsWith('https://'))) {
    return dataUrlOrFile;
  }

  // 1. Try uploading to Cloudinary
  try {
    const cUrl = await uploadReceiptImageToCloudinary(dataUrlOrFile);
    if (cUrl && typeof cUrl === 'string' && cUrl.startsWith('http')) {
      return cUrl;
    }
  } catch (_) {}

  // 2. Client canvas compression to prevent HTTP 413
  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    try {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onerror = () => resolve(dataUrlOrFile);
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = maxWidth || 1024;
            if (width > maxDim || height > maxDim) {
              if (width >= height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch {
            resolve(dataUrlOrFile);
          }
        };
        img.src = dataUrlOrFile;
      });
    } catch (_) {}
  }
  return dataUrlOrFile;
}

export const PROJECT_CONFIG = {
  START_DATE: '2026-10-31', // Saturday, October 31, 2026 (Day 1 of Week 1)
  TOTAL_WEEKS: 6,
  DEFAULT_BASELINE_BUDGET: 4000, // ₱4,000 for Week 1 baseline
  CURRENCY_SYMBOL: '₱'
};

const STORAGE_KEYS = {
  CONFIG: 'kosherai_course_config',
  TRIPS: 'kosherai_course_trips',
  GROCERY_ITEMS: 'kosherai_course_grocery_items',
  EXPENSES: 'kosherai_course_expenses',
  FOOD_WASTE: 'kosherai_course_food_waste',
  MEAL_PLANS: 'kosherai_course_meal_plans'
};

export const TENANT_STORAGE_KEYS = [
  STORAGE_KEYS.TRIPS,
  STORAGE_KEYS.GROCERY_ITEMS,
  STORAGE_KEYS.EXPENSES,
  STORAGE_KEYS.FOOD_WASTE,
  STORAGE_KEYS.MEAL_PLANS,
  'kosherai_inventory',
  'kosherai_scan_history',
  'kosherai_settings',
  'kosherai_household_members'
];

/**
 * Handles account switching between different tenant users on the same browser.
 * Preserves local cache if signing back into the same account.
 * Purges the previous user's cached tenant records ONLY if a genuinely different user logs in.
 *
 * @param {string} newUserId
 * @returns {boolean} true if account switched and cache was purged; false if same user or initial login
 */
export function handleTenantAccountChange(newUserId) {
  if (!newUserId) return false;
  try {
    const lastUserId = localStorage.getItem('kosherai_last_auth_user_id');
    if (lastUserId && lastUserId !== newUserId) {
      console.info(`[Auth] Switched tenant account from ${lastUserId} to ${newUserId}. Purging previous user local tenant cache.`);
      TENANT_STORAGE_KEYS.forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
      if (typeof window !== 'undefined' && window.indexedDB) {
        try { window.indexedDB.deleteDatabase('KosherAICourseDB'); } catch (_) {}
        try { window.indexedDB.deleteDatabase('kosherai_offline_db'); } catch (_) {}
      }
      localStorage.setItem('kosherai_last_auth_user_id', newUserId);
      return true;
    }
    localStorage.setItem('kosherai_last_auth_user_id', newUserId);
  } catch (_) {}
  return false;
}

export function formatDateYMD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns date bounds for all 6 project weeks starting Saturday, Oct 31, 2026
 */
export function getProjectWeekSchedule(startDateStr = PROJECT_CONFIG.START_DATE) {
  const schedule = [];
  const parts = startDateStr.split('-').map(Number);
  const start = new Date(parts[0], parts[1] - 1, parts[2]);

  for (let w = 1; w <= PROJECT_CONFIG.TOTAL_WEEKS; w++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (w - 1) * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const startYmd = formatDateYMD(weekStart);
    const endYmd = formatDateYMD(weekEnd);

    schedule.push({
      weekNumber: w,
      type: w === 1 ? 'Baseline' : (w === 2 ? 'Intervention Launch' : 'Evaluation'),
      startDate: startYmd,
      endDate: endYmd,
      label: `Week ${w} (${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)})`,
      isBaseline: w === 1,
      isIntervention: w >= 2
    });
  }

  return schedule;
}

function formatShortDate(d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Determines project week number (1 to 6) based on purchase or event date
 */
export function getProjectWeekForDate(dateStr, startDateStr = PROJECT_CONFIG.START_DATE) {
  if (!dateStr) return 1;
  const targetParts = dateStr.split('-').map(Number);
  const startParts = startDateStr.split('-').map(Number);
  const target = new Date(targetParts[0], targetParts[1] - 1, targetParts[2]);
  const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);

  const diffTime = target.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 1; // Prior to start date treated as Week 1 baseline
  const week = Math.floor(diffDays / 7) + 1;
  return Math.min(Math.max(week, 1), PROJECT_CONFIG.TOTAL_WEEKS);
}

// ==========================================
// CONFIGURATION CRUD
// ==========================================

export function getCourseConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading course config:', e);
  }

  return {
    startDate: PROJECT_CONFIG.START_DATE,
    baselineBudget: PROJECT_CONFIG.DEFAULT_BASELINE_BUDGET,
    weeklyBudgets: {
      1: PROJECT_CONFIG.DEFAULT_BASELINE_BUDGET,
      2: 3600,
      3: 3500,
      4: 3500,
      5: 3500,
      6: 3500
    },
    currency: 'PHP',
    studentName: 'Student Researcher'
  };
}

export const getProjectConfig = getCourseConfig;

export function saveCourseConfig(newConfig) {
  try {
    const current = getCourseConfig();
    const updated = { ...current, ...newConfig };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save course config:', e);
    return getCourseConfig();
  }
}

// ==========================================
// SHOPPING TRIPS & EXPENSES CRUD
// ==========================================

export function getShoppingTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRIPS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Error reading shopping trips:', e);
    return [];
  }
}

export function getGroceryItems(tripId = null) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GROCERY_ITEMS);
    const items = raw ? JSON.parse(raw) : [];
    if (tripId) {
      return items.filter(item => item.tripId === tripId || item.trip_id === tripId);
    }
    return items;
  } catch (e) {
    console.warn('Error reading grocery items:', e);
    return [];
  }
}

export function getExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Error reading expenses:', e);
    return [];
  }
}

/**
 * Checks for potential duplicate receipts based on store name, date, and total amount
 */
export function detectDuplicateReceipt(storeName, purchaseDate, totalAmount, excludeTripId = null) {
  const trips = getShoppingTrips();
  const cleanStore = (storeName || '').trim().toLowerCase();
  const targetDate = (purchaseDate || '').trim();
  const targetTotal = Number(totalAmount || 0);

  return trips.find(trip => {
    if (excludeTripId && trip.id === excludeTripId) return false;
    const sameStore = trip.storeName && trip.storeName.trim().toLowerCase() === cleanStore;
    const sameDate = trip.date === targetDate;
    const sameAmount = Math.abs(Number(trip.totalAmountPaid || 0) - targetTotal) < 0.01;
    return (sameDate && sameAmount) || (sameStore && sameDate && sameAmount);
  });
}

/**
 * Saves a complete Shopping Trip alongside its itemized grocery records and linked expense.
 * Offline-first sync guarantee:
 * 1. POSTs to /api/trips first when online.
 * 2. If successful, persists to Neon and saves into IndexedDB with synced: true.
 * 3. If offline or API fails, saves to IndexedDB with synced: false for auto-retry when online.
 * 4. Also keeps localStorage and linked expense synchronized.
 */
export async function saveShoppingTrip(tripData, items = []) {
  try {
    const trips = getShoppingTrips();
    const allItems = getGroceryItems();
    const expenses = getExpenses();

    const config = getCourseConfig();
    const date = tripData.date || new Date().toISOString().split('T')[0];
    const projectWeek = tripData.projectWeek || getProjectWeekForDate(date, config.startDate);
    const tripId = tripData.id || `trip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const totalAmount = Number(tripData.totalAmountPaid || 0);
    const scaleWeightKg = Number(tripData.totalScaleWeightKg || 0);

    const candidateItems = (
      (Array.isArray(items) && items.length > 0 ? items : null) ||
      (Array.isArray(tripData.items) && tripData.items.length > 0 ? tripData.items : null) ||
      (Array.isArray(tripData.rawItems) && tripData.rawItems.length > 0 ? tripData.rawItems : null) ||
      (Array.isArray(tripData.extractedItems) && tripData.extractedItems.length > 0 ? tripData.extractedItems : null) ||
      (Array.isArray(tripData.groceryItems) && tripData.groceryItems.length > 0 ? tripData.groceryItems : null) ||
      getGroceryItems(tripId) ||
      []
    );

    const cleanedItems = candidateItems.map((item, idx) => {
      const lidEval = evaluateItemLidStatus(item.name || item.itemName);
      return {
        id: item.id || `item_${tripId}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        tripId,
        purchaseDate: date,
        projectWeek,
        name: item.name || item.itemName || item.description || 'Grocery Item',
        rawReceiptText: item.rawReceiptText || item.name || '',
        quantity: Number(item.quantity || item.qty || 1),
        unit: item.unit || 'pcs',
        unitPrice: Number(item.unitPrice || item.price || 0),
        totalPrice: Number(item.totalPrice || item.lineTotal || (Number(item.quantity || item.qty || 1) * Number(item.unitPrice || item.price || 0))),
        weightGrams: Number(item.weightGrams || item.weightG || 0),
        category: item.category && item.category !== 'General Food' ? item.category : resolveFoodCategory(item.name || item.itemName),
        lidStatus: item.lidStatus || lidEval.status,
        lidReason: item.lidReason || lidEval.reason || '',
        synced: false
      };
    });

    let receiptUrl = tripData.receiptImageUrl || null;
    if (receiptUrl && typeof receiptUrl === 'object') {
      receiptUrl = receiptUrl.dataUrl || receiptUrl.url || receiptUrl.secure_url || null;
    }
    if (typeof receiptUrl === 'string' && receiptUrl.includes('[object Object]')) {
      receiptUrl = null;
    }
    if (receiptUrl && typeof receiptUrl === 'string' && (receiptUrl.startsWith('data:') || receiptUrl.startsWith('blob:'))) {
      try {
        const cUrl = await uploadReceiptImageToCloudinary(receiptUrl);
        if (cUrl && typeof cUrl === 'string' && cUrl.startsWith('http')) {
          receiptUrl = cUrl;
        }
      } catch (err) {
        console.warn('[Cloudinary] Failed to upload receipt image:', err);
      }
    }

    const tripRecord = {
      id: tripId,
      date,
      projectWeek,
      storeName: tripData.storeName || 'Supermarket',
      tripType: tripData.tripType || tripData.trip_type || 'Supermarket',
      trip_type: tripData.trip_type || tripData.tripType || 'Supermarket',
      totalAmountPaid: totalAmount,
      totalScaleWeightKg: scaleWeightKg, // Physical scale weight of whole grocery haul
      receiptImageUrl: receiptUrl,
      receiptRawText: tripData.receiptRawText || '',
      itemsCount: cleanedItems.length,
      notes: tripData.notes || '',
      createdAt: tripData.createdAt || new Date().toISOString(),
      synced: false
    };

    // 1. POST to API route first when online
    let isSynced = false;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isOnline && typeof fetch === 'function') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const payload = {
          ...tripRecord,
          trip: tripRecord,
          items: cleanedItems,
          rawItems: cleanedItems
        };

        const res = await fetch('/api/trips', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res && res.ok) {
          const payload = await res.json().catch(() => null);
          if (payload && (payload.synced || payload.success)) {
            isSynced = true;
            console.info('[Storage] Successfully synced shopping trip to Neon PostgreSQL:', tripId);
          }
        } else {
          console.warn('[Storage] Remote POST /api/trips returned status:', res.status);
        }
      } catch (err) {
        console.warn('[Storage] Remote POST /api/trips error (saving offline):', err.message);
      }
    }

    tripRecord.synced = isSynced;
    cleanedItems.forEach(i => { i.synced = isSynced; });

    // 2. Persist to IndexedDB (offline-first sync)
    try {
      await saveTripToIndexedDB(tripRecord, cleanedItems, isSynced);
    } catch (idbErr) {
      console.warn('[Storage] IndexedDB save warning:', idbErr);
    }

    // 3. Keep localStorage synchronized for synchronous UI queries
    const updatedTrips = [tripRecord, ...trips.filter(t => t.id !== tripId)];
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(updatedTrips));

    const remainingItems = allItems.filter(i => i.tripId !== tripId);
    const updatedAllItems = [...remainingItems, ...cleanedItems];
    localStorage.setItem(STORAGE_KEYS.GROCERY_ITEMS, JSON.stringify(updatedAllItems));

    // Synchronize linked Expense record (EXACTLY 1 expense for the whole trip)
    const tripExpenseId = `exp_trip_${tripId}`;
    const tripExpenseRecord = {
      id: tripExpenseId,
      tripId,
      date,
      projectWeek,
      vendor: tripRecord.storeName,
      category: tripRecord.tripType,
      amount: totalAmount,
      isTripExpense: true,
      notes: `Shopping trip (${cleanedItems.length} items, whole weight: ${scaleWeightKg} kg)`
    };

    const remainingExpenses = expenses.filter(e => e.id !== tripExpenseId && e.tripId !== tripId);
    const updatedExpenses = [tripExpenseRecord, ...remainingExpenses];
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updatedExpenses));

    return { trip: tripRecord, items: cleanedItems, expense: tripExpenseRecord, synced: isSynced };
  } catch (e) {
    console.error('Failed to save shopping trip:', e);
    throw e;
  }
}

/**
 * Auto-retries synchronization of pending offline trips to Neon PostgreSQL
 */
export async function syncPendingTrips() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { syncedCount: 0, pendingCount: 0 };
  if (typeof fetch !== 'function') return { syncedCount: 0, pendingCount: 0 };

  try {
    const allLocalTrips = getShoppingTrips();
    const allLocalGroceryItems = getGroceryItems();
    const unsyncedFromDb = await getUnsyncedTripsFromIndexedDB();

    // Check for unsynced trips AND backfill previously saved trips where itemsCount === 0 but local items exist
    const unsyncedFromLocal = allLocalTrips.filter(t => {
      if (t.synced === false) return true;
      const matchingItems = allLocalGroceryItems.filter(i => i.tripId === t.id);
      if ((!t.itemsCount || t.itemsCount === 0) && matchingItems.length > 0) return true;
      return false;
    });

    // Merge pending trips by ID
    const pendingMap = new Map();
    unsyncedFromDb.forEach(t => pendingMap.set(t.id, t));
    unsyncedFromLocal.forEach(t => {
      if (!pendingMap.has(t.id)) pendingMap.set(t.id, t);
    });

    const pendingTrips = Array.from(pendingMap.values());
    if (pendingTrips.length === 0) return { syncedCount: 0, pendingCount: 0 };

    let syncedCount = 0;
    for (const trip of pendingTrips) {
      const idbItems = await getGroceryItemsFromIndexedDB(trip.id);
      const localMatchedItems = allLocalGroceryItems.filter(i => i.tripId === trip.id);

      let candidateItems = (idbItems && idbItems.length > 0) ? idbItems : localMatchedItems;
      if (!candidateItems || candidateItems.length === 0) {
        if (Array.isArray(trip.items) && trip.items.length > 0) {
          candidateItems = trip.items;
        } else if (Array.isArray(trip.rawItems) && trip.rawItems.length > 0) {
          candidateItems = trip.rawItems;
        } else if (Array.isArray(trip.extractedItems) && trip.extractedItems.length > 0) {
          candidateItems = trip.extractedItems;
        } else if (Array.isArray(trip.groceryItems) && trip.groceryItems.length > 0) {
          candidateItems = trip.groceryItems;
        } else {
          candidateItems = [];
        }
      }

      const rawItems = candidateItems.map((item, idx) => ({
        id: item.id || `item_${trip.id}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        tripId: trip.id,
        purchaseDate: trip.date,
        projectWeek: Number(trip.projectWeek || 1),
        name: item.name || item.itemName || item.description || 'Grocery Item',
        rawReceiptText: item.rawReceiptText || item.name || '',
        quantity: Number(item.quantity || item.qty || 1),
        unit: item.unit || 'pcs',
        unitPrice: Number(item.unitPrice || item.price || 0),
        totalPrice: Number(item.totalPrice || item.lineTotal || (Number(item.quantity || 1) * Number(item.unitPrice || 0))),
        weightGrams: Number(item.weightGrams || item.weightG || 0),
        category: item.category && item.category !== 'General Food' ? item.category : resolveFoodCategory(item.name || item.itemName),
        lidStatus: item.lidStatus || 'SAFE',
        lidReason: item.lidReason || ''
      }));

      let processedReceiptUrl = trip.receiptImageUrl || null;
      if (processedReceiptUrl && (processedReceiptUrl.startsWith('data:') || processedReceiptUrl.startsWith('blob:'))) {
        try {
          processedReceiptUrl = await safeCompressReceiptImage(processedReceiptUrl);
        } catch (_) {}
      }

      const payload = {
        ...trip,
        receiptImageUrl: processedReceiptUrl,
        itemsCount: rawItems.length,
        trip: {
          ...trip,
          receiptImageUrl: processedReceiptUrl,
          itemsCount: rawItems.length
        },
        items: rawItems,
        rawItems: rawItems
      };

      try {
        const res = await fetch('/api/trips', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (res && res.ok) {
          const resData = await res.json().catch(() => null);
          if (resData && (resData.synced === true || resData.success === true) && !resData.offline) {
            await markTripAsSyncedInIndexedDB(trip.id);

            // Update localStorage trips
            const localTrips = getShoppingTrips().map(t =>
              t.id === trip.id ? { ...t, ...trip, receiptImageUrl: processedReceiptUrl, synced: true, itemsCount: rawItems.length } : t
            );
            localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(localTrips));

            // Update localStorage grocery items
            const localItems = getGroceryItems().map(i =>
              i.tripId === trip.id ? { ...i, synced: true } : i
            );
            localStorage.setItem(STORAGE_KEYS.GROCERY_ITEMS, JSON.stringify(localItems));

            // Update localStorage expenses
            const localExpenses = getExpenses().map(e =>
              (e.tripId === trip.id || e.id === `exp_trip_${trip.id}`) ? { ...e, synced: true } : e
            );
            localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(localExpenses));

            syncedCount++;
          }
        }
      } catch (postErr) {
        console.warn(`[Sync] Failed to sync pending trip ${trip.id} to Neon:`, postErr.message);
      }
    }

    if (syncedCount > 0) {
      console.info(`[Sync] Auto-retry synced ${syncedCount} offline shopping trips to Neon.`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosherai-trips-synced', { detail: { syncedCount } }));
      }
    }

    return { syncedCount, pendingCount: pendingTrips.length - syncedCount };
  } catch (err) {
    console.warn('[Sync] Error during syncPendingTrips:', err);
    return { syncedCount: 0, pendingCount: 0 };
  }
}

// ==========================================
// NEON → LOCAL RE-HYDRATION (RESTORE FROM CLOUD)
// ==========================================

function buildTripExpenseRecord(trip, itemsCount) {
  return {
    id: `exp_trip_${trip.id}`,
    tripId: trip.id,
    date: trip.date,
    projectWeek: Number(trip.projectWeek || 1),
    vendor: trip.storeName,
    category: trip.tripType,
    amount: Number(trip.totalAmountPaid || 0),
    isTripExpense: true,
    notes: `Shopping trip (${itemsCount} items, whole weight: ${Number(trip.totalScaleWeightKg || 0)} kg)`
  };
}

/**
 * Merges remote Neon records into the localStorage cache.
 *
 * Merge rules (non-destructive):
 * - Remote records are authoritative for any id they contain and are marked synced: true,
 *   EXCEPT when the local copy is still pending upload (synced === false) — local edits win.
 * - Local records absent from the remote response are kept untouched (never deleted).
 * - Exactly one trip-linked expense is (re)built per restored trip so dashboards stay accurate;
 *   standalone expenses are preserved.
 *
 * @param {Array|null} remoteTrips - Trips from GET /api/trips (each with items[]), or null to skip
 * @param {Array|null} remoteWaste - Logs from GET /api/food-waste, or null to skip
 * @returns {{ tripsRestored: number, itemsRestored: number, wasteRestored: number }}
 */
export function mergeRemoteCourseData(remoteTrips, remoteWaste) {
  let tripsRestored = 0;
  let itemsRestored = 0;
  let wasteRestored = 0;

  if (Array.isArray(remoteTrips)) {
    const localTrips = getShoppingTrips();
    const localItems = getGroceryItems();
    const localExpenses = getExpenses();
    const localTripMap = new Map(localTrips.map(t => [t.id, t]));

    const restoredTripIds = new Set();
    const restoredExpenseIds = new Set();
    const restoredTrips = [];
    const restoredItems = [];
    const restoredExpenses = [];

    for (const remote of remoteTrips) {
      if (!remote || !remote.id) continue;
      const local = localTripMap.get(remote.id);
      if (local && local.synced === false) continue; // Pending local edit wins

      const isStandaloneExpense = remote.id.startsWith('exp_') || (remote.itemsCount === 0 && (remote.notes || '').includes('[Standalone Expense]'));
      if (isStandaloneExpense) {
        restoredExpenses.push({
          id: remote.id,
          tripId: null,
          date: remote.date,
          projectWeek: Number(remote.projectWeek || 1),
          vendor: remote.storeName || 'Food Purchase',
          category: remote.tripType || 'Wet Market / Other',
          amount: Number(remote.totalAmountPaid || 0),
          isTripExpense: false,
          notes: (remote.notes || '').replace('[Standalone Expense]', '').trim(),
          synced: true
        });
        restoredExpenseIds.add(remote.id);
        continue;
      }

      const { items: remoteItems = [], ...tripFields } = remote;
      const localItemsForTrip = localItems.filter(i => i.tripId === remote.id);
      const localItemMap = new Map(localItemsForTrip.map(i => [i.id, i]));

      const items = (Array.isArray(remoteItems) ? remoteItems : []).map(item => {
        const loc = localItemMap.get(item.id);
        if (loc && loc.synced === false) {
          return loc;
        }
        return {
          ...item,
          tripId: remote.id,
          synced: true
        };
      });

      // Preserve any local item added to this trip that isn't in remote
      for (const loc of localItemsForTrip) {
        if (loc && loc.id && !items.some(it => it.id === loc.id)) {
          items.push(loc);
        }
      }

      restoredTrips.push({
        ...tripFields,
        projectWeek: Number(tripFields.projectWeek || 1),
        itemsCount: items.length || Number(tripFields.itemsCount || 0),
        synced: true
      });
      restoredItems.push(...items);
      restoredTripIds.add(remote.id);
    }

    const keptTrips = localTrips.filter(t => !restoredTripIds.has(t.id));
    const mergedTrips = [...restoredTrips, ...keptTrips].sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );

    const keptItems = localItems.filter(i => !restoredTripIds.has(i.tripId));
    const mergedItems = [...keptItems, ...restoredItems];

    const keptExpenses = localExpenses.filter(e => {
      if (!e.isTripExpense || !e.tripId) {
        return !restoredExpenseIds.has(e.id);
      }
      return !restoredTripIds.has(e.tripId);
    });
    const rebuiltExpenses = restoredTrips.map(t => buildTripExpenseRecord(t, t.itemsCount));
    const mergedExpenses = [...rebuiltExpenses, ...restoredExpenses, ...keptExpenses];

    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(mergedTrips));
    localStorage.setItem(STORAGE_KEYS.GROCERY_ITEMS, JSON.stringify(mergedItems));
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(mergedExpenses));

    tripsRestored = restoredTrips.length;
    itemsRestored = restoredItems.length;
  }

  if (Array.isArray(remoteWaste)) {
    const localWaste = getFoodWasteRecords();
    const localWasteMap = new Map(localWaste.map(w => [w.id, w]));
    const restoredIds = new Set();
    const restoredWaste = [];

    for (const remote of remoteWaste) {
      if (!remote || !remote.id) continue;
      const local = localWasteMap.get(remote.id);
      if (local && local.synced === false) continue; // Pending local edit wins
      restoredWaste.push({
        ...remote,
        projectWeek: Number(remote.projectWeek || 1),
        measuredWeightG: Number(remote.measuredWeightG || 0),
        estimatedCost: Number(remote.estimatedCost || 0),
        synced: true
      });
      restoredIds.add(remote.id);
    }

    const mergedWaste = [...restoredWaste, ...localWaste.filter(w => !restoredIds.has(w.id))].sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
    localStorage.setItem(STORAGE_KEYS.FOOD_WASTE, JSON.stringify(mergedWaste));
    wasteRestored = restoredWaste.length;
  }

  return { tripsRestored, itemsRestored, wasteRestored };
}

async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders({ 'Accept': 'application/json' }),
      credentials: 'include',
      signal: controller?.signal
    });
    if (!res || !res.ok) return null;
    return await res.json().catch(() => null);
  } catch (err) {
    console.warn(`[Restore] GET ${url} failed:`, err.message);
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Auto-retries synchronization of pending offline meal plans to Neon PostgreSQL
 */
export async function syncPendingMealPlans() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { syncedCount: 0 };
  if (typeof fetch !== 'function') return { syncedCount: 0 };

  try {
    const plans = getMealPlans();
    const unsynced = plans.filter(p => p.synced === false);
    if (unsynced.length === 0) return { syncedCount: 0 };

    let syncedCount = 0;
    for (const plan of unsynced) {
      try {
        const res = await fetch('/api/meal-plans', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ plan })
        });
        if (res.ok) {
          plan.synced = true;
          syncedCount++;
        }
      } catch (_) {}
    }
    if (syncedCount > 0) {
      localStorage.setItem(STORAGE_KEYS.MEAL_PLANS, JSON.stringify(plans));
    }
    return { syncedCount };
  } catch (err) {
    return { syncedCount: 0 };
  } 
}

/**
 * Auto-retries synchronization of pending offline inventory to Neon PostgreSQL
 */
export async function syncPendingInventory() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { syncedCount: 0 };
  if (typeof fetch !== 'function') return { syncedCount: 0 };

  try {
    const raw = localStorage.getItem('kosherai_inventory');
    if (!raw) return { syncedCount: 0 };
    const items = JSON.parse(raw);
    const unsynced = items.filter(i => i.synced === false);
    if (unsynced.length === 0) return { syncedCount: 0 };

    let syncedCount = 0;
    for (const item of unsynced) {
      try {
        const res = await fetch('/api/inventory', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ item })
        });
        if (res.ok) {
          item.synced = true;
          syncedCount++;
        }
      } catch (_) {}
    }
    if (syncedCount > 0) {
      localStorage.setItem('kosherai_inventory', JSON.stringify(items));
    }
    return { syncedCount };
  } catch (err) {
    return { syncedCount: 0 };
  }
}

let inFlightSyncPromise = null;

/**
 * Master Synchronization & Re-hydration Orchestrator.
 * Connects to Neon PostgreSQL and hydrates:
 * 1. Shopping Trips & Itemized Purchases (/api/trips)
 * 2. Food Waste Logs (/api/food-waste)
 * 3. Scan History (/api/scans)
 * 4. Household Inventory (/api/inventory)
 * 5. Meal Plans (/api/meal-plans)
 * 6. Household Settings (/api/settings)
 *
 * Guarantees multi-tenant isolation, safe non-destructive merging,
 * offline fallback preservation, and zero data-loss across logins.
 */
export async function syncAndHydrateUserData() {
  if (inFlightSyncPromise) {
    return inFlightSyncPromise;
  }
  inFlightSyncPromise = _doSyncAndHydrateUserData().finally(() => {
    inFlightSyncPromise = null;
  });
  return inFlightSyncPromise;
}

async function _doSyncAndHydrateUserData() {
  const empty = { tripsRestored: 0, itemsRestored: 0, wasteRestored: 0, scansRestored: 0, inventoryRestored: 0, mealPlansRestored: 0 };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, offline: true, ...empty, message: 'Device is offline. Showing locally cached data.' };
  }
  if (typeof fetch !== 'function') {
    return { ok: false, ...empty, message: 'Network fetch unavailable.' };
  }

  // 1. Better Auth session check: If token not in localStorage, check if HttpOnly cookie session is active
  if (!getClientAuthToken()) {
    try {
      const sessRes = await fetch('/api/auth/get-session', { credentials: 'include' });
      if (sessRes.ok) {
        const sessData = await sessRes.json().catch(() => null);
        if (sessData?.session?.token && sessData?.user) {
          localStorage.setItem('better-auth.session_token', sessData.session.token);
          const currentUser = JSON.parse(localStorage.getItem('kosherai_current_user') || '{}');
          const updatedUser = { ...currentUser, ...sessData.user, token: sessData.session.token };
          localStorage.setItem('kosherai_current_user', JSON.stringify(updatedUser));
          localStorage.setItem('kosherai_user_session', JSON.stringify({
            token: sessData.session.token,
            session: sessData.session,
            user: updatedUser
          }));
        }
      }
    } catch (_) {}
  }

  // Ensure tenant account tracking
  try {
    const curUserStr = localStorage.getItem('kosherai_current_user');
    if (curUserStr) {
      const u = JSON.parse(curUserStr);
      if (u?.id) handleTenantAccountChange(u.id);
    }
  } catch (_) {}

  // 2. Upload pending offline records first (so local unsynced edits are never overwritten)
  const [tripsSyncResult, wasteSyncResult, scansSyncResult, expensesSyncResult, invSyncResult, mealSyncResult] = await Promise.allSettled([
    syncPendingTrips(),
    syncPendingFoodWaste(),
    syncPendingScans(),
    syncPendingExpenses(),
    syncPendingInventory(),
    syncPendingMealPlans()
  ]);

  const tripsSynced = tripsSyncResult.status === 'fulfilled' ? (tripsSyncResult.value?.syncedCount || 0) : 0;
  const tripsFailed = tripsSyncResult.status === 'fulfilled' ? (tripsSyncResult.value?.pendingCount || 0) : 0;

  const wasteSynced = wasteSyncResult.status === 'fulfilled' ? (wasteSyncResult.value?.syncedCount || 0) : 0;
  const wasteFailed = wasteSyncResult.status === 'fulfilled' ? (wasteSyncResult.value?.pendingCount || 0) : 0;

  const scansSynced = scansSyncResult.status === 'fulfilled' ? (scansSyncResult.value?.syncedCount || 0) : 0;
  const scansFailed = scansSyncResult.status === 'fulfilled' ? (scansSyncResult.value?.pendingCount || 0) : 0;

  const expensesSynced = expensesSyncResult.status === 'fulfilled' ? (expensesSyncResult.value?.syncedCount || 0) : 0;
  const expensesFailed = expensesSyncResult.status === 'fulfilled' ? (expensesSyncResult.value?.pendingCount || 0) : 0;

  const totalUploaded = tripsSynced + wasteSynced + scansSynced + expensesSynced;

  // 3. Fetch all 6 resources concurrently from Neon
  const [tripsRes, wasteRes, scansRes, invRes, mealRes, settingsRes] = await Promise.allSettled([
    fetchJsonWithTimeout('/api/trips'),
    fetchJsonWithTimeout('/api/food-waste'),
    fetchJsonWithTimeout('/api/scans'),
    fetchJsonWithTimeout('/api/inventory'),
    fetchJsonWithTimeout('/api/meal-plans'),
    fetchJsonWithTimeout('/api/settings')
  ]);

  const tripsPayload = tripsRes.status === 'fulfilled' ? tripsRes.value : null;
  const wastePayload = wasteRes.status === 'fulfilled' ? wasteRes.value : null;
  const scansPayload = scansRes.status === 'fulfilled' ? scansRes.value : null;
  const invPayload = invRes.status === 'fulfilled' ? invRes.value : null;
  const mealPayload = mealRes.status === 'fulfilled' ? mealRes.value : null;
  const settingsPayload = settingsRes.status === 'fulfilled' ? settingsRes.value : null;

  // Verify whether response came from authenticated Neon
  const tripsOk = Boolean(tripsPayload && tripsPayload.synced === true && !tripsPayload.offline && Array.isArray(tripsPayload.trips));
  const wasteOk = Boolean(wastePayload && wastePayload.synced === true && !wastePayload.offline && Array.isArray(wastePayload.foodWaste));
  const scansOk = Boolean(scansPayload && !scansPayload.offline && (Array.isArray(scansPayload.scans) || Array.isArray(scansPayload.data) || Array.isArray(scansPayload)));
  const invOk = Boolean(invPayload && invPayload.synced === true && !invPayload.offline && Array.isArray(invPayload.inventory));
  const mealOk = Boolean(mealPayload && mealPayload.synced === true && !mealPayload.offline && Array.isArray(mealPayload.mealPlans));
  const settingsOk = Boolean(settingsPayload && settingsPayload.synced === true && settingsPayload.settings);

  if (!tripsOk && !wasteOk && !scansOk && !invOk && !mealOk && !settingsOk && totalUploaded === 0) {
    return {
      ok: false,
      tripsSynced,
      tripsFailed,
      wasteSynced,
      wasteFailed,
      scansSynced,
      scansFailed,
      expensesSynced,
      expensesFailed,
      ...empty,
      message: 'Cloud data unreachable or unauthenticated. Local cache preserved.'
    };
  }

  // 4. Merge Trips & Food Waste
  const courseResult = mergeRemoteCourseData(
    tripsOk ? tripsPayload.trips : null,
    wasteOk ? wastePayload.foodWaste : null
  );

  // Mirror restored records into IndexedDB
  try {
    if (tripsOk) {
      for (const remote of tripsPayload.trips) {
        const local = getShoppingTrips().find(t => t.id === remote.id);
        if (!local || local.synced === false) continue;
        await saveTripToIndexedDB(local, getGroceryItems(remote.id), true);
      }
    }
    if (wasteOk) {
      for (const remote of wastePayload.foodWaste) {
        const local = getFoodWasteRecords().find(w => w.id === remote.id);
        if (!local || local.synced === false) continue;
        await saveFoodWasteToIndexedDB(local, true);
      }
    }
  } catch (idbErr) {
    console.warn('[Hydrate] IndexedDB mirror warning:', idbErr);
  }

  // 5. Merge Scans (Non-destructive record-level merge preserving local modifications)
  let scansRestored = 0;
  if (scansOk) {
    try {
      const rawList = Array.isArray(scansPayload)
        ? scansPayload
        : (Array.isArray(scansPayload.scans) ? scansPayload.scans : (Array.isArray(scansPayload.data) ? scansPayload.data : []));
      const localScans = getLocalScanHistory();
      const merged = reconcileScanRecords(rawList, localScans);
      localStorage.setItem('kosherai_scan_history', JSON.stringify(merged));
      scansRestored = rawList.length;
    } catch (scanErr) {
      console.warn('[Hydrate] Scan history merge error:', scanErr);
    }
  }

  // 6. Merge Inventory
  let inventoryRestored = 0;
  if (invOk) {
    try {
      const remoteItems = invPayload.inventory;
      const rawLocal = localStorage.getItem('kosherai_inventory');
      const localItems = rawLocal ? JSON.parse(rawLocal) : [];
      const localMap = new Map(localItems.map(i => [i.id, i]));
      const restoredIds = new Set();
      const restored = [];

      for (const rem of remoteItems) {
        if (!rem || !rem.id) continue;
        const loc = localMap.get(rem.id);
        if (loc && loc.synced === false) continue;
        restored.push({ ...rem, synced: true });
        restoredIds.add(rem.id);
      }

      const kept = localItems.filter(i => !restoredIds.has(i.id));
      const merged = [...restored, ...kept];
      localStorage.setItem('kosherai_inventory', JSON.stringify(merged));
      inventoryRestored = restored.length;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('kosherai_inventory_updated'));
      }
    } catch (invErr) {
      console.warn('[Hydrate] Inventory merge error:', invErr);
    }
  }

  // 7. Merge Meal Plans
  let mealPlansRestored = 0;
  if (mealOk) {
    try {
      const remotePlans = mealPayload.mealPlans;
      const localPlans = getMealPlans();
      const localMap = new Map(localPlans.map(p => [p.id, p]));
      const restoredIds = new Set();
      const restored = [];

      for (const rem of remotePlans) {
        if (!rem || !rem.id) continue;
        const loc = localMap.get(rem.id);
        if (loc && loc.synced === false) continue;
        restored.push({ ...rem, synced: true });
        restoredIds.add(rem.id);
      }

      const kept = localPlans.filter(p => !restoredIds.has(p.id));
      const merged = [...restored, ...kept];
      localStorage.setItem(STORAGE_KEYS.MEAL_PLANS, JSON.stringify(merged));
      mealPlansRestored = restored.length;
    } catch (mealErr) {
      console.warn('[Hydrate] Meal plans merge error:', mealErr);
    }
  }

  // 8. Merge Settings
  if (settingsOk) {
    try {
      const s = settingsPayload.settings;
      if (s.household_members) {
        const num = Math.max(1, Math.min(20, Math.round(Number(s.household_members))));
        localStorage.setItem('kosherai_household_members', String(num));
        const currentSaved = localStorage.getItem('kosherai_settings');
        const parsed = currentSaved ? JSON.parse(currentSaved) : {};
        parsed.household_members = num;
        if (s.active_diet) parsed.active_diet = s.active_diet;
        localStorage.setItem('kosherai_settings', JSON.stringify(parsed));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kosherai:household-changed', { detail: { household_members: num } }));
        }
      }
      if (s.theme && typeof window !== 'undefined' && typeof document !== 'undefined' && document.documentElement) {
        localStorage.setItem('kosherai_theme', s.theme);
        localStorage.setItem('theme', s.theme);
        if (s.theme === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        }
      }
    } catch (setErr) {
      console.warn('[Hydrate] Settings merge error:', setErr);
    }
  }

  const result = {
    ok: true,
    tripsSynced,
    tripsFailed,
    wasteSynced,
    wasteFailed,
    scansSynced,
    scansFailed,
    expensesSynced,
    expensesFailed,
    tripsRestored: courseResult.tripsRestored,
    itemsRestored: courseResult.itemsRestored,
    wasteRestored: courseResult.wasteRestored,
    scansRestored,
    inventoryRestored,
    mealPlansRestored,
    message: totalUploaded > 0
      ? `Neon Synchronized: ${totalUploaded} records uploaded (${tripsSynced} trips, ${wasteSynced} waste, ${scansSynced} scans, ${expensesSynced} expenses). Restored ${courseResult.tripsRestored} trips from Neon.`
      : `Restored ${courseResult.tripsRestored} trips, ${courseResult.wasteRestored} waste records, ${inventoryRestored} inventory items, ${mealPlansRestored} meal plans from Neon.`
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kosherai-neon-restored', { detail: result }));
    window.dispatchEvent(new CustomEvent('kosherai_storage_updated'));
  }

  console.info(`[Hydrate] ${result.message}`);
  return result;
}

/**
 * Backward-compatible wrapper for restoreFromNeon.
 * Delegates directly to syncAndHydrateUserData.
 */
export async function restoreFromNeon() {
  return syncAndHydrateUserData();
}

// Auto-retry when connection restored
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.info('[Network] Back online: initiating automatic background sync with Neon...');
    syncPendingTrips().catch(() => { });
    syncPendingFoodWaste().catch(() => { });
  });
}

/**
 * Deletes a shopping trip and cleans up linked grocery items, expense record, and IndexedDB/Neon
 */
export async function deleteShoppingTrip(tripId) {
  try {
    const trips = getShoppingTrips().filter(t => t.id !== tripId);
    const items = getGroceryItems().filter(i => i.tripId !== tripId);
    const expenses = getExpenses().filter(e => e.tripId !== tripId && e.id !== `exp_trip_${tripId}`);

    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));
    localStorage.setItem(STORAGE_KEYS.GROCERY_ITEMS, JSON.stringify(items));
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));

    // Delete from IndexedDB
    try {
      await deleteTripFromIndexedDB(tripId);
    } catch (idbErr) {
      console.warn('[Storage] IndexedDB delete error:', idbErr);
    }

    // Remote DELETE if online
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (isOnline && typeof fetch === 'function') {
      fetch(`/api/trips?id=${encodeURIComponent(tripId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      }).catch(() => { });
    }

    return true;
  } catch (e) {
    console.error('Failed to delete shopping trip:', e);
    return false;
  }
}

/**
 * Updates an existing shopping trip's metadata (storeName, tripType, totalAmountPaid, totalScaleWeightKg, date, notes).
 * Updates local item in kosherai_course_trips, triggers UI store refresh, and syncs via PATCH to /api/trips with credentials: "include".
 */
export async function updateShoppingTrip(tripId, updatedFields = {}) {
  try {
    const trips = getShoppingTrips();
    const index = trips.findIndex(t => t.id === tripId);
    if (index === -1) {
      console.warn(`[Storage] Trip ${tripId} not found for update`);
      return null;
    }

    const existing = trips[index];
    const config = getCourseConfig();

    const date = updatedFields.date || existing.date;
    const projectWeek = updatedFields.projectWeek !== undefined
      ? Number(updatedFields.projectWeek)
      : (updatedFields.date ? getProjectWeekForDate(date, config.startDate) : existing.projectWeek);

    const storeName = updatedFields.storeName !== undefined
      ? updatedFields.storeName
      : (updatedFields.store_name !== undefined ? updatedFields.store_name : existing.storeName);

    const tripType = updatedFields.tripType !== undefined
      ? updatedFields.tripType
      : (updatedFields.trip_type !== undefined ? updatedFields.trip_type : (existing.tripType || existing.trip_type || 'Supermarket'));

    const totalAmountPaid = updatedFields.totalAmountPaid !== undefined
      ? Number(updatedFields.totalAmountPaid)
      : (updatedFields.total_amount_paid !== undefined ? Number(updatedFields.total_amount_paid) : Number(existing.totalAmountPaid || 0));

    const totalScaleWeightKg = updatedFields.totalScaleWeightKg !== undefined
      ? Number(updatedFields.totalScaleWeightKg)
      : (updatedFields.total_scale_weight_kg !== undefined ? Number(updatedFields.total_scale_weight_kg) : Number(existing.totalScaleWeightKg || 0));

    const notes = updatedFields.notes !== undefined
      ? updatedFields.notes
      : (existing.notes || '');

    let receiptImageUrl = updatedFields.receiptImageUrl !== undefined
      ? updatedFields.receiptImageUrl
      : (updatedFields.receipt_image_url !== undefined ? updatedFields.receipt_image_url : existing.receiptImageUrl);

    if (receiptImageUrl && typeof receiptImageUrl === 'object') {
      receiptImageUrl = receiptImageUrl.dataUrl || receiptImageUrl.url || receiptImageUrl.secure_url || null;
    }
    if (typeof receiptImageUrl === 'string' && receiptImageUrl.includes('[object Object]')) {
      receiptImageUrl = existing.receiptImageUrl || null;
    }

    if (receiptImageUrl && typeof receiptImageUrl === 'string' && (receiptImageUrl.startsWith('data:') || receiptImageUrl.startsWith('blob:'))) {
      try {
        const cUrl = await uploadReceiptImageToCloudinary(receiptImageUrl);
        if (cUrl && typeof cUrl === 'string' && cUrl.startsWith('http')) {
          receiptImageUrl = cUrl;
        }
      } catch (err) {
        console.warn('[Cloudinary] Failed to upload updated receipt image:', err);
      }
    }

    const updatedTrip = {
      ...existing,
      ...updatedFields,
      id: tripId,
      storeName,
      tripType,
      trip_type: tripType,
      date,
      projectWeek,
      totalAmountPaid,
      totalScaleWeightKg,
      notes,
      receiptImageUrl,
      updatedAt: new Date().toISOString(),
      synced: false
    };

    // 1. Update local item in kosherai_course_trips and save to localStorage
    trips[index] = updatedTrip;
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));

    // 2. Update matching record(s) in kosherai_course_grocery_items where item.tripId === tripId
    const allGroceryItems = getGroceryItems();
    let groceryItemsUpdated = false;

    const rawItemName = updatedFields.itemName ?? updatedFields.name ?? '';
    const cleanName = typeof rawItemName === 'string' ? rawItemName.trim() : (rawItemName ? String(rawItemName).trim() : '');
    const rawItemQty = (updatedFields.quantity !== undefined && updatedFields.quantity !== null && updatedFields.quantity !== '')
      ? Number(updatedFields.quantity)
      : ((updatedFields.itemQuantity !== undefined && updatedFields.itemQuantity !== null && updatedFields.itemQuantity !== '')
        ? Number(updatedFields.itemQuantity)
        : ((updatedFields.itemQty !== undefined && updatedFields.itemQty !== null && updatedFields.itemQty !== '')
          ? Number(updatedFields.itemQty)
          : null));
    const cleanUnit = (updatedFields.unit || updatedFields.itemUnit || 'pc').trim();

    if (Array.isArray(updatedFields.items) && updatedFields.items.length > 0) {
      const itemUpdatesMap = new Map(updatedFields.items.map(i => [i.id, i]));
      allGroceryItems.forEach(item => {
        if (item.tripId === tripId || item.trip_id === tripId) {
          const update = itemUpdatesMap.get(item.id);
          if (update) {
            if (update.name) {
              const uName = update.name.trim();
              item.name = uName;
              item.raw_receipt_text = uName;
              item.rawReceiptText = uName;
            }
            if (update.quantity !== undefined && !isNaN(update.quantity)) item.quantity = Number(update.quantity);
            if (update.unit) item.unit = update.unit.trim();
            item.synced = false;
            groceryItemsUpdated = true;
          }
        }
      });
    } else if (cleanName || rawItemQty !== null || cleanUnit) {
      let foundMatching = false;
      allGroceryItems.forEach(item => {
        if (item.tripId === tripId || item.trip_id === tripId) {
          foundMatching = true;
          if (cleanName) {
            item.name = cleanName;
            item.raw_receipt_text = cleanName;
            item.rawReceiptText = cleanName;
          }
          if (rawItemQty !== null && !isNaN(rawItemQty)) item.quantity = rawItemQty;
          if (cleanUnit) item.unit = cleanUnit;
          item.synced = false;
          groceryItemsUpdated = true;
        }
      });

      if (!foundMatching && (cleanName || rawItemQty !== null)) {
        // If trip had no line items yet, create one matching the updated item details
        const newItemId = `item_${tripId}_0_${Math.random().toString(36).slice(2, 6)}`;
        allGroceryItems.push({
          id: newItemId,
          tripId,
          purchaseDate: date,
          projectWeek,
          name: cleanName || 'Item',
          raw_receipt_text: cleanName || 'Item',
          rawReceiptText: cleanName || 'Item',
          quantity: (rawItemQty !== null && !isNaN(rawItemQty)) ? rawItemQty : 1,
          unit: cleanUnit || 'pc',
          unitPrice: totalAmountPaid,
          totalPrice: totalAmountPaid,
          weightGrams: 0,
          category: 'General Food',
          lidStatus: 'SAFE',
          lidReason: '',
          synced: false
        });
        groceryItemsUpdated = true;
      }
    }

    if (groceryItemsUpdated) {
      localStorage.setItem(STORAGE_KEYS.GROCERY_ITEMS, JSON.stringify(allGroceryItems));
    }

    const tripItems = allGroceryItems.filter(i => i.tripId === tripId || i.trip_id === tripId);
    updatedTrip.itemsCount = tripItems.length || Number(existing.itemsCount || 0);
    trips[index] = updatedTrip;
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));

    // 3. Synchronize linked expense record (exp_trip_${tripId})
    try {
      const expenses = getExpenses();
      const tripExpenseId = `exp_trip_${tripId}`;
      const expIdx = expenses.findIndex(e => e.id === tripExpenseId || e.tripId === tripId);
      if (expIdx !== -1) {
        expenses[expIdx] = {
          ...expenses[expIdx],
          date,
          projectWeek,
          vendor: storeName,
          category: tripType,
          amount: totalAmountPaid,
          notes: `Shopping trip (${updatedTrip.itemsCount || 0} items, whole weight: ${totalScaleWeightKg} kg)`
        };
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      }
    } catch (expErr) {
      console.warn('[Storage] Error updating linked trip expense:', expErr);
    }

    // 4. Persist to IndexedDB
    try {
      await saveTripToIndexedDB(updatedTrip, tripItems, false);
    } catch (idbErr) {
      console.warn('[Storage] IndexedDB trip update error:', idbErr);
    }

    // 5. Step A: Instant Local-First Write Event Dispatch
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kosherai_storage_updated'));
      window.dispatchEvent(new CustomEvent('kosherai-trips-updated', { detail: { tripId, updatedTrip } }));
      window.dispatchEvent(new CustomEvent('kosherai-groceries-updated', { detail: { tripId, items: tripItems } }));
      window.dispatchEvent(new CustomEvent('kosherai-store-refresh', { detail: { type: 'trips', tripId } }));
    }

    // 6. Step B: Background Neon PostgreSQL Synchronization
    const bgSync = (async () => {
      const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
      if (!isOnline || typeof fetch !== 'function') return;

      try {
        const rawToken = typeof localStorage !== 'undefined' ? localStorage.getItem('better-auth.session_token') : null;
        const token = rawToken || getClientAuthToken();
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        const payload = {
          tripId,
          id: tripId,
          storeName,
          tripType,
          totalAmountPaid,
          totalScaleWeightKg,
          date,
          notes,
          projectWeek,
          receiptImageUrl,
          receipt_image_url: receiptImageUrl,
          itemName: cleanName || (tripItems[0]?.name || null),
          quantity: rawItemQty !== null ? rawItemQty : (tripItems[0]?.quantity ?? 1),
          unit: cleanUnit || (tripItems[0]?.unit || 'pc'),
          itemQuantity: rawItemQty !== null ? rawItemQty : (tripItems[0]?.quantity ?? 1),
          itemUnit: cleanUnit || (tripItems[0]?.unit || 'pc'),
          items: tripItems,
          ...updatedFields
        };

        const res = await fetch('/api/trips', {
          method: 'PATCH',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (res && res.ok) {
          // Re-read kosherai_course_trips and kosherai_course_grocery_items, set synced: true
          const freshTrips = getShoppingTrips();
          const tIdx = freshTrips.findIndex(t => t.id === tripId);
          if (tIdx !== -1) {
            freshTrips[tIdx].synced = true;
            localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(freshTrips));
            updatedTrip.synced = true;
          }

          const freshItems = getGroceryItems();
          let fItemsChanged = false;
          freshItems.forEach(item => {
            if (item.tripId === tripId || item.trip_id === tripId) {
              item.synced = true;
              fItemsChanged = true;
            }
          });
          if (fItemsChanged) {
            localStorage.setItem(STORAGE_KEYS.GROCERY_ITEMS, JSON.stringify(freshItems));
          }

          try {
            await saveTripToIndexedDB(freshTrips[tIdx] || updatedTrip, tripItems, true);
          } catch (_) { }

          // Dispatch window.dispatchEvent(new Event('kosherai_storage_updated')) so the card badge transitions from '⏳ OFFLINE' to '✓  SYNCED'
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('kosherai_storage_updated'));
            window.dispatchEvent(new CustomEvent('kosherai-trips-synced', { detail: { tripId } }));
            window.dispatchEvent(new CustomEvent('kosherai-store-refresh', { detail: { type: 'trips', tripId } }));
          }
          console.info('[Storage] Successfully persisted trip update to Neon PostgreSQL:', tripId);
        } else {
          console.warn('[Storage] Remote PATCH /api/trips returned status:', res?.status);
        }
      } catch (err) {
        console.warn('[Storage] Remote PATCH /api/trips failed, saved locally for auto-sync:', err.message);
      }
    })();

    await bgSync;
    return updatedTrip;

    return updatedTrip;
  } catch (e) {
    console.error('Failed to update shopping trip:', e);
    throw e;
  }
}

/**
 * Saves a standalone manual food expense (e.g. wet market veggies, pantry condiment without trip)
 */
export function saveStandaloneExpense(expenseData) {
  try {
    const expenses = getExpenses();
    const config = getCourseConfig();
    const date = expenseData.date || new Date().toISOString().split('T')[0];
    const projectWeek = expenseData.projectWeek || getProjectWeekForDate(date, config.startDate);
    const id = expenseData.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const record = {
      id,
      tripId: null,
      date,
      projectWeek,
      vendor: expenseData.vendor || 'Food Purchase',
      category: expenseData.category || 'Wet Market / Other',
      amount: Number(expenseData.amount || 0),
      isTripExpense: false,
      notes: expenseData.notes || '',
      createdAt: expenseData.createdAt || new Date().toISOString(),
      synced: expenseData.synced === true
    };

    const updated = [record, ...expenses.filter(e => e.id !== id)];
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));

    if (typeof fetch === 'function' && typeof navigator !== 'undefined' && navigator.onLine) {
      fetch('/api/trips', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          id,
          type: 'expense',
          date,
          projectWeek,
          vendor: record.vendor,
          category: record.category,
          amount: record.amount,
          notes: record.notes,
          createdAt: record.createdAt
        })
      }).then(async (res) => {
        if (res.ok) {
          const resData = await res.json().catch(() => null);
          if (resData && (resData.synced || resData.success) && !resData.offline) {
            record.synced = true;
            const cur = getExpenses().map(e => e.id === id ? { ...e, synced: true } : e);
            localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(cur));
          }
        }
      }).catch(() => {});
    }

    return record;
  } catch (e) {
    console.error('Failed to save standalone expense:', e);
    throw e;
  }
}

/**
 * Auto-retries synchronization of pending offline standalone expenses to Neon PostgreSQL
 */
export async function syncPendingExpenses() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { syncedCount: 0, pendingCount: 0 };
  if (typeof fetch !== 'function') return { syncedCount: 0, pendingCount: 0 };

  try {
    const expenses = getExpenses();
    const unsyncedStandalone = expenses.filter(e => (!e.isTripExpense || !e.tripId) && e.synced === false);
    if (unsyncedStandalone.length === 0) return { syncedCount: 0, pendingCount: 0 };

    let syncedCount = 0;
    const syncedIds = new Set();

    for (const exp of unsyncedStandalone) {
      try {
        const payload = {
          id: exp.id,
          type: 'expense',
          date: exp.date,
          projectWeek: Number(exp.projectWeek || 1),
          vendor: exp.vendor || 'Food Purchase',
          category: exp.category || 'Wet Market / Other',
          amount: Number(exp.amount || 0),
          notes: exp.notes ? `${exp.notes} [Standalone Expense]` : '[Standalone Expense]',
          createdAt: exp.createdAt || new Date().toISOString()
        };

        const res = await fetch('/api/trips', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (res && res.ok) {
          const resData = await res.json().catch(() => null);
          if (resData && (resData.synced === true || resData.success === true) && !resData.offline) {
            syncedIds.add(exp.id);
            syncedCount++;
          }
        }
      } catch (err) {
        console.warn(`[Sync] Failed to sync pending expense ${exp.id}:`, err);
      }
    }

    if (syncedCount > 0) {
      const updated = expenses.map(e => syncedIds.has(e.id) ? { ...e, synced: true } : e);
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));
    }

    return { syncedCount, pendingCount: unsyncedStandalone.length - syncedCount };
  } catch (err) {
    console.warn('[Sync] Error during syncPendingExpenses:', err);
    return { syncedCount: 0, pendingCount: 0 };
  }
}

export function deleteExpense(expenseId) {
  try {
    const expenses = getExpenses().filter(e => e.id !== expenseId);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    return true;
  } catch (e) {
    console.error('Failed to delete expense:', e);
    return false;
  }
}

// ==========================================
// FOOD WASTE TRACKING CRUD
// ==========================================

export function getFoodWasteRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FOOD_WASTE);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Error reading food waste records:', e);
    return [];
  }
}

/**
 * Saves a food waste entry.
 * STRICT ISOLATION: Estimated cost is tracked purely as a conservation indicator and NEVER added to food expenses.
 */
export function saveFoodWasteRecord(wasteData) {
  try {
    const records = getFoodWasteRecords();
    const config = getCourseConfig();
    const date = wasteData.date || new Date().toISOString().split('T')[0];
    const projectWeek = wasteData.projectWeek || getProjectWeekForDate(date, config.startDate);
    const id = wasteData.id || `waste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const record = {
      id,
      date,
      projectWeek,
      itemName: wasteData.itemName || 'Food Waste',
      measuredWeightG: Number(wasteData.measuredWeightG || 0), // Physical digital scale weight in grams
      isEstimated: Boolean(wasteData.isEstimated), // False if weighed on scale, true if estimated
      estimatedCost: Number(wasteData.estimatedCost || 0), // In ₱
      reason: wasteData.reason || 'Spoiled / Molded', // 'Spoiled', 'Expired', 'Cooked Excess', 'Trimmings', 'LID Mismatch'
      category: wasteData.category || resolveFoodCategory(wasteData.itemName || wasteData.name),
      notes: wasteData.notes || '',
      createdAt: wasteData.createdAt || new Date().toISOString(),
      synced: Boolean(wasteData.synced)
    };

    const updated = [record, ...records.filter(r => r.id !== id)];
    localStorage.setItem(STORAGE_KEYS.FOOD_WASTE, JSON.stringify(updated));
    return record;
  } catch (e) {
    console.error('Failed to save food waste record:', e);
    throw e;
  }
}

/**
 * Updates the synced flag for a food waste record in localStorage
 */
export function markFoodWasteSynced(id, isSynced = true) {
  try {
    const records = getFoodWasteRecords();
    const updated = records.map(r => r.id === id ? { ...r, synced: Boolean(isSynced) } : r);
    localStorage.setItem(STORAGE_KEYS.FOOD_WASTE, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.warn('Failed to mark food waste synced in localStorage:', e);
    return false;
  }
}

/**
 * Auto-retries synchronization of pending offline food waste logs to Neon PostgreSQL
 */
export async function syncPendingFoodWaste() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { syncedCount: 0, pendingCount: 0 };
  if (typeof fetch !== 'function') return { syncedCount: 0, pendingCount: 0 };

  try {
    const unsyncedFromDb = await getUnsyncedFoodWasteFromIndexedDB();
    const unsyncedFromLocal = getFoodWasteRecords().filter(r => r.synced === false);

    // Merge pending waste records by ID
    const pendingMap = new Map();
    unsyncedFromDb.forEach(w => pendingMap.set(w.id, w));
    unsyncedFromLocal.forEach(w => {
      if (!pendingMap.has(w.id)) pendingMap.set(w.id, w);
    });

    const pendingLogs = Array.from(pendingMap.values());
    if (pendingLogs.length === 0) return { syncedCount: 0, pendingCount: 0 };

    let syncedCount = 0;
    for (const wasteEntry of pendingLogs) {
      try {
        const res = await fetch('/api/food-waste', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(wasteEntry)
        });

        if (res && res.ok) {
          const payload = await res.json().catch(() => null);
          if (payload && (payload.success || payload.synced) && !payload.offline) {
            await markFoodWasteAsSyncedInIndexedDB(wasteEntry.id);
            markFoodWasteSynced(wasteEntry.id, true);
            syncedCount++;
          }
        }
      } catch (postErr) {
        console.warn(`[Sync] Failed to sync pending food waste ${wasteEntry.id} to Neon:`, postErr.message);
      }
    }

    if (syncedCount > 0) {
      console.info(`[Sync] Auto-retry synced ${syncedCount} offline food waste logs to Neon.`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosherai-food-waste-synced', { detail: { syncedCount } }));
      }
    }

    return { syncedCount, pendingCount: pendingLogs.length - syncedCount };
  } catch (err) {
    console.warn('[Sync] Error during syncPendingFoodWaste:', err);
    return { syncedCount: 0, pendingCount: 0 };
  }
}

export function deleteFoodWasteRecord(id) {
  try {
    const records = getFoodWasteRecords().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.FOOD_WASTE, JSON.stringify(records));
    return true;
  } catch (e) {
    console.error('Failed to delete food waste record:', e);
    return false;
  }
}

// ==========================================
// MEAL PLANNING CRUD (WEEKS 2 - 6 INTERVENTION)
// ==========================================

export function getMealPlans(weekNumber = null) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEAL_PLANS);
    const plans = raw ? JSON.parse(raw) : [];
    if (weekNumber !== null) {
      return plans.filter(p => Number(p.projectWeek) === Number(weekNumber));
    }
    return plans;
  } catch (e) {
    console.warn('Error reading meal plans:', e);
    return [];
  }
}

export function saveMealPlan(planData) {
  try {
    const plans = getMealPlans();
    const id = planData.id || `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const record = {
      id,
      projectWeek: Number(planData.projectWeek || 2),
      dayOfWeek: planData.dayOfWeek || 'Saturday', // 'Saturday', 'Sunday', ... 'Friday'
      mealType: planData.mealType || 'Dinner', // 'Breakfast', 'Lunch', 'Dinner', 'Snack'
      dishName: planData.dishName || 'Planned Meal',
      recipeId: planData.recipeId || null,
      ingredientsNeeded: Array.isArray(planData.ingredientsNeeded) ? planData.ingredientsNeeded : [],
      allocatedGroceryItemIds: Array.isArray(planData.allocatedGroceryItemIds) ? planData.allocatedGroceryItemIds : [],
      lidVerified: Boolean(planData.lidVerified),
      notes: planData.notes || '',
      createdAt: planData.createdAt || new Date().toISOString()
    };

    const updated = [record, ...plans.filter(p => p.id !== id)];
    localStorage.setItem(STORAGE_KEYS.MEAL_PLANS, JSON.stringify(updated));

    if (typeof fetch === 'function' && typeof navigator !== 'undefined' && navigator.onLine) {
      fetch('/api/meal-plans', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ plan: record })
      }).then(res => {
        if (res.ok) {
          record.synced = true;
          const current = getMealPlans().map(p => p.id === id ? { ...p, synced: true } : p);
          localStorage.setItem(STORAGE_KEYS.MEAL_PLANS, JSON.stringify(current));
        }
      }).catch(() => {});
    }

    return record;
  } catch (e) {
    console.error('Failed to save meal plan:', e);
    throw e;
  }
}

export function deleteMealPlan(id) {
  try {
    const plans = getMealPlans().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.MEAL_PLANS, JSON.stringify(plans));

    if (typeof fetch === 'function' && typeof navigator !== 'undefined' && navigator.onLine) {
      fetch(`/api/meal-plans?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      }).catch(() => {});
    }

    return true;
  } catch (e) {
    console.error('Failed to delete meal plan:', e);
    return false;
  }
}

// ==========================================
// SIX-WEEK COMPARATIVE ANALYTICS ENGINE
// ==========================================

export function getSixWeekComparison() {
  const config = getCourseConfig();
  const schedule = getProjectWeekSchedule(config.startDate);
  const expenses = getExpenses();
  const trips = getShoppingTrips();
  const wasteRecords = getFoodWasteRecords();
  const mealPlans = getMealPlans();

  const baselineBudget = Number(config.baselineBudget || PROJECT_CONFIG.DEFAULT_BASELINE_BUDGET);

  // Group by week 1 to 6
  const weeklyData = schedule.map(weekInfo => {
    const w = weekInfo.weekNumber;
    const weekExpenses = expenses.filter(e => Number(e.projectWeek) === w);
    const weekTrips = trips.filter(t => Number(t.projectWeek) === w);
    const weekWaste = wasteRecords.filter(r => Number(r.projectWeek) === w);
    const weekPlans = mealPlans.filter(p => Number(p.projectWeek) === w);

    const totalExpense = weekExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalScaleWeightKg = weekTrips.reduce((sum, t) => sum + Number(t.totalScaleWeightKg || 0), 0);

    const totalWasteGrams = weekWaste.reduce((sum, r) => sum + Number(r.measuredWeightG || 0), 0);
    const totalWasteKg = totalWasteGrams / 1000;
    const totalWasteCost = weekWaste.reduce((sum, r) => sum + Number(r.estimatedCost || 0), 0);

    const targetBudget = Number(config.weeklyBudgets?.[w] ?? baselineBudget);

    // Food cost density: ₱ per kg of grocery purchased
    const costPerKg = totalScaleWeightKg > 0 ? (totalExpense / totalScaleWeightKg) : 0;

    // Waste ratio: waste weight kg / total purchased kg
    const wasteRatioPercent = totalScaleWeightKg > 0 ? (totalWasteKg / totalScaleWeightKg) * 100 : 0;

    return {
      weekNumber: w,
      type: weekInfo.type,
      startDate: weekInfo.startDate,
      endDate: weekInfo.endDate,
      label: weekInfo.label,
      isBaseline: w === 1,
      isIntervention: w >= 2,
      targetBudget,
      totalExpense,
      totalScaleWeightKg,
      totalWasteGrams,
      totalWasteKg,
      totalWasteCost,
      costPerKg,
      wasteRatioPercent,
      tripsCount: weekTrips.length,
      expensesCount: weekExpenses.length,
      wasteEntriesCount: weekWaste.length,
      mealPlansCount: weekPlans.length,
      hasRecords: weekExpenses.length > 0 || weekTrips.length > 0 || weekWaste.length > 0
    };
  });

  // Week 1 Baseline Reference
  const week1 = weeklyData[0];
  const baselineExpense = week1.hasRecords && week1.totalExpense > 0 ? week1.totalExpense : baselineBudget;
  const baselineWasteKg = week1.totalWasteKg;

  // Compute variances and savings against Week 1 Baseline
  const comparativeWeekly = weeklyData.map(week => {
    let savingsVsBaseline = 0;
    let savingsPercent = 0;
    let wasteReductionVsBaselineKg = 0;
    let wasteReductionPercent = 0;

    if (week.weekNumber > 1 && week.hasRecords) {
      savingsVsBaseline = baselineExpense - week.totalExpense;
      savingsPercent = baselineExpense > 0 ? ((baselineExpense - week.totalExpense) / baselineExpense) * 100 : 0;

      wasteReductionVsBaselineKg = baselineWasteKg - week.totalWasteKg;
      wasteReductionPercent = baselineWasteKg > 0 ? ((baselineWasteKg - week.totalWasteKg) / baselineWasteKg) * 100 : 0;
    }

    const budgetDifference = week.targetBudget - week.totalExpense;

    return {
      ...week,
      baselineReferenceExpense: baselineExpense,
      savingsVsBaseline,
      savingsPercent,
      budgetDifference, // Positive = Under budget, Negative = Over budget
      wasteReductionVsBaselineKg,
      wasteReductionPercent
    };
  });

  // Overall Project Totals
  const totalProjectExpense = comparativeWeekly.reduce((sum, w) => sum + w.totalExpense, 0);
  const totalProjectPurchasedKg = comparativeWeekly.reduce((sum, w) => sum + w.totalScaleWeightKg, 0);
  const totalProjectWasteKg = comparativeWeekly.reduce((sum, w) => sum + w.totalWasteKg, 0);
  const totalProjectWasteCost = comparativeWeekly.reduce((sum, w) => sum + w.totalWasteCost, 0);

  // Intervention Cumulative Savings (Weeks 2-6)
  const interventionWeeks = comparativeWeekly.filter(w => w.weekNumber >= 2 && w.hasRecords);
  const totalInterventionSavings = interventionWeeks.reduce((sum, w) => sum + w.savingsVsBaseline, 0);
  const totalInterventionWasteSavedKg = interventionWeeks.reduce((sum, w) => sum + w.wasteReductionVsBaselineKg, 0);

  return {
    config,
    schedule,
    baselineExpense,
    baselineWasteKg,
    weeklyData: comparativeWeekly,
    totals: {
      totalProjectExpense,
      totalProjectPurchasedKg,
      totalProjectWasteKg,
      totalProjectWasteCost,
      totalInterventionSavings,
      totalInterventionWasteSavedKg,
      interventionWeeksCount: interventionWeeks.length
    }
  };
}

// ==========================================
// LOW-IODINE DIET CLASSIFICATION HELPER
// ==========================================

function evaluateItemLidStatus(name) {
  if (!name) return { status: STATUS.SAFE, reason: '' };
  const matches = searchDatabase(name);
  if (matches && matches.length > 0) {
    const first = matches[0];
    return {
      status: first.status,
      reason: first.description || first.clinicalNotes || ''
    };
  }

  // Common quick heuristic for Philippine groceries
  const lower = name.toLowerCase();
  if (lower.includes('fish') || lower.includes('tuna') || lower.includes('shrimp') || lower.includes('dilis') || lower.includes('patis') || lower.includes('toyo') || lower.includes('sea salt') || lower.includes('iodized') || lower.includes('dairy') || lower.includes('milk') || lower.includes('cheese') || lower.includes('butter') || lower.includes('egg yolk')) {
    return { status: STATUS.AVOID, reason: 'High iodine or forbidden LID ingredient.' };
  }
  if (lower.includes('salt') && !lower.includes('kosher')) {
    return { status: STATUS.CAUTION, reason: 'Unspecified salt likely iodized in commercial items.' };
  }
  return { status: STATUS.SAFE, reason: 'Standard pantry/produce item without prohibited markers.' };
}

// ==========================================
// CSV EXPORT GENERATOR
// ==========================================

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportAllCourseCsvs(activeState = {}) {
  const comparison = activeState.comparison || getSixWeekComparison();
  const trips = (activeState.trips && activeState.trips.length > 0) ? activeState.trips : getShoppingTrips();
  const items = (activeState.groceryItems && activeState.groceryItems.length > 0)
    ? activeState.groceryItems
    : ((activeState.groceryPurchases && activeState.groceryPurchases.length > 0) ? activeState.groceryPurchases : getGroceryItems());
  const expenses = (activeState.expenses && activeState.expenses.length > 0) ? activeState.expenses : getExpenses();
  const waste = (activeState.foodWaste && activeState.foodWaste.length > 0) ? activeState.foodWaste : getFoodWasteRecords();
  const mealPlans = (activeState.mealPlans && activeState.mealPlans.length > 0) ? activeState.mealPlans : getMealPlans();

  // 1. Shopping Trips CSV
  const tripsCsvRows = [
    ['Trip ID', 'Purchase Date', 'Project Week', 'Store Name', 'Trip Type', 'Whole Grocery Scale Weight (kg)', 'Total Amount Paid (PHP)', 'Items Count', 'Notes'].join(',')
  ];
  trips.forEach(t => {
    tripsCsvRows.push([
      escapeCsvField(t.id),
      escapeCsvField(t.date),
      escapeCsvField(`Week ${t.projectWeek}`),
      escapeCsvField(t.storeName),
      escapeCsvField(t.tripType),
      escapeCsvField(t.totalScaleWeightKg),
      escapeCsvField(t.totalAmountPaid),
      escapeCsvField(t.itemsCount),
      escapeCsvField(t.notes)
    ].join(','));
  });

  // 2. Purchased Grocery Items CSV
  const itemsCsvRows = [
    ['Item ID', 'Trip ID', 'Purchase Date', 'Project Week', 'Item Name', 'Quantity', 'Unit', 'Unit Price (PHP)', 'Total Line Price (PHP)', 'Package Weight (g)', 'LID Status', 'Category'].join(',')
  ];
  items.forEach(i => {
    itemsCsvRows.push([
      escapeCsvField(i.id),
      escapeCsvField(i.tripId),
      escapeCsvField(i.purchaseDate),
      escapeCsvField(`Week ${i.projectWeek}`),
      escapeCsvField(i.name),
      escapeCsvField(i.quantity),
      escapeCsvField(i.unit),
      escapeCsvField(i.unitPrice),
      escapeCsvField(i.totalPrice),
      escapeCsvField(i.weightGrams),
      escapeCsvField(i.lidStatus),
      escapeCsvField(i.category)
    ].join(','));
  });

  // 3. Food Expenses CSV
  const expensesCsvRows = [
    ['Expense ID', 'Date', 'Project Week', 'Vendor / Store', 'Category', 'Amount (PHP)', 'Is Linked Shopping Trip', 'Notes'].join(',')
  ];
  expenses.forEach(e => {
    expensesCsvRows.push([
      escapeCsvField(e.id),
      escapeCsvField(e.date),
      escapeCsvField(`Week ${e.projectWeek}`),
      escapeCsvField(e.vendor),
      escapeCsvField(e.category),
      escapeCsvField(e.amount),
      escapeCsvField(e.isTripExpense ? 'YES' : 'NO'),
      escapeCsvField(e.notes)
    ].join(','));
  });

  // 4. Food Waste Records CSV
  const wasteCsvRows = [
    ['Waste ID', 'Date Discarded', 'Project Week', 'Food Item', 'Measured Scale Weight (g)', 'Is Estimated', 'Estimated Cost (PHP)', 'Disposal Reason', 'Notes'].join(',')
  ];
  waste.forEach(w => {
    wasteCsvRows.push([
      escapeCsvField(w.id),
      escapeCsvField(w.date),
      escapeCsvField(`Week ${w.projectWeek}`),
      escapeCsvField(w.itemName),
      escapeCsvField(w.measuredWeightG),
      escapeCsvField(w.isEstimated ? 'YES' : 'NO (Actual Digital Scale)'),
      escapeCsvField(w.estimatedCost),
      escapeCsvField(w.reason),
      escapeCsvField(w.notes)
    ].join(','));
  });

  // 5. Six-Week Comparative Summary CSV
  const summaryCsvRows = [
    ['Project Week', 'Phase', 'Date Range', 'Target Budget (PHP)', 'Actual Expense (PHP)', 'Budget Variance (PHP)', 'Whole Grocery Scale Weight (kg)', 'Food Cost Density (PHP/kg)', 'Food Waste (g)', 'Food Waste (kg)', 'Waste-to-Purchase Ratio (%)', 'Estimated Waste Cost (PHP)', 'Savings vs Week 1 Baseline (PHP)', 'Savings vs Baseline (%)'].join(',')
  ];
  comparison.weeklyData.forEach(w => {
    summaryCsvRows.push([
      escapeCsvField(`Week ${w.weekNumber}`),
      escapeCsvField(w.type),
      escapeCsvField(`${w.startDate} to ${w.endDate}`),
      escapeCsvField(w.targetBudget),
      escapeCsvField(w.totalExpense),
      escapeCsvField(w.budgetDifference),
      escapeCsvField(w.totalScaleWeightKg),
      escapeCsvField(w.costPerKg ? w.costPerKg.toFixed(2) : '0.00'),
      escapeCsvField(w.totalWasteGrams),
      escapeCsvField(w.totalWasteKg.toFixed(3)),
      escapeCsvField(w.wasteRatioPercent ? w.wasteRatioPercent.toFixed(2) + '%' : '0.00%'),
      escapeCsvField(w.totalWasteCost),
      escapeCsvField(w.weekNumber > 1 && w.hasRecords ? w.savingsVsBaseline.toFixed(2) : 'N/A (Baseline)'),
      escapeCsvField(w.weekNumber > 1 && w.hasRecords ? w.savingsPercent.toFixed(1) + '%' : 'N/A')
    ].join(','));
  });

  return {
    tripsCsv: tripsCsvRows.join('\n'),
    itemsCsv: itemsCsvRows.join('\n'),
    expensesCsv: expensesCsvRows.join('\n'),
    wasteCsv: wasteCsvRows.join('\n'),
    summaryCsv: summaryCsvRows.join('\n')
  };
}

/**
 * Toast notification banner for user feedback
 */
export function showToast(message, type = 'warning') {
  if (typeof document === 'undefined') return;

  const existing = document.querySelector('#kosherai-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'kosherai-toast';
  const isSuccess = type === 'success';
  const isWarning = type === 'warning';
  const isError = type === 'error';

  toast.className = 'fixed z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl transition-all duration-300 text-sm font-semibold ' +
    (isWarning || isError
      ? 'bg-amber-900/95 text-amber-100 border border-amber-500/60 shadow-amber-950/50'
      : 'bg-emerald-950/95 text-emerald-100 border border-emerald-500/60 shadow-emerald-950/50');

  toast.style.cssText = 'position: fixed; bottom: 84px; left: 50%; transform: translateX(-50%); z-index: 9999; padding: 12px 20px; border-radius: 14px; font-weight: 600; font-size: 0.88rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 8px; max-width: 90vw; width: max-content; pointer-events: none; text-align: center; backdrop-filter: blur(8px);';

  const icon = isWarning ? '⚠️' : isError ? '❌' : '✓';
  const hasIconPrefix = message.startsWith('✓') || message.startsWith('⚠️') || message.startsWith('❌') || message.startsWith('✅');
  toast.innerHTML = (hasIconPrefix ? '' : `<span style="font-size: 1.15rem; font-weight: 800; color: ${isSuccess ? '#34d399' : 'inherit'};">${icon}</span>`) + `<span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 10px)';
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
}

/**
 * Robust Client-Side CSV Blob Generator & Anchor Click Trigger
 */
let lastDownloadTimestamp = 0;
let lastDownloadFileName = '';

export function triggerCsvDownload(arg1, arg2) {
  let filename = 'export.csv';
  let csvContent = '';

  if (typeof arg1 === 'string' && arg1.toLowerCase().endsWith('.csv')) {
    filename = arg1;
    csvContent = arg2 || '';
  } else if (typeof arg2 === 'string' && arg2.toLowerCase().endsWith('.csv')) {
    csvContent = arg1 || '';
    filename = arg2;
  } else {
    filename = arg1 || 'export.csv';
    csvContent = arg2 || '';
  }

  // Prevent duplicate downloads triggered within 500ms for the exact same file
  const now = Date.now();
  if (filename === lastDownloadFileName && (now - lastDownloadTimestamp < 500)) {
    return false;
  }
  lastDownloadTimestamp = now;
  lastDownloadFileName = filename;

  if (!csvContent || !csvContent.trim()) {
    showToast("No data available to export for this report.", "warning");
    if (typeof alert === 'function') {
      alert("No data available to export for this report.");
    }
    return false;
  }

  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export const downloadCsvFile = triggerCsvDownload;

export const EMPTY_EXPORT_MESSAGE = "No records available to export. Please record a trip or restore from Neon first.";

export function hasCourseData(activeState = {}) {
  const trips = (activeState.trips && activeState.trips.length > 0) ? activeState.trips : getShoppingTrips();
  const items = (activeState.groceryItems && activeState.groceryItems.length > 0)
    ? activeState.groceryItems
    : ((activeState.groceryPurchases && activeState.groceryPurchases.length > 0) ? activeState.groceryPurchases : getGroceryItems());
  const waste = (activeState.foodWaste && activeState.foodWaste.length > 0) ? activeState.foodWaste : getFoodWasteRecords();
  return (trips.length > 0 || items.length > 0 || waste.length > 0);
}

export function handleExportWeeklySummary(activeState = {}) {
  if (!hasCourseData(activeState)) {
    showToast(EMPTY_EXPORT_MESSAGE, 'warning');
    if (typeof alert === 'function') alert(EMPTY_EXPORT_MESSAGE);
    return false;
  }
  const csvs = exportAllCourseCsvs(activeState);
  const success = triggerCsvDownload('kosherai_six_week_summary_comparison.csv', csvs.summaryCsv);
  if (success) {
    showToast('✓ Six-Week Comparative Summary CSV downloaded successfully', 'success');
  }
  return success;
}

export function handleExportShoppingTrips(activeState = {}) {
  const trips = (activeState.trips && activeState.trips.length > 0) ? activeState.trips : getShoppingTrips();
  if (trips.length === 0) {
    showToast(EMPTY_EXPORT_MESSAGE, 'warning');
    if (typeof alert === 'function') alert(EMPTY_EXPORT_MESSAGE);
    return false;
  }
  const csvs = exportAllCourseCsvs(activeState);
  const success = triggerCsvDownload('kosherai_shopping_trips_expenses.csv', csvs.tripsCsv);
  if (success) {
    showToast('✓ Shopping trips CSV downloaded successfully', 'success');
  }
  return success;
}

export function handleExportItemizedGroceries(activeState = {}) {
  const items = (activeState.groceryItems && activeState.groceryItems.length > 0)
    ? activeState.groceryItems
    : ((activeState.groceryPurchases && activeState.groceryPurchases.length > 0) ? activeState.groceryPurchases : getGroceryItems());
  if (items.length === 0) {
    showToast(EMPTY_EXPORT_MESSAGE, 'warning');
    if (typeof alert === 'function') alert(EMPTY_EXPORT_MESSAGE);
    return false;
  }
  const csvs = exportAllCourseCsvs(activeState);
  const success = triggerCsvDownload('kosherai_grocery_purchased_items.csv', csvs.itemsCsv);
  if (success) {
    showToast('✓ Itemized purchased groceries CSV downloaded successfully', 'success');
  }
  return success;
}

export function handleExportFoodWaste(activeState = {}) {
  const waste = (activeState.foodWaste && activeState.foodWaste.length > 0) ? activeState.foodWaste : getFoodWasteRecords();
  if (waste.length === 0) {
    showToast(EMPTY_EXPORT_MESSAGE, 'warning');
    if (typeof alert === 'function') alert(EMPTY_EXPORT_MESSAGE);
    return false;
  }
  const csvs = exportAllCourseCsvs(activeState);
  const success = triggerCsvDownload('kosherai_food_waste_records.csv', csvs.wasteCsv);
  if (success) {
    showToast('✓ Food waste log CSV downloaded successfully', 'success');
  }
  return success;
}
