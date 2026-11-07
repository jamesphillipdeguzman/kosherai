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

export default {
  normalizeWeek,
  resolveItemWeek,
  isWeekMatch
};
