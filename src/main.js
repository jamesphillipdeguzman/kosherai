// KosherAI - Low-Iodine Diet Companion for RAI Patients
// Main Application Entry & State Controller

import './style.css';
import { renderHeader } from './components/Header.js';
import { renderBottomNav } from './components/BottomNav.js';
import { renderCheckerTab } from './components/CheckerTab.js';
import { renderScannerTab, executeScanWorkflow, SAMPLE_LABELS } from './components/ScannerTab.js';
import { renderCheatSheetTab } from './components/CheatSheetTab.js';
import { renderSubstitutesTab } from './components/SubstitutesTab.js';
import { renderCookModeTab, lidRecipes, DIET_RECIPES } from './components/CookModeTab.js';
import { renderSettingsModal } from './components/SettingsModal.js';
import { renderItemDetailModal } from './components/ItemDetailModal.js';
import { renderCourseProjectView } from './components/CourseProjectView.js';

import { searchDatabase, analyzeIngredients, analyzeRecipe } from './services/ruleEngine.js';
import { compressImage, compressImageForOCR, runClientOCR, verifyWithGeminiAI, scanSupermarketReceipt, scanReceiptWithPaddleOCR, auditReceiptItemOffline } from './services/aiVerification.js';
import {
  getSettings,
  saveSettings,
  getScanHistory,
  saveScanResult,
  addScanToHistory,
  clearScanHistory,
  getLocalScanHistory,
  getChecklistState,
  saveChecklistState
} from './services/storage.js';

import {
  getCourseConfig,
  saveCourseConfig,
  saveShoppingTrip,
  deleteShoppingTrip,
  saveFoodWasteRecord,
  deleteFoodWasteRecord,
  saveMealPlan,
  deleteMealPlan,
  exportAllCourseCsvs,
  downloadCsvFile,
  PROJECT_CONFIG
} from './services/courseProjectStorage.js';

import { LID_DATABASE } from './data/lidDatabase.js';
import { getActiveDiet, setActiveDiet } from './data/dietProfiles.js';

// Theme Initialization (Default Dark, persists in localStorage)
const initialTheme = localStorage.getItem('kosherai_theme') || localStorage.getItem('theme') || 'dark';
if (initialTheme === 'light') {
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.add('light');
} else {
  document.documentElement.classList.add('dark');
  document.documentElement.classList.remove('light');
}

// 6-Week Project Tab Visibility Preference (Default Visible)
const savedShowProject = localStorage.getItem('kosherai_show_project_tab');
const initialShowProjectTab = savedShowProject !== null ? savedShowProject === 'true' : true;

// Lightweight 60fps scroll listener for ambient parallax sheen
let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (!scrollTicking) {
    window.requestAnimationFrame(() => {
      document.documentElement.style.setProperty('--scroll-y', `${window.scrollY}px`);
      scrollTicking = false;
    });
    scrollTicking = true;
  }
}, { passive: true });

// Global Reactive State
const state = {
  theme: initialTheme,
  showProjectTab: initialShowProjectTab,
  activeDiet: getActiveDiet(),

  // App Mode Switcher: 'diet' (LID Clinical Protocol) | 'course' (Six-Week Sustainability Project)
  appMode: (initialShowProjectTab ? (localStorage.getItem('kosherai_app_mode') || 'course') : 'diet'),

  // Clinical Diet Companion Tabs
  activeTab: 'checker', // 'checker' | 'scanner' | 'cheatsheet' | 'substitutes' | 'cook'
  isOnline: navigator.onLine,
  
  // Checker Tab
  searchQuery: '',
  statusFilter: 'ALL',
  categoryFilter: 'ALL',
  searchResults: LID_DATABASE,
  selectedItem: null,

  // Scanner Tab
  inputMode: 'camera', // 'camera' | 'text'
  scanTarget: 'receipt', // 'receipt' | 'label'
  scannedReceiptAudit: null,
  scanError: null,
  scanText: '',
  scanAnalysis: null,
  ocrStatus: null,
  ocrProgress: 0,
  imagePreviewUrl: null,
  aiAnalysis: null,
  aiLoading: false,
  scanHistory: getLocalScanHistory(),
  selectedScanItem: null,

  // Cheat Sheet Tab
  cheatSearch: '',

  // Substitutes Tab
  subSearch: '',

  // Cook Mode Tab
  checklistState: getChecklistState(),
  recipeText: '',
  recipeAnalysis: null,
  recipeCategoryFilter: 'ALL',

  // Settings
  settings: getSettings(),
  settingsOpen: false,

  // Six-Week Course Project State
  courseSubTab: 'dashboard', // 'dashboard' | 'trips' | 'groceries' | 'waste' | 'mealplan' | 'export'
  selectedWeekView: 1,
  mealPlanWeek: 2,
  receiptModalOpen: false,
  manualTripModalOpen: false,
  wasteModalOpen: false,
  mealPlanModalOpen: false,
  configModalOpen: false,
  receiptPreviewUrl: null,
  scannedReceiptData: null,
  receiptScanning: false,
  receiptProgress: 0,
  receiptStatusMsg: ''
};

// Main DOM Render Function
function render() {
  const app = document.querySelector('#app');
  if (!app) return;

  // Guarantee mode falls back to diet if project tab is toggled off
  if (!state.showProjectTab && state.appMode === 'course') {
    state.appMode = 'diet';
  }

  // Filter Search Database for checker
  state.searchResults = searchDatabase(
    state.searchQuery,
    state.statusFilter,
    state.categoryFilter,
    state.activeDiet
  );

  let activeContentHtml = '';
  if (state.appMode === 'course') {
    activeContentHtml = renderCourseProjectView(state);
  } else {
    switch (state.activeTab) {
      case 'checker':
        activeContentHtml = renderCheckerTab(state);
        break;
      case 'scanner':
        activeContentHtml = renderScannerTab(state);
        break;
      case 'cheatsheet':
        activeContentHtml = renderCheatSheetTab(state);
        break;
      case 'substitutes':
        activeContentHtml = renderSubstitutesTab(state);
        break;
      case 'cook':
        activeContentHtml = renderCookModeTab(state);
        break;
      default:
        activeContentHtml = renderCheckerTab(state);
    }
  }

  const currentNavTab = state.appMode === 'course' ? state.courseSubTab : state.activeTab;

  app.innerHTML = `
    <!-- Parallax Ambient Aurora / Sheen Streaks -->
    <div class="ambient-gradient-mesh fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
      <div class="ambient-orb ambient-orb-1"></div>
      <div class="ambient-orb ambient-orb-2"></div>
      <div class="ambient-orb ambient-orb-3"></div>
      <div class="ambient-streak ambient-streak-1"></div>
      <div class="ambient-streak ambient-streak-2"></div>
    </div>

    ${renderHeader(state.isOnline, state.appMode, state.showProjectTab, state.activeDiet, state.theme)}
    
    <main class="app-container pt-24">
      ${activeContentHtml}
    </main>

    ${renderBottomNav(currentNavTab, state.appMode)}

    ${state.selectedItem ? renderItemDetailModal(state.selectedItem, state.activeDiet) : ''}
    ${state.settingsOpen ? renderSettingsModal(state.settings, state.theme, state.showProjectTab, state.activeDiet) : ''}
  `;

  attachEventHandlers();
}

// Event Delegation & Handler Attachments
function attachEventHandlers() {
  // Diet Profile Selector (Header & Settings Modal)
  const headerDietSelector = document.querySelector('#header-diet-selector');
  if (headerDietSelector) {
    headerDietSelector.addEventListener('change', (e) => {
      const selected = e.target.value;
      state.activeDiet = setActiveDiet(selected);
      render();
    });
  }

  const settingsDietSelect = document.querySelector('#settings-diet-select');
  if (settingsDietSelect) {
    settingsDietSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      state.activeDiet = setActiveDiet(selected);
      render();
    });
  }

  // App Mode Switcher (Diet Protocol vs. 6-Week Project)
  document.querySelectorAll('.mode-tab-btn[data-app-mode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.currentTarget.getAttribute('data-app-mode');
      if (mode && mode !== state.appMode) {
        if (mode === 'course' && !state.showProjectTab) return;
        state.appMode = mode;
        try {
          localStorage.setItem('kosherai_app_mode', mode);
        } catch {}
        window.scrollTo({ top: 0, behavior: 'smooth' });
        render();
      }
    });
  });

  // Navigation Tabs (bottom nav)
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      const mode = e.currentTarget.getAttribute('data-mode') || state.appMode;

      if (mode === 'course') {
        state.courseSubTab = tab;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        render();
      } else if (tab) {
        state.activeTab = tab;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        render();
        if (tab === 'scanner') {
          refreshScanHistory();
        }
      }
    });
  });

  // Header Brand click -> Home
  const brandBtn = document.querySelector('#brand-logo-btn');
  if (brandBtn) {
    brandBtn.addEventListener('click', () => {
      if (state.appMode === 'course') {
        state.courseSubTab = 'dashboard';
      } else {
        state.activeTab = 'checker';
        state.searchQuery = '';
      }
      render();
    });
  }

  // Settings Open / Close
  const settingsOpenBtn = document.querySelector('#settings-open-btn');
  if (settingsOpenBtn) {
    settingsOpenBtn.addEventListener('click', () => {
      state.settingsOpen = true;
      render();
    });
  }

  // Quick Header Theme Toggle (Sun/Moon)
  const headerThemeToggleBtn = document.querySelector('#header-theme-toggle-btn');
  if (headerThemeToggleBtn) {
    headerThemeToggleBtn.addEventListener('click', () => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      state.theme = newTheme;
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
      localStorage.setItem('kosherai_theme', newTheme);
      localStorage.setItem('theme', newTheme);
      render();
    });
  }

  // Settings Theme Segmented Control
  document.querySelectorAll('.theme-segment-btn[data-theme-val]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selectedTheme = e.currentTarget.getAttribute('data-theme-val');
      if (selectedTheme && selectedTheme !== state.theme) {
        state.theme = selectedTheme;
        if (selectedTheme === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        }
        localStorage.setItem('kosherai_theme', selectedTheme);
        localStorage.setItem('theme', selectedTheme);
        render();
      }
    });
  });

  // Settings Project Tab Visibility Switch
  const toggleProjectTabInput = document.querySelector('#toggle-project-tab-input');
  if (toggleProjectTabInput) {
    toggleProjectTabInput.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      state.showProjectTab = isChecked;
      localStorage.setItem('kosherai_show_project_tab', String(isChecked));
      if (!isChecked && state.appMode === 'course') {
        state.appMode = 'diet';
        try {
          localStorage.setItem('kosherai_app_mode', 'diet');
        } catch {}
      }
      render();
    });
  }

  const settingsCloseBtn = document.querySelector('#settings-close-btn');
  const settingsCancelBtn = document.querySelector('#settings-cancel-btn');
  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', () => {
      state.settingsOpen = false;
      render();
    });
  }
  if (settingsCancelBtn) {
    settingsCancelBtn.addEventListener('click', () => {
      state.settingsOpen = false;
      render();
    });
  }

  // Settings Form Submit
  const settingsForm = document.querySelector('#settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const geminiKey = document.querySelector('#gemini-key-input')?.value || '';
      const cloudName = document.querySelector('#cloudinary-name-input')?.value || '';
      const cloudPreset = document.querySelector('#cloudinary-preset-input')?.value || '';
      const prepDate = document.querySelector('#prep-date-input')?.value || '';

      state.settings = saveSettings({
        geminiApiKey: geminiKey.trim(),
        cloudinaryCloudName: cloudName.trim(),
        cloudinaryPreset: cloudPreset.trim(),
        prepDate
      });

      state.settingsOpen = false;
      render();
    });
  }

  // Reset Data button in settings
  const clearAllBtn = document.querySelector('#clear-all-data-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear scan history and stored settings?')) {
        clearScanHistory();
        state.scanHistory = [];
        state.checklistState = {};
        saveChecklistState({});
        state.settingsOpen = false;
        render();
      }
    });
  }

  // Item Modal Close
  const itemCloseBtn = document.querySelector('#item-modal-close-btn');
  const itemDoneBtn = document.querySelector('#item-modal-done-btn');
  const itemOverlay = document.querySelector('#item-modal-overlay');

  if (itemCloseBtn) {
    itemCloseBtn.addEventListener('click', () => {
      state.selectedItem = null;
      render();
    });
  }
  if (itemDoneBtn) {
    itemDoneBtn.addEventListener('click', () => {
      state.selectedItem = null;
      render();
    });
  }
  if (itemOverlay) {
    itemOverlay.addEventListener('click', (e) => {
      if (e.target === itemOverlay) {
        state.selectedItem = null;
        render();
      }
    });
  }

  // ==================== CHECKER TAB EVENTS ====================
  const searchInput = document.querySelector('#checker-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      render();
      // Keep focus on input after render
      const newInput = document.querySelector('#checker-search-input');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    });
  }

  const clearBtn = document.querySelector('#checker-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.searchQuery = '';
      render();
      const searchInput = document.querySelector('#checker-search-input');
      if (searchInput) {
        searchInput.focus();
      }
    });
  }

  // Quick lookup tags
  document.querySelectorAll('.quick-tag-chip[data-query]').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      state.searchQuery = q;
      state.statusFilter = 'ALL';
      render();
      const searchInput = document.querySelector('#checker-search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }
    });
  });

  // Status Filter Buttons
  document.querySelectorAll('.filter-btn[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status');
      state.statusFilter = status;
      render();
    });
  });

  // Category Filter Select
  const categorySelect = document.querySelector('#category-filter-select');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      state.categoryFilter = e.target.value;
      render();
    });
  }

  // Ingredient Card Click
  document.querySelectorAll('.ingredient-card[data-item-id]').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-item-id');
      const item = LID_DATABASE.find(i => i.id === id);
      if (item) {
        state.selectedItem = item;
        render();
      }
    });
  });

  // ==================== SCANNER TAB EVENTS ====================
  const toggleCameraModeBtn = document.querySelector('#toggle-camera-mode');
  const toggleTextModeBtn = document.querySelector('#toggle-text-mode');
  const toggleReceiptModeBtn = document.querySelector('#toggle-receipt-mode');
  const toggleLabelModeBtn = document.querySelector('#toggle-label-mode');
  const dismissScanErrorBtn = document.querySelector('#dismiss-scan-error-btn');

  if (toggleReceiptModeBtn) {
    toggleReceiptModeBtn.addEventListener('click', () => {
      state.scanTarget = 'receipt';
      render();
    });
  }
  if (toggleLabelModeBtn) {
    toggleLabelModeBtn.addEventListener('click', () => {
      state.scanTarget = 'label';
      render();
    });
  }
  if (dismissScanErrorBtn) {
    dismissScanErrorBtn.addEventListener('click', () => {
      state.scanError = null;
      render();
    });
  }

  if (toggleCameraModeBtn) {
    toggleCameraModeBtn.addEventListener('click', () => {
      state.inputMode = 'camera';
      render();
    });
  }
  if (toggleTextModeBtn) {
    toggleTextModeBtn.addEventListener('click', () => {
      state.inputMode = 'text';
      render();
    });
  }

  // File Inputs (Camera & Gallery)
  const cameraInput = document.querySelector('#camera-file-input');
  const galleryInput = document.querySelector('#gallery-file-input');

  const handleImageFile = async (file) => {
    if (!file) return;
    await executeScanWorkflow(file, {
      state,
      render,
      addScanToHistory
    });
  };

  if (cameraInput) {
    cameraInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleImageFile(file);
    });
  }
  if (galleryInput) {
    galleryInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleImageFile(file);
    });
  }

  // Preset Sample Label Buttons
  document.querySelectorAll('.preset-chip[data-sample-index]').forEach(chip => {
    chip.addEventListener('click', () => {
      const idx = parseInt(chip.getAttribute('data-sample-index'), 10);
      const sample = SAMPLE_LABELS[idx];
      if (sample) {
        state.scanText = sample.text;
        state.imagePreviewUrl = null;
        if (sample.isReceipt) {
          state.scanTarget = 'receipt';
        }
        processScanText(sample.text, sample.title, sample.isReceipt);
      }
    });
  });

  // Manual Text Analyze Button
  const analyzeBtn = document.querySelector('#scanner-analyze-btn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', () => {
      const textarea = document.querySelector('#scanner-manual-textarea');
      const text = textarea?.value || '';
      state.scanText = text;
      state.imagePreviewUrl = null;
      processScanText(text, 'Manual Ingredient Input');
    });
  }

  // Manual Text Clear Button
  const clearTextBtn = document.querySelector('#scanner-clear-text-btn');
  if (clearTextBtn) {
    clearTextBtn.addEventListener('click', () => {
      state.scanText = '';
      state.scanAnalysis = null;
      state.scannedReceiptAudit = null;
      state.scanError = null;
      state.aiAnalysis = null;
      render();
    });
  }

  // Re-scan button
  const rescanBtn = document.querySelector('#rescan-btn');
  if (rescanBtn) {
    rescanBtn.addEventListener('click', () => {
      state.scanAnalysis = null;
      state.scannedReceiptAudit = null;
      state.scanError = null;
      state.aiAnalysis = null;
      state.imagePreviewUrl = null;
      state.scanText = '';
      render();
    });
  }

  // AI Verification Button
  const runAiBtn = document.querySelector('#run-ai-check-btn');
  if (runAiBtn) {
    runAiBtn.addEventListener('click', async () => {
      if (!state.scanText) return;
      const settings = getSettings();
      console.log(`[Scanner] Gemini Key present: ${Boolean(settings.geminiApiKey)}`);
      console.log(`[Scanner] Cloudinary configured: ${Boolean(settings.cloudinaryCloudName && settings.cloudinaryPreset)}`);
      const activeKey = settings.geminiApiKey;
      if (!activeKey) {
        alert('Please add your Gemini API Key in Settings (top right gear icon) to run deep AI reasoning. Our built-in offline engine has already evaluated this label!');
        state.settingsOpen = true;
        render();
        return;
      }

      state.aiLoading = true;
      render();

      try {
        const result = await verifyWithGeminiAI(state.scanText, activeKey, state.activeDiet || 'lid');
        state.aiAnalysis = result;
        if (state.scanAnalysis) {
          state.scanAnalysis.status = result.status;
          state.scanAnalysis.source = 'GEMINI_AI';
          state.scanAnalysis.reason = result.reason;
        }
      } catch (err) {
        alert('AI Verification Error: ' + err.message);
      } finally {
        state.aiLoading = false;
        render();
      }
    });
  }

  // Clear Scan History
  const clearHistoryBtn = document.querySelector('#clear-scan-history-btn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
      if (confirm('Clear all scan history? This will remove local and cloud synchronized records.')) {
        await clearScanHistory();
        state.scanHistory = [];
        render();
      }
    });
  }

  // Open Inspection Modal when history item is clicked
  document.querySelectorAll('[data-history-id]').forEach(item => {
    item.addEventListener('click', () => {
      const hid = item.getAttribute('data-history-id');
      const record = state.scanHistory.find(h => h.id === hid);
      if (record) {
        state.selectedScanItem = record;
        render();
      }
    });
  });

  // Modal Delete Single Scan Record
  const scanModalDeleteBtn = document.querySelector('#scan-modal-delete-btn');
  if (scanModalDeleteBtn) {
    scanModalDeleteBtn.addEventListener('click', async () => {
      const id = scanModalDeleteBtn.getAttribute('data-delete-scan-id');
      if (id) {
        await clearScanHistory(id);
        state.selectedScanItem = null;
        state.scanHistory = state.scanHistory.filter(h => h.id !== id);
        render();
        refreshScanHistory();
      }
    });
  }

  // Scan Detail Modal Close / Done
  const scanModalCloseBtn = document.querySelector('#scan-modal-close-btn');
  const scanModalDoneBtn = document.querySelector('#scan-modal-done-btn');
  const scanModalOverlay = document.querySelector('#scan-modal-overlay');

  if (scanModalCloseBtn) {
    scanModalCloseBtn.addEventListener('click', () => {
      state.selectedScanItem = null;
      render();
    });
  }
  if (scanModalDoneBtn) {
    scanModalDoneBtn.addEventListener('click', () => {
      state.selectedScanItem = null;
      render();
    });
  }
  if (scanModalOverlay) {
    scanModalOverlay.addEventListener('click', (e) => {
      if (e.target === scanModalOverlay) {
        state.selectedScanItem = null;
        render();
      }
    });
  }

  // Scan Detail Modal: Re-Audit with AI
  const scanModalReauditBtn = document.querySelector('#scan-modal-reaudit-btn');
  if (scanModalReauditBtn) {
    scanModalReauditBtn.addEventListener('click', async () => {
      const record = state.selectedScanItem;
      if (!record) return;

      // Close modal and restore record data to active scanner view
      state.selectedScanItem = null;
      state.scanText = record.rawText || record.analysis?.rawText || '';
      state.imagePreviewUrl = record.imageUrl || null;
      state.cloudinaryUrl = record.cloudinaryUrl || null;
      state.scanAnalysis = record.analysis || null;
      state.aiAnalysis = record.aiAnalysis || null;

      const settings = getSettings();
      const activeKey = settings.geminiApiKey;
      if (!activeKey) {
        alert('Please add your Gemini API Key in Settings (top right gear icon) to run deep AI reasoning.');
        state.settingsOpen = true;
        render();
        return;
      }

      state.aiLoading = true;
      render();

      try {
        const payload = (record.imageUrl && record.imageUrl.startsWith('data:') && (!state.scanText || state.scanText.length < 15))
          ? {
              text: state.scanText || 'Analyze the food packaging label ingredients for Low-Iodine Diet compliance.',
              imageBase64: record.imageUrl,
              mimeType: 'image/jpeg'
            }
          : (state.scanText || 'Food Label');

        const result = await verifyWithGeminiAI(payload, activeKey, state.activeDiet || 'lid');
        state.aiAnalysis = result;
        if (state.scanAnalysis) {
          state.scanAnalysis.status = result.status;
          state.scanAnalysis.source = 'GEMINI_AI';
          state.scanAnalysis.reason = result.reason;
        }
      } catch (err) {
        alert('AI Verification Error: ' + err.message);
      } finally {
        state.aiLoading = false;
        render();
      }
    });
  }

  // ==================== CHEAT SHEET TAB EVENTS ====================
  const cheatSearchInput = document.querySelector('#cheat-search-input');
  if (cheatSearchInput) {
    cheatSearchInput.addEventListener('input', (e) => {
      state.cheatSearch = e.target.value;
      render();
      const newCheat = document.querySelector('#cheat-search-input');
      if (newCheat) {
        newCheat.focus();
        newCheat.setSelectionRange(newCheat.value.length, newCheat.value.length);
      }
    });
  }

  const printProtocolBtn = document.querySelector('#print-protocol-btn');
  if (printProtocolBtn) {
    printProtocolBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // ==================== SUBSTITUTES TAB EVENTS ====================
  const subSearchInput = document.querySelector('#sub-search-input');
  if (subSearchInput) {
    subSearchInput.addEventListener('input', (e) => {
      state.subSearch = e.target.value;
      render();
      const newSub = document.querySelector('#sub-search-input');
      if (newSub) {
        newSub.focus();
        newSub.setSelectionRange(newSub.value.length, newSub.value.length);
      }
    });
  }

  // ==================== COOK MODE TAB EVENTS ====================
  document.querySelectorAll('.check-item[data-check-id]').forEach(item => {
    item.addEventListener('click', () => {
      const cid = item.getAttribute('data-check-id');
      state.checklistState[cid] = !state.checklistState[cid];
      saveChecklistState(state.checklistState);
      render();
    });
  });

  const resetChecklistBtn = document.querySelector('#reset-checklist-btn');
  if (resetChecklistBtn) {
    resetChecklistBtn.addEventListener('click', () => {
      state.checklistState = {};
      saveChecklistState({});
      render();
    });
  }

  // Recipe sample buttons
  const loadSafeRecipeBtn = document.querySelector('#load-safe-recipe-btn');
  const loadRiskyRecipeBtn = document.querySelector('#load-risky-recipe-btn');

  if (loadSafeRecipeBtn) {
    loadSafeRecipeBtn.addEventListener('click', () => {
      const activeDiet = state.activeDiet || 'lid';
      const currentDietData = DIET_RECIPES[activeDiet] || DIET_RECIPES.lid;
      const targetSampleName = currentDietData.sampleAudit?.name || 'Safe Meal';
      
      // Match sample meal or default to first meal in current diet
      const matchedMeal = currentDietData.meals?.find(m => 
        (m.name || m.title || '').toLowerCase().includes(targetSampleName.toLowerCase()) ||
        targetSampleName.toLowerCase().includes((m.name || m.title || '').toLowerCase())
      ) || currentDietData.meals?.[0];

      if (matchedMeal && matchedMeal.ingredients) {
        state.recipeText = matchedMeal.ingredients.join('\n');
      } else {
        state.recipeText = 
`Fresh chicken cutlets, cut into pieces
1 medium sayote (chayote), peeled and sliced
Fresh ginger slices (luya)
1 fresh onion, chopped
3 cloves fresh garlic, minced
1 tbsp 100% pure coconut oil
1 tsp pure non-iodized kosher salt
Cracked black pepper`;
      }
      state.recipeAnalysis = analyzeRecipe(targetSampleName, state.recipeText, activeDiet);
      render();
    });
  }

  if (loadRiskyRecipeBtn) {
    loadRiskyRecipeBtn.addEventListener('click', () => {
      const activeDiet = state.activeDiet || 'lid';
      state.recipeText = 
`1 lb beef chuck roast cubes
2 large russet potatoes, cubed
2 whole eggs (for breading)
2 tbsp commercial butter
2 tbsp brown sugar
1 cube commercial beef bouillon
2 tbsp soy sauce (toyo)
1 tsp iodized table salt
1 can commercial green beans`;
      state.recipeAnalysis = analyzeRecipe('Careless Beef Stew with Violations', state.recipeText, activeDiet);
      render();
    });
  }

  const recipeAnalyzeBtn = document.querySelector('#recipe-analyze-btn');
  if (recipeAnalyzeBtn) {
    recipeAnalyzeBtn.addEventListener('click', () => {
      const textarea = document.querySelector('#recipe-textarea');
      state.recipeText = textarea?.value || '';
      if (state.recipeText.trim()) {
        state.recipeAnalysis = analyzeRecipe('Custom Family Dish', state.recipeText, state.activeDiet || 'lid');
        render();
      }
    });
  }

  const recipeClearBtn = document.querySelector('#recipe-clear-btn');
  if (recipeClearBtn) {
    recipeClearBtn.addEventListener('click', () => {
      state.recipeText = '';
      state.recipeAnalysis = null;
      render();
    });
  }

  // Recipe Category Filter
  document.querySelectorAll('.recipe-filter-btn[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-category');
      state.recipeCategoryFilter = cat;
      render();
    });
  });

  // Load into Recipe Auditor
  document.querySelectorAll('.load-recipe-btn[data-recipe-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rid = btn.getAttribute('data-recipe-id');
      const activeDiet = state.activeDiet || 'lid';
      const currentDietData = DIET_RECIPES[activeDiet] || DIET_RECIPES.lid;

      let recipe = currentDietData.meals?.find(r => r.id === rid);
      if (!recipe) {
        for (const d of Object.values(DIET_RECIPES)) {
          recipe = d.meals?.find(r => r.id === rid);
          if (recipe) break;
        }
      }
      if (!recipe && Array.isArray(lidRecipes)) {
        recipe = lidRecipes.find(r => r.id === rid);
      }

      if (recipe && recipe.ingredients) {
        state.recipeText = recipe.ingredients.join('\n');
        state.recipeAnalysis = analyzeRecipe(recipe.name || recipe.title, state.recipeText, activeDiet);
        render();
        const textarea = document.querySelector('#recipe-textarea');
        if (textarea) {
          textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
          textarea.focus();
        }
      }
    });
  });

  // ==================== SIX-WEEK COURSE PROJECT EVENTS ====================

  // Course Subnavigation
  document.querySelectorAll('.subnav-btn[data-subtab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sub = e.currentTarget.getAttribute('data-subtab');
      if (sub) {
        state.courseSubTab = sub;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        render();
      }
    });
  });

  // Weekly Progress Strip Selection
  document.querySelectorAll('.week-step-pill[data-week-select]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const w = parseInt(e.currentTarget.getAttribute('data-week-select'), 10);
      state.selectedWeekView = w;
      render();
    });
  });

  // Meal Plan Week Selector
  document.querySelectorAll('.btn-chip[data-mealplan-week]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const w = parseInt(e.currentTarget.getAttribute('data-mealplan-week'), 10);
      state.mealPlanWeek = w;
      render();
    });
  });

  // Quick Dish Chip for Meal Plan
  document.querySelectorAll('.quick-dish-chip[data-recipe-title]').forEach(chip => {
    chip.addEventListener('click', () => {
      const dishInput = document.querySelector('#plan-dish-name');
      if (dishInput) {
        dishInput.value = chip.getAttribute('data-recipe-title');
      }
    });
  });

  // Open Receipt Scanner Modal
  const openReceiptScannerBtn = document.querySelector('#open-receipt-scanner-btn');
  const emptyScanBtn = document.querySelector('#empty-scan-btn');
  const handleOpenReceiptScanner = () => {
    state.receiptModalOpen = true;
    state.scannedReceiptData = null;
    state.receiptPreviewUrl = null;
    state.receiptScanning = false;
    state.receiptScanningEngine = null;
    state.ocrStatusBadge = null;
    render();
  };
  if (openReceiptScannerBtn) openReceiptScannerBtn.addEventListener('click', handleOpenReceiptScanner);
  if (emptyScanBtn) emptyScanBtn.addEventListener('click', handleOpenReceiptScanner);

  // Receipt Scanner Theme Toggle (Sun/Moon)
  const receiptThemeToggleBtn = document.querySelector('#receipt-theme-toggle-btn');
  const receiptThemeIcon = document.querySelector('#receipt-theme-icon');
  const isDarkCurrent = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
  if (receiptThemeIcon) {
    receiptThemeIcon.textContent = isDarkCurrent ? '☀️' : '🌙';
  }
  if (receiptThemeToggleBtn) {
    receiptThemeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
      const newTheme = isDark ? 'light' : 'dark';
      state.theme = newTheme;
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
      localStorage.setItem('kosherai_theme', newTheme);
      localStorage.setItem('theme', newTheme);
      render();
    });
  }

  // Close Receipt Scanner Modal
  const closeReceiptModalBtn = document.querySelector('#close-receipt-modal-btn');
  const cancelReceiptModalBtn = document.querySelector('#cancel-receipt-modal-btn');
  const handleCloseReceiptModal = () => {
    state.receiptModalOpen = false;
    state.scannedReceiptData = null;
    state.receiptScanning = false;
    state.receiptScanningEngine = null;
    state.ocrStatusBadge = null;
    render();
  };
  if (closeReceiptModalBtn) closeReceiptModalBtn.addEventListener('click', handleCloseReceiptModal);
  if (cancelReceiptModalBtn) cancelReceiptModalBtn.addEventListener('click', handleCloseReceiptModal);

  // Trigger File Input / Camera
  const triggerReceiptFileBtn = document.querySelector('#trigger-receipt-file-btn');
  const reuploadReceiptBtn = document.querySelector('#reupload-receipt-btn');
  const receiptFileInput = document.querySelector('#receipt-file-input');

  const handleRetakeReceiptPhoto = () => {
    state.receiptScanning = false;
    state.receiptScanningEngine = null;
    state.ocrStatusBadge = null;
    if (receiptFileInput) {
      receiptFileInput.value = ''; // Reset cached file value so change event always fires
      receiptFileInput.click();    // Programmatically trigger camera/file picker
    }
  };

  if (triggerReceiptFileBtn) {
    triggerReceiptFileBtn.addEventListener('click', handleRetakeReceiptPhoto);
  }
  if (reuploadReceiptBtn) {
    reuploadReceiptBtn.addEventListener('click', handleRetakeReceiptPhoto);
  }

  // Handle Receipt File Selection & AI Scan
  if (receiptFileInput) {
    receiptFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      // Reset input value immediately after reading so consecutive retakes always re-trigger
      e.target.value = '';
      if (!file) return;

      try {
        state.receiptScanning = true;
        state.receiptProgress = 0.15;
        state.receiptStatusMsg = 'Uploading receipt image...';
        render();

        const dataUrl = await compressImageForOCR(file, 1600, 0.8);
        state.receiptPreviewUrl = dataUrl;
        state.receiptProgress = 0.15;
        state.receiptStatusMsg = 'Uploading receipt image...';
        render();

        const result = await scanSupermarketReceipt(dataUrl, (p) => {
          state.receiptProgress = p.progress;
          state.receiptStatusMsg = p.message;
          const statusTextEl = document.querySelector('#scan-status-text');
          if (statusTextEl) statusTextEl.textContent = p.message;
          const fill = document.querySelector('.progress-bar-fill');
          if (fill) fill.style.width = Math.round(p.progress * 100) + '%';
        }, state.settings?.geminiApiKey, state.activeDiet || 'lid');

        state.receiptStatusMsg = 'Populating receipt items...';
        state.receiptProgress = 0.95;
        const statusTextEl = document.querySelector('#scan-status-text');
        if (statusTextEl) statusTextEl.textContent = state.receiptStatusMsg;

        state.scannedReceiptData = result;
        state.receiptScanning = false;
        render();
      } catch (err) {
        console.error('Receipt scan error:', err);
        alert('Could not complete receipt scan. You can enter details manually.');
        state.receiptScanning = false;
        state.scannedReceiptData = {
          storeName: 'Supermarket',
          purchaseDate: new Date().toISOString().split('T')[0],
          tripType: 'Supermarket',
          items: [],
          totalAmountPaid: 0,
          totalScaleWeightKg: 0
        };
        render();
      }
    });
  }

  // Secondary Action: Force Manual Local PaddleOCR Scan (bypasses /api/receipt-scan)
  const triggerManualPaddleBtn = document.querySelector('#trigger-manual-paddle-btn');
  if (triggerManualPaddleBtn) {
    triggerManualPaddleBtn.addEventListener('click', async () => {
      if (!state.receiptPreviewUrl || state.receiptScanning) return;

      try {
        state.receiptScanning = true;
        state.receiptScanningEngine = 'paddle';
        state.receiptProgress = 0.15;
        state.receiptStatusMsg = '⚡ Running local PaddleOCR on receipt...';
        state.ocrStatusBadge = null;
        render();

        const result = await scanReceiptWithPaddleOCR(state.receiptPreviewUrl, (p) => {
          state.receiptProgress = p.progress;
          state.receiptStatusMsg = p.message;
          const statusTextEl = document.querySelector('#scan-status-text');
          if (statusTextEl) statusTextEl.textContent = p.message;
          const fill = document.querySelector('.progress-bar-fill');
          if (fill) fill.style.width = Math.round(p.progress * 100) + '%';
        });

        state.scannedReceiptData = result;
        state.receiptScanning = false;
        state.receiptScanningEngine = null;
        state.ocrStatusBadge = 'Scanned with on-device PaddleOCR';
        render();

        setTimeout(() => {
          state.ocrStatusBadge = null;
          render();
        }, 5000);
      } catch (err) {
        console.error('Direct PaddleOCR scan error:', err);
        alert('Local PaddleOCR could not extract text from receipt. You can adjust the image or enter items manually.');
        state.receiptScanning = false;
        state.receiptScanningEngine = null;
        render();
      }
    });
  }

  // Re-scan with Gemini Vision
  const rescanGeminiBtn = document.querySelector('#rescan-gemini-btn');
  if (rescanGeminiBtn) {
    rescanGeminiBtn.addEventListener('click', async () => {
      if (!state.receiptPreviewUrl || state.receiptScanning) return;

      try {
        state.receiptScanning = true;
        state.receiptScanningEngine = 'gemini';
        state.receiptProgress = 0.15;
        state.receiptStatusMsg = '✨ Gemini Vision is analyzing receipt items...';
        state.ocrStatusBadge = null;
        render();

        const result = await scanSupermarketReceipt(
          state.receiptPreviewUrl,
          (p) => {
            state.receiptProgress = p.progress;
            state.receiptStatusMsg = p.message;
            const statusTextEl = document.querySelector('#scan-status-text');
            if (statusTextEl) statusTextEl.textContent = p.message;
            const fill = document.querySelector('.progress-bar-fill');
            if (fill) fill.style.width = Math.round(p.progress * 100) + '%';
          },
          state.settings?.geminiApiKey,
          state.activeDiet || 'lid'
        );

        state.scannedReceiptData = result;
        state.receiptScanning = false;
        state.receiptScanningEngine = null;
        state.ocrStatusBadge = 'Scanned with Gemini Vision';
        render();

        setTimeout(() => {
          state.ocrStatusBadge = null;
          render();
        }, 5000);
      } catch (err) {
        console.error('Gemini re-scan error:', err);
        alert('Could not complete Gemini scan. You can use on-device OCR instead.');
        state.receiptScanning = false;
        state.receiptScanningEngine = null;
        render();
      }
    });
  }

  // Add Item Row in Receipt Verification Table
  const addReceiptItemRowBtn = document.querySelector('#add-receipt-item-row');
  if (addReceiptItemRowBtn) {
    addReceiptItemRowBtn.addEventListener('click', () => {
      const tbody = document.querySelector('#receipt-items-tbody');
      if (tbody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="text" class="table-input item-name-val" placeholder="Item Name" required /></td>
          <td><input type="number" step="0.1" class="table-input item-qty-val" value="1" style="width: 50px;" /></td>
          <td><input type="text" class="table-input item-unit-val" value="pcs" style="width: 50px;" /></td>
          <td><input type="number" step="0.01" class="table-input item-price-val" placeholder="0.00" style="width: 70px;" /></td>
          <td><input type="number" step="0.01" class="table-input item-total-val" placeholder="0.00" style="width: 80px;" /></td>
          <td><button type="button" class="btn-icon remove-item-row-btn">✕</button></td>
        `;
        tbody.appendChild(tr);
        attachRowRemoveListeners();
      }
    });
  }

  function attachRowRemoveListeners() {
    document.querySelectorAll('.remove-item-row-btn').forEach(btn => {
      btn.onclick = (e) => {
        const row = e.target.closest('tr');
        if (row) row.remove();
      };
    });
  }
  attachRowRemoveListeners();

  // Save Verified Receipt Shopping Trip
  const receiptVerificationForm = document.querySelector('#receipt-verification-form');
  if (receiptVerificationForm) {
    receiptVerificationForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const storeName = document.querySelector('#edit-store-name')?.value || 'Supermarket';
      const purchaseDate = document.querySelector('#edit-purchase-date')?.value || new Date().toISOString().split('T')[0];
      const scaleWeight = parseFloat(document.querySelector('#edit-scale-weight')?.value || 0);
      const totalAmount = parseFloat(document.querySelector('#edit-total-amount')?.value || 0);
      const tripType = document.querySelector('#edit-trip-type')?.value || 'Supermarket';

      const items = [];
      document.querySelectorAll('#receipt-items-tbody tr').forEach(row => {
        const name = row.querySelector('.item-name-val')?.value?.trim();
        const qty = parseFloat(row.querySelector('.item-qty-val')?.value || 1);
        const unit = row.querySelector('.item-unit-val')?.value?.trim() || 'pcs';
        const price = parseFloat(row.querySelector('.item-price-val')?.value || 0);
        const total = parseFloat(row.querySelector('.item-total-val')?.value || price || 0);

        if (name) {
          items.push({
            name,
            quantity: qty,
            unit,
            unitPrice: price,
            totalPrice: total
          });
        }
      });

      saveShoppingTrip({
        storeName,
        date: purchaseDate,
        totalScaleWeightKg: scaleWeight, // Whole grocery physical scale weight
        totalAmountPaid: totalAmount,
        tripType,
        receiptImageUrl: state.receiptPreviewUrl || null,
        notes: `Receipt scanned (${items.length} items verified)`
      }, items);

      state.receiptModalOpen = false;
      state.scannedReceiptData = null;
      state.receiptPreviewUrl = null;
      render();
    });
  }

  // Manual Trip Modal Open & Close
  const openManualTripBtn = document.querySelector('#open-manual-trip-btn');
  const emptyManualBtn = document.querySelector('#empty-manual-btn');
  const closeManualTripBtn = document.querySelector('#close-manual-trip-btn');
  const cancelManualTripBtn = document.querySelector('#cancel-manual-trip-btn');

  if (openManualTripBtn) openManualTripBtn.addEventListener('click', () => { state.manualTripModalOpen = true; render(); });
  if (emptyManualBtn) emptyManualBtn.addEventListener('click', () => { state.manualTripModalOpen = true; render(); });
  if (closeManualTripBtn) closeManualTripBtn.addEventListener('click', () => { state.manualTripModalOpen = false; render(); });
  if (cancelManualTripBtn) cancelManualTripBtn.addEventListener('click', () => { state.manualTripModalOpen = false; render(); });

  // Manual Trip Form Submit
  const manualTripForm = document.querySelector('#manual-trip-form');
  if (manualTripForm) {
    manualTripForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const storeName = document.querySelector('#manual-store-name')?.value || 'Wet Market';
      const date = document.querySelector('#manual-trip-date')?.value || new Date().toISOString().split('T')[0];
      const tripType = document.querySelector('#manual-trip-type')?.value || 'Wet Market / Palengke';
      const scaleWeight = parseFloat(document.querySelector('#manual-scale-weight')?.value || 0);
      const totalAmount = parseFloat(document.querySelector('#manual-total-amount')?.value || 0);
      const notes = document.querySelector('#manual-notes')?.value || '';

      saveShoppingTrip({
        storeName,
        date,
        tripType,
        totalScaleWeightKg: scaleWeight,
        totalAmountPaid: totalAmount,
        notes
      }, []);

      state.manualTripModalOpen = false;
      render();
    });
  }

  // Delete Trip
  document.querySelectorAll('.delete-trip-btn[data-delete-trip]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-delete-trip');
      if (confirm('Delete this shopping trip and its linked grocery items & expense record?')) {
        deleteShoppingTrip(id);
        render();
      }
    });
  });

  // Food Waste Modal Open & Close
  const openWasteModalBtn = document.querySelector('#open-waste-modal-btn');
  const emptyWasteBtn = document.querySelector('#empty-waste-btn');
  const closeWasteModalBtn = document.querySelector('#close-waste-modal-btn');
  const cancelWasteModalBtn = document.querySelector('#cancel-waste-modal-btn');

  if (openWasteModalBtn) openWasteModalBtn.addEventListener('click', () => { state.wasteModalOpen = true; render(); });
  if (emptyWasteBtn) emptyWasteBtn.addEventListener('click', () => { state.wasteModalOpen = true; render(); });
  if (closeWasteModalBtn) closeWasteModalBtn.addEventListener('click', () => { state.wasteModalOpen = false; render(); });
  if (cancelWasteModalBtn) cancelWasteModalBtn.addEventListener('click', () => { state.wasteModalOpen = false; render(); });

  // Food Waste Form Submit
  const foodWasteForm = document.querySelector('#food-waste-form');
  if (foodWasteForm) {
    foodWasteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const itemName = document.querySelector('#waste-item-name')?.value || 'Food Waste';
      const date = document.querySelector('#waste-date')?.value || new Date().toISOString().split('T')[0];
      const weightG = parseFloat(document.querySelector('#waste-weight-g')?.value || 0);
      const reason = document.querySelector('#waste-reason')?.value || 'Spoiled / Molded';
      const costEst = parseFloat(document.querySelector('#waste-cost-est')?.value || 0);

      saveFoodWasteRecord({
        itemName,
        date,
        measuredWeightG: weightG,
        isEstimated: false, // Confirmed weighed on digital scale
        estimatedCost: costEst,
        reason,
        notes: 'Net edible food waste (packaging excluded)'
      });

      state.wasteModalOpen = false;
      render();
    });
  }

  // Delete Food Waste Record
  document.querySelectorAll('.delete-waste-btn[data-delete-waste]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-delete-waste');
      if (confirm('Delete this food waste record?')) {
        deleteFoodWasteRecord(id);
        render();
      }
    });
  });

  // Meal Plan Modal Open & Close
  const openMealPlanModalBtn = document.querySelector('#open-mealplan-modal-btn');
  const closeMealPlanModalBtn = document.querySelector('#close-mealplan-modal-btn');
  const cancelMealPlanModalBtn = document.querySelector('#cancel-mealplan-modal-btn');

  if (openMealPlanModalBtn) openMealPlanModalBtn.addEventListener('click', () => { state.mealPlanModalOpen = true; render(); });
  if (closeMealPlanModalBtn) closeMealPlanModalBtn.addEventListener('click', () => { state.mealPlanModalOpen = false; render(); });
  if (cancelMealPlanModalBtn) cancelMealPlanModalBtn.addEventListener('click', () => { state.mealPlanModalOpen = false; render(); });

  // Meal Plan Form Submit
  const mealPlanForm = document.querySelector('#mealplan-form');
  if (mealPlanForm) {
    mealPlanForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const projectWeek = parseInt(document.querySelector('#plan-week')?.value || 2, 10);
      const dayOfWeek = document.querySelector('#plan-day')?.value || 'Saturday';
      const mealType = document.querySelector('#plan-meal-type')?.value || 'Dinner';
      const dishName = document.querySelector('#plan-dish-name')?.value || 'Planned Meal';
      const lidVerified = document.querySelector('#plan-lid-verified')?.checked ?? true;

      const allocated = [];
      document.querySelectorAll('input[name="allocated-items"]:checked').forEach(cb => {
        allocated.push(cb.value);
      });

      saveMealPlan({
        projectWeek,
        dayOfWeek,
        mealType,
        dishName,
        allocatedGroceryItemIds: allocated,
        lidVerified
      });

      state.mealPlanWeek = projectWeek;
      state.mealPlanModalOpen = false;
      render();
    });
  }

  // Delete Meal Plan
  document.querySelectorAll('.delete-meal-btn[data-delete-meal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-delete-meal');
      if (confirm('Remove this planned meal?')) {
        deleteMealPlan(id);
        render();
      }
    });
  });

  // CSV Export Buttons
  document.querySelectorAll('.export-btn[data-export-type]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.getAttribute('data-export-type');
      const csvs = exportAllCourseCsvs();

      if (type === 'summary') {
        downloadCsvFile(csvs.summaryCsv, 'kosherai_six_week_summary_comparison.csv');
      } else if (type === 'trips') {
        downloadCsvFile(csvs.tripsCsv, 'kosherai_shopping_trips_expenses.csv');
      } else if (type === 'items') {
        downloadCsvFile(csvs.itemsCsv, 'kosherai_grocery_purchased_items.csv');
      } else if (type === 'waste') {
        downloadCsvFile(csvs.wasteCsv, 'kosherai_food_waste_records.csv');
      }
    });
  });

  // Download All CSVs
  const downloadAllCsvsBtn = document.querySelector('#download-all-csvs-btn');
  if (downloadAllCsvsBtn) {
    downloadAllCsvsBtn.addEventListener('click', () => {
      const csvs = exportAllCourseCsvs();
      downloadCsvFile(csvs.summaryCsv, 'kosherai_six_week_summary_comparison.csv');
      setTimeout(() => downloadCsvFile(csvs.tripsCsv, 'kosherai_shopping_trips_expenses.csv'), 300);
      setTimeout(() => downloadCsvFile(csvs.itemsCsv, 'kosherai_grocery_purchased_items.csv'), 600);
      setTimeout(() => downloadCsvFile(csvs.wasteCsv, 'kosherai_food_waste_records.csv'), 900);
    });
  }

  // Course Project Config Modal Open & Close
  const openConfigBtn = document.querySelector('#open-config-btn');
  const closeConfigModalBtn = document.querySelector('#close-config-modal-btn');
  const cancelConfigModalBtn = document.querySelector('#cancel-config-modal-btn');

  if (openConfigBtn) openConfigBtn.addEventListener('click', () => { state.configModalOpen = true; render(); });
  if (closeConfigModalBtn) closeConfigModalBtn.addEventListener('click', () => { state.configModalOpen = false; render(); });
  if (cancelConfigModalBtn) cancelConfigModalBtn.addEventListener('click', () => { state.configModalOpen = false; render(); });

  // Course Project Config Form Submit
  const projectConfigForm = document.querySelector('#project-config-form');
  if (projectConfigForm) {
    projectConfigForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const startDate = document.querySelector('#cfg-start-date')?.value || PROJECT_CONFIG.START_DATE;
      const baseline = parseFloat(document.querySelector('#cfg-baseline-budget')?.value || 4000);

      const weeklyBudgets = {};
      for (let w = 1; w <= 6; w++) {
        const val = parseFloat(document.querySelector(`#cfg-week-${w}-budget`)?.value || baseline);
        weeklyBudgets[w] = val;
      }

      saveCourseConfig({
        startDate,
        baselineBudget: baseline,
        weeklyBudgets
      });

      state.configModalOpen = false;
      render();
    });
  }
}

// Helper: Processes scanned/entered text with Gemini AI (if key present) or offline rule engine
async function processScanText(text, title = 'Food Label', isReceipt = false) {
  if (!text || !text.trim()) return;
  const settings = getSettings();
  console.log(`[Scanner] Gemini Key present: ${Boolean(settings.geminiApiKey)}`);
  console.log(`[Scanner] Cloudinary configured: ${Boolean(settings.cloudinaryCloudName && settings.cloudinaryPreset)}`);

  const isReceiptScan = isReceipt || state.scanTarget === 'receipt' || /SIL LABUYO|CKN BRST|MG BRTH|PTIS REF|SM SUPERMARKET|PUREGOLD|ROBINSONS/i.test(text);
  if (isReceiptScan) {
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l && !l.toUpperCase().startsWith('TOTAL') && !l.toUpperCase().includes('CHANGE') && !l.toUpperCase().includes('CASHIER'));
    const storeMatch = text.match(/(SM SUPERMARKET|PUREGOLD|ROBINSONS|SAVEMORE|WALTERMART|SUPERMARKET)/i);
    const storeName = storeMatch ? storeMatch[0].toUpperCase() : 'Supermarket';
    const auditedItems = rawLines
      .filter(l => !l.toUpperCase().includes('SUPERMARKET') && !l.toUpperCase().includes('MEGAMALL'))
      .map(l => auditReceiptItemOffline(l, state.activeDiet || 'lid'));

    state.scannedReceiptAudit = {
      storeName,
      detectedItemsCount: auditedItems.length,
      items: auditedItems
    };

    const hasAvoid = auditedItems.some(i => i.status === 'AVOID');
    const hasCaution = auditedItems.some(i => i.status === 'CAUTION');
    const overallStatus = hasAvoid ? 'AVOID' : hasCaution ? 'CAUTION' : 'SAFE';

    state.scanAnalysis = {
      isReceipt: true,
      storeName,
      detectedItemsCount: auditedItems.length,
      status: overallStatus,
      overallBadge: `${storeName} Receipt`,
      reasons: [`Audited ${auditedItems.length} grocery line items under ${(state.activeDiet || 'lid').toUpperCase()} protocol.`],
      items: auditedItems,
      source: 'OFFLINE_RULE_ENGINE'
    };

    state.scanHistory = saveScanResult({
      title: title || `${storeName} Receipt Audit`,
      rawText: text,
      status: overallStatus,
      reason: `Audited ${auditedItems.length} items under ${(state.activeDiet || 'lid').toUpperCase()}`,
      flaggedIngredients: auditedItems.filter(i => i.status === 'AVOID').map(i => i.cleanName),
      imageUrl: state.imagePreviewUrl || null,
      cloudinaryUrl: state.cloudinaryUrl || null,
      analysis: state.scanAnalysis,
      aiAnalysis: null
    });

    render();
    refreshScanHistory();
    return;
  }

  let analysis = null;
  let aiResult = null;

  if (settings.geminiApiKey) {
    try {
      state.aiLoading = true;
      render();
      aiResult = await verifyWithGeminiAI(text, settings.geminiApiKey, state.activeDiet || 'lid');
      state.aiAnalysis = aiResult;
      const probTokens = aiResult.problemIngredients || [];
      analysis = {
        isSafe: aiResult.status === 'SAFE',
        status: aiResult.status,
        overallBadge: aiResult.status === 'SAFE' ? 'SAFE TO EAT' : aiResult.status === 'AVOID' ? 'STRICTLY AVOID' : 'CHECK LABEL CAREFULLY',
        reasons: Array.isArray(aiResult.reasons) ? aiResult.reasons : [aiResult.reason],
        reason: aiResult.reason,
        problemIngredients: probTokens,
        detectedForbidden: aiResult.status === 'AVOID' ? probTokens.map(p => ({
          name: p,
          matchedWord: p,
          reason: aiResult.reason
        })) : [],
        detectedCaution: aiResult.status === 'CAUTION' ? probTokens.map(p => ({
          name: p,
          matchedWord: p,
          reason: aiResult.reason
        })) : [],
        parsedTokens: text.split(/[,;\n•]+/).map(t => t.trim()).filter(Boolean).map(tok => ({
          text: tok,
          status: probTokens.some(p => tok.toLowerCase().includes(p.toLowerCase())) ? aiResult.status : 'SAFE',
          matchedReason: aiResult.reason
        })),
        source: 'GEMINI_AI'
      };
    } catch (err) {
      console.warn('[Scanner] Gemini evaluation failed, falling back to offline rule engine:', err);
      analysis = analyzeIngredients(text);
      analysis.source = 'OFFLINE_RULE_ENGINE';
      state.aiAnalysis = null;
    } finally {
      state.aiLoading = false;
    }
  } else {
    analysis = analyzeIngredients(text);
    analysis.source = 'OFFLINE_RULE_ENGINE';
    state.aiAnalysis = null;
  }

  state.scanAnalysis = analysis;
  const flaggedIngredients = [
    ...(state.aiAnalysis?.problemIngredients || []),
    ...(analysis.detectedForbidden || []).map(f => f.matchedWord || f.name),
    ...(analysis.detectedCaution || []).map(c => c.matchedWord || c.name)
  ];
  const uniqueFlagged = [...new Set(flaggedIngredients.map(t => String(t).trim()))].filter(Boolean);
  const reason = state.aiAnalysis?.reason || analysis.reason || (analysis.reasons && analysis.reasons[0]) || '';

  state.scanHistory = saveScanResult({
    title,
    rawText: text,
    status: analysis.status,
    reason,
    flaggedIngredients: uniqueFlagged,
    imageUrl: state.imagePreviewUrl || null,
    cloudinaryUrl: state.cloudinaryUrl || null,
    analysis,
    aiAnalysis: state.aiAnalysis
  });

  render();
  refreshScanHistory();
}

/**
 * Fetches latest scan history from Neon PostgreSQL and updates state
 */
export async function refreshScanHistory() {
  try {
    const history = await getScanHistory();
    if (history && Array.isArray(history)) {
      state.scanHistory = history;
      render();
    }
  } catch (err) {
    console.warn('[KosherAI] Failed to refresh scan history:', err);
  }
}

// Connectivity change listener
window.addEventListener('online', () => {
  state.isOnline = true;
  render();
  refreshScanHistory();
});
window.addEventListener('offline', () => {
  state.isOnline = false;
  render();
});

// Register Service Worker for Offline PWA Capabilities (Production only)
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => {
          console.log('KosherAI Service Worker registered successfully with scope:', reg.scope);
        },
        (err) => {
          console.warn('KosherAI Service Worker registration failed:', err);
        }
      );
    });
  }
}

// Initial Render and mount sync from Neon PostgreSQL
render();
refreshScanHistory();

