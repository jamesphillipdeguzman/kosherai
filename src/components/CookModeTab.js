// Meal & Family Cook Mode Component (Pre-Cooking Checklist, Recipe Analyzer & Practical Dishes)
import { CHECKLIST_BY_DIET, PRE_COOKING_CHECKLIST } from '../data/protocolRules.js';
import { analyzeRecipe } from '../services/ruleEngine.js';
import { DIET_RECIPES } from '../data/dietRecipes.js';
import { getCategoryIcon } from '../data/lidDatabase.js';
import { getRecipeImageUrl } from '../utils/cloudinary.js';
import { getCachedRecipeInteraction, isRecipeLiked } from '../services/recipeInteractionsStorage.js';
import { scaleRecipe } from '../services/recipeScaler.js';
import lidRecipes from '../data/lidRecipes.json' with { type: 'json' };
import generatedImages from '../data/generatedImages.json' with { type: 'json' };

export { DIET_RECIPES, lidRecipes, scaleRecipe };

const CATEGORIES = ['All', 'Breakfast', 'Mains', 'Soups & Stews', 'Snacks & Sides'];

export function renderCookModeTab(state = {}) {
  const { 
    checklistState = {}, 
    recipeAnalysis = null, 
    recipeText = '',
    recipeCategoryFilter = 'ALL',
    activeDiet = 'lid',
    household_members = 4,
    isAdmin = false,
    checklistExpanded = false
  } = state;

  const isUserAdmin = Boolean(
    isAdmin ||
    state.isAdmin ||
    (state.user && (state.user.role === 'admin' || state.user.role === 'administrator')) ||
    (typeof window !== 'undefined' && (() => {
      try {
        const stored = localStorage.getItem('kosherai_current_user') || localStorage.getItem('kosherai_user_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          const u = parsed.user || parsed;
          return u.role === 'admin' || u.role === 'administrator';
        }
      } catch (_) {}
      return false;
    })())
  );

  const householdMembers = Math.max(1, Math.min(20, Math.round(Number(household_members || state.settings?.household_members || 4))));

  const currentDietData = DIET_RECIPES[activeDiet] || DIET_RECIPES.lid;
  const activeChecklist = CHECKLIST_BY_DIET[activeDiet] || CHECKLIST_BY_DIET.lid || PRE_COOKING_CHECKLIST;

  const totalChecks = activeChecklist.length;
  const checkedCount = activeChecklist.filter(item => checklistState[item.id]).length;
  const isAllClear = checkedCount === totalChecks;

  const activeTab = recipeCategoryFilter || 'All';
  const allMeals = currentDietData?.meals || [];
  const targetTab = (activeTab || 'all').toLowerCase().trim();

  const filteredRecipes = (targetTab === 'all')
    ? allMeals
    : allMeals.filter(meal => {
        // Check all potential category/type fields
        const mealCat = (meal.category || meal.type || meal.course || '').toLowerCase().trim();
        
        if (targetTab === 'breakfast') {
          return mealCat.includes('breakfast');
        }
        if (targetTab === 'mains' || targetTab === 'main') {
          return mealCat.includes('main') || mealCat.includes('ulam');
        }
        if (targetTab.includes('soup') || targetTab.includes('stew')) {
          return mealCat.includes('soup') || mealCat.includes('stew') || mealCat.includes('sabaw');
        }
        if (targetTab.includes('snack') || targetTab.includes('side')) {
          return mealCat.includes('snack') || mealCat.includes('side') || mealCat.includes('merienda');
        }

        return mealCat === targetTab;
      });

  return `
    <div class="cook-container">
      <!-- Pre-Cooking Checklist Card (Collapsible) -->
      <div class="checklist-card ${checklistExpanded ? 'is-expanded' : 'is-collapsed'}" id="checklist-card-container">
        <!-- Interactive Collapsible Header -->
        <div 
          class="checklist-header-wrapper flex items-center justify-between gap-3 cursor-pointer select-none" 
          id="toggle-checklist-btn" 
          role="button" 
          tabindex="0" 
          aria-expanded="${checklistExpanded}" 
          aria-controls="checklist-body"
          aria-label="Toggle Pre-Cooking Safety Checklist"
        >
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
            <span class="checklist-chevron" style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; transition: transform 0.2s ease; transform: ${checklistExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}; color: var(--text-secondary); flex-shrink: 0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h2 class="checklist-title" style="margin: 0; font-size: 1.15rem; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
                  <span>Pre-Cooking Safety Checklist</span>
                </h2>
                <!-- Progress indicator in header (e.g. 0/7 Verified) -->
                <span id="checklist-header-badge" class="checklist-progress-badge ${isAllClear ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}" style="font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px; border-width: 1px; border-style: solid; font-family: var(--font-mono); white-space: nowrap;">
                  ${checkedCount}/${totalChecks} Verified
                </span>
              </div>
              ${checklistExpanded ? `
                <p class="checklist-desc" style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">
                  Caregivers and home cooks: verify these ${totalChecks} safety rules before turning on the stove.
                </p>
              ` : ''}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;" onclick="event.stopPropagation();">
            <button id="reset-checklist-btn" type="button" class="btn-secondary" style="padding: 5px 12px; font-size: 0.75rem; border-radius: 8px;" title="Reset checklist progress">
              Reset
            </button>
          </div>
        </div>

        ${checklistExpanded ? `
          <div class="checklist-body" id="checklist-body" style="margin-top: 14px;">
            <div class="checklist-items">
              ${activeChecklist.map(item => {
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
            <div class="checklist-meter ${isAllClear ? 'all-clear border border-emerald-600/50 dark:border-emerald-400/50 bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300' : 'pending border border-amber-600/50 dark:border-amber-400/50 bg-amber-500/10 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'}">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.3rem;">${isAllClear ? '🛡️' : '⚠️'}</span>
                <div>
                  <div style="font-weight: 800; font-size: 0.95rem;">
                    ${isAllClear ? 'ALL CLEAR: SAFE TO COOK' : `${checkedCount} of ${totalChecks} Rules Verified`}
                  </div>
                  <div style="font-size: 0.78rem; opacity: 0.9;">
                    ${isAllClear ? 'Your kitchen setup fully protects against accidental contamination.' : 'Review any unchecked items before proceeding.'}
                  </div>
                </div>
              </div>
              <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.2rem;">
                ${Math.round((checkedCount / totalChecks) * 100)}%
              </div>
            </div>
          </div>
        ` : ''}
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
          <button 
            id="load-safe-recipe-btn" 
            type="button" 
            class="quick-tag-chip inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border border-teal-600/60 dark:border-teal-400/60 bg-teal-500/10 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 hover:bg-teal-500/20 shadow-sm"
          >
            <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
            <span>${escapeHtml(currentDietData?.sampleAudit?.name || 'Safe Sample')}</span>
          </button>
          <button id="load-risky-recipe-btn" class="quick-tag-chip" style="color: #f87171; border-color: var(--avoid-border);">
            🔴 Careless Beef Stew (Violations Detected)
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

      <!-- Dynamic Curated Pinoy Meals Section -->
      <section class="practical-recipes-section">
        <div class="practical-recipes-header flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="practical-recipes-title">
              <span>🍳</span> ${escapeHtml(currentDietData.title)}
            </h2>
            <p class="practical-recipes-subtitle">
              ${escapeHtml(currentDietData.description)}
            </p>
          </div>
          <div class="flex items-center gap-2.5 flex-wrap">
            ${isUserAdmin ? `
              <button 
                type="button" 
                id="open-ingredient-admin-cook-btn" 
                data-tab="manage"
                class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Manage Ingredient Photos"
                aria-label="Manage Ingredient Photos"
              >
                <span>🖼️</span>
                <span>Manage Ingredient Photos</span>
              </button>
            ` : ''}
            <span class="recipe-count-badge px-2.5 py-0.5 rounded-full text-xs font-bold border border-teal-600/40 dark:border-teal-400/40 bg-teal-500/10 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300">
              ${filteredRecipes.length} ${filteredRecipes.length === 1 ? 'Dish' : 'Dishes'}
            </span>
          </div>
        </div>

        <!-- Household Portion Scaling Selector -->
        <div class="household-portion-bar flex flex-col gap-1.5 my-3 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm mb-6">
          <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span class="text-base leading-none">👨‍👩‍👧‍👦</span>
            <span>Household Size Dynamic Scaling</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Adjust recipe ingredients dynamically for your household (1–20 members).
          </p>

          <div class="flex flex-col sm:flex-row sm:items-center gap-3 my-3">
            <!-- Modern Stepper Pill -->
            <div class="inline-flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700/80 rounded-full px-2 py-1.5 shadow-xs w-fit">
              <!-- Decrement Button -->
              <button
                type="button"
                class="household-dec-btn w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-xs"
                data-current-val="${householdMembers}"
                title="Decrease members"
                aria-label="Decrease household members"
                ${householdMembers <= 1 ? 'disabled' : ''}
              >
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
                </svg>
              </button>

              <!-- Dynamic Count Display with Member Icon -->
              <div class="flex items-center gap-1.5 px-3 min-w-[7rem] justify-center select-none">
                <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span class="household-members-count text-sm font-bold text-slate-800 dark:text-slate-100">
                  ${householdMembers} ${householdMembers === 1 ? 'Member' : 'Members'}
                </span>
              </div>

              <!-- Increment Button -->
              <button
                type="button"
                class="household-inc-btn w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-xs"
                data-current-val="${householdMembers}"
                title="Increase members"
                aria-label="Increase household members"
                ${householdMembers >= 20 ? 'disabled' : ''}
              >
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <!-- Quick Multiplier Context Badge -->
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 w-fit">
              ${(householdMembers / 4).toFixed(2)}x Recipe Ratio
            </span>
          </div>
        </div>

        <!-- Category Filter Bar -->
        <div class="recipe-filter-bar" role="tablist" aria-label="Recipe categories">
          ${CATEGORIES.map(cat => {
            const isSelected = (cat === 'All' && (targetTab === 'all')) || 
                               (cat.toLowerCase() === targetTab);
            return `
              <button 
                class="recipe-filter-btn ${isSelected ? 'active ' : ''}px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isSelected 
                    ? 'border border-teal-600/60 dark:border-teal-400/60 bg-teal-500/10 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 shadow-sm' 
                    : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60'
                }" 
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
          ${filteredRecipes.map(recipe => renderRecipeCard(recipe, state)).join('')}
        </div>
      </section>

      <!-- Recipe Comments Drawer / Modal -->
      ${state?.activeCommentDrawerRecipe ? renderRecipeCommentsDrawer(state.activeCommentDrawerRecipe, state) : ''}
    </div>
  `;
}

function renderRecipeCard(recipe, state = {}) {
  const householdMembers = Math.max(1, Math.min(20, Math.round(Number(state.household_members || state.settings?.household_members || 4))));
  const scaled = scaleRecipe(recipe, householdMembers);
  const baseServings = scaled.base_servings;
  const scalingMultiplier = scaled.scaling_multiplier;

  const title = recipe.name || recipe.title || 'Curated Meal';
  const category = recipe.type || recipe.category || 'Mains';
  const tag = recipe.tag || recipe.clinicalBadge || 'Protocol Compliant';
  const interactions = getCachedRecipeInteraction(recipe.id);
  const isLiked = isRecipeLiked(recipe.id);
  const instructions = recipe.instructions || [
    'Prepare fresh ingredients according to dietary guidelines.',
    'Cook gently over medium heat until tender.',
    'Serve immediately with protocol-compliant sides.'
  ];
  const clinicalNote = recipe.clinicalRationale || recipe.clinicalNote || 'Specifically formulated to comply with the active dietary guidelines.';
  const rawImage = recipe.image || recipe.imageUrl || generatedImages?.[recipe.id] || null;
  const dishImgUrl = getRecipeImageUrl(rawImage);
  const fallbackUnsplash = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

  return `
    <article class="recipe-card" id="recipe-${recipe.id}">
      <div class="recipe-card-banner relative w-full h-32 rounded-t-xl overflow-hidden bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center select-none text-4xl -mx-[22px] -mt-[22px] mb-4">
        ${dishImgUrl ? `
          <img
            src="${escapeHtml(dishImgUrl)}"
            alt="${escapeHtml(title)}"
            loading="lazy"
            decoding="async"
            class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            onerror="if (!this.dataset.fallbackApplied) { this.dataset.fallbackApplied = 'true'; this.src='${fallbackUnsplash}'; } else { this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='inline-block'; }"
          />
          <span class="text-4xl filter drop-shadow-sm pointer-events-none" aria-hidden="true" style="display: none;">
            ${getCategoryIcon(category, title)}
          </span>
        ` : `
          <span class="text-4xl filter drop-shadow-sm pointer-events-none" aria-hidden="true">
            ${getCategoryIcon(category, title)}
          </span>
        `}
      </div>
      <div class="recipe-card-header">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
            ${escapeHtml(category)}
          </span>
          <div class="recipe-time-tag">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8;">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Prep: ${escapeHtml(recipe.prepTime)} • Cook: ${escapeHtml(recipe.cookTime)}</span>
          </div>
        </div>
        <h3 class="recipe-card-title">${escapeHtml(title)}</h3>
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <div class="recipe-clinical-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-600/50 dark:border-emerald-400/50 bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>${escapeHtml(tag)}</span>
          </div>
          <div class="recipe-servings-badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
            <span>👥</span>
            <span>${householdMembers === baseServings ? `Serves ${baseServings}` : `${baseServings} Base → ${householdMembers} Members`}</span>
          </div>
        </div>
      </div>

      <div class="recipe-card-body">
        <!-- Ingredients List & Dynamic Scaling Table -->
        <div class="recipe-card-section">
          <div class="recipe-section-heading flex justify-between items-center mb-2">
            <div class="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11l3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
              </svg>
              <span>Ingredients (${scaled.scaledIngredients.length})</span>
            </div>
            <span class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
              ${householdMembers === baseServings 
                ? `Base: ${baseServings} servings` 
                : `${baseServings} Base → ${householdMembers} Members (${scalingMultiplier.toFixed(2).replace(/\.00$/, '')}×)`
              }
            </span>
          </div>

          ${householdMembers === baseServings ? `
            <ul class="recipe-ingredients-list">
              ${scaled.scaledIngredients.map(ing => `<li>${escapeHtml(ing.scaledText)}</li>`).join('')}
            </ul>
          ` : `
            <div class="scaled-ingredients-summary text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              Original recipe: <strong>${baseServings} servings</strong> • Preparing for: <strong class="text-emerald-600 dark:text-emerald-400">${householdMembers} members</strong>
            </div>
            <div class="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800 my-2">
              <table class="w-full text-xs text-left border-collapse">
                <thead class="bg-slate-100/90 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th class="py-1.5 px-2.5">Ingredient</th>
                    <th class="py-1.5 px-2.5 text-right w-20">Original</th>
                    <th class="py-1.5 px-2.5 text-right w-24 text-emerald-600 dark:text-emerald-400 font-bold">Adjusted</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white/50 dark:bg-slate-900/50">
                  ${scaled.scaledIngredients.map(item => `
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td class="py-1.5 px-2.5 font-medium text-slate-800 dark:text-slate-200">${escapeHtml(item.displayName || item.name)}</td>
                      <td class="py-1.5 px-2.5 text-right text-slate-400 dark:text-slate-500 font-mono">${escapeHtml(item.originalQuantityText || '—')}</td>
                      <td class="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${escapeHtml(item.scaledQuantityText || item.scaledText)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
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
            ${instructions.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
          </ol>
        </div>

        <!-- Clinical Note Callout -->
        <div class="rounded-xl p-3.5 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/20 dark:border-emerald-500/30">
          <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-1">
            <span class="text-sm">🛡️</span> CLINICAL PROTOCOL RATIONALE
          </div>
          <p class="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
            ${escapeHtml(recipe.clinicalRationale || recipe.rationale || clinicalNote)}
          </p>
        </div>
      </div>

      <!-- Action Button & Interactions Bar -->
      <div class="recipe-card-footer">
        <div class="recipe-interactions-bar">
          <!-- Views Indicator -->
          <div class="interaction-pill view-pill" title="${interactions.views || 0} views" aria-label="${interactions.views || 0} views">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span class="interaction-count">${interactions.views || 0}</span>
          </div>

          <!-- Like Button -->
          <button 
            type="button"
            class="interaction-pill like-pill ${isLiked ? 'liked active' : ''}" 
            data-like-recipe-id="${recipe.id}" 
            title="${isLiked ? 'Unlike dish' : 'Like dish'}" 
            aria-label="${isLiked ? 'Unlike dish' : 'Like dish'}"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="${isLiked ? '#ef4444' : 'none'}" stroke="${isLiked ? '#ef4444' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <span class="interaction-count">${interactions.likes || 0}</span>
          </button>

          <!-- Comments Trigger -->
          <button 
            type="button"
            class="interaction-pill comment-pill" 
            data-comments-recipe-id="${recipe.id}" 
            title="Community compliance tips and reviews" 
            aria-label="Community compliance tips and reviews"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="interaction-count">${interactions.commentsCount || (interactions.comments?.length || 0)}</span>
          </button>
        </div>

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

export function renderRecipeCommentsDrawer(recipe, state = {}) {
  const interactions = getCachedRecipeInteraction(recipe.id);
  const comments = Array.isArray(interactions.comments) ? interactions.comments : [];
  const currentName = state.commentUserName || (typeof localStorage !== 'undefined' ? localStorage.getItem('kosherai_user_name') : '') || '';

  return `
    <div class="comments-drawer-overlay" id="comments-drawer-backdrop" data-close-comments-drawer="true">
      <div class="comments-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="comments-drawer-title">
        <!-- Drawer Header -->
        <div class="comments-drawer-header">
          <div style="min-width: 0;">
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                ${escapeHtml(recipe.category || recipe.type || 'Recipe')}
              </span>
              <span class="text-xs text-slate-500 dark:text-slate-400">
                Prep: ${escapeHtml(recipe.prepTime || '10m')} • Cook: ${escapeHtml(recipe.cookTime || '20m')}
              </span>
            </div>
            <h2 id="comments-drawer-title" class="text-lg font-black text-slate-900 dark:text-white truncate">
              ${escapeHtml(recipe.title || recipe.name)}
            </h2>
            <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>👁️ ${interactions.views || 0} views</span>
              <span>❤️ ${interactions.likes || 0} likes</span>
              <span>💬 ${comments.length} community tips</span>
            </div>
          </div>
          <button id="close-comments-drawer-btn" class="drawer-close-btn" aria-label="Close comments drawer">✕</button>
        </div>

        <!-- Scrollable Comments / Tips Feed -->
        <div class="comments-drawer-body">
          <div class="comments-section-title">
            <span>💬 Community Compliance Tips & Substitution Reviews:</span>
          </div>

          ${comments.length === 0 ? `
            <div class="comments-empty-state">
              <span class="text-3xl mb-2">🧑‍🍳</span>
              <p class="font-bold text-sm text-slate-800 dark:text-slate-200">No community tips posted yet!</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs text-center">
                Be the first to share your ingredient swap, cooking technique, or protocol substitution for this dish.
              </p>
            </div>
          ` : `
            <div class="comments-feed-list">
              ${comments.map(c => `
                <div class="comment-card" id="comment-${escapeHtml(c.id)}">
                  <div class="comment-card-header">
                    <div class="flex items-center gap-2">
                      <div class="comment-avatar">
                        ${escapeHtml((c.userName || 'C')[0].toUpperCase())}
                      </div>
                      <span class="comment-author">${escapeHtml(c.userName || 'Caregiver / Cook')}</span>
                    </div>
                    <span class="comment-date">
                      ${formatCommentDate(c.createdAt)}
                    </span>
                  </div>
                  <div class="comment-content">
                    ${escapeHtml(c.comment)}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Add Comment Form -->
        <div class="comments-drawer-footer">
          <form id="recipe-comment-form" data-recipe-id="${recipe.id}">
            <div class="mb-2">
              <label for="comment-author-input" class="sr-only">Your Name or Role</label>
              <input 
                type="text" 
                id="comment-author-input" 
                class="form-input text-xs w-full py-1.5 px-3 rounded-lg" 
                placeholder="Your name or role (e.g. Caregiver, Nurse, Home Cook)" 
                value="${escapeHtml(currentName)}"
              />
            </div>
            <div class="mb-2">
              <label for="comment-text-input" class="sr-only">Your Clinical Tip or Review</label>
              <textarea 
                id="comment-text-input" 
                class="form-input text-xs w-full py-2 px-3 rounded-lg resize-none" 
                rows="3" 
                placeholder="Share a clinical compliance tip, brand recommendation, or substitution (e.g. 'Used non-iodized kosher salt and pure coconut oil')..."
                required
              ></textarea>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-[11px] text-slate-500 dark:text-slate-400">
                🔒 Synced to Neon database & cached locally
              </span>
              <button 
                type="submit" 
                id="submit-comment-btn" 
                class="btn-primary" 
                style="padding: 7px 16px; font-size: 0.8rem;"
              >
                <span>Post Tip</span>
                <span class="ml-1">↗</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function formatCommentDate(dateString) {
  if (!dateString) return 'Recently';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return 'Recently';
  }
}

