/**
 * KosherAI - Household Inventory & Smart Meal Planning Service (Phase 4)
 * Provides practical inventory tracking, First-Expire First-Out (FEFO) ingredient prioritization,
 * smart dietary-compliant meal recommendations, and inventory-aware grocery list generation.
 *
 * Integrates directly with:
 * - Phase 1: Dynamic household portion scaling (recipeScaler.js)
 * - Phase 2: Grocery over-buying detection (overBuyingDetector.js)
 * - Phase 3: Household Grocery Insights (householdInsightsService.js)
 */

import { scaleRecipe } from './recipeScaler.js';
import { getHouseholdMembers } from './storage.js';
import {
  FOOD_CATEGORIES,
  resolveFoodCategory,
  standardizeWeightToKg,
  detectOverBuying
} from './overBuyingDetector.js';
import { DIET_RECIPES } from '../data/dietRecipes.js';
import { saveFoodWasteRecord, getGroceryItems, getFoodWasteRecords, formatDateYMD } from './courseProjectStorage.js';
import { getAuthHeaders } from './authHeaders.js';

export const STORAGE_LOCATIONS = {
  REFRIGERATOR: 'Refrigerator',
  FREEZER: 'Freezer',
  PANTRY: 'Pantry',
  OTHER: 'Other'
};

export const EXPIRATION_STATUS = {
  EXPIRED: 'expired',
  EXPIRING_SOON: 'expiring_soon',
  USE_SOON: 'use_soon',
  FRESH: 'fresh',
  NO_DATE: 'no_date'
};

const INVENTORY_STORAGE_KEY = 'kosherai_inventory';

/**
 * Normalizes an ingredient name for reliable matching
 */
export function normalizeIngredientName(name = '') {
  return String(name || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // remove parentheticals
    .replace(/^\s*\d+[\d\s\/\.\-¼½¾⅓⅔⅛⅜⅝⅞]*\s*/, '') // remove leading quantity numbers & fractions
    .replace(/^(g|grams?|kg|kgs|kilo|kilos|ml|l|liters?|cups?|tbsp|tsp|pieces?|pcs?|heads?|cloves?|lbs?|pounds?|oz)\b/i, '') // remove leading unit words
    .replace(/[^a-z0-9\s]/g, ' ') // remove punctuation
    .replace(/\b(fresh|raw|cooked|skinless|boneless|diced|sliced|minced|chopped|pure|native|day old|cloves|pieces|stalks|chunks)\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Checks if an inventory item matches a recipe ingredient
 */
export function isIngredientMatch(inventoryItemName = '', recipeIngredientText = '') {
  const invNorm = normalizeIngredientName(inventoryItemName);
  const recNorm = normalizeIngredientName(recipeIngredientText);

  if (!invNorm || !recNorm) return false;

  // Exact or direct substring match
  if (invNorm === recNorm || recNorm.includes(invNorm) || invNorm.includes(recNorm)) {
    return true;
  }

  // Token word-level intersection (e.g. "chicken breast" and "chicken")
  const invTokens = invNorm.split(' ').filter(t => t.length > 2);
  const recTokens = recNorm.split(' ').filter(t => t.length > 2);

  for (const token of invTokens) {
    if (recTokens.includes(token)) return true;
  }

  return false;
}

/**
 * Computes expiration classification and days remaining
 *
 * @param {Object} item - Inventory item
 * @param {Date|string} [refDate] - Reference date (defaults to now)
 */
export function getExpirationStatus(item, refDate = new Date()) {
  if (!item || !item.expirationDate) {
    return {
      status: EXPIRATION_STATUS.NO_DATE,
      label: 'No Expiration Date',
      daysRemaining: null,
      badgeColor: 'text-slate-400 bg-slate-500/10 border-slate-500/20'
    };
  }

  const ref = typeof refDate === 'string' ? new Date(`${refDate}T00:00:00`) : new Date(refDate);
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());

  const expParts = String(item.expirationDate).split('T')[0].split('-').map(Number);
  const expDate = new Date(expParts[0], expParts[1] - 1, expParts[2]);

  if (isNaN(expDate.getTime())) {
    return {
      status: EXPIRATION_STATUS.NO_DATE,
      label: 'Invalid Date',
      daysRemaining: null,
      badgeColor: 'text-slate-400 bg-slate-500/10 border-slate-500/20'
    };
  }

  const diffMs = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: EXPIRATION_STATUS.EXPIRED,
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      daysRemaining: diffDays,
      badgeColor: 'text-rose-500 bg-rose-500/15 border-rose-500/30'
    };
  }

  if (diffDays <= 3) {
    return {
      status: EXPIRATION_STATUS.EXPIRING_SOON,
      label: diffDays === 0 ? 'Expires Today' : `Expiring in ${diffDays}d`,
      daysRemaining: diffDays,
      badgeColor: 'text-amber-500 bg-amber-500/15 border-amber-500/30'
    };
  }

  if (diffDays <= 7) {
    return {
      status: EXPIRATION_STATUS.USE_SOON,
      label: `Use Soon (${diffDays}d left)`,
      daysRemaining: diffDays,
      badgeColor: 'text-cyan-500 bg-cyan-500/15 border-cyan-500/30'
    };
  }

  return {
    status: EXPIRATION_STATUS.FRESH,
    label: `Fresh (${diffDays}d left)`,
    daysRemaining: diffDays,
    badgeColor: 'text-emerald-500 bg-emerald-500/15 border-emerald-500/30'
  };
}

/**
 * Sorts inventory items using First-Expire, First-Out (FEFO) logic.
 * Earliest expiration date is prioritized first.
 * For items without expiration dates, older purchase dates are prioritized.
 */
export function prioritizeInventoryFEFO(items = [], refDate = new Date()) {
  return [...items].sort((a, b) => {
    const statusA = getExpirationStatus(a, refDate);
    const statusB = getExpirationStatus(b, refDate);

    // 1. Both have expiration dates
    if (a.expirationDate && b.expirationDate) {
      return a.expirationDate.localeCompare(b.expirationDate);
    }

    // 2. One has expiration date, one does not (expiring items go first)
    if (a.expirationDate && !b.expirationDate) return -1;
    if (!a.expirationDate && b.expirationDate) return 1;

    // 3. Neither has expiration date: order by purchase date (older purchase first)
    const dateA = a.purchaseDate || '9999-12-31';
    const dateB = b.purchaseDate || '9999-12-31';
    return dateA.localeCompare(dateB);
  });
}

// =========================================================================
// INVENTORY CRUD OPERATIONS
// =========================================================================

export function getInventoryItems() {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[Inventory] Failed to read inventory from localStorage:', e);
    return [];
  }
}

export function saveInventoryItem(itemData = {}) {
  try {
    const items = getInventoryItems();
    const id = itemData.id || `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const todayStr = formatDateYMD(new Date());

    const quantity = Math.max(0, Number(itemData.quantity ?? 1));
    const originalQuantity = Math.max(quantity, Number(itemData.originalQuantity ?? quantity));
    const consumedQuantity = Math.max(0, Number(itemData.consumedQuantity ?? 0));
    const wastedQuantity = Math.max(0, Number(itemData.wastedQuantity ?? 0));

    const itemName = String(itemData.itemName || itemData.name || 'Grocery Item').trim();
    const category = itemData.category || resolveFoodCategory(itemName);

    const record = {
      id,
      itemName,
      category,
      quantity,
      originalQuantity,
      consumedQuantity,
      wastedQuantity,
      unit: itemData.unit || 'pcs',
      purchaseDate: itemData.purchaseDate || todayStr,
      expirationDate: itemData.expirationDate || null,
      storageLocation: itemData.storageLocation || STORAGE_LOCATIONS.REFRIGERATOR,
      source: itemData.source || 'manual',
      tripId: itemData.tripId || null,
      notes: itemData.notes || '',
      createdAt: itemData.createdAt || nowIso,
      updatedAt: nowIso
    };

    const updated = [record, ...items.filter(i => i.id !== id)];
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(updated));

    if (typeof fetch === 'function' && typeof navigator !== 'undefined' && navigator.onLine) {
      fetch('/api/inventory', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ item: record })
      }).then(res => {
        if (res.ok) {
          record.synced = true;
          const cur = getInventoryItems().map(i => i.id === id ? { ...i, synced: true } : i);
          localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(cur));
        }
      }).catch(() => {});
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kosherai_inventory_updated'));
      window.dispatchEvent(new Event('kosherai_storage_updated'));
    }

    return record;
  } catch (e) {
    console.error('[Inventory] Failed to save inventory item:', e);
    throw e;
  }
}

/**
 * Marks an ingredient as consumed.
 * Decreases remaining quantity, increases consumedQuantity.
 * Never drops below 0 and never alters historical purchase records.
 */
export function consumeInventoryItem(id, quantityToConsume = 1) {
  try {
    const items = getInventoryItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return null;

    const current = items[index];
    const qtyToSubtract = Math.min(current.quantity, Math.max(0, Number(quantityToConsume)));
    const newQty = Number((current.quantity - qtyToSubtract).toFixed(3));
    const newConsumed = Number(((current.consumedQuantity || 0) + qtyToSubtract).toFixed(3));

    const updatedItem = {
      ...current,
      quantity: newQty,
      consumedQuantity: newConsumed,
      updatedAt: new Date().toISOString()
    };

    items[index] = updatedItem;
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kosherai_inventory_updated'));
      window.dispatchEvent(new Event('kosherai_storage_updated'));
    }

    return updatedItem;
  } catch (e) {
    console.error('[Inventory] Failed to consume inventory item:', e);
    throw e;
  }
}

/**
 * Marks an ingredient as wasted or discarded.
 * Updates inventory and logs corresponding record in food_waste_logs.
 */
export function discardInventoryItem(id, quantityToDiscard = 1, reason = 'Spoiled / Molded') {
  try {
    const items = getInventoryItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return null;

    const current = items[index];
    const qtyToSubtract = Math.min(current.quantity, Math.max(0, Number(quantityToDiscard)));
    const newQty = Number((current.quantity - qtyToSubtract).toFixed(3));
    const newWasted = Number(((current.wastedQuantity || 0) + qtyToSubtract).toFixed(3));

    const updatedItem = {
      ...current,
      quantity: newQty,
      wastedQuantity: newWasted,
      updatedAt: new Date().toISOString()
    };

    items[index] = updatedItem;
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));

    // Determine weight in grams for food waste log
    let measuredWeightG = 0;
    const cleanUnit = String(current.unit || '').toLowerCase();
    if (cleanUnit === 'g' || cleanUnit === 'gram' || cleanUnit === 'grams') {
      measuredWeightG = qtyToSubtract;
    } else if (cleanUnit === 'kg' || cleanUnit === 'kilo') {
      measuredWeightG = qtyToSubtract * 1000;
    } else {
      // Rough estimate for pieces (e.g. 100g per piece)
      measuredWeightG = qtyToSubtract * 100;
    }

    // Persist into food waste logs
    saveFoodWasteRecord({
      itemName: current.itemName,
      measuredWeightG,
      isEstimated: true,
      category: current.category,
      reason,
      notes: `Discarded from inventory (${current.storageLocation})`
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kosherai_inventory_updated'));
      window.dispatchEvent(new Event('kosherai_storage_updated'));
    }

    return updatedItem;
  } catch (e) {
    console.error('[Inventory] Failed to discard inventory item:', e);
    throw e;
  }
}

export function deleteInventoryItem(id) {
  try {
    const items = getInventoryItems().filter(i => i.id !== id);
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));

    if (typeof fetch === 'function' && typeof navigator !== 'undefined' && navigator.onLine) {
      fetch(`/api/inventory?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      }).catch(() => {});
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kosherai_inventory_updated'));
      window.dispatchEvent(new Event('kosherai_storage_updated'));
    }

    return true;
  } catch (e) {
    console.error('[Inventory] Failed to delete inventory item:', e);
    return false;
  }
}

/**
 * Converts scanned receipt items into household inventory records.
 * Avoids duplicate additions for the same receipt / item.
 */
export function syncReceiptItemsToInventory(trip, items = []) {
  if (!trip || !Array.isArray(items) || items.length === 0) return [];

  const existingInventory = getInventoryItems();
  const existingIds = new Set(existingInventory.map(i => i.id));
  const newRecords = [];

  for (const item of items) {
    const invId = `inv_receipt_${item.id || `${trip.id}_${Math.random().toString(36).slice(2, 6)}`}`;
    if (existingIds.has(invId)) continue;

    const cat = item.category || resolveFoodCategory(item.name || item.itemName);
    let storageLocation = STORAGE_LOCATIONS.REFRIGERATOR;
    if (cat === FOOD_CATEGORIES.MEAT || cat === FOOD_CATEGORIES.SEAFOOD) {
      storageLocation = STORAGE_LOCATIONS.FREEZER;
    } else if (cat === FOOD_CATEGORIES.PANTRY) {
      storageLocation = STORAGE_LOCATIONS.PANTRY;
    }

    const record = {
      id: invId,
      itemName: item.name || item.itemName || 'Grocery Item',
      category: cat,
      quantity: Number(item.quantity || item.qty || 1),
      originalQuantity: Number(item.quantity || item.qty || 1),
      consumedQuantity: 0,
      wastedQuantity: 0,
      unit: item.unit || 'pcs',
      purchaseDate: trip.date || formatDateYMD(new Date()),
      expirationDate: null,
      storageLocation,
      source: 'receipt',
      tripId: trip.id,
      notes: `Purchased from ${trip.storeName || 'Supermarket'}`
    };

    saveInventoryItem(record);
    newRecords.push(record);
  }

  return newRecords;
}

// =========================================================================
// SMART MEAL RECOMMENDATIONS ENGINE
// =========================================================================

/**
 * Compares recipe ingredients against available inventory, computes missing ingredients,
 * checks expiration priorities, applies Phase 1 household scaling, and enforces active dietary compliance.
 *
 * @param {Object} options
 * @param {Array} [options.inventory] - Available inventory items
 * @param {string} [options.dietKey] - Active dietary protocol ('lid', 'diabetic', 'low_purine', 'low_sodium', 'pinoy_keto')
 * @param {number} [options.householdMembers] - Number of members for Phase 1 scaling
 * @param {Array} [options.recipes] - Optional custom recipes array
 */
export function getSmartMealRecommendations(options = {}) {
  const {
    inventory = getInventoryItems(),
    dietKey = 'lid',
    householdMembers = getHouseholdMembers(),
    recipes = null,
    refDate = new Date()
  } = options;

  // Active inventory only (quantity > 0)
  const activeInventory = inventory.filter(i => Number(i.quantity || 0) > 0);

  // 1. Dietary Protocol Enforcement (Section 5)
  // Recipes must strictly belong to the active protocol collection
  const candidateRecipes = recipes || (DIET_RECIPES[dietKey]?.meals || DIET_RECIPES.lid?.meals || []);

  const recommendations = [];

  for (const rawRecipe of candidateRecipes) {
    // 2. Phase 1 Household Portion Scaling
    const scaledRecipe = scaleRecipe(rawRecipe, householdMembers);
    if (!scaledRecipe) continue;

    const scaledIngredients = scaledRecipe.scaledIngredients || [];
    const totalIngredientsCount = scaledIngredients.length;

    let availableCount = 0;
    let usesExpiringSoon = false;
    let usesUseSoon = false;
    const availableItems = [];
    const missingItems = [];
    const expiringReasons = [];

    for (const ing of scaledIngredients) {
      const requiredQty = ing.scaledQty || 1;
      const ingUnit = String(ing.unit || '').toLowerCase();
      const ingText = ing.name || ing.displayName || ing.ingredient || ing.scaledText;

      // Find matching item in inventory
      const matchedInventory = activeInventory.find(inv => isIngredientMatch(inv.itemName, ingText));

      if (matchedInventory && matchedInventory.quantity > 0) {
        availableCount++;
        const expStatus = getExpirationStatus(matchedInventory, refDate);

        if (expStatus.status === EXPIRATION_STATUS.EXPIRING_SOON) {
          usesExpiringSoon = true;
          expiringReasons.push(`${matchedInventory.itemName} (${expStatus.label})`);
        } else if (expStatus.status === EXPIRATION_STATUS.USE_SOON) {
          usesUseSoon = true;
          expiringReasons.push(`${matchedInventory.itemName} (${expStatus.label})`);
        }

        availableItems.push({
          name: matchedInventory.itemName,
          required: `${requiredQty} ${ing.unit || ''}`.trim(),
          onHand: `${matchedInventory.quantity} ${matchedInventory.unit}`,
          storageLocation: matchedInventory.storageLocation,
          expirationStatus: expStatus
        });
      } else {
        missingItems.push({
          name: ing.ingredient || ing.scaledText,
          requiredQty,
          unit: ing.unit || 'pcs',
          displayText: ing.scaledText
        });
      }
    }

    const matchRatio = totalIngredientsCount > 0 ? (availableCount / totalIngredientsCount) : 0;

    let availabilityStatus = 'requires_groceries';
    if (availableCount === totalIngredientsCount && totalIngredientsCount > 0) {
      availabilityStatus = 'fully_available';
    } else if (matchRatio >= 0.6 || missingItems.length <= 1) {
      availabilityStatus = 'mostly_available';
    }

    // Recommendation Priority Ranking:
    // Priority 1: Uses expiring ingredients (urgent food waste prevention)
    // Priority 2: Fully available
    // Priority 3: Mostly available
    // Priority 4: Requires groceries
    let priorityRank = 4;
    let recommendationReason = '';

    if (usesExpiringSoon) {
      priorityRank = 1;
      recommendationReason = `Prioritizes on-hand ingredients approaching expiration: ${expiringReasons.join(', ')}.`;
    } else if (usesUseSoon) {
      priorityRank = 1;
      recommendationReason = `Helps consume ingredients with upcoming best-before dates: ${expiringReasons.join(', ')}.`;
    } else if (availabilityStatus === 'fully_available') {
      priorityRank = 2;
      recommendationReason = 'All ingredients currently available in your refrigerator and pantry.';
    } else if (availabilityStatus === 'mostly_available') {
      priorityRank = 3;
      recommendationReason = `Uses mostly on-hand ingredients (${availableCount}/${totalIngredientsCount}). Requires only ${missingItems.length} additional item.`;
    } else {
      priorityRank = 4;
      recommendationReason = `Requires purchasing ${missingItems.length} additional grocery items.`;
    }

    recommendations.push({
      recipe: scaledRecipe,
      dietKey,
      householdMembers,
      servings: scaledRecipe.householdMembers,
      availabilityStatus,
      availableCount,
      totalIngredientsCount,
      matchRatio: Number(matchRatio.toFixed(2)),
      priorityRank,
      usesExpiringIngredients: usesExpiringSoon || usesUseSoon,
      recommendationReason,
      availableItems,
      missingItems
    });
  }

  // Sort: Priority 1 first, then higher match ratio
  recommendations.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    return b.matchRatio - a.matchRatio;
  });

  return recommendations;
}

// =========================================================================
// SMART GROCERY LIST GENERATOR
// =========================================================================

/**
 * Generates an optimized grocery list for planned meals by subtracting existing household inventory.
 * Uses formula: quantity_to_purchase = max(0, total_required_quantity - available_inventory_quantity)
 *
 * @param {Object} options
 * @param {Array} [options.mealPlans] - Array of meal plan records
 * @param {Array} [options.inventory] - Available inventory items
 * @param {number} [options.householdMembers] - Household size
 * @param {string} [options.dietKey] - Active dietary protocol
 */
export function generateSmartGroceryList(options = {}) {
  const {
    mealPlans = [],
    inventory = getInventoryItems(),
    householdMembers = getHouseholdMembers(),
    dietKey = 'lid'
  } = options;

  if (!Array.isArray(mealPlans) || mealPlans.length === 0) {
    return {
      itemsToBuy: [],
      itemsInStock: [],
      overBuyingWarnings: [],
      hasItemsToBuy: false
    };
  }

  const activeInventory = inventory.filter(i => Number(i.quantity || 0) > 0);
  const candidateRecipes = DIET_RECIPES[dietKey]?.meals || DIET_RECIPES.lid?.meals || [];

  // 1. Aggregate required ingredients across all planned meals
  const aggregatedRequirements = new Map();

  for (const plan of mealPlans) {
    const dishName = plan.dishName;
    const candidateRecipe = candidateRecipes.find(r => (r.name || r.title) === dishName);
    const ingredients = (Array.isArray(plan.ingredientsNeeded) && plan.ingredientsNeeded.length > 0)
      ? plan.ingredientsNeeded
      : (candidateRecipe?.ingredients || []);

    const recipe = {
      ...(candidateRecipe || {}),
      name: dishName,
      ingredients
    };

    const scaled = scaleRecipe(recipe, householdMembers);
    const scaledIngredients = scaled?.scaledIngredients || [];

    for (const ing of scaledIngredients) {
      const ingredientRawName = ing.name || ing.displayName || ing.ingredient || ing.scaledText;
      const normName = normalizeIngredientName(ingredientRawName);
      if (!normName) continue;

      const unit = String(ing.unit || 'pcs').toLowerCase();
      const qty = Number(ing.scaledQty || 1);
      const cat = resolveFoodCategory(normName);

      const key = `${normName}_${unit}`;
      if (!aggregatedRequirements.has(key)) {
        aggregatedRequirements.set(key, {
          key,
          rawName: ingredientRawName,
          normalizedName: normName,
          category: cat,
          totalRequired: 0,
          unit: ing.unit || 'pcs',
          plannedMeals: []
        });
      }

      const entry = aggregatedRequirements.get(key);
      entry.totalRequired += qty;
      if (!entry.plannedMeals.includes(dishName)) {
        entry.plannedMeals.push(dishName);
      }
    }
  }

  // 2. Subtract available household inventory
  const itemsToBuy = [];
  const itemsInStock = [];

  for (const req of aggregatedRequirements.values()) {
    req.totalRequired = Number(req.totalRequired.toFixed(2));

    // Find all matching inventory items
    const matches = activeInventory.filter(inv => isIngredientMatch(inv.itemName, req.normalizedName));
    let availableOnHand = 0;

    for (const match of matches) {
      const matchUnit = String(match.unit || '').toLowerCase();
      const reqUnit = String(req.unit || '').toLowerCase();

      // Normalize compatible weight units (kg, g, lb)
      if ((matchUnit === 'g' || matchUnit === 'gram' || matchUnit === 'grams') && (reqUnit === 'kg' || reqUnit === 'kilo')) {
        availableOnHand += match.quantity / 1000;
      } else if ((matchUnit === 'kg' || matchUnit === 'kilo') && (reqUnit === 'g' || reqUnit === 'gram' || reqUnit === 'grams')) {
        availableOnHand += match.quantity * 1000;
      } else if ((matchUnit === 'lb' || matchUnit === 'lbs') && (reqUnit === 'g' || reqUnit === 'gram' || reqUnit === 'grams')) {
        availableOnHand += match.quantity * 453.592;
      } else if ((matchUnit === 'g' || matchUnit === 'gram' || matchUnit === 'grams') && (reqUnit === 'lb' || reqUnit === 'lbs')) {
        availableOnHand += match.quantity / 453.592;
      } else if ((matchUnit === 'lb' || matchUnit === 'lbs') && (reqUnit === 'kg' || reqUnit === 'kilo')) {
        availableOnHand += match.quantity * 0.453592;
      } else if ((matchUnit === 'kg' || matchUnit === 'kilo') && (reqUnit === 'lb' || reqUnit === 'lbs')) {
        availableOnHand += match.quantity / 0.453592;
      } else if (matchUnit === reqUnit || (!matchUnit && !reqUnit)) {
        availableOnHand += match.quantity;
      } else {
        availableOnHand += match.quantity;
      }
    }

    availableOnHand = Number(availableOnHand.toFixed(2));
    const deficit = Math.max(0, Number((req.totalRequired - availableOnHand).toFixed(2)));

    if (deficit > 0) {
      itemsToBuy.push({
        name: req.rawName,
        category: req.category,
        quantity: deficit,
        unit: req.unit,
        totalRequired: req.totalRequired,
        inventoryOnHand: availableOnHand,
        plannedMeals: req.plannedMeals
      });
    } else {
      itemsInStock.push({
        name: req.rawName,
        category: req.category,
        totalRequired: req.totalRequired,
        inventoryOnHand: availableOnHand,
        unit: req.unit,
        plannedMeals: req.plannedMeals
      });
    }
  }

  // 3. Integrate Phase 2 Over-Buying Warnings
  const purchases = options.purchases || getGroceryItems();
  const wasteRecords = options.wasteRecords || getFoodWasteRecords();
  const overBuyingAnalysis = detectOverBuying(itemsToBuy, {
    purchases,
    wasteRecords,
    householdMembers
  });

  return {
    itemsToBuy,
    itemsInStock,
    overBuyingWarnings: overBuyingAnalysis.warnings || [],
    hasItemsToBuy: itemsToBuy.length > 0,
    avoidedPurchasesCount: itemsInStock.length
  };
}
