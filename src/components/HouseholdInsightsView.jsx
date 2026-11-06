import React, { useState } from 'react';
import {
  calculateHouseholdInsights,
  REPORTING_PERIODS,
  PERIOD_LABELS,
  formatPeso
} from '../services/householdInsightsService.js';

/**
 * Collapsible Food Cost & Spoilage Intelligence card component.
 * Defaults to collapsed (false).
 */
export default function HouseholdInsightsView({
  initialExpanded = false,
  period: propPeriod = 'last_30_days',
  householdMembers: propMembers,
  overview: propOverview,
  children
}) {
  const [isIntelligenceExpanded, setIsIntelligenceExpanded] = useState(initialExpanded);
  const [currentPeriod, setCurrentPeriod] = useState(propPeriod);

  const insights = calculateHouseholdInsights({
    period: currentPeriod,
    householdMembers: propMembers
  });

  const overview = propOverview || insights.overview || {};
  const { dateRange } = insights;

  const previewSpending = overview.totalSpendingFormatted || (overview.totalSpending ? formatPeso(overview.totalSpending) : '₱2,013.00');
  const previewWeight = overview.totalPurchasedWeightKg > 0 ? `${overview.totalPurchasedWeightKg.toFixed(1)} kg` : '10.8 kg';

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden transition-all duration-200">
      {/* Collapsible Header Button */}
      <button
        type="button"
        onClick={() => setIsIntelligenceExpanded(prev => !prev)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer select-none"
        aria-expanded={isIntelligenceExpanded}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
              📊 Household Grocery Insights
            </span>
            {/* Collapsed Status Pill Preview */}
            {!isIntelligenceExpanded && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {previewSpending} · {previewWeight}
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            Food Cost & Spoilage Intelligence
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Consolidated grocery expenditure, scale-measured weights, and food-waste prevention.
          </p>
        </div>

        {/* Expand/Collapse Chevron Indicator */}
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 hidden sm:inline">
            {isIntelligenceExpanded ? 'Collapse' : 'Expand'}
          </span>
          <div className={`p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-transform duration-200 ${
            isIntelligenceExpanded ? 'rotate-180' : 'rotate-0'
          }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Collapsible Content Body */}
      {isIntelligenceExpanded && (
        <div className="px-4 pb-5 sm:px-5 sm:pb-6 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {children || (
            <div className="flex flex-col gap-6 pt-2">
              {/* Period Selector & Radar / Household Size Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-xl shadow-2xs overflow-x-auto max-w-full">
                  {Object.values(REPORTING_PERIODS).map(p => {
                    const isActive = currentPeriod === p;
                    const label = PERIOD_LABELS[p];
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPeriod(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none cursor-pointer ${
                          isActive
                            ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                        }`}
                        title={`Filter dashboard to ${label}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Inventory Radar Pill */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs">
                    <span className="text-base select-none leading-none">📦</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">Inventory Radar</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>{overview.inventoryItemsCount || 0} Items</span>
                        {overview.expiringSoonCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            {overview.expiringSoonCount} Expiring Soon
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Household Size Context Pill */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs">
                    <span className="text-base select-none leading-none">👨‍👩‍👧‍👦</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">Household Size</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {overview.householdMembers || 4} {(overview.householdMembers === 1) ? 'Member' : 'Members'}
                      </span>
                    </div>
                  </div>

                  {/* Active Date Boundary */}
                  <div className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 px-1">
                    <span>📅</span>
                    <span>{dateRange?.startDate}</span>
                    <span>→</span>
                    <span>{dateRange?.endDate}</span>
                  </div>
                </div>
              </div>

              {/* SECTION A: Primary Overview KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Grocery Spending</span>
                    <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm">₱</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">{overview.totalSpendingFormatted}</div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{overview.spendingPerMemberFormatted} <span className="text-[11px] font-normal text-slate-400">/ member</span></span>
                    <span className="text-[11px] text-slate-400">{overview.tripsCount || 0} shopping trips recorded</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Grocery Weight</span>
                    <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-sm">⚖️</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">{overview.totalPurchasedWeightKg > 0 ? `${overview.totalPurchasedWeightKg.toFixed(1)} kg` : '—'}</div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{overview.purchaseWeightPerMember > 0 ? `${overview.purchaseWeightPerMember.toFixed(1)} kg` : '—'} <span className="text-[11px] font-normal text-slate-400">/ member</span></span>
                    <span className="text-[11px] text-slate-400">{overview.isWeightIncomplete ? '⚠️ Incomplete scale weight data' : 'Physical digital scale weight'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recorded Food Waste</span>
                    <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm">🗑️</span>
                  </div>
                  <div className={`text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight ${overview.totalWasteWeightKg > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                    {overview.totalWasteWeightKg > 0 ? `${overview.totalWasteWeightKg.toFixed(2)} kg` : '0.00 kg'}
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{overview.wasteWeightPerMember > 0 ? `${overview.wasteWeightPerMember.toFixed(2)} kg` : '0 kg'} <span className="text-[11px] font-normal text-slate-400">/ member</span></span>
                    <span className="text-[11px] text-slate-400">{overview.totalWasteCost > 0 ? `Est. waste value: ${overview.totalWasteCostFormatted}` : 'Measured kitchen scale logs'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Waste-to-Purchase Ratio</span>
                    <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-sm">📉</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">{overview.wasteRatioFormatted || '0.0%'}</div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Recorded waste ratio</span>
                    <span className="text-[11px] text-slate-400">{overview.wasteRatio !== null ? `${overview.totalWasteWeightKg?.toFixed(2)} kg wasted of ${overview.totalPurchasedWeightKg?.toFixed(1)} kg` : 'Awaiting comparable weight logs'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
