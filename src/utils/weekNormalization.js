import { PROJECT_CONFIG, getProjectConfig, getProjectWeekForDate } from '../services/courseProjectStorage.js';

/**
 * Normalizes week values like 1, "1", "W01", "W1", "all", null, undefined.
 * Always returns: 'all' | 1 | 2 | 3 | 4 | 5 | 6
 *
 * @param {string|number|null|undefined} val
 * @returns {'all'|number}
 */
export function normalizeWeek(val) {
  if (val === undefined || val === null) return 'all';
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed || trimmed === 'all' || trimmed === 'all weeks' || trimmed === 'all-weeks') {
      return 'all';
    }
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return 'all';
    const parsed = parseInt(digits, 10);
    return (parsed >= 1 && parsed <= 6) ? parsed : 'all';
  }
  if (typeof val === 'number') {
    return (val >= 1 && val <= 6) ? val : 'all';
  }
  return 'all';
}

/**
 * Resolves an item's project study week from its parent shopping trip (if available),
 * explicit projectWeek attribute, or calculated from date using configured project start date.
 *
 * @param {object} item - Grocery purchase item record
 * @param {Map<string, object>|Array<object>} trips - Map or list of shopping trips
 * @param {object} [config] - Project configuration with startDate
 * @returns {number} Study week number (1 to 6)
 */
export function resolveItemWeek(item, trips = null, config = null) {
  if (!item) return 1;

  const resolvedConfig = config || (typeof getProjectConfig === 'function' ? getProjectConfig() : { startDate: PROJECT_CONFIG.START_DATE });
  const startDate = resolvedConfig.startDate || PROJECT_CONFIG.START_DATE;

  // 1. Check parent shopping trip
  const tripId = item.tripId || item.trip_id;
  if (tripId && trips) {
    let parentTrip = null;
    if (trips instanceof Map) {
      parentTrip = trips.get(tripId);
    } else if (Array.isArray(trips)) {
      parentTrip = trips.find(t => t.id === tripId);
    }

    if (parentTrip) {
      if (parentTrip.projectWeek !== undefined && parentTrip.projectWeek !== null) {
        const norm = normalizeWeek(parentTrip.projectWeek);
        if (norm !== 'all') return norm;
      }
      if (parentTrip.date && typeof getProjectWeekForDate === 'function') {
        return getProjectWeekForDate(parentTrip.date, startDate);
      }
    }
  }

  // 2. Direct projectWeek on item
  if (item.projectWeek !== undefined && item.projectWeek !== null) {
    const norm = normalizeWeek(item.projectWeek);
    if (norm !== 'all') return norm;
  }

  // 3. Purchase date on item
  const dateStr = item.purchaseDate || item.date || item.createdAt;
  if (dateStr && typeof getProjectWeekForDate === 'function') {
    return getProjectWeekForDate(dateStr, startDate);
  }

  return 1;
}

/**
 * Checks whether a given record's week matches the selected target week filter.
 *
 * @param {string|number} recordWeek
 * @param {string|number} targetWeek
 * @returns {boolean}
 */
export function isWeekMatch(recordWeek, targetWeek) {
  const normTarget = normalizeWeek(targetWeek);
  if (normTarget === 'all') return true;
  const normRecord = normalizeWeek(recordWeek);
  return normRecord === normTarget;
}

/**
 * Resolves the study week number (1 to 6) for a food waste record.
 * Checks explicit projectWeek / project_week, then derives from date / createdAt.
 *
 * @param {object} record - Food waste log record
 * @param {object} [config] - Project configuration with startDate
 * @returns {number} Study week number (1 to 6)
 */
export function resolveWasteWeek(record, config = null) {
  if (!record) return 1;

  // 1. Direct explicit project week
  const rawWeek = record.projectWeek ?? record.project_week ?? record.week;
  if (rawWeek !== undefined && rawWeek !== null) {
    const norm = normalizeWeek(rawWeek);
    if (norm !== 'all') return norm;
  }

  // 2. Derive from date
  const resolvedConfig = config || (typeof getProjectConfig === 'function' ? getProjectConfig() : { startDate: PROJECT_CONFIG.START_DATE });
  const startDate = resolvedConfig?.startDate || PROJECT_CONFIG.START_DATE;
  const dateStr = record.date || record.loggedAt || record.createdAt;
  if (dateStr && typeof getProjectWeekForDate === 'function') {
    const cleanDate = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
    return getProjectWeekForDate(cleanDate, startDate);
  }

  return 1;
}

/**
 * Checks whether a food waste record matches the target week.
 *
 * @param {object} record - Food waste log record
 * @param {string|number} targetWeek - 'all' or week number / string (e.g. 'W1', 'W2 INTERVENE')
 * @param {object} [config] - Project configuration with startDate
 * @returns {boolean}
 */
export function isWasteLogMatchWeek(record, targetWeek, config = null) {
  const normTarget = normalizeWeek(targetWeek);
  if (normTarget === 'all') return true;
  const recordWeek = resolveWasteWeek(record, config);
  return recordWeek === normTarget;
}

/**
 * Resolves the display name of a grocery item supporting all field variations:
 * name, itemName, item_name, productName, product_name, raw_receipt_text, rawReceiptText
 *
 * @param {object|string} item
 * @returns {string}
 */
export function getGroceryItemName(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  const name = (
    item.name ||
    item.itemName ||
    item.item_name ||
    item.productName ||
    item.product_name ||
    item.raw_receipt_text ||
    item.rawReceiptText ||
    item.itemDescription ||
    item.description ||
    ''
  );
  return String(name).trim();
}

/**
 * Checks whether a grocery item matches a search query (case-insensitive, trimmed).
 *
 * @param {object|string} item
 * @param {string} query
 * @returns {boolean}
 */
export function matchesGroceryQuery(item, query) {
  if (!query || !String(query).trim()) return true;
  const cleanQuery = String(query).trim().toLowerCase();
  const name = getGroceryItemName(item).toLowerCase();
  if (name.includes(cleanQuery)) return true;

  const raw = String(item.raw_receipt_text || item.rawReceiptText || '').toLowerCase();
  if (raw && raw.includes(cleanQuery)) return true;

  return false;
}

/**
 * Retrieves all grocery items associated with a trip across both the separate
 * grocery items collection and nested trip arrays.
 *
 * @param {object} trip
 * @param {Array<object>} [allGroceryItems]
 * @returns {Array<object>}
 */
export function getTripGroceryItems(trip, allGroceryItems = null) {
  if (!trip) return [];
  const tripId = trip.id;

  // 1. Check separate grocery collection if provided
  if (Array.isArray(allGroceryItems) && tripId) {
    const matched = allGroceryItems.filter(i => i.tripId === tripId || i.trip_id === tripId);
    if (matched.length > 0) return matched;
  }

  // 2. Check nested trip item arrays
  if (Array.isArray(trip.items) && trip.items.length > 0) return trip.items;
  if (Array.isArray(trip.rawItems) && trip.rawItems.length > 0) return trip.rawItems;
  if (Array.isArray(trip.extractedItems) && trip.extractedItems.length > 0) return trip.extractedItems;
  if (Array.isArray(trip.groceryItems) && trip.groceryItems.length > 0) return trip.groceryItems;

  if (trip.extractedItemName) {
    return [{
      name: trip.extractedItemName,
      quantity: trip.totalScaleWeightKg || 1,
      unit: 'kg'
    }];
  }

  return [];
}

export default {
  normalizeWeek,
  resolveItemWeek,
  resolveWasteWeek,
  isWeekMatch,
  isWasteLogMatchWeek,
  getGroceryItemName,
  matchesGroceryQuery,
  getTripGroceryItems
};

