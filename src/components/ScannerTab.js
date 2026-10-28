import { STATUS } from '../data/lidDatabase.js';
import { SMART_SUBSTITUTES } from '../data/protocolRules.js';
import {
  compressImage,
  compressImageForOCR,
  runClientOCR,
  verifyWithGeminiAI,
  uploadToCloudinary,
  auditGroceryReceipt,
  auditReceiptItemOffline,
  cleanPinoyGroceryTerm
} from '../services/aiVerification.js';
import { analyzeIngredients } from '../services/ruleEngine.js';
import { getSettings, getScanHistory, saveScanResult, clearScanHistory } from '../services/storage.js';

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
export async function executeScanWorkflow(file, context = {}) {
  const {
    state,
    render = () => {},
    addScanToHistory = () => {}
  } = context;

  if (!file) return;

  try {
    state.scanError = null;
    state.ocrStatus = { message: 'Compressing image...' };
    state.ocrProgress = 0.15;
    render();

    // Step 1: Client-Side Image Pre-Processing & Compression
    const dataUrl = await compressImageForOCR(file, 1600, 0.8);
    state.imagePreviewUrl = dataUrl;
    state.cloudinaryUrl = null;

    // Retrieve settings using getSettings()
    const settings = getSettings();
    const apiKey = settings.geminiApiKey;
    const activeDiet = state.activeDiet || 'lid';

    // Safely resolve active scan mode
    const scanTarget = state.scanTarget || state.scannerTab || state.scannerMode;
    const scannerMode = state.scannerMode || state.scannerTab;
    const activeTarget = scanTarget || scannerMode || 'food_label';
    const isReceipt = activeTarget === 'receipt' || activeTarget === 'supermarket_receipt';

    // Background Cloudinary Upload if configured (targets kosherai/receipts for receipts)
    const cloudName = settings.cloudinaryCloudName;
    const uploadPreset = settings.cloudinaryPreset;

    let cloudinaryPromise = null;
    if (cloudName && uploadPreset) {
      cloudinaryPromise = uploadToCloudinary(file, cloudName, uploadPreset, isReceipt)
        .then((url) => {
          if (url) {
            state.cloudinaryUrl = url;
            if (state.scanAnalysis) state.scanAnalysis.cloudinaryUrl = url;
            if (state.scannedReceiptAudit) state.scannedReceiptAudit.cloudinaryUrl = url;
            render();
          }
          return url;
        })
        .catch((err) => {
          console.warn('Background Cloudinary upload error:', err);
          return null;
        });
    }

    if (isReceipt) {
      // Step 2: Receipt Scanning & Audit
      state.ocrStatus = { message: 'Analyzing grocery receipt items...' };
      state.ocrProgress = 0.45;
      render();

      const receiptAudit = await auditGroceryReceipt(
        dataUrl,
        (prog) => {
          state.ocrStatus = { message: prog.message || 'Scanning receipt items...' };
          state.ocrProgress = prog.progress || 0.5;
          const fill = document.querySelector('.progress-bar-fill');
          if (fill) fill.style.width = Math.round((prog.progress || 0.5) * 100) + '%';
        },
        apiKey,
        activeDiet
      );

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

      state.aiLoading = false;
      state.ocrStatus = null;
      state.scanError = null;

      if (cloudinaryPromise) {
        const cUrl = await cloudinaryPromise;
        if (cUrl && state.scanAnalysis) {
          state.scanAnalysis.cloudinaryUrl = cUrl;
          if (state.scannedReceiptAudit) state.scannedReceiptAudit.cloudinaryUrl = cUrl;
        }
      }

      // Save to scan history
      state.scanHistory = saveScanResult({
        id: 'scan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
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

      render();
      fetchAndSyncHistory(state, render).catch(() => {});
      return;
    }

    // Food Packaging Label Scan Mode
    state.ocrStatus = { message: 'Running PaddleOCR engine on label...' };
    state.ocrProgress = 0.45;
    render();

    let extractedText = '';
    try {
      extractedText = await runClientOCR(dataUrl, (prog) => {
        state.ocrStatus = prog;
        state.ocrProgress = prog.progress;
        const fill = document.querySelector('.progress-bar-fill');
        if (fill) fill.style.width = Math.round(prog.progress * 100) + '%';
      });
    } catch (ocrErr) {
      console.warn('Client OCR notice (will fall back or use multimodal image):', ocrErr);
      extractedText = '';
    }

    state.scanText = extractedText;
    state.aiLoading = true;
    render();

    let scanAnalysis = null;
    let aiResult = null;

    if (apiKey && apiKey.trim()) {
      try {
        state.ocrStatus = { message: 'Clinical reasoning with Gemini AI...' };
        state.ocrProgress = 0.85;
        render();

        const hasSubstantialText = extractedText && extractedText.trim().length > 10;
        const payload = hasSubstantialText
          ? extractedText
          : {
              text: extractedText || 'Analyze the food packaging label ingredients for dietary compliance.',
              imageBase64: dataUrl,
              mimeType: 'image/jpeg'
            };

        aiResult = await verifyWithGeminiAI(payload, apiKey, state.activeDiet || 'lid', activeTarget);
        state.aiAnalysis = aiResult;

        const probTokens = aiResult.problemIngredients || [];
        scanAnalysis = {
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
          parsedTokens: (extractedText ? extractedText.split(/[,;\n•]+/).map(t => t.trim()).filter(Boolean) : probTokens).map(tok => ({
            text: tok,
            status: probTokens.some(p => tok.toLowerCase().includes(p.toLowerCase())) ? aiResult.status : 'SAFE',
            matchedReason: aiResult.reason
          })),
          source: 'GEMINI_AI',
          cloudinaryUrl: state.cloudinaryUrl
        };
      } catch (geminiErr) {
        console.warn('Gemini AI failed, gracefully falling back to offline rule engine:', geminiErr);
        scanAnalysis = analyzeIngredients(extractedText);
        scanAnalysis.source = 'OFFLINE_RULE_ENGINE';
        state.aiAnalysis = null;
      }
    } else {
      scanAnalysis = analyzeIngredients(extractedText);
      scanAnalysis.source = 'OFFLINE_RULE_ENGINE';
      state.aiAnalysis = null;
    }

    state.scanAnalysis = scanAnalysis;
    state.aiLoading = false;
    state.ocrStatus = null;
    state.scanError = null;

    if (cloudinaryPromise) {
      const cUrl = await cloudinaryPromise;
      if (cUrl && state.scanAnalysis) {
        state.scanAnalysis.cloudinaryUrl = cUrl;
      }
    }

    if (scanAnalysis) {
      const flaggedIngredients = [
        ...(aiResult?.problemIngredients || []),
        ...(scanAnalysis.detectedForbidden || []).map(f => f.matchedWord || f.name),
        ...(scanAnalysis.detectedCaution || []).map(c => c.matchedWord || c.name)
      ];
      const uniqueFlagged = [...new Set(flaggedIngredients.map(t => String(t).trim()))].filter(Boolean);
      const reason = aiResult?.reason || scanAnalysis.reason || (scanAnalysis.reasons && scanAnalysis.reasons[0]) || '';
      const imageUrl = state.cloudinaryUrl || state.imagePreviewUrl || null;

      state.scanHistory = saveScanResult({
        id: 'scan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title: 'Scanned Food Label',
        rawText: extractedText || 'Packaging Image',
        status: scanAnalysis.status,
        reason,
        flaggedIngredients: uniqueFlagged,
        imageUrl,
        cloudinaryUrl: state.cloudinaryUrl || null,
        analysis: scanAnalysis,
        aiAnalysis: state.aiAnalysis
      });
    }

    render();
    fetchAndSyncHistory(state, render).catch(() => {});
  } catch (err) {
    console.error('Scan workflow error:', err);
    state.ocrStatus = null;
    state.aiLoading = false;
    const scanTarget = state.scanTarget || state.scannerTab || state.scannerMode;
    const scannerMode = state.scannerMode || state.scannerTab;
    const activeTarget = scanTarget || scannerMode || 'food_label';
    const isReceiptMode = activeTarget === 'receipt' || activeTarget === 'supermarket_receipt';
    state.scanError = err.message || (isReceiptMode
      ? 'Could not parse receipt contents. Please ensure the receipt is well-lit and legible.'
      : 'Could not read food packaging label. Please ensure the nutrition facts or ingredient label is clear and well-lit.');
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

  // Single source of truth for scanner active tab
  const resolvedScanTarget = state.scanTarget || state.scannerTab || state.scannerMode || 'food_label';
  const scannerMode = state.scannerMode || state.scannerTab;
  const activeTarget = resolvedScanTarget || scannerMode || 'food_label';
  const activeScannerTab = state.scannerTab || (inputMode === 'text' ? 'paste' : (activeTarget === 'receipt' ? 'receipt' : 'food_label'));
  const isPaste = activeScannerTab === 'paste';
  const isReceipt = activeScannerTab === 'receipt';

  let heroTitle = 'Food & Ingredient Safety Scanner';
  let heroSubtitle = 'Photograph nutrition labels, packaged goods, or whole produce to audit LID compliance.';
  let primaryBtnText = 'Take Photo of Food / Label';
  let secondaryBtnText = 'Upload Food / Label Photo';

  if (isReceipt) {
    heroTitle = 'Supermarket Receipt Scanner';
    heroSubtitle = 'Scan supermarket receipts (SM, Puregold, Robinsons) to audit items and find Pinoy Smart Swaps.';
    primaryBtnText = 'Take Photo of Receipt';
    secondaryBtnText = 'Upload Receipt Photo';
  } else if (isPaste) {
    heroTitle = 'Manual Text & Item Auditor';
    heroSubtitle = 'Paste ingredients or receipt text to audit dietary compliance.';
  }

  return `
    <div class="scanner-container">
      <!-- Scanner Hero & Controls -->
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
          <button id="toggle-label-mode" class="filter-btn ${activeScannerTab === 'food_label' ? 'active' : ''}">
            🏷️ Food Label
          </button>
          <button id="toggle-receipt-mode" class="filter-btn ${activeScannerTab === 'receipt' ? 'active' : ''}">
            🧾 Grocery Receipt
          </button>
          <button id="toggle-text-mode" class="filter-btn ${activeScannerTab === 'paste' ? 'active' : ''}">
            ✏️ Paste Text
          </button>
        </div>

        ${!isPaste ? `
          <!-- Camera Actions -->
          <div class="scanner-actions">
            <label class="btn-primary" style="cursor: pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span>${primaryBtnText}</span>
              <input type="file" id="camera-file-input" accept="image/*" capture="environment" style="display: none;" />
            </label>

            <label class="btn-secondary" style="cursor: pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              <span>${secondaryBtnText}</span>
              <input type="file" id="gallery-file-input" accept="image/*" style="display: none;" />
            </label>
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
              <button id="scanner-clear-text-btn" class="btn-secondary" style="padding: 8px 16px;">Clear</button>
              <button id="scanner-analyze-btn" class="btn-primary" style="padding: 8px 20px;">
                Audit Pasted Items
              </button>
            </div>
          </div>
        `}
      </div>

      <!-- Actionable Error Banner -->
      ${scanError ? `
        <div class="scan-error-banner" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.45); border-radius: 14px; padding: 14px 18px; margin: 16px 0; color: #fca5a5; display: flex; align-items: flex-start; gap: 12px;">
          <div style="font-size: 1.35rem; line-height: 1;">⚠️</div>
          <div style="flex: 1;">
            <div style="font-weight: 700; color: #ef4444; font-size: 0.95rem; margin-bottom: 4px;">
              ${(!isReceipt || activeScannerTab === 'food_label' || activeTarget === 'food_label') 
                ? 'Food Label Scanning Failed' 
                : 'Receipt Scanning Failed'}
            </div>
            <div style="font-size: 0.88rem; line-height: 1.45; color: #fecaca;">${escapeHtml(scanError)}</div>
            <div style="font-size: 0.78rem; color: #f87171; margin-top: 8px; line-height: 1.4;">
              💡 <strong>Troubleshooting Tips:</strong>
              <ul style="margin: 4px 0 0 16px; list-style-type: disc;">
                ${(!isReceipt) ? `
                  <li>Ensure the food package nutrition label or ingredient list is well-lit, laid flat, and in focus.</li>
                  <li>Avoid glare, reflections, or crumpled packaging that obscures ingredient text.</li>
                ` : `
                  <li>Ensure the printed receipt is well-lit, laid flat, and in focus.</li>
                `}
                <li>Verify your <code>GEMINI_API_KEY</code> is configured in Settings or Vercel Environment Variables.</li>
                <li>You can also click <strong>✏️ Paste Text</strong> or try a <strong>⚡ One-Tap Clinical Sample</strong> below.</li>
              </ul>
            </div>
          </div>
          <button id="dismiss-scan-error-btn" style="background: transparent; border: none; color: #fca5a5; cursor: pointer; font-size: 1.25rem; line-height: 1; padding: 2px 6px;">✕</button>
        </div>
      ` : ''}

      <!-- Preset Test Samples for Immediate Demonstration -->
      <div class="presets-section">
        <div class="section-label">
          <span>⚡ One-Tap Clinical Sample Labels & Receipts:</span>
        </div>
        <div class="preset-pills-grid">
          ${SAMPLE_LABELS.map((sample, idx) => `
            <button class="preset-chip" data-sample-index="${idx}">
              <span>${sample.badge.includes('Safe') ? '🟢' : sample.badge.includes('Receipt') ? '🧾' : sample.badge.includes('Caution') ? '🟡' : '🔴'}</span>
              <span>${escapeHtml(sample.title)}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- OCR Progress Box -->
      ${ocrStatus ? `
        <div class="scan-progress-box">
          <div style="font-weight: 700; color: var(--safe-green);">
            ${escapeHtml(ocrStatus.message || 'Processing image...')}
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${Math.round((ocrProgress || 0.3) * 100)}%;"></div>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
            Extracting line items & auditing clinical compliance
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

  let bannerClass = 'banner-safe';
  let bannerIcon = '🟢';
  let bannerTitle = 'SAFE ON LOW-IODINE DIET';
  let bannerSub = 'No prohibited iodine sources, dairy, whey, seafood, goitrogens, or suspicious additives detected.';

  if (isAvoid) {
    bannerClass = 'banner-avoid';
    bannerIcon = '🔴';
    bannerTitle = 'STRICTLY PROHIBITED (AVOID)';
    bannerSub = 'Contains high-iodine ingredients, hidden dairy, sea salt, or clinical contraindications.';
  } else if (isCaution) {
    bannerClass = 'banner-caution';
    bannerIcon = '🟡';
    bannerTitle = 'CHECK LABEL CAREFULLY (CAUTION)';
    bannerSub = 'Contains unverified salt, natural flavorings, or ambiguous dough conditioners.';
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

  return `
    <div class="scan-result-card ${isSafe ? 'status-safe' : isAvoid ? 'status-avoid' : 'status-caution'}">
      <!-- Audited Product Header -->
      <div class="mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Audited Product / Sample
        </span>
        <h3 class="text-lg font-bold text-slate-900 dark:text-white">
          ${escapeHtml(analysis.productName || analysis.name || analysis.title || 'Safe Kosher Roast Chicken')}
        </h3>
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
        <button id="rescan-btn" class="btn-secondary" style="padding: 10px 18px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
          <span>One-Tap Re-Scan / Clear</span>
        </button>

        <button id="run-ai-check-btn" class="btn-primary" style="padding: 10px 20px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);" ${aiLoading ? 'disabled' : ''}>
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
                    ${item.imageUrl ? '<span style="color: #38bdf8; font-weight: 600;">• ☁️ Remote Photo</span>' : ''}
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
