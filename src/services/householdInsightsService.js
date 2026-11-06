/**
 * KosherAI - Household Grocery Insights Service (Phase 3)
 * Consolidates grocery purchases, food-waste records, household size, and Phase 2 over-buying alerts
 * into unified, accurate, and actionable household grocery insights.
 *
 * Built strictly on Phase 1 dynamic household sizing and Phase 2 over-buying detection.
 * All metrics derive from actual recorded data without fabricated numbers.
 */

import { getHouseholdMembers } from './storage.js';
import {
  FOOD_CATEGORIES,
  resolveFoodCategory,
  standardizeWeightToKg,
  calculateHistoricalWasteAnalysis
} from './overBuyingDetector.js';
import {
  getShoppingTrips,
  getGroceryItems,
  getFoodWasteRecords,
  formatDateYMD
} from './courseProjectStorage.js';

export const REPORTING_PERIODS = {
  THIS_WEEK: 'this_week',
  LAST_WEEK: 'last_week',
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  LAST_30_DAYS: 'last_30_days',
  ALL_TIME: 'all_time'
};

export const PERIOD_LABELS = {
  [REPORTING_PERIODS.THIS_WEEK]: 'This Week',
  [REPORTING_PERIODS.LAST_WEEK]: 'Last Week',
  [REPORTING_PERIODS.THIS_MONTH]: 'This Month',
  [REPORTING_PERIODS.LAST_MONTH]: 'Last Month',
  [REPORTING_PERIODS.LAST_30_DAYS]: 'Last 30 Days',
  [REPORTING_PERIODS.ALL_TIME]: 'All Time'
};

/**
 * Currency formatter for Philippine Peso (₱)
 */
export function formatPeso(amount) {
  const num = Number(amount || 0);
  return `₱${num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Normalizes a date into YYYY-MM-DD string
 */
export function normalizeDateString(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    return dateVal.split('T')[0];
  }
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    return formatDateYMD(dateVal);
  }
  return '';
}

/**
 * Computes exact start and end date bounds (YYYY-MM-DD) for a given reporting period,
 * along with the matching previous comparable period.
 *
 * @param {string} period - One of REPORTING_PERIODS
 * @param {Date|string} [refDate] - Optional reference date (defaults to now)
 */
export function getDateRangeForPeriod(period = REPORTING_PERIODS.LAST_30_DAYS, refDate = new Date()) {
  const ref = typeof refDate === 'string' ? new Date(`${refDate}T12:00:00`) : new Date(refDate);
  const now = isNaN(ref.getTime()) ? new Date() : ref;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentDate = now.getDate();
  const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday

  let currentStart;
  let currentEnd;
  let previousStart;
  let previousEnd;

  switch (period) {
    case REPORTING_PERIODS.THIS_WEEK: {
      // Local week starting Monday (or Sunday if currentDay == 0)
      const dayOffset = currentDay === 0 ? 6 : currentDay - 1;
      currentStart = new Date(currentYear, currentMonth, currentDate - dayOffset);
      currentEnd = new Date(currentStart);
      currentEnd.setDate(currentStart.getDate() + 6);

      // Previous comparable period: exactly 7 days prior
      previousStart = new Date(currentStart);
      previousStart.setDate(currentStart.getDate() - 7);
      previousEnd = new Date(currentStart);
      previousEnd.setDate(currentStart.getDate() - 1);
      break;
    }

    case REPORTING_PERIODS.LAST_WEEK: {
      const dayOffset = currentDay === 0 ? 6 : currentDay - 1;
      currentStart = new Date(currentYear, currentMonth, currentDate - dayOffset - 7);
      currentEnd = new Date(currentStart);
      currentEnd.setDate(currentStart.getDate() + 6);

      // Previous comparable period: week prior to last week
      previousStart = new Date(currentStart);
      previousStart.setDate(currentStart.getDate() - 7);
      previousEnd = new Date(currentStart);
      previousEnd.setDate(currentStart.getDate() - 1);
      break;
    }

    case REPORTING_PERIODS.THIS_MONTH: {
      currentStart = new Date(currentYear, currentMonth, 1);
      // Last day of this month
      currentEnd = new Date(currentYear, currentMonth + 1, 0);

      // Previous month
      previousStart = new Date(currentYear, currentMonth - 1, 1);
      previousEnd = new Date(currentYear, currentMonth, 0);
      break;
    }

    case REPORTING_PERIODS.LAST_MONTH: {
      currentStart = new Date(currentYear, currentMonth - 1, 1);
      currentEnd = new Date(currentYear, currentMonth, 0);

      // Two months ago
      previousStart = new Date(currentYear, currentMonth - 2, 1);
      previousEnd = new Date(currentYear, currentMonth - 1, 0);
      break;
    }

    case REPORTING_PERIODS.LAST_30_DAYS: {
      currentStart = new Date(currentYear, currentMonth, currentDate - 29);
      currentEnd = new Date(currentYear, currentMonth, currentDate);

      // 30 days prior (days 31 to 60 ago)
      previousStart = new Date(currentYear, currentMonth, currentDate - 59);
      previousEnd = new Date(currentYear, currentMonth, currentDate - 30);
      break;
    }

    case REPORTING_PERIODS.ALL_TIME:
    default: {
      currentStart = new Date(2020, 0, 1);
      currentEnd = new Date(2099, 11, 31);
      previousStart = null;
      previousEnd = null;
      break;
    }
  }

  return {
    period,
    label: PERIOD_LABELS[period] || 'Custom Period',
    startDate: formatDateYMD(currentStart),
    endDate: formatDateYMD(currentEnd),
    previousStartDate: previousStart ? formatDateYMD(previousStart) : null,
    previousEndDate: previousEnd ? formatDateYMD(previousEnd) : null
  };
}

/**
 * Calculates total grocery purchase weight normalized into kilograms (kg).
 * Prioritizes whole-grocery physical scale weights (`totalScaleWeightKg`).
 * If scale weight is 0 or unrecorded, falls back to summing compatible grocery item weights.
 * Incompatible measurements (pcs, packs, bottles, cans without explicit weight) are strictly excluded from weight.
 *
 * @param {Array} trips - Shopping trip records
 * @param {Array} items - Grocery purchase line items
 * @returns {{ totalWeightKg: number, hasIncompleteWeights: boolean, weighedTripsCount: number, unweighedItemsCount: number }}
 */
export function calculateNormalizedPurchaseWeight(trips = [], items = []) {
  let totalWeightKg = 0;
  let hasIncompleteWeights = false;
  let weighedTripsCount = 0;
  let unweighedItemsCount = 0;

  // Track which trips had physical scale weight
  const tripScaleWeights = new Map();
  for (const t of trips) {
    const scaleWeight = Number(t.totalScaleWeightKg ?? t.scaleWeightKg ?? 0);
    if (!isNaN(scaleWeight) && scaleWeight > 0) {
      tripScaleWeights.set(t.id, scaleWeight);
      totalWeightKg += scaleWeight;
      weighedTripsCount++;
    } else {
      tripScaleWeights.set(t.id, 0);
    }
  }

  // For trips without scale weight, aggregate compatible item weights
  const itemsByTrip = new Map();
  for (const item of items) {
    const tid = item.tripId || 'standalone';
    if (!itemsByTrip.has(tid)) itemsByTrip.set(tid, []);
    itemsByTrip.get(tid).push(item);
  }

  for (const [tid, tripItems] of itemsByTrip.entries()) {
    const hasScaleWeight = tripScaleWeights.get(tid) > 0;
    if (hasScaleWeight) {
      // Scale weight already counted, skip item double-counting
      continue;
    }

    for (const item of tripItems) {
      const itemWeight = standardizeWeightToKg(
        item.quantity ?? item.qty,
        item.unit,
        item.weightGrams ?? item.weightG
      );

      if (itemWeight !== null && itemWeight > 0) {
        totalWeightKg += itemWeight;
      } else {
        // Incompatible unit without weight (e.g. 3 pcs of garlic without grams)
        unweighedItemsCount++;
        hasIncompleteWeights = true;
      }
    }
  }

  // If there are trips with 0 kg and no items recorded at all
  for (const t of trips) {
    const scaleWeight = tripScaleWeights.get(t.id);
    const hasItems = itemsByTrip.has(t.id) && itemsByTrip.get(t.id).length > 0;
    if (scaleWeight === 0 && !hasItems) {
      hasIncompleteWeights = true;
    }
  }

  return {
    totalWeightKg: Number(totalWeightKg.toFixed(3)),
    hasIncompleteWeights,
    weighedTripsCount,
    unweighedItemsCount
  };
}

/**
 * Calculates normalized food waste weight into kilograms (kg) and total waste cost.
 *
 * @param {Array} wasteRecords - Food waste records
 * @returns {{ totalWasteKg: number, totalWasteCost: number, recordsCount: number }}
 */
export function calculateNormalizedFoodWaste(wasteRecords = []) {
  let totalWasteKg = 0;
  let totalWasteCost = 0;

  for (const record of wasteRecords) {
    const rawG = Number(record.measuredWeightG ?? record.measured_weight_g ?? record.weightGrams ?? 0);
    let recordKg = 0;

    if (!isNaN(rawG) && rawG > 0) {
      recordKg = rawG / 1000;
    } else {
      const parsedKg = standardizeWeightToKg(record.quantity, record.unit, record.weightGrams);
      if (parsedKg !== null && parsedKg > 0) {
        recordKg = parsedKg;
      }
    }

    totalWasteKg += recordKg;
    totalWasteCost += Number(record.estimatedCost || 0);
  }

  return {
    totalWasteKg: Number(totalWasteKg.toFixed(3)),
    totalWasteCost: Number(totalWasteCost.toFixed(2)),
    recordsCount: wasteRecords.length
  };
}

/**
 * Computes food waste breakdown by category for the given waste records.
 * Reuses Phase 2 FOOD_CATEGORIES and resolveFoodCategory mappings.
 *
 * @param {Array} wasteRecords - Food waste records
 * @returns {Array<Object>} Sorted list of categories with waste weight and percentage
 */
export function calculateWasteCategoryBreakdown(wasteRecords = []) {
  const categoryTotals = {};
  for (const cat of Object.values(FOOD_CATEGORIES)) {
    categoryTotals[cat] = {
      category: cat,
      wasteWeightKg: 0,
      wastePercentage: 0,
      estimatedCost: 0,
      recordsCount: 0
    };
  }

  let totalWasteKg = 0;

  for (const record of wasteRecords) {
    const cat = resolveFoodCategory(record.itemName || record.name, record.category);
    const target = categoryTotals[cat] || categoryTotals[FOOD_CATEGORIES.OTHER];

    const rawG = Number(record.measuredWeightG ?? record.measured_weight_g ?? record.weightGrams ?? 0);
    let recordKg = 0;
    if (!isNaN(rawG) && rawG > 0) {
      recordKg = rawG / 1000;
    } else {
      const parsedKg = standardizeWeightToKg(record.quantity, record.unit, record.weightGrams);
      if (parsedKg !== null && parsedKg > 0) recordKg = parsedKg;
    }

    target.wasteWeightKg += recordKg;
    target.estimatedCost += Number(record.estimatedCost || 0);
    target.recordsCount++;
    totalWasteKg += recordKg;
  }

  const breakdown = Object.values(categoryTotals).map(item => {
    const pct = totalWasteKg > 0 ? (item.wasteWeightKg / totalWasteKg) * 100 : 0;
    return {
      ...item,
      wasteWeightKg: Number(item.wasteWeightKg.toFixed(3)),
      wastePercentage: Number(pct.toFixed(1)),
      estimatedCost: Number(item.estimatedCost.toFixed(2))
    };
  });

  // Sort descending by wasteWeightKg
  breakdown.sort((a, b) => b.wasteWeightKg - a.wasteWeightKg);

  const highest = breakdown.find(c => c.wasteWeightKg > 0) || null;

  return {
    categories: breakdown,
    highestCategory: highest ? highest.category : null,
    totalWasteKg: Number(totalWasteKg.toFixed(3)),
    hasWasteData: totalWasteKg > 0
  };
}

/**
 * Computes time-series spending trends grouped by week or month.
 *
 * @param {Array} trips - Filtered shopping trips
 * @param {string} groupBy - 'week' or 'month'
 */
export function calculateSpendingTrends(trips = [], groupBy = 'week') {
  if (!Array.isArray(trips) || trips.length === 0) {
    return { periods: [], hasData: false, maxSpending: 0 };
  }

  const groups = new Map();

  for (const trip of trips) {
    const dateStr = normalizeDateString(trip.date || trip.createdAt);
    if (!dateStr) continue;

    let key;
    let label;

    if (groupBy === 'month') {
      key = dateStr.slice(0, 7); // YYYY-MM
      const [y, m] = key.split('-').map(Number);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      label = `${monthNames[m - 1]} ${y}`;
    } else {
      // Weekly grouping
      const d = new Date(`${dateStr}T12:00:00`);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const monday = new Date(d.setDate(diff));
      key = formatDateYMD(monday);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      label = `${monthNames[monday.getMonth()]} ${monday.getDate()}`;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        spending: 0,
        weightKg: 0,
        tripsCount: 0
      });
    }

    const g = groups.get(key);
    g.spending += Number(trip.totalAmountPaid || 0);
    g.weightKg += Number(trip.totalScaleWeightKg || 0);
    g.tripsCount++;
  }

  // Sort chronologically by key
  const sortedPeriods = Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  sortedPeriods.forEach(p => {
    p.spending = Number(p.spending.toFixed(2));
    p.weightKg = Number(p.weightKg.toFixed(2));
  });

  const maxSpending = sortedPeriods.reduce((max, p) => Math.max(max, p.spending), 0);

  return {
    periods: sortedPeriods,
    hasData: sortedPeriods.length > 0,
    maxSpending
  };
}

/**
 * Extracts and formats Phase 2 over-buying alerts for the "Categories to Watch" dashboard section.
 * Reuses calculateHistoricalWasteAnalysis and FOOD_CATEGORIES without competing rules.
 */
export function getCategoriesToWatch(options = {}) {
  const analysis = calculateHistoricalWasteAnalysis(options);
  const categories = analysis.categories || {};

  const watchList = [];

  for (const [catName, data] of Object.entries(categories)) {
    // Alert if waste classification is moderate or high, or has recurring waste
    if (data.wasteClassification === 'high' || data.wasteClassification === 'moderate' || data.cyclesWithWaste >= 2) {
      const isHigh = data.wasteClassification === 'high';
      const isModerate = data.wasteClassification === 'moderate';

      let status = isHigh ? 'High concern' : (isModerate ? 'Moderate concern' : 'Watch pattern');
      let recommendation = '';

      if (catName === FOOD_CATEGORIES.VEGETABLES) {
        recommendation = 'Review fresh vegetable quantities before the next grocery trip and plan vegetable-forward meals early.';
      } else if (catName === FOOD_CATEGORIES.MEAT) {
        recommendation = 'Consider portioning and freezing excess meat cuts immediately after shopping to prevent spoilage.';
      } else if (catName === FOOD_CATEGORIES.FRUITS) {
        recommendation = 'Buy ripe fruits for immediate consumption and slightly unripened items for later in the week.';
      } else if (catName === FOOD_CATEGORIES.SEAFOOD) {
        recommendation = 'Cook fresh seafood within 24–48 hours of purchase, or freeze immediately.';
      } else if (catName === FOOD_CATEGORIES.DAIRY) {
        recommendation = 'Verify expiration dates and prioritize opened containers before purchasing new cartons.';
      } else if (catName === FOOD_CATEGORIES.BAKERY) {
        recommendation = 'Freeze half a loaf if not consuming within 3–4 days to prevent mold growth.';
      } else {
        recommendation = 'Review pantry inventory before purchasing duplicate perishable items.';
      }

      watchList.push({
        category: catName,
        historicalWasteKg: data.totalWasteKg,
        historicalPurchaseKg: data.totalPurchaseKg,
        wasteRatioPercent: data.wasteRatioPercent ?? 0,
        cyclesWithWaste: data.cyclesWithWaste,
        status,
        level: isHigh ? 'high' : (isModerate ? 'moderate' : 'info'),
        recommendation
      });
    }
  }

  // Sort high concern first, then highest waste
  watchList.sort((a, b) => {
    if (a.level === 'high' && b.level !== 'high') return -1;
    if (b.level === 'high' && a.level !== 'high') return 1;
    return b.historicalWasteKg - a.historicalWasteKg;
  });

  return {
    items: watchList,
    hasAlerts: watchList.length > 0
  };
}

/**
 * Computes comparative performance between current and previous reporting periods.
 */
export function calculateHouseholdPerformance(currentMetrics, previousMetrics) {
  const currentWaste = currentMetrics.totalWasteKg;
  const previousWaste = previousMetrics.totalWasteKg;

  const currentSpend = currentMetrics.totalSpending;
  const previousSpend = previousMetrics.totalSpending;

  // Waste comparison requires valid previous data (> 0) to avoid division by zero or false claims
  const hasComparableWaste = previousWaste > 0 && currentWaste >= 0;
  let wasteChangePercent = null;
  let wasteReductionClaim = null;
  let isWasteImproved = false;

  if (hasComparableWaste) {
    wasteChangePercent = Number((((currentWaste - previousWaste) / previousWaste) * 100).toFixed(1));
    if (wasteChangePercent < 0) {
      isWasteImproved = true;
      wasteReductionClaim = `Food Waste Reduced by ${Math.abs(wasteChangePercent)}%`;
    } else if (wasteChangePercent > 0) {
      wasteReductionClaim = `Food Waste Increased by ${wasteChangePercent}%`;
    } else {
      wasteReductionClaim = 'Food Waste Remained Steady (0.0%)';
    }
  }

  // Spending comparison
  const hasComparableSpend = previousSpend > 0 && currentSpend >= 0;
  let spendChangePercent = null;
  if (hasComparableSpend) {
    spendChangePercent = Number((((currentSpend - previousSpend) / previousSpend) * 100).toFixed(1));
  }

  // Waste ratio comparison
  const currentRatio = currentMetrics.wasteRatio;
  const previousRatio = previousMetrics.wasteRatio;
  let ratioChangePercent = null;
  if (currentRatio !== null && previousRatio !== null && previousRatio > 0) {
    ratioChangePercent = Number((((currentRatio - previousRatio) / previousRatio) * 100).toFixed(1));
  }

  const hasSufficientData = hasComparableWaste || hasComparableSpend;

  return {
    hasSufficientData,
    hasComparableWaste,
    hasComparableSpend,
    wasteChangePercent,
    wasteReductionClaim,
    isWasteImproved,
    spendChangePercent,
    ratioChangePercent,
    performanceNotice: hasSufficientData
      ? null
      : 'Continue recording purchases and food waste to establish a reliable comparison.'
  };
}

/**
 * Generates data-driven, non-fabricated savings opportunities.
 * Strictly distinguishes actual spending, estimated waste cost, and conservation opportunities.
 */
export function generateSavingsOpportunities(insights) {
  const opportunities = [];
  const { overview, categoryBreakdown, categoriesToWatch, performance } = insights;

  // 1. Highest waste category insight
  if (categoryBreakdown.highestCategory && categoryBreakdown.totalWasteKg > 0) {
    const highest = categoryBreakdown.categories.find(c => c.category === categoryBreakdown.highestCategory);
    if (highest && highest.wastePercentage >= 25) {
      opportunities.push({
        type: 'category_spoilage',
        icon: '🥬',
        title: `${highest.category} Generate the Most Waste`,
        description: `${highest.category} account for ${highest.wastePercentage}% (${highest.wasteWeightKg} kg) of your recorded food waste. ${highest.estimatedCost > 0 ? `Estimated waste cost: ${formatPeso(highest.estimatedCost)}.` : ''} Planning recipes centered on this category right after grocery shopping can reduce spoilage.`,
        action: 'Review fresh produce quantities before the next shopping trip.'
      });
    }
  }

  // 2. Spending increase notice
  if (performance.spendChangePercent !== null && performance.spendChangePercent > 10) {
    opportunities.push({
      type: 'spending_increase',
      icon: '📈',
      title: `Grocery Spending Up by ${performance.spendChangePercent}%`,
      description: `Your household spent ${formatPeso(overview.totalSpending)} this period, compared with ${formatPeso(insights.previousSpending)} in the prior comparable period.`,
      action: 'Check your shopping list against pantry inventory to avoid duplicate purchases.'
    });
  }

  // 3. Waste reduction celebration
  if (performance.isWasteImproved && performance.wasteReductionClaim) {
    opportunities.push({
      type: 'waste_reduction',
      icon: '🎉',
      title: performance.wasteReductionClaim,
      description: `Recorded food waste dropped to ${overview.totalWasteWeightKg} kg (from ${insights.previousWasteWeightKg} kg). Your meal planning and portion scaling habits are actively preventing spoilage.`,
      action: 'Maintain current meal preparation routines.'
    });
  }

  // 4. Over-buying alert insight from Phase 2
  if (categoriesToWatch.hasAlerts) {
    const topAlert = categoriesToWatch.items[0];
    opportunities.push({
      type: 'overbuying_pattern',
      icon: '⚠️',
      title: `Watch List: ${topAlert.category} (${topAlert.status})`,
      description: `Historical waste ratio is ${topAlert.wasteRatioPercent}% across ${topAlert.cyclesWithWaste} recorded cycles.`,
      action: topAlert.recommendation
    });
  }

  // 5. Cost-of-waste notice if available
  if (overview.totalWasteCost > 0) {
    opportunities.push({
      type: 'waste_cost_awareness',
      icon: '💡',
      title: `Tracked Waste Valuation: ${formatPeso(overview.totalWasteCost)}`,
      description: `Based on logged unit costs, wasted food accounted for an estimated ${formatPeso(overview.totalWasteCost)} during this period. Minimizing over-buying directly preserves household budget.`,
      action: 'Use Cook Mode dynamic scaling to avoid oversized portions.'
    });
  }

  return opportunities;
}

/**
 * MASTER INSIGHTS CALCULATOR
 * Consolidates all household grocery insights for the chosen reporting period.
 *
 * @param {Object} options
 * @param {Array} [options.trips] - Shopping trips (default from storage)
 * @param {Array} [options.groceryPurchases] - Grocery line items (default from storage)
 * @param {Array} [options.wasteRecords] - Food waste records (default from storage)
 * @param {string} [options.period] - One of REPORTING_PERIODS
 * @param {Date|string} [options.referenceDate] - Reference date
 * @param {number} [options.householdMembers] - Current household members
 * @param {Object} [options.customRange] - Optional custom { startDate, endDate }
 */
export function calculateHouseholdInsights(options = {}) {
  const {
    trips = getShoppingTrips(),
    groceryPurchases = getGroceryItems(),
    wasteRecords = getFoodWasteRecords(),
    period = REPORTING_PERIODS.LAST_30_DAYS,
    referenceDate = new Date(),
    householdMembers = getHouseholdMembers(),
    customRange = null
  } = options;

  // 1. Resolve date boundaries
  const dateRange = customRange && customRange.startDate && customRange.endDate
    ? {
        period: 'custom',
        label: 'Custom Range',
        startDate: customRange.startDate,
        endDate: customRange.endDate,
        previousStartDate: null,
        previousEndDate: null
      }
    : getDateRangeForPeriod(period, referenceDate);

  const { startDate, endDate, previousStartDate, previousEndDate } = dateRange;

  // 2. Filter records strictly by their appropriate dates:
  // - Spending & Grocery Weight strictly use purchase date
  // - Food Waste strictly uses waste log date
  const inRange = (d, start, end) => {
    if (!d || !start || !end) return false;
    const s = normalizeDateString(d);
    return s >= start && s <= end;
  };

  const periodTrips = trips.filter(t => inRange(t.date || t.createdAt, startDate, endDate));
  const periodItems = groceryPurchases.filter(i => inRange(i.purchaseDate || i.date || i.createdAt, startDate, endDate));
  const periodWaste = wasteRecords.filter(w => inRange(w.date || w.createdAt, startDate, endDate));

  // Previous comparable period records
  const prevTrips = previousStartDate && previousEndDate
    ? trips.filter(t => inRange(t.date || t.createdAt, previousStartDate, previousEndDate))
    : [];
  const prevItems = previousStartDate && previousEndDate
    ? groceryPurchases.filter(i => inRange(i.purchaseDate || i.date || i.createdAt, previousStartDate, previousEndDate))
    : [];
  const prevWaste = previousStartDate && previousEndDate
    ? wasteRecords.filter(w => inRange(w.date || w.createdAt, previousStartDate, previousEndDate))
    : [];

  // 3. Primary Metrics Calculations
  // 3.1 Grocery Spending (Avoid duplicate receipts; sum trip totalAmountPaid)
  const totalSpending = periodTrips.reduce((sum, t) => sum + Number(t.totalAmountPaid || 0), 0);
  const previousSpending = prevTrips.reduce((sum, t) => sum + Number(t.totalAmountPaid || 0), 0);

  // 3.2 Grocery Weight
  const purchaseWeightResult = calculateNormalizedPurchaseWeight(periodTrips, periodItems);
  const totalPurchasedWeightKg = purchaseWeightResult.totalWeightKg;

  const prevPurchaseWeightResult = calculateNormalizedPurchaseWeight(prevTrips, prevItems);
  const previousPurchasedWeightKg = prevPurchaseWeightResult.totalWeightKg;

  // 3.3 Food Waste
  const wasteResult = calculateNormalizedFoodWaste(periodWaste);
  const totalWasteWeightKg = wasteResult.totalWasteKg;
  const totalWasteCost = wasteResult.totalWasteCost;

  const prevWasteResult = calculateNormalizedFoodWaste(prevWaste);
  const previousWasteWeightKg = prevWasteResult.totalWasteKg;

  // 3.4 Waste-to-Purchase Ratio
  let wasteRatio = null;
  let wasteRatioFormatted = '—';
  if (totalPurchasedWeightKg > 0 && totalWasteWeightKg >= 0) {
    const rawRatio = (totalWasteWeightKg / totalPurchasedWeightKg) * 100;
    wasteRatio = Math.round((rawRatio + 1e-6) * 100) / 100;
    wasteRatioFormatted = `${(Math.round((rawRatio + 1e-6) * 10) / 10).toFixed(1)}%`;
  }

  let prevWasteRatio = null;
  if (previousPurchasedWeightKg > 0 && previousWasteWeightKg >= 0) {
    const rawPrevRatio = (previousWasteWeightKg / previousPurchasedWeightKg) * 100;
    prevWasteRatio = Math.round((rawPrevRatio + 1e-6) * 100) / 100;
  }

  // 3.5 Household Size Context & Per-Member Metrics
  const members = Math.max(1, Number(householdMembers || 4));
  const spendingPerMember = Number((totalSpending / members).toFixed(2));
  const purchaseWeightPerMember = totalPurchasedWeightKg > 0 ? Number((totalPurchasedWeightKg / members).toFixed(2)) : 0;
  const wasteWeightPerMember = totalWasteWeightKg > 0 ? Number((totalWasteWeightKg / members).toFixed(2)) : 0;

  // 4. Spending Trends (time series)
  const trends = calculateSpendingTrends(periodTrips, period === REPORTING_PERIODS.THIS_MONTH || period === REPORTING_PERIODS.LAST_MONTH ? 'week' : 'week');

  // 5. Food-Waste Category Breakdown
  const categoryBreakdown = calculateWasteCategoryBreakdown(periodWaste);

  // 6. Categories to Watch (reusing Phase 2 historical analysis)
  const categoriesToWatch = getCategoriesToWatch({
    purchases: groceryPurchases,
    wasteRecords,
    householdMembers: members
  });

  // 7. Household Food-Waste Performance
  const performance = calculateHouseholdPerformance(
    { totalWasteKg: totalWasteWeightKg, totalSpending, wasteRatio },
    { totalWasteKg: previousWasteWeightKg, totalSpending: previousSpending, wasteRatio: prevWasteRatio }
  );

  const baseInsights = {
    dateRange,
    householdMembers: members,
    overview: {
      householdMembers: members,
      totalSpending,
      totalSpendingFormatted: formatPeso(totalSpending),
      totalPurchasedWeightKg,
      isWeightIncomplete: purchaseWeightResult.hasIncompleteWeights,
      unweighedItemsCount: purchaseWeightResult.unweighedItemsCount,
      totalWasteWeightKg,
      wasteRatio,
      wasteRatioFormatted,
      totalWasteCost,
      totalWasteCostFormatted: formatPeso(totalWasteCost),
      spendingPerMember,
      spendingPerMemberFormatted: formatPeso(spendingPerMember),
      purchaseWeightPerMember,
      wasteWeightPerMember,
      tripsCount: periodTrips.length,
      wasteRecordsCount: periodWaste.length
    },
    previousSpending,
    previousWasteWeightKg,
    trends,
    categoryBreakdown,
    categoriesToWatch,
    performance
  };

  // 8. Actionable Savings Opportunities
  baseInsights.savingsOpportunities = generateSavingsOpportunities(baseInsights);

  return baseInsights;
}
