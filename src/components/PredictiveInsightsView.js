/**
 * KosherAI - Predictive Household Insights & Food Waste Prevention View (Phase 5)
 * Visualizes consumption trends, FEFO-based food-waste forecasts, purchasing optimization,
 * verified savings, and the 100-point Household Sustainability Scorecard.
 */

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
} from '../services/predictiveSavingsService.js';
import { formatPeso } from '../services/householdInsightsService.js';
import { FOOD_CATEGORIES } from '../services/overBuyingDetector.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CONFIDENCE_STYLES = {
  [CONFIDENCE_LEVELS.HIGH]: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  [CONFIDENCE_LEVELS.MEDIUM]: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  [CONFIDENCE_LEVELS.LOW]: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  [CONFIDENCE_LEVELS.INSUFFICIENT]: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30'
};

const RISK_BADGES = {
  [RISK_LEVELS.HIGH]: {
    label: 'High Spoilage Risk',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    icon: '🚨'
  },
  [RISK_LEVELS.MODERATE]: {
    label: 'Moderate Risk',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    icon: '⚠️'
  },
  [RISK_LEVELS.LOW]: {
    label: 'Safe Shelf-Life',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: '✅'
  },
  [RISK_LEVELS.UNKNOWN]: {
    label: 'No Expiration Date',
    badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    icon: 'ℹ️'
  }
};

/**
 * Renders the complete Predictive Household Insights section.
 *
 * @param {Object} state - Main application state
 * @returns {string} HTML string
 */
export function renderPredictiveInsightsSection(state = {}) {
  const householdMembers = state.householdMembers || 4;
  const dietKey = state.activeDiet || 'lid';

  // Generate predictive models
  const consumption = analyzeHouseholdConsumption({ householdMembers });
  const wasteRisks = predictFoodWasteRisks({ consumptionAnalysis: consumption });
  const purchasing = predictGroceryPurchases({ consumptionAnalysis: consumption, householdMembers });
  const report = generateMonthlyHouseholdReport();
  const scorecard = report.scorecard;

  const confStyle = CONFIDENCE_STYLES[consumption.confidence] || CONFIDENCE_STYLES[CONFIDENCE_LEVELS.INSUFFICIENT];

  return `
    <div class="predictive-insights-section flex flex-col gap-6 mt-4">
      
      <!-- Section Header with Confidence Pill & Household Context -->
      <div class="p-5 rounded-2xl bg-gradient-to-r from-emerald-900/10 via-teal-900/10 to-indigo-900/10 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-indigo-950/30 border border-emerald-500/20 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xl">🔮</span>
            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
              Predictive Household Intelligence & Waste Prevention
            </h3>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white">
              Phase 5
            </span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
            Forecasts potential food spoilage before it happens, optimizes grocery purchasing against on-hand inventory, and calculates verified household savings.
          </p>
        </div>

        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
          <!-- Confidence Badge -->
          <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${confStyle}">
            <span class="w-2 h-2 rounded-full ${consumption.confidence === CONFIDENCE_LEVELS.HIGH ? 'bg-emerald-500' : (consumption.confidence === CONFIDENCE_LEVELS.MEDIUM ? 'bg-amber-500' : 'bg-slate-400')} animate-pulse"></span>
            <span>${escapeHtml(consumption.confidence)}</span>
          </div>

          <!-- Household Members Badge -->
          <div class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>👨‍👩‍👧‍👦</span>
            <span>${householdMembers} Members (${purchasing.sizeMultiplier}x)</span>
          </div>
        </div>
      </div>

      <!-- Confidence Note -->
      <div class="text-[11px] text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1.5 -mt-3">
        <span>ℹ️</span>
        <span>${escapeHtml(consumption.confidenceReason)}</span>
      </div>

      <!-- Grid 1: Sustainability Scorecard & Verified Savings -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Scorecard Card (1 col) -->
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>🏅</span> Household Sustainability Scorecard
              </h4>
              <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">100 Pts Max</span>
            </div>

            <!-- Grade & Big Score -->
            <div class="flex items-center gap-4 my-2">
              <div class="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-3xl shadow-inner ${scorecard.grade === 'A' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : (scorecard.grade === 'B' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30')}">
                ${scorecard.grade}
              </div>
              <div>
                <div class="text-3xl font-black text-slate-900 dark:text-slate-100 font-mono">
                  ${scorecard.score}<span class="text-base font-normal text-slate-400">/100</span>
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  ${scorecard.score >= 80 ? 'Excellent Household Stewardship' : (scorecard.score >= 60 ? 'Good Baseline Performance' : 'Room for Optimization')}
                </div>
              </div>
            </div>

            <!-- Breakdown Bars -->
            <div class="flex flex-col gap-2.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              ${scorecard.breakdown.map(ind => `
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-medium text-slate-700 dark:text-slate-300">${escapeHtml(ind.indicator)}</span>
                    <span class="font-mono text-[11px] font-bold text-slate-500">${ind.score}/${ind.maxScore}</span>
                  </div>
                  <div class="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-emerald-500 h-full rounded-full transition-all" style="width: ${(ind.score / ind.maxScore) * 100}%"></div>
                  </div>
                  <span class="text-[10px] text-slate-400 leading-tight">${escapeHtml(ind.detail)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Savings & Verified Waste Cost Card (2 cols) -->
        <div class="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>💰</span> Financial Impact & Cost Quantification
              </h4>
              <span class="text-[11px] font-medium text-slate-400">Actual Purchase Valuations</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-2">
              <!-- Realized Waste Cost -->
              <div class="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 flex flex-col">
                <span class="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                  Realized Waste Cost
                </span>
                <span class="text-2xl font-bold font-mono text-rose-900 dark:text-rose-200 mt-1">
                  ${formatPeso(report.wasteCost.totalEstimatedWasteCost)}
                </span>
                <span class="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-1">
                  ${report.wasteCost.pricedRecordsCount} verified from receipt unit prices
                </span>
              </div>

              <!-- Potential Purchase Reduction -->
              <div class="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 flex flex-col">
                <span class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Avoidable Purchases
                </span>
                <span class="text-2xl font-bold font-mono text-emerald-900 dark:text-emerald-200 mt-1">
                  ${report.potentialPurchaseSavingsFormatted}
                </span>
                <span class="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                  ${report.totalPotentialReductionKg.toFixed(1)} kg surplus covered by on-hand inventory
                </span>
              </div>

              <!-- Spending Variance -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col">
                <span class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Weekly Consumption
                </span>
                <span class="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                  ${consumption.totalHouseholdConsumedKg.toFixed(1)} kg
                </span>
                <span class="text-[10px] text-slate-500 mt-1">
                  Across ${consumption.totalExplicitConsumptionEvents} tracked inventory meals
                </span>
              </div>
            </div>

            <!-- Spending Comparison Statement -->
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 mt-3 flex items-start gap-2.5">
              <span class="text-base select-none leading-none">📊</span>
              <div>
                <span class="font-semibold text-slate-900 dark:text-slate-100">Historical Comparison:</span>
                <span class="ml-1">${escapeHtml(compareGrocerySpendingPeriods(consumption.categories[FOOD_CATEGORIES.VEGETABLES]?.totalPurchasedKg ? 1 : 0, 0).statement)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Section 2: Predictive Food Spoilage Risk Alerts -->
      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>⚠️</span> Food-Waste Risk Alerts & Days-to-Consume Forecast
            </h4>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Evaluates inventory consumption velocity against recorded expiration dates.
            </p>
          </div>
          <div class="flex items-center gap-2">
            ${wasteRisks.highRiskCount > 0 ? `
              <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                🚨 ${wasteRisks.highRiskCount} High Risk
              </span>
            ` : ''}
            ${wasteRisks.moderateRiskCount > 0 ? `
              <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                ⚠️ ${wasteRisks.moderateRiskCount} Moderate Risk
              </span>
            ` : ''}
          </div>
        </div>

        ${wasteRisks.risks.length > 0 ? `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            ${wasteRisks.risks.slice(0, 6).map(risk => {
              const badge = RISK_BADGES[risk.riskLevel] || RISK_BADGES[RISK_LEVELS.UNKNOWN];
              return `
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border ${risk.riskLevel === RISK_LEVELS.HIGH ? 'border-rose-300 dark:border-rose-900/60 shadow-xs' : 'border-slate-200/80 dark:border-slate-800'} flex flex-col justify-between gap-3">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-xs text-slate-900 dark:text-slate-100">${escapeHtml(risk.itemName)}</span>
                        <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          ${risk.quantity} ${escapeHtml(risk.unit)}
                        </span>
                      </div>
                      <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        ${escapeHtml(risk.category)} • 📍 ${escapeHtml(risk.storageLocation || 'Kitchen')}
                      </div>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.badge}">
                      ${badge.icon} ${badge.label}
                    </span>
                  </div>

                  <!-- Rate & Horizon Metrics -->
                  <div class="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 font-mono">
                    <div>
                      <span class="text-[10px] text-slate-400 uppercase font-sans block">Remaining Shelf-Life</span>
                      <span class="font-bold ${risk.daysUntilExpiration !== null && risk.daysUntilExpiration <= 3 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}">
                        ${risk.daysUntilExpiration !== null ? `${risk.daysUntilExpiration} days` : 'No date'}
                      </span>
                    </div>
                    <div>
                      <span class="text-[10px] text-slate-400 uppercase font-sans block">Est. Time to Consume</span>
                      <span class="font-bold ${risk.estimatedDaysToConsume !== null && risk.daysUntilExpiration !== null && risk.estimatedDaysToConsume > risk.daysUntilExpiration ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
                        ${risk.estimatedDaysToConsume !== null ? `~${risk.estimatedDaysToConsume} days` : '—'}
                      </span>
                    </div>
                  </div>

                  <!-- Reason & Action -->
                  <div class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    ${escapeHtml(risk.explanation)}
                  </div>
                  <div class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>💡 Action:</span>
                    <span>${escapeHtml(risk.suggestedAction)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center">
            <span class="text-3xl select-none opacity-60">🥬</span>
            <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2">Zero Spoilage Risks Detected</p>
            <p class="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
              All on-hand inventory items are comfortably within their estimated consumption windows.
            </p>
          </div>
        `}
      </div>

      <!-- Section 3: Predictive Grocery Purchasing Recommendations -->
      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>🛒</span> Predictive Purchasing Recommendations
            </h4>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
              Inventory-Aware Planning
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Recommended purchases calculated using: <code>expected_consumption + planned_meals - available_inventory</code>.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          ${purchasing.recommendations.map(rec => `
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2">
              <div>
                <div class="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                  <span>${escapeHtml(rec.category)}</span>
                  <span class="font-mono text-emerald-600 dark:text-emerald-400">
                    Buy ${rec.recommendedPurchaseKg} kg
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-500 mt-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <span class="text-[9px] uppercase font-sans text-slate-400 block">Expected</span>
                    <span>${rec.expectedConsumptionKg} kg</span>
                  </div>
                  <div>
                    <span class="text-[9px] uppercase font-sans text-slate-400 block">On-Hand</span>
                    <span>${rec.inventoryOnHandKg} kg</span>
                  </div>
                </div>
              </div>

              ${rec.potentialReductionKg > 0 ? `
                <div class="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                  ⚡ Reduces historical purchase by ${rec.potentialReductionKg} kg
                </div>
              ` : `
                <div class="text-[10px] text-slate-400 leading-snug">
                  ${escapeHtml(rec.comparisonNotice)}
                </div>
              `}
            </div>
          `).join('')}
        </div>
      </div>

    </div>
  `;
}
