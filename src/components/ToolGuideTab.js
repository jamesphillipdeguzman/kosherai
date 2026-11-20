// KosherAI Tool Guide Tab Component
// Interactive documentation of KosherAI's purpose, data collection, processing pipeline, live visualizations, and feature guides.
import { getSixWeekComparison, getCourseConfig } from '../services/courseProjectStorage.js';
import { renderHouseholdInsightsDashboard } from './HouseholdInsightsView.js';
import processMapImg from '../docs/process-map.webp';

export function renderToolGuideTab(state = {}) {
  const config = getCourseConfig();
  const comparison = getSixWeekComparison();
  const { weeklyData, totals, baselineExpense } = comparison;

  const formatNum = (n) => Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  const collectionMethods = [
    {
      title: 'Supermarket Receipt OCR & Photo Upload',
      module: 'CourseProjectView.js + aiVerification.js',
      desc: 'Captures receipt images via device camera or photo gallery, compresses them for upload (compressImageForOCR), and extracts store, date, total amount, and line items using scanReceiptWithPaddleOCR and verifyWithGeminiAI.'
    },
    {
      title: 'Wet Market / Palengke Intake',
      module: 'CourseProjectView.js + ManualTripModal.js',
      desc: 'Records receipt-less produce and wet-market purchases including whole-grocery scale weight (kg), itemized quantities, unit prices, and dietary compatibility.'
    },
    {
      title: 'Food & Label Scanner',
      module: 'ScannerTab.js + ruleEngine.js',
      desc: 'Analyzes food labels and ingredient lists using runClientOCR and analyzeIngredients against the active dietary protocol (Low-Iodine, Low-Purine, Low-Sodium, Diabetic, or Pinoy Keto).'
    },
    {
      title: 'Food Waste Scale Logging',
      module: 'CourseProjectView.js + FoodWasteLogView.jsx',
      desc: 'Captures measured kitchen and plate waste in grams, spoilage or preparation reason, and estimated cost separately from grocery spending.'
    },
    {
      title: 'Weekly Meal Planner & Inventory Allocation',
      module: 'SmartMealPlanningView.js',
      desc: 'Links planned family meals across Weeks 2–6 to on-hand grocery inventory items to prioritize expiring ingredients and reduce avoidable waste.'
    }
  ];

  const workflowStages = [
    {
      step: '01 • USER INPUT',
      title: 'User Input',
      desc: 'Household members upload receipt photos, scan food labels, log wet-market trips, record food waste weights, or plan weekly meals.',
      modules: 'CourseProjectView.js · ScannerTab.js'
    },
    {
      step: '02 • DATA COLLECTION',
      title: 'Data Collection & OCR',
      desc: 'Images are compressed client-side and parsed via PaddleOCR / Gemini AI or evaluated offline with the local ingredient rule engine.',
      modules: 'aiVerification.js · ruleEngine.js'
    },
    {
      step: '03 • DATA PROCESSING',
      title: 'Analytics & Normalization',
      desc: 'Records are grouped into project weeks (getProjectWeekForDate), checked for duplicate receipts, and analyzed for waste ratio and savings.',
      modules: 'courseProjectStorage.js · householdInsightsService.js'
    },
    {
      step: '04 • DATA STORAGE',
      title: 'Offline-First + Cloud Sync',
      desc: 'Saved immediately to localStorage & IndexedDB, then synchronized to Neon PostgreSQL via /api/trips, /api/food-waste, /api/scans, and /api/meal-plans.',
      modules: 'indexedDbStorage.js · api/*.js · cloudinary.js'
    },
    {
      step: '05 • DATA VISUALIZATION',
      title: 'Dashboards & Charts',
      desc: 'Aggregated metrics render in the Household Insights Scorecard, Six-Week Comparative Trajectory table, and Weekly Expenses Bar Chart.',
      modules: 'HouseholdInsightsView.js · CourseProjectView.js'
    },
    {
      step: '06 • USER INSIGHTS',
      title: 'User Insights',
      desc: 'Families review W2–W6 savings vs. W1 baseline, waste-to-purchase ratios, over-buying alerts, and downloadable CSV reports.',
      modules: 'overBuyingDetector.js · exportAllCourseCsvs'
    }
  ];

  const featureGuides = [
    {
      icon: '📷',
      title: 'Scan Food / Receipt Scanner',
      desc: 'Open Scan Food to snap or upload a receipt, toggle AI OCR, review extracted items, and evaluate compatibility—even as a guest.',
      btnLabel: 'Open Scan Food',
      attr: 'data-home-course-tab="scan"'
    },
    {
      icon: '🛡️',
      title: 'Dietary Protocol Selection',
      desc: 'Switch between Low-Iodine (LID), Low-Purine, Low-Sodium, Diabetic, and Pinoy Keto using the protocol selector or Ingredient Checker.',
      btnLabel: 'Open Ingredient Checker',
      attr: 'data-home-diet-tab="checker"'
    },
    {
      icon: '🍽️',
      title: 'Meal Planning & Recipes',
      desc: 'Scale Filipino recipes for your household size in Cook Mode or assign meals to Days/Weeks in the Weekly Meal Planner.',
      btnLabel: 'Open Meal Planner',
      attr: 'data-home-course-tab="mealplan"'
    },
    {
      icon: '🧾',
      title: 'Shopping Trips & Receipts',
      desc: 'Inspect saved supermarket and wet-market trips, edit itemized purchases, and filter by project week.',
      btnLabel: 'Open Shopping Trips',
      attr: 'data-home-course-tab="trips"'
    },
    {
      icon: '💰',
      title: 'Food Budgeting',
      desc: 'Configure your Week 1 Baseline and weekly target budgets, and compare actual grocery spending against targets.',
      btnLabel: 'Open Dashboard & Insights',
      attr: 'data-home-course-tab="dashboard"'
    },
    {
      icon: '📊',
      title: 'Sustaining Human Life (6-Week Project)',
      desc: 'Track a structured 6-week household study from Baseline (Week 1) through Intervention (Weeks 2–6) and export CSV reports.',
      btnLabel: 'Open 6-Week Project',
      attr: 'data-home-course-tab="dashboard"'
    }
  ];

  return `
    <div class="tool-guide-page">
      <!-- Header / Intro -->
      <section class="guide-hero-card">
        <span class="guide-eyebrow">📖 Interactive Tool Guide</span>
        <h1 class="guide-title">How KosherAI Works</h1>
        <p class="guide-lead">
          A transparent overview of KosherAI's household food management workflow, real data collection pipelines, live dashboard visualizations, and step-by-step feature guides.
        </p>

        <nav class="guide-nav" aria-label="Tool Guide Sections" style="margin-top: 20px;">
          <a href="#guide-about" class="guide-nav-link">A. About KosherAI</a>
          <a href="#guide-collection" class="guide-nav-link">B. Data Collection</a>
          <a href="#guide-workflow" class="guide-nav-link">C. Processing Workflow</a>
          <a href="#guide-visualizations" class="guide-nav-link">D. Data Visualization</a>
          <a href="#guide-features" class="guide-nav-link">E. Feature Guides</a>
        </nav>
      </section>

      <!-- A. About KosherAI -->
      <section id="guide-about" class="guide-section-card">
        <h2 class="guide-section-title">A. About KosherAI</h2>
        <p class="guide-lead" style="margin-bottom: 16px;">
          KosherAI is a smart kitchen and household food management companion built for Filipino families. It brings together grocery expense tracking, food waste measurement, inventory-aware meal planning, and receipt/label scanning in an offline-first web application.
        </p>
        <div class="guide-grid-2">
          <div class="guide-subcard">
            <h3>Household Budgeting & Waste Reduction</h3>
            <p>Helps households track supermarket and palengke spending, monitor whole-grocery scale weights, identify over-buying patterns, and measure kitchen/plate food waste separately from food expenses.</p>
          </div>
          <div class="guide-subcard">
            <h3>Specialized Dietary Support</h3>
            <p>Includes built-in ingredient verification and recipe adaptation across Low-Iodine (LID for RAI preparation), Low-Purine, Low-Sodium, Diabetic, and Pinoy Keto protocols.</p>
          </div>
        </div>
      </section>

      <!-- B. Data Collection Process -->
      <section id="guide-collection" class="guide-section-card">
        <h2 class="guide-section-title">B. Data Collection Process</h2>
        <p class="guide-lead" style="margin-bottom: 18px;">
          KosherAI collects structured food, spending, and waste records through the following implemented input channels:
        </p>
        <div class="guide-grid-3">
          ${collectionMethods.map(m => `
            <div class="guide-subcard">
              <div>
                <h3>${m.title}</h3>
                <p style="margin-top: 8px;">${m.desc}</p>
              </div>
              <div>
                <span class="guide-code-tag">${m.module}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- C. Data Processing Workflow -->
      <section id="guide-workflow" class="guide-section-card">
        <h2 class="guide-section-title">C. Data Processing Workflow</h2>
        <p class="guide-lead">
          Every record follows the application's actual end-to-end processing pipeline from user entry to insight generation:
        </p>

        <div class="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 sm:p-4 shadow-lg" style="margin: 16px 0 20px;">
          <button
            type="button"
            id="open-process-map-lightbox-btn"
            style="display: block; width: 100%; background: transparent; border: none; padding: 0; cursor: zoom-in; text-align: left;"
            aria-label="Expand process map diagram"
            title="Tap to expand process map"
          >
            <img
              src="${processMapImg}"
              alt="KosherAI End-to-End Household Food and Waste Management Process Flow"
              class="w-full h-auto rounded-lg object-contain"
              style="display: block; width: 100%; height: auto;"
              loading="lazy"
            />
          </button>
          <p style="margin: 8px 0 0; font-size: 0.78rem; color: #94a3b8; text-align: center;">
            End-to-end household food, grocery, and waste management flow — tap image to expand &amp; zoom.
          </p>
        </div>

        <div class="guide-flowchart" role="list" aria-label="KosherAI Data Processing Flowchart">
          ${workflowStages.map(stage => `
            <div class="guide-flow-node" role="listitem">
              <div class="guide-flow-step">
                <span>${stage.step}</span>
                <span aria-hidden="true">→</span>
              </div>
              <h4>${stage.title}</h4>
              <p>${stage.desc}</p>
              <span class="guide-code-tag">${stage.modules}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- D. Data Visualization (Live Actual Components) -->
      <section id="guide-visualizations" class="guide-section-card">
        <h2 class="guide-section-title">D. Data Visualization</h2>
        <p class="guide-lead" style="margin-bottom: 18px;">
          Below are KosherAI's actual live visualization components rendered from your current workspace data (showing clean zero/awaiting-entry states until records are logged).
        </p>

        <!-- Live Household Insights Dashboard Component -->
        <div style="margin-bottom: 24px;">
          ${renderHouseholdInsightsDashboard(state)}
        </div>

        <!-- Live Weekly Expenses vs Baseline Bar Chart -->
        <div class="chart-card" style="margin-bottom: 16px;">
          <h3 class="chart-title">Weekly Expenses vs. ₱${formatNum(baselineExpense)} Baseline</h3>
          <p class="chart-subtitle">Live 6-Week Project trajectory starting ${config.startDate} (Weeks 1–6, ₱ PHP)</p>
          <div class="custom-bar-chart">
            ${weeklyData.map(w => {
              const maxVal = Math.max(...weeklyData.map(d => Math.max(d.totalExpense, d.targetBudget)), baselineExpense, 5000);
              const heightPct = Math.min(Math.round((w.totalExpense / maxVal) * 100), 100);
              return `
                <div class="bar-col">
                  <div class="bar-container">
                    <div class="bar-fill ${w.isBaseline ? 'bar-baseline' : (w.totalExpense <= w.targetBudget ? 'bar-safe' : 'bar-avoid')}" style="height: ${Math.max(heightPct, 4)}%;" title="Week ${w.weekNumber}: ₱${formatNum(w.totalExpense)}">
                      ${w.totalExpense > 0 ? `<span class="bar-value-tag">₱${Math.round(w.totalExpense)}</span>` : ''}
                    </div>
                  </div>
                  <div class="bar-label">W${w.weekNumber}</div>
                </div>
              `;
            }).join('')}
          </div>
          <p class="guide-lead" style="font-size: 0.82rem; margin-top: 12px;">
            <strong>How to interpret:</strong> Week 1 establishes your baseline spending (₱${formatNum(baselineExpense)}). Green bars in Weeks 2–6 indicate weeks at or below target budget; red bars highlight overspend weeks. Total recorded waste across the study is <strong>${totals.totalProjectWasteKg.toFixed(2)} kg</strong>.
          </p>
        </div>
      </section>

      <!-- E. Feature Guides -->
      <section id="guide-features" class="guide-section-card">
        <h2 class="guide-section-title">E. Feature Guides</h2>
        <p class="guide-lead" style="margin-bottom: 18px;">
          Jump directly into any KosherAI feature below:
        </p>
        <div class="guide-grid-3">
          ${featureGuides.map(fg => `
            <div class="guide-subcard">
              <div>
                <h3><span aria-hidden="true">${fg.icon}</span> ${fg.title}</h3>
                <p style="margin-top: 8px;">${fg.desc}</p>
              </div>
              <button type="button" class="guide-feature-btn" ${fg.attr}>
                <span>${fg.btnLabel}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          `).join('')}
        </div>
      </section>

      ${state.processMapLightboxOpen ? `
        <div
          id="process-map-lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="KosherAI Process Flow Diagram"
          style="position: fixed; inset: 0; z-index: 60; background: rgba(2, 6, 23, 0.9); backdrop-filter: blur(4px); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px;"
        >
          <div style="width: 100%; max-width: 1120px; display: flex; justify-content: flex-end; margin-bottom: 10px;">
            <button
              type="button"
              id="close-process-map-lightbox-btn"
              aria-label="Close process map"
              style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; border-radius: 9999px; width: 38px; height: 38px; font-size: 1.1rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;"
            >✕</button>
          </div>
          <div style="width: 100%; max-width: 1120px; max-height: 85vh; overflow: auto; border-radius: 12px; background: #0f172a; border: 1px solid #334155; padding: 8px;">
            <img
              src="${processMapImg}"
              alt="KosherAI End-to-End Household Food and Waste Management Process Flow"
              style="display: block; width: 100%; height: auto; object-fit: contain; touch-action: pinch-zoom;"
            />
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
