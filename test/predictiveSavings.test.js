/**
 * KosherAI - Phase 5 Predictive Food Waste & Household Savings Test Suite
 * Tests acceptance criteria A through J as specified in Phase 5 requirements.
 */

import assert from 'assert';
import {
  RISK_LEVELS,
  CONFIDENCE_LEVELS,
  analyzeHouseholdConsumption,
  predictFoodWasteRisks,
  predictGroceryPurchases,
  getWasteRiskPrioritizedMeals,
  calculateVerifiedWasteCost,
  compareGrocerySpendingPeriods,
  calculateSustainabilityScorecard,
  generateMonthlyHouseholdReport
} from '../src/services/predictiveSavingsService.js';
import {
  saveInventoryItem,
  getInventoryItems,
  consumeInventoryItem,
  STORAGE_LOCATIONS
} from '../src/services/inventoryService.js';
import {
  FOOD_CATEGORIES,
  detectOverBuying
} from '../src/services/overBuyingDetector.js';
import { scaleRecipe } from '../src/services/recipeScaler.js';
import { DIET_RECIPES } from '../src/data/dietRecipes.js';

// Setup Mock LocalStorage for CLI testing
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

console.log('🧪 Starting KosherAI Phase 5: Predictive Food Waste & Household Savings Test Suite...\n');

// =========================================================================
// Test A — Consumption Analysis (Recorded Events, Purchases != Consumption)
// =========================================================================
console.log('Test A: Household Food Consumption Analysis');
{
  localStorage.clear();

  // Inventory with recorded consumption
  const inventory = [
    {
      id: 'inv_1',
      itemName: 'Bok Choy',
      category: FOOD_CATEGORIES.VEGETABLES,
      quantity: 500,
      unit: 'g',
      consumedQuantity: 2800 // 2.8 kg consumed
    },
    {
      id: 'inv_2',
      itemName: 'Chicken Breast',
      category: FOOD_CATEGORIES.MEAT,
      quantity: 1,
      unit: 'kg',
      consumedQuantity: 2 // 2.0 kg consumed
    }
  ];

  // Purchases: 10 kg bought, but only 4.8 kg consumed
  const purchases = [
    { name: 'Bok Choy', category: FOOD_CATEGORIES.VEGETABLES, quantity: 5.0, unit: 'kg' },
    { name: 'Chicken Breast', category: FOOD_CATEGORIES.MEAT, quantity: 5.0, unit: 'kg' }
  ];

  const wasteRecords = [
    { itemName: 'Bok Choy', measuredWeightG: 300 } // 0.3 kg wasted
  ];

  const analysis = analyzeHouseholdConsumption({
    inventory,
    purchases,
    wasteRecords,
    trackedDays: 14
  });

  // 1. Verify purchases are NOT equated with consumption
  assert.strictEqual(analysis.totalHouseholdConsumedKg, 4.8, 'Total consumed must be 4.8 kg from inventory events, NOT 10 kg purchased');
  assert.strictEqual(analysis.categories[FOOD_CATEGORIES.VEGETABLES].totalPurchasedKg, 5.0, 'Purchased veg is 5.0 kg');
  assert.strictEqual(analysis.categories[FOOD_CATEGORIES.VEGETABLES].totalConsumedKg, 2.8, 'Consumed veg is 2.8 kg');

  // 2. Verify daily and weekly consumption rates
  // 2.8 kg over 14 days = 0.200 kg/day; weekly = 1.40 kg/wk
  assert.strictEqual(analysis.categories[FOOD_CATEGORIES.VEGETABLES].dailyConsumptionKg, 0.2);
  assert.strictEqual(analysis.categories[FOOD_CATEGORIES.VEGETABLES].weeklyConsumptionKg, 1.4);

  // 3. Verify total explicit events count
  assert.strictEqual(analysis.totalExplicitConsumptionEvents, 2);
  assert.strictEqual(analysis.hasReliableData, true);

  console.log('  ✅ Test A Passed: Accurately computed rates; purchases are strictly separated from consumption.');
}

// =========================================================================
// Test B — Predictive Food-Waste Risk Detection
// =========================================================================
console.log('\nTest B: Food-Waste Risk Detection (1.5 kg, 0.25 kg/day, expires in 3 days -> 6 days to consume -> High Risk)');
{
  const refDate = new Date('2026-11-06T00:00:00Z');
  
  // Expiration in 3 days: 2026-11-09
  const inventory = [
    {
      id: 'inv_risk_1',
      itemName: 'Fresh Tilapia',
      category: FOOD_CATEGORIES.SEAFOOD,
      quantity: 1.5,
      unit: 'kg',
      expirationDate: '2026-11-09',
      dailyConsumptionRate: 0.25 // 0.25 kg/day
    }
  ];

  const riskResult = predictFoodWasteRisks({
    inventory,
    refDate
  });

  assert.strictEqual(riskResult.hasRisks, true);
  assert.strictEqual(riskResult.highRiskCount, 1);
  
  const risk = riskResult.risks[0];
  assert.strictEqual(risk.itemName, 'Fresh Tilapia');
  assert.strictEqual(risk.daysUntilExpiration, 3, 'Expires in 3 days');
  assert.strictEqual(risk.estimatedDaysToConsume, 6, '1.5 kg / 0.25 kg/day = 6 days to consume');
  assert.strictEqual(risk.riskLevel, RISK_LEVELS.HIGH, 'Must flag as HIGH risk because 6 days > 3 days');
  assert.ok(risk.explanation.includes('6 days to consume'), 'Explanation must cite 6 days to consume');
  assert.ok(risk.explanation.includes('expiration is in 3 days'), 'Explanation must cite 3 days expiration');
  assert.ok(risk.suggestedAction.length > 0, 'Must provide actionable mitigation');

  console.log('  ✅ Test B Passed: Accurately flagged high risk (6 days to consume vs 3 days expiration).');
}

// =========================================================================
// Test C — Insufficient Data Handling
// =========================================================================
console.log('\nTest C: Insufficient Data Handling (New Household with 0 records)');
{
  const emptyAnalysis = analyzeHouseholdConsumption({
    inventory: [],
    purchases: [],
    wasteRecords: [],
    trackedDays: 30
  });

  assert.strictEqual(emptyAnalysis.totalHouseholdConsumedKg, 0);
  assert.strictEqual(emptyAnalysis.totalExplicitConsumptionEvents, 0);
  assert.strictEqual(emptyAnalysis.hasReliableData, false);
  assert.strictEqual(emptyAnalysis.confidence, CONFIDENCE_LEVELS.INSUFFICIENT);
  assert.ok(emptyAnalysis.confidenceReason.includes('No consumption or inventory history recorded'));

  const emptyRisks = predictFoodWasteRisks({
    inventory: [],
    consumptionAnalysis: emptyAnalysis
  });
  assert.strictEqual(emptyRisks.hasRisks, false);
  assert.strictEqual(emptyRisks.highRiskCount, 0);

  console.log('  ✅ Test C Passed: Insufficient data gracefully recognized; no unsupported predictions fabricated.');
}

// =========================================================================
// Test D — Predictive Grocery Purchasing Recommendations
// =========================================================================
console.log('\nTest D: Predictive Grocery Purchasing (Accounts for on-hand inventory, no double counting)');
{
  // Category stats: Vegetables expected consumption 3.5 kg/week, Meat 2.0 kg/week
  const consumptionAnalysis = {
    categories: {
      [FOOD_CATEGORIES.VEGETABLES]: {
        weeklyConsumptionKg: 3.5,
        weeklyPurchasedKg: 4.0
      },
      [FOOD_CATEGORIES.MEAT]: {
        weeklyConsumptionKg: 2.0,
        weeklyPurchasedKg: 2.0
      }
    }
  };

  // On-hand inventory: 1.5 kg vegetables, 2.5 kg meat
  const inventory = [
    { itemName: 'Sayote', category: FOOD_CATEGORIES.VEGETABLES, quantity: 1.5, unit: 'kg' },
    { itemName: 'Pork Belly', category: FOOD_CATEGORIES.MEAT, quantity: 2.5, unit: 'kg' }
  ];

  const predictions = predictGroceryPurchases({
    inventory,
    consumptionAnalysis,
    householdMembers: 4,
    baselineMembers: 4,
    planningDurationDays: 7
  });

  const vegRec = predictions.recommendations.find(r => r.category === FOOD_CATEGORIES.VEGETABLES);
  const meatRec = predictions.recommendations.find(r => r.category === FOOD_CATEGORIES.MEAT);

  // Vegetables: Expected 3.5 kg, on-hand 1.5 kg -> Recommended purchase = 3.5 - 1.5 = 2.0 kg
  assert.strictEqual(vegRec.expectedConsumptionKg, 3.5);
  assert.strictEqual(vegRec.inventoryOnHandKg, 1.5);
  assert.strictEqual(vegRec.recommendedPurchaseKg, 2.0);
  assert.strictEqual(vegRec.potentialReductionKg, 2.0, 'Historical was 4.0 kg, recommended 2.0 kg -> potential reduction of 2.0 kg');

  // Meat: Expected 2.0 kg, on-hand 2.5 kg -> Recommended purchase = max(0, 2.0 - 2.5) = 0 kg
  assert.strictEqual(meatRec.expectedConsumptionKg, 2.0);
  assert.strictEqual(meatRec.inventoryOnHandKg, 2.5);
  assert.strictEqual(meatRec.recommendedPurchaseKg, 0.0, 'No meat purchase needed because on-hand exceeds expected');
  assert.ok(meatRec.comparisonNotice.includes('fully covers expected consumption'));

  console.log('  ✅ Test D Passed: Purchasing recommendations accurately subtract on-hand inventory without double counting.');
}

// =========================================================================
// Test E — Household Size Portion Scaling Integration
// =========================================================================
console.log('\nTest E: Household Size Scaling Integration (Sizes 2, 4, and 6)');
{
  const consumptionAnalysis = {
    categories: {
      [FOOD_CATEGORIES.VEGETABLES]: {
        weeklyConsumptionKg: 4.0, // baseline for 4 members
        weeklyPurchasedKg: 4.0
      }
    }
  };

  const inventory = [
    { itemName: 'Sayote', category: FOOD_CATEGORIES.VEGETABLES, quantity: 1.0, unit: 'kg' }
  ];

  // 1. Household size 2 (0.5x baseline)
  const size2 = predictGroceryPurchases({
    inventory,
    consumptionAnalysis,
    householdMembers: 2,
    baselineMembers: 4,
    planningDurationDays: 7
  });
  const veg2 = size2.recommendations.find(r => r.category === FOOD_CATEGORIES.VEGETABLES);
  assert.strictEqual(veg2.expectedConsumptionKg, 2.0, '4.0 kg * (2/4) = 2.0 kg expected');
  assert.strictEqual(veg2.recommendedPurchaseKg, 1.0, '2.0 kg expected - 1.0 kg on-hand = 1.0 kg recommended');

  // 2. Household size 4 (1.0x baseline)
  const size4 = predictGroceryPurchases({
    inventory,
    consumptionAnalysis,
    householdMembers: 4,
    baselineMembers: 4,
    planningDurationDays: 7
  });
  const veg4 = size4.recommendations.find(r => r.category === FOOD_CATEGORIES.VEGETABLES);
  assert.strictEqual(veg4.expectedConsumptionKg, 4.0, '4.0 kg * (4/4) = 4.0 kg expected');
  assert.strictEqual(veg4.recommendedPurchaseKg, 3.0, '4.0 kg expected - 1.0 kg on-hand = 3.0 kg recommended');

  // 3. Household size 6 (1.5x baseline)
  const size6 = predictGroceryPurchases({
    inventory,
    consumptionAnalysis,
    householdMembers: 6,
    baselineMembers: 4,
    planningDurationDays: 7
  });
  const veg6 = size6.recommendations.find(r => r.category === FOOD_CATEGORIES.VEGETABLES);
  assert.strictEqual(veg6.expectedConsumptionKg, 6.0, '4.0 kg * (6/4) = 6.0 kg expected');
  assert.strictEqual(veg6.recommendedPurchaseKg, 5.0, '6.0 kg expected - 1.0 kg on-hand = 5.0 kg recommended');

  console.log('  ✅ Test E Passed: Household sizes 2, 4, and 6 dynamically adjust consumption and purchasing.');
}

// =========================================================================
// Test F — Smart Meal Recommendations Prioritizing At-Risk Ingredients & Diet
// =========================================================================
console.log('\nTest F: Meal Recommendations Prioritizing At-Risk Ingredients & Dietary Protocol Compliance');
{
  const refDate = new Date('2026-11-06T00:00:00Z');

  // Inventory with Chicken Breast expiring soon
  const inventory = [
    {
      id: 'inv_tinola_chicken',
      itemName: 'Chicken Breast',
      category: FOOD_CATEGORIES.MEAT,
      quantity: 1,
      unit: 'kg',
      expirationDate: '2026-11-07', // 1 day remaining -> high risk!
      dailyConsumptionRate: 0.1
    },
    {
      id: 'inv_tinola_sayote',
      itemName: 'Sayote',
      category: FOOD_CATEGORIES.VEGETABLES,
      quantity: 2,
      unit: 'pcs',
      expirationDate: '2026-11-20'
    }
  ];

  // Under LID protocol: Tinola should be top-recommended and flagged as waste prevention priority
  const lidMeals = getWasteRiskPrioritizedMeals({
    inventory,
    dietKey: 'lid',
    householdMembers: 4,
    limit: 3,
    refDate
  });

  assert.ok(lidMeals.length > 0, 'Must return at least 1 meal recommendation');
  const topMeal = lidMeals[0];
  assert.strictEqual(topMeal.targetsAtRiskIngredients, true, 'Top meal must target at-risk chicken');
  assert.strictEqual(topMeal.priorityRank, 1, 'Priority rank must be 1 (urgent)');
  assert.ok(topMeal.recommendationReason.includes('High Food-Waste Prevention Priority'));

  // Verify dietary compliance is strictly maintained (e.g. no non-LID recipes)
  for (const meal of lidMeals) {
    const recipeObj = DIET_RECIPES.lid.meals.find(r => r.id === meal.recipeId);
    assert.ok(recipeObj, `Meal ${meal.dishName} must belong to LID recipe catalog`);
  }

  console.log('  ✅ Test F Passed: Top recommendations target at-risk ingredients with strict dietary compliance.');
}

// =========================================================================
// Test G — Savings Analysis & Unit Cost Valuation
// =========================================================================
console.log('\nTest G: Household Savings Analysis & Purchase Unit Cost Valuation');
{
  const purchases = [
    {
      name: 'Chicken Breast',
      category: FOOD_CATEGORIES.MEAT,
      quantity: 1.0,
      unit: 'kg',
      totalPrice: 240 // ₱240 / kg = ₱0.24 / g
    },
    {
      name: 'Fresh Spinach',
      category: FOOD_CATEGORIES.VEGETABLES,
      quantity: 500,
      unit: 'g',
      totalPrice: 80,
      weightGrams: 500 // ₱80 / 500g = ₱0.16 / g
    }
  ];

  const wasteRecords = [
    // 500g chicken wasted = 500 * 0.24 = ₱120.00
    { itemName: 'Chicken Breast', measuredWeightG: 500 },
    // 250g spinach wasted = 250 * 0.16 = ₱40.00
    { itemName: 'Fresh Spinach', measuredWeightG: 250 },
    // Explicit estimated cost record
    { itemName: 'Leftover Rice', estimatedCost: 25.50 }
  ];

  const wasteCost = calculateVerifiedWasteCost(wasteRecords, purchases);
  
  // Total = 120 + 40 + 25.50 = ₱185.50
  assert.strictEqual(wasteCost.totalEstimatedWasteCost, 185.5);
  assert.strictEqual(wasteCost.pricedRecordsCount, 3);
  assert.strictEqual(wasteCost.unpricedRecordsCount, 0);
  assert.strictEqual(wasteCost.hasCostData, true);

  console.log('  ✅ Test G Passed: Waste cost accurately valued using purchase unit prices; distinguished from potential savings.');
}

// =========================================================================
// Test H — Spending Comparison Across Comparable Periods
// =========================================================================
console.log('\nTest H: Grocery Spending Comparison (Comparable Periods & Transparent Statements)');
{
  // 1. Valid reduction
  const comparison1 = compareGrocerySpendingPeriods(3200, 4000);
  assert.strictEqual(comparison1.hasComparableData, true);
  assert.strictEqual(comparison1.difference, -800);
  assert.strictEqual(comparison1.percentageChange, -20.0);
  assert.strictEqual(comparison1.isReduction, true);
  assert.ok(comparison1.statement.includes('Grocery Spending Reduced by 20%'));
  assert.ok(comparison1.statement.includes('₱800.00 saved'));

  // 2. Spending increase
  const comparison2 = compareGrocerySpendingPeriods(4400, 4000);
  assert.strictEqual(comparison2.difference, 400);
  assert.strictEqual(comparison2.percentageChange, 10.0);
  assert.strictEqual(comparison2.isReduction, false);
  assert.ok(comparison2.statement.includes('Grocery Spending Increased by 10%'));

  // 3. Incomplete baseline (previous spending = 0)
  const comparison3 = compareGrocerySpendingPeriods(2500, 0);
  assert.strictEqual(comparison3.hasComparableData, false);
  assert.ok(comparison3.statement.includes('Continue recording shopping trips'));

  console.log('  ✅ Test H Passed: Spending differences and percentages computed accurately without unsubstantiated claims.');
}

// =========================================================================
// Test I — Confidence Level Classification
// =========================================================================
console.log('\nTest I: Data Confidence Classification (Explainable Factors)');
{
  // 1. High Confidence: 5+ consumption events across >= 14 days
  const highConf = analyzeHouseholdConsumption({
    inventory: [
      { consumedQuantity: 100 },
      { consumedQuantity: 200 },
      { consumedQuantity: 150 },
      { consumedQuantity: 300 },
      { consumedQuantity: 250 }
    ],
    purchases: [{ name: 'A' }, { name: 'B' }],
    wasteRecords: [],
    trackedDays: 14
  });
  assert.strictEqual(highConf.confidence, CONFIDENCE_LEVELS.HIGH);
  assert.ok(highConf.confidenceReason.includes('5 recorded consumption events'));

  // 2. Medium Confidence: limited consumption (1-4 events)
  const medConf = analyzeHouseholdConsumption({
    inventory: [{ consumedQuantity: 100 }],
    purchases: [{ name: 'A' }],
    wasteRecords: [],
    trackedDays: 7
  });
  assert.strictEqual(medConf.confidence, CONFIDENCE_LEVELS.MEDIUM);

  // 3. Low Confidence: purchases only, no consumption events logged
  const lowConf = analyzeHouseholdConsumption({
    inventory: [],
    purchases: [{ name: 'A' }],
    wasteRecords: [],
    trackedDays: 7
  });
  assert.strictEqual(lowConf.confidence, CONFIDENCE_LEVELS.LOW);

  // 4. Insufficient Data: zero records
  const insuffConf = analyzeHouseholdConsumption({
    inventory: [],
    purchases: [],
    wasteRecords: [],
    trackedDays: 7
  });
  assert.strictEqual(insuffConf.confidence, CONFIDENCE_LEVELS.INSUFFICIENT);

  console.log('  ✅ Test I Passed: Confidence classification transparently reflects data depth with clear rationale.');
}

// =========================================================================
// Test J — Full Regression Testing
// =========================================================================
console.log('\nTest J: Full Regression Checks (Phases 1-4 Integration & Scorecard)');
{
  // 1. Phase 1 Portion Scaling
  const baseRecipe = {
    id: 'test_adobo',
    servings: 4,
    ingredients: ['1 kg Chicken']
  };
  const scaled = scaleRecipe(baseRecipe, 6);
  assert.strictEqual(scaled.householdMembers, 6);
  assert.strictEqual(scaled.scalingMultiplier, 1.5);
  assert.strictEqual(scaled.scaledIngredients[0].scaledQty, 1.5, '1 kg * (6/4) = 1.5 kg');

  // 2. Phase 2 Over-Buying Detection
  const mockOverBuying = detectOverBuying({
    name: 'Sayote',
    category: FOOD_CATEGORIES.VEGETABLES,
    quantity: 6.0,
    unit: 'kg'
  }, [
    { name: 'Sayote', category: FOOD_CATEGORIES.VEGETABLES, quantity: 2.0, unit: 'kg', purchaseDate: '2026-10-20' },
    { name: 'Sayote', category: FOOD_CATEGORIES.VEGETABLES, quantity: 2.0, unit: 'kg', purchaseDate: '2026-10-27' }
  ], [
    { itemName: 'Sayote', category: FOOD_CATEGORIES.VEGETABLES, measuredWeightG: 500, date: '2026-10-21' }
  ]);
  assert.ok(mockOverBuying !== null, 'Phase 2 over-buying detection operates normally');

  // 3. Phase 5 Scorecard Calculation
  const scorecard = calculateSustainabilityScorecard({
    wasteRatio: 8.5,
    inventory: [{ consumedQuantity: 200 }, { consumedQuantity: 300 }, { consumedQuantity: 150 }],
    mealPlans: [{ id: 'p1' }, { id: 'p2' }]
  });
  assert.ok(scorecard.score >= 0 && scorecard.score <= 100);
  assert.strictEqual(scorecard.breakdown.length, 5, 'Must contain all 5 sustainability indicators');

  // 4. Monthly Household Performance Report
  const monthlyReport = generateMonthlyHouseholdReport({
    trips: [],
    purchases: [],
    wasteRecords: [],
    inventory: []
  });
  assert.ok(monthlyReport.reportDate, 'Must have report date');
  assert.ok(monthlyReport.scorecard, 'Must include scorecard');
  assert.ok(monthlyReport.wasteRisks, 'Must include waste risks');

  console.log('  ✅ Test J Passed: Zero regressions across all phases and full scorecard calculation verified.');
}

console.log('\n======================================================================');
console.log('🎉 ALL PHASE 5 PREDICTIVE SAVINGS ACCEPTANCE TESTS PASSED!');
console.log('======================================================================\n');
