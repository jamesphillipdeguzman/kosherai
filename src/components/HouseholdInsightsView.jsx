import React, { useState } from 'react';
import {
  calculateHouseholdInsights,
  REPORTING_PERIODS,
  PERIOD_LABELS,
  formatPeso
} from '../services/householdInsightsService.js';
import {
  analyzeHouseholdConsumption,
  predictFoodWasteRisks,
  predictGroceryPurchases,
  compareGrocerySpendingPeriods,
  generateMonthlyHouseholdReport
} from '../services/predictiveSavingsService.js';
import { FOOD_CATEGORIES } from '../services/overBuyingDetector.js';

/**
 * Reusable React Card for an independently collapsible insight category.
 */
function InsightSectionCard({
  id,
  title,
  subtitle,
  icon,
  badgeText,
  badgeColor,
  isExpanded,
  onToggle,
  children
}) {
  return (
    <div className="insight-collapsible-card bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden transition-all duration-200">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="insight-section-toggle-btn w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer select-none"
        data-toggle-insight-section={id}
        aria-expanded={isExpanded}
        title={`Click to ${isExpanded ? 'collapse' : 'expand'} ${title}`}
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-xl shrink-0 select-none shadow-2xs">
            {icon}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {title}
              </h3>
              {badgeText && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                  {badgeText}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 ml-2">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 hidden sm:inline select-none">
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
          <div className={`p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : 'rotate-0'
          }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="insight-section-content px-4 pb-5 sm:px-6 sm:pb-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-5">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * React Household Insights Dashboard Component
 * 5 Independently collapsible sections inside a clean section container.
 */
export default function HouseholdInsightsView({
  period: propPeriod = 'last_30_days',
  householdMembers: propMembers = 4,
  overview: propOverview
}) {
  const [currentPeriod, setCurrentPeriod] = useState(propPeriod);
  const [sectionsExpanded, setSectionsExpanded] = useState({
    scorecard: false,
    financial: false,
    riskAlerts: false,
    purchasing: false,
    trends: false
  });

  const toggleSection = (id) => {
    setSectionsExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    setSectionsExpanded({
      scorecard: true,
      financial: true,
      riskAlerts: true,
      purchasing: true,
      trends: true
    });
  };

  const collapseAll = () => {
    setSectionsExpanded({
      scorecard: false,
      financial: false,
      riskAlerts: false,
      purchasing: false,
      trends: false
    });
  };

  const insights = calculateHouseholdInsights({
    period: currentPeriod,
    householdMembers: propMembers
  });
  const overview = propOverview || insights.overview || {};
  const { dateRange, trends, categoryBreakdown, categoriesToWatch, performance, savingsOpportunities } = insights;

  const consumption = analyzeHouseholdConsumption({ householdMembers: propMembers });
  const wasteRisks = predictFoodWasteRisks({ consumptionAnalysis: consumption });
  const purchasing = predictGroceryPurchases({ consumptionAnalysis: consumption, householdMembers: propMembers });
  const report = generateMonthlyHouseholdReport();
  const scorecard = report.scorecard;

  return (
    <div className="household-insights-container flex flex-col gap-6 w-full mb-8">
      {/* MAIN CONTAINER */}
      <div className="insights-main-card rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 sm:p-6 flex flex-col gap-5">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                📊 Household Grocery Insights
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                ● {consumption.confidence} Confidence
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-1">
              <span>🧠</span> Food Cost & Spoilage Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Consolidated grocery expenditure, scale-measured weights, predictive spoilage warnings, and verifiable food-waste prevention.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={expandAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Filters */}
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs">
              <span className="text-base select-none leading-none">📦</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Inventory Radar</span>
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

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs">
              <span className="text-base select-none leading-none">👨‍👩‍👧‍👦</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Household Size</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {overview.householdMembers} {overview.householdMembers === 1 ? 'Member' : 'Members'}
                </span>
              </div>
            </div>

            <div className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 px-1">
              <span>📅</span>
              <span>{dateRange.startDate}</span>
              <span>→</span>
              <span>{dateRange.endDate}</span>
            </div>
          </div>
        </div>

        {/* 4 Overview KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Grocery Spending</span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-bold">₱</span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">{overview.totalSpendingFormatted}</div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
              <span className="font-medium text-slate-700 dark:text-slate-300">{overview.spendingPerMemberFormatted} <span className="text-[11px] font-normal text-slate-400">/ member</span></span>
              <span className="text-[11px] text-slate-400">{overview.tripsCount || 0} shopping trips recorded</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Grocery Weight</span>
              <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-sm">⚖️</span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              {overview.totalPurchasedWeightKg > 0 ? `${overview.totalPurchasedWeightKg.toFixed(1)} kg` : '—'}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
              <span className="font-medium text-slate-700 dark:text-slate-300">{overview.purchaseWeightPerMember > 0 ? `${overview.purchaseWeightPerMember.toFixed(1)} kg` : '—'} <span className="text-[11px] font-normal text-slate-400">/ member</span></span>
              <span className="text-[11px] text-slate-400">{overview.isWeightIncomplete ? '⚠️ Incomplete scale weight data' : 'Physical digital scale weight'}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
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

          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Waste-to-Purchase Ratio</span>
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-sm">📉</span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">{overview.wasteRatioFormatted}</div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
              <span className="font-medium text-slate-700 dark:text-slate-300">Recorded waste ratio</span>
              <span className="text-[11px] text-slate-400">{overview.wasteRatio !== null ? `${overview.totalWasteWeightKg?.toFixed(2)} kg of ${overview.totalPurchasedWeightKg?.toFixed(1)} kg` : 'Awaiting comparable weight logs'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5 INDEPENDENTLY COLLAPSIBLE SECTION CARDS */}
      <div className="flex flex-col gap-4">
        {/* 1. Household Sustainability Scorecard */}
        <InsightSectionCard
          id="scorecard"
          title="Household Sustainability Scorecard"
          subtitle="Overall score, performance grade, and 5-category stewardship breakdown."
          icon="🏅"
          badgeText={`Grade ${scorecard.grade} (${scorecard.score}/100)`}
          badgeColor={scorecard.grade === 'A' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'}
          isExpanded={sectionsExpanded.scorecard}
          onToggle={toggleSection}
        >
          <div className="flex flex-col gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-3xl shadow-inner bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {scorecard.grade}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">{scorecard.score}</span>
                    <span className="text-sm font-semibold text-slate-400">/ 100 Points</span>
                  </div>
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {scorecard.score >= 80 ? '🌟 Excellent Household Stewardship' : '👍 Good Baseline Performance'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {scorecard.breakdown.map(ind => (
                <div key={ind.indicator} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{ind.indicator}</span>
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">{ind.score} / {ind.maxScore} pts</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${(ind.score / ind.maxScore) * 100}%` }}></div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{ind.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </InsightSectionCard>

        {/* 2. Financial Impact & Cost Quantification */}
        <InsightSectionCard
          id="financial"
          title="Financial Impact & Cost Quantification"
          subtitle="Realized food cost, avoidable purchases, weekly consumption, and comparisons."
          icon="💰"
          badgeText={`Waste: ${formatPeso(report.wasteCost.totalEstimatedWasteCost)} · Avoidable: ${report.potentialPurchaseSavingsFormatted}`}
          badgeColor="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
          isExpanded={sectionsExpanded.financial}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Realized Food Cost</span>
                <div className="text-2xl font-black font-mono text-rose-900 dark:text-rose-200 mt-1">{formatPeso(report.wasteCost.totalEstimatedWasteCost)}</div>
              </div>
              <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-2 font-medium">{report.wasteCost.pricedRecordsCount} verified from receipt unit prices</span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Avoidable Purchases</span>
                <div className="text-2xl font-black font-mono text-emerald-900 dark:text-emerald-200 mt-1">{report.potentialPurchaseSavingsFormatted}</div>
              </div>
              <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-2 font-medium">{report.totalPotentialReductionKg.toFixed(1)} kg surplus covered by inventory</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Weekly Consumption</span>
                <div className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100 mt-1">{consumption.totalHouseholdConsumedKg.toFixed(1)} kg</div>
              </div>
              <span className="text-[11px] text-slate-500 mt-2 font-medium">Across {consumption.totalExplicitConsumptionEvents} tracked meal events</span>
            </div>
          </div>
        </InsightSectionCard>

        {/* 3. Food-Waste Risk Alerts & Days-to-Consume Forecast */}
        <InsightSectionCard
          id="riskAlerts"
          title="Food-Waste Risk Alerts & Days-to-Consume Forecast"
          subtitle="Perishable spoilage risks, expiration alerts, and velocity-based forecasts."
          icon="⚠️"
          badgeText={wasteRisks.highRiskCount > 0 ? `🚨 ${wasteRisks.highRiskCount} High Risk` : '✅ 0 Spoilage Risks'}
          badgeColor={wasteRisks.highRiskCount > 0 ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'}
          isExpanded={sectionsExpanded.riskAlerts}
          onToggle={toggleSection}
        >
          {wasteRisks.risks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {wasteRisks.risks.slice(0, 6).map(risk => (
                <div key={risk.itemId} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{risk.itemName}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{risk.quantity} {risk.unit}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{risk.category} • 📍 {risk.storageLocation || 'Kitchen'}</div>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">{risk.explanation}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <span className="text-3xl select-none opacity-60">🥬</span>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2">Zero Spoilage Risks Detected</p>
            </div>
          )}
        </InsightSectionCard>

        {/* 4. Predictive Purchasing Recommendations */}
        <InsightSectionCard
          id="purchasing"
          title="Predictive Purchasing Recommendations"
          subtitle="Recommended grocery purchases considering inventory, consumption, and meal plans."
          icon="🛒"
          badgeText={`${purchasing.recommendations.filter(r => r.recommendedPurchaseKg > 0).length} Categories Recommended`}
          badgeColor="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
          isExpanded={sectionsExpanded.purchasing}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {purchasing.recommendations.map(rec => (
              <div key={rec.category} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2.5">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                    <span>{rec.category}</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">Buy {rec.recommendedPurchaseKg} kg</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-500 mt-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[9px] uppercase font-sans text-slate-400 block">Expected</span>
                      <span>{rec.expectedConsumptionKg} kg</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-sans text-slate-400 block">On-Hand</span>
                      <span>{rec.inventoryOnHandKg} kg</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </InsightSectionCard>

        {/* 5. Historical Trends & Progress */}
        <InsightSectionCard
          id="trends"
          title="Historical Trends & Progress"
          subtitle="Week-by-week comparisons of household spending, purchases, and food waste."
          icon="📈"
          badgeText={`${overview.totalSpendingFormatted} Spent · ${overview.wasteRatioFormatted} Waste`}
          badgeColor="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
          isExpanded={sectionsExpanded.trends}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Grocery Spending</span>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">{overview.totalSpendingFormatted}</div>
              <span className="text-[11px] text-slate-400 block mt-1">{overview.tripsCount || 0} shopping runs in selected period</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Waste-to-Purchase Ratio</span>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">{overview.wasteRatioFormatted}</div>
              <span className="text-[11px] text-slate-400 block mt-1">{overview.totalWasteWeightKg?.toFixed(2)} kg food scrap logged</span>
            </div>
          </div>
        </InsightSectionCard>
      </div>
    </div>
  );
}
