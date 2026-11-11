// Six-Week Food Cost and Waste Tracking Component (Sustaining Human Life Project)
// Provides complete Dashboard, Receipt Scanner, Shopping Trips, Grocery Purchases, Food Waste Logger, Meal Planner & CSV Exporter

import {
  getCourseConfig,
  saveCourseConfig,
  getProjectWeekSchedule,
  getProjectWeekForDate,
  getShoppingTrips,
  getGroceryItems,
  getExpenses,
  getFoodWasteRecords,
  getMealPlans,
  getSixWeekComparison,
  saveShoppingTrip,
  updateShoppingTrip,
  deleteShoppingTrip,
  saveStandaloneExpense,
  deleteExpense,
  saveFoodWasteRecord,
  deleteFoodWasteRecord,
  saveMealPlan,
  deleteMealPlan,
  detectDuplicateReceipt,
  exportAllCourseCsvs,
  downloadCsvFile,
  triggerCsvDownload,
  handleExportWeeklySummary,
  handleExportShoppingTrips,
  handleExportItemizedGroceries,
  handleExportFoodWaste,
  showToast,
  hasCourseData,
  PROJECT_CONFIG
} from '../services/courseProjectStorage.js';
import { getHouseholdMembers, isOcrScanEnabled } from '../services/storage.js';
import { detectOverBuying, renderOverBuyingAlertsHtml } from '../services/overBuyingDetector.js';
import { renderHouseholdInsightsDashboard } from './HouseholdInsightsView.js';
import { renderSmartMealPlanner, renderInventoryModal } from './SmartMealPlanningView.js';
import { renderIngredientImageAdminModal } from './IngredientImageAdminModal.js';

export function handleDownloadClick(e, exportFn) {
  if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
  }
  if (typeof exportFn === 'function') {
    return exportFn();
  }
}
if (typeof window !== 'undefined') {
  window.handleDownloadClick = handleDownloadClick;
}

export {
  triggerCsvDownload,
  handleExportWeeklySummary,
  handleExportShoppingTrips,
  handleExportItemizedGroceries,
  handleExportFoodWaste,
  showToast,
  hasCourseData,
  createReceiptItemRowHtml,
  renderReceiptScanModal
};

import { compressImage, scanSupermarketReceipt } from '../services/aiVerification.js';
import { LID_DATABASE, STATUS } from '../data/lidDatabase.js';
import { getDietProfile } from '../data/dietProfiles.js';
import { DIET_RECIPES } from '../data/dietRecipes.js';
import lidRecipes from '../data/lidRecipes.json' with { type: 'json' };
import { renderManualTripModal } from './ManualTripModal.js';
import { renderShoppingTripsView, renderEditTripModal, renderTripCard, renderReceiptLightboxModal } from './ShoppingTripsView.js';
import { normalizeWeek, resolveItemWeek, getGroceryItemName, matchesGroceryQuery } from '../utils/weekNormalization.js';
export { renderManualTripModal, renderShoppingTripsView, renderEditTripModal, renderTripCard, renderReceiptLightboxModal, updateShoppingTrip, normalizeWeek, resolveItemWeek, getGroceryItemName, matchesGroceryQuery };

export function renderCourseProjectView(state = {}) {
  const activeSubTab = state.courseSubTab || 'dashboard'; // 'dashboard' | 'trips' | 'groceries' | 'waste' | 'mealplan' | 'export'
  const config = getCourseConfig();
  const schedule = getProjectWeekSchedule(config.startDate);
  const comparison = getSixWeekComparison();
  const trips = (state.trips && state.trips.length > 0) ? state.trips : getShoppingTrips();
  const lightboxTrip = state.lightboxTripId ? trips.find(t => t.id === state.lightboxTripId) : null;
  const selectedWeek = normalizeWeek(state.selectedWeekView || state.selectedWeek || state.tripsWeekFilter || 'all');

  const getSubNavClasses = (tabKey) => {
    const isActive = activeSubTab === tabKey;
    return isActive
      ? 'subnav-btn active bg-emerald-600 text-white font-bold border border-emerald-600 shadow-sm text-xs font-semibold'
      : 'subnav-btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 text-xs font-semibold';
  };

  return `
    <div class="course-project-container w-full max-w-7xl mx-auto">
      <!-- Course Project Header Banner -->
      <div class="course-header-card bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div class="course-header-top">
          <div>
            <div class="course-pill">Course Research Project</div>
            <h1 class="course-title text-slate-900 dark:text-slate-100 font-bold">Sustaining Human Life: Food Cost & Waste Tracker</h1>
            <p class="course-subtitle text-slate-600 dark:text-slate-300">
              Six-week household study evaluating meal planning, food expenditure, whole-grocery weight, and waste reduction under Low-Iodine Diet (LID) requirements.
            </p>
          </div>
          <div class="course-calendar-badge">
            <span class="badge-icon">📅</span>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Project Start</div>
              <div style="font-weight: 800; font-family: var(--font-mono); color: var(--accent-cyan);">Oct 31, 2026</div>
              <div style="font-size: 0.72rem; color: #34d399;">Sat – Fri Weekly Cycle</div>
            </div>
          </div>
        </div>

        <!-- Weekly Progress Pills / Large Study Cards (All Weeks + W1–W6) -->
        <div class="weekly-cycle-strip">
          <!-- All Weeks Overview Card -->
          <button type="button" class="week-step-pill study-week-card ${selectedWeek === 'all' ? 'active bg-teal-600 text-white dark:bg-teal-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'} ${trips.length > 0 ? 'has-data' : ''}" data-week-select="all" title="View all study weeks (Weeks 1–6)">
            <div class="week-pill-num">All Weeks</div>
            <div class="week-pill-type">Overview</div>
            <div class="week-pill-dates">${trips.length} ${trips.length === 1 ? 'Trip' : 'Trips'}</div>
          </button>

          <!-- W1–W6 Study Cards -->
          ${schedule.map(w => {
    const isCurrent = selectedWeek === w.weekNumber;
    const weekStats = comparison.weeklyData.find(d => d.weekNumber === w.weekNumber);
    const hasData = weekStats && weekStats.hasRecords;
    const weekTripsCount = trips.filter(t => {
      const tripWeek = t.projectWeek ? Number(t.projectWeek) : getProjectWeekForDate(t.date, config.startDate);
      return tripWeek === w.weekNumber;
    }).length;
    const pillClasses = isCurrent
      ? 'active bg-teal-600 text-white dark:bg-teal-500'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
    return `
              <button type="button" class="week-step-pill study-week-card ${pillClasses} ${hasData || weekTripsCount > 0 ? 'has-data' : ''}" data-week-select="${w.weekNumber}" title="Filter study to Week ${w.weekNumber}">
                <div class="week-pill-num">W${w.weekNumber}</div>
                <div class="week-pill-type">${w.isBaseline ? 'Baseline' : (w.weekNumber === 2 ? 'Intervene' : 'Evaluate')}</div>
                <div class="week-pill-dates">${w.startDate.slice(5)} • ${weekTripsCount} ${weekTripsCount === 1 ? 'trip' : 'trips'}</div>
              </button>
            `;
  }).join('')}
        </div>

        <!-- Course Sub-navigation Bar -->
        <div class="course-subnav">
          <button class="${getSubNavClasses('dashboard')}" data-subtab="dashboard">
            <span class="nav-icon text-sm select-none">📊</span> Dashboard & Insights
          </button>
          <button class="${getSubNavClasses('trips')}" data-subtab="trips">
            <span class="nav-icon text-sm select-none">🧾</span> Shopping Trips & Receipts
          </button>
          <button class="${getSubNavClasses('groceries')}" data-subtab="groceries">
            <span class="nav-icon text-sm select-none">🥬</span> Grocery Purchases
          </button>
          <button class="${getSubNavClasses('waste')}" data-subtab="waste">
            <span class="nav-icon text-sm select-none">⚖️</span> Food Waste Log
          </button>
          <button class="${getSubNavClasses('mealplan')}" data-subtab="mealplan">
            <span class="nav-icon text-sm select-none">📋</span> Weekly Meal Planner
          </button>
          <button class="${getSubNavClasses('export')}" data-subtab="export">
            <span class="nav-icon text-sm select-none">📁</span> CSV Export & Report
          </button>
          ${state.isAdmin ? `
            <button class="${getSubNavClasses('manage')}" data-subtab="manage">
              <span class="nav-icon text-sm select-none">🖼️</span> Manage Photos
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Active Subtab Content Area -->
      <div class="course-subtab-content">
        ${renderSubTabContent(activeSubTab, state, comparison, config)}
      </div>

      <!-- Modals rendered conditionally -->
      ${state.receiptModalOpen ? renderReceiptScanModal(state) : ''}
      ${state.manualTripModalOpen ? renderManualTripModal(state) : ''}
      ${state.editTripModalOpen ? renderEditTripModal(state) : ''}
      ${lightboxTrip ? renderReceiptLightboxModal(lightboxTrip) : ''}
      ${state.wasteModalOpen ? renderFoodWasteModal(state) : ''}
      ${state.editWasteModalOpen ? renderEditWasteModal(state) : ''}
      ${state.mealPlanModalOpen ? renderMealPlanModal(state) : ''}
      ${state.configModalOpen ? renderProjectConfigModal(config) : ''}
      ${state.inventoryModalOpen ? renderInventoryModal(state) : ''}
    </div>
  `;
}

function renderSubTabContent(subTab, state, comparison, config) {
  switch (subTab) {
    case 'dashboard':
      return renderDashboardTab(comparison, config, state);
    case 'trips':
      return renderShoppingTripsTab(state);
    case 'groceries':
      return renderGroceryPurchasesTab(state);
    case 'waste':
      return renderFoodWasteTab(state);
    case 'mealplan':
      return renderMealPlanTab(state);
    case 'export':
      return renderExportTab(comparison, config);
    case 'manage':
      return state.isAdmin ? renderIngredientImageAdminModal({
        activeProtocol: state.adminImageProtocol || state.activeDiet || 'lid',
        stats: state.adminImageStats,
        mappings: state.adminImageMappings,
        searchQuery: state.adminImageSearchQuery,
        statusFilter: state.adminImageStatusFilter,
        statusMessage: state.adminImageStatusMsg,
        uploadFormOpen: state.adminImageUploadFormOpen,
        selectedIngredientId: state.adminImageSelectedIngredientId,
        uploadPreviewUrl: state.adminImageUploadPreviewUrl,
        selectedFileName: state.adminImageSelectedFile?.name || null,
        selectedFileSize: state.adminImageSelectedFile?.size || null,
        isUploading: state.adminImageUploading,
        isDiscovering: state.adminImageDiscovering,
        embedded: true
      }) : renderDashboardTab(comparison, config, state);
    default:
      return renderDashboardTab(comparison, config, state);
  }
}

// =========================================================================
// 1. SIX-WEEK COMPARATIVE DASHBOARD
// =========================================================================
function renderDashboardTab(comparison, config, state) {
  const { weeklyData, totals, baselineExpense, baselineWasteKg } = comparison;
  const week1 = weeklyData[0];

  return `
    <div class="dashboard-grid flex flex-col gap-6">
      <!-- 1. Household Grocery Insights Dashboard (Phase 3) -->
      ${renderHouseholdInsightsDashboard(state)}

      <!-- 2. Academic Six-Week Research Study Trajectory Section -->
      <div class="academic-trajectory-section mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 class="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>🔬</span> Six-Week Research Study Trajectory
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Low-Iodine Diet baseline vs. intervention trajectory evaluation (Weeks 1–6).
            </p>
          </div>
        </div>

        <!-- High-Level KPI Summary Cards -->
        <div class="kpi-cards-row">
        <!-- Week 1 Baseline Card -->
        <div class="kpi-card baseline-card">
          <div class="kpi-card-header">
            <span class="kpi-label">Week 1 Baseline Expense</span>
            <span class="kpi-tag">Oct 31 – Nov 6</span>
          </div>
          <div class="kpi-value">₱${formatNumber(baselineExpense)}</div>
          <div class="kpi-subtext">
            <span>Usual shopping routine</span> • 
            <span>Weight: <strong>${week1.totalScaleWeightKg.toFixed(2)} kg</strong></span>
          </div>
          <div class="kpi-footer-note">Configured Baseline: ₱${formatNumber(config.baselineBudget)}</div>
        </div>

        <!-- Cumulative Intervention Savings (Weeks 2-6) -->
        <div class="kpi-card savings-card">
          <div class="kpi-card-header">
            <span class="kpi-label">Intervention Savings (W2–W6)</span>
            <span class="kpi-tag positive">${totals.totalInterventionSavings >= 0 ? 'Cost Savings' : 'Overspend'}</span>
          </div>
          <div class="kpi-value ${totals.totalInterventionSavings >= 0 ? 'text-safe' : 'text-avoid'}">
            ${totals.totalInterventionSavings >= 0 ? '+' : ''}₱${formatNumber(totals.totalInterventionSavings)}
          </div>
          <div class="kpi-subtext">
            Compared against ₱${formatNumber(baselineExpense)} baseline across ${totals.interventionWeeksCount} active weeks
          </div>
          <div class="kpi-footer-note">Meal planning & shopping list impact</div>
        </div>

        <!-- Food Waste Weight Reduction -->
        <div class="kpi-card waste-card">
          <div class="kpi-card-header">
            <span class="kpi-label">Total Measured Food Waste</span>
            <span class="kpi-tag">Actual Digital Scale</span>
          </div>
          <div class="kpi-value">${totals.totalProjectWasteKg.toFixed(2)} <span style="font-size: 1.1rem; font-weight: 500;">kg</span></div>
          <div class="kpi-subtext">
            W1 Baseline: <strong>${baselineWasteKg.toFixed(2)} kg</strong> • Saved: <strong>${totals.totalInterventionWasteSavedKg.toFixed(2)} kg</strong>
          </div>
          <div class="kpi-footer-note">
            Estimated waste cost: ₱${formatNumber(totals.totalProjectWasteCost)} (Tracked separately)
          </div>
        </div>

        <!-- Whole Grocery Scale Weight -->
        <div class="kpi-card weight-card">
          <div class="kpi-card-header">
            <span class="kpi-label">Whole Groceries Weighed</span>
            <span class="kpi-tag">Physical Scale</span>
          </div>
          <div class="kpi-value">${totals.totalProjectPurchasedKg.toFixed(1)} <span style="font-size: 1.1rem; font-weight: 500;">kg</span></div>
          <div class="kpi-subtext">
            Across all shopping trips • Cost density: <strong>₱${totals.totalProjectPurchasedKg > 0 ? (totals.totalProjectExpense / totals.totalProjectPurchasedKg).toFixed(1) : 0}/kg</strong>
          </div>
          <div class="kpi-footer-note">Excludes packaging & tare weights</div>
        </div>
      </div>

      <!-- Weekly Comparative Performance Table -->
      <div class="dashboard-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 class="section-title">Six-Week Comparative Trajectory</h2>
            <p class="section-desc">Comparison of food expenses, scale-measured weights, and food waste from Week 1 baseline through Week 6 evaluation.</p>
          </div>
          <button class="btn-secondary" id="open-config-btn" style="padding: 6px 12px; font-size: 0.8rem;">
            ⚙️ Configure Budgets
          </button>
        </div>

        <div class="table-responsive">
          <table class="course-table">
            <thead>
              <tr>
                <th>Week & Phase</th>
                <th>Dates</th>
                <th>Target Budget</th>
                <th>Actual Expenses</th>
                <th>Savings vs W1</th>
                <th>Grocery Scale Wt.</th>
                <th>Food Waste (Scale)</th>
                <th>Waste Ratio</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${weeklyData.map(w => {
    const isUnderBudget = w.budgetDifference >= 0;
    const hasSavings = w.savingsVsBaseline >= 0;
    return `
                  <tr class="${w.isBaseline ? 'baseline-row' : ''}">
                    <td>
                      <div style="font-weight: 700;">Week ${w.weekNumber}</div>
                      <div class="sub-label ${w.isBaseline ? 'text-amber' : 'text-cyan'}">${w.type}</div>
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.8rem;">
                      ${w.startDate.slice(5)} – ${w.endDate.slice(5)}
                    </td>
                    <td style="font-family: var(--font-mono);">
                      ₱${formatNumber(w.targetBudget)}
                    </td>
                    <td style="font-family: var(--font-mono); font-weight: 700;">
                      ${w.hasRecords ? `₱${formatNumber(w.totalExpense)}` : '<span style="color: var(--text-muted);">No records</span>'}
                    </td>
                    <td style="font-family: var(--font-mono);">
                      ${w.isBaseline ? '<span class="badge-neutral">Baseline Ref</span>' : (
        w.hasRecords ? `
                          <span class="${hasSavings ? 'text-safe' : 'text-avoid'}" style="font-weight: 700;">
                            ${hasSavings ? '▼ -' : '▲ +'}₱${formatNumber(Math.abs(w.savingsVsBaseline))}
                          </span>
                          <span style="font-size: 0.72rem; opacity: 0.8;">(${w.savingsPercent.toFixed(1)}%)</span>
                        ` : '—'
      )}
                    </td>
                    <td style="font-family: var(--font-mono);">
                      ${w.totalScaleWeightKg > 0 ? `<strong>${w.totalScaleWeightKg.toFixed(2)}</strong> kg` : '—'}
                    </td>
                    <td style="font-family: var(--font-mono);">
                      ${w.totalWasteKg > 0 ? `
                        <span style="color: #f87171; font-weight: 700;">${(w.totalWasteGrams).toFixed(0)}g</span>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">(₱${formatNumber(w.totalWasteCost)} est.)</div>
                      ` : '<span style="color: var(--text-muted);">0 g</span>'}
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.82rem;">
                      ${w.totalScaleWeightKg > 0 ? `${w.wasteRatioPercent.toFixed(1)}%` : '—'}
                    </td>
                    <td>
                      ${!w.hasRecords ? '<span class="status-tag pending">Awaiting Entry</span>' : (
        w.isBaseline ? '<span class="status-tag baseline">W1 Baseline</span>' : (
          isUnderBudget ? '<span class="status-tag safe">On Target</span>' : '<span class="status-tag avoid">Over Budget</span>'
        )
      )}
                    </td>
                  </tr>
                `;
  }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Visual Charts and Trend Insights -->
      <div class="charts-grid-row">
        <!-- Expenses vs Budget Bar Chart -->
        <div class="chart-card">
          <h3 class="chart-title">Weekly Expenses vs. ₱${formatNumber(baselineExpense)} Baseline</h3>
          <p class="chart-subtitle">Expense trajectory across all six project weeks (₱ PHP)</p>
          
          <div class="custom-bar-chart">
            ${weeklyData.map(w => {
    const maxVal = Math.max(...weeklyData.map(d => Math.max(d.totalExpense, d.targetBudget)), baselineExpense, 5000);
    const heightPct = Math.min(Math.round((w.totalExpense / maxVal) * 100), 100);
    const baselinePct = Math.min(Math.round((baselineExpense / maxVal) * 100), 100);
    return `
                <div class="bar-col">
                  <div class="bar-container">
                    <div class="baseline-line-indicator" style="bottom: ${baselinePct}%;" title="W1 Baseline: ₱${baselineExpense}"></div>
                    <div class="bar-fill ${w.isBaseline ? 'baseline-fill' : (w.totalExpense <= baselineExpense ? 'safe-fill' : 'over-fill')}" style="height: ${w.hasRecords ? Math.max(heightPct, 6) : 2}%;">
                      <span class="bar-value-label">₱${w.totalExpense > 0 ? (w.totalExpense >= 1000 ? (w.totalExpense / 1000).toFixed(1) + 'k' : w.totalExpense) : '0'}</span>
                    </div>
                  </div>
                  <div class="bar-x-label">W${w.weekNumber}</div>
                </div>
              `;
  }).join('')}
          </div>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-color baseline-color"></span> Baseline (W1)</span>
            <span class="legend-item"><span class="legend-color safe-color"></span> Under Baseline</span>
            <span class="legend-item"><span class="legend-color over-color"></span> Over Baseline</span>
            <span class="legend-item"><span class="legend-color line-color"></span> Baseline Reference</span>
          </div>
        </div>

        <!-- Food Waste Reduction Trajectory -->
        <div class="chart-card">
          <h3 class="chart-title">Food Waste Weight Trajectory (kg)</h3>
          <p class="chart-subtitle">Actual weighed kitchen & plate waste (scale grams)</p>
          
          <div class="custom-bar-chart">
            ${weeklyData.map(w => {
    const maxWaste = Math.max(...weeklyData.map(d => d.totalWasteKg), 2);
    const heightPct = Math.min(Math.round((w.totalWasteKg / maxWaste) * 100), 100);
    return `
                <div class="bar-col">
                  <div class="bar-container">
                    <div class="bar-fill waste-fill" style="height: ${w.totalWasteKg > 0 ? Math.max(heightPct, 6) : 2}%;">
                      <span class="bar-value-label">${w.totalWasteKg.toFixed(2)}k</span>
                    </div>
                  </div>
                  <div class="bar-x-label">W${w.weekNumber}</div>
                </div>
              `;
  }).join('')}
          </div>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-color waste-color"></span> Scale Waste (kg)</span>
            <span class="legend-item" style="color: var(--text-muted); font-size: 0.72rem;">*Strictly excludes packaging tare weight</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  `;
}

// =========================================================================
// 2. SHOPPING TRIPS & RECEIPT SCANNER TAB
// =========================================================================
// 2. SHOPPING TRIPS & RECEIPTS TAB
// =========================================================================
function renderShoppingTripsTab(state) {
  return renderShoppingTripsView(state);
}

// =========================================================================
// 3. GROCERY PURCHASES INVENTORY TAB
// =========================================================================
function renderGroceryPurchasesTab(state) {
  const allItems = getGroceryItems();
  const trips = getShoppingTrips();
  const config = getCourseConfig();
  const tripsMap = new Map(trips.map(t => [t.id, t]));

  const selectedWeek = normalizeWeek(state.selectedWeekView || state.selectedWeek || state.tripsWeekFilter || 'all');
  const searchQuery = String(state.grocerySearch || state.searchQuery || '').trim();

  const items = allItems.filter(i => {
    const weekMatches = selectedWeek === 'all' || resolveItemWeek(i, tripsMap, config) === selectedWeek;
    if (!weekMatches) return false;
    if (!searchQuery) return true;
    return matchesGroceryQuery(i, searchQuery);
  });

  return `
    <div class="purchases-view-container">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
        <div>
          <h2 class="section-title">Itemized Grocery Purchases</h2>
          <p class="section-desc">
            All purchased food items across shopping trips, automatically tagged with Low-Iodine Diet (LID) safety indicators.
          </p>
        </div>
        <div style="font-family: var(--font-mono); color: var(--text-muted); font-size: 0.85rem;">
          ${selectedWeek === 'all' ? `
            Total Recorded Items: <strong>${allItems.length}</strong>
          ` : `
            Week ${selectedWeek} Items: <strong>${items.length}</strong> (of ${allItems.length})
          `}
        </div>
      </div>

      <!-- Search Bar for Scanned Grocery Items -->
      <div class="grocery-search-container mb-3" style="max-width: 580px; width: 100%;">
        <div class="search-box-wrapper" style="position: relative; margin: 0;">
          <svg class="search-icon-left" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none;">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            id="grocery-search-input"
            class="search-input"
            placeholder="Search groceries (e.g. Mangga, Bawang, Tilapia)..."
            value="${escapeHtml(searchQuery)}"
            style="width: 100%; padding: 12px 42px 12px 44px; border-radius: 12px; font-size: 0.9rem; box-sizing: border-box;"
            autocomplete="off"
          />
          ${searchQuery ? `
            <button
              type="button"
              class="search-clear-btn"
              id="grocery-search-clear"
              aria-label="Clear search"
              style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"
            >
              ✕
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Active Context & Status Strip -->
      <div class="trips-week-status-strip flex items-center justify-between mb-3 text-xs text-slate-500 dark:text-slate-400">
        <span class="font-medium">
          Showing: <strong class="text-slate-700 dark:text-slate-200">${selectedWeek === 'all' ? 'All Weeks' : `Week ${selectedWeek} (W0${selectedWeek})`}</strong> 
          • ${items.length} ${items.length === 1 ? 'item' : 'items'} ${searchQuery ? `matching "${escapeHtml(searchQuery)}"` : 'recorded'}
        </span>
        <div style="display: flex; gap: 12px; align-items: center;">
          ${searchQuery ? `
            <button type="button" class="text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer" id="status-clear-search-btn">
              Clear Search
            </button>
          ` : ''}
          ${selectedWeek !== 'all' ? `
            <button type="button" class="text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer" data-week-select="all">
              Show All Weeks (${allItems.length})
            </button>
          ` : ''}
        </div>
      </div>

      ${items.length === 0 ? `
        <div class="empty-state-card" style="padding: 32px 16px; text-align: center;">
          <div class="empty-icon" style="font-size: 2rem; margin-bottom: 8px;">${searchQuery ? '🔍' : '🥬'}</div>
          <h3>${searchQuery ? `No groceries matching "${escapeHtml(searchQuery)}"` : (selectedWeek === 'all' ? 'No Grocery Items in Inventory' : `No Grocery Items in Week ${selectedWeek}`)}</h3>
          <p>${searchQuery
        ? `No matching grocery items found in ${selectedWeek === 'all' ? 'All Weeks' : `Week ${selectedWeek}`}. Try a different item name or clear your search.`
        : (selectedWeek === 'all' ? 'Scan a receipt or add a shopping trip to populate itemized grocery records.' : `No items found for Week ${selectedWeek}. Select "All Weeks" above to view all records.`)
      }</p>
          <div style="display: flex; gap: 10px; justify-content: center; margin-top: 14px;">
            ${searchQuery ? `
              <button class="btn-secondary" id="empty-clear-search-btn">Clear Search</button>
            ` : ''}
          </div>
        </div>
      ` : `
        <div class="table-responsive">
          <table class="course-table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Week & Date</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Line Total</th>
                <th>Net Weight</th>
                <th>LID Status</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(i => {
        const status = (i.lidStatus || 'SAFE').toUpperCase();
        const displayName = getGroceryItemName(i);
        const dbItem = LID_DATABASE.find(db => db.name.toLowerCase() === displayName.toLowerCase() || db.id === i.id || db.id === i.itemId);
        const itemId = dbItem?.id || i.itemId || i.id || ('grocery-' + displayName.toLowerCase().replace(/\s+/g, '-'));
        const itemWeek = resolveItemWeek(i, tripsMap, config);
        const parentTrip = tripsMap.get(i.tripId || i.trip_id);
        return `
                  <tr class="grocery-row grocery-card cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" data-item-id="${escapeHtml(itemId)}" data-grocery-name="${escapeHtml(displayName)}" role="button" tabindex="0" title="Click to view food details and clinical guidance">
                    <td>
                      <div style="font-weight: 700;" class="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1.5">
                        <span>${dbItem?.icon || '🥬'}</span>
                        <span>${escapeHtml(displayName)}</span>
                      </div>
                      ${i.rawReceiptText && i.rawReceiptText !== displayName ? `
                        <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(i.rawReceiptText)}</div>
                      ` : ''}
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.8rem;">
                      <div>Week ${itemWeek} • ${i.purchaseDate || parentTrip?.date || '—'}</div>
                      ${parentTrip?.storeName ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(parentTrip.storeName)}</div>` : ''}
                    </td>
                    <td style="font-family: var(--font-mono);">
                      ${i.quantity || 1} ${escapeHtml(i.unit || 'kg')}
                    </td>
                    <td style="font-family: var(--font-mono);">
                      ₱${formatNumber(i.unitPrice)}
                    </td>
                    <td style="font-family: var(--font-mono); font-weight: 700;">
                      ₱${formatNumber(i.totalPrice)}
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.8rem;">
                      ${i.weightGrams ? `${i.weightGrams} g` : '—'}
                    </td>
                    <td>
                      <span class="status-tag ${status.toLowerCase()}">
                        ${status === 'SAFE' ? '🟢 Safe' : (status === 'AVOID' ? '🔴 Avoid' : '🟡 Caution')}
                      </span>
                    </td>
                  </tr>
                `;
      }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// =========================================================================
// 4. FOOD WASTE TRACKER TAB
// =========================================================================
function renderFoodWasteTab(state) {
  const records = getFoodWasteRecords();
  const totalGrams = records.reduce((sum, r) => sum + Number(r.measuredWeightG || 0), 0);
  const totalCost = records.reduce((sum, r) => sum + Number(r.estimatedCost || 0), 0);

  return `
    <div class="waste-view-container">
      <div class="trips-action-bar">
        <div>
          <h2 class="section-title">Food Waste Tracker (Kitchen & Plate Waste)</h2>
          <p class="section-desc">
            Record actual measured food waste using your digital kitchen scale. 
            <strong>Strict Requirement:</strong> Exclude food packaging, plastic wraps, and non-food tare.
          </p>
        </div>
        <button class="btn-primary" id="open-waste-modal-btn">
          ➕ Log Food Waste Entry
        </button>
      </div>

      <!-- Summary Banner -->
      <div class="waste-stats-banner">
        <div class="waste-stat-box">
          <span class="stat-label">Total Measured Waste</span>
          <span class="stat-number text-avoid">${(totalGrams / 1000).toFixed(2)} kg <span style="font-size: 0.9rem; font-weight: 500;">(${totalGrams} g)</span></span>
        </div>
        <div class="waste-stat-box">
          <span class="stat-label">Estimated Waste Value</span>
          <span class="stat-number">₱${formatNumber(totalCost)}</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">(Kept separate from food expense totals)</span>
        </div>
        <div class="waste-stat-box">
          <span class="stat-label">Total Waste Entries</span>
          <span class="stat-number">${records.length} logs</span>
        </div>
      </div>

      ${records.length === 0 ? `
        <div class="empty-state-card">
          <div class="empty-icon">⚖️</div>
          <h3>No Food Waste Logged</h3>
          <p>Weigh any spoiled ingredients, cooked leftovers, or meal prep waste on your digital scale and log them here.</p>
          <button class="btn-primary" id="empty-waste-btn" style="margin-top: 12px;">➕ Log First Waste Item</button>
        </div>
      ` : `
        <div class="table-responsive">
          <table class="course-table">
            <thead>
              <tr>
                <th>Food Discarded</th>
                <th>Date & Week</th>
                <th>Scale Weight (g)</th>
                <th>Measurement Type</th>
                <th>Reason for Disposal</th>
                <th>Estimated Cost</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 700;">${escapeHtml(r.itemName)}</span>
                      ${r.synced ? `
                        <span class="trip-sync-badge synced" title="Synced with Neon PostgreSQL cloud database">
                          ☁️✓ NEON SYNCED
                        </span>
                      ` : `
                        <span class="trip-sync-badge offline" title="Saved locally in IndexedDB; will auto-sync to Neon when online">
                          ☁️⏳ OFFLINE
                        </span>
                      `}
                    </div>
                    ${r.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(r.notes)}</div>` : ''}
                  </td>
                  <td style="font-family: var(--font-mono); font-size: 0.8rem;">
                    Week ${r.projectWeek} • ${r.date}
                  </td>
                  <td style="font-family: var(--font-mono); font-weight: 700; color: #f87171;">
                    ${r.measuredWeightG} g
                  </td>
                  <td>
                    <span class="badge-tag ${r.isEstimated ? 'estimated' : 'scale-verified'}">
                      ${r.isEstimated ? '⚠️ Estimated' : '⚖️ Digital Scale'}
                    </span>
                  </td>
                  <td>
                    <span class="reason-tag">${escapeHtml(r.reason)}</span>
                  </td>
                  <td style="font-family: var(--font-mono);">
                    ₱${formatNumber(r.estimatedCost)}
                  </td>
                  <td>
                    <button class="btn-icon edit-waste-btn" data-edit-waste="${r.id}" title="Edit waste record" style="margin-right: 4px;">
                      ✏️
                    </button>
                    <button class="btn-icon delete-waste-btn" data-delete-waste="${r.id}" title="Delete waste record">
                      🗑️
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// =========================================================================
// 5. WEEKLY MEAL PLANNER TAB (WEEKS 2 - 6 INTERVENTION)
// =========================================================================
function renderMealPlanTab(state) {
  return renderSmartMealPlanner(state);
}

// =========================================================================
// 6. CSV EXPORT & REPORT GENERATOR TAB
// =========================================================================
function renderExportTab(comparison, config) {
  return `
    <div class="export-view-container">
      <div style="margin-bottom: 20px;">
        <h2 class="section-title">Academic Data Export & Course Submission Reports</h2>
        <p class="section-desc">
          Download formatted CSV data files for your <em>Sustaining Human Life</em> final course report, statistical charts, and analytical appendices.
        </p>
      </div>

      <div class="export-cards-grid">
        <!-- 6-Week Comparative Summary CSV -->
        <div class="export-card cursor-pointer hover:border-emerald-500 transition-all" id="export-card-summary" data-export-type="summary">
          <div class="export-card-icon">📊</div>
          <h3>1. Six-Week Comparative Summary</h3>
          <p>Weekly breakdown of expenses vs. Week 1 baseline, whole grocery scale weight (kg), food waste weight (g/kg), waste-to-purchase ratios, and financial savings.</p>
          <button
            onclick="handleDownloadClick(event, window.handleExportWeeklySummary);"
            class="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all w-full export-btn"
            data-export-type="summary"
          >
            <svg class="w-5 h-5 flex-shrink-0 mr-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>Download CSV</span>
          </button>
        </div>

        <!-- Shopping Trips & Whole Weight CSV -->
        <div class="export-card cursor-pointer hover:border-emerald-500 transition-all" id="export-card-trips" data-export-type="trips">
          <div class="export-card-icon">🧾</div>
          <h3>2. Shopping Trips & Scale Weights</h3>
          <p>Every supermarket and wet market shopping trip, purchase dates, whole-grocery physical scale weights, total amounts paid, and items count.</p>
          <button
            onclick="handleDownloadClick(event, window.handleExportShoppingTrips);"
            class="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all w-full export-btn"
            data-export-type="trips"
          >
            <svg class="w-5 h-5 flex-shrink-0 mr-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>Download CSV</span>
          </button>
        </div>

        <!-- Itemized Grocery Records CSV -->
        <div class="export-card cursor-pointer hover:border-emerald-500 transition-all" id="export-card-items" data-export-type="items">
          <div class="export-card-icon">🥬</div>
          <h3>3. Itemized Purchased Groceries</h3>
          <p>Every individual food item extracted from receipts, quantities, units, unit prices, line totals, package net weights, and clinical LID status.</p>
          <button
            onclick="handleDownloadClick(event, window.handleExportItemizedGroceries);"
            class="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all w-full export-btn"
            data-export-type="items"
          >
            <svg class="w-5 h-5 flex-shrink-0 mr-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>Download CSV</span>
          </button>
        </div>

        <!-- Food Waste Log CSV -->
        <div class="export-card cursor-pointer hover:border-emerald-500 transition-all" id="export-card-waste" data-export-type="waste">
          <div class="export-card-icon">⚖️</div>
          <h3>4. Food Waste Measurement Log</h3>
          <p>Digital scale measurements of discarded food items, dates, disposal reasons, and estimated cost, excluding non-food packaging tare.</p>
          <button
            onclick="handleDownloadClick(event, window.handleExportFoodWaste);"
            class="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all w-full export-btn"
            data-export-type="waste"
          >
            <svg class="w-5 h-5 flex-shrink-0 mr-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      <div style="margin-top: 24px; text-align: center;">
        <button class="btn-primary" id="download-all-csvs-btn" style="padding: 12px 28px; font-size: 1rem;">
          📦 Download Complete Academic Dataset (All 4 CSVs)
        </button>
      </div>
    </div>
  `;
}

// =========================================================================
// MODALS
// =========================================================================

/**
 * Generates an item row markup supporting responsive 2-tier card layout on mobile
 * and single-row table grid on desktop.
 */
function createReceiptItemRowHtml(item = {}, idx = 0, dietProfile = null, isWetMarket = false) {
  const name = item.name || '';
  const qty = item.quantity !== undefined && item.quantity !== null ? item.quantity : (item.qty !== undefined ? item.qty : 1);
  const unit = item.unit || 'kg';
  const price = item.unitPrice !== undefined && item.unitPrice !== null ? item.unitPrice : (item.price !== undefined ? item.price : '');
  const total = item.totalPrice !== undefined && item.totalPrice !== null ? item.totalPrice : (item.lineTotal !== undefined ? item.lineTotal : (price !== '' ? (Number(qty) * Number(price)).toFixed(2) : ''));
  const category = item.category || (isWetMarket ? 'Wet Market Produce' : 'General Food');
  const status = item.lidStatus || item.status || 'SAFE';
  const reason = item.lidReason || item.clinicalReason || '';
  const isAvoid = item.isSafeForDiet === false || item.dietStatus === 'AVOID';
  const flagReason = item.dietFlagReason || (dietProfile ? 'Flagged for ' + (dietProfile.shortName || dietProfile.name) : '');
  const swap = item.suggestedSwap || '';

  return `
    <tr class="receipt-item-row" data-row-idx="${idx}" data-item-category="${escapeHtml(category)}" data-item-status="${escapeHtml(status)}" data-item-reason="${escapeHtml(reason)}">
      <!-- Tier 1 (Mobile) / Col 1 (Desktop): Item Name -->
      <td class="item-cell-name">
        <div class="item-name-wrapper" style="display: flex; flex-direction: column; gap: 4px;">
          <input type="text" class="table-input item-name-val w-full" placeholder="${isWetMarket ? 'e.g. Sayote, Pork Belly, Talong' : 'Item Name'}" value="${escapeHtml(name)}" required />
          ${isAvoid ? `
            <div class="text-[11px] text-rose-700 dark:text-rose-300 flex flex-wrap items-center gap-1 font-medium bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
              <span>⚠️ ${escapeHtml(flagReason)}</span>
              ${swap ? `<span>• Swap: <strong>${escapeHtml(swap)}</strong></span>` : ''}
            </div>
          ` : ''}
        </div>
      </td>

      <!-- Tier 2 Col 1a (Mobile) / Col 2 (Desktop): Qty -->
      <td class="item-cell-qty">
        <label class="mobile-cell-label">Qty</label>
        <input type="number" step="0.1" min="0.1" class="table-input item-qty-val" value="${qty}" style="width: 100%; text-align: center;" />
      </td>

      <!-- Tier 2 Col 1b (Mobile) / Col 3 (Desktop): Unit Selector Dropdown -->
      <td class="item-cell-unit">
        <label class="mobile-cell-label">Unit</label>
        <select class="table-input item-unit-val" style="width: 100%; text-align: center; appearance: none; cursor: pointer;">
          <option value="kg" ${unit === 'kg' || !unit ? 'selected' : ''}>kg</option>
          <option value="g" ${unit === 'g' ? 'selected' : ''}>g</option>
          <option value="pcs" ${unit === 'pcs' ? 'selected' : ''}>pcs</option>
          <option value="pack" ${unit === 'pack' ? 'selected' : ''}>pack</option>
          <option value="bundle" ${unit === 'bundle' ? 'selected' : ''}>bundle</option>
          <option value="can" ${unit === 'can' ? 'selected' : ''}>can</option>
          <option value="bottle" ${unit === 'bottle' ? 'selected' : ''}>bottle</option>
        </select>
      </td>

      <!-- Tier 2 Col 2 (Mobile) / Col 4 (Desktop): Price -->
      <td class="item-cell-price">
        <label class="mobile-cell-label">Price (₱)</label>
        <input type="number" step="0.01" min="0" class="table-input item-price-val" placeholder="0.00" value="${price !== '' ? price : ''}" style="width: 100%; text-align: right;" />
      </td>

      <!-- Tier 2 Col 3 (Mobile) / Col 5 (Desktop): Line Total -->
      <td class="item-cell-total">
        <label class="mobile-cell-label">Total (₱)</label>
        <input type="number" step="0.01" min="0" class="table-input item-total-val" placeholder="0.00" value="${total !== '' ? total : ''}" readonly style="width: 100%; text-align: right;" />
      </td>

      <!-- Tier 1 Delete (Mobile) / Col 6 (Desktop): Delete Button -->
      <td class="item-cell-delete" style="text-align: center;">
        <button type="button" class="btn-icon remove-item-row-btn" title="Remove item" aria-label="Remove item">✕</button>
      </td>
    </tr>
  `;
}

/**
 * Side-by-Side Supermarket Receipt Scanner & Verification Modal
 */
function renderReceiptScanModal(state) {
  const scanData = state.scannedReceiptData || null;
  const isScanning = state.receiptScanning || false;
  const scanProgress = state.receiptProgress || 0;
  const scanStatusMsg = state.receiptStatusMsg || 'Processing receipt...';

  // Venue state switch: "supermarket" (default) | "wet_market"
  const activeVenue = state.groceryVenueMode || (typeof localStorage !== 'undefined' ? localStorage.getItem('kosherai_venue_mode') : null) || 'supermarket';
  const isSupermarket = activeVenue === 'supermarket';
  const isWetMarket = !isSupermarket;
  const ocrEnabled = isOcrScanEnabled();

  // Math check
  let mathAlertHtml = '';
  if (scanData && !isScanning) {
    const sumItems = (scanData.items || []).reduce((sum, i) => sum + (Number(i.totalPrice) || 0), 0);
    const expectedTotal = Number(scanData.totalAmountPaid) || 0;
    const diff = Math.abs(sumItems - expectedTotal);
    if (diff > 1.0) {
      mathAlertHtml = `
        <div class="alert-box warning">
          ⚠️ <strong>Discrepancy Detected:</strong> Sum of item prices (₱${sumItems.toFixed(2)}) differs from Final Amount Paid (₱${expectedTotal.toFixed(2)}). Please adjust items or total before saving.
        </div>
      `;
    }
  }

  // Duplicate check
  let duplicateAlertHtml = '';
  if (scanData && !isScanning) {
    const dup = detectDuplicateReceipt(scanData.storeName, scanData.purchaseDate, scanData.totalAmountPaid);
    if (dup) {
      duplicateAlertHtml = `
        <div class="alert-box avoid">
          ⚠️ <strong>Possible Duplicate Receipt:</strong> A trip at <strong>${escapeHtml(dup.storeName)}</strong> on <strong>${dup.date}</strong> for <strong>₱${dup.totalAmountPaid}</strong> is already recorded.
        </div>
      `;
    }
  }

  // Active Diet Analysis Summary Badge
  const activeDietKey = state.activeDiet || 'lid';
  const dietProfile = getDietProfile(activeDietKey);
  const dietName = scanData?.activeDietName || dietProfile.name;

  let safeCount = scanData?.safeItemCount;
  let flaggedCount = scanData?.flaggedItemCount;

  if ((safeCount === undefined || isNaN(safeCount)) && scanData?.items) {
    flaggedCount = scanData.items.filter(it => it.isSafeForDiet === false || it.dietStatus === 'AVOID').length;
    safeCount = scanData.items.length - flaggedCount;
  }

  const dietBadgeHtml = scanData ? `
    <div class="p-3 rounded-xl border mb-3 flex items-center justify-between gap-3 ${(flaggedCount || 0) > 0
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
    }">
      <div class="flex items-center gap-2.5">
        <span class="text-xl">${dietProfile.icon}</span>
        <div>
          <div class="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
            Analyzed for: ${escapeHtml(dietName)}
          </div>
          <div class="text-xs opacity-90 mt-0.5">
            ${safeCount !== undefined ? `<strong>${safeCount} Safe</strong> • ` : ''}
            ${flaggedCount > 0 ? `<strong class="text-rose-600 dark:text-rose-400">${flaggedCount} Flagged Items</strong>` : 'All items protocol compliant!'}
          </div>
        </div>
      </div>
      <span class="text-xs px-2.5 py-1 rounded-full font-bold shrink-0 ${flaggedCount > 0
      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
      : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
    }">
        ${flaggedCount > 0 ? `⚠️ ${flaggedCount} Flagged` : '✓ Protocol Compliant'}
      </span>
    </div>
  ` : '';

  // Smart Over-Buying Detection (Phase 2)
  let overBuyingAlertsHtml = '';
  if (scanData && !isScanning && Array.isArray(scanData.items) && scanData.items.length > 0) {
    try {
      const historicalPurchases = getGroceryItems();
      const historicalWaste = getFoodWasteRecords();
      const householdMembers = state.household_members || getHouseholdMembers();

      const overBuyingResult = detectOverBuying(scanData.items, {
        purchases: historicalPurchases,
        wasteRecords: historicalWaste,
        householdMembers
      });

      if (overBuyingResult.hasWarnings) {
        overBuyingAlertsHtml = renderOverBuyingAlertsHtml(overBuyingResult.warnings);
      }
    } catch (e) {
      console.warn('Over-buying analysis skipped:', e);
    }
  }

  // Render items rows using createReceiptItemRowHtml
  const items = scanData?.items || [];
  let itemsHtml = '';
  if (items.length > 0) {
    itemsHtml = items.map((item, idx) => createReceiptItemRowHtml(item, idx, dietProfile, isWetMarket)).join('');
  } else {
    itemsHtml = createReceiptItemRowHtml(
      { name: '', quantity: 1, unit: 'kg', unitPrice: '', totalPrice: '' },
      0,
      dietProfile,
      isWetMarket
    );
  }

  // Portrait orientation dismiss check
  const portraitTipDismissed = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('kosherai_portrait_tip_dismissed') === '1';

  return `
    <div class="modal-overlay" id="receipt-modal-overlay">
      <div class="modal-content receipt-modal-large" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="modal-header">
          <div style="flex: 1; padding-right: 12px; min-width: 0;">
            <h2 class="modal-title">${isWetMarket ? 'Wet Market Food Intake & Manual Log' : 'Intelligent Supermarket Receipt Scanner'}</h2>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
              ${isWetMarket
      ? 'Record palengke and receipt-less produce, scale weights, and itemized batch purchases.'
      : 'AI document OCR extracts store details, itemized purchases, and final amount paid for side-by-side verification.'}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <button type="button" class="btn-icon theme-toggle-btn" id="receipt-theme-toggle-btn" title="Toggle Light / Dark Theme" aria-label="Toggle Light / Dark Theme">
              <span id="receipt-theme-icon">☀️</span>
            </button>
            <button type="button" class="btn-icon" id="close-receipt-modal-btn" title="Close modal" aria-label="Close modal">✕</button>
          </div>
        </div>

        <!-- In-Modal Venue Mode Toggle (Segmented Switch) -->
        <div class="venue-mode-toggle-container">
          <div class="venue-mode-toggle" role="tablist" aria-label="Grocery Venue Mode">
            <button type="button" class="venue-toggle-btn ${isSupermarket ? 'active' : ''}" data-venue="supermarket" role="tab" aria-selected="${isSupermarket}">
              🛒 Supermarket
            </button>
            <button type="button" class="venue-toggle-btn ${isWetMarket ? 'active' : ''}" data-venue="wet_market" role="tab" aria-selected="${isWetMarket}">
              🥬 Wet Market
            </button>
          </div>
        </div>

        <!-- Main Body: Unified Vertical Stack for both Supermarket and Wet Market -->
        <div class="receipt-scanner-split flex flex-col w-full gap-4 relative">
          
          <!-- AI / Neural OCR Scanning Toggle Switch (Full-width card stacked vertically) -->
          <div class="ocr-toggle-wrapper w-full" style="position: static;">
            <div class="ocr-toggle-card w-full" style="position: static; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border-color, #334155); background: var(--bg-card, rgba(15, 23, 42, 0.6)); display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; box-sizing: border-box;">
              <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                <span style="font-size: 1.25rem; user-select: none; flex-shrink: 0;">🤖</span>
                <div style="min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary, #fff);">AI / Neural OCR Scanning</span>
                    <span style="font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 9999px; text-transform: uppercase; ${ocrEnabled ? 'background: rgba(20, 184, 166, 0.2); color: #2dd4bf; border: 1px solid rgba(20, 184, 166, 0.3);' : 'background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.3);'}">
                      ${ocrEnabled ? 'Enabled' : 'Off (Quick Capture)'}
                    </span>
                  </div>
                  <div style="font-size: 0.72rem; color: var(--text-muted, #94a3b8); margin-top: 2px;">
                    ${ocrEnabled ? 'Automatically extracts store, total amount, and items when online.' : 'Capture and save photos instantly without AI delay. Finish items later at home.'}
                  </div>
                </div>
              </div>
              <label class="toggle-switch" style="position: relative; display: inline-flex; align-items: center; cursor: pointer; flex-shrink: 0;" title="Toggle AI / Neural OCR Scanning">
                <input type="checkbox" id="ocr-scan-toggle" ${ocrEnabled ? 'checked' : ''} style="display: none;" />
                <div class="toggle-track" style="width: 44px; height: 24px; border-radius: 9999px; background: ${ocrEnabled ? '#0d9488' : '#475569'}; transition: background 0.2s ease; position: relative;">
                  <div class="toggle-thumb" style="width: 20px; height: 20px; border-radius: 50%; background: #ffffff; position: absolute; top: 2px; left: ${ocrEnabled ? '22px' : '2px'}; transition: left 0.2s ease;"></div>
                </div>
              </label>
            </div>
          </div>
          
          <!-- Photo Capture Area (Full-width directly below OCR card) -->
          <div class="split-left-pane w-full flex flex-col">
            <!-- Dedicated Camera & Gallery Inputs -->
            <input type="file" id="receipt-camera-input" accept="image/*" capture="environment" style="display: none;" />
            <input type="file" id="receipt-gallery-input" accept="image/*" style="display: none;" />
            <input type="file" id="receipt-file-input" accept="image/*" capture="environment" style="display: none;" />

            ${state.receiptPreviewUrl ? `
              <div class="receipt-image-zoom-box relative ${isScanning ? 'scanning-thumbnail-box' : ''}">
                <img src="${state.receiptPreviewUrl}" alt="Scanned Receipt Preview" id="receipt-zoom-img" class="${isScanning ? 'opacity-80 transition-opacity' : ''}" />
                ${isScanning ? '<div class="scanning-laser-beam"></div>' : ''}
              </div>
              ${state.ocrStatusBadge ? `
                <div class="w-full mt-2 py-1.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <span>✓</span> <span>${escapeHtml(state.ocrStatusBadge)}</span>
                </div>
              ` : ''}
              <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;" class="items-center">
                <button type="button" class="btn-secondary" id="reupload-receipt-btn" ${isScanning ? 'disabled' : ''} style="flex: 1; min-width: 110px; min-height: 38px; font-size: 0.8rem;">🔄 Retake Photo</button>
                <button type="button" class="btn-secondary" id="rescan-gemini-btn" ${isScanning ? 'disabled' : ''} style="min-height: 38px; font-size: 0.8rem; display: flex; align-items: center; gap: 6px;" title="Re-scan receipt using Gemini Vision">
                  ${state.receiptScanningEngine === 'gemini' ? '<span class="spinner-micro"></span>' : '✨'} Re-scan with Gemini
                </button>
                <button type="button" class="border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer" id="trigger-manual-paddle-btn" ${isScanning ? 'disabled' : ''} title="Force local on-device PaddleOCR extraction without Gemini">
                  ${state.receiptScanningEngine === 'paddle' ? '<span class="spinner-micro"></span>' : '⚡'} On-Device OCR
                </button>
              </div>
            ` : `
              <div class="receipt-dropzone" id="receipt-dropzone">
                <div class="drop-icon">📷</div>
                <div style="font-weight: 700; margin-bottom: 4px; font-size: 1rem;">${isWetMarket ? 'Take Photo of Produce, Receipt or Scale' : 'Take Photo or Upload Receipt'}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 16px;">Supports receipts, produce, or weighing-scale photos</div>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; width: 100%; max-width: 320px;">
                  <button type="button" class="btn-primary" id="trigger-receipt-camera-btn" style="flex: 1; min-height: 44px; padding: 0 16px; min-width: 130px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <span>📸</span> <span>Take Photo</span>
                  </button>
                  <button type="button" class="btn-secondary" id="trigger-receipt-gallery-btn" style="flex: 1; min-height: 44px; padding: 0 16px; min-width: 140px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <span>🖼️</span> <span>Upload from Photos</span>
                  </button>
                </div>
              </div>
            `}
          </div>

          <!-- Right Pane: Extracted / Manual Editable Fields -->
          <div class="split-right-pane w-full flex flex-col gap-4 relative">
            ${isScanning ? `
              <div class="active-scanning-overlay">
                <div class="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin mb-3"></div>
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 text-xs font-semibold mb-2">
                  <span class="animate-pulse">✨</span> Gemini Vision Active
                </div>
                <h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">Analyzing Supermarket Receipt...</h3>
                <p id="scan-status-text" class="text-xs sm:text-sm text-teal-800 dark:text-teal-300 text-center max-w-xs font-medium">
                  ${scanStatusMsg || 'Uploading receipt image...'}
                </p>
                <div class="progress-bar-bg" style="max-width: 240px; width: 100%; margin: 16px auto 0; height: 6px; border-radius: 9999px; overflow: hidden; background: rgba(148, 163, 184, 0.2);">
                  <div class="progress-bar-fill" style="width: ${Math.round(scanProgress * 100)}%; height: 100%; background: linear-gradient(90deg, #0d9488, #06b6d4); transition: width 0.3s ease;"></div>
                </div>
              </div>
            ` : ''}

            <!-- Mobile Portrait Orientation Tip -->
            ${!portraitTipDismissed ? `
              <div class="portrait-orientation-tip" id="portrait-orientation-tip">
                <div class="flex items-center gap-2">
                  <span class="text-base select-none">💡</span>
                  <span><strong>Tip:</strong> Rotate to landscape for an expanded spreadsheet view.</span>
                </div>
                <button type="button" class="tip-dismiss-btn" id="dismiss-portrait-tip-btn" aria-label="Dismiss tip">✕</button>
              </div>
            ` : ''}

            <!-- Physical Scale Weight Reconciliation Callout (Wet Market mode) -->
            ${isWetMarket ? `
              <div class="scale-reconciliation-card p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-900 dark:text-teal-200 text-xs flex items-center gap-3 mb-3">
                <span class="text-2xl select-none">⚖️</span>
                <div>
                  <strong>Physical Scale Weight Reconciliation:</strong>
                  Weigh your whole wet market haul together (in kg). Itemized individual produce weights will reconcile against this physical bulk measurement.
                </div>
              </div>
            ` : ''}

            ${mathAlertHtml}
            ${duplicateAlertHtml}
            ${dietBadgeHtml}
            ${overBuyingAlertsHtml}

            <form id="receipt-verification-form" class="flex flex-col gap-4">

              <!-- 1. Store / Market Stall Name & Purchase Date (2-column responsive subgrid) -->
              <div class="form-row-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="form-group">
                  <label class="form-label" for="edit-store-name">${isWetMarket ? 'Store / Market Stall Name' : 'Store Name'}</label>
                  <input type="text" id="edit-store-name" class="form-input w-full min-h-[44px]" placeholder="${isWetMarket ? 'e.g. Paco Wet Market / Stall #12' : 'SM Supermarket'}" value="${escapeHtml(scanData?.storeName || (isWetMarket ? 'Wet Market / Palengke' : 'SM Supermarket'))}" ${isScanning ? 'disabled' : ''} required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="edit-purchase-date">Purchase Date</label>
                  <input type="date" id="edit-purchase-date" class="form-input w-full min-h-[44px]" value="${scanData?.purchaseDate || new Date().toISOString().split('T')[0]}" ${isScanning ? 'disabled' : ''} required />
                </div>
              </div>

              <!-- 2. CRITICAL FIELD: Whole-Grocery Scale Weight -->
              <div class="scale-weight-field">
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1" for="edit-scale-weight">
                  ⚖️ Whole-Grocery Scale Weight (kg)
                </label>
                <div class="scale-weight-wrapper relative flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus-within:border-emerald-500">
                  <input type="number" step="0.01" min="0" id="edit-scale-weight" class="scale-weight-input w-full bg-transparent text-slate-900 dark:text-white font-semibold outline-none border-none focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500" placeholder="0.00" value="${scanData?.totalScaleWeightKg || ''}" ${isScanning ? 'disabled' : ''} />
                  <span class="scale-weight-unit ml-2 select-none text-xs font-bold uppercase text-slate-500 dark:text-slate-400">kg</span>
                </div>
                <p class="scale-weight-help mt-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                  Measured physical weight of food haul on your home scale before unpacking. Kept separate from receipt item weights for academic rigor.
                </p>
              </div>

              <!-- 3. Final Amount Paid & Trip Type (2-column responsive subgrid) -->
              <div class="form-row-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="form-group">
                  <div class="flex items-center justify-between">
                    <label class="form-label" for="edit-total-amount">Final Amount Paid (₱ PHP)</label>
                    <button type="button" id="apply-items-sum-btn" class="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer">⚡ Apply Sum of Items</button>
                  </div>
                  <input type="number" step="0.01" min="0" id="edit-total-amount" class="form-input w-full min-h-[44px]" style="font-size: 1.1rem; font-weight: 800; font-family: var(--font-mono);" value="${scanData?.totalAmountPaid || 0}" />
                  <div class="form-help" style="margin-top: 4px; font-size: 0.72rem;">Recorded ONCE as a household food expense.</div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="edit-trip-type">Trip Type</label>
                  <select id="edit-trip-type" class="form-input w-full min-h-[44px]">
                    <option value="supermarket" ${isSupermarket ? 'selected' : ''}>Supermarket</option>
                    <option value="wet_market" ${isWetMarket ? 'selected' : ''}>Wet Market / Palengke</option>
                    <option value="Specialty Grocery">Specialty Grocery</option>
                    <option value="Convenience Store">Convenience Store</option>
                  </select>
                  <div class="form-help" style="margin-top: 4px; font-size: 0.72rem;">Classification for shopping venue comparison.</div>
                </div>
              </div>

              <!-- 4. Extracted Items / Market Purchases Table -->
              <div class="extracted-items-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 700; font-size: 0.85rem;">
                    ${isWetMarket ? '🥬 Itemized Purchases' : 'Extracted Items'} (${items.length}):
                  </span>
                  <button type="button" class="btn-text" id="add-receipt-item-row" style="color: var(--safe-green, #10b981); font-size: 0.8rem; font-weight: 600;">
                    ➕ Add Item Row
                  </button>
                </div>

                <div class="receipt-items-table-wrapper">
                  <table class="receipt-items-table" id="receipt-items-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th style="width: 70px;">Qty</th>
                        <th style="width: 70px;">Unit</th>
                        <th style="width: 90px; text-align: right;">Price (₱)</th>
                        <th style="width: 95px; text-align: right;">Line Total</th>
                        <th style="width: 36px; text-align: center;"></th>
                      </tr>
                    </thead>
                    <tbody id="receipt-items-tbody">
                      ${itemsHtml}
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="modal-footer-actions">
                <button type="button" class="btn-secondary" id="cancel-receipt-modal-btn" ${isScanning ? 'disabled' : ''} style="min-height: 44px; padding: 0 18px;">Cancel</button>
                <button type="button" class="btn-secondary" id="quick-save-draft-btn" ${isScanning ? 'disabled' : ''} style="min-height: 44px; padding: 0 16px; border-color: rgba(245, 158, 11, 0.5); color: #f59e0b;" title="Save photo draft to complete details later">📝 Quick Save Draft</button>
                <button type="submit" class="btn-primary" id="save-receipt-trip-btn" ${isScanning ? 'disabled' : ''} style="min-height: 44px; padding: 0 22px;">💾 Save Verified Shopping Trip</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;
}


/**
 * Food Waste Logging Modal
 */
function renderFoodWasteModal(state) {
  return `
    <div class="modal-overlay" id="waste-modal-overlay">
      <div class="modal-content" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">Log Measured Food Waste</h2>
          <button class="btn-icon" id="close-waste-modal-btn">✕</button>
        </div>

        <form id="food-waste-form">
          <div class="form-group">
            <label class="form-label" for="waste-item-name">Discarded Food Item</label>
            <input type="text" id="waste-item-name" class="form-input" placeholder="e.g. Spoiled sayote, leftover rice, wilted kangkong" required />
          </div>

          <div class="form-row-grid">
            <div class="form-group">
              <label class="form-label" for="waste-date">Date Discarded</label>
              <input type="date" id="waste-date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="waste-weight-g">Scale Weight (grams)</label>
              <input type="number" step="1" min="1" id="waste-weight-g" class="form-input" placeholder="e.g. 320" required />
            </div>
          </div>

         <div class="form-group">
          <label class="form-label" for="waste-reason">Disposal Reason</label>
          <select id="waste-reason" class="form-input">
            <option value="Spoiled / Molded">Spoiled / Molded</option>
            <option value="Cooked Excess / Leftover">Cooked Excess / Leftover</option>
            <option value="Expired Package">Expired Package</option>
            <option value="Peels & Trimmings">Peels & Trimmings</option>
            <option value="Diet Protocol Mismatch">Diet Protocol Mismatch</option>
            <option value="Accidental Spillage / Dropped">Accidental Spillage / Dropped</option>
            <option value="Burnt / Cooking Error">Burnt / Cooking Error</option>
            <option value="Cross-Contamination">Cross-Contamination</option>
            <option value="Freezer Burn / Storage Defect">Freezer Burn / Storage Defect</option>
            <option value="Stale / Texture Loss">Stale / Texture Loss</option>
            <option value="Plate Scraping / Uneaten Portion">Plate Scraping / Uneaten Portion</option>
            <option value="Other">Other</option>
          </select>
        </div>

          <div class="form-group">
            <label class="form-label" for="waste-cost-est">Estimated Cost (₱ PHP)</label>
            <input type="number" step="0.5" min="0" id="waste-cost-est" class="form-input" placeholder="e.g. 45" />
            <div class="form-help">Tracked strictly as a food loss indicator; never added to your food expenses.</div>
          </div>

          <!-- Relaxed tare reminder checkbox -->
          <div style="background: var(--bg-card-subtle); padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-cyan); margin-bottom: 16px;">
            <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.8rem; cursor: pointer;">
              <input type="checkbox" id="tare-check" style="margin-top: 2px;" />
              <span><strong>Approximate Food Only:</strong> Checked your best guess without heavy containers or bowls? (Rough estimates are totally fine!)</span>
            </label>
          </div>

          <div class="modal-footer-actions">
            <button type="button" class="btn-secondary" id="cancel-waste-modal-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save Waste Record</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Edit Food Waste Modal
 */
function renderEditWasteModal(state) {
  const r = state.editingWasteRecord || {};
  const itemName = escapeHtml(r.itemName || '');
  const date = r.date || new Date().toISOString().split('T')[0];
  const weightG = r.measuredWeightG != null ? r.measuredWeightG : 0;
  const reason = r.reason || 'Spoiled / Molded';
  const costEst = r.estimatedCost != null ? r.estimatedCost : 0;
  const projectWeek = Number(r.projectWeek || 1);
  const notes = escapeHtml(r.notes || '');

  const reasons = [
    'Spoiled / Molded',
    'Cooked Excess / Leftover',
    'Expired Package',
    'Peels & Trimmings',
    'Diet Protocol Mismatch',
    'Accidental Spillage / Dropped',
    'Burnt / Cooking Error',
    'Cross-Contamination',
    'Freezer Burn / Storage Defect',
    'Stale / Texture Loss',
    'Plate Scraping / Uneaten Portion',
    'Other'
  ];

  return `
    <div class="modal-overlay" id="edit-waste-modal-overlay">
      <div class="modal-content" role="dialog" aria-modal="true" style="width: min(92vw, 520px); max-height: 90dvh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
        <div class="modal-header" style="flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-color, #334155);">
          <div>
            <h2 class="modal-title" style="margin: 0; font-size: 1.1rem; font-weight: 700;">Edit Food Waste Record</h2>
            <div style="font-size: 0.75rem; color: var(--text-muted, #94a3b8);">Update discarded food, weight, reason, or cost</div>
          </div>
          <button class="btn-icon" id="close-edit-waste-modal-btn">✕</button>
        </div>

        <form id="edit-food-waste-form" style="display: flex; flex-direction: column; flex: 1 1 0%; min-height: 0; overflow: hidden; margin: 0;">
          <input type="hidden" id="edit-waste-id" value="${r.id || ''}" />
          <div class="modal-body" style="flex: 1 1 0%; min-height: 0; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label" for="edit-waste-item-name">Discarded Food Item</label>
              <input type="text" id="edit-waste-item-name" class="form-input" value="${itemName}" required />
            </div>

            <div class="form-row-grid">
              <div class="form-group">
                <label class="form-label" for="edit-waste-date">Date Discarded</label>
                <input type="date" id="edit-waste-date" class="form-input" value="${date}" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="edit-waste-weight-g">Scale Weight (grams)</label>
                <input type="number" step="any" min="0" id="edit-waste-weight-g" class="form-input" value="${weightG}" required />
              </div>
            </div>

            <div class="form-row-grid">
              <div class="form-group">
                <label class="form-label" for="edit-waste-week">Study Project Week</label>
                <select id="edit-waste-week" class="form-input">
                  ${[1, 2, 3, 4, 5, 6].map(w => `<option value="${w}" ${projectWeek === w ? 'selected' : ''}>Week ${w}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="edit-waste-reason">Disposal Reason</label>
                <select id="edit-waste-reason" class="form-input">
                  ${reasons.map(res => `<option value="${res}" ${reason === res ? 'selected' : ''}>${res}</option>`).join('')}
                  ${!reasons.includes(reason) ? `<option value="${reason}" selected>${reason}</option>` : ''}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-waste-cost-est">Estimated Cost (₱ PHP)</label>
              <input type="number" step="any" min="0" id="edit-waste-cost-est" class="form-input" value="${costEst}" />
              <div class="form-help">Tracked strictly as a food loss indicator; never added to food expenses.</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-waste-notes">Notes</label>
              <textarea id="edit-waste-notes" class="form-input" rows="2" style="resize: none;">${notes}</textarea>
            </div>
          </div>

          <div class="modal-footer-actions" style="flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--border-color, #334155);">
            <button type="button" class="btn-secondary" id="cancel-edit-waste-modal-btn">Cancel</button>
            <button type="submit" class="btn-primary" id="save-edit-waste-btn">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Meal Plan Entry Modal (Weeks 2 - 6 Intervention)
 */
function renderMealPlanModal(state) {
  const onHand = getGroceryItems();
  const activeDiet = state.activeDiet || 'lid';
  const dietProfile = getDietProfile(activeDiet);
  const activeMeals = DIET_RECIPES[activeDiet]?.meals || lidRecipes;

  return `
    <div class="modal-overlay" id="mealplan-modal-overlay">
      <div class="modal-content" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">Plan a Meal (Weeks 2–6 Intervention)</h2>
          <button class="btn-icon" id="close-mealplan-modal-btn">✕</button>
        </div>

        <form id="mealplan-form">
          <div class="form-row-grid">
            <div class="form-group">
              <label class="form-label" for="plan-week">Project Week</label>
              <select id="plan-week" class="form-input">
                <option value="2">Week 2 (Intervention Launch)</option>
                <option value="3">Week 3 (Evaluation)</option>
                <option value="4">Week 4 (Evaluation)</option>
                <option value="5">Week 5 (Evaluation)</option>
                <option value="6">Week 6 (Evaluation)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="plan-day">Day of Week</label>
              <select id="plan-day" class="form-input">
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
              </select>
            </div>
          </div>

          <div class="form-row-grid">
            <div class="form-group">
              <label class="form-label" for="plan-meal-type">Meal Type</label>
              <select id="plan-meal-type" class="form-input">
                <option value="Dinner">Dinner</option>
                <option value="Lunch">Lunch</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Snack / Prep">Snack / Prep</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="plan-dish-name">Dish Name</label>
              <input type="text" id="plan-dish-name" class="form-input" placeholder="e.g. LID Chicken Tinola" required />
            </div>
          </div>

          <!-- Suggested Diet Recipes quick tags -->
          <div style="margin-bottom: 12px;">
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 4px;">Quick ${escapeHtml(dietProfile.shortName)} Meals:</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${activeMeals.slice(0, 4).map(r => `
                <button type="button" class="quick-dish-chip" data-recipe-title="${escapeHtml(r.name || r.title)}">
                  🟢 ${escapeHtml(r.name || r.title)}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Prioritize On-hand Groceries -->
          ${onHand.length > 0 ? `
            <div class="form-group">
              <label class="form-label">Prioritize On-Hand Ingredients (Reduce Waste)</label>
              <div style="max-height: 120px; overflow-y: auto; background: var(--bg-card-subtle); padding: 8px; border-radius: var(--radius-sm);">
                ${onHand.slice(0, 8).map(item => `
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; padding: 3px 0; cursor: pointer;">
                    <input type="checkbox" name="allocated-items" value="${item.id}" />
                    <span>${escapeHtml(item.name)} (${item.quantity} ${item.unit})</span>
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
              <input type="checkbox" id="plan-lid-verified" checked />
              <span><strong>LID Verified:</strong> Confirmed compliant with wife's Low-Iodine Diet instructions.</span>
            </label>
          </div>

          <div class="modal-footer-actions">
            <button type="button" class="btn-secondary" id="cancel-mealplan-modal-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save to Meal Plan</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Project Budget Configuration Modal
 */
function renderProjectConfigModal(config) {
  return `
    <div class="modal-overlay" id="config-modal-overlay">
      <div class="modal-content" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">Course Project Settings & Budgets</h2>
          <button class="btn-icon" id="close-config-modal-btn">✕</button>
        </div>

        <form id="project-config-form">
          <div class="form-group">
            <label class="form-label" for="cfg-start-date">Project Start Date (Saturday)</label>
            <input type="date" id="cfg-start-date" class="form-input" value="${config.startDate}" required />
            <div class="form-help">Baseline Week 1 starts on this date (default: Oct 31, 2026).</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="cfg-baseline-budget">Week 1 Baseline Target (₱ PHP)</label>
            <input type="number" id="cfg-baseline-budget" class="form-input" value="${config.baselineBudget}" required />
          </div>

          <div style="font-size: 0.85rem; font-weight: 700; margin-bottom: 8px;">Weekly Budget Targets (₱):</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
            ${[1, 2, 3, 4, 5, 6].map(w => `
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.72rem;">Week ${w} Budget</label>
                <input type="number" id="cfg-week-${w}-budget" class="form-input" value="${config.weeklyBudgets?.[w] ?? config.baselineBudget}" />
              </div>
            `).join('')}
          </div>

          <div class="modal-footer-actions">
            <button type="button" class="btn-secondary" id="cancel-config-modal-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save Configuration</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Helpers
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
