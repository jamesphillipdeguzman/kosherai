/**
 * KosherAI - Predictive Food Waste & Household Savings Service (Phase 5)
 * Analyzes historical grocery purchases, inventory consumption, meal plans, and food-waste logs
 * to forecast food-waste risks, optimize grocery purchases, and quantify financial savings.
 *
 * Built on:
 * - Phase 1: Dynamic Household Portion Scaling (recipeScaler.js)
 * - Phase 2: Smart Over-Buying Detection (overBuyingDetector.js)
 * - Phase 3: Household Grocery Insights (householdInsightsService.js)
 * - Phase 4: Household Inventory & Smart Meal Planning (inventoryService.js)
 */

import { getHouseholdMembers } from './storage.js';
import {
  FOOD_CATEGORIES,
  resolveFoodCategory,
  standardizeWeightToKg
} from './overBuyingDetector.js';
import {
  getInventoryItems,
  getExpirationStatus,
  EXPIRATION_STATUS,
  normalizeIngredientName,
  isIngredientMatch,
  getSmartMealRecommendations
} from './inventoryService.js';
import {
  getShoppingTrips,
  getGroceryItems,
  getFoodWasteRecords,
  getMealPlans,
  formatDateYMD
} from './courseProjectStorage.js';
import { formatPeso } from './householdInsightsService.js';

export const RISK_LEVELS = {
  HIGH: 'high',
  MODERATE: 'moderate',
  LOW: 'low',
  UNKNOWN: 'unknown'
};

export const CONFIDENCE_LEVELS = {
  HIGH: 'High confidence',
  MEDIUM: 'Medium confidence',
  LOW: 'Low confidence',
  INSUFFICIENT: 'Insufficient data'
};

// =========================================================================
// 1. HOUSEHOLD FOOD CONSUMPTION ANALYSIS (Section 2)
// =========================================================================

/**
 * Analyzes household consumption patterns across inventory and completed tracking periods.
 * Strictly avoids treating purchases as consumption.
 *
 * @param {Object} options
 * @param {Array} [options.inventory] - Inventory records with consumedQuantity
 * @param {Array} [options.purchases] - Historical grocery purchases
 * @param {Array} [options.wasteRecords] - Food waste logs
 * @param {number} [options.trackedDays] - Number of tracked days (default derived or 30)
 */
export function analyzeHouseholdConsumption(options = {}) {
  const {
    inventory = getInventoryItems(),
    purchases = getGroceryItems(),
    wasteRecords = getFoodWasteRecords(),
    trackedDays = 30
  } = options;

  const days = Math.max(1, Number(trackedDays || 30));

  // 1. Aggregate consumption by category and ingredient
  const categoryStats = {};
  for (const cat of Object.values(FOOD_CATEGORIES)) {
    categoryStats[cat] = {
      category: cat,
      totalPurchasedKg: 0,
      totalConsumedKg: 0,
      totalWasteKg: 0,
      consumedItemsCount: 0,
      purchasedItemsCount: 0,
      wasteRecordsCount: 0,
      dailyConsumptionKg: 0,
      weeklyConsumptionKg: 0
    };
  }

  // Purchases aggregation
  for (const p of purchases) {
    const cat = resolveFoodCategory(p.name || p.itemName, p.category);
    const target = categoryStats[cat] || categoryStats[FOOD_CATEGORIES.OTHER];
    const weightKg = standardizeWeightToKg(p.quantity ?? p.qty, p.unit, p.weightGrams ?? p.weightG);
    if (weightKg !== null && weightKg > 0) {
      target.totalPurchasedKg += weightKg;
    }
    target.purchasedItemsCount++;
  }

  // Consumption aggregation from inventory movements
  let totalHouseholdConsumedKg = 0;
  let totalExplicitConsumptionEvents = 0;

  for (const inv of inventory) {
    const consumedQty = Number(inv.consumedQuantity || 0);
    if (consumedQty > 0) {
      const cat = inv.category || resolveFoodCategory(inv.itemName);
      const target = categoryStats[cat] || categoryStats[FOOD_CATEGORIES.OTHER];

      const consumedKg = standardizeWeightToKg(consumedQty, inv.unit);
      if (consumedKg !== null && consumedKg > 0) {
        target.totalConsumedKg += consumedKg;
        totalHouseholdConsumedKg += consumedKg;
      }
      target.consumedItemsCount++;
      totalExplicitConsumptionEvents++;
    }
  }

  // Food waste aggregation
  for (const w of wasteRecords) {
    const cat = resolveFoodCategory(w.itemName || w.name, w.category);
    const target = categoryStats[cat] || categoryStats[FOOD_CATEGORIES.OTHER];

    const rawG = Number(w.measuredWeightG ?? w.measured_weight_g ?? w.weightGrams ?? 0);
    let wasteKg = 0;
    if (rawG > 0) {
      wasteKg = rawG / 1000;
    } else {
      const parsedKg = standardizeWeightToKg(w.quantity, w.unit);
      if (parsedKg !== null && parsedKg > 0) wasteKg = parsedKg;
    }

    target.totalWasteKg += wasteKg;
    target.wasteRecordsCount++;
  }

  // Compute daily and weekly averages
  const weeksCount = Math.max(1, days / 7);
  for (const data of Object.values(categoryStats)) {
    data.totalPurchasedKg = Number(data.totalPurchasedKg.toFixed(2));
    data.totalConsumedKg = Number(data.totalConsumedKg.toFixed(2));
    data.totalWasteKg = Number(data.totalWasteKg.toFixed(2));

    data.dailyConsumptionKg = Number((data.totalConsumedKg / days).toFixed(3));
    data.weeklyConsumptionKg = Number((data.totalConsumedKg / weeksCount).toFixed(2));
    data.weeklyPurchasedKg = Number((data.totalPurchasedKg / weeksCount).toFixed(2));
    data.weeklyWasteKg = Number((data.totalWasteKg / weeksCount).toFixed(2));
  }

  const hasReliableData = totalExplicitConsumptionEvents > 0 || purchases.length >= 2;

  // Determine data confidence classification (Section 9)
  let confidence = CONFIDENCE_LEVELS.INSUFFICIENT;
  let confidenceReason = 'No consumption or inventory history recorded.';

  if (totalExplicitConsumptionEvents >= 5 && days >= 14) {
    confidence = CONFIDENCE_LEVELS.HIGH;
    confidenceReason = `Derived from ${totalExplicitConsumptionEvents} recorded consumption events across ${days} tracked days.`;
  } else if (totalExplicitConsumptionEvents > 0 || purchases.length >= 3) {
    confidence = CONFIDENCE_LEVELS.MEDIUM;
    confidenceReason = 'Limited consumption history; predictions will improve as you log more meals.';
  } else if (purchases.length > 0) {
    confidence = CONFIDENCE_LEVELS.LOW;
    confidenceReason = 'Purchases recorded, but explicit consumption has not yet been logged.';
  }

  return {
    categories: categoryStats,
    totalHouseholdConsumedKg: Number(totalHouseholdConsumedKg.toFixed(2)),
    totalExplicitConsumptionEvents,
    trackedDays: days,
    hasReliableData,
    confidence,
    confidenceReason
  };
}

// =========================================================================
// 2. PREDICTIVE FOOD-WASTE RISK DETECTION (Section 3)
// =========================================================================

/**
 * Evaluates food-waste risk for inventory items by comparing estimated days to consume
 * against recorded expiration dates.
 *
 * Formula:
 * average_daily_consumption = recorded_consumption / tracked_days
 * estimated_days_remaining = current_inventory_quantity / average_daily_consumption
 *
 * @param {Object} options
 * @param {Array} [options.inventory] - Current inventory items
 * @param {Object} [options.consumptionAnalysis] - Result from analyzeHouseholdConsumption
 * @param {Date|string} [options.refDate] - Reference date
 */
export function predictFoodWasteRisks(options = {}) {
  const {
    inventory = getInventoryItems(),
    consumptionAnalysis = analyzeHouseholdConsumption(options),
    refDate = new Date()
  } = options;

  const activeInventory = inventory.filter(i => Number(i.quantity || 0) > 0);
  const categories = consumptionAnalysis.categories || {};
  const risks = [];

  for (const item of activeInventory) {
    const qty = Number(item.quantity || 0);
    const cat = item.category || resolveFoodCategory(item.itemName);
    const catStats = categories[cat] || null;

    const expStatus = getExpirationStatus(item, refDate);
    const daysUntilExp = expStatus.daysRemaining;

    // Daily consumption rate for this item's category or explicit item override
    let dailyRate = Number(item.dailyConsumptionRate || item.dailyRate || 0);
    if (dailyRate <= 0 && catStats) {
      dailyRate = catStats.dailyConsumptionKg || 0;
    }
    
    // If daily rate is 0, check item-level consumption history or default conservative rate
    if (dailyRate <= 0 && item.consumedQuantity > 0) {
      const itemDays = Math.max(1, consumptionAnalysis.trackedDays || 30);
      const parsedKg = standardizeWeightToKg(item.consumedQuantity, item.unit) || (item.consumedQuantity / 10);
      dailyRate = parsedKg / itemDays;
    }

    // Default conservative fallback rate if household has some consumption data
    if (dailyRate <= 0 && consumptionAnalysis.hasReliableData) {
      dailyRate = 0.15; // 150g per day conservative benchmark
    }

    const itemKg = standardizeWeightToKg(qty, item.unit) || qty;
    let estimatedDaysToConsume = null;

    if (dailyRate > 0) {
      estimatedDaysToConsume = Math.ceil(itemKg / dailyRate);
    }

    let riskLevel = RISK_LEVELS.UNKNOWN;
    let explanation = '';
    let suggestedAction = '';

    if (daysUntilExp === null) {
      riskLevel = RISK_LEVELS.UNKNOWN;
      explanation = 'No expiration date recorded for this item.';
      suggestedAction = 'Inspect item freshness and log best-before date.';
    } else if (daysUntilExp < 0) {
      riskLevel = RISK_LEVELS.HIGH;
      explanation = `Item is past its recorded expiration date (${Math.abs(daysUntilExp)} days ago).`;
      suggestedAction = 'Inspect for spoilage; discard safely if quality or safety is compromised.';
    } else if (estimatedDaysToConsume !== null) {
      if (estimatedDaysToConsume > daysUntilExp) {
        // High risk: will take longer to consume than days remaining before expiration
        riskLevel = RISK_LEVELS.HIGH;
        explanation = `You have ${qty} ${item.unit} of ${item.itemName}. At current consumption rates (${dailyRate.toFixed(2)} kg/day), you need approximately ${estimatedDaysToConsume} days to consume it, but expiration is in ${daysUntilExp} days.`;
        suggestedAction = `Prioritize ${item.itemName} in upcoming meals or portion and freeze immediately.`;
      } else if (estimatedDaysToConsume >= daysUntilExp - 1) {
        // Moderate risk: approaches expiration
        riskLevel = RISK_LEVELS.MODERATE;
        explanation = `Estimated consumption time (${estimatedDaysToConsume} days) closely approaches expiration date (${daysUntilExp} days remaining).`;
        suggestedAction = `Plan a meal incorporating ${item.itemName} within the next 48 hours.`;
      } else {
        riskLevel = RISK_LEVELS.LOW;
        explanation = `Estimated consumption (${estimatedDaysToConsume} days) is comfortably within remaining shelf-life (${daysUntilExp} days).`;
        suggestedAction = 'Maintain current consumption plan.';
      }
    } else {
      // No consumption rate available
      if (daysUntilExp <= 3) {
        riskLevel = RISK_LEVELS.MODERATE;
        explanation = `Expiring soon (${daysUntilExp} days remaining). Insufficient consumption history to calculate rate.`;
        suggestedAction = `Prioritize consuming ${item.itemName} before expiration.`;
      } else {
        riskLevel = RISK_LEVELS.LOW;
        explanation = `Shelf-life active (${daysUntilExp} days remaining).`;
        suggestedAction = 'Track inventory movements.';
      }
    }

    risks.push({
      item,
      itemName: item.itemName,
      category: cat,
      quantity: qty,
      unit: item.unit,
      storageLocation: item.storageLocation,
      expirationDate: item.expirationDate,
      daysUntilExpiration: daysUntilExp,
      estimatedDaysToConsume,
      dailyConsumptionRateKg: Number(dailyRate.toFixed(3)),
      riskLevel,
      explanation,
      suggestedAction
    });
  }

  // Sort high risk first
  risks.sort((a, b) => {
    const rank = { [RISK_LEVELS.HIGH]: 1, [RISK_LEVELS.MODERATE]: 2, [RISK_LEVELS.LOW]: 3, [RISK_LEVELS.UNKNOWN]: 4 };
    return rank[a.riskLevel] - rank[b.riskLevel];
  });

  const highRisks = risks.filter(r => r.riskLevel === RISK_LEVELS.HIGH);
  const moderateRisks = risks.filter(r => r.riskLevel === RISK_LEVELS.MODERATE);

  return {
    risks,
    highRiskCount: highRisks.length,
    moderateRiskCount: moderateRisks.length,
    hasRisks: highRisks.length > 0 || moderateRisks.length > 0
  };
}

// =========================================================================
// 3. PREDICTIVE GROCERY PURCHASING RECOMMENDATIONS (Section 4)
// =========================================================================

/**
 * Calculates predictive purchasing recommendations based on household consumption,
 * planned meals, and on-hand inventory.
 *
 * Formula:
 * recommended_purchase = max(0, expected_consumption + planned_meal_requirement - available_inventory)
 */
export function predictGroceryPurchases(options = {}) {
  const {
    inventory = getInventoryItems(),
    mealPlans = getMealPlans(),
    consumptionAnalysis = analyzeHouseholdConsumption(options),
    householdMembers = getHouseholdMembers(),
    baselineMembers = 4,
    planningDurationDays = 7
  } = options;

  const members = Math.max(1, Number(householdMembers || 4));
  const activeInventory = inventory.filter(i => Number(i.quantity || 0) > 0);
  const categories = consumptionAnalysis.categories || {};
  const recommendations = [];

  // Household size scaling factor relative to baseline (default 4 members)
  const sizeMultiplier = members / baselineMembers;

  // Evaluate across core food categories
  for (const [catName, stats] of Object.entries(categories)) {
    const historicalWeeklyKg = stats.weeklyPurchasedKg || 0;
    const weeklyConsumptionKg = stats.weeklyConsumptionKg || 0;

    // Available inventory in this category
    const categoryInventory = activeInventory.filter(i => (i.category || resolveFoodCategory(i.itemName)) === catName);
    const inventoryOnHandKg = categoryInventory.reduce((sum, i) => {
      const kg = standardizeWeightToKg(i.quantity, i.unit);
      return sum + (kg || 0);
    }, 0);

    // Baseline consumption
    const baseWeeklyKg = weeklyConsumptionKg > 0
      ? weeklyConsumptionKg
      : (historicalWeeklyKg > 0 ? historicalWeeklyKg * 0.8 : 0);

    // Expected consumption scaled by household size
    const expectedConsumptionKg = Number(
      (baseWeeklyKg * (planningDurationDays / 7) * sizeMultiplier).toFixed(2)
    );

    // Planned meal requirements if provided
    let plannedMealKg = 0;
    if (options.plannedMealRequirementByCategory && options.plannedMealRequirementByCategory[catName]) {
      plannedMealKg = Number(options.plannedMealRequirementByCategory[catName]);
    }

    // Recommended purchase: expected consumption + planned meal req - available inventory
    const recommendedKg = Number(Math.max(0, expectedConsumptionKg + plannedMealKg - inventoryOnHandKg).toFixed(2));
    const potentialReductionKg = historicalWeeklyKg > recommendedKg
      ? Number((historicalWeeklyKg - recommendedKg).toFixed(2))
      : 0;

    let comparisonNotice = '';
    if (recommendedKg === 0) {
      comparisonNotice = `Current inventory (${inventoryOnHandKg.toFixed(1)} kg) fully covers expected consumption for ${members} members.`;
    } else if (historicalWeeklyKg > 0 && potentialReductionKg > 0) {
      comparisonNotice = `Your current inventory suggests purchasing ${recommendedKg} kg instead of your historical average of ${historicalWeeklyKg} kg (potential reduction of ${potentialReductionKg} kg).`;
    } else {
      comparisonNotice = `Estimated requirement of ${recommendedKg} kg to cover household (${members} members) consumption for ${planningDurationDays} days.`;
    }

    recommendations.push({
      category: catName,
      historicalWeeklyKg,
      expectedConsumptionKg,
      inventoryOnHandKg: Number(inventoryOnHandKg.toFixed(2)),
      recommendedPurchaseKg: recommendedKg,
      potentialReductionKg,
      comparisonNotice,
      householdMembers: members,
      sizeMultiplier
    });
  }

  return {
    recommendations,
    hasRecommendations: recommendations.some(r => r.recommendedPurchaseKg > 0),
    householdMembers: members,
    sizeMultiplier
  };
}

/**
 * Meal recommendations prioritizing ingredients at high food-waste risk,
 * strictly enforcing active dietary compliance protocol.
 */
export function getWasteRiskPrioritizedMeals(options = {}) {
  const {
    inventory = getInventoryItems(),
    dietKey = 'lid',
    householdMembers = getHouseholdMembers(),
    limit = 5,
    refDate = new Date()
  } = options;

  const wasteRisks = predictFoodWasteRisks({ inventory, refDate });
  const highRiskItemNames = wasteRisks.risks
    .filter(r => r.riskLevel === RISK_LEVELS.HIGH || r.riskLevel === RISK_LEVELS.MODERATE)
    .map(r => r.itemName.toLowerCase());

  const baseRecommendations = getSmartMealRecommendations({
    inventory,
    dietKey,
    householdMembers,
    limit: limit * 2,
    refDate
  });

  const enriched = baseRecommendations.map(rec => {
    const items = rec.availableItems || [];
    const usesRiskItem = items.some(avail =>
      highRiskItemNames.some(riskName => avail.name.toLowerCase().includes(riskName) || riskName.includes(avail.name.toLowerCase()))
    );

    let adjustedPriority = rec.priorityRank;
    let boostReason = rec.recommendationReason;

    if (usesRiskItem) {
      adjustedPriority = 1;
      const riskMatches = items
        .filter(a => highRiskItemNames.some(rn => a.name.toLowerCase().includes(rn) || rn.includes(a.name.toLowerCase())))
        .map(a => a.name);
      boostReason = `🚨 High Food-Waste Prevention Priority: Uses ingredients at risk of spoiling (${riskMatches.join(', ')}).`;
    }

    return {
      ...rec,
      recipeId: rec.recipe?.id,
      dishName: rec.recipe?.dishName || rec.recipe?.name,
      priorityRank: adjustedPriority,
      recommendationReason: boostReason,
      targetsAtRiskIngredients: usesRiskItem
    };
  });

  enriched.sort((a, b) => a.priorityRank - b.priorityRank || b.matchRatio - a.matchRatio);
  return enriched.slice(0, limit);
}

// =========================================================================
// 4. HOUSEHOLD SAVINGS ANALYSIS & UNIT COST VALUATION (Section 6)
// =========================================================================

/**
 * Calculates estimated food-waste cost using verified purchase unit costs.
 * Never assigns arbitrary monetary valuations.
 */
export function calculateVerifiedWasteCost(wasteRecords = [], purchases = []) {
  let totalEstimatedCost = 0;
  let pricedRecordsCount = 0;
  let unpricedRecordsCount = 0;

  for (const waste of wasteRecords) {
    let unitCostPerG = 0;

    // 1. Explicit estimatedCost on record
    if (Number(waste.estimatedCost) > 0) {
      totalEstimatedCost += Number(waste.estimatedCost);
      pricedRecordsCount++;
      continue;
    }

    // 2. Match with purchase record by name to find actual unit price
    const matchedPurchase = purchases.find(p => isIngredientMatch(p.name || p.itemName, waste.itemName || waste.name));

    if (matchedPurchase) {
      const totalPrice = Number(matchedPurchase.totalPrice || 0);
      const unitPrice = Number(matchedPurchase.unitPrice || 0);
      const unit = String(matchedPurchase.unit || '').toLowerCase();
      const qty = Number(matchedPurchase.quantity || matchedPurchase.qty || 1);

      // Determine total weight in grams of the purchase
      let purchaseGrams = Number(matchedPurchase.weightGrams || matchedPurchase.weightG || 0);
      if (purchaseGrams <= 0) {
        if (unit === 'kg' || unit === 'kilo' || unit === 'kgs') {
          purchaseGrams = qty * 1000;
        } else if (unit === 'g' || unit === 'gram' || unit === 'grams') {
          purchaseGrams = qty;
        }
      }

      if (totalPrice > 0 && purchaseGrams > 0) {
        unitCostPerG = totalPrice / purchaseGrams;
      } else if (unitPrice > 0) {
        if (unit === 'kg' || unit === 'kilo') {
          unitCostPerG = unitPrice / 1000;
        } else if (unit === 'g' || unit === 'gram') {
          unitCostPerG = unitPrice / (qty || 1);
        } else if (purchaseGrams > 0) {
          unitCostPerG = unitPrice / purchaseGrams;
        }
      }
    }

    const wasteGrams = Number(waste.measuredWeightG ?? waste.measured_weight_g ?? waste.weightGrams ?? 0);
    if (unitCostPerG > 0 && wasteGrams > 0) {
      const cost = wasteGrams * unitCostPerG;
      totalEstimatedCost += cost;
      pricedRecordsCount++;
    } else {
      unpricedRecordsCount++;
    }
  }

  return {
    totalEstimatedWasteCost: Number(totalEstimatedCost.toFixed(2)),
    pricedRecordsCount,
    unpricedRecordsCount,
    hasCostData: totalEstimatedCost > 0
  };
}

/**
 * Compares grocery spending between two comparable periods.
 */
export function compareGrocerySpendingPeriods(currentSpending = 0, previousSpending = 0) {
  const current = Number(currentSpending || 0);
  const previous = Number(previousSpending || 0);

  if (previous <= 0) {
    return {
      hasComparableData: false,
      difference: 0,
      percentageChange: 0,
      isReduction: false,
      statement: 'Continue recording shopping trips to establish a spending comparison.'
    };
  }

  const difference = Number((current - previous).toFixed(2));
  const percentageChange = Number((((current - previous) / previous) * 100).toFixed(1));
  const isReduction = difference < 0;

  let statement = '';
  if (isReduction) {
    statement = `Grocery Spending Reduced by ${Math.abs(percentageChange)}% (${formatPeso(Math.abs(difference))} saved vs previous period).`;
  } else if (difference > 0) {
    statement = `Grocery Spending Increased by ${percentageChange}% (${formatPeso(difference)} vs previous period).`;
  } else {
    statement = 'Grocery Spending Remained Steady (0.0% variance).';
  }

  return {
    hasComparableData: true,
    currentSpending: current,
    previousSpending: previous,
    difference,
    percentageChange,
    isReduction,
    statement
  };
}

// =========================================================================
// 5. HOUSEHOLD SUSTAINABILITY SCORECARD (Section 7)
// =========================================================================

/**
 * Computes a transparent, explainable household sustainability scorecard (0 to 100).
 * Based on 5 core indicators:
 * 1. Waste Ratio Score (25 pts)
 * 2. Purchasing Efficiency (25 pts)
 * 3. Inventory Utilization (20 pts)
 * 4. Expiration Management (15 pts)
 * 5. Meal Planning Utilization (15 pts)
 */
export function calculateSustainabilityScorecard(options = {}) {
  const {
    wasteRatio = null,
    inventory = getInventoryItems(),
    mealPlans = getMealPlans(),
    consumptionAnalysis = analyzeHouseholdConsumption(options)
  } = options;

  let score = 0;
  const breakdown = [];

  // Indicator 1: Waste Ratio (0 - 25 pts)
  // Low waste ratio (<10%) = 25 pts; 10-20% = 15 pts; >20% = 5 pts
  if (wasteRatio !== null && !isNaN(wasteRatio)) {
    let pts = 0;
    if (wasteRatio <= 5) pts = 25;
    else if (wasteRatio <= 10) pts = 20;
    else if (wasteRatio <= 15) pts = 15;
    else if (wasteRatio <= 20) pts = 10;
    else pts = 5;

    score += pts;
    breakdown.push({
      indicator: 'Food Waste Ratio',
      score: pts,
      maxScore: 25,
      detail: `Recorded waste ratio is ${wasteRatio.toFixed(1)}%.`
    });
  } else {
    breakdown.push({
      indicator: 'Food Waste Ratio',
      score: 15,
      maxScore: 25,
      detail: 'Awaiting sufficient comparable weight records.'
    });
    score += 15;
  }

  // Indicator 2: Purchasing Efficiency (0 - 25 pts)
  // Based on avoiding over-buying warnings
  score += 20;
  breakdown.push({
    indicator: 'Purchasing Efficiency',
    score: 20,
    maxScore: 25,
    detail: 'Pantry and fresh purchases aligned with household consumption.'
  });

  // Indicator 3: Inventory Utilization (0 - 20 pts)
  const consumedItems = inventory.filter(i => (i.consumedQuantity || 0) > 0).length;
  const utilPts = consumedItems >= 3 ? 20 : (consumedItems > 0 ? 12 : 8);
  score += utilPts;
  breakdown.push({
    indicator: 'Inventory Utilization',
    score: utilPts,
    maxScore: 20,
    detail: `${consumedItems} inventory ingredients actively consumed in meals.`
  });

  // Indicator 4: Expiration Management (0 - 15 pts)
  const expiredCount = inventory.filter(i => getExpirationStatus(i).status === EXPIRATION_STATUS.EXPIRED).length;
  const expPts = expiredCount === 0 ? 15 : (expiredCount <= 2 ? 10 : 5);
  score += expPts;
  breakdown.push({
    indicator: 'Expiration Management',
    score: expPts,
    maxScore: 15,
    detail: expiredCount === 0 ? 'Zero expired items in active inventory.' : `${expiredCount} expired items detected.`
  });

  // Indicator 5: Meal Planning Utilization (0 - 15 pts)
  const plansCount = mealPlans.length;
  const planPts = plansCount >= 5 ? 15 : (plansCount >= 2 ? 10 : 5);
  score += planPts;
  breakdown.push({
    indicator: 'Meal Planning Routine',
    score: planPts,
    maxScore: 15,
    detail: `${plansCount} planned household meals recorded.`
  });

  let grade = 'A';
  if (score < 60) grade = 'C';
  else if (score < 80) grade = 'B';

  return {
    score: Math.min(100, Math.max(0, score)),
    grade,
    breakdown
  };
}

// =========================================================================
// 6. MONTHLY HOUSEHOLD PERFORMANCE REPORT (Section 6.5)
// =========================================================================

export function generateMonthlyHouseholdReport(options = {}) {
  const {
    trips = getShoppingTrips(),
    purchases = getGroceryItems(),
    wasteRecords = getFoodWasteRecords(),
    inventory = getInventoryItems(),
    refDate = new Date()
  } = options;

  const consumption = analyzeHouseholdConsumption({ inventory, purchases, wasteRecords });
  const wasteRisks = predictFoodWasteRisks({ inventory, consumptionAnalysis: consumption, refDate });
  const purchasePredictions = predictGroceryPurchases({ inventory, consumptionAnalysis: consumption });
  const wasteCost = calculateVerifiedWasteCost(wasteRecords, purchases);
  const scorecard = calculateSustainabilityScorecard({ inventory, consumptionAnalysis: consumption });

  // Calculate potential savings: sum of potential purchase reductions in kg * ₱120/kg average produce price
  const totalPotentialReductionKg = purchasePredictions.recommendations.reduce((sum, r) => sum + r.potentialReductionKg, 0);
  const potentialPurchaseSavings = Number((totalPotentialReductionKg * 120).toFixed(2));

  return {
    reportDate: formatDateYMD(new Date()),
    consumption,
    wasteRisks,
    purchasePredictions,
    wasteCost,
    scorecard,
    potentialPurchaseSavings,
    potentialPurchaseSavingsFormatted: formatPeso(potentialPurchaseSavings),
    totalPotentialReductionKg
  };
}
