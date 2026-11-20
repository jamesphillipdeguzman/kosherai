import { STATUS } from '../data/lidDatabase.js';
import { SMART_SUBSTITUTES } from '../data/protocolRules.js';
import {
  compressImage,
  compressImageForOCR,
  runClientOCR,
  verifyWithGeminiAI,
  recognizeFoodViaBackend,
  recognizeFoodWithGemini,
  evaluateFoodForProtocol,
  dataUrlToBlob,
  uploadToCloudinary,
  auditGroceryReceipt,
  auditReceiptItemOffline,
  cleanPinoyGroceryTerm
} from '../services/aiVerification.js';
import {
  saveScannerSessionState,
  saveTempScannerImage,
  clearTempScannerImage
} from '../services/scannerPersistence.js';
import { analyzeIngredients } from '../services/ruleEngine.js';
import { getSettings, getScanHistory, saveScanResult, clearScanHistory, isScannerEnabled, setScannerEnabled, generateScanId, updateScanRecordImage } from '../services/storage.js';

let activeScanAbortController = null;
let isSubmittingScan = false;

/**
 * Cancels an in-flight scan request and cleanly resets loading state.
 */
export function cancelActiveScan(state, render = () => {}) {
  if (activeScanAbortController) {
    try {
      activeScanAbortController.abort();
    } catch (_) {}
    activeScanAbortController = null;
  }
  isSubmittingScan = false;
  if (state) {
    state.aiLoading = false;
    state.ocrStatus = null;
    state.ocrProgress = 0;
    state.scanError = 'Scan cancelled. You can retry or enter the food manually.';
  }
  render();
}

/**
 * Re-evaluates Stage 2 dietary compatibility when the user corrects the identified food name,
 * without re-uploading or re-running visual recognition.
 */
export function recheckFoodName(correctedName, state, render = () => {}) {
  const trimmed = String(correctedName || '').trim();
  if (!trimmed || !state) return;

  const tEvalStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const activeDiet = state.activeDiet || 'lid';
  const prev = state.scanAnalysis || {};
  const recognition = {
    foodName: trimmed,
    localName: '',
    isPackagedLabel: false,
    ingredientsText: '',
    confidence: 1.0,
    explanation: `User-confirmed food item: ${trimmed}.`,
    needsClarification: false
  };

  const evaluated = evaluateFoodForProtocol(recognition, activeDiet);
  evaluated.cloudinaryUrl = prev.cloudinaryUrl || state.cloudinaryUrl || null;
  state.scanAnalysis = evaluated;
  state.scanText = trimmed;
  state.aiAnalysis = null;
  state.scanError = null;

  const evalMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - tEvalStart);
  console.log(`[ScannerPerf] Stage 2 re-evaluation for "${trimmed}" (${activeDiet}) completed in ${evalMs}ms`);
  render();
}

/**
 * Stops active camera streams and terminates workers to release resources.
 */
export function releaseScannerResources(state) {
  if (activeScanAbortController) {
    try {
      activeScanAbortController.abort();
    } catch (_) {}
    activeScanAbortController = null;
  }
  if (state?.mediaStream) {
    try {
      state.mediaStream.getTracks().forEach(track => track.stop());
    } catch (_) {}
    state.mediaStream = null;
  }
  if (state) {
    state.ocrStatus = null;
    state.ocrProgress = 0;
    state.aiLoading = false;
  }
  if (typeof document !== 'undefined') {
    document.querySelectorAll('video').forEach(video => {
      if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
        try {
          video.srcObject.getTracks().forEach(track => track.stop());
        } catch (_) {}
        video.srcObject = null;
      }
    });
  }
}

/**
 * Fetches and synchronizes scan history from Neon PostgreSQL
 * Call on mount and after every scan completion
 */
export async function fetchAndSyncHistory(state, render) {
  try {
    const updated = await getScanHistory();
    if (updated && Array.isArray(updated)) {
      state.scanHistory = updated;
      if (typeof render === 'function') render();
    }
    return updated;
  } catch (err) {
    console.warn('[ScannerTab] Failed to sync scan history:', err);
    return state?.scanHistory || [];
  }
}


export const SAMPLE_LABELS = [
  {
    title: 'SM Supermarket Receipt (Pinoy Groceries)',
    badge: 'Grocery Receipt Audit',
    isReceipt: true,
    text: `SM SUPERMARKET - MEGAMALL
SIL LABUYO 50G - 35.00
CKN BRST FRESH 1KG - 280.00
MG BRTH CB 6S - 42.50
PTIS REF 350ML - 48.00
SAYOTE FRESH - 25.00
TOTAL AMOUNT: 430.50`
  },
  {
    title: 'Commercial Sandwich Bread',
    badge: 'Prohibited Iodate',
    text: 'Enriched unbleached wheat flour, water, high fructose corn syrup, yeast, soybean oil, salt, potassium iodate dough conditioner, mono and diglycerides, calcium propionate.'
  },
  {
    title: 'Canned Chunk Tuna in Brine',
    badge: 'High Marine Iodine',
    text: 'Skipjack tuna (Katsuwonus pelamis), water, iodized salt, vegetable broth (pea and carrot extract).'
  },
  {
    title: 'Strawberry Yogurt Dessert',
    badge: 'Multiple Violations',
    text: 'Cultured pasteurized grade A milk, cream, strawberries, sugar, carrageenan (E407), FD&C Red Dye #3 (erythrosine), natural strawberry flavor.'
  },
  {
    title: 'Safe Kosher Roast Chicken',
    badge: '100% Safe Recipe',
    text: 'Fresh chicken thighs, pure non-iodized kosher salt, cracked black pepper, fresh garlic cloves, fresh rosemary, 100% pure extra virgin olive oil.'
  },
  {
    title: 'Organic Oat Milk',
    badge: 'Caution: Sea Salt',
    text: 'Oat base (water, oats), low erucic acid rapeseed oil, dipotassium phosphate, calcium carbonate, sea salt.'
  }
];

/**
 * End-to-end scanning workflow:
 * 1. Capture image from file picker or camera.
 * 2. Compress image using compressImageForOCR (max 1600px, quality 0.8) to prevent HTTP 413.
 * 3. If scanning a receipt, audit food line items & Pinoy smart swaps under the active diet protocol.
 * 4. Display clear color-coded result cards (🟢 Safe, 🔴 Avoid, 🟡 Caution) with actionable reasons and substitutions.
 */
export async function executeScanWorkflow(fileOrDataUrl, context = {}) {
  const {
    state,
    render = () => {},
    addScanToHistory = () => {}
  } = context;

  if (!fileOrDataUrl || !state) return;
  if (isSubmittingScan || state.aiLoading) {
    console.warn('[ScannerPerf] Duplicate scan submission ignored while scan is already in progress.');
    return;
  }
  isSubmittingScan = true;

  const scanId = state.activeScanId || generateScanId();
  state.activeScanId = scanId;

  const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const tWorkflowStart = nowMs();
  const timings = {
    startedAt: new Date().toISOString(),
    imagePrepMs: 0,
    recognitionMs: 0,
    evaluationMs: 0,
    dbSaveMs: 0,
    cloudinaryMs: null,
    totalMs: 0
  };

  activeScanAbortController = new AbortController();
  const scanSignal = activeScanAbortController.signal;

  // Keep user anchored on Scanner tab throughout processing, success, and error
  state.appMode = 'diet';
  state.activeTab = 'scanner';
  saveScannerSessionState(state);

  if (typeof fileOrDataUrl !== 'string') {
    state.lastScannedFile = fileOrDataUrl;
  }
  state.aiLoading = true;
  state.scanError = null;
  state.scanAnalysis = null;
  state.scannedReceiptAudit = null;
  state.aiAnalysis = null;

  try {
    // Stage 1: Preparing image (max 1024px, JPEG 0.78)
    state.ocrStatus = { message: 'Preparing image...', stage: 'preparing' };
    state.ocrProgress = 0.20;
    render();

    const tPrepStart = nowMs();
    const dataUrl = typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:')
      ? fileOrDataUrl
      : await compressImageForOCR(fileOrDataUrl, 1024, 0.78);
    timings.imagePrepMs = Math.round(nowMs() - tPrepStart);
    state.imagePreviewUrl = dataUrl;
    state.lastScannedDataUrl = dataUrl;
    state.cloudinaryUrl = null;
    // Temporarily persist captured image in IndexedDB for mobile reload/retry recovery
    saveTempScannerImage(dataUrl, {
      scannerTab: state.scannerTab || 'food_label',
      activeDiet: state.activeDiet || 'lid'
    }).catch(() => {});
    console.log(`[ScannerPerf] [${new Date().toISOString()}] Stage 1 (Preparing image): ${timings.imagePrepMs}ms`);

    if (scanSignal.aborted) {
      throw new DOMException('Scan cancelled by user', 'AbortError');
    }

    const settings = getSettings();
    const userProvidedKey = (settings.geminiApiKey || '').trim();
    const activeDiet = state.activeDiet || 'lid';

    const scanTarget = state.scanTarget || state.scannerTab || state.scannerMode;
    const scannerMode = state.scannerMode || state.scannerTab;
    const activeTarget = scanTarget || scannerMode || 'food_label';
    const isReceipt = activeTarget === 'receipt' || activeTarget === 'supermarket_receipt';

    // Decoupled Background Cloudinary Upload (uploads compressed JPEG blob, NEVER awaited before displaying results)
    const cloudName = settings.cloudinaryCloudName;
    const uploadPreset = settings.cloudinaryPreset;
    if (cloudName && uploadPreset) {
      const tCloudStart = nowMs();
      const uploadPayload = dataUrlToBlob(dataUrl) || (typeof fileOrDataUrl !== 'string' ? fileOrDataUrl : null);
      if (uploadPayload) {
        uploadToCloudinary(uploadPayload, cloudName, uploadPreset, isReceipt)
          .then((url) => {
            timings.cloudinaryMs = Math.round(nowMs() - tCloudStart);
            console.log(`[ScannerPerf] [${new Date().toISOString()}] Async Cloudinary archive finished in ${timings.cloudinaryMs}ms (non-blocking)`);
            if (url) {
              state.cloudinaryUrl = url;
              if (state.scanAnalysis) state.scanAnalysis.cloudinaryUrl = url;
              if (state.scannedReceiptAudit) state.scannedReceiptAudit.cloudinaryUrl = url;
              state.scanHistory = updateScanRecordImage(scanId, url);
              render();
            }
            return url;
          })
          .catch((err) => {
            console.warn('[ScannerPerf] Async Cloudinary archive skipped:', err?.message || err);
            return null;
          });
      }
    }

    if (isReceipt) {
      // Receipt Scanning & Audit (server-routed via /api/receipt-scan)
      state.ocrStatus = { message: 'Identifying receipt items...', stage: 'identifying' };
      state.ocrProgress = 0.45;
      render();

      const tRecStart = nowMs();
      const receiptAudit = await auditGroceryReceipt(
        dataUrl,
        (prog) => {
          state.ocrStatus = { message: prog.message || 'Scanning receipt items...', stage: 'identifying' };
          state.ocrProgress = prog.progress || 0.5;
          const fill = document.querySelector('.progress-bar-fill');
          if (fill) fill.style.width = Math.round((prog.progress || 0.5) * 100) + '%';
        },
        '',
        activeDiet
      );
      timings.recognitionMs = Math.round(nowMs() - tRecStart);

      state.ocrStatus = { message: 'Displaying results...', stage: 'displaying' };
      state.ocrProgress = 0.95;

      const itemsList = receiptAudit.items || [];
      const itemsCount = itemsList.length;
      const hasItems = itemsCount > 0;

      let overallStatus = 'UNKNOWN';
      if (!hasItems) {
        overallStatus = 'UNKNOWN';
      } else if (itemsList.some(i => i.status === 'AVOID')) {
        overallStatus = 'AVOID';
      } else if (itemsList.some(i => i.status === 'CAUTION')) {
        overallStatus = 'CAUTION';
      } else {
        overallStatus = 'SAFE';
      }

      state.scannedReceiptAudit = receiptAudit;
      state.scanAnalysis = {
        isReceipt: true,
        storeName: receiptAudit.storeName || 'Supermarket',
        detectedItemsCount: itemsCount,
        status: overallStatus,
        overallBadge: !hasItems ? 'UNREADABLE RECEIPT' : `${receiptAudit.storeName || 'Supermarket'} Receipt`,
        reasons: !hasItems
          ? ["No grocery line items could be detected on this receipt. Please ensure the receipt is flat, well-lit, and text is sharp, or try pasting the raw receipt text directly using the 'Paste Text' tab."]
          : [`Audited ${itemsCount} grocery line items under ${activeDiet.toUpperCase()} protocol.`],
        items: itemsList,
        source: receiptAudit.source || 'GEMINI_VISION',
        cloudinaryUrl: state.cloudinaryUrl
      };

      const tDbStart = nowMs();
      state.scanHistory = saveScanResult({
        id: scanId,
        title: `${receiptAudit.storeName || 'Supermarket'} Receipt Audit`,
        rawText: `Receipt: ${receiptAudit.storeName || 'Supermarket'} (${itemsCount} items)`,
        status: overallStatus,
        reason: !hasItems
          ? 'No grocery line items detected on receipt.'
          : `Audited ${itemsCount} items under ${activeDiet.toUpperCase()}`,
        flaggedIngredients: itemsList.filter(i => i.status === 'AVOID').map(i => i.cleanName),
        imageUrl: state.cloudinaryUrl || state.imagePreviewUrl || null,
        cloudinaryUrl: state.cloudinaryUrl || null,
        analysis: state.scanAnalysis,
        receiptAudit: state.scannedReceiptAudit
      });
      timings.dbSaveMs = Math.round(nowMs() - tDbStart);
      timings.totalMs = Math.round(nowMs() - tWorkflowStart);
      console.log(`[ScannerPerf] Receipt scan complete:`, timings);

      state.scanError = null;
      clearTempScannerImage().catch(() => {});
      fetchAndSyncHistory(state, render).catch(() => {});
      return;
    }

    // Two-Stage Food Recognition & Dietary Evaluation Pipeline
    state.ocrStatus = { message: 'Identifying food...', stage: 'identifying' };
    state.ocrProgress = 0.50;
    render();

    const isOnline = typeof navigator !== 'undefined' && navigator.onLine !== undefined ? navigator.onLine : true;
    let recognition = null;
    let scanAnalysis = null;
    let extractedText = '';

    const tRecStart = nowMs();
    if (isOnline) {
      // Single request path: use user's explicit Settings API key ONLY if configured; otherwise route via backend /api/receipt-scan
      if (userProvidedKey) {
        recognition = await recognizeFoodWithGemini(dataUrl, userProvidedKey, scanSignal);
      } else {
        recognition = await recognizeFoodViaBackend(dataUrl, activeDiet, scanSignal);
      }
    } else {
      // Offline fallback: run on-device OCR only when offline
      try {
        extractedText = await runClientOCR(dataUrl, (prog) => {
          state.ocrStatus = { message: prog.message || 'Identifying food offline...', stage: 'identifying' };
          state.ocrProgress = Math.max(0.5, prog.progress || 0.6);
          const fill = document.querySelector('.progress-bar-fill');
          if (fill) fill.style.width = Math.round(state.ocrProgress * 100) + '%';
        });
      } catch (ocrErr) {
        console.warn('Offline OCR error:', ocrErr);
        extractedText = '';
      }

      if (extractedText && extractedText.trim().length >= 3) {
        recognition = {
          foodName: extractedText.trim().split('\n')[0].slice(0, 60),
          localName: '',
          isPackagedLabel: extractedText.trim().length >= 15,
          ingredientsText: extractedText.trim(),
          confidence: 0.7,
          explanation: 'Extracted offline via on-device OCR.',
          needsClarification: false
        };
      } else {
        throw new Error('Offline and unable to read text from image. Please enter the food name manually.');
      }
    }
    timings.recognitionMs = Math.round(nowMs() - tRecStart);
    console.log(`[ScannerPerf] [${new Date().toISOString()}] Stage 2 (Identifying food): ${timings.recognitionMs}ms -> "${recognition?.foodName || ''}"`);

    if (scanSignal.aborted) {
      throw new DOMException('Scan cancelled by user', 'AbortError');
    }

    // Stage 3: Checking dietary compatibility (Active protocol ONLY)
    state.ocrStatus = { message: 'Checking dietary compatibility...', stage: 'evaluating' };
    state.ocrProgress = 0.80;
    render();

    const tEvalStart = nowMs();
    scanAnalysis = evaluateFoodForProtocol(recognition, activeDiet);
    scanAnalysis.cloudinaryUrl = state.cloudinaryUrl || null;
    extractedText = recognition.ingredientsText || scanAnalysis.productName || '';
    state.scanText = extractedText;
    timings.evaluationMs = Math.round(nowMs() - tEvalStart);
    console.log(`[ScannerPerf] [${new Date().toISOString()}] Stage 3 (Dietary evaluation for ${activeDiet}): ${timings.evaluationMs}ms -> ${scanAnalysis.status}`);

    // Stage 4: Displaying results
    state.ocrStatus = { message: 'Displaying results...', stage: 'displaying' };
    state.ocrProgress = 1.0;

    state.scanAnalysis = scanAnalysis;
    state.scanError = null;

    const tDbStart = nowMs();
    const flaggedIngredients = [
      ...(scanAnalysis.detectedForbidden || []).map(f => f.matchedWord || f.name),
      ...(scanAnalysis.detectedCaution || []).map(c => c.matchedWord || c.name)
    ];
    const uniqueFlagged = [...new Set(flaggedIngredients.map(t => String(t).trim()))].filter(Boolean);
    const reason = scanAnalysis.reason || (scanAnalysis.reasons && scanAnalysis.reasons[0]) || '';
    const imageUrl = state.cloudinaryUrl || state.imagePreviewUrl || null;

    state.scanHistory = saveScanResult({
      id: scanId,
      title: scanAnalysis.productName || 'Scanned Food Item',
      rawText: extractedText || scanAnalysis.productName || 'Food Image',
      status: scanAnalysis.status,
      reason,
      flaggedIngredients: uniqueFlagged,
      imageUrl,
      cloudinaryUrl: state.cloudinaryUrl || null,
      analysis: scanAnalysis,
      aiAnalysis: state.aiAnalysis
    });
    timings.dbSaveMs = Math.round(nowMs() - tDbStart);
    timings.totalMs = Math.round(nowMs() - tWorkflowStart);
    console.log(`[ScannerPerf] [${new Date().toISOString()}] Stage 4 (Display & DB save): ${timings.dbSaveMs}ms | Total=${timings.totalMs}ms`, timings);

    clearTempScannerImage().catch(() => {});
    state.activeScanId = null;
    fetchAndSyncHistory(state, render).catch(() => {});
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.warn('[ScannerPerf] Scan aborted/cancelled cleanly.');
      if (!state.scanError) {
        state.scanError = 'Scan cancelled. You can retry or enter the food manually.';
      }
    } else {
      console.error('Scan workflow error:', err);
      const scanTarget = state.scanTarget || state.scannerTab || state.scannerMode;
      const scannerMode = state.scannerMode || state.scannerTab;
      const activeTarget = scanTarget || scannerMode || 'food_label';
      const isReceiptMode = activeTarget === 'receipt' || activeTarget === 'supermarket_receipt';
      state.scanError = err.message || (isReceiptMode
        ? 'Could not parse receipt contents. Please ensure the receipt is well-lit and legible.'
        : 'Could not identify the food item. Please retry with better lighting or enter the food name manually.');
    }
  } finally {
    isSubmittingScan = false;
    state.ocrStatus = null;
    state.ocrProgress = 0;
    state.aiLoading = false;
    activeScanAbortController = null;
    render();
  }
}

/**
 * Matches problem terms against SMART_SUBSTITUTES for actionable replacements
 */
export function getSubstitutionsForTerms(problemTerms = []) {
  if (!problemTerms || !problemTerms.length) return [];
  const matched = [];
  const added = new Set();

  for (const term of problemTerms) {
    const cleanTerm = String(term).toLowerCase().trim();
    for (const sub of SMART_SUBSTITUTES) {
      if (added.has(sub.forbidden)) continue;

      const forbiddenLower = sub.forbidden.toLowerCase();
      const firstWord = forbiddenLower.split(' ')[0];

      if (
        cleanTerm.includes(firstWord) ||
        forbiddenLower.includes(cleanTerm) ||
        (cleanTerm.includes('salt') && forbiddenLower.includes('salt')) ||
        (cleanTerm.includes('soy') && forbiddenLower.includes('soy')) ||
        (cleanTerm.includes('dairy') && forbiddenLower.includes('milk')) ||
        (cleanTerm.includes('milk') && forbiddenLower.includes('milk')) ||
        (cleanTerm.includes('whey') && forbiddenLower.includes('milk')) ||
        (cleanTerm.includes('egg') && forbiddenLower.includes('egg')) ||
        (cleanTerm.includes('tuna') && forbiddenLower.includes('tuna')) ||
        (cleanTerm.includes('fish') && forbiddenLower.includes('seafood')) ||
        (cleanTerm.includes('seafood') && forbiddenLower.includes('seafood')) ||
        (cleanTerm.includes('potato') && forbiddenLower.includes('potato')) ||
        (cleanTerm.includes('bread') && forbiddenLower.includes('bread')) ||
        (cleanTerm.includes('dough') && forbiddenLower.includes('bread')) ||
        (cleanTerm.includes('carrageenan') && forbiddenLower.includes('seaweed')) ||
        (cleanTerm.includes('agar') && forbiddenLower.includes('seaweed')) ||
        (cleanTerm.includes('seaweed') && forbiddenLower.includes('seaweed'))
      ) {
        matched.push(sub);
        added.add(sub.forbidden);
      }
    }
  }

  // Fallback default safe suggestion if specific items are not in SMART_SUBSTITUTES
  if (matched.length === 0 && problemTerms.length > 0) {
    matched.push({
      forbidden: problemTerms.join(', '),
      iodineRisk: 'High or unpredictable iodine content',
      substitute: 'Fresh unbrined meat or poultry, plain rice, and non-iodized kosher salt (Morton Coarse or Diamond Crystal)',
      culinaryTip: 'Stick with simple whole food ingredients prepared at home with pure non-iodized kosher salt.'
    });
  }

  return matched;
}

export function renderScannerTab(state) {
  const {
    scanText,
    scanAnalysis,
    scannedReceiptAudit,
    scanError,
    ocrStatus,
    ocrProgress,
    aiAnalysis,
    aiLoading,
    imagePreviewUrl,
    cloudinaryUrl,
    scannerTab = 'food_label',
    inputMode = 'camera',
    activeDiet = 'lid',
    scanHistory = [],
    selectedScanItem = null
  } = state;

  const scannerEnabled = state.scannerEnabled !== undefined ? Boolean(state.scannerEnabled) : isScannerEnabled();

  // Single source of truth for scanner active tab
  const resolvedScanTarget = state.scanTarget || state.scannerTab || state.scannerMode || 'food_label';
  const scannerMode = state.scannerMode || state.scannerTab;
  const activeTarget = resolvedScanTarget || scannerMode || 'food_label';
  const activeScannerTab = state.scannerTab || (inputMode === 'text' ? 'paste' : (activeTarget === 'receipt' ? 'receipt' : 'food_label'));
  const isPaste = activeScannerTab === 'paste';
  const isReceipt = activeScannerTab === 'receipt';

  let heroTitle = 'Food & Ingredient Safety Scanner';
  let heroSubtitle = 'Photograph nutrition labels, packaged goods, or whole produce to audit LID compliance.';
  let primaryBtnText = 'Scan Food';
  let secondaryBtnText = 'Upload Food';

  if (isReceipt) {
    heroTitle = 'Supermarket Receipt Scanner';
    heroSubtitle = 'Scan supermarket receipts (SM, Puregold, Robinsons) to audit items and find Pinoy Smart Swaps.';
    primaryBtnText = 'Scan Receipt';
    secondaryBtnText = 'Upload Receipt';
  } else if (isPaste) {
    heroTitle = 'Manual Text & Item Auditor';
    heroSubtitle = 'Paste ingredients or receipt text to audit dietary compliance.';
  }

  return `
    <div class="scanner-container">
      ${!scannerEnabled ? `
        <!-- Scanner Standby Card (Disabled by Default for Performance) -->
        <div class="scanner-standby-card rounded-2xl p-6 bg-slate-900 text-white shadow-lg border border-slate-800 text-center">
          <div class="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </div>

          <h2 class="text-xl font-bold text-white mb-2">
            Food Scanner (Paused)
          </h2>
          <p class="text-xs text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
            Scanner is disabled by default to optimize mobile performance and battery life.
          </p>

          <button 
            id="enable-scanner-btn" 
            type="button" 
            class="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 transition-all active:scale-95 cursor-pointer"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Enable Scanner</span>
          </button>
        </div>
      ` : `
        <!-- Scanner Hero & Controls (Active) -->
        <div class="rounded-2xl p-6 bg-slate-900 text-white shadow-lg border border-slate-800">
          <div class="scanner-hero-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </div>

          <h2 class="text-xl font-bold text-white mb-2">
            ${heroTitle}
          </h2>
          <p class="text-xs text-slate-300 mb-6">
            ${heroSubtitle}
          </p>

          <!-- Mode Toggles: Food Label vs Grocery Receipt vs Paste Text -->
          <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            <button type="button" id="toggle-label-mode" class="filter-btn ${activeScannerTab === 'food_label' ? 'active' : ''}">
              🏷️ Food Label
            </button>
            <button type="button" id="toggle-receipt-mode" class="filter-btn ${activeScannerTab === 'receipt' ? 'active' : ''}">
              🧾 Grocery Receipt
            </button>
            <button type="button" id="toggle-text-mode" class="filter-btn ${activeScannerTab === 'paste' ? 'active' : ''}">
              ✏️ Paste Text
            </button>
          </div>

          ${!isPaste ? `
            <!-- Camera & Upload Actions -->
            <div class="scanner-actions" style="display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
              <label class="btn-primary" style="cursor: pointer;" title="Direct camera capture">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                <span>${primaryBtnText}</span>
                <input type="file" id="camera-file-input" accept="image/*" capture="environment" style="display: none;" />
              </label>

              <label class="btn-secondary" style="cursor: pointer;" title="Select an existing image from device">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <span>${secondaryBtnText}</span>
                <input type="file" id="gallery-file-input" accept="image/*" style="display: none;" />
              </label>

              <button type="button" id="disable-scanner-btn" class="btn-secondary" style="cursor: pointer; opacity: 0.9;" title="Disable scanner and return to standby mode">
                <span>⏸️ Disable Scanner</span>
              </button>
            </div>
          ` : `
            <!-- Manual Text Input Mode -->
            <div style="text-align: left; max-width: 650px; margin: 0 auto;">
              <textarea 
                id="scanner-manual-textarea" 
                class="ingredients-textarea" 
                placeholder="Paste ingredients or receipt text here..."
              >${escapeHtml(scanText || '')}</textarea>
              
              <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" id="scanner-clear-text-btn" class="btn-secondary" style="padding: 8px 16px;">Clear</button>
                <button type="button" id="scanner-analyze-btn" class="btn-primary" style="padding: 8px 20px;" ${aiLoading ? 'disabled' : ''}>
                  ${aiLoading ? 'Auditing...' : 'Audit Pasted Items'}
                </button>
              </div>
            </div>
          `}
        </div>
      `}

      <!-- Actionable Error Banner -->
      ${scanError ? `
        <div class="scan-error-banner" role="alert" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.45); border-radius: 14px; padding: 14px 18px; margin: 16px 0; color: #fca5a5; display: flex; align-items: flex-start; gap: 12px;">
          <div style="font-size: 1.35rem; line-height: 1;">⚠️</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; color: #ef4444; font-size: 0.95rem; margin-bottom: 4px;">
              ${(!isReceipt || activeScannerTab === 'food_label' || activeTarget === 'food_label') 
                ? 'Food Recognition Notice' 
                : 'Receipt Scanning Failed'}
            </div>
            <div style="font-size: 0.88rem; line-height: 1.45; color: #fecaca; overflow-wrap: anywhere;">${escapeHtml(scanError)}</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
              ${(state.lastScannedFile || state.lastScannedDataUrl || state.imagePreviewUrl) ? `
                <button id="retry-scan-btn" type="button" class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">
                  🔄 Retry Scan
                </button>
              ` : ''}
              <button id="manual-food-entry-btn" type="button" class="btn-secondary" style="padding: 6px 14px; font-size: 0.8rem;">
                ✏️ Manual Food Entry
              </button>
            </div>
            <div style="font-size: 0.78rem; color: #f87171; margin-top: 8px; line-height: 1.4;">
              💡 <strong>Troubleshooting Tips:</strong>
              <ul style="margin: 4px 0 0 16px; list-style-type: disc;">
                ${(!isReceipt) ? `
                  <li>Ensure the food item or nutrition label is well-lit and in focus.</li>
                  <li>You can also type or paste a food name directly using <strong>Manual Food Entry</strong>.</li>
                ` : `
                  <li>Ensure the printed receipt is well-lit, laid flat, and in focus.</li>
                `}
              </ul>
            </div>
          </div>
          <button type="button" id="dismiss-scan-error-btn" style="background: transparent; border: none; color: #fca5a5; cursor: pointer; font-size: 1.25rem; line-height: 1; padding: 2px 6px;">✕</button>
        </div>
      ` : ''}

      <!-- Preset Test Samples for Immediate Demonstration -->
      <div class="presets-section">
        <div class="section-label">
          <span>⚡ One-Tap Clinical Sample Labels & Receipts:</span>
        </div>
        <div class="preset-pills-grid">
          ${SAMPLE_LABELS.map((sample, idx) => `
            <button type="button" class="preset-chip" data-sample-index="${idx}">
              <span>${sample.badge.includes('Safe') ? '🟢' : sample.badge.includes('Receipt') ? '🧾' : sample.badge.includes('Caution') ? '🟡' : '🔴'}</span>
              <span>${escapeHtml(sample.title)}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Real-Time Scan Stage Progress Box -->
      ${ocrStatus ? `
        <div class="scan-progress-box">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <div style="font-weight: 700; color: var(--safe-green);">
              ${escapeHtml(ocrStatus.message || 'Preparing image...')}
            </div>
            <button id="cancel-scan-btn" type="button" class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;">
              ✕ Cancel
            </button>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${Math.round((ocrProgress || 0.2) * 100)}%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); margin-top: 6px; flex-wrap: wrap; gap: 6px;">
            <span>${ocrStatus.stage === 'preparing' ? '●' : '✓'} 1. Preparing image</span>
            <span>${ocrStatus.stage === 'identifying' ? '●' : (ocrStatus.stage === 'evaluating' || ocrStatus.stage === 'displaying' ? '✓' : '○')} 2. Identifying food</span>
            <span>${ocrStatus.stage === 'evaluating' ? '●' : (ocrStatus.stage === 'displaying' ? '✓' : '○')} 3. Checking dietary compatibility</span>
            <span>${ocrStatus.stage === 'displaying' ? '●' : '○'} 4. Displaying results</span>
          </div>
        </div>
      ` : ''}

      <!-- Scanned Image Thumbnail Preview -->
      ${imagePreviewUrl ? `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 10px;">
          <img src="${imagePreviewUrl}" alt="Scanned Receipt or Label" style="max-height: 180px; border-radius: 12px; border: 1px solid var(--border-color); object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.4);" />
          ${(cloudinaryUrl || scanAnalysis?.cloudinaryUrl) ? `
            <a href="${escapeHtml(cloudinaryUrl || scanAnalysis?.cloudinaryUrl)}" target="_blank" rel="noopener" style="font-size: 0.78rem; color: var(--accent-cyan); display: inline-flex; align-items: center; gap: 4px;">
              <span>☁️ Saved to Cloudinary Archive</span>
              <span>↗</span>
            </a>
          ` : ''}
        </div>
      ` : ''}

      <!-- Scan Result: Receipt Audit View or Single Label Result -->
      ${scannedReceiptAudit 
        ? renderReceiptAuditResult(scannedReceiptAudit, activeDiet, cloudinaryUrl)
        : (scanAnalysis ? renderAnalysisResult(scanAnalysis, scanText, aiAnalysis, aiLoading, cloudinaryUrl) : '')
      }

      <!-- Scan History -->
      ${scanHistory.length > 0 ? renderScanHistory(scanHistory) : ''}

      <!-- Detail Preview / Inspection Modal -->
      ${selectedScanItem ? renderScanDetailModal(selectedScanItem) : ''}
    </div>
  `;
}

export function renderReceiptAuditResult(audit, activeDiet = 'lid', cloudinaryUrl = null) {
  const items = Array.isArray(audit.items) ? audit.items : [];
  const safeCount = items.filter(i => i.status === 'SAFE').length;
  const avoidCount = items.filter(i => i.status === 'AVOID').length;
  const cautionCount = items.filter(i => i.status === 'CAUTION').length;

  const dietLabels = {
    lid: 'Low-Iodine Diet (LID)',
    low_purine: 'Low-Purine (Gout)',
    low_sodium: 'Low-Sodium / Heart Care',
    diabetic: 'Diabetic / Low-GI',
    pinoy_keto: 'Pinoy Keto'
  };
  const activeDietName = dietLabels[activeDiet] || activeDiet;

  // Prevent "False SAFE" on empty item extraction
  if (items.length === 0) {
    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-overlay" id="receipt-audit-modal-backdrop" role="dialog" aria-modal="true">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden" onclick="event.stopPropagation()">
          
          <!-- Header: Solid, high-contrast container with Title & Status Badges -->
          <div class="bg-slate-900 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between border-b border-slate-800">
            <div class="flex items-center gap-3 min-w-0 pr-3">
              <span class="text-2xl select-none flex-shrink-0">🧾</span>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-lg font-bold tracking-wide text-white truncate">
                    ${escapeHtml(audit.storeName || 'SM SUPERMARKET')}
                  </h3>
                  <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 border border-teal-500/30 whitespace-nowrap">
                    ${escapeHtml(activeDietName)}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 9999px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); font-weight: 800;">
                    STATUS: UNREADABLE
                  </span>
                </div>
              </div>
            </div>

            <!-- Explicit Close (X) Button -->
            <button
              id="receipt-audit-close-btn"
              class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors flex-shrink-0"
              aria-label="Close modal"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Scrollable Body -->
          <div class="p-5 overflow-y-auto max-h-[calc(90vh-140px)] space-y-3">
            <!-- Warning Header Banner -->
            <div class="result-banner" style="background: rgba(120, 53, 15, 0.35); border: 1px solid rgba(245, 158, 11, 0.5); border-radius: 14px; padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                  <span style="font-size: 1.8rem; line-height: 1;">⚠️</span>
                  <div>
                    <div style="font-size: 1.05rem; font-weight: 800; color: #fde68a;">
                      No Grocery Line Items Detected
                    </div>
                    <div style="font-size: 0.82rem; color: #fed7aa; margin-top: 4px; line-height: 1.45;">
                      No grocery line items could be detected on this receipt. Please ensure the receipt is flat, well-lit, and text is sharp, or try pasting the raw receipt text directly using the 'Paste Text' tab.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Verification Source Badge -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin: 12px 0; font-size: 0.78rem;">
              <span class="engine-badge" style="font-weight: 700; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 6px;">
                ${audit.source === 'OFFLINE_PADDLE_OCR' ? '⚡ Evaluated by On-Device OCR & Clinical Rule Engine' : '🤖 Evaluated by Gemini AI Vision'}
              </span>
              ${(cloudinaryUrl || audit.cloudinaryUrl) ? `
                <a href="${escapeHtml(cloudinaryUrl || audit.cloudinaryUrl)}" target="_blank" rel="noopener" style="font-size: 0.78rem; color: var(--accent-cyan); display: inline-flex; align-items: center; gap: 4px;">
                  <span>☁️ Saved to kosherai/receipts</span>
                  <span>↗</span>
                </a>
              ` : ''}
            </div>

            <!-- Actionable Guidance Box -->
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 14px 16px; margin: 12px 0;">
              <div style="font-size: 0.82rem; font-weight: 700; color: #fcd34d; margin-bottom: 6px;">
                📋 Actionable Troubleshooting Tips:
              </div>
              <ul style="margin: 0; padding-left: 20px; font-size: 0.8rem; color: #cbd5e1; line-height: 1.6;">
                <li><strong>Flatten creases:</strong> Thermal receipt paper often curls or has deep folds hiding item text.</li>
                <li><strong>Improve lighting:</strong> Avoid harsh overhead glare or dim shadows across small printed numbers.</li>
                <li><strong>Text sharp & close:</strong> Ensure line items fill the frame and are legible.</li>
                <li><strong>Try Manual / Text Mode:</strong> Switch to the <strong>✏️ Paste Text</strong> tab to paste or type receipt text directly for instant zero-lag auditing.</li>
              </ul>
            </div>
          </div>

          <!-- Footer Action Buttons -->
          <div class="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 rounded-b-2xl flex items-center justify-between">
            <button id="rescan-btn" class="btn-secondary text-xs px-3 py-2 rounded-lg font-medium">
              📸 Retake / Upload New Photo
            </button>
            <button id="toggle-text-mode" class="btn-primary text-xs px-3 py-2 rounded-lg font-medium" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
              ✏️ Switch to Paste Text
            </button>
          </div>

        </div>
      </div>
    `;
  }

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-overlay" id="receipt-audit-modal-backdrop" role="dialog" aria-modal="true">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden" onclick="event.stopPropagation()">
        
        <!-- Header: Solid, high-contrast container with Title & Summary Badges -->
        <div class="bg-slate-900 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between border-b border-slate-800">
          <div class="flex items-center gap-3 min-w-0 pr-3">
            <span class="text-2xl select-none flex-shrink-0">🧾</span>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-lg font-bold tracking-wide text-white truncate">
                  ${escapeHtml(audit.storeName || 'SM SUPERMARKET')}
                </h3>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 border border-teal-500/30 whitespace-nowrap">
                  ${escapeHtml(activeDietName)}
                </span>
              </div>
              <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                <span class="bg-emerald-600 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  ${safeCount} Safe
                </span>
                ${avoidCount > 0 ? `
                  <span class="bg-rose-600 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold">
                    ${avoidCount} Avoid
                  </span>
                ` : ''}
                ${cautionCount > 0 ? `
                  <span class="bg-amber-600 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold">
                    ${cautionCount} Caution
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
          
          <!-- Explicit Close (X) Button -->
          <button
            id="receipt-audit-close-btn"
            class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="p-5 overflow-y-auto max-h-[calc(90vh-140px)] space-y-3">
          <!-- Engine Verification Source Badge -->
          <div class="flex items-center justify-between pb-1 text-xs">
            <span class="engine-badge badge-gemini bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-semibold text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
              <span class="text-sky-600 dark:text-sky-400 font-bold">${audit.source === 'OFFLINE_PADDLE_OCR' ? '⚡' : '🤖'}</span>
              <span>${audit.source === 'OFFLINE_PADDLE_OCR' ? 'Evaluated by On-Device OCR & Clinical Rule Engine' : 'Verified by Gemini AI Vision Receipt Auditor'}</span>
            </span>
            ${(cloudinaryUrl || audit.cloudinaryUrl) ? `
              <span class="text-cyan-600 dark:text-cyan-400 font-semibold text-xs">☁️ Cloudinary Synced</span>
            ` : ''}
          </div>

          <!-- Audited Items List -->
          <div>
            ${items.map(item => {
              const isSafe = item.status === 'SAFE';
              const isAvoid = item.status === 'AVOID';
              
              if (isSafe) {
                return `
                  <div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 mb-3">
                    <div class="flex justify-between items-start gap-2">
                      <div>
                        <div class="text-base font-bold text-emerald-950 dark:text-emerald-100">${escapeHtml(item.cleanName)}</div>
                        ${item.rawText && item.rawText !== item.cleanName ? `
                          <div class="text-xs font-mono text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                            ${escapeHtml(item.rawText)}
                          </div>
                        ` : ''}
                      </div>
                      <span class="bg-emerald-600 text-white font-bold text-[11px] px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                        SAFE
                      </span>
                    </div>
                    ${item.clinicalReason ? `
                      <div class="text-xs text-emerald-900/90 dark:text-emerald-200/90 mt-1.5 leading-relaxed">
                        ${escapeHtml(item.clinicalReason)}
                      </div>
                    ` : ''}
                    ${item.suggestedSwap ? `
                      <div class="mt-2 flex items-center text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
                        <span class="font-bold mr-1">💡 Pinoy Smart Swap:</span>
                        <span>${escapeHtml(item.suggestedSwap)}</span>
                      </div>
                    ` : ''}
                  </div>
                `;
              } else if (isAvoid) {
                return `
                  <div class="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl p-4 mb-3">
                    <div class="flex justify-between items-start gap-2">
                      <div>
                        <div class="text-base font-bold text-rose-950 dark:text-rose-100">${escapeHtml(item.cleanName)}</div>
                        ${item.rawText && item.rawText !== item.cleanName ? `
                          <div class="text-xs font-mono text-rose-800/80 dark:text-rose-300/80 mt-0.5">
                            ${escapeHtml(item.rawText)}
                          </div>
                        ` : ''}
                      </div>
                      <span class="bg-rose-600 text-white font-bold text-[11px] px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                        AVOID
                      </span>
                    </div>
                    ${item.clinicalReason ? `
                      <div class="text-xs text-rose-900/90 dark:text-rose-200/90 mt-1.5 leading-relaxed">
                        ${escapeHtml(item.clinicalReason)}
                      </div>
                    ` : ''}
                    ${item.suggestedSwap ? `
                      <div class="mt-2 flex items-center text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
                        <span class="font-bold mr-1">💡 Pinoy Smart Swap:</span>
                        <span>${escapeHtml(item.suggestedSwap)}</span>
                      </div>
                    ` : ''}
                  </div>
                `;
              } else {
                // CAUTION
                return `
                  <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 mb-3">
                    <div class="flex justify-between items-start gap-2">
                      <div>
                        <div class="text-base font-bold text-amber-950 dark:text-amber-100">${escapeHtml(item.cleanName)}</div>
                        ${item.rawText && item.rawText !== item.cleanName ? `
                          <div class="text-xs font-mono text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                            ${escapeHtml(item.rawText)}
                          </div>
                        ` : ''}
                      </div>
                      <span class="bg-amber-600 text-white font-bold text-[11px] px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                        CAUTION
                      </span>
                    </div>
                    ${item.clinicalReason ? `
                      <div class="text-xs text-amber-900/90 dark:text-amber-200/90 mt-1.5 leading-relaxed">
                        ${escapeHtml(item.clinicalReason)}
                      </div>
                    ` : ''}
                    ${item.suggestedSwap ? `
                      <div class="mt-2 flex items-center text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
                        <span class="font-bold mr-1">💡 Pinoy Smart Swap:</span>
                        <span>${escapeHtml(item.suggestedSwap)}</span>
                      </div>
                    ` : ''}
                  </div>
                `;
              }
            }).join('')}
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 rounded-b-2xl flex items-center justify-between">
          <button id="rescan-btn" class="btn-secondary text-xs px-3 py-2 rounded-lg font-medium">
            📸 Scan Another Receipt
          </button>
          <button id="receipt-audit-done-btn" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm">
            Done
          </button>
        </div>

      </div>
    </div>
  `;
}

export const renderReceiptAuditModal = renderReceiptAuditResult;

function renderAnalysisResult(analysis, rawText, aiAnalysis, aiLoading, cloudinaryUrl) {
  const currentStatus = aiAnalysis?.status || analysis.status;
  const isSafe = currentStatus === STATUS.SAFE || currentStatus === 'SAFE';
  const isAvoid = currentStatus === STATUS.AVOID || currentStatus === 'AVOID';
  const isCaution = currentStatus === STATUS.CAUTION || currentStatus === 'CAUTION';
  const activeProtocolLabel = analysis.activeDietName || 'Low-Iodine Diet';

  let bannerClass = 'banner-safe';
  let bannerIcon = '🟢';
  let bannerTitle = `SAFE ON ${activeProtocolLabel.toUpperCase()}`;
  let bannerSub = analysis.activeDiet && analysis.activeDiet !== 'lid'
    ? `Compatible with ${activeProtocolLabel} guidelines.`
    : 'No prohibited iodine sources, dairy, whey, seafood, goitrogens, or suspicious additives detected.';

  if (isAvoid) {
    bannerClass = 'banner-avoid';
    bannerIcon = '🔴';
    bannerTitle = `STRICTLY PROHIBITED (AVOID)`;
    bannerSub = analysis.activeDiet && analysis.activeDiet !== 'lid'
      ? `Restricted under ${activeProtocolLabel} guidelines.`
      : 'Contains high-iodine ingredients, hidden dairy, sea salt, or clinical contraindications.';
  } else if (isCaution) {
    bannerClass = 'banner-caution';
    bannerIcon = '🟡';
    bannerTitle = 'CHECK / VERIFY CAREFULLY (CAUTION)';
    bannerSub = analysis.needsClarification
      ? 'Visual recognition had low confidence. Confirm or edit the food name below.'
      : 'Contains unverified salt, natural flavorings, or ambiguous ingredients.';
  }

  // Collect problem terms from AI analysis or local rules
  const problemTerms = [
    ...(aiAnalysis?.problemIngredients || []),
    ...(analysis.detectedForbidden || []).map(f => f.matchedWord || f.name),
    ...(analysis.detectedCaution || []).map(c => c.matchedWord || c.name)
  ];
  const uniqueProblemTerms = [...new Set(problemTerms.map(t => String(t).trim()))].filter(Boolean);

  // Match actionable substitutions
  const matchedSubstitutes = (isAvoid || isCaution) ? getSubstitutionsForTerms(uniqueProblemTerms) : [];
  const confidencePct = typeof analysis.confidence === 'number' ? Math.round(analysis.confidence * 100) : null;

  return `
    <div class="scan-result-card ${isSafe ? 'status-safe' : isAvoid ? 'status-avoid' : 'status-caution'}">
      <!-- Audited Product Header -->
      <div class="mb-3">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Audited Food / Sample (${escapeHtml(activeProtocolLabel)})
          </span>
          ${confidencePct !== null ? `
            <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted);">
              Recognition Confidence: ${confidencePct}%
            </span>
          ` : ''}
        </div>
        <h3 class="text-lg font-bold text-slate-900 dark:text-white">
          ${escapeHtml(analysis.productName || analysis.name || analysis.title || 'Scanned Food Item')}
        </h3>
        <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; align-items: center;">
          <input
            id="correct-food-name-input"
            type="text"
            value="${escapeHtml(analysis.foodName || analysis.productName || '')}"
            placeholder="Wrong food? Type correct name (e.g. Kamote)"
            style="flex: 1; min-width: 180px; padding: 6px 10px; font-size: 0.8rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); color: var(--text-primary);"
          />
          <button id="recheck-food-name-btn" type="button" class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem;">
            ✏️ Re-check Food
          </button>
        </div>
      </div>

      <!-- Status Banner -->
      <div class="result-banner ${bannerClass}">
        <div class="banner-status-icon">${bannerIcon}</div>
        <div>
          <div class="banner-headline">${bannerTitle}</div>
          <div class="banner-sub">${bannerSub}</div>
        </div>
      </div>

      <!-- Engine Verification Source Badge -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 0.78rem;">
        <span class="engine-badge ${analysis.source === 'GEMINI_AI' || aiAnalysis ? 'badge-gemini' : 'badge-offline'} bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-semibold text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1.5" style="font-weight: 700;">
          <span class="text-sky-600 dark:text-sky-400 font-bold">${analysis.source === 'GEMINI_AI' || aiAnalysis ? '🤖' : '⚡'}</span>
          <span>${analysis.source === 'GEMINI_AI' || aiAnalysis ? 'Verified by Gemini AI Clinical Analysis' : 'Evaluated by Offline Clinical Rule Engine'}</span>
        </span>
        ${(cloudinaryUrl || analysis.cloudinaryUrl) ? `
          <span style="color: #67e8f9; font-weight: 600;">☁️ Cloudinary Synced</span>
        ` : ''}
      </div>

      <!-- Actionable Reason Statement -->
      ${(aiAnalysis?.reason || (analysis.reasons && analysis.reasons.length > 0)) ? `
        <div style="background: var(--bg-card-subtle); border-left: 3px solid ${isSafe ? 'var(--safe-green)' : isAvoid ? 'var(--avoid-red)' : 'var(--caution-amber)'}; padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 16px;">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px;">
            Clinical Assessment Reason:
          </div>
          <div style="font-size: 0.88rem; color: var(--text-primary); line-height: 1.45;">
            ${escapeHtml(aiAnalysis?.reason || analysis.reasons[0])}
          </div>
        </div>
      ` : ''}

      <!-- Problem Ingredients List (if any) -->
      ${uniqueProblemTerms.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 0.8rem; font-weight: 700; color: ${isAvoid ? '#f87171' : '#fbbf24'}; margin-bottom: 8px;">
            ⚠️ Flagged Problem Ingredients (${uniqueProblemTerms.length}):
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${uniqueProblemTerms.map(term => `
              <span class="ingredient-token ${isAvoid ? 'token-avoid' : 'token-caution'}">
                <span>${isAvoid ? '✕' : '!'}</span>
                <span>${escapeHtml(term)}</span>
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Parsed Tokens Box (if tokens available) -->
      ${analysis.parsedTokens && analysis.parsedTokens.length > 0 ? `
        <div class="highlight-tokens-box">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">
              Parsed Ingredients (${analysis.parsedTokens.length})
            </span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">
              Tap to inspect
            </span>
          </div>

          <div class="tokens-flex">
            ${analysis.parsedTokens.map(token => {
              const isTokenSafe = token.status === STATUS.SAFE || token.status === 'SAFE' || !token.status;
              const isTokenAvoid = token.status === STATUS.AVOID || token.status === 'AVOID';
              const isTokenCaution = token.status === STATUS.CAUTION || token.status === 'CAUTION';
              const tokenClass = isTokenAvoid ? 'token-avoid' : (isTokenCaution ? 'token-caution' : 'token-safe');
              const icon = isTokenAvoid ? '✕' : (isTokenCaution ? '!' : '✓');

              if (isTokenSafe) {
                return `
                  <span class="ingredient-token token-safe bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-medium text-xs px-2.5 py-1 rounded-full inline-flex items-center" title="${escapeHtml(token.matchedReason || 'Safe ingredient')}">
                    <span class="text-emerald-600 dark:text-emerald-400 font-bold mr-1">✓</span>
                    <span>${escapeHtml(token.text)}</span>
                  </span>
                `;
              }

              return `
                <span class="ingredient-token ${tokenClass}" title="${escapeHtml(token.matchedReason || 'Flagged ingredient')}">
                  <span class="mr-1">${icon}</span>
                  <span>${escapeHtml(token.text)}</span>
                </span>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Actionable Safe Substitutions Card -->
      ${matchedSubstitutes.length > 0 ? `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md); padding: 16px; margin-bottom: 18px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 1.2rem;">🔄</span>
            <div style="font-size: 0.92rem; font-weight: 800; color: #34d399;">
              Actionable Safe Substitutions
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${matchedSubstitutes.map(sub => `
              <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px;">
                <div style="font-size: 0.8rem; color: #f87171; font-weight: 700;">
                  🔴 Avoid: ${escapeHtml(sub.forbidden)}
                </div>
                <div style="font-size: 0.88rem; color: #34d399; font-weight: 700; margin: 3px 0;">
                  🟢 Safe Swap: ${escapeHtml(sub.substitute)}
                </div>
                <div style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4;">
                  💡 Culinary Tip: ${escapeHtml(sub.culinaryTip)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Re-Scan and AI Action Buttons -->
      <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; align-items: center; justify-content: space-between;">
        <button type="button" id="rescan-btn" class="btn-secondary" style="padding: 10px 18px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
          <span>One-Tap Re-Scan / Clear</span>
        </button>

        <button type="button" id="run-ai-check-btn" class="btn-primary" style="padding: 10px 20px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);" ${aiLoading ? 'disabled' : ''}>
          <span style="font-size: 1rem;">✨</span>
          <span>${aiLoading ? 'AI Reasoning...' : (aiAnalysis ? 'Re-Run Gemini AI Verification' : 'Run Gemini AI Verification')}</span>
        </button>
      </div>
    </div>
  `;
}

function renderAiResult(ai) {
  const isSafe = ai.status === STATUS.SAFE || ai.status === 'SAFE';
  const isAvoid = ai.status === STATUS.AVOID || ai.status === 'AVOID';

  return `
    <div class="ai-verification-card">
      <div class="ai-header">
        <span class="ai-sparkle">🤖</span>
        <div class="ai-title">Verified by Gemini AI Clinical Analysis</div>
        <span class="badge-status ${isSafe ? 'badge-safe' : isAvoid ? 'badge-avoid' : 'badge-caution'}" style="margin-left: auto;">
          ${ai.status}
        </span>
      </div>

      <div class="ai-body">
        <p style="margin-bottom: 8px;"><strong>Clinical Summary:</strong> ${escapeHtml(ai.reason || ai.clinicalSummary || '')}</p>
        
        ${ai.problemIngredients && ai.problemIngredients.length > 0 ? `
          <div style="margin-bottom: 8px;">
            <strong>Detected Problem Ingredients:</strong>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
              ${ai.problemIngredients.map(p => `
                <span class="ingredient-token token-avoid">✕ ${escapeHtml(p)}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${ai.safeSubstitutions && ai.safeSubstitutions.length > 0 ? `
          <div style="background: rgba(16, 185, 129, 0.1); padding: 8px 12px; border-radius: 6px; margin-top: 8px; color: #34d399;">
            <strong>Medical Suggestion:</strong> ${escapeHtml(ai.safeSubstitutions.join(', '))}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderScanHistory(history) {
  return `
    <div style="margin-top: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="section-label" style="margin: 0;">📜 Scan History (${history.length})</span>
          <span style="font-size: 0.72rem; padding: 2px 7px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 999px; font-weight: 600;">
            Neon Cloud Synced
          </span>
        </div>
        <button id="clear-scan-history-btn" style="background: none; border: none; color: var(--text-muted); font-size: 0.75rem; cursor: pointer; text-decoration: underline;">
          Clear History
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${history.slice(0, 15).map(item => {
          const isSafe = item.status === STATUS.SAFE || item.status === 'SAFE';
          const isAvoid = item.status === STATUS.AVOID || item.status === 'AVOID';
          const hasImage = Boolean(item.imageUrl || item.cloudinaryUrl);
          const timeStr = item.createdAt || item.timestamp;
          const displayDate = timeStr 
            ? `${new Date(timeStr).toLocaleDateString()} ${new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Recent';

          return `
            <div 
              class="check-item scan-history-card cursor-pointer hover:border-emerald-500/50 transition-all active:scale-[0.99]" 
              data-history-id="${escapeHtml(item.id)}" 
              style="cursor: pointer; justify-content: space-between; align-items: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border-radius: var(--radius-md); padding: 12px 14px;"
              title="Click to view archived label and clinical parameters"
            >
              <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                ${hasImage ? `
                  <div style="width: 46px; height: 46px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); flex-shrink: 0; background: #000; display: flex; align-items: center; justify-content: center;">
                    <img 
                      src="${escapeHtml(item.imageUrl || item.cloudinaryUrl)}" 
                      alt="Thumbnail" 
                      loading="lazy"
                      style="width: 100%; height: 100%; object-fit: cover;" 
                    />
                  </div>
                ` : `
                  <div style="width: 46px; height: 46px; border-radius: 8px; background: var(--bg-card-subtle); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
                    ${isSafe ? '🟢' : isAvoid ? '🔴' : '🟡'}
                  </div>
                `}

                <div style="min-width: 0; flex: 1;">
                  <div style="font-size: 0.92rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(item.title || (item.rawText ? item.rawText.slice(0, 45) + '...' : 'Scanned Food Label'))}
                  </div>
                  <div style="font-size: 0.74rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 3px;">
                    <span>${displayDate}</span>
                    ${(item.cloudinaryUrl || (item.imageUrl && /^https?:\/\//i.test(item.imageUrl))) ? '<span style="color: #38bdf8; font-weight: 600;">• ☁️ Remote Photo</span>' : ''}
                    ${item.flaggedIngredients && item.flaggedIngredients.length > 0 ? `<span style="color: #f87171;">• ${item.flaggedIngredients.length} flagged</span>` : ''}
                  </div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 10px;">
                <span class="badge-status ${isSafe ? 'badge-safe' : isAvoid ? 'badge-avoid' : 'badge-caution'}">
                  ${item.status}
                </span>
                <span style="color: var(--text-muted); font-size: 1.15rem; line-height: 1;">›</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

export function renderScanDetailModal(item) {
  if (!item) return '';

  const isSafe = item.status === STATUS.SAFE || item.status === 'SAFE';
  const isAvoid = item.status === STATUS.AVOID || item.status === 'AVOID';
  const isCaution = item.status === STATUS.CAUTION || item.status === 'CAUTION';

  const statusBadgeClass = isSafe ? 'badge-safe' : (isAvoid ? 'badge-avoid' : 'badge-caution');
  const statusEmoji = isSafe ? '🟢' : (isAvoid ? '🔴' : '🟡');
  const statusText = isSafe ? 'SAFE ON LOW-IODINE DIET' : (isAvoid ? 'STRICTLY PROHIBITED (AVOID)' : 'CHECK LABEL CAREFULLY (CAUTION)');

  const reasonText = item.reason ||
    item.aiAnalysis?.reason ||
    item.analysis?.reason ||
    (item.analysis?.reasons && item.analysis.reasons[0]) ||
    (isSafe ? 'No prohibited high-iodine ingredients or dairy detected.' : 'Contains flagged ingredients requiring avoidance or clinical caution.');

  const flagged = item.flaggedIngredients || [
    ...(item.aiAnalysis?.problemIngredients || []),
    ...(item.analysis?.detectedForbidden || []).map(f => f.matchedWord || f.name),
    ...(item.analysis?.detectedCaution || []).map(c => c.matchedWord || c.name)
  ];
  const uniqueFlagged = [...new Set(flagged.map(t => String(t).trim()))].filter(Boolean);

  const imageUrl = item.imageUrl || item.cloudinaryUrl || null;
  const isCloudinary = item.cloudinaryUrl || (imageUrl && imageUrl.includes('cloudinary.com'));

  const timeVal = item.createdAt || item.timestamp;
  const formattedDate = timeVal
    ? new Date(timeVal).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recent Scan';

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-overlay" id="scan-modal-overlay" role="dialog" aria-modal="true">
      <div class="scan-detail-card modal-content bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 flex flex-col gap-3.5" onclick="event.stopPropagation()">
        
        <!-- Header -->
        <div class="flex justify-between items-start gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div style="min-width: 0; flex: 1;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="color: #38bdf8;">☁️ NEON ARCHIVED SCAN</span>
              <span>•</span>
              <span>${escapeHtml(formattedDate)}</span>
            </div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mt-1 break-words">
              ${escapeHtml(item.title || 'Scanned Food Label')}
            </h3>
          </div>
          <button
            id="scan-modal-close-btn"
            class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Remote Image Preview or Text Label Preview -->
        ${imageUrl ? `
          <div style="background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <img 
              src="${escapeHtml(imageUrl)}" 
              alt="Archived Scanned Label" 
              loading="lazy"
              style="max-height: min(280px, 45vh); width: auto; max-width: 100%; object-fit: contain; margin-left: auto; margin-right: auto; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 16px rgba(0,0,0,0.5);"
              onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\'padding:16px;color:var(--text-muted);font-size:0.85rem;\'>⚠️ Image preview unavailable</div>';"
            />
            <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
              <a href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.78rem; font-weight: 600; color: #38bdf8; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; padding: 5px 12px; background: rgba(56, 189, 248, 0.1); border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.25);">
                <span>${isCloudinary ? '☁️ View in Cloudinary Archive ↗' : '🔗 Open Full-Resolution Image ↗'}</span>
              </a>
            </div>
          </div>
        ` : `
          <div style="background: var(--bg-card-subtle); border: 1px dashed var(--border-color); border-radius: 12px; padding: 14px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            <div style="font-size: 1.4rem; margin-bottom: 2px;">📝</div>
            <div style="font-weight: 600;">Text Ingredient Scan (No Image)</div>
            ${item.rawText ? `
              <div style="margin-top: 8px; font-size: 0.78rem; color: var(--text-secondary); background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; font-family: var(--font-mono); max-height: 90px; overflow-y: auto; text-align: left; line-height: 1.4;">
                ${escapeHtml(item.rawText)}
              </div>
            ` : ''}
          </div>
        `}

        <!-- Audited Product / Sample Title Header -->
        <div class="mb-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Audited Product / Sample
          </span>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">
            ${escapeHtml(item.productName || item.name || item.title || 'Safe Kosher Roast Chicken')}
          </h3>
        </div>

        <!-- Clinical Evaluation Status Banner -->
        <div class="result-banner ${isSafe ? 'banner-safe' : (isAvoid ? 'banner-avoid' : 'banner-caution')}" style="padding: 12px 14px; border-radius: var(--radius-sm); margin: 0;">
          <div class="banner-status-icon" style="font-size: 1.35rem;">${statusEmoji}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
              <span class="banner-headline" style="font-size: 0.95rem;">${statusText}</span>
              <span class="badge-status ${statusBadgeClass}">${item.status}</span>
            </div>
            <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 2px;">
              ${isSafe ? 'Compliant with Nuclear Medicine LID protocol' : isAvoid ? 'Prohibited: High iodine density / hidden additives' : 'Caution: Ambiguous salts or dairy sub-fractions'}
            </div>
          </div>
        </div>

        <!-- Clinical Assessment Reason -->
        <div style="background: var(--bg-card-subtle); border-left: 3px solid ${isSafe ? 'var(--safe-green)' : (isAvoid ? 'var(--avoid-red)' : 'var(--caution-amber)')}; padding: 12px 14px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
          <div style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em; margin-bottom: 4px;">
            Clinical Assessment Reason:
          </div>
          <div style="font-size: 0.86rem; color: var(--text-primary); line-height: 1.45;">
            ${escapeHtml(reasonText)}
          </div>
        </div>

        <!-- Flagged Problem Ingredients (if any) -->
        ${uniqueFlagged.length > 0 ? `
          <div>
            <div style="font-size: 0.78rem; font-weight: 700; color: ${isAvoid ? '#f87171' : '#fbbf24'}; margin-bottom: 6px;">
              ⚠️ Flagged Problem Ingredients (${uniqueFlagged.length}):
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${uniqueFlagged.map(term => `
                <span class="ingredient-token ${isAvoid ? 'token-avoid' : 'token-caution'}">
                  <span>${isAvoid ? '✕' : '!'}</span>
                  <span>${escapeHtml(term)}</span>
                </span>
              `).join('')}
            </div>
          </div>
        ` : `
          <div style="font-size: 0.78rem; color: #34d399; display: flex; align-items: center; gap: 6px;">
            <span>✓</span>
            <span>Zero prohibited iodine sources or high-risk additives flagged.</span>
          </div>
        `}

        <!-- Scan Parameters Grid -->
        <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; font-size: 0.75rem;">
          <div>
            <span style="color: var(--text-muted); display: block;">Record ID:</span>
            <span style="font-family: var(--font-mono); color: var(--text-primary); font-size: 0.72rem; word-break: break-all;">${escapeHtml(item.id || 'N/A')}</span>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Sync State:</span>
            <span style="color: #38bdf8; font-weight: 600;">☁️ Neon PostgreSQL</span>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Evaluated At:</span>
            <span style="color: var(--text-secondary); font-weight: 600;">${escapeHtml(formattedDate)}</span>
          </div>
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 10px; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 4px; flex-wrap: wrap;">
          <button id="scan-modal-delete-btn" class="btn-secondary" data-delete-scan-id="${escapeHtml(item.id)}" style="padding: 8px 12px; font-size: 0.8rem; color: #f87171; border-color: rgba(239, 68, 68, 0.3);">
            🗑️ Delete
          </button>
          
          <div style="display: flex; gap: 8px; margin-left: auto;">
            <button id="scan-modal-reaudit-btn" class="btn-secondary" style="padding: 8px 14px; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px;">
              <span>✨</span>
              <span>Re-Audit with AI</span>
            </button>
            <button id="scan-modal-done-btn" class="btn-primary" style="padding: 8px 18px; font-size: 0.85rem;">
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
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
