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
  PROJECT_CONFIG
} from '../services/courseProjectStorage.js';

import { compressImage, scanSupermarketReceipt } from '../services/aiVerification.js';
import { LID_DATABASE, STATUS } from '../data/lidDatabase.js';
import { getDietProfile } from '../data/dietProfiles.js';
import { DIET_RECIPES } from '../data/dietRecipes.js';
import lidRecipes from '../data/lidRecipes.json';

export function renderCourseProjectView(state) {
  const activeSubTab = state.courseSubTab || 'dashboard'; // 'dashboard' | 'trips' | 'groceries' | 'waste' | 'mealplan' | 'export'
  const config = getCourseConfig();
  const schedule = getProjectWeekSchedule(config.startDate);
  const comparison = getSixWeekComparison();

  return `
    <div class="course-project-container">
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

        <!-- Weekly Progress Pills -->
        <div class="weekly-cycle-strip">
          ${schedule.map(w => {
            const isCurrent = (state.selectedWeekView || 1) === w.weekNumber;
            const weekStats = comparison.weeklyData.find(d => d.weekNumber === w.weekNumber);
            const hasData = weekStats && weekStats.hasRecords;
            const pillClasses = isCurrent 
              ? 'active bg-teal-600 text-white dark:bg-teal-500' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
            return `
              <button class="week-step-pill ${pillClasses} ${hasData ? 'has-data' : ''}" data-week-select="${w.weekNumber}">
                <div class="week-pill-num">W${w.weekNumber}</div>
                <div class="week-pill-type">${w.isBaseline ? 'Baseline' : (w.weekNumber === 2 ? 'Intervene' : 'Evaluate')}</div>
                <div class="week-pill-dates">${w.startDate.slice(5)}</div>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Course Sub-navigation Bar -->
        <div class="course-subnav">
          <button class="subnav-btn ${activeSubTab === 'dashboard' ? 'active' : ''}" data-subtab="dashboard">
            <span class="nav-icon">📊</span> 6-Week Dashboard
          </button>
          <button class="subnav-btn ${activeSubTab === 'trips' ? 'active' : ''}" data-subtab="trips">
            <span class="nav-icon">🧾</span> Shopping Trips & Receipts
          </button>
          <button class="subnav-btn ${activeSubTab === 'groceries' ? 'active' : ''}" data-subtab="groceries">
            <span class="nav-icon">🥬</span> Grocery Purchases
          </button>
          <button class="subnav-btn ${activeSubTab === 'waste' ? 'active' : ''}" data-subtab="waste">
            <span class="nav-icon">⚖️</span> Food Waste Log
          </button>
          <button class="subnav-btn ${activeSubTab === 'mealplan' ? 'active' : ''}" data-subtab="mealplan">
            <span class="nav-icon">📋</span> Weekly Meal Planner
          </button>
          <button class="subnav-btn ${activeSubTab === 'export' ? 'active' : ''}" data-subtab="export">
            <span class="nav-icon">📁</span> CSV Export & Report
          </button>
        </div>
      </div>

      <!-- Active Subtab Content Area -->
      <div class="course-subtab-content">
        ${renderSubTabContent(activeSubTab, state, comparison, config)}
      </div>

      <!-- Modals rendered conditionally -->
      ${state.receiptModalOpen ? renderReceiptScanModal(state) : ''}
      ${state.manualTripModalOpen ? renderManualTripModal(state) : ''}
      ${state.wasteModalOpen ? renderFoodWasteModal(state) : ''}
      ${state.mealPlanModalOpen ? renderMealPlanModal(state) : ''}
      ${state.configModalOpen ? renderProjectConfigModal(config) : ''}
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
    <div class="dashboard-grid">
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
                      <span class="bar-value-label">₱${w.totalExpense > 0 ? (w.totalExpense >= 1000 ? (w.totalExpense/1000).toFixed(1) + 'k' : w.totalExpense) : '0'}</span>
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
  `;
}

// =========================================================================
// 2. SHOPPING TRIPS & RECEIPT SCANNER TAB
// =========================================================================
function renderShoppingTripsTab(state) {
  const trips = getShoppingTrips();
  const config = getCourseConfig();

  return `
    <div class="trips-view-container">
      <!-- Actions Bar -->
      <div class="trips-action-bar">
        <div>
          <h2 class="section-title">Shopping Trips & Supermarket Receipts</h2>
          <p class="section-desc">
            Record shopping runs, scan receipts with AI document OCR, and input the <strong>whole-grocery physical scale weight</strong>.
          </p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn-primary" id="open-receipt-scanner-btn">
            📷 Scan Supermarket Receipt
          </button>
          <button class="btn-secondary" id="open-manual-trip-btn">
            ✍️ Manual Trip Entry (Wet Market)
          </button>
          <button class="btn-secondary" id="manual-sync-trips-btn" title="Synchronize local IndexedDB trips to Neon PostgreSQL">
            ☁️ Sync Neon
          </button>
        </div>
      </div>

      <!-- Quick Guidance Callout -->
      <div class="guidance-callout">
        <span class="callout-icon">⚖️</span>
        <div>
          <strong>Whole-Grocery Scale Measurement:</strong>
          Upon arriving home from grocery shopping, weigh the entire food haul together using a kitchen scale or luggage scale (in kg). 
          This provides the physical mass baseline for food consumption and waste ratio analysis.
        </div>
      </div>

      <!-- Trips List -->
      ${trips.length === 0 ? `
        <div class="empty-state-card">
          <div class="empty-icon">🧾</div>
          <h3>No Shopping Trips Recorded Yet</h3>
          <p>Scan your first grocery receipt from your camera/phone or add a manual trip record for Week 1 baseline.</p>
          <div style="display: flex; gap: 10px; justify-content: center; margin-top: 14px;">
            <button class="btn-primary" id="empty-scan-btn">📷 Scan Receipt</button>
            <button class="btn-secondary" id="empty-manual-btn">✍️ Manual Entry</button>
          </div>
        </div>
      ` : `
        <div class="trips-grid">
          ${trips.map(trip => {
            const items = getGroceryItems(trip.id);
            return `
              <div class="trip-card" data-trip-id="${trip.id}">
                <div class="trip-card-header">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="trip-store-icon">${trip.tripType.includes('Wet') ? '🐟' : '🛒'}</span>
                    <div>
                      <div class="trip-store-name">${escapeHtml(trip.storeName)}</div>
                      <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 2px;">
                        <span class="trip-date-pill">Week ${trip.projectWeek} • ${trip.date}</span>
                        ${trip.synced === false ? `
                          <span class="trip-sync-badge offline" title="Saved locally in IndexedDB; will auto-sync to Neon when online">
                            ☁️⏳ Offline
                          </span>
                        ` : `
                          <span class="trip-sync-badge synced" title="Synced with Neon PostgreSQL cloud database">
                            ☁️✓ Neon Synced
                          </span>
                        `}
                      </div>
                    </div>
                  </div>
                  <div class="trip-price-tag">₱${formatNumber(trip.totalAmountPaid)}</div>
                </div>

                <div class="trip-metrics-row">
                  <div class="trip-metric">
                    <span class="metric-label">Whole Scale Weight</span>
                    <span class="metric-val text-cyan">${trip.totalScaleWeightKg > 0 ? `${trip.totalScaleWeightKg.toFixed(2)} kg` : 'Not Weighed'}</span>
                  </div>
                  <div class="trip-metric">
                    <span class="metric-label">Items Count</span>
                    <span class="metric-val">${items.length || trip.itemsCount || 0} items</span>
                  </div>
                  <div class="trip-metric">
                    <span class="metric-label">Trip Type</span>
                    <span class="metric-val">${escapeHtml(trip.tripType)}</span>
                  </div>
                </div>

                ${trip.receiptImageUrl ? `
                  <div class="trip-receipt-preview">
                    <img src="${trip.receiptImageUrl}" alt="Receipt image" loading="lazy" />
                    <span class="receipt-attached-badge">Receipt Attached</span>
                  </div>
                ` : ''}

                <!-- Items Preview -->
                ${items.length > 0 ? `
                  <div class="trip-items-preview">
                    <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">Extracted Items:</div>
                    <div class="trip-items-chips">
                      ${items.slice(0, 5).map(i => `
                        <span class="item-mini-chip status-${(i.lidStatus || 'SAFE').toLowerCase()}">
                          ${escapeHtml(i.name)} (${i.quantity} ${i.unit})
                        </span>
                      `).join('')}
                      ${items.length > 5 ? `<span class="item-mini-chip" style="background: var(--bg-card-hover);">+${items.length - 5} more</span>` : ''}
                    </div>
                  </div>
                ` : ''}

                <div class="trip-card-footer">
                  <button class="btn-text delete-trip-btn" data-delete-trip="${trip.id}">
                    🗑️ Delete Trip
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

// =========================================================================
// 3. GROCERY PURCHASES INVENTORY TAB
// =========================================================================
function renderGroceryPurchasesTab(state) {
  const items = getGroceryItems();
  const trips = getShoppingTrips();

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
          Total Recorded Items: <strong>${items.length}</strong>
        </div>
      </div>

      ${items.length === 0 ? `
        <div class="empty-state-card">
          <div class="empty-icon">🥬</div>
          <h3>No Grocery Items in Inventory</h3>
          <p>Scan a receipt or add a shopping trip to populate itemized grocery records.</p>
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
                return `
                  <tr>
                    <td>
                      <div style="font-weight: 700;">${escapeHtml(i.name)}</div>
                      ${i.rawReceiptText && i.rawReceiptText !== i.name ? `
                        <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(i.rawReceiptText)}</div>
                      ` : ''}
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.8rem;">
                      Week ${i.projectWeek} • ${i.purchaseDate}
                    </td>
                    <td style="font-family: var(--font-mono);">
                      ${i.quantity} ${escapeHtml(i.unit)}
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
                          ☁️ Neon
                        </span>
                      ` : `
                        <span class="trip-sync-badge offline" title="Saved locally in IndexedDB; will auto-sync to Neon when online">
                          ⚠️ Local
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
  const selectedWeek = state.mealPlanWeek || 2;
  const plans = getMealPlans(selectedWeek);
  const onHandGroceries = getGroceryItems();

  const daysOfWeek = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const mealTypes = ['Breakfast', 'Lunch', 'Dinner'];

  return `
    <div class="mealplan-view-container">
      <div class="trips-action-bar">
        <div>
          <h2 class="section-title">Weekly Meal Planner (Intervention Weeks 2–6)</h2>
          <p class="section-desc">
            Plan household meals in advance to reduce impulse supermarket purchases and prioritize on-hand ingredients. 
            All meals must strictly preserve your wife's <strong>Low-Iodine Diet</strong> protocol.
          </p>
        </div>
        <button class="btn-primary" id="open-mealplan-modal-btn">
          ➕ Plan a Meal
        </button>
      </div>

      <!-- Week Selector -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px;">
        ${[2, 3, 4, 5, 6].map(w => `
          <button class="btn-chip ${selectedWeek === w ? 'active' : ''}" data-mealplan-week="${w}">
            Week ${w} ${w === 2 ? '(Intervention Launch)' : ''}
          </button>
        `).join('')}
      </div>

      <!-- Meal Plan Calendar Grid -->
      <div class="mealplan-calendar-grid">
        ${daysOfWeek.map(day => {
          const dayPlans = plans.filter(p => p.dayOfWeek === day);
          return `
            <div class="calendar-day-column">
              <div class="calendar-day-header">${day}</div>
              <div class="calendar-day-content">
                ${dayPlans.length === 0 ? `
                  <div class="calendar-empty-slot">No meals planned</div>
                ` : `
                  ${dayPlans.map(p => `
                    <div class="calendar-meal-card">
                      <div class="meal-type-pill">${p.mealType}</div>
                      <div class="meal-dish-name">${escapeHtml(p.dishName)}</div>
                      <div class="meal-lid-badge ${p.lidVerified ? 'safe' : 'caution'}">
                        ${p.lidVerified ? '🛡️ Strict LID Safe' : '⚠️ Review LID'}
                      </div>
                      ${p.notes ? `<div class="meal-notes">${escapeHtml(p.notes)}</div>` : ''}
                      <button class="btn-text delete-meal-btn" data-delete-meal="${p.id}" style="margin-top: 6px; font-size: 0.7rem; color: #f87171;">
                        ✕ Remove
                      </button>
                    </div>
                  `).join('')}
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
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
        <div class="export-card">
          <div class="export-card-icon">📊</div>
          <h3>1. Six-Week Comparative Summary</h3>
          <p>Weekly breakdown of expenses vs. Week 1 baseline, whole grocery scale weight (kg), food waste weight (g/kg), waste-to-purchase ratios, and financial savings.</p>
          <button class="btn-primary export-btn" data-export-type="summary">
            ⬇️ Download Summary CSV
          </button>
        </div>

        <!-- Shopping Trips & Whole Weight CSV -->
        <div class="export-card">
          <div class="export-card-icon">🧾</div>
          <h3>2. Shopping Trips & Scale Weights</h3>
          <p>Every supermarket and wet market shopping trip, purchase dates, whole-grocery physical scale weights, total amounts paid, and items count.</p>
          <button class="btn-secondary export-btn" data-export-type="trips">
            ⬇️ Download Trips CSV
          </button>
        </div>

        <!-- Itemized Grocery Records CSV -->
        <div class="export-card">
          <div class="export-card-icon">🥬</div>
          <h3>3. Itemized Purchased Groceries</h3>
          <p>Every individual food item extracted from receipts, quantities, units, unit prices, line totals, package net weights, and clinical LID status.</p>
          <button class="btn-secondary export-btn" data-export-type="items">
            ⬇️ Download Groceries CSV
          </button>
        </div>

        <!-- Food Waste Log CSV -->
        <div class="export-card">
          <div class="export-card-icon">⚖️</div>
          <h3>4. Food Waste Measurement Log</h3>
          <p>Digital scale measurements of discarded food items, dates, disposal reasons, and estimated cost, excluding non-food packaging tare.</p>
          <button class="btn-secondary export-btn" data-export-type="waste">
            ⬇️ Download Food Waste CSV
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
 * Side-by-Side Supermarket Receipt Scanner & Verification Modal
 */
function renderReceiptScanModal(state) {
  const scanData = state.scannedReceiptData || null;
  const isScanning = state.receiptScanning || false;
  const scanProgress = state.receiptProgress || 0;
  const scanStatusMsg = state.receiptStatusMsg || 'Processing receipt...';

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
    <div class="p-3 rounded-xl border mb-3 flex items-center justify-between gap-3 ${
      (flaggedCount || 0) > 0
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
      <span class="text-xs px-2.5 py-1 rounded-full font-bold shrink-0 ${
        flaggedCount > 0
          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
          : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
      }">
        ${flaggedCount > 0 ? `⚠️ ${flaggedCount} Flagged` : '✓ Protocol Compliant'}
      </span>
    </div>
  ` : '';

  return `
    <div class="modal-overlay" id="receipt-modal-overlay">
      <div class="modal-content receipt-modal-large" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div style="flex: 1; padding-right: 12px; min-width: 0;">
            <h2 class="modal-title">Intelligent Supermarket Receipt Scanner</h2>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
              AI document OCR extracts store details, itemized purchases, and final amount paid for side-by-side verification.
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <button type="button" class="btn-icon theme-toggle-btn" id="receipt-theme-toggle-btn" title="Toggle Light / Dark Theme" aria-label="Toggle Light / Dark Theme">
              <span id="receipt-theme-icon">☀️</span>
            </button>
            <button type="button" class="btn-icon" id="close-receipt-modal-btn" title="Close modal" aria-label="Close modal">✕</button>
          </div>
        </div>

          <div class="receipt-scanner-split flex flex-col md:grid md:grid-cols-12 gap-6 relative">
            <!-- Left Pane / Upload Card (Mobile: full width on top, Desktop: 5 cols) -->
            <div class="split-left-pane w-full md:col-span-5">
              <!-- Persistent file input so camera/file picker can always be triggered -->
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
                  <div style="font-weight: 700; margin-bottom: 4px; font-size: 1rem;">Take Photo or Upload Receipt</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 16px;">Supports JPG, PNG from mobile camera</div>
                  <button type="button" class="btn-primary" id="trigger-receipt-file-btn" style="min-height: 44px; padding: 0 20px;">Choose File or Camera</button>
                </div>
              `}
            </div>

            <!-- Right Pane: Extracted Editable Fields (Mobile: stacked below, Desktop: 7 cols) -->
            <div class="split-right-pane w-full md:col-span-7 relative">
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

              ${mathAlertHtml}
              ${duplicateAlertHtml}
              ${dietBadgeHtml}

              <form id="receipt-verification-form" class="flex flex-col gap-4">

                <!-- 1. Store Name & Purchase Date (2-column responsive subgrid) -->
                <div class="form-row-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="form-group">
                    <label class="form-label" for="edit-store-name">Store Name</label>
                    <input type="text" id="edit-store-name" class="form-input w-full min-h-[44px]" value="${escapeHtml(scanData?.storeName || 'SM Supermarket')}" ${isScanning ? 'disabled' : ''} required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="edit-purchase-date">Purchase Date</label>
                    <input type="date" id="edit-purchase-date" class="form-input w-full min-h-[44px]" value="${scanData?.purchaseDate || new Date().toISOString().split('T')[0]}" ${isScanning ? 'disabled' : ''} required />
                  </div>
                </div>

                <!-- 2. CRITICAL FIELD: Whole-Grocery Scale Weight Card (Full width, p-4, clean unit suffix) -->
                <div class="rounded-2xl p-4 bg-teal-50/70 border border-teal-200/80 dark:bg-slate-800/80 dark:border-teal-900/50 transition-colors w-full">
                  <label class="text-xs font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1.5 mb-2" for="edit-scale-weight">
                    ⚖️ Whole-Grocery Scale Weight (kg)
                  </label>
                  <div class="relative w-full flex items-center">
                    <input type="number" step="0.01" min="0" id="edit-scale-weight" class="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-teal-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-base focus:ring-2 focus:ring-teal-500 outline-none pr-12 font-mono font-bold" placeholder="e.g. 5.85" value="${scanData?.totalScaleWeightKg || ''}" ${isScanning ? 'disabled' : ''} required />
                    <span class="scale-unit-badge absolute right-4 font-bold text-sm select-none pointer-events-none text-teal-700/70 dark:text-slate-400">kg</span>
                  </div>
                  <div class="text-[11px] text-teal-700/80 dark:text-slate-400 mt-2 font-normal leading-relaxed">
                    Measured physical weight of food haul on your home scale before unpacking. Kept separate from receipt item weights for academic rigor.
                  </div>
                </div>

                <!-- 3. Final Amount Paid & Trip Type (2-column responsive subgrid) -->
                <div class="form-row-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="form-group">
                    <label class="form-label" for="edit-total-amount">Final Amount Paid (₱ PHP)</label>
                    <input type="number" step="0.01" min="0" id="edit-total-amount" class="form-input w-full min-h-[44px]" style="font-size: 1.1rem; font-weight: 800; font-family: var(--font-mono);" value="${scanData?.totalAmountPaid || 0}" required />
                    <div class="form-help" style="margin-top: 4px; font-size: 0.72rem;">Recorded ONCE as a household food expense.</div>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="edit-trip-type">Trip Type</label>
                    <select id="edit-trip-type" class="form-input w-full min-h-[44px]">
                      <option value="Supermarket">Supermarket</option>
                      <option value="Wet Market / Palengke">Wet Market / Palengke</option>
                      <option value="Specialty Grocery">Specialty Grocery</option>
                      <option value="Convenience Store">Convenience Store</option>
                    </select>
                    <div class="form-help" style="margin-top: 4px; font-size: 0.72rem;">Classification for shopping venue comparison.</div>
                  </div>
                </div>

                <!-- 4. Extracted Items Table -->
                <div class="extracted-items-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 700; font-size: 0.85rem;">Extracted Items (${(scanData?.items || []).length}):</span>
                    <button type="button" class="btn-text" id="add-receipt-item-row" style="color: var(--safe-green); font-size: 0.8rem; font-weight: 600;">
                      ➕ Add Item Row
                    </button>
                  </div>

                  <div class="receipt-items-table-wrapper">
                    <table class="receipt-items-table" id="receipt-items-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th style="width: 60px;">Qty</th>
                          <th style="width: 60px;">Unit</th>
                          <th style="width: 80px;">Price (₱)</th>
                          <th style="width: 85px;">Line Total</th>
                          <th style="width: 36px;"></th>
                        </tr>
                      </thead>
                      <tbody id="receipt-items-tbody">
                        ${(scanData?.items && scanData.items.length > 0) ? scanData.items.map((item, idx) => `
                          <tr data-row-idx="${idx}">
                            <td>
                              <div style="display: flex; flex-direction: column; gap: 4px;">
                                <input type="text" class="table-input item-name-val" value="${escapeHtml(item.name)}" required />
                                ${(item.isSafeForDiet === false || item.dietStatus === 'AVOID') ? `
                                  <div class="text-[11px] text-rose-700 dark:text-rose-300 flex flex-wrap items-center gap-1 font-medium bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                    <span>⚠️ ${escapeHtml(item.dietFlagReason || 'Flagged for ' + dietProfile.shortName)}</span>
                                    ${item.suggestedSwap ? `<span>• Swap: <strong>${escapeHtml(item.suggestedSwap)}</strong></span>` : ''}
                                  </div>
                                ` : ''}
                              </div>
                            </td>
                            <td>
                              <input type="number" step="0.1" min="0.1" class="table-input item-qty-val" value="${item.quantity || 1}" style="width: 100%; text-align: center;" />
                            </td>
                            <td>
                              <input type="text" class="table-input item-unit-val" value="${escapeHtml(item.unit || 'pcs')}" style="width: 100%; text-align: center;" />
                            </td>
                            <td>
                              <input type="number" step="0.01" class="table-input item-price-val" value="${item.unitPrice || item.totalPrice || 0}" style="width: 100%; text-align: right;" />
                            </td>
                            <td>
                              <input type="number" step="0.01" class="table-input item-total-val" value="${item.totalPrice || item.unitPrice || 0}" style="width: 100%; text-align: right;" />
                            </td>
                            <td style="text-align: center;">
                              <button type="button" class="btn-icon remove-item-row-btn" title="Remove row">✕</button>
                            </td>
                          </tr>
                        `).join('') : `
                          <tr data-row-idx="0">
                            <td><input type="text" class="table-input item-name-val" placeholder="Chicken Breast" required /></td>
                            <td><input type="number" step="0.1" class="table-input item-qty-val" value="1" style="width: 100%; text-align: center;" /></td>
                            <td><input type="text" class="table-input item-unit-val" value="kg" style="width: 100%; text-align: center;" /></td>
                            <td><input type="number" step="0.01" class="table-input item-price-val" placeholder="0.00" style="width: 100%; text-align: right;" /></td>
                            <td><input type="number" step="0.01" class="table-input item-total-val" placeholder="0.00" style="width: 100%; text-align: right;" /></td>
                            <td style="text-align: center;"><button type="button" class="btn-icon remove-item-row-btn">✕</button></td>
                          </tr>
                        `}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="modal-footer-actions">
                  <button type="button" class="btn-secondary" id="cancel-receipt-modal-btn" ${isScanning ? 'disabled' : ''} style="min-height: 44px; padding: 0 18px;">Cancel</button>
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
 * Manual Trip Entry Modal (for wet market without receipts)
 */
function renderManualTripModal(state) {
  return `
    <div class="modal-overlay" id="manual-trip-overlay">
      <div class="modal-content" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">Manual Shopping Trip Entry</h2>
          <button class="btn-icon" id="close-manual-trip-btn">✕</button>
        </div>

        <form id="manual-trip-form">
          <div class="form-group">
            <label class="form-label" for="manual-store-name">Store or Market Name</label>
            <input type="text" id="manual-store-name" class="form-input" placeholder="e.g. Local Wet Market / Palengke" required />
          </div>

          <div class="form-row-grid">
            <div class="form-group">
              <label class="form-label" for="manual-trip-date">Date</label>
              <input type="date" id="manual-trip-date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="manual-trip-type">Trip Type</label>
              <select id="manual-trip-type" class="form-input">
                <option value="Wet Market / Palengke">Wet Market / Palengke</option>
                <option value="Supermarket">Supermarket</option>
                <option value="Specialty Pantry">Specialty Pantry</option>
              </select>
            </div>
          </div>

          <!-- 2. CRITICAL FIELD: Whole-Grocery Scale Weight Card -->
          <div class="rounded-2xl p-4 bg-teal-50/70 border border-teal-200/80 dark:bg-slate-800/80 dark:border-teal-900/50 transition-colors w-full">
            <label class="text-xs font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1.5 mb-2" for="manual-scale-weight">
              ⚖️ Whole-Grocery Scale Weight (kg)
            </label>
            <input type="number" step="0.01" min="0" id="manual-scale-weight" class="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-teal-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-base focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. 4.25" required />
            <div class="text-[11px] text-teal-700/80 dark:text-slate-400 mt-2 font-normal leading-relaxed">
              Measured physical weight of food haul on your home scale before unpacking.
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="manual-total-amount">Total Amount Paid (₱ PHP)</label>
            <input type="number" step="0.01" min="0" id="manual-total-amount" class="form-input" placeholder="e.g. 1500" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="manual-notes">Notes / Food Highlights</label>
            <input type="text" id="manual-notes" class="form-input" placeholder="Fresh vegetables, pork loin, pure kosher salt" />
          </div>

          <div class="modal-footer-actions">
            <button type="button" class="btn-secondary" id="cancel-manual-trip-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save Shopping Trip</button>
          </div>
        </form>
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
              <option value="LID Protocol Mismatch">LID Protocol Mismatch (Diet Safety)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="waste-cost-est">Estimated Cost (₱ PHP)</label>
            <input type="number" step="0.5" min="0" id="waste-cost-est" class="form-input" placeholder="e.g. 45" />
            <div class="form-help">Tracked strictly as a food loss indicator; never added to your food expenses.</div>
          </div>

          <!-- Strict tare reminder checkbox -->
          <div style="background: var(--bg-card-subtle); padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-cyan); margin-bottom: 16px;">
            <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.8rem; cursor: pointer;">
              <input type="checkbox" id="tare-check" required style="margin-top: 2px;" />
              <span><strong>Packaging Excluded:</strong> I confirm this weight reflects purely edible food waste and excludes plates, plastic wrappers, or container tare.</span>
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
