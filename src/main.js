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
import { renderCourseProjectView, createReceiptItemRowHtml } from './components/CourseProjectView.js';
import { parseQuantityAndUnit, createManualItemRowHtml } from './components/ManualTripModal.js';
import { renderAuthModalHtml, authenticateUser, isValidEmail } from './components/AuthModal.jsx';
import { getAuthHeaders } from './services/authHeaders.js';
import {
  toggleRecipeLike,
  recordRecipeView,
  fetchRecipeDetails,
  postRecipeComment,
  fetchAllRecipeInteractions,
  syncPendingRecipeInteractions
} from './services/recipeInteractionsStorage.js';

import { searchDatabase, analyzeIngredients, analyzeRecipe } from './services/ruleEngine.js';
import { scaleRecipe } from './services/recipeScaler.js';
import { detectOverBuying, renderOverBuyingAlertsHtml, dismissWarningKey } from './services/overBuyingDetector.js';
import { compressImage, compressImageForOCR, runClientOCR, verifyWithGeminiAI, scanSupermarketReceipt, scanReceiptWithPaddleOCR, auditReceiptItemOffline } from './services/aiVerification.js';
import {
  getSettings,
  saveSettings,
  getHouseholdMembers,
  setHouseholdMembers,
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
  getShoppingTrips,
  saveShoppingTrip,
  updateShoppingTrip,
  deleteShoppingTrip,
  syncPendingTrips,
  restoreFromNeon,
  saveFoodWasteRecord,
  deleteFoodWasteRecord,
  markFoodWasteSynced,
  syncPendingFoodWaste,
  saveMealPlan,
  deleteMealPlan,
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
} from './services/courseProjectStorage.js';
import {
  saveInventoryItem,
  consumeInventoryItem,
  discardInventoryItem,
  deleteInventoryItem
} from './services/inventoryService.js';

import {
  saveFoodWasteToIndexedDB,
  markFoodWasteAsSyncedInIndexedDB
} from './services/indexedDbStorage.js';

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

  // Scanner Tab (Consolidated single source of truth: 'food_label' | 'receipt' | 'paste')
  scannerTab: 'food_label',
  inputMode: 'camera', // 'camera' | 'text'
  scanTarget: 'label', // 'label' | 'receipt'
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
  activeCommentDrawerRecipe: null,
  commentUserName: (typeof localStorage !== 'undefined' ? localStorage.getItem('kosherai_user_name') : '') || '',
  household_members: getHouseholdMembers(),

  // Settings
  settings: getSettings(),
  settingsOpen: false,

  // Six-Week Course Project State
  courseSubTab: 'dashboard', // 'dashboard' | 'trips' | 'groceries' | 'waste' | 'mealplan' | 'export'
  selectedWeekView: 1,
  mealPlanWeek: 2,
  insightsPeriod: 'last_30_days',
  isIntelligenceExpanded: false,
  receiptModalOpen: false,
  manualTripModalOpen: false,
  editTripModalOpen: false,
  editingTripId: null,
  editingTrip: null,
  wasteModalOpen: false,
  mealPlanModalOpen: false,
  inventoryModalOpen: false,
  configModalOpen: false,
  groceryVenueMode: (typeof localStorage !== 'undefined' ? localStorage.getItem('kosherai_venue_mode') : null) || 'supermarket',
  receiptPreviewUrl: null,
  scannedReceiptData: null,
  receiptScanning: false,
  receiptProgress: 0,
  receiptStatusMsg: '',

  // Neon cloud re-hydration status ({ ok, message } | null) and in-flight flag
  neonRestoreStatus: null,
  neonRestoring: false,

  // Global Auth Modal Overlay State
  authModalOpen: false,
  authModalMode: 'signin',
  authModalError: '',
  authModalLoading: false,

  // Manual Header Cloud Sync State
  isSyncing: false,
  justSynced: false
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

    ${renderHeader(state.isOnline, state.appMode, state.showProjectTab, state.activeDiet, state.theme, null, state.isSyncing, state.justSynced)}
    
    <main class="app-container pt-24">
      ${activeContentHtml}
    </main>

    ${renderBottomNav(currentNavTab, state.appMode)}

    ${state.selectedItem ? renderItemDetailModal(state.selectedItem, state.activeDiet) : ''}
    ${state.settingsOpen ? renderSettingsModal(state.settings, state.theme, state.showProjectTab, state.activeDiet) : ''}
    ${state.authModalOpen ? renderAuthModalHtml({ isOpen: true, mode: state.authModalMode, errorMsg: state.authModalError, isLoading: state.authModalLoading, values: state.authModalValues || {} }) : ''}
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

  // Header Brand click -> Manual Cloud Re-sync & Home Navigation
  const brandBtn = document.querySelector('#brand-logo-btn');
  if (brandBtn) {
    brandBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (state.isSyncing) return;

      state.isSyncing = true;
      state.justSynced = false;
      render();

      try {
        // Trigger concurrent re-fetch of /api/scans, /api/trips, and /api/food-waste with credentials: 'include'
        await Promise.allSettled([
          refreshScanHistory(),
          pushThenRestoreFromNeon({ manual: true })
        ]);
        state.justSynced = true;
        showToast?.('✓ Cloud sync complete');
      } catch (err) {
        console.warn('[Header Sync] Re-sync error:', err);
      } finally {
        state.isSyncing = false;
        render();
        setTimeout(() => {
          if (state.justSynced) {
            state.justSynced = false;
            render();
          }
        }, 2500);
      }
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

  // Header Sign In / Create Account modal trigger
  const headerSignInBtn = document.querySelector('#header-signin-btn');
  if (headerSignInBtn) {
    headerSignInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      state.authModalOpen = true;
      state.authModalMode = 'signin';
      state.authModalError = '';
      state.authModalLoading = false;
      render();
    });
  }

  const headerSignUpBtn = document.querySelector('#header-signup-btn');
  if (headerSignUpBtn) {
    headerSignUpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      state.authModalOpen = true;
      state.authModalMode = 'signup';
      state.authModalError = '';
      state.authModalLoading = false;
      render();
    });
  }

  // Header Sign Out & Client Tenant Cache Purge
  const headerSignOutBtn = document.querySelector('#header-signout-btn');
  if (headerSignOutBtn) {
    headerSignOutBtn.addEventListener('click', async () => {
      const keysToClear = [
        'kosherai_course_trips',
        'kosherai_course_grocery_items',
        'kosherai_course_food_waste',
        'kosherai_course_expenses',
        'kosherai_course_meal_plans',
        'kosherai_inventory',
        'kosherai_scan_history',
        'kosherai_current_user',
        'kosherai_user_session',
        'better-auth.session_token',
        'kosherai_venue_mode'
      ];
      keysToClear.forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
      sessionStorage.clear();
      if (window.indexedDB) {
        try { window.indexedDB.deleteDatabase('KosherAICourseDB'); } catch (_) {}
      }
      try {
        await fetch('/api/auth/sign-out', {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include'
        }).catch(() => {});
      } catch (_) {}
      showToast?.('Signed out successfully.');
      render();
      window.dispatchEvent(new CustomEvent('kosherai:auth-changed', { detail: null }));
    });
  }

  // Auth Modal Event Handlers
  if (state.authModalOpen) {
    const authCloseBtn = document.querySelector('#auth-modal-close-btn');
    if (authCloseBtn) {
      authCloseBtn.addEventListener('click', () => {
        state.authModalOpen = false;
        state.authModalError = '';
        render();
      });
    }

    const authOverlay = document.querySelector('#auth-modal-overlay');
    if (authOverlay) {
      authOverlay.addEventListener('click', (e) => {
        if (e.target === authOverlay && !state.authModalLoading) {
          state.authModalOpen = false;
          state.authModalError = '';
          render();
        }
      });
    }

    const tabSignIn = document.querySelector('#auth-html-tab-signin');
    const switchSignIn = document.querySelector('#auth-html-switch-signin');
    [tabSignIn, switchSignIn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          state.authModalMode = 'signin';
          state.authModalError = '';
          render();
        });
      }
    });

    const tabSignUp = document.querySelector('#auth-html-tab-signup');
    const switchSignUp = document.querySelector('#auth-html-switch-signup');
    [tabSignUp, switchSignUp].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          state.authModalMode = 'signup';
          state.authModalError = '';
          render();
        });
      }
    });

    // Show / hide password toggles
    document.querySelectorAll('[data-auth-toggle-password]').forEach((toggleBtn) => {
      toggleBtn.addEventListener('click', () => {
        const input = document.getElementById(toggleBtn.dataset.authTogglePassword);
        if (!input) return;
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        toggleBtn.setAttribute('aria-pressed', String(reveal));
        toggleBtn.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
        toggleBtn.title = reveal ? 'Hide password' : 'Show password';
      });
    });

    const authForm = document.querySelector('#auth-modal-form');
    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.authModalLoading) return; // prevent duplicate submissions
        state.authModalError = '';

        const emailInput = document.querySelector('#auth-html-email');
        const passInput = document.querySelector('#auth-html-password');
        const nameInput = document.querySelector('#auth-html-name');
        const confirmPassInput = document.querySelector('#auth-html-confirm-password');

        const email = (emailInput?.value || '').trim();
        const password = passInput?.value || '';
        const name = (nameInput?.value || '').trim();
        const confirmPassword = confirmPassInput?.value || '';

        // Preserve non-secret field values across re-renders (passwords are never re-rendered)
        state.authModalValues = { email, name };

        if (!email) {
          state.authModalError = 'Please enter your email address.';
          render();
          return;
        }

        if (!isValidEmail(email)) {
          state.authModalError = 'Please enter a valid email address (e.g., patient@example.com).';
          render();
          return;
        }

        if (!password) {
          state.authModalError = 'Please enter your password.';
          render();
          return;
        }

        if (state.authModalMode === 'signup') {
          if (!name) {
            state.authModalError = 'Please enter your full name.';
            render();
            return;
          }
          if (password.length < 6) {
            state.authModalError = 'Password must be at least 6 characters in length.';
            render();
            return;
          }
          if (password !== confirmPassword) {
            state.authModalError = 'Passwords do not match. Please verify and try again.';
            render();
            return;
          }
        }

        state.authModalLoading = true;
        render();

        try {
          const userRecord = await authenticateUser(state.authModalMode, {
            email,
            password,
            name
          });

          const sessionPayload = {
            user: {
              id: userRecord.id || userRecord.userId || 'usr_' + Date.now(),
              email,
              name: userRecord.name || (state.authModalMode === 'signup' ? name : email.split('@')[0]),
              ...(userRecord.token ? { token: userRecord.token } : {})
            },
            token: userRecord.token || null,
            session: {
              token: userRecord.token || null,
              createdAt: new Date().toISOString()
            }
          };

          localStorage.setItem('kosherai_user_session', JSON.stringify(sessionPayload));
          localStorage.setItem('kosherai_current_user', JSON.stringify(sessionPayload.user));
          if (userRecord.token) {
            try { localStorage.setItem('better-auth.session_token', userRecord.token); } catch (_) {}
          }

          state.authModalOpen = false;
          state.authModalLoading = false;
          state.authModalError = '';
          state.authModalValues = {};
          render();

          // Trigger refresh of user's trips and scans
          showToast?.(`✓ Signed in as ${sessionPayload.user.name}`);
          window.dispatchEvent(new CustomEvent('kosherai:auth-changed', { detail: sessionPayload }));
          window.dispatchEvent(new CustomEvent('kosherai:sync-data', { detail: { userId: sessionPayload.user.id } }));
          pushThenRestoreFromNeon({ manual: true }).catch(() => {});
          refreshScanHistory().catch(() => {});
        } catch (err) {
          state.authModalLoading = false;
          state.authModalError = err.message || 'Authentication failed. Please verify credentials.';
          render();
        }
      });
    }
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

  // Settings Household Members Stepper Controls
  const settingsHouseholdDecBtn = document.querySelector('#settings-household-dec-btn');
  const settingsHouseholdIncBtn = document.querySelector('#settings-household-inc-btn');
  const settingsHouseholdVal = document.querySelector('#settings-household-val');
  const settingsHouseholdBadge = document.querySelector('#settings-household-badge');
  const settingsHouseholdInput = document.querySelector('#household-members-input');

  if (settingsHouseholdDecBtn && settingsHouseholdIncBtn && settingsHouseholdInput) {
    settingsHouseholdDecBtn.addEventListener('click', () => {
      let current = parseInt(settingsHouseholdInput.value || '4', 10);
      if (current > 1) {
        current -= 1;
        settingsHouseholdInput.value = current;
        if (settingsHouseholdVal) settingsHouseholdVal.textContent = `${current} Members`;
        if (settingsHouseholdBadge) settingsHouseholdBadge.textContent = `${current} Members`;
      }
    });

    settingsHouseholdIncBtn.addEventListener('click', () => {
      let current = parseInt(settingsHouseholdInput.value || '4', 10);
      if (current < 20) {
        current += 1;
        settingsHouseholdInput.value = current;
        if (settingsHouseholdVal) settingsHouseholdVal.textContent = `${current} Members`;
        if (settingsHouseholdBadge) settingsHouseholdBadge.textContent = `${current} Members`;
      }
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
      const householdMembersVal = parseInt(document.querySelector('#household-members-input')?.value || '4', 10);

      setHouseholdMembers(householdMembersVal);
      state.household_members = householdMembersVal;

      state.settings = saveSettings({
        geminiApiKey: geminiKey.trim(),
        cloudinaryCloudName: cloudName.trim(),
        cloudinaryPreset: cloudPreset.trim(),
        prepDate,
        household_members: householdMembersVal
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

  if (toggleLabelModeBtn) {
    toggleLabelModeBtn.addEventListener('click', () => {
      state.scannerTab = 'food_label';
      state.scanTarget = 'label';
      state.inputMode = 'camera';
      render();
    });
  }
  if (toggleReceiptModeBtn) {
    toggleReceiptModeBtn.addEventListener('click', () => {
      state.scannerTab = 'receipt';
      state.scanTarget = 'receipt';
      state.inputMode = 'camera';
      render();
    });
  }
  if (toggleTextModeBtn) {
    toggleTextModeBtn.addEventListener('click', () => {
      state.scannerTab = 'paste';
      state.inputMode = 'text';
      render();
    });
  }
  if (toggleCameraModeBtn) {
    toggleCameraModeBtn.addEventListener('click', () => {
      state.scannerTab = state.scanTarget === 'receipt' ? 'receipt' : 'food_label';
      state.inputMode = 'camera';
      render();
    });
  }
  if (dismissScanErrorBtn) {
    dismissScanErrorBtn.addEventListener('click', () => {
      state.scanError = null;
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
        state.scanProductName = sample.title;
        state.imagePreviewUrl = null;
        if (sample.isReceipt) {
          state.scannerTab = 'receipt';
          state.scanTarget = 'receipt';
        } else {
          state.scannerTab = 'food_label';
          state.scanTarget = 'label';
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

  // Receipt Audit Modal Backdrop & Close Handlers
  const receiptAuditBackdrop = document.querySelector('#receipt-audit-modal-backdrop');
  const receiptAuditCloseBtn = document.querySelector('#receipt-audit-close-btn');
  const receiptAuditDoneBtn = document.querySelector('#receipt-audit-done-btn');

  if (receiptAuditBackdrop) {
    receiptAuditBackdrop.addEventListener('click', (e) => {
      if (e.target === receiptAuditBackdrop) {
        state.scannedReceiptAudit = null;
        render();
      }
    });
  }
  if (receiptAuditCloseBtn) {
    receiptAuditCloseBtn.addEventListener('click', () => {
      state.scannedReceiptAudit = null;
      render();
    });
  }
  if (receiptAuditDoneBtn) {
    receiptAuditDoneBtn.addEventListener('click', () => {
      state.scannedReceiptAudit = null;
      render();
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

  // Household Portion Scaling Controls
  document.querySelectorAll('.household-dec-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = state.household_members || getHouseholdMembers();
      if (current > 1) {
        const next = setHouseholdMembers(current - 1);
        state.household_members = next;
        render();
      }
    });
  });

  document.querySelectorAll('.household-inc-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = state.household_members || getHouseholdMembers();
      if (current < 20) {
        const next = setHouseholdMembers(current + 1);
        state.household_members = next;
        render();
      }
    });
  });

  // Recipe Category Filter
  document.querySelectorAll('.recipe-filter-btn[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-category');
      state.recipeCategoryFilter = cat;
      render();
    });
  });

  // Load into Recipe Auditor (Audits the dynamically scaled ingredient quantities)
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
        recordRecipeView(rid);
        const scaled = scaleRecipe(recipe, state.household_members || 4);
        state.recipeText = scaled.scaledIngredientLines.join('\n');
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

  // Recipe Like Button Toggle
  document.querySelectorAll('[data-like-recipe-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const rid = btn.getAttribute('data-like-recipe-id');
      if (!rid) return;
      await toggleRecipeLike(rid);
      render();
    });
  });

  // Recipe Comments Drawer Trigger
  document.querySelectorAll('[data-comments-recipe-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const rid = btn.getAttribute('data-comments-recipe-id');
      if (!rid) return;

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

      if (recipe) {
        state.activeCommentDrawerRecipe = recipe;
        recordRecipeView(rid);
        render();
        fetchRecipeDetails(rid).then(() => {
          if (state.activeCommentDrawerRecipe?.id === rid) {
            render();
          }
        }).catch(() => {});
      }
    });
  });

  // Close Comments Drawer
  const closeCommentsDrawerBtn = document.querySelector('#close-comments-drawer-btn');
  if (closeCommentsDrawerBtn) {
    closeCommentsDrawerBtn.addEventListener('click', () => {
      state.activeCommentDrawerRecipe = null;
      render();
    });
  }

  const commentsDrawerBackdrop = document.querySelector('#comments-drawer-backdrop');
  if (commentsDrawerBackdrop) {
    commentsDrawerBackdrop.addEventListener('click', (e) => {
      if (e.target.getAttribute('data-close-comments-drawer') === 'true') {
        state.activeCommentDrawerRecipe = null;
        render();
      }
    });
  }

  // Submit Recipe Comment / Tip
  const recipeCommentForm = document.querySelector('#recipe-comment-form');
  if (recipeCommentForm) {
    recipeCommentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rid = recipeCommentForm.getAttribute('data-recipe-id');
      const authorInput = document.querySelector('#comment-author-input');
      const textInput = document.querySelector('#comment-text-input');
      const submitBtn = document.querySelector('#submit-comment-btn');

      const userName = (authorInput?.value || '').trim() || 'Caregiver / Cook';
      const comment = (textInput?.value || '').trim();
      if (!comment || !rid) return;

      localStorage.setItem('kosherai_user_name', userName);
      state.commentUserName = userName;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Posting...</span>';
      }

      try {
        await postRecipeComment(rid, userName, comment);
        if (textInput) textInput.value = '';
        render();
      } catch (err) {
        console.error('Failed to post recipe comment:', err);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Post Tip</span>';
        }
      }
    });
  }

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
  document.querySelectorAll('[data-mealplan-week]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const w = parseInt(e.currentTarget.getAttribute('data-mealplan-week'), 10);
      state.mealPlanWeek = w;
      render();
    });
  });

  // Toggle Food Cost & Spoilage Intelligence Section Collapse/Expand
  const toggleIntelligenceBtn = document.querySelector('#toggle-food-cost-intelligence-btn');
  if (toggleIntelligenceBtn) {
    toggleIntelligenceBtn.addEventListener('click', (e) => {
      e.preventDefault();
      state.isIntelligenceExpanded = !state.isIntelligenceExpanded;
      render();
    });
  }

  // Household Grocery Insights Reporting Period Filter (Phase 3)
  document.querySelectorAll('[data-insights-period]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = e.currentTarget.getAttribute('data-insights-period');
      if (p) {
        state.insightsPeriod = p;
        render();
      }
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

  // Open Receipt Scanner Modal / Unified Food Intake
  const openReceiptScannerBtn = document.querySelector('#open-receipt-scanner-btn');
  const emptyScanBtn = document.querySelector('#empty-scan-btn');
  const handleOpenReceiptScanner = () => {
    state.receiptModalOpen = true;
    state.groceryVenueMode = (typeof localStorage !== 'undefined' ? localStorage.getItem('kosherai_venue_mode') : null) || state.groceryVenueMode || 'supermarket';
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

  // In-Modal Venue Mode Toggle (Segmented Switch: Supermarket vs Wet Market)
  document.querySelectorAll('.venue-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const venue = btn.getAttribute('data-venue');
      if (venue && venue !== state.groceryVenueMode) {
        state.groceryVenueMode = venue;
        try { localStorage.setItem('kosherai_venue_mode', venue); } catch (e) {}
        render();
      }
    });
  });

  // Mobile Portrait Orientation Tip Dismissal
  const dismissTipBtn = document.querySelector('#dismiss-portrait-tip-btn');
  if (dismissTipBtn) {
    dismissTipBtn.addEventListener('click', () => {
      const tip = document.querySelector('#portrait-orientation-tip');
      if (tip) tip.style.display = 'none';
      try { sessionStorage.setItem('kosherai_portrait_tip_dismissed', '1'); } catch (e) {}
    });
  }

  // Live Line Total Calculation for Item Rows
  function attachItemRowCalculationListeners() {
    const tbody = document.querySelector('#receipt-items-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(row => {
      const qtyInput = row.querySelector('.item-qty-val');
      const unitSelect = row.querySelector('.item-unit-val');
      const priceInput = row.querySelector('.item-price-val');
      const totalInput = row.querySelector('.item-total-val');

      const handleCalc = () => {
        const qty = parseFloat(qtyInput?.value || 0);
        const price = parseFloat(priceInput?.value || 0);
        if (totalInput && !isNaN(qty) && !isNaN(price) && qty > 0 && price >= 0) {
          totalInput.value = (qty * price).toFixed(2);
        }
      };

      if (qtyInput && !qtyInput._hasCalcListener) {
        qtyInput.addEventListener('input', handleCalc);
        qtyInput.addEventListener('change', handleCalc);
        qtyInput._hasCalcListener = true;
      }
      if (unitSelect && !unitSelect._hasCalcListener) {
        unitSelect.addEventListener('change', handleCalc);
        unitSelect._hasCalcListener = true;
      }
      if (priceInput && !priceInput._hasCalcListener) {
        priceInput.addEventListener('input', handleCalc);
        priceInput.addEventListener('change', handleCalc);
        priceInput._hasCalcListener = true;
      }
    });
  }
  attachItemRowCalculationListeners();

  // Apply Sum of Items to Total Amount Paid
  const applyItemsSumBtn = document.querySelector('#apply-items-sum-btn');
  if (applyItemsSumBtn) {
    applyItemsSumBtn.addEventListener('click', () => {
      let sum = 0;
      document.querySelectorAll('#receipt-items-tbody tr').forEach(row => {
        const lineTotal = parseFloat(row.querySelector('.item-total-val')?.value || 0);
        if (!isNaN(lineTotal) && lineTotal > 0) {
          sum += lineTotal;
        } else {
          const qty = parseFloat(row.querySelector('.item-qty-val')?.value || 1);
          const price = parseFloat(row.querySelector('.item-price-val')?.value || 0);
          if (!isNaN(price) && price > 0) sum += (qty * price);
        }
      });
      const totalInput = document.querySelector('#edit-total-amount');
      if (totalInput && sum > 0) {
        totalInput.value = sum.toFixed(2);
        showToast(`✓ Applied sum of items (₱${sum.toFixed(2)}) to total amount paid`, 'success');
      }
    });
  }

  // Add Item Row in Receipt Verification Table
  const addReceiptItemRowBtn = document.querySelector('#add-receipt-item-row');
  if (addReceiptItemRowBtn) {
    addReceiptItemRowBtn.addEventListener('click', () => {
      const tbody = document.querySelector('#receipt-items-tbody');
      if (tbody) {
        const isWet = state.groceryVenueMode === 'wet_market';
        const temp = document.createElement('tbody');
        temp.innerHTML = createReceiptItemRowHtml(
          { name: '', quantity: 1, unit: isWet ? 'kg' : 'pcs', unitPrice: '', totalPrice: '' },
          tbody.children.length,
          null,
          isWet
        );
        const newRow = temp.firstElementChild;
        if (newRow) {
          tbody.appendChild(newRow);
          attachRowRemoveListeners();
          attachItemRowCalculationListeners();
          const nameInput = newRow.querySelector('.item-name-val');
          if (nameInput) nameInput.focus();
        }
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
    receiptVerificationForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const activeVenue = state.groceryVenueMode || (typeof localStorage !== 'undefined' ? localStorage.getItem('kosherai_venue_mode') : null) || 'supermarket';
      const isWetMarket = activeVenue === 'wet_market';
      const trip_type = isWetMarket ? 'wet_market' : 'supermarket';
      const tripType = trip_type;

      const storeNameInput = document.querySelector('#edit-store-name')?.value?.trim();
      const defaultStore = isWetMarket ? 'Wet Market / Palengke' : 'Supermarket';
      const storeName = storeNameInput || defaultStore;
      const purchaseDate = document.querySelector('#edit-purchase-date')?.value || new Date().toISOString().split('T')[0];
      const scaleWeight = parseFloat(document.querySelector('#edit-scale-weight')?.value || 0);
      const totalAmount = parseFloat(document.querySelector('#edit-total-amount')?.value || 0);

      const items = [];
      document.querySelectorAll('#receipt-items-tbody tr').forEach((row, idx) => {
        const name = row.querySelector('.item-name-val')?.value?.trim();
        const qty = parseFloat(row.querySelector('.item-qty-val')?.value || 1);
        const unit = row.querySelector('.item-unit-val')?.value?.trim() || (isWetMarket ? 'kg' : 'pcs');
        const price = parseFloat(row.querySelector('.item-price-val')?.value || 0);
        const total = parseFloat(row.querySelector('.item-total-val')?.value || (qty * price) || price || 0);
        const category = row.getAttribute('data-item-category') || (isWetMarket ? 'Wet Market Produce' : 'General Food');
        const lidStatus = row.getAttribute('data-item-status') || 'SAFE';
        const lidReason = row.getAttribute('data-item-reason') || '';

        let weightGrams = 0;
        const unitLower = unit.toLowerCase();
        if (unitLower === 'kg' || unitLower === 'kgs' || unitLower === 'kilo' || unitLower === 'kilos') {
          weightGrams = Math.round(qty * 1000);
        } else if (unitLower === 'g' || unitLower === 'gm' || unitLower === 'gram' || unitLower === 'grams') {
          weightGrams = Math.round(qty);
        }

        if (name) {
          items.push({
            id: `item_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            name,
            rawReceiptText: `${name} (${qty} ${unit})`.trim(),
            quantity: qty,
            unit,
            unitPrice: price,
            totalPrice: total,
            lineTotal: total,
            price: total,
            weightGrams,
            category,
            lidStatus,
            lidReason
          });
        }
      });

      // Save trip: POST to Neon first, persist to IndexedDB (offline-first sync)
      await saveShoppingTrip({
        storeName,
        date: purchaseDate,
        totalScaleWeightKg: scaleWeight, // Whole grocery physical scale weight
        totalAmountPaid: totalAmount,
        tripType,
        trip_type,
        receiptImageUrl: isWetMarket ? null : (state.receiptPreviewUrl || null),
        notes: isWetMarket
          ? (items.length > 0 ? `Wet market trip (${items.length} item${items.length === 1 ? '' : 's'} recorded)` : 'Manual wet market entry')
          : `Receipt scanned (${items.length} items verified)`,
        items,
        rawItems: items
      }, items);

      state.receiptModalOpen = false;
      state.scannedReceiptData = null;
      state.receiptPreviewUrl = null;
      render();
    });
  }

  // Manual Trip Modal Open & Close (Backward Compatibility: routes to unified modal with wet_market mode)
  const openManualTripBtn = document.querySelector('#open-manual-trip-btn');
  const emptyManualBtn = document.querySelector('#empty-manual-btn');
  const closeManualTripBtn = document.querySelector('#close-manual-trip-btn');
  const cancelManualTripBtn = document.querySelector('#cancel-manual-trip-btn');

  if (openManualTripBtn) openManualTripBtn.addEventListener('click', () => {
    state.receiptModalOpen = true;
    state.groceryVenueMode = 'wet_market';
    try { localStorage.setItem('kosherai_venue_mode', 'wet_market'); } catch (e) {}
    render();
  });
  if (emptyManualBtn) emptyManualBtn.addEventListener('click', () => {
    state.receiptModalOpen = true;
    state.groceryVenueMode = 'wet_market';
    try { localStorage.setItem('kosherai_venue_mode', 'wet_market'); } catch (e) {}
    render();
  });
  if (closeManualTripBtn) closeManualTripBtn.addEventListener('click', () => { state.manualTripModalOpen = false; render(); });
  if (cancelManualTripBtn) cancelManualTripBtn.addEventListener('click', () => { state.manualTripModalOpen = false; render(); });

  // Manual Trip Itemized Purchases Controls
  function updateManualItemsSummary() {
    const tbody = document.querySelector('#manual-items-tbody');
    const emptyHint = document.querySelector('#manual-items-empty-hint');
    const summary = document.querySelector('#manual-items-summary');
    const countText = document.querySelector('#manual-items-count-text');
    const sumBtn = document.querySelector('#manual-sum-to-total-btn');

    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    let sum = 0;
    let namedCount = 0;

    rows.forEach(row => {
      const name = row.querySelector('.manual-item-name')?.value?.trim();
      const price = parseFloat(row.querySelector('.manual-item-price')?.value || 0);
      if (name) namedCount++;
      if (!isNaN(price) && price > 0) sum += price;
    });

    if (rows.length === 0) {
      if (emptyHint) emptyHint.style.display = 'block';
      if (summary) summary.style.display = 'none';
    } else {
      if (emptyHint) emptyHint.style.display = 'none';
      if (summary) summary.style.display = 'flex';
      if (countText) {
        countText.textContent = `${namedCount} item${namedCount === 1 ? '' : 's'} recorded (Sum: ₱${sum.toFixed(2)})`;
      }
      if (sumBtn) {
        sumBtn.textContent = `⚡ Apply Sum (₱${sum.toFixed(2)}) to Total`;
      }
    }

    // Phase 2: Live Over-Buying Detection on manual items
    const manualAlertsBox = document.querySelector('#manual-overbuying-alerts');
    if (manualAlertsBox) {
      const candidateItems = [];
      rows.forEach(row => {
        const name = row.querySelector('.manual-item-name')?.value?.trim();
        const qtyVal = parseFloat(row.querySelector('.manual-item-qty')?.value);
        const unitVal = row.querySelector('.manual-item-unit')?.value;
        if (name) {
          candidateItems.push({
            name,
            quantity: !isNaN(qtyVal) ? qtyVal : 1,
            unit: unitVal || 'pcs'
          });
        }
      });

      if (candidateItems.length > 0) {
        try {
          const overBuying = detectOverBuying(candidateItems, {
            purchases: getGroceryItems(),
            wasteRecords: getFoodWasteRecords(),
            householdMembers: state.household_members || getHouseholdMembers()
          });
          manualAlertsBox.innerHTML = overBuying.hasWarnings ? renderOverBuyingAlertsHtml(overBuying.warnings) : '';
        } catch (_) {
          manualAlertsBox.innerHTML = '';
        }
      } else {
        manualAlertsBox.innerHTML = '';
      }
    }
  }

  function attachManualRowRemoveListeners() {
    document.querySelectorAll('.remove-manual-item-btn').forEach(btn => {
      btn.onclick = (e) => {
        const row = e.target.closest('tr');
        if (row) {
          row.remove();
          updateManualItemsSummary();
        }
      };
    });
  }

  // Add Item Row in Manual Trip Modal
  const addManualItemRowBtn = document.querySelector('#add-manual-item-row');
  if (addManualItemRowBtn) {
    addManualItemRowBtn.addEventListener('click', () => {
      const tbody = document.querySelector('#manual-items-tbody');
      if (tbody) {
        const temp = document.createElement('tbody');
        temp.innerHTML = createManualItemRowHtml('', '1 pcs', '');
        const newRow = temp.firstElementChild;
        if (newRow) {
          tbody.appendChild(newRow);
          attachManualRowRemoveListeners();

          const nameInput = newRow.querySelector('.manual-item-name');
          const priceInput = newRow.querySelector('.manual-item-price');
          const qtyInput = newRow.querySelector('.manual-item-qty');
          const unitSelect = newRow.querySelector('.manual-item-unit');

          if (nameInput) {
            nameInput.addEventListener('input', updateManualItemsSummary);
            nameInput.focus();
          }
          if (priceInput) priceInput.addEventListener('input', updateManualItemsSummary);
          if (qtyInput) qtyInput.addEventListener('input', updateManualItemsSummary);
          if (unitSelect) unitSelect.addEventListener('change', updateManualItemsSummary);

          updateManualItemsSummary();
        }
      }
    });
  }

  // Apply Sum to Total Amount Paid
  const manualSumToTotalBtn = document.querySelector('#manual-sum-to-total-btn');
  if (manualSumToTotalBtn) {
    manualSumToTotalBtn.addEventListener('click', () => {
      let sum = 0;
      document.querySelectorAll('#manual-items-tbody tr').forEach(row => {
        const price = parseFloat(row.querySelector('.manual-item-price')?.value || 0);
        if (!isNaN(price) && price > 0) sum += price;
      });
      const totalInput = document.querySelector('#manual-total-amount');
      if (totalInput && sum > 0) {
        totalInput.value = sum.toFixed(2);
      }
    });
  }

  // Attach live summary updates on initial row(s)
  document.querySelectorAll('#manual-items-tbody .manual-item-name, #manual-items-tbody .manual-item-price, #manual-items-tbody .manual-item-qty').forEach(input => {
    input.addEventListener('input', updateManualItemsSummary);
  });
  document.querySelectorAll('#manual-items-tbody .manual-item-unit').forEach(select => {
    select.addEventListener('change', updateManualItemsSummary);
  });
  attachManualRowRemoveListeners();
  updateManualItemsSummary();

  // Manual Trip Form Submit
  const manualTripForm = document.querySelector('#manual-trip-form');
  if (manualTripForm) {
    manualTripForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const storeName = document.querySelector('#manual-store-name')?.value?.trim() || 'Wet Market / Palengke';
      const date = document.querySelector('#manual-trip-date')?.value || new Date().toISOString().split('T')[0];
      const tripType = document.querySelector('#manual-trip-type')?.value || 'Wet Market / Palengke';
      const scaleWeight = parseFloat(document.querySelector('#manual-scale-weight')?.value || 0);
      const totalAmount = parseFloat(document.querySelector('#manual-total-amount')?.value || 0);
      const notes = document.querySelector('#manual-notes')?.value?.trim() || '';

      // Collect itemized purchases from manual rows
      const items = [];
      document.querySelectorAll('#manual-items-tbody tr').forEach((row, idx) => {
        const name = row.querySelector('.manual-item-name')?.value?.trim();
        const qtyVal = parseFloat(row.querySelector('.manual-item-qty')?.value);
        const unitVal = row.querySelector('.manual-item-unit')?.value;
        const qtyUnitInput = row.querySelector('.manual-item-qty-unit input:not(.manual-item-qty)') || row.querySelector('input.manual-item-qty-unit');
        const qtyUnitStr = qtyUnitInput?.value?.trim() || `${!isNaN(qtyVal) ? qtyVal : 1} ${unitVal || 'pcs'}`;
        const linePrice = parseFloat(row.querySelector('.manual-item-price')?.value || 0);

        if (name) {
          let quantity = !isNaN(qtyVal) ? qtyVal : 1;
          let unit = unitVal || 'pcs';
          let weightGrams = 0;

          if (qtyUnitInput?.value) {
            const parsed = parseQuantityAndUnit(qtyUnitInput.value);
            quantity = parsed.quantity;
            unit = parsed.unit;
            weightGrams = parsed.weightGrams;
          } else {
            if (unit === 'kg') weightGrams = Math.round(quantity * 1000);
            else if (unit === 'g') weightGrams = Math.round(quantity);
          }

          const unitPrice = quantity > 0 ? parseFloat((linePrice / quantity).toFixed(2)) : linePrice;

          items.push({
            id: `item_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            name,
            rawReceiptText: `${name} (${quantity} ${unit})`.trim(),
            quantity,
            unit,
            unitPrice,
            totalPrice: linePrice,
            lineTotal: linePrice,
            price: linePrice,
            weightGrams,
            category: tripType.includes('Wet') ? 'Wet Market Produce' : 'General Food'
          });
        }
      });

      const tripNotes = notes || (items.length > 0 ? `Manual trip (${items.length} item${items.length === 1 ? '' : 's'} recorded)` : '');

      await saveShoppingTrip({
        storeName,
        date,
        tripType,
        totalScaleWeightKg: scaleWeight,
        totalAmountPaid: totalAmount,
        notes: tripNotes,
        items,
        rawItems: items
      }, items);

      state.manualTripModalOpen = false;
      render();
    });
  }

  // Manual Neon Sync Button
  const manualSyncTripsBtn = document.querySelector('#manual-sync-trips-btn');
  if (manualSyncTripsBtn) {
    manualSyncTripsBtn.addEventListener('click', async () => {
      manualSyncTripsBtn.disabled = true;
      manualSyncTripsBtn.innerHTML = '🔄 Syncing...';
      try {
        await syncPendingTrips();
        await syncPendingFoodWaste();
        render();
      } catch (err) {
        console.warn('Manual sync failed:', err);
      } finally {
        if (manualSyncTripsBtn) {
          manualSyncTripsBtn.disabled = false;
          manualSyncTripsBtn.innerHTML = '☁️ Sync Neon';
        }
      }
    });
  }

  // Manual "Restore from Neon" Button: push pending local records, then pull the cloud copy
  const restoreNeonBtn = document.querySelector('#restore-neon-btn');
  if (restoreNeonBtn) {
    restoreNeonBtn.addEventListener('click', () => {
      pushThenRestoreFromNeon({ manual: true });
    });
  }

  // Delete Trip
  document.querySelectorAll('.delete-trip-btn[data-delete-trip]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-delete-trip');
      if (confirm('Delete this shopping trip and its linked grocery items & expense record?')) {
        await deleteShoppingTrip(id);
        render();
      }
    });
  });

  // Edit Trip (Opens modal or toggles inline editing)
  document.querySelectorAll('.edit-trip-btn[data-edit-trip]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-edit-trip');
      const trips = getShoppingTrips();
      const trip = trips.find(t => t.id === id);
      if (trip) {
        state.editingTripId = id;
        state.editingTrip = trip;
        state.editTripModalOpen = true;
        render();
      }
    });
  });

  // Edit Trip Modal Actions
  const closeEditTripBtn = document.querySelector('#close-edit-trip-btn');
  const cancelEditTripBtn = document.querySelector('#cancel-edit-trip-btn');
  if (closeEditTripBtn) {
    closeEditTripBtn.addEventListener('click', () => {
      state.editTripModalOpen = false;
      state.editingTripId = null;
      state.editingTrip = null;
      render();
    });
  }
  if (cancelEditTripBtn) {
    cancelEditTripBtn.addEventListener('click', () => {
      state.editTripModalOpen = false;
      state.editingTripId = null;
      state.editingTrip = null;
      render();
    });
  }

  // Edit Trip Form Submission (Modal)
  const editTripForm = document.querySelector('#edit-trip-form');
  if (editTripForm) {
    editTripForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tripId = editTripForm.getAttribute('data-trip-id') || state.editingTripId || state.editingTrip?.id;
      if (!tripId) return;

      const storeName = document.querySelector('#edit-store-name')?.value?.trim() || 'Supermarket';
      const tripType = document.querySelector('#edit-trip-type')?.value || 'Supermarket';
      const totalAmountPaid = parseFloat(document.querySelector('#edit-total-amount')?.value || 0);
      const totalScaleWeightKg = parseFloat(document.querySelector('#edit-scale-weight')?.value || 0);
      const date = document.querySelector('#edit-trip-date')?.value || new Date().toISOString().split('T')[0];
      const notes = document.querySelector('#edit-notes')?.value?.trim() || '';

      // Item Name / Extracted Item
      const itemNameInput = document.querySelector('#edit-item-name');
      const itemName = itemNameInput?.value?.trim() || '';
      const itemQty = parseFloat(document.querySelector('#edit-item-qty')?.value || 1);
      const itemUnit = document.querySelector('#edit-item-unit')?.value?.trim() || 'pcs';

      // Multiple items support if .edit-item-row exists
      const itemRows = document.querySelectorAll('.edit-item-row');
      let items = null;
      if (itemRows.length > 0) {
        items = [];
        itemRows.forEach(row => {
          const id = row.getAttribute('data-item-id');
          const name = row.querySelector('.edit-item-name')?.value?.trim();
          const quantity = parseFloat(row.querySelector('.edit-item-qty')?.value || 1);
          const unit = row.querySelector('.edit-item-unit')?.value?.trim() || 'pcs';
          if (name) items.push({ id, name, quantity, unit });
        });
      }

      // Non-blocking local-first write: update state and close modal instantly
      updateShoppingTrip(tripId, {
        storeName,
        tripType,
        totalAmountPaid,
        totalScaleWeightKg,
        date,
        notes,
        itemName,
        quantity: itemQty,
        itemQuantity: itemQty,
        itemQty,
        unit: itemUnit,
        itemUnit,
        items
      });

      state.editTripModalOpen = false;
      state.editingTripId = null;
      state.editingTrip = null;
      showToast('Shopping trip updated! Syncing with Neon...', 'info');
      render();
    });
  }

  // Inline Edit Trip Handlers
  document.querySelectorAll('.cancel-edit-trip-btn[data-cancel-trip]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.editingTripId = null;
      state.editingTrip = null;
      state.editTripModalOpen = false;
      render();
    });
  });

  document.querySelectorAll('.save-edit-trip-btn[data-save-trip]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tripId = e.currentTarget.getAttribute('data-save-trip');
      const card = e.currentTarget.closest('.trip-card');
      if (!tripId || !card) return;

      const storeName = card.querySelector('.edit-store-name')?.value?.trim() || 'Supermarket';
      const tripType = card.querySelector('.edit-trip-type')?.value || 'Supermarket';
      const totalAmountPaid = parseFloat(card.querySelector('.edit-total-amount')?.value || 0);
      const totalScaleWeightKg = parseFloat(card.querySelector('.edit-scale-weight')?.value || 0);
      const date = card.querySelector('.edit-trip-date')?.value || new Date().toISOString().split('T')[0];
      const notes = card.querySelector('.edit-notes')?.value?.trim() || '';
      const itemName = card.querySelector('.edit-item-name')?.value?.trim() || '';
      const itemQty = parseFloat(card.querySelector('.edit-item-qty')?.value || 1);
      const itemUnit = card.querySelector('.edit-item-unit')?.value?.trim() || 'pcs';

      updateShoppingTrip(tripId, {
        storeName,
        tripType,
        totalAmountPaid,
        totalScaleWeightKg,
        date,
        notes,
        itemName,
        quantity: itemQty,
        itemQuantity: itemQty,
        itemQty,
        unit: itemUnit,
        itemUnit
      });

      state.editingTripId = null;
      state.editingTrip = null;
      state.editTripModalOpen = false;
      showToast('Shopping trip updated! Syncing with Neon...', 'info');
      render();
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
    foodWasteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const itemName = document.querySelector('#waste-item-name')?.value || 'Food Waste';
      const date = document.querySelector('#waste-date')?.value || new Date().toISOString().split('T')[0];
      const weightG = parseFloat(document.querySelector('#waste-weight-g')?.value || 0);
      const reason = document.querySelector('#waste-reason')?.value || 'Spoiled / Molded';
      const costEst = parseFloat(document.querySelector('#waste-cost-est')?.value || 0);

      // 1. Save locally to localStorage (synced: false)
      const wasteEntry = saveFoodWasteRecord({
        itemName,
        date,
        measuredWeightG: weightG,
        isEstimated: false, // Confirmed weighed on digital scale
        estimatedCost: costEst,
        reason,
        notes: 'Net edible food waste (packaging excluded)',
        synced: false
      });

      // 2. Persist to IndexedDB (offline-first sync)
      await saveFoodWasteToIndexedDB(wasteEntry, false);

      state.wasteModalOpen = false;
      render();

      // 3. Immediately issue POST request to /api/food-waste
      try {
        const res = await fetch('/api/food-waste', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(wasteEntry)
        });

        if (res && res.ok) {
          const payload = await res.json().catch(() => null);
          if (payload && (payload.success || payload.synced)) {
            // Update local record's synced flag to true upon a successful response
            markFoodWasteSynced(wasteEntry.id, true);
            await markFoodWasteAsSyncedInIndexedDB(wasteEntry.id);
            render();
            console.info('[Sync] Food waste entry synced to Neon PostgreSQL:', wasteEntry.id);
          }
        }
      } catch (netErr) {
        console.warn('[Sync] Food waste remote POST failed (persisted offline):', netErr);
      }
    });
  }

  // Delete Food Waste Record
  document.querySelectorAll('.delete-waste-btn[data-delete-waste]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-delete-waste');
      if (confirm('Delete this food waste record?')) {
        deleteFoodWasteRecord(id);
        fetch(`/api/food-waste?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
          credentials: 'include'
        }).catch(() => {});
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

  // Quick Add Recommended Recipe to Meal Plan
  document.querySelectorAll('.quick-add-recipe-to-plan-btn[data-recipe-title]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const dish = e.currentTarget.getAttribute('data-recipe-title');
      state.mealPlanModalOpen = true;
      render();
      const input = document.querySelector('#plan-dish-name');
      if (input && dish) input.value = dish;
    });
  });

  // Inventory Modal Open & Close
  const openInvBtn = document.querySelector('#open-inventory-modal-btn');
  const closeInvBtn = document.querySelector('#close-inventory-modal-btn');
  const cancelInvBtn = document.querySelector('#cancel-inventory-modal-btn');

  if (openInvBtn) openInvBtn.addEventListener('click', () => { state.inventoryModalOpen = true; render(); });
  if (closeInvBtn) closeInvBtn.addEventListener('click', () => { state.inventoryModalOpen = false; render(); });
  if (cancelInvBtn) cancelInvBtn.addEventListener('click', () => { state.inventoryModalOpen = false; render(); });

  // Inventory Form Submit
  const invForm = document.querySelector('#inventory-form');
  if (invForm) {
    invForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const itemName = document.querySelector('#inv-name')?.value;
      const quantity = parseFloat(document.querySelector('#inv-qty')?.value || '1');
      const unit = document.querySelector('#inv-unit')?.value || 'pcs';
      const storageLocation = document.querySelector('#inv-location')?.value || 'Refrigerator';
      const expirationDate = document.querySelector('#inv-expiration')?.value || null;
      const notes = document.querySelector('#inv-notes')?.value || '';

      saveInventoryItem({
        itemName,
        quantity,
        unit,
        storageLocation,
        expirationDate,
        notes
      });

      state.inventoryModalOpen = false;
      render();
    });
  }

  // Consume, Discard, Delete Inventory Actions
  document.querySelectorAll('.consume-inventory-btn[data-inv-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-inv-id');
      if (id) {
        consumeInventoryItem(id, 1);
        render();
      }
    });
  });

  document.querySelectorAll('.discard-inventory-btn[data-inv-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-inv-id');
      if (id) {
        discardInventoryItem(id, 1, 'Spoiled / Molded');
        render();
      }
    });
  });

  document.querySelectorAll('.delete-inventory-btn[data-inv-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-inv-id');
      if (id && confirm('Remove this item from inventory?')) {
        deleteInventoryItem(id);
        render();
      }
    });
  });

  // Expose global export handlers for card and button clicks
  window.handleExportWeeklySummary = () => handleExportWeeklySummary(state);
  window.handleExportShoppingTrips = () => handleExportShoppingTrips(state);
  window.handleExportItemizedGroceries = () => handleExportItemizedGroceries(state);
  window.handleExportFoodWaste = () => handleExportFoodWaste(state);
  window.triggerCsvDownload = triggerCsvDownload;
  window.handleDownloadClick = (e, exportFn) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof exportFn === 'function') return exportFn();
  };

  const triggerExport = (type) => {
    if (type === 'summary') {
      handleExportWeeklySummary(state);
    } else if (type === 'trips') {
      handleExportShoppingTrips(state);
    } else if (type === 'items') {
      handleExportItemizedGroceries(state);
    } else if (type === 'waste') {
      handleExportFoodWaste(state);
    }
  };

  // CSV Export Buttons Click Listeners (Single trigger with stopPropagation)
  document.querySelectorAll('.export-btn[data-export-type]').forEach(btn => {
    // Only bind if not already handled inline to prevent duplicate downloads
    if (!btn.getAttribute('onclick')) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.getAttribute('data-export-type');
        triggerExport(type);
      });
    }
  });

  // Download All CSVs
  const downloadAllCsvsBtn = document.querySelector('#download-all-csvs-btn');
  if (downloadAllCsvsBtn) {
    downloadAllCsvsBtn.addEventListener('click', () => {
      if (!hasCourseData(state)) {
        showToast("No records available to export. Please record a trip or restore from Neon first.", "warning");
        if (typeof alert === 'function') alert("No records available to export. Please record a trip or restore from Neon first.");
        return;
      }
      const csvs = exportAllCourseCsvs(state);
      triggerCsvDownload('kosherai_six_week_summary_comparison.csv', csvs.summaryCsv);
      setTimeout(() => triggerCsvDownload('kosherai_shopping_trips_expenses.csv', csvs.tripsCsv), 300);
      setTimeout(() => triggerCsvDownload('kosherai_grocery_purchased_items.csv', csvs.itemsCsv), 600);
      setTimeout(() => triggerCsvDownload('kosherai_food_waste_records.csv', csvs.wasteCsv), 900);
      setTimeout(() => showToast('✓ Complete academic dataset (all 4 CSVs) downloaded successfully', 'success'), 1000);
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

  const sampleMatch = SAMPLE_LABELS.find(s => s.text.trim() === text.trim() || (title && s.title.toLowerCase() === title.toLowerCase()));
  const resolvedTitle = title && title !== 'Food Label' ? title : (sampleMatch ? sampleMatch.title : 'Safe Kosher Roast Chicken');
  state.scanProductName = resolvedTitle;

  const scanTarget = state.scanTarget || state.scannerTab || state.scannerMode;
  const scannerMode = state.scannerMode || state.scannerTab;
  const activeTarget = scanTarget || scannerMode || 'food_label';

  const isReceiptScan = isReceipt || activeTarget === 'receipt' || activeTarget === 'supermarket_receipt' || /SIL LABUYO|CKN BRST|MG BRTH|PTIS REF|SM SUPERMARKET|PUREGOLD|ROBINSONS/i.test(text);
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
      productName: resolvedTitle || `${storeName} Receipt Audit`,
      name: resolvedTitle || `${storeName} Receipt Audit`,
      title: resolvedTitle || `${storeName} Receipt Audit`,
      detectedItemsCount: auditedItems.length,
      status: overallStatus,
      overallBadge: `${storeName} Receipt`,
      reasons: [`Audited ${auditedItems.length} grocery line items under ${(state.activeDiet || 'lid').toUpperCase()} protocol.`],
      items: auditedItems,
      source: 'OFFLINE_RULE_ENGINE'
    };

    state.scanHistory = saveScanResult({
      title: resolvedTitle || `${storeName} Receipt Audit`,
      productName: resolvedTitle || `${storeName} Receipt Audit`,
      name: resolvedTitle || `${storeName} Receipt Audit`,
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
      aiResult = await verifyWithGeminiAI(text, settings.geminiApiKey, state.activeDiet || 'lid', activeTarget);
      state.aiAnalysis = aiResult;
      const probTokens = aiResult.problemIngredients || [];
      analysis = {
        isSafe: aiResult.status === 'SAFE',
        status: aiResult.status,
        productName: resolvedTitle,
        name: resolvedTitle,
        title: resolvedTitle,
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
      analysis.productName = resolvedTitle;
      analysis.name = resolvedTitle;
      analysis.title = resolvedTitle;
      analysis.source = 'OFFLINE_RULE_ENGINE';
      state.aiAnalysis = null;
    } finally {
      state.aiLoading = false;
    }
  } else {
    analysis = analyzeIngredients(text);
    analysis.productName = resolvedTitle;
    analysis.name = resolvedTitle;
    analysis.title = resolvedTitle;
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
    title: resolvedTitle,
    productName: resolvedTitle,
    name: resolvedTitle,
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
  pushThenRestoreFromNeon();
});
window.addEventListener('offline', () => {
  state.isOnline = false;
  render();
});

window.addEventListener('kosherai_storage_updated', () => {
  render();
});
window.addEventListener('kosherai-trips-synced', () => {
  render();
});
window.addEventListener('kosherai-food-waste-synced', () => {
  render();
});
window.addEventListener('kosherai:auth-changed', () => {
  render();
});
window.addEventListener('kosherai:sync-data', () => {
  pushThenRestoreFromNeon({ manual: true }).catch(() => {});
  refreshScanHistory().catch(() => {});
});
window.addEventListener('kosherai:household-changed', (e) => {
  if (e.detail?.household_members) {
    state.household_members = e.detail.household_members;
    render();
  }
});

// Document-level fallback listener ensuring header auth buttons and modal backdrop remain 100% responsive
document.addEventListener('click', (e) => {
  const dismissWarningBtn = e.target.closest('.dismiss-warning-btn');
  if (dismissWarningBtn) {
    e.preventDefault();
    const wid = dismissWarningBtn.getAttribute('data-dismiss-warning');
    if (wid) dismissWarningKey(wid);
    const banner = dismissWarningBtn.closest('.overbuying-warning-banner');
    if (banner) {
      banner.style.opacity = '0';
      setTimeout(() => banner.remove(), 150);
    }
    return;
  }

  const toggleIntBtn = e.target.closest('#toggle-food-cost-intelligence-btn');
  if (toggleIntBtn) {
    e.preventDefault();
    state.isIntelligenceExpanded = !state.isIntelligenceExpanded;
    render();
    return;
  }

  const signinBtn = e.target.closest('#header-signin-btn');
  if (signinBtn) {
    e.preventDefault();
    state.authModalOpen = true;
    state.authModalMode = 'signin';
    state.authModalError = '';
    state.authModalLoading = false;
    render();
    return;
  }

  const signupBtn = e.target.closest('#header-signup-btn');
  if (signupBtn) {
    e.preventDefault();
    state.authModalOpen = true;
    state.authModalMode = 'signup';
    state.authModalError = '';
    state.authModalLoading = false;
    render();
    return;
  }

  const authOverlay = e.target.closest('#auth-modal-overlay');
  if (authOverlay && e.target === authOverlay && !state.authModalLoading) {
    state.authModalOpen = false;
    state.authModalError = '';
    render();
    return;
  }
});

// Global Escape Key Listener for Modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.authModalOpen) {
      state.authModalOpen = false;
      state.authModalError = '';
      render();
    } else if (state.scannedReceiptAudit) {
      state.scannedReceiptAudit = null;
      render();
    } else if (state.selectedScanItem) {
      state.selectedScanItem = null;
      render();
    } else if (state.selectedItem) {
      state.selectedItem = null;
      render();
    } else if (state.settingsOpen) {
      state.settingsOpen = false;
      render();
    } else if (state.receiptModalOpen) {
      state.receiptModalOpen = false;
      render();
    } else if (state.editTripModalOpen || state.editingTripId) {
      state.editTripModalOpen = false;
      state.editingTripId = null;
      state.editingTrip = null;
      render();
    } else if (state.manualTripModalOpen) {
      state.manualTripModalOpen = false;
      render();
    } else if (state.wasteModalOpen) {
      state.wasteModalOpen = false;
      render();
    } else if (state.mealPlanModalOpen) {
      state.mealPlanModalOpen = false;
      render();
    } else if (state.configModalOpen) {
      state.configModalOpen = false;
      render();
    }
  }
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

/**
 * Uploads pending offline records first (so local edits are never overwritten),
 * then re-hydrates trips, grocery items and food waste from Neon into the local cache.
 * @param {{ manual?: boolean }} [opts] - manual=true surfaces a status message even on silent boots
 */
async function pushThenRestoreFromNeon({ manual = false } = {}) {
  if (state.neonRestoring) return;
  if (!navigator.onLine) {
    if (manual) {
      state.neonRestoreStatus = { ok: false, message: 'You are offline. Showing locally cached data.' };
      render();
    }
    return;
  }

  state.neonRestoring = true;
  if (manual) render();

  try {
    await syncPendingTrips().catch(() => {});
    await syncPendingFoodWaste().catch(() => {});
    const result = await restoreFromNeon();
    // Silent on boot unless something was actually restored or the user asked
    if (manual || (result.ok && (result.tripsRestored + result.wasteRestored) > 0)) {
      state.neonRestoreStatus = { ok: result.ok, message: result.message };
    }
  } catch (err) {
    console.warn('[Restore] Neon re-hydration failed:', err);
    if (manual) state.neonRestoreStatus = { ok: false, message: 'Restore failed. Local data kept.' };
  } finally {
    state.neonRestoring = false;
    render();
  }
}

// Initial Render and mount sync from Neon PostgreSQL & IndexedDB
async function initializeAuthSession() {
  if (typeof fetch !== 'function') return;
  try {
    const rawSession = localStorage.getItem('kosherai_user_session');
    const directToken = localStorage.getItem('better-auth.session_token');
    if (!directToken && !rawSession) {
      const res = await fetch('/api/auth/get-session', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.session?.token && data?.user) {
          localStorage.setItem('better-auth.session_token', data.session.token);
          const userWithToken = { ...data.user, token: data.session.token };
          localStorage.setItem('kosherai_current_user', JSON.stringify(userWithToken));
          localStorage.setItem('kosherai_user_session', JSON.stringify({
            token: data.session.token,
            session: data.session,
            user: userWithToken
          }));
          window.dispatchEvent(new CustomEvent('kosherai:auth-changed', { detail: { user: userWithToken } }));
        }
      }
    }
  } catch (_) {}
}

render();
refreshScanHistory();
initializeAuthSession().finally(() => {
  pushThenRestoreFromNeon();
});
fetchAllRecipeInteractions().then(() => render()).catch(() => {});
syncPendingRecipeInteractions().catch(() => {});

