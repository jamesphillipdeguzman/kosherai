import { searchDatabase } from './ruleEngine.js';
import { LID_DATABASE, STATUS } from '../data/lidDatabase.js';
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
      return items.filter(item => item.tripId === tripId);
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
        category: item.category || 'General Food',
        lidStatus: item.lidStatus || lidEval.status,
        lidReason: item.lidReason || lidEval.reason || '',
        synced: false
      };
    });

    const tripRecord = {
      id: tripId,
      date,
      projectWeek,
      storeName: tripData.storeName || 'Supermarket',
      tripType: tripData.tripType || 'Supermarket',
      totalAmountPaid: totalAmount,
      totalScaleWeightKg: scaleWeightKg, // Physical scale weight of whole grocery haul
      receiptImageUrl: tripData.receiptImageUrl || null,
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
          headers: { 'Content-Type': 'application/json' },
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
        category: item.category || 'General Food',
        lidStatus: item.lidStatus || 'SAFE',
        lidReason: item.lidReason || ''
      }));

      const payload = {
        ...trip,
        itemsCount: rawItems.length,
        trip: {
          ...trip,
          itemsCount: rawItems.length
        },
        items: rawItems,
        rawItems: rawItems
      };

      try {
        const res = await fetch('/api/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res && res.ok) {
          await markTripAsSyncedInIndexedDB(trip.id);

          // Update localStorage
          const localTrips = getShoppingTrips().map(t => 
            t.id === trip.id ? { ...t, synced: true, itemsCount: rawItems.length } : t
          );
          localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(localTrips));

          syncedCount++;
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

// Auto-retry when connection restored
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.info('[Network] Back online: initiating automatic background sync with Neon...');
    syncPendingTrips().catch(() => {});
    syncPendingFoodWaste().catch(() => {});
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
      fetch(`/api/trips?id=${encodeURIComponent(tripId)}`, { method: 'DELETE' }).catch(() => {});
    }

    return true;
  } catch (e) {
    console.error('Failed to delete shopping trip:', e);
    return false;
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
      createdAt: expenseData.createdAt || new Date().toISOString()
    };

    const updated = [record, ...expenses.filter(e => e.id !== id)];
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));
    return record;
  } catch (e) {
    console.error('Failed to save standalone expense:', e);
    throw e;
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wasteEntry)
        });

        if (res && res.ok) {
          const payload = await res.json().catch(() => null);
          if (payload && (payload.success || payload.synced)) {
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

export function exportAllCourseCsvs() {
  const comparison = getSixWeekComparison();
  const trips = getShoppingTrips();
  const items = getGroceryItems();
  const expenses = getExpenses();
  const waste = getFoodWasteRecords();
  const mealPlans = getMealPlans();

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
 * Browser file download helper
 */
export function downloadCsvFile(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
