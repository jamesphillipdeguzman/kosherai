/**
 * KosherAI - Smart Over-Buying Detection & Food Waste Prevention Service (Phase 2)
 * Analyzes historical grocery purchases and food-waste logs to identify recurring spoilage patterns,
 * calculate category waste ratios, and generate contextual over-purchasing warnings.
 *
 * Built on Phase 1 dynamic household sizing without modifying portion scaling.
 */

import { getHouseholdMembers } from './storage.js';

export const FOOD_CATEGORIES = {
  VEGETABLES: 'Vegetables',
  FRUITS: 'Fruits',
  MEAT: 'Meat',
  SEAFOOD: 'Seafood',
  DAIRY: 'Dairy',
  BAKERY: 'Bread and Bakery',
  PANTRY: 'Pantry Staples',
  OTHER: 'Other Perishables'
};

// Keyword dictionaries for high-accuracy category classification (Philippine & International foods)
const CATEGORY_KEYWORDS = {
  [FOOD_CATEGORIES.VEGETABLES]: [
    'sayote', 'chayote', 'cabbage', 'repolyo', 'pechay', 'bok choy', 'pak choi', 'kangkong', 'water spinach',
    'onion', 'shallot', 'sibuyas', 'garlic', 'bawang', 'tomato', 'kamatis', 'eggplant', 'talong', 'cucumber',
    'pipino', 'carrot', 'karot', 'kalabasa', 'squash', 'pumpkin', 'string beans', 'sitaw', 'green beans',
    'baguio beans', 'lettuce', 'broccoli', 'cauliflower', 'spinach', 'malunggay', 'moringa', 'ginger', 'luya',
    'bell pepper', 'capsicum', 'potato', 'potatoes', 'patatas', 'radish', 'labanos', 'okra', 'ampalaya',
    'bitter melon', 'bitter gourd', 'chili', 'sili', 'labuyo', 'bean sprouts', 'togue', 'upo', 'bottle gourd',
    'patola', 'sponge gourd', 'mushroom', 'mushrooms', 'celery', 'zucchini', 'asparagus', 'vegetable', 'vegetables',
    'veggie', 'veggies', 'greens', 'salad'
  ],
  [FOOD_CATEGORIES.FRUITS]: [
    'banana', 'saging', 'apple', 'mansanas', 'orange', 'dalandan', 'mandarin', 'mango', 'mangga',
    'calamansi', 'kalamansi', 'papaya', 'pineapple', 'pinya', 'strawberry', 'strawberries', 'berry',
    'berries', 'grapes', 'ubas', 'watermelon', 'pakwan', 'melon', 'cantaloupe', 'avocado', 'lemon',
    'lime', 'pomelo', 'suha', 'guava', 'bayabas', 'lanzones', 'rambutan', 'durian', 'mangosteen',
    'fruit', 'fruits'
  ],
  [FOOD_CATEGORIES.MEAT]: [
    'chicken', 'manok', 'pork', 'baboy', 'beef', 'baka', 'liempo', 'pork belly', 'kasim', 'giniling',
    'ground pork', 'ground beef', 'minced meat', 'pork chop', 'steak', 'ribs', 'bacon', 'ham', 'sausage',
    'hotdog', 'turkey', 'lamb', 'duck', 'liver', 'atay', 'meat', 'poultry', 'cutlet', 'cutlets', 'brisket'
  ],
  [FOOD_CATEGORIES.SEAFOOD]: [
    'fish', 'isda', 'bangus', 'milkfish', 'tilapia', 'salmon', 'tuna', 'galunggong', 'round scad',
    'shrimp', 'hipon', 'prawn', 'prawns', 'crab', 'alimango', 'alimasag', 'squid', 'pusit', 'octopus',
    'pugita', 'clam', 'clams', 'halaan', 'mussel', 'mussels', 'tahong', 'oyster', 'oysters', 'talaba',
    'sardine', 'sardines', 'mackerel', 'cod', 'seafood', 'dilis', 'anchovy', 'tuyo', 'daing'
  ],
  [FOOD_CATEGORIES.DAIRY]: [
    'milk', 'gatas', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'keso', 'butter', 'margarine',
    'yogurt', 'yoghurt', 'cream', 'all-purpose cream', 'heavy cream', 'sour cream', 'condensada',
    'condensed milk', 'evaporada', 'evaporated milk', 'dairy'
  ],
  [FOOD_CATEGORIES.BAKERY]: [
    'bread', 'tinapay', 'pandesal', 'pan de sal', 'loaf', 'sliced bread', 'tasty', 'buns', 'burger buns',
    'bagel', 'bagels', 'croissant', 'baguette', 'pita', 'tortilla', 'muffin', 'cake', 'pastry', 'bakery'
  ],
  [FOOD_CATEGORIES.PANTRY]: [
    'rice', 'bigas', 'sinandomeng', 'dinorado', 'jasmine rice', 'brown rice', 'flour', 'wheat', 'oats',
    'cereal', 'cooking oil', 'coconut oil', 'canola oil', 'olive oil', 'vegetable oil', 'salt', 'asin',
    'kosher salt', 'sugar', 'asukal', 'vinegar', 'suka', 'soy sauce', 'toyo', 'fish sauce', 'patis',
    'noodles', 'pansit', 'bihon', 'canton', 'spaghetti', 'pasta', 'canned goods', 'corned beef', 'sardines in can',
    'seasoning', 'black pepper', 'paminta', 'cornstarch', 'baking powder', 'yeast', 'pantry'
  ]
};

/**
 * Resolves an item's standard category from its name and optional existing category string
 */
export function resolveFoodCategory(itemName = '', existingCategory = '') {
  const normCategory = String(existingCategory || '').trim().toLowerCase();
  const normName = String(itemName || '').trim().toLowerCase();

  // 1. Direct match against canonical category names
  if (normCategory === 'vegetables' || normCategory === 'vegetable' || normCategory === 'veggies') return FOOD_CATEGORIES.VEGETABLES;
  if (normCategory === 'fruits' || normCategory === 'fruit') return FOOD_CATEGORIES.FRUITS;
  if (normCategory === 'meat' || normCategory === 'poultry') return FOOD_CATEGORIES.MEAT;
  if (normCategory === 'seafood' || normCategory === 'fish') return FOOD_CATEGORIES.SEAFOOD;
  if (normCategory === 'dairy') return FOOD_CATEGORIES.DAIRY;
  if (normCategory === 'bread and bakery' || normCategory === 'bakery' || normCategory === 'bread') return FOOD_CATEGORIES.BAKERY;
  if (normCategory === 'pantry staples' || normCategory === 'pantry' || normCategory === 'grains') return FOOD_CATEGORIES.PANTRY;

  // 2. Keyword matching on item name first (highest specificity)
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      // Word boundary match or exact substring in item name
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(normName) || normName.includes(kw)) {
        return category;
      }
    }
  }

  // 3. Fallback matching on existingCategory text
  if (normCategory.includes('produce') || normCategory.includes('veg')) return FOOD_CATEGORIES.VEGETABLES;
  if (normCategory.includes('fruit')) return FOOD_CATEGORIES.FRUITS;
  if (normCategory.includes('meat') || normCategory.includes('protein')) return FOOD_CATEGORIES.MEAT;
  if (normCategory.includes('seafood') || normCategory.includes('fish')) return FOOD_CATEGORIES.SEAFOOD;
  if (normCategory.includes('dairy')) return FOOD_CATEGORIES.DAIRY;
  if (normCategory.includes('bakery') || normCategory.includes('bread')) return FOOD_CATEGORIES.BAKERY;
  if (normCategory.includes('pantry') || normCategory.includes('grain')) return FOOD_CATEGORIES.PANTRY;

  return FOOD_CATEGORIES.OTHER;
}

/**
 * Standardizes measurement quantity and unit into Kilograms (kg).
 * Only comparable weight units are converted.
 * Returns null if the unit is non-weight or missing (per Test I).
 */
export function standardizeWeightToKg(quantity, unit = 'pcs', weightGrams = 0) {
  const numQty = Number(quantity);
  const numWeightG = Number(weightGrams);

  // If explicit package scale weight in grams is provided and valid
  if (!isNaN(numWeightG) && numWeightG > 0) {
    return Number((numWeightG / 1000).toFixed(4));
  }

  if (isNaN(numQty) || numQty <= 0) {
    return null;
  }

  const cleanUnit = String(unit || '').trim().toLowerCase();

  // Kilograms
  if (cleanUnit === 'kg' || cleanUnit === 'kgs' || cleanUnit === 'kilo' || cleanUnit === 'kilos' || cleanUnit === 'kilogram' || cleanUnit === 'kilograms') {
    return Number(numQty.toFixed(4));
  }

  // Grams
  if (cleanUnit === 'g' || cleanUnit === 'gm' || cleanUnit === 'gram' || cleanUnit === 'grams') {
    return Number((numQty / 1000).toFixed(4));
  }

  // Pounds (standard conversion: 1 lb = 0.45359237 kg)
  if (cleanUnit === 'lb' || cleanUnit === 'lbs' || cleanUnit === 'pound' || cleanUnit === 'pounds') {
    return Number((numQty * 0.453592).toFixed(4));
  }

  // Non-comparable units (pieces, cans, packs, bottles, etc.) without explicit weight
  return null;
}

/**
 * Computes historical food waste analysis by category across completed tracking cycles.
 *
 * @param {Object} options
 * @param {Array} options.purchases - Array of grocery purchase records
 * @param {Array} options.wasteRecords - Array of food waste log records
 * @param {number} [options.householdMembers] - Current household members (defaults to storage/settings)
 * @param {number} [options.historicalHouseholdMembers] - Historical household size (default 4)
 * @param {number} [options.cyclesCount] - Explicit cycle count (or derived from data)
 * @param {Object} [options.thresholds] - Custom thresholds (lowWasteRatio, highWasteRatio, minCyclesWithWaste)
 */
export function calculateHistoricalWasteAnalysis(options = {}) {
  const {
    purchases = [],
    wasteRecords = [],
    householdMembers = getHouseholdMembers(),
    historicalHouseholdMembers = 4,
    cyclesCount = null,
    thresholds = {}
  } = options;

  const config = {
    lowWasteRatio: 0.10,        // 10%
    highWasteRatio: 0.20,       // 20%
    minCyclesWithWaste: 2,      // Must have waste in >= 2 cycles to trigger repeated-waste warning
    ...thresholds
  };

  // 1. Group purchases and waste by category and cycle
  const categoryData = {};
  for (const cat of Object.values(FOOD_CATEGORIES)) {
    categoryData[cat] = {
      category: cat,
      totalPurchaseKg: 0,
      totalWasteKg: 0,
      purchaseCycles: new Set(),
      wasteCycles: new Set(),
      itemsCount: 0,
      wasteRecordsCount: 0
    };
  }

  // Helper to extract cycle identifier (projectWeek, cycleId, or date)
  const getCycleId = (item, defaultCycle = 'cycle_1') => {
    if (item.projectWeek !== undefined && item.projectWeek !== null) return `week_${item.projectWeek}`;
    if (item.cycleId) return String(item.cycleId);
    if (item.purchaseDate) return item.purchaseDate;
    if (item.date) return item.date;
    return defaultCycle;
  };

  // Accumulate purchases
  for (const p of purchases) {
    const cat = resolveFoodCategory(p.name || p.itemName, p.category);
    const target = categoryData[cat] || categoryData[FOOD_CATEGORIES.OTHER];
    const weightKg = standardizeWeightToKg(p.quantity ?? p.qty, p.unit, p.weightGrams ?? p.weightG);

    if (weightKg !== null && weightKg > 0) {
      target.totalPurchaseKg += weightKg;
    }
    const cycle = getCycleId(p, 'cycle_1');
    target.purchaseCycles.add(cycle);
    target.itemsCount++;
  }

  // Accumulate food waste
  for (const w of wasteRecords) {
    const cat = resolveFoodCategory(w.itemName || w.name, w.category);
    const target = categoryData[cat] || categoryData[FOOD_CATEGORIES.OTHER];

    // Waste records have measuredWeightG in grams or measured_weight_g
    const rawG = Number(w.measuredWeightG ?? w.measured_weight_g ?? w.weightGrams ?? 0);
    let wasteKg = 0;
    if (rawG > 0) {
      wasteKg = rawG / 1000;
    } else {
      const parsedKg = standardizeWeightToKg(w.quantity, w.unit, w.weightGrams);
      if (parsedKg !== null && parsedKg > 0) wasteKg = parsedKg;
    }

    if (wasteKg > 0) {
      target.totalWasteKg += wasteKg;
      const cycle = getCycleId(w, 'cycle_1');
      target.wasteCycles.add(cycle);
      target.wasteRecordsCount++;
    }
  }

  // Global cycle count resolution
  const allRecordedCycles = new Set();
  for (const cat of Object.values(categoryData)) {
    for (const c of cat.purchaseCycles) allRecordedCycles.add(c);
  }
  const effectiveCycles = Math.max(1, cyclesCount || allRecordedCycles.size || 2);

  // 2. Compute category metrics
  const results = {};
  for (const [cat, data] of Object.entries(categoryData)) {
    const purchaseKg = Number(data.totalPurchaseKg.toFixed(3));
    const wasteKg = Number(data.totalWasteKg.toFixed(3));

    let wasteRatio = null;
    let wasteRatioPercent = null;
    let wasteClassification = 'none';

    if (purchaseKg > 0) {
      wasteRatio = Number((wasteKg / purchaseKg).toFixed(4));
      wasteRatioPercent = Number((wasteRatio * 100).toFixed(1));

      if (wasteRatio < config.lowWasteRatio) {
        wasteClassification = 'low';
      } else if (wasteRatio < config.highWasteRatio) {
        wasteClassification = 'moderate';
      } else {
        wasteClassification = 'high';
      }
    }

    const cyclesWithWaste = data.wasteCycles.size;
    const averagePurchasedPerCycle = purchaseKg > 0 ? Number((purchaseKg / effectiveCycles).toFixed(3)) : 0;

    // Household size adjusted reference for current household
    const currMembers = Math.max(1, Number(householdMembers || 4));
    const histMembers = Math.max(1, Number(historicalHouseholdMembers || 4));
    const householdScalingFactor = currMembers / histMembers;
    const adjustedReferencePerCycle = Number((averagePurchasedPerCycle * householdScalingFactor).toFixed(3));

    results[cat] = {
      category: cat,
      totalPurchaseKg: purchaseKg,
      totalWasteKg: wasteKg,
      wasteRatio,
      wasteRatioPercent,
      wasteClassification,
      cyclesWithWaste,
      effectiveCycles,
      averagePurchasedPerCycle,
      adjustedReferencePerCycle,
      householdMembers: currMembers,
      historicalHouseholdMembers: histMembers,
      hasSufficientHistory: purchaseKg > 0 && wasteKg > 0
    };
  }

  return {
    categories: results,
    effectiveCycles,
    householdMembers: Math.max(1, Number(householdMembers || 4))
  };
}

// Session store for user-dismissed warning IDs to prevent intrusive duplicate prompts
const dismissedWarningKeys = new Set();

export function dismissWarningKey(key) {
  if (key) dismissedWarningKeys.add(String(key));
}

export function isWarningKeyDismissed(key) {
  return key ? dismissedWarningKeys.has(String(key)) : false;
}

export function clearDismissedWarnings() {
  dismissedWarningKeys.clear();
}

/**
 * Detects smart over-buying patterns on proposed purchases against historical purchases and waste records.
 *
 * @param {Array} proposedItems - Items being reviewed on receipt or entered manually
 * @param {Object} options - Analysis context (purchases, wasteRecords, householdMembers, etc.)
 */
export function detectOverBuying(proposedItems = [], options = {}) {
  if (!Array.isArray(proposedItems) || proposedItems.length === 0) {
    return { hasWarnings: false, warnings: [], categoryBreakdown: {} };
  }

  const analysis = calculateHistoricalWasteAnalysis(options);
  const categories = analysis.categories;
  const householdMembers = analysis.householdMembers;

  const thresholds = {
    moderateVariance: 1.25, // 1.25x
    highVariance: 1.50,     // 1.50x
    minCyclesWithWaste: 2,  // Repeated waste in >= 2 cycles
    ...(options.thresholds || {})
  };

  // Group proposed items by category and sum comparable weight
  const proposedByCategory = {};
  for (const item of proposedItems) {
    const cat = resolveFoodCategory(item.name || item.itemName, item.category);
    if (!proposedByCategory[cat]) {
      proposedByCategory[cat] = {
        category: cat,
        proposedKg: 0,
        items: []
      };
    }
    const weightKg = standardizeWeightToKg(item.quantity ?? item.qty, item.unit, item.weightGrams ?? item.weightG);
    if (weightKg !== null && weightKg > 0) {
      proposedByCategory[cat].proposedKg += weightKg;
    }
    proposedByCategory[cat].items.push(item);
  }

  const warnings = [];

  for (const [cat, proposedData] of Object.entries(proposedByCategory)) {
    const hist = categories[cat];
    const proposedKg = Number(proposedData.proposedKg.toFixed(3));

    // If no historical purchase or waste records, skip (Test C)
    if (!hist || !hist.hasSufficientHistory || hist.totalPurchaseKg <= 0) {
      continue;
    }

    // Reference per cycle (adjusted for household size)
    const refCycleKg = hist.adjustedReferencePerCycle || hist.averagePurchasedPerCycle;

    if (refCycleKg <= 0 || proposedKg <= 0) {
      continue;
    }

    const variance = Number((proposedKg / refCycleKg).toFixed(2));
    const cyclesWithWaste = hist.cyclesWithWaste;
    const wasteClassification = hist.wasteClassification; // 'low' | 'moderate' | 'high'

    // Condition 1: Waste recorded in at least 2 tracking cycles (Test D)
    const hasRepeatedWaste = cyclesWithWaste >= thresholds.minCyclesWithWaste;

    // Condition 2: Waste ratio is moderate or high
    const isSignificantWaste = wasteClassification === 'moderate' || wasteClassification === 'high';

    let warningLevel = null;
    let reason = '';
    let suggestedAction = '';

    // Level Evaluation (Advisory only)
    if (hasRepeatedWaste && isSignificantWaste) {
      if (variance >= thresholds.highVariance) {
        warningLevel = 'high';
        reason = `Your household recorded ${hist.totalWasteKg} kg of ${cat.toLowerCase()} waste (${hist.wasteRatioPercent}% waste ratio) across ${cyclesWithWaste} recent cycles. This purchase (${proposedKg} kg) is approximately ${variance}× your historical average.`;
        suggestedAction = `Consider reducing quantity or verifying whether ${proposedKg} kg can be fully consumed, preserved, or frozen before spoilage.`;
      } else if (variance >= thresholds.moderateVariance) {
        warningLevel = 'moderate';
        reason = `Your household recorded repeated ${cat.toLowerCase()} waste (${hist.totalWasteKg} kg, ${hist.wasteRatioPercent}% ratio). This purchase (${proposedKg} kg) is ${variance}× your household's historical reference.`;
        suggestedAction = `Review your current refrigerator inventory before purchasing additional ${cat.toLowerCase()}.`;
      }
    } else if (cyclesWithWaste >= 1 && isSignificantWaste && variance >= thresholds.highVariance) {
      // Single cycle with elevated purchase: Informational only (not classified as repeated over-buyer)
      warningLevel = 'info';
      reason = `Notice: ${hist.totalWasteKg} kg of ${cat.toLowerCase()} waste was recently recorded. This purchase is ${variance}× your reference.`;
      suggestedAction = `Monitor usage to prevent potential excess.`;
    }

    if (warningLevel) {
      const warningKey = `warn_${cat.toLowerCase().replace(/\s+/g, '_')}_${proposedKg}`;
      warnings.push({
        id: warningKey,
        category: cat,
        level: warningLevel,
        proposedQuantityKg: proposedKg,
        historicalWasteKg: hist.totalWasteKg,
        historicalWasteRatioPercent: hist.wasteRatioPercent,
        historicalAverageKg: hist.averagePurchasedPerCycle,
        adjustedReferenceKg: refCycleKg,
        purchaseVariance: variance,
        householdMembers,
        cyclesWithWaste,
        reason,
        suggestedAction,
        isDismissed: isWarningKeyDismissed(warningKey)
      });
    }
  }

  return {
    hasWarnings: warnings.filter(w => !w.isDismissed).length > 0,
    allWarnings: warnings,
    warnings: warnings.filter(w => !w.isDismissed),
    categoryBreakdown: proposedByCategory,
    historicalSummary: categories
  };
}

/**
 * Generates an accessible, dual-theme HTML warning banner for an over-buying advisory
 */
export function renderOverBuyingWarningHtml(warning) {
  if (!warning || warning.isDismissed) return '';

  const isHigh = warning.level === 'high';
  const isModerate = warning.level === 'moderate';

  const badgeColor = isHigh
    ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/40'
    : isModerate
    ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40'
    : 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-500/40';

  const containerBorder = isHigh
    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/20'
    : isModerate
    ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20'
    : 'border-cyan-300 dark:border-cyan-900/60 bg-cyan-50/80 dark:bg-cyan-950/20';

  const titleIcon = isHigh ? '🚨' : isModerate ? '⚠️' : 'ℹ️';
  const levelTitle = isHigh ? 'Potential Over-Purchasing Detected' : isModerate ? 'Historical Waste Alert' : 'Advisory Note';

  return `
    <div class="overbuying-warning-banner p-3.5 rounded-2xl border ${containerBorder} mb-3 transition-all relative" data-warning-id="${warning.id}">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-2.5">
          <span class="text-xl select-none mt-0.5">${titleIcon}</span>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                ${levelTitle}: ${warning.category}
              </span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}">
                ${warning.level.toUpperCase()} ADVISORY
              </span>
            </div>
            <p class="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
              ${warning.reason}
            </p>
            <div class="flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap">
              <span>Proposed: <strong>${warning.proposedQuantityKg} kg</strong></span>
              <span>•</span>
              <span>Hist. Avg: <strong>${warning.adjustedReferenceKg} kg/cycle</strong></span>
              <span>•</span>
              <span>Waste Ratio: <strong class="${isHigh ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}">${warning.historicalWasteRatioPercent}%</strong></span>
              <span>•</span>
              <span>Household: <strong>${warning.householdMembers} members</strong></span>
            </div>
            <div class="mt-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              💡 <strong>Action:</strong> ${warning.suggestedAction}
            </div>
          </div>
        </div>
        <button
          type="button"
          class="dismiss-warning-btn text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 shrink-0 cursor-pointer transition-colors"
          data-dismiss-warning="${warning.id}"
          title="Dismiss advisory"
          aria-label="Dismiss warning"
        >
          ✕ Dismiss
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders multiple over-buying warnings into an aggregate HTML block
 */
export function renderOverBuyingAlertsHtml(warnings = []) {
  if (!Array.isArray(warnings) || warnings.length === 0) return '';
  const activeWarnings = warnings.filter(w => !w.isDismissed);
  if (activeWarnings.length === 0) return '';
  return `
    <div class="overbuying-alerts-container mb-3" id="overbuying-alerts-box">
      ${activeWarnings.map(w => renderOverBuyingWarningHtml(w)).join('')}
    </div>
  `;
}

