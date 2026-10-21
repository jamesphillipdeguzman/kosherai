// Meal & Family Cook Mode Component (Pre-Cooking Checklist & Recipe Analyzer)
import { PRE_COOKING_CHECKLIST } from '../data/protocolRules.js';
import { analyzeRecipe } from '../services/ruleEngine.js';

export function renderCookModeTab(state) {
  const { checklistState = {}, recipeAnalysis = null, recipeText = '' } = state;

  const totalChecks = PRE_COOKING_CHECKLIST.length;
  const checkedCount = PRE_COOKING_CHECKLIST.filter(item => checklistState[item.id]).length;
  const isAllClear = checkedCount === totalChecks;

  return `
    <div class="cook-container">
      <!-- Pre-Cooking Checklist Card -->
      <div class="checklist-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div>
            <h2 class="checklist-title">Pre-Cooking Safety Checklist</h2>
            <p class="checklist-desc">
              Caregivers and home cooks: verify these 7 safety rules before turning on the stove.
            </p>
          </div>
          <button id="reset-checklist-btn" class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem;">
            Reset
          </button>
        </div>

        <div class="checklist-items">
          ${PRE_COOKING_CHECKLIST.map(item => {
            const isChecked = !!checklistState[item.id];
            return `
              <div class="check-item ${isChecked ? 'checked' : ''}" data-check-id="${item.id}" role="checkbox" aria-checked="${isChecked}" tabindex="0">
                <div class="custom-checkbox">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div class="check-item-text">${escapeHtml(item.text)}</div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Meter -->
        <div class="checklist-meter ${isAllClear ? 'all-clear' : 'pending'}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.3rem;">${isAllClear ? '🛡️' : '⚠️'}</span>
            <div>
              <div style="font-weight: 800; font-size: 0.95rem;">
                ${isAllClear ? 'ALL CLEAR: SAFE TO COOK' : `${checkedCount} of ${totalChecks} Rules Verified`}
              </div>
              <div style="font-size: 0.78rem; opacity: 0.9;">
                ${isAllClear ? 'Your kitchen setup fully protects against accidental iodine contamination.' : 'Review any unchecked items before proceeding.'}
              </div>
            </div>
          </div>
          <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.2rem;">
            ${Math.round((checkedCount / totalChecks) * 100)}%
          </div>
        </div>
      </div>

      <!-- Recipe Safety Analyzer -->
      <div class="recipe-analyzer-card">
        <div style="margin-bottom: 14px;">
          <h2 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 4px;">Recipe Ingredient Tester</h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            Paste any meal recipe or grocery ingredient list to run an automated line-by-line audit.
          </p>
        </div>

        <!-- Quick Demo Recipes -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); align-self: center;">Try Sample:</span>
          <button id="load-safe-recipe-btn" class="quick-tag-chip" style="color: #34d399; border-color: var(--safe-border);">
            🟢 Safe Family Tinola
          </button>
          <button id="load-risky-recipe-btn" class="quick-tag-chip" style="color: #f87171; border-color: var(--avoid-border);">
            🔴 Careless Beef Stew (5 Violations)
          </button>
        </div>

        <textarea 
          id="recipe-textarea" 
          class="ingredients-textarea" 
          style="min-height: 140px; font-family: var(--font-mono); font-size: 0.85rem;" 
          placeholder="Paste recipe lines here:&#10;1 lb fresh chicken cutlets&#10;1 sayote (chayote), peeled and sliced&#10;1 tbsp pure coconut oil&#10;1 tsp non-iodized kosher salt&#10;fresh ginger and garlic"
        >${escapeHtml(recipeText)}</textarea>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 16px;">
          <button id="recipe-clear-btn" class="btn-secondary" style="padding: 8px 16px;">Clear</button>
          <button id="recipe-analyze-btn" class="btn-primary" style="padding: 8px 20px;">
            <span>🔬 Audit Recipe</span>
          </button>
        </div>

        <!-- Recipe Audit Output -->
        ${recipeAnalysis ? renderRecipeResults(recipeAnalysis) : ''}
      </div>
    </div>
  `;
}

function renderRecipeResults(audit) {
  const isSafe = audit.overallStatus === 'SAFE';
  const isAvoid = audit.overallStatus === 'AVOID';

  return `
    <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; margin-top: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(audit.title)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${audit.totalLines} ingredient lines analyzed</div>
        </div>
        <div style="text-align: right;">
          <div style="font-family: var(--font-mono); font-size: 1.4rem; font-weight: 800; color: ${isSafe ? 'var(--safe-green)' : isAvoid ? 'var(--avoid-red)' : 'var(--caution-amber)'};">
            ${audit.safetyScore}% Safe
          </div>
          <span class="badge-status ${isSafe ? 'badge-safe' : isAvoid ? 'badge-avoid' : 'badge-caution'}">
            ${audit.overallStatus}
          </span>
        </div>
      </div>

      <!-- Line by line breakdown -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${audit.analyzedLines.map(lineItem => {
          const lSafe = lineItem.status === 'SAFE';
          const lAvoid = lineItem.status === 'AVOID';
          const badgeColor = lSafe ? 'var(--safe-green)' : lAvoid ? 'var(--avoid-red)' : 'var(--caution-amber)';
          const icon = lSafe ? '✓' : lAvoid ? '✕' : '!';

          return `
            <div style="background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid ${badgeColor}; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
              <div>
                <span style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">${escapeHtml(lineItem.line)}</span>
                ${lineItem.forbidden && lineItem.forbidden.length > 0 ? `
                  <div style="font-size: 0.75rem; color: #f87171; margin-top: 2px;">
                    ⚠️ ${escapeHtml(lineItem.forbidden[0].reason)}
                  </div>
                ` : ''}
              </div>
              <span style="font-family: var(--font-mono); font-weight: 800; font-size: 0.8rem; color: ${badgeColor}; flex-shrink: 0;">
                ${icon} ${lineItem.status}
              </span>
            </div>
          `;
        }).join('')}
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
