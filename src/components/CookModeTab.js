// Meal & Family Cook Mode Component (Pre-Cooking Checklist, Recipe Analyzer & Practical Dishes)
import { PRE_COOKING_CHECKLIST } from '../data/protocolRules.js';
import { analyzeRecipe } from '../services/ruleEngine.js';
import lidRecipes from '../data/lidRecipes.json';

export { lidRecipes };

const CATEGORIES = ['All', 'Breakfast', 'Mains', 'Soups & Stews', 'Snacks & Sides'];

export function renderCookModeTab(state) {
  const { 
    checklistState = {}, 
    recipeAnalysis = null, 
    recipeText = '',
    recipeCategoryFilter = 'ALL'
  } = state;

  const totalChecks = PRE_COOKING_CHECKLIST.length;
  const checkedCount = PRE_COOKING_CHECKLIST.filter(item => checklistState[item.id]).length;
  const isAllClear = checkedCount === totalChecks;

  const activeCategory = recipeCategoryFilter || 'ALL';
  const filteredRecipes = (activeCategory === 'ALL' || activeCategory === 'All')
    ? lidRecipes
    : lidRecipes.filter(r => r.category.toLowerCase() === activeCategory.toLowerCase());

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

      <!-- Practical LID / RAI Compliant Dishes Section -->
      <section class="practical-recipes-section">
        <div class="practical-recipes-header">
          <div>
            <h2 class="practical-recipes-title">
              <span>🍳</span> Practical LID / RAI Compliant Dishes
            </h2>
            <p class="practical-recipes-subtitle">
              Curated home-cooked meals strictly &lt;5 mcg iodine per serving. Free of commercial dairy, sea salt, egg yolks, and bouillons.
            </p>
          </div>
          <span class="recipe-count-badge">${filteredRecipes.length} Dishes</span>
        </div>

        <!-- Category Filter Bar -->
        <div class="recipe-filter-bar" role="tablist" aria-label="Recipe categories">
          ${CATEGORIES.map(cat => {
            const isSelected = (cat === 'All' && (activeCategory === 'ALL' || activeCategory === 'All')) || 
                               (cat.toLowerCase() === activeCategory.toLowerCase());
            return `
              <button 
                class="recipe-filter-btn ${isSelected ? 'active' : ''}" 
                data-category="${cat === 'All' ? 'ALL' : cat}"
                role="tab"
                aria-selected="${isSelected}"
              >
                ${cat}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Recipe Cards Grid -->
        <div class="recipes-grid">
          ${filteredRecipes.map(recipe => renderRecipeCard(recipe)).join('')}
        </div>
      </section>
    </div>
  `;
}

function renderRecipeCard(recipe) {
  return `
    <article class="recipe-card" id="recipe-${recipe.id}">
      <div class="recipe-card-header">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
          <span class="recipe-category-pill">${escapeHtml(recipe.category)}</span>
          <div class="recipe-time-tag">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8;">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Prep: ${escapeHtml(recipe.prepTime)} • Cook: ${escapeHtml(recipe.cookTime)}</span>
          </div>
        </div>
        <h3 class="recipe-card-title">${escapeHtml(recipe.title)}</h3>
        <div class="recipe-clinical-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>${escapeHtml(recipe.clinicalBadge)}</span>
        </div>
      </div>

      <div class="recipe-card-body">
        <!-- Ingredients List -->
        <div class="recipe-card-section">
          <div class="recipe-section-heading">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
            </svg>
            <span>Ingredients (${recipe.ingredients.length})</span>
          </div>
          <ul class="recipe-ingredients-list">
            ${recipe.ingredients.map(ing => `<li>${escapeHtml(ing)}</li>`).join('')}
          </ul>
        </div>

        <!-- Step-by-Step Directions -->
        <div class="recipe-card-section">
          <div class="recipe-section-heading">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span>Preparation Directions</span>
          </div>
          <ol class="recipe-directions-list">
            ${recipe.instructions.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
          </ol>
        </div>

        <!-- Clinical Note Callout -->
        <div class="recipe-clinical-callout">
          <div class="callout-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <span class="callout-title">Clinical Protocol Rationale</span>
          </div>
          <p class="callout-text">${escapeHtml(recipe.clinicalNote)}</p>
        </div>
      </div>

      <!-- Action Button -->
      <div class="recipe-card-footer">
        <button class="btn-primary load-recipe-btn" data-recipe-id="${recipe.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 18h12"></path>
            <path d="M3 22h18"></path>
            <path d="M14 2H6a2 2 0 0 0-2 2v16"></path>
            <path d="M14 2v6h6"></path>
          </svg>
          <span>Load into Recipe Auditor</span>
        </button>
      </div>
    </article>
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
