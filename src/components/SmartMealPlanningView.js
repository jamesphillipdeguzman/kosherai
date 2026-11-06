/**
 * KosherAI - Smart Meal Planning & Inventory Interface Component (Phase 4)
 * Provides:
 * - FEFO Expiration Alerts Banner
 * - Smart Meal Recommendations (inventory-aware, scaled, dietary compliant)
 * - Weekly Meal Planner Calendar
 * - Smart Grocery List (inventory-subtracted deficit list with Phase 2 alerts)
 * - Household Inventory Manager (consume, discard, delete, storage location routing)
 * - Add/Edit Inventory Modal
 */

import {
  getInventoryItems,
  getExpirationStatus,
  prioritizeInventoryFEFO,
  getSmartMealRecommendations,
  generateSmartGroceryList,
  STORAGE_LOCATIONS,
  EXPIRATION_STATUS
} from '../services/inventoryService.js';
import { getMealPlans } from '../services/courseProjectStorage.js';
import { getHouseholdMembers } from '../services/storage.js';
import { getDietProfile } from '../data/dietProfiles.js';
import { FOOD_CATEGORIES } from '../services/overBuyingDetector.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Main Smart Meal Planning & Inventory View
 */
export function renderSmartMealPlanner(state = {}) {
  const selectedWeek = state.mealPlanWeek || 2;
  const plans = getMealPlans(selectedWeek);
  const activeDiet = state.activeDiet || 'lid';
  const dietProfile = getDietProfile(activeDiet);
  const householdMembers = state.householdMembers || getHouseholdMembers();

  const inventory = getInventoryItems();
  const prioritizedInventory = prioritizeInventoryFEFO(inventory);

  // Expiring items for FEFO Alert Banner
  const expiringItems = inventory.filter(item => {
    const status = getExpirationStatus(item).status;
    return status === EXPIRATION_STATUS.EXPIRING_SOON || status === EXPIRATION_STATUS.USE_SOON;
  });

  // Smart Meal Recommendations
  const recommendations = getSmartMealRecommendations({
    inventory,
    dietKey: activeDiet,
    householdMembers
  });

  // Smart Grocery List (Deficit ingredients for the active week's planned meals)
  const groceryList = generateSmartGroceryList({
    mealPlans: plans,
    inventory,
    householdMembers,
    dietKey: activeDiet
  });

  const daysOfWeek = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return `
    <div class="smart-meal-planner-container flex flex-col gap-6 w-full">
      
      <!-- Top Action Bar -->
      <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-1.5">
            <span>🥗</span> Smart Meal Planning & Inventory
          </div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Weekly Meal Planner & Inventory Optimization
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Plan dishes using on-hand groceries, prioritize expiring ingredients, and generate exact deficit shopping lists.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="open-inventory-modal-btn"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
          >
            <span>📦</span> Add Inventory
          </button>
          <button
            type="button"
            id="open-mealplan-modal-btn"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer"
          >
            <span>➕</span> Plan a Meal
          </button>
        </div>
      </div>

      <!-- FEFO Priority Expiration Banner (Section 3) -->
      ${expiringItems.length > 0 ? `
        <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div class="flex items-start sm:items-center gap-3">
            <span class="text-2xl select-none leading-none">⏳</span>
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Prioritize Soon: ${expiringItems.length} ${expiringItems.length === 1 ? 'Ingredient Approaching Expiration' : 'Ingredients Approaching Expiration'}
              </div>
              <div class="text-xs text-amber-800 dark:text-amber-200/90 mt-0.5">
                ${expiringItems.map(item => {
                  const status = getExpirationStatus(item);
                  return `<strong>${escapeHtml(item.itemName)}</strong> (${status.label} in ${item.storageLocation})`;
                }).join(' • ')}
              </div>
            </div>
          </div>
          <span class="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 whitespace-nowrap hidden md:inline-block">
            FEFO Active
          </span>
        </div>
      ` : ''}

      <!-- SECTION C: SMART MEAL RECOMMENDATIONS (Section 4) -->
      <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>🍲</span> Smart Meal Recommendations
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Ranked by on-hand inventory, expiring ingredient usage, and ${dietProfile.name} compliance (${householdMembers} servings).
            </p>
          </div>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            ${dietProfile.shortName} Vetted
          </span>
        </div>

        ${recommendations.length > 0 ? `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${recommendations.slice(0, 6).map(rec => {
              const isUrgent = rec.priorityRank === 1;
              const isFully = rec.availabilityStatus === 'fully_available';
              const isMostly = rec.availabilityStatus === 'mostly_available';

              const badgeColor = isFully
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : isMostly
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';

              const badgeLabel = isFully ? 'Fully Available (100%)' : (isMostly ? 'Mostly Available' : 'Needs Groceries');

              return `
                <div class="p-4 rounded-xl border ${
                  isUrgent
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800'
                } flex flex-col justify-between gap-3 transition-all hover:shadow-xs">
                  
                  <div class="flex flex-col gap-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}">
                        ${badgeLabel}
                      </span>
                      <span class="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        ${rec.servings} Servings
                      </span>
                    </div>

                    <div class="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                      ${escapeHtml(rec.recipe.name || rec.recipe.title)}
                    </div>

                    ${isUrgent ? `
                      <div class="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <span>⚡</span> <span>${escapeHtml(rec.recommendationReason)}</span>
                      </div>
                    ` : `
                      <div class="text-[11px] text-slate-500 dark:text-slate-400">
                        ${escapeHtml(rec.recommendationReason)}
                      </div>
                    `}

                    <!-- Available vs Missing Breakdown -->
                    <div class="flex flex-col gap-1 mt-1 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        On-Hand (${rec.availableCount}/${rec.totalIngredientsCount})
                      </div>
                      <div class="flex flex-wrap gap-1">
                        ${rec.availableItems.map(item => `
                          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                            ✓ ${escapeHtml(item.name)}
                          </span>
                        `).join('')}
                        ${rec.missingItems.slice(0, 2).map(item => `
                          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/20">
                            + ${escapeHtml(item.name)}
                          </span>
                        `).join('')}
                      </div>
                    </div>
                  </div>

                  <!-- Quick Add Button -->
                  <button
                    type="button"
                    class="quick-add-recipe-to-plan-btn mt-2 w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-all cursor-pointer"
                    data-recipe-title="${escapeHtml(rec.recipe.name || rec.recipe.title)}"
                  >
                    <span>➕</span> Add to Meal Plan
                  </button>

                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="p-6 text-center text-xs text-slate-400">
            No recipes matching active inventory yet.
          </div>
        `}
      </div>

      <!-- SECTION D: WEEKLY MEAL PLANNER CALENDAR -->
      <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>📅</span> Weekly Meal Schedule
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Household planned meals for Week ${selectedWeek}.
            </p>
          </div>

          <!-- Week Selector Pills -->
          <div class="inline-flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-xl shadow-2xs overflow-x-auto max-w-full">
            ${[2, 3, 4, 5, 6].map((weekNum) => {
              const isActive = selectedWeek === weekNum;
              const label = weekNum === 2 ? 'Week 2 (Intervene)' : `Week ${weekNum}`;
              return `
                <button
                  type="button"
                  data-mealplan-week="${weekNum}"
                  class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white'
                  }"
                >
                  ${label}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 7-Day Calendar Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          ${daysOfWeek.map(day => {
            const dayPlans = plans.filter(p => p.dayOfWeek === day);
            return `
              <div class="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-2 min-h-[140px]">
                <div class="text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200/60 dark:border-slate-800 pb-1.5">
                  ${day.slice(0, 3)}
                </div>
                <div class="flex flex-col gap-2 flex-1">
                  ${dayPlans.length === 0 ? `
                    <div class="text-[11px] text-slate-400 italic py-4 text-center">Empty</div>
                  ` : `
                    ${dayPlans.map(p => `
                      <div class="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 shadow-2xs flex flex-col gap-1">
                        <span class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          ${p.mealType}
                        </span>
                        <span class="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                          ${escapeHtml(p.dishName)}
                        </span>
                        <button
                          type="button"
                          class="delete-meal-btn text-[10px] font-medium text-rose-500 hover:text-rose-600 self-start mt-1 cursor-pointer"
                          data-delete-meal="${p.id}"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    `).join('')}
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- SECTION E: SMART GROCERY LIST (INVENTORY-AWARE) -->
      <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>🛒</span> Smart Grocery List (Deficit Groceries Needed)
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Only missing ingredients required for Week ${selectedWeek}'s planned meals after subtracting available inventory.
            </p>
          </div>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            ${groceryList.avoidedPurchasesCount} In-Stock Items Avoided
          </span>
        </div>

        <!-- Over-Buying Advisory Warnings if detected -->
        ${groceryList.overBuyingWarnings.length > 0 ? `
          <div class="flex flex-col gap-2">
            ${groceryList.overBuyingWarnings.map(w => `
              <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                <span class="text-base select-none">⚠️</span>
                <span><strong>Over-Buying Notice (${w.category}):</strong> ${escapeHtml(w.reason)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${groceryList.hasItemsToBuy ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            ${groceryList.itemsToBuy.map(item => `
              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(item.name)}</span>
                  <span class="text-[10px] text-slate-400">${item.category} • For: ${item.plannedMeals.join(', ')}</span>
                </div>
                <div class="text-right">
                  <span class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ${item.quantity} ${item.unit}
                  </span>
                  ${item.inventoryOnHand > 0 ? `
                    <span class="block text-[10px] text-slate-400">(${item.inventoryOnHand} on hand)</span>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
            <span class="text-base select-none">🎉</span>
            <span>All planned meals for Week ${selectedWeek} are completely fulfilled by your current household inventory! Zero extra groceries needed.</span>
          </div>
        `}
      </div>

      <!-- SECTION A: HOUSEHOLD INVENTORY MANAGER -->
      <div class="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>📦</span> Household Inventory & FEFO Radar
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Track remaining quantities, storage locations, and expiration dates.
            </p>
          </div>
          <span class="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
            ${prioritizedInventory.length} Total Items
          </span>
        </div>

        ${prioritizedInventory.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th class="py-2.5 px-3">Item Name</th>
                  <th class="py-2.5 px-3">Remaining Qty</th>
                  <th class="py-2.5 px-3">Storage Location</th>
                  <th class="py-2.5 px-3">Expiration Status</th>
                  <th class="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                ${prioritizedInventory.map(item => {
                  const status = getExpirationStatus(item);
                  return `
                    <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td class="py-2.5 px-3">
                        <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(item.itemName)}</div>
                        <div class="text-[10px] text-slate-400">${item.category}</div>
                      </td>
                      <td class="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-200">
                        ${item.quantity} ${item.unit}
                      </td>
                      <td class="py-2.5 px-3">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          ${item.storageLocation}
                        </span>
                      </td>
                      <td class="py-2.5 px-3">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.badgeColor}">
                          ${status.label}
                        </span>
                      </td>
                      <td class="py-2.5 px-3 text-right">
                        <div class="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            class="consume-inventory-btn px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 text-[11px] font-medium transition-all cursor-pointer"
                            data-inv-id="${item.id}"
                            title="Consume 1 unit / portion"
                          >
                            🍽️ Consume
                          </button>
                          <button
                            type="button"
                            class="discard-inventory-btn px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 text-[11px] font-medium transition-all cursor-pointer"
                            data-inv-id="${item.id}"
                            title="Record as food waste"
                          >
                            🗑️ Discard
                          </button>
                          <button
                            type="button"
                            class="delete-inventory-btn p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            data-inv-id="${item.id}"
                            title="Delete item"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="p-6 text-center text-xs text-slate-400">
            No items in inventory. Scan a receipt or use "Add Inventory" above to track on-hand groceries.
          </div>
        `}
      </div>

    </div>
  `;
}

/**
 * Add / Edit Inventory Modal Component
 */
export function renderInventoryModal(state = {}) {
  return `
    <div class="modal-overlay" id="inventory-modal-overlay">
      <div class="modal-content" role="dialog" aria-modal="true" style="max-width: 480px;">
        <div class="modal-header">
          <h2 class="modal-title font-bold text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span>📦</span> Add Household Inventory Item
          </h2>
          <button type="button" class="btn-icon cursor-pointer" id="close-inventory-modal-btn">✕</button>
        </div>

        <form id="inventory-form" class="flex flex-col gap-3.5 mt-2">
          <div class="form-group">
            <label class="form-label text-xs font-semibold text-slate-700 dark:text-slate-200" for="inv-name">
              Ingredient / Item Name
            </label>
            <input
              type="text"
              id="inv-name"
              class="form-input text-xs"
              placeholder="e.g. Sayote, Chicken Breast, Carrots"
              required
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
              <label class="form-label text-xs font-semibold text-slate-700 dark:text-slate-200" for="inv-qty">
                Quantity
              </label>
              <input
                type="number"
                id="inv-qty"
                class="form-input text-xs"
                step="any"
                min="0.1"
                value="1"
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label text-xs font-semibold text-slate-700 dark:text-slate-200" for="inv-unit">
                Unit
              </label>
              <select id="inv-unit" class="form-input text-xs">
                <option value="pcs">pcs (pieces)</option>
                <option value="kg">kg (kilograms)</option>
                <option value="g">g (grams)</option>
                <option value="pack">pack</option>
                <option value="head">head</option>
                <option value="cloves">cloves</option>
                <option value="can">can</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
              <label class="form-label text-xs font-semibold text-slate-700 dark:text-slate-200" for="inv-location">
                Storage Location
              </label>
              <select id="inv-location" class="form-input text-xs">
                <option value="${STORAGE_LOCATIONS.REFRIGERATOR}">${STORAGE_LOCATIONS.REFRIGERATOR}</option>
                <option value="${STORAGE_LOCATIONS.FREEZER}">${STORAGE_LOCATIONS.FREEZER}</option>
                <option value="${STORAGE_LOCATIONS.PANTRY}">${STORAGE_LOCATIONS.PANTRY}</option>
                <option value="${STORAGE_LOCATIONS.OTHER}">${STORAGE_LOCATIONS.OTHER}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label text-xs font-semibold text-slate-700 dark:text-slate-200" for="inv-expiration">
                Expiration / Best-Before
              </label>
              <input
                type="date"
                id="inv-expiration"
                class="form-input text-xs"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label text-xs font-semibold text-slate-700 dark:text-slate-200" for="inv-notes">
              Notes (Optional)
            </label>
            <input
              type="text"
              id="inv-notes"
              class="form-input text-xs"
              placeholder="e.g. In crisper drawer, bought on sale"
            />
          </div>

          <div class="modal-footer-actions flex items-center justify-end gap-2 mt-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" class="btn-secondary text-xs cursor-pointer" id="cancel-inventory-modal-btn">
              Cancel
            </button>
            <button type="submit" class="btn-primary text-xs cursor-pointer">
              Save to Inventory
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

