/**
 * KosherAI - Household Grocery Insights Dashboard Component (Phase 3)
 * Consolidates grocery purchases, food-waste records, household size, and over-buying alerts.
 *
 * Implements Sections A through F:
 * - Section A: Household Overview KPI Cards (Spending, Weight, Food Waste, Waste Ratio)
 * - Section B: Spending Trends (Time-series chart over selected period)
 * - Section C: Food Waste Analysis ("Where Your Food Waste Comes From" category breakdown)
 * - Section D: Categories to Watch (Phase 2 smart over-buying alerts)
 * - Section E: Household Food-Waste Performance (Comparison vs previous comparable period)
 * - Section F: Household Savings Opportunities (Actionable data-driven insights)
 */

import {
  REPORTING_PERIODS,
  PERIOD_LABELS,
  formatPeso,
  calculateHouseholdInsights
} from '../services/householdInsightsService.js';
import { FOOD_CATEGORIES } from '../services/overBuyingDetector.js';
import { renderPredictiveInsightsSection } from './PredictiveInsightsView.js';

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

/**
 * Escapes HTML characters for security
 */
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
 * Renders the Household Grocery Insights Dashboard HTML
 *
 * @param {Object} state - Main application state
 * @returns {string} HTML string
 */
export function renderHouseholdInsightsDashboard(state = {}) {
  const currentPeriod = state.insightsPeriod || REPORTING_PERIODS.LAST_30_DAYS;

  const insights = calculateHouseholdInsights({
    period: currentPeriod,
    householdMembers: state.householdMembers
  });

  const { overview, dateRange, trends, categoryBreakdown, categoriesToWatch, performance, savingsOpportunities } = insights;

  return `
    <div class="household-insights-container flex flex-col gap-6 w-full mb-8">
      
      <!-- Dashboard Header with Household Size Context & Period Selector -->
      <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-1.5">
              <span>📊</span> Household Grocery Insights
            </div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Food Cost & Spoilage Intelligence
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Consolidated grocery expenditure, scale-measured weights, and food-waste prevention.
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <!-- Phase 4 Inventory Radar Pill -->
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs">
              <span class="text-base select-none leading-none">📦</span>
              <div class="flex flex-col">
                <span class="text-[10px] text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">Inventory Radar</span>
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
                <span class="text-[10px] text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">Household Size</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">
                  ${overview.householdMembers} ${overview.householdMembers === 1 ? 'Member' : 'Members'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Reporting Period Filters Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
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

          <!-- Active Date Boundary Label -->
          <div class="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>📅</span>
            <span>${dateRange.startDate}</span>
            <span>→</span>
            <span>${dateRange.endDate}</span>
          </div>
        </div>
      </div>

      <!-- SECTION A: PRIMARY OVERVIEW KPI CARDS -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- 1. Total Grocery Spending Card -->
        <div class="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Grocery Spending
            </span>
            <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm">
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
        <div class="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
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

        <!-- 3. Total Food Waste Card -->
        <div class="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
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
        <div class="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
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
              ${overview.wasteRatio !== null ? `${overview.totalWasteWeightKg.toFixed(2)} kg wasted of ${overview.totalPurchasedWeightKg.toFixed(1)} kg` : 'Awaiting comparable weight logs'}
            </span>
          </div>
        </div>

      </div>

      <!-- SECTION B & C: SPENDING TRENDS & FOOD WASTE ANALYSIS GRID -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- SECTION B: SPENDING TRENDS CHART -->
        <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>📈</span> Grocery Spending Over Time
              </h3>
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono">
                Actual Costs (₱)
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Weekly grocery expenditure for the selected reporting period.
            </p>

            ${trends.hasData ? `
              <div class="spending-bars-container flex items-end gap-3 h-44 pt-6 pb-2 px-2 border-b border-slate-100 dark:border-slate-800/80 overflow-x-auto">
                ${trends.periods.map(p => {
                  const maxVal = Math.max(trends.maxSpending, 1000);
                  const heightPct = Math.max(Math.round((p.spending / maxVal) * 100), 4);
                  return `
                    <div class="flex-1 flex flex-col items-center gap-1.5 min-w-[50px] h-full justify-end group">
                      <div class="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 opacity-90 group-hover:opacity-100 transition-opacity">
                        ₱${p.spending >= 1000 ? `${(p.spending / 1000).toFixed(1)}k` : p.spending}
                      </div>
                      <div class="w-full max-w-[40px] rounded-t-lg bg-emerald-600/80 hover:bg-emerald-500 transition-all shadow-xs relative" style="height: ${heightPct}%;">
                        <div class="absolute inset-0 bg-white/10 rounded-t-lg pointer-events-none"></div>
                      </div>
                      <div class="text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap mt-1">
                        ${p.label}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-1">
                <span>Grouped by week</span>
                <span>Max: ${formatPeso(trends.maxSpending)}</span>
              </div>
            ` : `
              <div class="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
                <span class="text-3xl mb-2 select-none opacity-60">🧾</span>
                <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">No Grocery Spending Recorded</p>
                <p class="text-[11px] text-slate-400 max-w-xs mt-1">
                  Scan receipts or record shopping trips in this period to view your spending trajectory.
                </p>
              </div>
            `}
          </div>
        </div>

        <!-- SECTION C: FOOD WASTE CATEGORY BREAKDOWN -->
        <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>⚖️</span> Where Your Food Waste Comes From
              </h3>
              ${categoryBreakdown.highestCategory ? `
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                  Top: ${categoryBreakdown.highestCategory}
                </span>
              ` : ''}
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Measured weight distribution of kitchen scrap and spoilage.
            </p>

            ${categoryBreakdown.hasWasteData ? `
              <div class="flex flex-col gap-3">
                ${categoryBreakdown.categories.filter(c => c.wasteWeightKg > 0).map(cat => {
                  const style = CATEGORY_STYLES[cat.category] || CATEGORY_STYLES[FOOD_CATEGORIES.OTHER];
                  return `
                    <div class="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <div class="flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                          <span class="text-base select-none leading-none">${style.icon}</span>
                          <span>${cat.category}</span>
                        </div>
                        <div class="flex items-center gap-2 font-mono">
                          <span class="font-bold text-slate-900 dark:text-slate-100">${cat.wasteWeightKg.toFixed(2)} kg</span>
                          <span class="text-slate-400 text-[11px]">(${cat.wastePercentage}%)</span>
                        </div>
                      </div>
                      
                      <!-- Visual Bar -->
                      <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700/80 overflow-hidden">
                        <div class="${style.barClass} h-full rounded-full transition-all duration-500" style="width: ${Math.max(cat.wastePercentage, 2)}%;"></div>
                      </div>

                      ${cat.estimatedCost > 0 ? `
                        <div class="flex items-center justify-end text-[10px] text-slate-400 font-mono">
                          Est. cost: ${formatPeso(cat.estimatedCost)}
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div class="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
                <span class="text-3xl mb-2 select-none opacity-60">🥬</span>
                <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">No Food Waste Logged</p>
                <p class="text-[11px] text-slate-400 max-w-xs mt-1">
                  Log plate waste or kitchen scraps during this period to see which food categories contribute to waste.
                </p>
              </div>
            `}
          </div>
        </div>

      </div>

      <!-- SECTION D & E: CATEGORIES TO WATCH & HOUSEHOLD PERFORMANCE -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- SECTION D: OVER-BUYING ALERT SUMMARY (CATEGORIES TO WATCH) -->
        <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>⚠️</span> Categories to Watch
              </h3>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Phase 2 Rules
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Categories with recurring spoilage patterns or active purchase cautions.
            </p>

            ${categoriesToWatch.hasAlerts ? `
              <div class="flex flex-col gap-3">
                ${categoriesToWatch.items.map(item => {
                  const isHigh = item.level === 'high';
                  const isMod = item.level === 'moderate';
                  const badgeColor = isHigh
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                    : isMod
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';

                  const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES[FOOD_CATEGORIES.OTHER];

                  return `
                    <div class="p-3.5 rounded-xl border ${
                      isHigh
                        ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                        : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                    } flex flex-col gap-2">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-xs">
                          <span class="text-base select-none leading-none">${style.icon}</span>
                          <span>${item.category}</span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}">
                          ${item.status}
                        </span>
                      </div>

                      <div class="grid grid-cols-2 gap-2 text-xs font-mono py-1 border-y border-slate-200/40 dark:border-slate-800/60">
                        <div>
                          <span class="text-[10px] text-slate-400 block">Historical Waste</span>
                          <span class="font-bold text-slate-800 dark:text-slate-200">${item.historicalWasteKg} kg</span>
                        </div>
                        <div>
                          <span class="text-[10px] text-slate-400 block">Waste Ratio</span>
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
            ` : `
              <div class="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
                <span class="text-3xl mb-2 select-none opacity-60">✨</span>
                <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">No Recurring Over-Buying Patterns</p>
                <p class="text-[11px] text-slate-400 max-w-xs mt-1">
                  Your household food purchases currently remain within sustainable consumption patterns.
                </p>
              </div>
            `}
          </div>
        </div>

        <!-- SECTION E: HOUSEHOLD FOOD-WASTE PERFORMANCE -->
        <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>🔄</span> Household Performance
              </h3>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                vs. Prior Period
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Comparison against the previous comparable reporting duration.
            </p>

            ${performance.hasSufficientData ? `
              <div class="flex flex-col gap-3">
                
                <!-- Performance Banner -->
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
                        ${performance.isWasteImproved ? 'Purchasing adjustments are successfully curtailing food spoilage.' : 'Review excess perishable purchases.'}
                      </div>
                    </div>
                  </div>
                ` : ''}

                <!-- Comparative Metrics Breakdown -->
                <div class="grid grid-cols-2 gap-3 mt-1">
                  <!-- Waste Comparison -->
                  <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span class="text-[10px] uppercase font-semibold text-slate-400 block">Food Waste</span>
                    <div class="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                      ${overview.totalWasteWeightKg.toFixed(2)} kg
                    </div>
                    <span class="text-[11px] text-slate-400 block mt-0.5">
                      Prior: ${insights.previousWasteWeightKg.toFixed(2)} kg
                    </span>
                  </div>

                  <!-- Spend Comparison -->
                  <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
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
              <div class="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
                <span class="text-3xl mb-2 select-none opacity-60">⏳</span>
                <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">Awaiting Historical Baseline</p>
                <p class="text-[11px] text-slate-400 max-w-xs mt-1">
                  Continue recording purchases and food waste to establish a reliable comparison.
                </p>
              </div>
            `}
          </div>
        </div>

      </div>

      <!-- SECTION F: HOUSEHOLD SAVINGS OPPORTUNITIES -->
      <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>💡</span> Household Savings Opportunities
            </h3>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Actionable Intelligence
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Data-backed recommendations based directly on your recorded transactions and waste entries.
          </p>
        </div>

        ${savingsOpportunities.length > 0 ? `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${savingsOpportunities.map(opp => `
              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                <span class="text-2xl select-none leading-none mt-0.5">${opp.icon}</span>
                <div class="flex flex-col gap-1 flex-1">
                  <div class="text-xs font-bold text-slate-900 dark:text-slate-100">${escapeHtml(opp.title)}</div>
                  <div class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(opp.description)}</div>
                  <div class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <span>👉</span> <span>${escapeHtml(opp.action)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            As you record grocery trips and kitchen waste logs, KosherAI will synthesize personalized savings opportunities here.
          </div>
        `}
      </div>

      <!-- SECTION G: PREDICTIVE HOUSEHOLD INSIGHTS & SAVINGS INTELLIGENCE (Phase 5) -->
      ${renderPredictiveInsightsSection(state)}

    </div>
  `;
}

