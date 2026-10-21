// Packaging Ingredient Scanner Component (Camera / OCR + AI Deep Verification)
import { STATUS } from '../data/lidDatabase.js';

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

export function renderScannerTab(state) {
  const {
    scanText,
    scanAnalysis,
    ocrStatus,
    ocrProgress,
    aiAnalysis,
    aiLoading,
    imagePreviewUrl,
    inputMode = 'camera', // 'camera' or 'text'
    scanHistory = []
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
          Capture food nutrition labels with your camera or paste the ingredient list. Our offline engine flags iodized salt, iodates, seaweed, dairy, goitrogens, and Red #3.
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
            Extracting text using client-side OCR
          </div>
        </div>
      ` : ''}

      <!-- Scanned Image Thumbnail Preview -->
      ${imagePreviewUrl ? `
        <div style="display: flex; justify-content: center; margin-bottom: 10px;">
          <img src="${imagePreviewUrl}" alt="Scanned Label" style="max-height: 180px; border-radius: 12px; border: 1px solid var(--border-color); object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.4);" />
        </div>
      ` : ''}

      <!-- Scan Analysis Result -->
      ${scanAnalysis ? renderAnalysisResult(scanAnalysis, scanText, aiAnalysis, aiLoading) : ''}

      <!-- Scan History -->
      ${scanHistory.length > 0 ? renderScanHistory(scanHistory) : ''}
    </div>
  `;
}

function renderAnalysisResult(analysis, rawText, aiAnalysis, aiLoading) {
  const isSafe = analysis.status === STATUS.SAFE;
  const isAvoid = analysis.status === STATUS.AVOID;
  const isCaution = analysis.status === STATUS.CAUTION;

  let bannerClass = 'banner-safe';
  let bannerIcon = '🟢';
  let bannerTitle = 'SAFE ON LOW-IODINE DIET';
  let bannerSub = 'No prohibited iodine sources, dairy, goitrogens, or suspicious additives detected.';

  if (isAvoid) {
    bannerClass = 'banner-avoid';
    bannerIcon = '🔴';
    bannerTitle = 'STRICTLY PROHIBITED (AVOID)';
    bannerSub = 'Contains high-iodine ingredients or clinical contraindications.';
  } else if (isCaution) {
    bannerClass = 'banner-caution';
    bannerIcon = '🟡';
    bannerTitle = 'CHECK LABEL CAREFULLY (CAUTION)';
    bannerSub = 'Contains unverified salt, flavorings, or ambiguous dough conditioners.';
  }

  return `
    <div class="scan-result-card ${analysis.status === STATUS.SAFE ? 'status-safe' : analysis.status === STATUS.AVOID ? 'status-avoid' : 'status-caution'}">
      <!-- Status Banner -->
      <div class="result-banner ${bannerClass}">
        <div class="banner-status-icon">${bannerIcon}</div>
        <div>
          <div class="banner-headline">${bannerTitle}</div>
          <div class="banner-sub">${bannerSub}</div>
        </div>
      </div>

      <!-- Highlighted Parsed Ingredients -->
      <div class="highlight-tokens-box">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">
            Parsed Ingredients (${analysis.parsedTokens.length})
          </span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">
            Click any tag to inspect
          </span>
        </div>

        <div class="tokens-flex">
          ${analysis.parsedTokens.map(token => {
            const tokenClass = token.status === STATUS.AVOID ? 'token-avoid' : token.status === STATUS.CAUTION ? 'token-caution' : 'token-safe';
            const icon = token.status === STATUS.AVOID ? '✕' : token.status === STATUS.CAUTION ? '!' : '✓';
            return `
              <span class="ingredient-token ${tokenClass}" title="${escapeHtml(token.matchedReason || 'Safe ingredient')}">
                <span>${icon}</span>
                <span>${escapeHtml(token.text)}</span>
              </span>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Problem & Caution Ingredients Breakdown -->
      ${analysis.detectedForbidden.length > 0 || analysis.detectedCaution.length > 0 ? `
        <div class="issues-list">
          ${analysis.detectedForbidden.map(item => `
            <div class="issue-item issue-avoid">
              <span style="font-size: 1.2rem;">🔴</span>
              <div>
                <div class="issue-title">${escapeHtml(item.name)} (Flagged: "${escapeHtml(item.matchedWord)}")</div>
                <div class="issue-desc">${escapeHtml(item.reason)}</div>
              </div>
            </div>
          `).join('')}

          ${analysis.detectedCaution.map(item => `
            <div class="issue-item issue-caution">
              <span style="font-size: 1.2rem;">🟡</span>
              <div>
                <div class="issue-title">${escapeHtml(item.name)} (Flagged: "${escapeHtml(item.matchedWord)}")</div>
                <div class="issue-desc">${escapeHtml(item.reason)}</div>
              </div>
            </div>
          `).join('')}
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
          <span>${aiLoading ? 'AI Reasoning...' : 'Run Gemini AI Verification'}</span>
        </button>
      </div>

      <!-- AI Deep Reasoning Result Box -->
      ${aiAnalysis ? renderAiResult(aiAnalysis) : ''}
    </div>
  `;
}

function renderAiResult(ai) {
  return `
    <div class="ai-verification-card">
      <div class="ai-header">
        <span class="ai-sparkle">✨</span>
        <div class="ai-title">Gemini Clinical Deep Reasoning</div>
        <span class="badge-status ${ai.status === STATUS.SAFE ? 'badge-safe' : ai.status === STATUS.AVOID ? 'badge-avoid' : 'badge-caution'}" style="margin-left: auto;">
          ${ai.status}
        </span>
      </div>

      <div class="ai-body">
        <p style="margin-bottom: 8px;"><strong>Clinical Summary:</strong> ${escapeHtml(ai.clinicalSummary || '')}</p>
        
        ${ai.reasons && ai.reasons.length > 0 ? `
          <ul style="padding-left: 20px; margin-bottom: 8px;">
            ${ai.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>
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
    <div style="margin-top: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span class="section-label" style="margin: 0;">📜 Recent Scanned Labels (${history.length})</span>
        <button id="clear-scan-history-btn" style="background: none; border: none; color: var(--text-muted); font-size: 0.75rem; cursor: pointer; text-decoration: underline;">
          Clear History
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${history.slice(0, 5).map(item => `
          <div class="check-item" data-history-id="${item.id}" style="cursor: pointer; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span>${item.status === STATUS.SAFE ? '🟢' : item.status === STATUS.AVOID ? '🔴' : '🟡'}</span>
              <div>
                <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary); max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(item.title || item.rawText.slice(0, 50) + '...')}
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">
                  ${new Date(item.timestamp).toLocaleDateString()} ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <span class="badge-status ${item.status === STATUS.SAFE ? 'badge-safe' : item.status === STATUS.AVOID ? 'badge-avoid' : 'badge-caution'}">
              ${item.status}
            </span>
          </div>
        `).join('')}
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
