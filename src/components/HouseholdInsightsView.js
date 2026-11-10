/**
 * KosherAI - Household Grocery Insights Dashboard Component
 *
 * Clean section container with 5 independently collapsible insight categories:
 * 1. Household Sustainability Scorecard
 * 2. Financial Impact & Cost Quantification
 * 3. Food-Waste Risk Alerts & Days-to-Consume Forecast
 * 4. Predictive Purchasing Recommendations
 * 5. Historical Trends & Progress
 */

import {
  REPORTING_PERIODS,
  PERIOD_LABELS,
  formatPeso,
  calculateHouseholdInsights
} from '../services/householdInsightsService.js';
import { FOOD_CATEGORIES } from '../services/overBuyingDetector.js';
import {
  RISK_LEVELS,
  CONFIDENCE_LEVELS,
  analyzeHouseholdConsumption,
  predictFoodWasteRisks,
  predictGroceryPurchases,
  compareGrocerySpendingPeriods,
  generateMonthlyHouseholdReport
} from '../services/predictiveSavingsService.js';

// Visual Category Icons & Accent Badges
const CATEGORY_STYLES = {
  [FOOD_CATEGORIES.VEGETABLES]: {
    icon: '🥬',
    color: 'emerald',
    barClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
  },
  [FOOD_CATEGORIES.FRUITS]: {
    icon: '🍎',
    color: 'amber',
    barClass: 'bg-amber-500',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
  },
  [FOOD_CATEGORIES.MEAT]: {
    icon: '🍗',
    color: 'rose',
    barClass: 'bg-rose-500',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
  },
  [FOOD_CATEGORIES.SEAFOOD]: {
    icon: '🐟',
    color: 'cyan',
    barClass: 'bg-cyan-500',
    badgeClass: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
  },
  [FOOD_CATEGORIES.DAIRY]: {
    icon: '🥛',
    color: 'blue',
    barClass: 'bg-blue-500',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
  },
  [FOOD_CATEGORIES.BAKERY]: {
    icon: '🍞',
    color: 'orange',
    barClass: 'bg-orange-500',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30'
  },
  [FOOD_CATEGORIES.PANTRY]: {
    icon: '🍚',
    color: 'slate',
    barClass: 'bg-slate-400',
    badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
  },
  [FOOD_CATEGORIES.OTHER]: {
    icon: '📦',
    color: 'purple',
    barClass: 'bg-purple-500',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
  }
};

const RISK_BADGES = {
  [RISK_LEVELS.HIGH]: {
    label: 'High Risk',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    icon: '🚨'
  },
  [RISK_LEVELS.MODERATE]: {
    label: 'Moderate Risk',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    icon: '⚠️'
  },
  [RISK_LEVELS.LOW]: {
    label: 'Low Risk',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: '✅'
  },
  [RISK_LEVELS.UNKNOWN]: {
    label: 'Unmonitored',
    badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    icon: 'ℹ️'
  }
};

const CONFIDENCE_STYLES = {
  [CONFIDENCE_LEVELS.HIGH]: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  [CONFIDENCE_LEVELS.MEDIUM]: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  [CONFIDENCE_LEVELS.LOW]: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  [CONFIDENCE_LEVELS.INSUFFICIENT]: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Reusable helper that renders an independently collapsible section card.
 */
function renderInsightSectionCard({
  id,
  title,
  subtitle,
  icon,
  badgeText,
  badgeColor,
  isExpanded,
  contentHtml
}) {
  return `
    <div class="insight-collapsible-card w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden transition-all duration-200">
      <button
        type="button"
        class="insight-section-toggle-btn w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer select-none"
        data-toggle-insight-section="${id}"
        aria-expanded="${isExpanded ? 'true' : 'false'}"
        title="Click to ${isExpanded ? 'collapse' : 'expand'} ${escapeHtml(title)}"
      >
        <div class="flex items-center gap-3.5 min-w-0 pr-3">
          <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-xl shrink-0 select-none shadow-2xs">
            ${icon}
          </div>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-base font-bold text-slate-900 dark:text-white truncate">
                ${escapeHtml(title)}
              </h3>
              ${badgeText ? `
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}">
                  ${badgeText}
                </span>
              ` : ''}
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-400 truncate">
              ${escapeHtml(subtitle)}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5 shrink-0 ml-2">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline select-none">
            ${isExpanded ? 'Collapse' : 'Expand'}
          </span>
          <div class="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : 'rotate-0'
          }">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      ${isExpanded ? `
        <div class="insight-section-content px-4 pb-5 sm:px-6 sm:pb-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-5">
          ${contentHtml}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Master renderer for the Food Cost & Spoilage Intelligence Dashboard.
 * Serves as a clean section container housing the 5 independently collapsible insight areas.
 *
 * @param {Object} state - Main application state
 * @returns {string} HTML string
 */
export function renderHouseholdInsightsDashboard(state = {}) {
  const currentPeriod = state.insightsPeriod || REPORTING_PERIODS.LAST_30_DAYS;
  const householdMembers = state.householdMembers || 4;

  // Track independent expanded states (default: collapsed)
  const expandedMap = state.insightsSections || {};
  const isScorecardExpanded = expandedMap.scorecard === true;
  const isFinancialExpanded = expandedMap.financial === true;
  const isRiskAlertsExpanded = expandedMap.riskAlerts === true;
  const isPurchasingExpanded = expandedMap.purchasing === true;
  const isTrendsExpanded = expandedMap.trends === true;

  // 1. Core Household Insights (Phase 3)
  const insights = calculateHouseholdInsights({
    period: currentPeriod,
    householdMembers
  });
  const { overview, dateRange, trends, categoryBreakdown, categoriesToWatch, performance, savingsOpportunities } = insights;

  // 2. Predictive Insights & Monthly Report (Phase 5)
  const consumption = analyzeHouseholdConsumption({ householdMembers });
  const wasteRisks = predictFoodWasteRisks({ consumptionAnalysis: consumption });
  const purchasing = predictGroceryPurchases({ consumptionAnalysis: consumption, householdMembers });
  const report = generateMonthlyHouseholdReport();
  const scorecard = report.scorecard;

  const confStyle = CONFIDENCE_STYLES[consumption.confidence] || CONFIDENCE_STYLES[CONFIDENCE_LEVELS.INSUFFICIENT];

  // -------------------------------------------------------------------------
  // SECTION 1: HOUSEHOLD SUSTAINABILITY SCORECARD CONTENT
  // -------------------------------------------------------------------------
  const scorecardHtml = `
    <div class="flex flex-col gap-4">
      <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-3xl shadow-inner ${
            scorecard.grade === 'A'
              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              : (scorecard.grade === 'B'
                ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30')
          }">
            ${scorecard.grade}
          </div>
          <div>
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                ${scorecard.score}
              </span>
              <span class="text-sm font-semibold text-slate-400">/ 100 Points</span>
            </div>
            <div class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
              ${scorecard.score >= 80 ? '🌟 Excellent Household Stewardship' : (scorecard.score >= 60 ? '👍 Good Baseline Performance' : '⚠️ Room for Purchasing Optimization')}
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
              ${escapeHtml(scorecard.gradeExplanation || 'Comprehensive composite score evaluating purchasing accuracy, inventory rotation, and food waste minimization.')}
            </p>
          </div>
        </div>

        <div class="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1 text-xs">
          <span class="font-mono font-bold text-slate-700 dark:text-slate-300">100 Pts Maximum</span>
          <span class="text-[11px] text-slate-400">5 Weighted Categories</span>
        </div>
      </div>

      <!-- Category Indicators Breakdown Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
        ${scorecard.breakdown.map(ind => {
          const pct = Math.max(0, Math.min(100, Math.round((ind.score / ind.maxScore) * 100)));
          return `
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2.5">
              <div>
                <div class="flex items-center justify-between text-xs mb-1">
                  <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(ind.indicator)}</span>
                  <span class="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">${ind.score} / ${ind.maxScore} pts</span>
                </div>
                <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div class="bg-emerald-500 h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                ${escapeHtml(ind.detail)}
              </p>
            </div>
          `;
        }).join('')}
      </div>

      <div class="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
        <span>ℹ️</span>
        <span>Score updates dynamically with recorded grocery trips, inventory consumption, and measured waste logs.</span>
      </div>
    </div>
  `;

  // -------------------------------------------------------------------------
  // SECTION 2: FINANCIAL IMPACT & COST QUANTIFICATION CONTENT
  // -------------------------------------------------------------------------
  const financialHtml = `
    <div class="flex flex-col gap-4">
      <!-- 3 Impact Metric Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Realized Waste Cost -->
        <div class="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 flex flex-col justify-between">
          <div>
            <span class="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
              Realized Food Cost
            </span>
            <div class="text-2xl font-black font-mono text-rose-900 dark:text-rose-200 mt-1">
              ${formatPeso(report.wasteCost.totalEstimatedWasteCost)}
            </div>
          </div>
          <span class="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-2 font-medium">
            ${report.wasteCost.pricedRecordsCount} verified from actual receipt unit prices
          </span>
        </div>

        <!-- Avoidable Purchases -->
        <div class="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 flex flex-col justify-between">
          <div>
            <span class="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
              Avoidable Purchases
            </span>
            <div class="text-2xl font-black font-mono text-emerald-900 dark:text-emerald-200 mt-1">
              ${report.potentialPurchaseSavingsFormatted}
            </div>
          </div>
          <span class="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-2 font-medium">
            ${report.totalPotentialReductionKg.toFixed(1)} kg surplus covered by on-hand inventory
          </span>
        </div>

        <!-- Weekly Household Consumption -->
        <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <span class="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
              Weekly Consumption
            </span>
            <div class="text-2xl font-black font-mono text-slate-900 dark:text-slate-100 mt-1">
              ${consumption.totalHouseholdConsumedKg.toFixed(1)} kg
            </div>
          </div>
          <span class="text-[11px] text-slate-500 mt-2 font-medium">
            Across ${consumption.totalExplicitConsumptionEvents} tracked inventory meal events
          </span>
        </div>
      </div>

      <!-- Historical Spending Comparison Banner -->
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-3">
        <span class="text-xl select-none leading-none mt-0.5">📊</span>
        <div class="flex flex-col gap-0.5">
          <span class="font-bold text-slate-900 dark:text-slate-100">Historical Expenditure Comparison:</span>
          <span class="leading-relaxed">
            ${escapeHtml(compareGrocerySpendingPeriods(consumption.categories[FOOD_CATEGORIES.VEGETABLES]?.totalPurchasedKg ? 1 : 0, 0).statement)}
          </span>
        </div>
      </div>

      <!-- Household Savings Opportunities Cards -->
      ${savingsOpportunities.length > 0 ? `
        <div class="flex flex-col gap-2 mt-1">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Actionable Savings Opportunities
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${savingsOpportunities.map(opp => `
              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                <span class="text-2xl select-none leading-none mt-0.5">${opp.icon}</span>
                <div class="flex flex-col gap-1 flex-1">
                  <div class="text-xs font-bold text-slate-900 dark:text-slate-100">${escapeHtml(opp.title)}</div>
                  <div class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(opp.description)}</div>
                  <div class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                    <span>👉</span> <span>${escapeHtml(opp.action)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // -------------------------------------------------------------------------
  // SECTION 3: FOOD-WASTE RISK ALERTS & FORECAST CONTENT
  // -------------------------------------------------------------------------
  const riskAlertsHtml = `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between flex-wrap gap-2 pb-1">
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
          Evaluates inventory consumption velocity against recorded expiration dates to identify perishables at risk of spoiling.
        </p>
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
          ${wasteRisks.highRiskCount === 0 && wasteRisks.moderateRiskCount === 0 ? `
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              ✅ All Items Fresh
            </span>
          ` : ''}
        </div>
      </div>

      ${wasteRisks.risks.length > 0 ? `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          ${wasteRisks.risks.slice(0, 6).map(risk => {
            const badge = RISK_BADGES[risk.riskLevel] || RISK_BADGES[RISK_LEVELS.UNKNOWN];
            return `
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border ${
                risk.riskLevel === RISK_LEVELS.HIGH
                  ? 'border-rose-300 dark:border-rose-900/60 shadow-xs'
                  : 'border-slate-200/80 dark:border-slate-800'
              } flex flex-col justify-between gap-3">
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
                    <span class="text-[10px] text-slate-400 uppercase font-sans block">Shelf-Life</span>
                    <span class="font-bold ${
                      risk.daysUntilExpiration !== null && risk.daysUntilExpiration <= 3
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-700 dark:text-slate-300'
                    }">
                      ${risk.daysUntilExpiration !== null ? `${risk.daysUntilExpiration} days` : 'No date'}
                    </span>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 uppercase font-sans block">Time to Consume</span>
                    <span class="font-bold ${
                      risk.estimatedDaysToConsume !== null && risk.daysUntilExpiration !== null && risk.estimatedDaysToConsume > risk.daysUntilExpiration
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }">
                      ${risk.estimatedDaysToConsume !== null ? `~${risk.estimatedDaysToConsume} days` : '—'}
                    </span>
                  </div>
                </div>

                <!-- Reason & Action -->
                <div class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  ${escapeHtml(risk.explanation)}
                </div>
                <div class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
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
            All on-hand inventory items are comfortably within their estimated consumption horizons.
          </p>
        </div>
      `}

      <!-- Over-Buying Pattern Cautions (Categories to Watch) -->
      ${categoriesToWatch.hasAlerts ? `
        <div class="flex flex-col gap-2 mt-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>⚠️</span> Recurring Over-Buying Cautions (Phase 2 Rules)
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${categoriesToWatch.items.map(item => {
              const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES[FOOD_CATEGORIES.OTHER];
              return `
                <div class="p-3.5 rounded-xl border bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 flex flex-col gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-xs">
                      <span class="text-base select-none leading-none">${style.icon}</span>
                      <span>${item.category}</span>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                      ${item.status}
                    </span>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-xs font-mono py-1 border-y border-slate-200/40 dark:border-slate-800/60">
                    <div>
                      <span class="text-[10px] text-slate-400 block font-sans">Historical Waste</span>
                      <span class="font-bold text-slate-800 dark:text-slate-200">${item.historicalWasteKg} kg</span>
                    </div>
                    <div>
                      <span class="text-[10px] text-slate-400 block font-sans">Waste Ratio</span>
                      <span class="font-bold text-slate-800 dark:text-slate-200">${item.wasteRatioPercent}%</span>
                    </div>
                  </div>
                  <div class="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                    <span class="text-emerald-500 select-none">💡</span>
                    <span>${escapeHtml(item.recommendation)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // -------------------------------------------------------------------------
  // SECTION 4: PREDICTIVE PURCHASING RECOMMENDATIONS CONTENT
  // -------------------------------------------------------------------------
  const purchasingHtml = `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between flex-wrap gap-2 pb-1">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Calculated using: <code>expected_consumption + planned_meals - available_inventory</code>.
        </p>
        <span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
          Inventory-Aware Planning (${householdMembers} Members)
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        ${purchasing.recommendations.map(rec => `
          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2.5">
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
  `;

  // -------------------------------------------------------------------------
  // SECTION 5: HISTORICAL TRENDS & PROGRESS CONTENT
  // -------------------------------------------------------------------------
  const trendsHtml = `
    <div class="flex flex-col gap-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 1. Grocery Spending Chart Over Time -->
        <div class="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1">
              <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <span>📈</span> Grocery Spending Over Time
              </h4>
              <span class="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                Actual Costs (₱)
              </span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              Weekly grocery expenditures for the selected reporting duration.
            </p>

            ${trends.hasData ? `
              <div class="spending-bars-container flex items-end gap-3 h-40 pt-4 pb-2 px-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                ${trends.periods.map(p => {
                  const maxVal = Math.max(trends.maxSpending, 1000);
                  const heightPct = Math.max(Math.round((p.spending / maxVal) * 100), 4);
                  return `
                    <div class="flex-1 flex flex-col items-center gap-1 min-w-[46px] h-full justify-end group">
                      <div class="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                        ₱${p.spending >= 1000 ? `${(p.spending / 1000).toFixed(1)}k` : p.spending}
                      </div>
                      <div class="w-full max-w-[36px] rounded-t-lg bg-emerald-600/80 group-hover:bg-emerald-500 transition-all shadow-xs" style="height: ${heightPct}%;"></div>
                      <div class="text-[10px] font-mono text-slate-500 whitespace-nowrap mt-1">
                        ${p.label}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-400 mt-2.5">
                <span>Grouped by week</span>
                <span>Peak: ${formatPeso(trends.maxSpending)}</span>
              </div>
            ` : `
              <div class="py-8 px-4 text-center rounded-xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800">
                <span class="text-2xl mb-1 select-none opacity-60">🧾</span>
                <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">No Spending Recorded Yet</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Scan receipts or record shopping trips to populate weekly trajectory.</p>
              </div>
            `}
          </div>
        </div>

        <!-- 2. Food Waste Category Breakdown -->
        <div class="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1">
              <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <span>⚖️</span> Where Your Food Waste Comes From
              </h4>
              ${categoryBreakdown.highestCategory ? `
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                  Top: ${categoryBreakdown.highestCategory}
                </span>
              ` : ''}
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              Distribution of measured kitchen scrap and food spoilage by category.
            </p>

            ${categoryBreakdown.hasWasteData ? `
              <div class="flex flex-col gap-2.5">
                ${categoryBreakdown.categories.filter(c => c.wasteWeightKg > 0).map(cat => {
                  const style = CATEGORY_STYLES[cat.category] || CATEGORY_STYLES[FOOD_CATEGORIES.OTHER];
                  return `
                    <div class="flex flex-col gap-1 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <div class="flex items-center justify-between text-xs">
                        <div class="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                          <span class="text-base select-none leading-none">${style.icon}</span>
                          <span>${cat.category}</span>
                        </div>
                        <div class="flex items-center gap-1.5 font-mono">
                          <span class="font-bold text-slate-900 dark:text-slate-100">${cat.wasteWeightKg.toFixed(2)} kg</span>
                          <span class="text-slate-400 text-[11px]">(${cat.wastePercentage}%)</span>
                        </div>
                      </div>
                      <div class="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div class="${style.barClass} h-full rounded-full transition-all duration-500" style="width: ${Math.max(cat.wastePercentage, 2)}%;"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div class="py-8 px-4 text-center rounded-xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800">
                <span class="text-2xl mb-1 select-none opacity-60">🥬</span>
                <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">No Food Waste Logged</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Log kitchen waste records to visualize which food groups contribute to spoilage.</p>
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- 3. Household Food-Waste Performance vs. Prior Period -->
      <div class="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
            <span>🔄</span> Household Performance (vs. Prior Comparable Period)
          </h4>
        </div>

        ${performance.hasSufficientData ? `
          <div class="flex flex-col gap-3">
            ${performance.wasteReductionClaim ? `
              <div class="p-3.5 rounded-xl ${
                performance.isWasteImproved
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300'
              } flex items-center gap-3">
                <span class="text-2xl select-none leading-none">${performance.isWasteImproved ? '🎉' : '⚠️'}</span>
                <div>
                  <div class="text-sm font-bold">${performance.wasteReductionClaim}</div>
                  <div class="text-[11px] opacity-80 mt-0.5">
                    ${performance.isWasteImproved ? 'Purchasing adjustments are successfully curtailing food spoilage.' : 'Review excess perishable grocery purchases.'}
                  </div>
                </div>
              </div>
            ` : ''}

            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] uppercase font-semibold text-slate-400 block">Food Waste</span>
                <div class="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                  ${overview.totalWasteWeightKg.toFixed(2)} kg
                </div>
                <span class="text-[11px] text-slate-400 block mt-0.5">
                  Prior: ${insights.previousWasteWeightKg.toFixed(2)} kg
                </span>
              </div>

              <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] uppercase font-semibold text-slate-400 block">Grocery Spending</span>
                <div class="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                  ${overview.totalSpendingFormatted}
                </div>
                <span class="text-[11px] text-slate-400 block mt-0.5">
                  Prior: ${formatPeso(insights.previousSpending)}
                  ${performance.spendChangePercent !== null ? `(${performance.spendChangePercent > 0 ? '+' : ''}${performance.spendChangePercent}%)` : ''}
                </span>
              </div>
            </div>
          </div>
        ` : `
          <div class="py-6 px-4 text-center rounded-xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800">
            <span class="text-2xl mb-1 select-none opacity-60">⏳</span>
            <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">Awaiting Historical Baseline</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Continue recording purchases and waste logs to establish a reliable comparative baseline.</p>
          </div>
        `}
      </div>
    </div>
  `;

  return `
    <div class="household-insights-container flex flex-col gap-6 w-full max-w-7xl mx-auto mb-8">
      
      <!-- MAIN FOOD COST & SPOILAGE INTELLIGENCE CONTAINER -->
      <div class="insights-main-card rounded-2xl w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 sm:p-6 flex flex-col gap-5">
        
        <!-- Header with Confidence Pill & Expand/Collapse All Buttons -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                📊 Household Grocery Insights
              </span>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${confStyle}">
                <span class="w-1.5 h-1.5 rounded-full ${
                  consumption.confidence === CONFIDENCE_LEVELS.HIGH ? 'bg-emerald-500' : (consumption.confidence === CONFIDENCE_LEVELS.MEDIUM ? 'bg-amber-500' : 'bg-slate-400')
                }"></span>
                <span>${escapeHtml(consumption.confidence)} Confidence</span>
              </span>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-1">
              <span>🧠</span> Food Cost & Spoilage Intelligence
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Consolidated grocery expenditure, scale-measured weights, predictive spoilage warnings, and verifiable food-waste prevention.
            </p>
          </div>

          <!-- Section Convenience Controls -->
          <div class="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <button
              type="button"
              id="insights-expand-all-btn"
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
              title="Expand all 5 insight categories"
            >
              Expand All
            </button>
            <button
              type="button"
              id="insights-collapse-all-btn"
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
              title="Collapse all 5 insight categories"
            >
              Collapse All
            </button>
          </div>
        </div>

        <!-- Dashboard Controls: Reporting Period Filters, Inventory Radar, Household Size & Date Range -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- Reporting Period Filters Bar -->
          <div class="inline-flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-xl shadow-2xs overflow-x-auto max-w-full">
            ${Object.values(REPORTING_PERIODS).map(p => {
              const isActive = currentPeriod === p;
              const label = PERIOD_LABELS[p];
              return `
                <button
                  type="button"
                  data-insights-period="${p}"
                  class="insights-period-btn px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                  }"
                  title="Filter dashboard to ${label}"
                >
                  ${label}
                </button>
              `;
            }).join('')}
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <!-- Phase 4 Inventory Radar Pill -->
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs">
              <span class="text-base select-none leading-none">📦</span>
              <div class="flex flex-col">
                <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Inventory Radar</span>
                <span class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>${overview.inventoryItemsCount || 0} Items</span>
                  ${overview.expiringSoonCount > 0 ? `
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      ${overview.expiringSoonCount} Expiring Soon
                    </span>
                  ` : ''}
                </span>
              </div>
            </div>

            <!-- Household Size Context Pill (Reusing Phase 1) -->
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs">
              <span class="text-base select-none leading-none">👨‍👩‍👧‍👦</span>
              <div class="flex flex-col">
                <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Household Size</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">
                  ${overview.householdMembers} ${overview.householdMembers === 1 ? 'Member' : 'Members'}
                </span>
              </div>
            </div>

            <!-- Active Date Boundary Label -->
            <div class="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 px-1">
              <span>📅</span>
              <span>${dateRange.startDate}</span>
              <span>→</span>
              <span>${dateRange.endDate}</span>
            </div>
          </div>
        </div>

        <!-- Primary Overview KPI Cards Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- 1. Total Grocery Spending Card -->
          <div class="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Grocery Spending
              </span>
              <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                ₱
              </span>
            </div>
            <div class="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              ${overview.totalSpendingFormatted}
            </div>
            <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
              <span class="font-medium text-slate-700 dark:text-slate-300">
                ${overview.spendingPerMemberFormatted} <span class="text-[11px] font-normal text-slate-400">/ member</span>
              </span>
              <span class="text-[11px] text-slate-400">
                ${overview.tripsCount} ${overview.tripsCount === 1 ? 'shopping trip' : 'shopping trips'} recorded
              </span>
            </div>
          </div>

          <!-- 2. Total Grocery Weight Card -->
          <div class="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Grocery Weight
              </span>
              <span class="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-sm">
                ⚖️
              </span>
            </div>
            <div class="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              ${overview.totalPurchasedWeightKg > 0 ? `${overview.totalPurchasedWeightKg.toFixed(1)} <span class="text-base font-normal text-slate-400">kg</span>` : '—'}
            </div>
            <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
              <span class="font-medium text-slate-700 dark:text-slate-300">
                ${overview.purchaseWeightPerMember > 0 ? `${overview.purchaseWeightPerMember.toFixed(1)} kg` : '—'} <span class="text-[11px] font-normal text-slate-400">/ member</span>
              </span>
              <span class="text-[11px] ${overview.isWeightIncomplete ? 'text-amber-500 font-medium' : 'text-slate-400'}">
                ${overview.isWeightIncomplete ? '⚠️ Incomplete scale weight data' : 'Physical digital scale weight'}
              </span>
            </div>
          </div>

          <!-- 3. Recorded Food Waste Card -->
          <div class="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Recorded Food Waste
              </span>
              <span class="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm">
                🗑️
              </span>
            </div>
            <div class="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight ${overview.totalWasteWeightKg > 0 ? 'text-rose-600 dark:text-rose-400' : ''}">
              ${overview.totalWasteWeightKg > 0 ? `${overview.totalWasteWeightKg.toFixed(2)} <span class="text-base font-normal text-slate-400">kg</span>` : '0.00 <span class="text-base font-normal text-slate-400">kg</span>'}
            </div>
            <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
              <span class="font-medium text-slate-700 dark:text-slate-300">
                ${overview.wasteWeightPerMember > 0 ? `${overview.wasteWeightPerMember.toFixed(2)} kg` : '0 kg'} <span class="text-[11px] font-normal text-slate-400">/ member</span>
              </span>
              <span class="text-[11px] text-slate-400">
                ${overview.totalWasteCost > 0 ? `Est. waste value: ${overview.totalWasteCostFormatted}` : 'Measured kitchen scale logs'}
              </span>
            </div>
          </div>

          <!-- 4. Waste-to-Purchase Ratio Card -->
          <div class="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Waste-to-Purchase Ratio
              </span>
              <span class="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-sm">
                📉
              </span>
            </div>
            <div class="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              ${overview.wasteRatioFormatted}
            </div>
            <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
              <span class="font-medium text-slate-700 dark:text-slate-300">
                Recorded waste ratio
              </span>
              <span class="text-[11px] text-slate-400">
                ${overview.wasteRatio !== null ? `${overview.totalWasteWeightKg.toFixed(2)} kg of ${overview.totalPurchasedWeightKg.toFixed(1)} kg` : 'Awaiting comparable weight logs'}
              </span>
            </div>
          </div>
        </div>

      </div>

      <!-- 5 INDEPENDENTLY COLLAPSIBLE INSIGHT SECTION CARDS -->
      <div class="flex flex-col gap-4 w-full">

        <!-- 1. Household Sustainability Scorecard -->
        ${renderInsightSectionCard({
          id: 'scorecard',
          title: 'Household Sustainability Scorecard',
          subtitle: 'Overall score, performance grade, and 5-category stewardship breakdown.',
          icon: '🏅',
          badgeText: `Grade ${scorecard.grade} (${scorecard.score}/100)`,
          badgeColor: scorecard.grade === 'A'
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
            : (scorecard.grade === 'B'
              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'),
          isExpanded: isScorecardExpanded,
          contentHtml: scorecardHtml
        })}

        <!-- 2. Financial Impact & Cost Quantification -->
        ${renderInsightSectionCard({
          id: 'financial',
          title: 'Financial Impact & Cost Quantification',
          subtitle: 'Realized food cost, avoidable purchases, weekly consumption, and comparisons.',
          icon: '💰',
          badgeText: `Waste: ${formatPeso(report.wasteCost.totalEstimatedWasteCost)} · Avoidable: ${report.potentialPurchaseSavingsFormatted}`,
          badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
          isExpanded: isFinancialExpanded,
          contentHtml: financialHtml
        })}

        <!-- 3. Food-Waste Risk Alerts & Days-to-Consume Forecast -->
        ${renderInsightSectionCard({
          id: 'riskAlerts',
          title: 'Food-Waste Risk Alerts & Days-to-Consume Forecast',
          subtitle: 'Perishable spoilage risks, expiration alerts, and velocity-based forecasts.',
          icon: '⚠️',
          badgeText: wasteRisks.highRiskCount > 0
            ? `🚨 ${wasteRisks.highRiskCount} High Risk`
            : (wasteRisks.moderateRiskCount > 0 ? `⚠️ ${wasteRisks.moderateRiskCount} Moderate` : '✅ 0 Spoilage Risks'),
          badgeColor: wasteRisks.highRiskCount > 0
            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
            : (wasteRisks.moderateRiskCount > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'),
          isExpanded: isRiskAlertsExpanded,
          contentHtml: riskAlertsHtml
        })}

        <!-- 4. Predictive Purchasing Recommendations -->
        ${renderInsightSectionCard({
          id: 'purchasing',
          title: 'Predictive Purchasing Recommendations',
          subtitle: 'Recommended grocery purchases considering inventory, consumption, and meal plans.',
          icon: '🛒',
          badgeText: `${purchasing.recommendations.filter(r => r.recommendedPurchaseKg > 0).length} Categories Recommended`,
          badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
          isExpanded: isPurchasingExpanded,
          contentHtml: purchasingHtml
        })}

        <!-- 5. Historical Trends & Progress -->
        ${renderInsightSectionCard({
          id: 'trends',
          title: 'Historical Trends & Progress',
          subtitle: 'Week-by-week comparisons of household spending, purchases, and food waste.',
          icon: '📈',
          badgeText: `${overview.totalSpendingFormatted} Spent · ${overview.wasteRatioFormatted} Waste`,
          badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
          isExpanded: isTrendsExpanded,
          contentHtml: trendsHtml
        })}

      </div>

    </div>
  `;
}
