// KosherAI - Low-Iodine Diet Companion for RAI Patients
// Main Application Entry & State Controller

import './style.css';
import { renderHeader } from './components/Header.js';
import { renderBottomNav } from './components/BottomNav.js';
import { renderCheckerTab } from './components/CheckerTab.js';
import { renderScannerTab, SAMPLE_LABELS } from './components/ScannerTab.js';
import { renderCheatSheetTab } from './components/CheatSheetTab.js';
import { renderSubstitutesTab } from './components/SubstitutesTab.js';
import { renderCookModeTab } from './components/CookModeTab.js';
import { renderSettingsModal } from './components/SettingsModal.js';
import { renderItemDetailModal } from './components/ItemDetailModal.js';

import { searchDatabase, analyzeIngredients, analyzeRecipe } from './services/ruleEngine.js';
import { compressImage, runClientOCR, verifyWithGeminiAI } from './services/aiVerification.js';
import {
  getSettings,
  saveSettings,
  getScanHistory,
  addScanToHistory,
  clearScanHistory,
  getChecklistState,
  saveChecklistState
} from './services/storage.js';
import { LID_DATABASE } from './data/lidDatabase.js';

// Global Reactive State
const state = {
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
  scanText: '',
  scanAnalysis: null,
  ocrStatus: null,
  ocrProgress: 0,
  imagePreviewUrl: null,
  aiAnalysis: null,
  aiLoading: false,
  scanHistory: getScanHistory(),

  // Cheat Sheet Tab
  cheatSearch: '',

  // Substitutes Tab
  subSearch: '',

  // Cook Mode Tab
  checklistState: getChecklistState(),
  recipeText: '',
  recipeAnalysis: null,

  // Settings
  settings: getSettings(),
  settingsOpen: false
};

// Main DOM Render Function
function render() {
  const app = document.querySelector('#app');
  if (!app) return;

  // Filter Search Database
  state.searchResults = searchDatabase(
    state.searchQuery,
    state.statusFilter,
    state.categoryFilter
  );

  let activeTabHtml = '';
  switch (state.activeTab) {
    case 'checker':
      activeTabHtml = renderCheckerTab(state);
      break;
    case 'scanner':
      activeTabHtml = renderScannerTab(state);
      break;
    case 'cheatsheet':
      activeTabHtml = renderCheatSheetTab(state);
      break;
    case 'substitutes':
      activeTabHtml = renderSubstitutesTab(state);
      break;
    case 'cook':
      activeTabHtml = renderCookModeTab(state);
      break;
    default:
      activeTabHtml = renderCheckerTab(state);
  }

  app.innerHTML = `
    ${renderHeader(state.isOnline)}
    
    <main class="app-container">
      ${activeTabHtml}
    </main>

    ${renderBottomNav(state.activeTab)}

    ${state.selectedItem ? renderItemDetailModal(state.selectedItem) : ''}
    ${state.settingsOpen ? renderSettingsModal(state.settings) : ''}
  `;

  attachEventHandlers();
}

// Event Delegation & Handler Attachments
function attachEventHandlers() {
  // Navigation Tabs
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      if (tab) {
        state.activeTab = tab;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        render();
      }
    });
  });

  // Header Brand click -> Home
  const brandBtn = document.querySelector('#brand-logo-btn');
  if (brandBtn) {
    brandBtn.addEventListener('click', () => {
      state.activeTab = 'checker';
      state.searchQuery = '';
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
    });
  }

  // Quick lookup tags
  document.querySelectorAll('.quick-tag-chip[data-query]').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      state.searchQuery = q;
      state.statusFilter = 'ALL';
      render();
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
    try {
      state.ocrStatus = { message: 'Compressing image...' };
      state.ocrProgress = 0.15;
      render();

      const { dataUrl } = await compressImage(file);
      state.imagePreviewUrl = dataUrl;
      state.ocrStatus = { message: 'Running OCR engine on label...' };
      state.ocrProgress = 0.45;
      render();

      const extractedText = await runClientOCR(dataUrl, (prog) => {
        state.ocrStatus = prog;
        state.ocrProgress = prog.progress;
        // Don't re-render entire DOM every tick for performance
        const fill = document.querySelector('.progress-bar-fill');
        if (fill) fill.style.width = Math.round(prog.progress * 100) + '%';
      });

      state.ocrStatus = null;
      state.scanText = extractedText;
      processScanText(extractedText, 'Scanned Label');
    } catch (err) {
      console.error('Scan error', err);
      state.ocrStatus = null;
      alert('Could not extract text via OCR. You can paste the ingredients directly in the text tab.');
      state.inputMode = 'text';
      render();
    }
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
        processScanText(sample.text, sample.title);
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
      state.aiAnalysis = null;
      render();
    });
  }

  // Re-scan button
  const rescanBtn = document.querySelector('#rescan-btn');
  if (rescanBtn) {
    rescanBtn.addEventListener('click', () => {
      state.scanAnalysis = null;
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
      if (!state.settings.geminiApiKey) {
        alert('Please add your Gemini API Key in Settings (top right gear icon) to run deep AI reasoning. Our built-in offline engine has already evaluated this label!');
        state.settingsOpen = true;
        render();
        return;
      }

      state.aiLoading = true;
      render();

      try {
        const result = await verifyWithGeminiAI(state.scanText, state.settings.geminiApiKey);
        state.aiAnalysis = result;
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
    clearHistoryBtn.addEventListener('click', () => {
      clearScanHistory();
      state.scanHistory = [];
      render();
    });
  }

  // Re-load item from history
  document.querySelectorAll('.check-item[data-history-id]').forEach(item => {
    item.addEventListener('click', () => {
      const hid = item.getAttribute('data-history-id');
      const record = state.scanHistory.find(h => h.id === hid);
      if (record) {
        state.scanText = record.rawText;
        state.scanAnalysis = record.analysis;
        state.imagePreviewUrl = null;
        render();
      }
    });
  });

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
      state.recipeText = 
`Fresh chicken cutlets, cut into pieces
1 medium sayote (chayote), peeled and sliced
Fresh ginger slices (luya)
1 fresh onion, chopped
3 cloves fresh garlic, minced
1 tbsp 100% pure canola oil
1 tsp pure non-iodized kosher salt
Cracked black pepper
Filtered water`;
      state.recipeAnalysis = analyzeRecipe('Safe Family Chicken Tinola', state.recipeText);
      render();
    });
  }

  if (loadRiskyRecipeBtn) {
    loadRiskyRecipeBtn.addEventListener('click', () => {
      state.recipeText = 
`1 lb beef chuck roast cubes
2 large russet potatoes, cubed
2 whole eggs (for breading)
2 tbsp commercial butter
1 cube commercial beef bouillon
2 tbsp soy sauce (toyo)
1 tsp iodized table salt
1 can commercial green beans`;
      state.recipeAnalysis = analyzeRecipe('Careless Beef Stew with Violations', state.recipeText);
      render();
    });
  }

  const recipeAnalyzeBtn = document.querySelector('#recipe-analyze-btn');
  if (recipeAnalyzeBtn) {
    recipeAnalyzeBtn.addEventListener('click', () => {
      const textarea = document.querySelector('#recipe-textarea');
      state.recipeText = textarea?.value || '';
      if (state.recipeText.trim()) {
        state.recipeAnalysis = analyzeRecipe('Custom Family Dish', state.recipeText);
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
}

// Helper: Processes scanned text with offline rule engine & persists to history
function processScanText(text, title = 'Food Label') {
  if (!text || !text.trim()) return;
  const analysis = analyzeIngredients(text);
  state.scanAnalysis = analysis;
  state.aiAnalysis = null;

  // Save to scan history
  state.scanHistory = addScanToHistory({
    title,
    rawText: text,
    status: analysis.status,
    analysis
  });

  render();
}

// Connectivity change listener
window.addEventListener('online', () => {
  state.isOnline = true;
  render();
});
window.addEventListener('offline', () => {
  state.isOnline = false;
  render();
});

// Register Service Worker for Offline PWA Capabilities
if ('serviceWorker' in navigator) {
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

// Initial Render
render();
