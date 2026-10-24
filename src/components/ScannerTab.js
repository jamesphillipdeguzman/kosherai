// Packaging Ingredient Scanner Component (Camera / OCR + AI Deep Verification)
import { STATUS } from '../data/lidDatabase.js';
import { SMART_SUBSTITUTES } from '../data/protocolRules.js';
import { compressImage, runClientOCR, verifyWithGeminiAI, uploadToCloudinary } from '../services/aiVerification.js';
import { analyzeIngredients } from '../services/ruleEngine.js';
import { getSettings } from '../services/storage.js';

export const SAMPLE_LABELS = [
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
 * 2. Compress image using compressImage.
 * 3. If Cloudinary credentials exist, upload to Cloudinary in the background to log/save the image URL.
 * 4. Extract text via OCR (or pass the compressed image base64 directly to Gemini Vision multimodal API).
 * 5. Call verifyWithGeminiAI(extractedText, apiKey) (or multimodal image payload). If no API key is provided, gracefully fall back to the offline local ruleEngine.js keyword scanner.
 * 6. Display clear color-coded result cards (🟢 Safe, 🔴 Avoid, 🟡 Caution) with actionable reasons and substitutions.
 */
export async function executeScanWorkflow(file, context = {}) {
  const {
    state,
    render = () => {},
    addScanToHistory = () => {}
  } = context;

  if (!file) return;

  try {
    // 1. Capture image from file picker or camera (file is provided)
    // 2. Compress image using compressImage
    state.ocrStatus = { message: 'Compressing image...' };
    state.ocrProgress = 0.15;
    render();

    const { blob, dataUrl } = await compressImage(file);
    state.imagePreviewUrl = dataUrl;
    state.cloudinaryUrl = null;

    // Retrieve settings using getSettings()
    const settings = getSettings();
    console.log(`[Scanner] Gemini Key present: ${Boolean(settings.geminiApiKey)}`);
    console.log(`[Scanner] Cloudinary configured: ${Boolean(settings.cloudinaryCloudName && settings.cloudinaryPreset)}`);

    // 3. If Cloudinary credentials exist, upload to Cloudinary in the background to log/save the image URL
    const cloudName = settings.cloudinaryCloudName;
    const uploadPreset = settings.cloudinaryPreset;

    let cloudinaryPromise = null;
    if (cloudName && uploadPreset) {
      cloudinaryPromise = uploadToCloudinary(blob, cloudName, uploadPreset)
        .then((url) => {
          if (url) {
            state.cloudinaryUrl = url;
            if (state.scanAnalysis) {
              state.scanAnalysis.cloudinaryUrl = url;
            }
            render();
          }
          return url;
        })
        .catch((err) => {
          console.warn('Background Cloudinary upload error:', err);
          return null;
        });
    }

    // 4. Extract text via OCR (or pass the compressed image base64 directly to Gemini Vision multimodal API)
    state.ocrStatus = { message: 'Running OCR engine on label...' };
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

    // 5. Call verifyWithGeminiAI(extractedText, apiKey) (or multimodal image payload).
    // If no API key is provided, gracefully fall back to the offline local ruleEngine.js keyword scanner.
    const apiKey = settings.geminiApiKey;

    state.aiLoading = true;
    render();

    let scanAnalysis = null;
    let aiResult = null;

    if (apiKey && apiKey.trim()) {
      try {
        state.ocrStatus = { message: 'Clinical reasoning with Gemini 2.5 Flash...' };
        state.ocrProgress = 0.85;
        render();

        // Pass extracted text or multimodal image payload if OCR text was sparse
        const hasSubstantialText = extractedText && extractedText.trim().length > 10;
        const payload = hasSubstantialText
          ? extractedText
          : {
              text: extractedText || 'Analyze the food packaging label ingredients for Low-Iodine Diet compliance.',
              imageBase64: dataUrl,
              mimeType: 'image/jpeg'
            };

        aiResult = await verifyWithGeminiAI(payload, apiKey);
        state.aiAnalysis = aiResult;

        // Map Gemini AI response into a rich scanAnalysis object
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
      // Gracefully fall back to the offline local ruleEngine.js keyword scanner
      scanAnalysis = analyzeIngredients(extractedText);
      scanAnalysis.source = 'OFFLINE_RULE_ENGINE';
      state.aiAnalysis = null;
    }

    state.scanAnalysis = scanAnalysis;
    state.aiLoading = false;
    state.ocrStatus = null;

    // Check if background Cloudinary upload completed
    if (cloudinaryPromise) {
      const cUrl = await cloudinaryPromise;
      if (cUrl && state.scanAnalysis) {
        state.scanAnalysis.cloudinaryUrl = cUrl;
      }
    }

    // 6. Persist to history and display clear color-coded result cards
    if (scanAnalysis) {
      const flaggedIngredients = [
        ...(aiResult?.problemIngredients || []),
        ...(scanAnalysis.detectedForbidden || []).map(f => f.matchedWord || f.name),
        ...(scanAnalysis.detectedCaution || []).map(c => c.matchedWord || c.name)
      ];
      const uniqueFlagged = [...new Set(flaggedIngredients.map(t => String(t).trim()))].filter(Boolean);
      const reason = aiResult?.reason || scanAnalysis.reason || (scanAnalysis.reasons && scanAnalysis.reasons[0]) || '';
      const imageUrl = state.cloudinaryUrl || state.imagePreviewUrl || null;

      state.scanHistory = addScanToHistory({
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
  } catch (err) {
    console.error('Scan workflow error:', err);
    state.ocrStatus = null;
    state.aiLoading = false;
    alert('Could not complete scanning workflow. You can paste ingredients in the text tab.');
    state.inputMode = 'text';
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
    ocrStatus,
    ocrProgress,
    aiAnalysis,
    aiLoading,
    imagePreviewUrl,
    cloudinaryUrl,
    inputMode = 'camera', // 'camera' or 'text'
    scanHistory = [],
    selectedScanItem = null
  } = state;

  return `
    <div class="scanner-container">
      <!-- Scanner Hero & Controls -->
      <div class="scanner-hero">
        <div class="scanner-hero-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </div>

        <h2 class="scanner-hero-title">Label & Packaging Scanner</h2>
        <p class="scanner-hero-desc">
          Capture food nutrition labels with your camera or paste the ingredient list. Automatically verified using Gemini 2.5 Flash and our offline Low-Iodine Diet clinical engine.
        </p>

        <!-- Mode Toggle -->
        <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 16px;">
          <button id="toggle-camera-mode" class="filter-btn ${inputMode === 'camera' ? 'active' : ''}">
            📸 Photo / Camera
          </button>
          <button id="toggle-text-mode" class="filter-btn ${inputMode === 'text' ? 'active' : ''}">
            ✏️ Paste Ingredients
          </button>
        </div>

        ${inputMode === 'camera' ? `
          <!-- Camera Actions -->
          <div class="scanner-actions">
            <label class="btn-primary" style="cursor: pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span>Take Photo with Camera</span>
              <input type="file" id="camera-file-input" accept="image/*" capture="environment" style="display: none;" />
            </label>

            <label class="btn-secondary" style="cursor: pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              <span>Upload Gallery Image</span>
              <input type="file" id="gallery-file-input" accept="image/*" style="display: none;" />
            </label>
          </div>
        ` : `
          <!-- Manual Text Input Mode -->
          <div style="text-align: left; max-width: 650px; margin: 0 auto;">
            <textarea 
              id="scanner-manual-textarea" 
              class="ingredients-textarea" 
              placeholder="Paste ingredient list here (e.g. Enriched flour, water, salt, carrageenan, soy lecithin)..."
            >${escapeHtml(scanText || '')}</textarea>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button id="scanner-clear-text-btn" class="btn-secondary" style="padding: 8px 16px;">Clear</button>
              <button id="scanner-analyze-btn" class="btn-primary" style="padding: 8px 20px;">Analyze Ingredients</button>
            </div>
          </div>
        `}
      </div>

      <!-- Preset Test Samples for Immediate Demonstration -->
      <div class="presets-section">
        <div class="section-label">
          <span>⚡ One-Tap Clinical Sample Labels:</span>
        </div>
        <div class="preset-pills-grid">
          ${SAMPLE_LABELS.map((sample, idx) => `
            <button class="preset-chip" data-sample-index="${idx}">
              <span>${sample.badge.includes('Safe') ? '🟢' : sample.badge.includes('Caution') ? '🟡' : '🔴'}</span>
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
            Extracting text & running clinical verification
          </div>
        </div>
      ` : ''}

      <!-- Scanned Image Thumbnail Preview -->
      ${imagePreviewUrl ? `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 10px;">
          <img src="${imagePreviewUrl}" alt="Scanned Label" style="max-height: 180px; border-radius: 12px; border: 1px solid var(--border-color); object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.4);" />
          ${(cloudinaryUrl || scanAnalysis?.cloudinaryUrl) ? `
            <a href="${escapeHtml(cloudinaryUrl || scanAnalysis?.cloudinaryUrl)}" target="_blank" rel="noopener" style="font-size: 0.78rem; color: var(--accent-cyan); display: inline-flex; align-items: center; gap: 4px;">
              <span>☁️ Saved to Cloudinary Archive</span>
              <span>↗</span>
            </a>
          ` : ''}
        </div>
      ` : ''}

      <!-- Scan Analysis Result (Color-coded result cards) -->
      ${scanAnalysis ? renderAnalysisResult(scanAnalysis, scanText, aiAnalysis, aiLoading, cloudinaryUrl) : ''}

      <!-- Scan History -->
      ${scanHistory.length > 0 ? renderScanHistory(scanHistory) : ''}

      <!-- Detail Preview / Inspection Modal -->
      ${selectedScanItem ? renderScanDetailModal(selectedScanItem) : ''}
    </div>
  `;
}

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
        <span class="engine-badge ${analysis.source === 'GEMINI_AI' || aiAnalysis ? 'badge-gemini' : 'badge-offline'}" style="font-weight: 700;">
          ${analysis.source === 'GEMINI_AI' || aiAnalysis ? '🤖 Verified by Gemini AI Clinical Analysis' : '⚡ Evaluated by Offline Clinical Rule Engine'}
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
              const tokenClass = token.status === STATUS.AVOID || token.status === 'AVOID' ? 'token-avoid' : (token.status === STATUS.CAUTION || token.status === 'CAUTION' ? 'token-caution' : 'token-safe');
              const icon = token.status === STATUS.AVOID || token.status === 'AVOID' ? '✕' : (token.status === STATUS.CAUTION || token.status === 'CAUTION' ? '!' : '✓');
              return `
                <span class="ingredient-token ${tokenClass}" title="${escapeHtml(token.matchedReason || 'Safe ingredient')}">
                  <span>${icon}</span>
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

      <!-- AI Deep Reasoning Result Box -->
      ${aiAnalysis ? renderAiResult(aiAnalysis) : ''}
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
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span class="section-label" style="margin: 0;">📜 Recent Scanned Labels (${history.length})</span>
        <button id="clear-scan-history-btn" style="background: none; border: none; color: var(--text-muted); font-size: 0.75rem; cursor: pointer; text-decoration: underline;">
          Clear History
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${history.slice(0, 10).map(item => {
          const isSafe = item.status === STATUS.SAFE || item.status === 'SAFE';
          const isAvoid = item.status === STATUS.AVOID || item.status === 'AVOID';
          const hasImage = Boolean(item.imageUrl || item.cloudinaryUrl);

          return `
            <div 
              class="check-item scan-history-card cursor-pointer hover:border-emerald-500/50 transition-all active:scale-[0.99]" 
              data-history-id="${escapeHtml(item.id)}" 
              style="cursor: pointer; justify-content: space-between; align-items: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border-radius: var(--radius-md);"
              title="Click to view archived image and clinical evaluation"
            >
              <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                ${hasImage ? `
                  <div style="width: 44px; height: 44px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); flex-shrink: 0; background: #000; display: flex; align-items: center; justify-content: center;">
                    <img 
                      src="${escapeHtml(item.imageUrl || item.cloudinaryUrl)}" 
                      alt="Thumbnail" 
                      style="width: 100%; height: 100%; object-fit: cover;" 
                    />
                  </div>
                ` : `
                  <div style="width: 44px; height: 44px; border-radius: 8px; background: var(--bg-card-subtle); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
                    ${isSafe ? '🟢' : isAvoid ? '🔴' : '🟡'}
                  </div>
                `}

                <div style="min-width: 0; flex: 1;">
                  <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(item.title || (item.rawText ? item.rawText.slice(0, 45) + '...' : 'Scanned Label'))}
                  </div>
                  <div style="font-size: 0.73rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px;">
                    <span>${new Date(item.timestamp).toLocaleDateString()} ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    ${item.cloudinaryUrl ? '<span style="color: #38bdf8; font-weight: 600;">• ☁️ Cloudinary</span>' : (hasImage ? '<span style="color: var(--safe-green); font-weight: 600;">• 📷 Photo</span>' : '')}
                  </div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 10px;">
                <span class="badge-status ${isSafe ? 'badge-safe' : isAvoid ? 'badge-avoid' : 'badge-caution'}">
                  ${item.status}
                </span>
                <span style="color: var(--text-muted); font-size: 1.1rem; line-height: 1;">›</span>
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
  const cloudUrl = item.cloudinaryUrl || (isCloudinary ? imageUrl : null);

  const formattedDate = item.timestamp
    ? new Date(item.timestamp).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recent Scan';

  return `
    <div class="bg-black/80 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay" id="scan-modal-overlay" role="dialog" aria-modal="true" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn 0.2s ease;">
      <div class="scan-detail-card modal-content" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; padding: 22px; box-shadow: 0 25px 60px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 16px;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
          <div>
            <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <span>ARCHIVED SCAN RECORD</span>
              <span>•</span>
              <span>${escapeHtml(formattedDate)}</span>
            </div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
              ${escapeHtml(item.title || 'Scanned Food Label')}
            </h3>
          </div>
          <button id="scan-modal-close-btn" class="btn-icon" aria-label="Close" style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); color: var(--text-secondary); width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.1rem; flex-shrink: 0;">✕</button>
        </div>

        <!-- Image Preview or Placeholder -->
        ${imageUrl ? `
          <div style="background: rgba(0,0,0,0.4); border: 1px solid var(--border-color); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <img 
              src="${escapeHtml(imageUrl)}" 
              alt="Archived Scanned Label" 
              class="max-h-72 object-contain mx-auto" 
              style="max-height: 18rem; width: auto; object-fit: contain; margin-left: auto; margin-right: auto; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 14px rgba(0,0,0,0.5);"
            />
            ${cloudUrl ? `
              <a href="${escapeHtml(cloudUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.78rem; font-weight: 600; color: #38bdf8; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; padding: 4px 10px; background: rgba(56, 189, 248, 0.1); border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.25);">
                <span>☁️ View full resolution in Cloudinary Archive ↗</span>
              </a>
            ` : ''}
          </div>
        ` : `
          <div style="background: var(--bg-card-subtle); border: 1px dashed var(--border-color); border-radius: 12px; padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            <div style="font-size: 1.5rem; margin-bottom: 4px;">📝</div>
            <div>Text-based scan (No camera photo archived)</div>
            ${item.rawText ? `
              <div style="margin-top: 8px; font-size: 0.78rem; color: var(--text-secondary); background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 6px; font-family: var(--font-mono); max-height: 80px; overflow-y: auto; text-align: left;">
                ${escapeHtml(item.rawText)}
              </div>
            ` : ''}
          </div>
        `}

        <!-- Clinical Evaluation Status Banner -->
        <div class="result-banner ${isSafe ? 'banner-safe' : (isAvoid ? 'banner-avoid' : 'banner-caution')}" style="padding: 12px 14px; border-radius: var(--radius-sm); margin: 0;">
          <div class="banner-status-icon" style="font-size: 1.35rem;">${statusEmoji}</div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
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
          <div style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em; margin-bottom: 4px;">
            Clinical Assessment Reason:
          </div>
          <div style="font-size: 0.86rem; color: var(--text-primary); line-height: 1.45;">
            ${escapeHtml(reasonText)}
          </div>
        </div>

        <!-- Flagged Problem Ingredients (if any) -->
        ${uniqueFlagged.length > 0 ? `
          <div>
            <div style="font-size: 0.78rem; font-weight: 700; color: ${isAvoid ? '#f87171' : '#fbbf24'}; margin-bottom: 8px;">
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
        ` : ''}

        <!-- Evaluation Timestamp Footer Info -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted); padding: 0 4px;">
          <span>Evaluated on:</span>
          <span style="font-weight: 600; color: var(--text-secondary);">${escapeHtml(formattedDate)}</span>
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 10px; justify-content: flex-end; align-items: center; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: 4px;">
          <button id="scan-modal-reaudit-btn" class="btn-secondary" style="padding: 8px 14px; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px;">
            <span>✨</span>
            <span>Re-Audit with AI</span>
          </button>
          <button id="scan-modal-done-btn" class="btn-primary" style="padding: 8px 20px; font-size: 0.85rem;">
            Done
          </button>
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
