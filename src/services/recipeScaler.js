/**
 * KosherAI - Dynamic Household Portion Scaling Service
 * Dynamically scales recipe ingredient quantities based on household members.
 * Preserves original recipe data, handles culinary rounding rules, and maintains dietary compliance.
 */

const VULGAR_FRACTIONS = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875
};

// Known measurement units and their classification
const UNITS_MAP = [
  // Grams
  { regex: /^(g|grams?)\b/i, category: 'grams', standard: 'g' },
  // Kilograms
  { regex: /^(kg|kgs|kilograms?)\b/i, category: 'kilograms', standard: 'kg' },
  // Milliliters
  { regex: /^(ml|milliliters?|millilitres?)\b/i, category: 'milliliters', standard: 'ml' },
  // Liters
  { regex: /^(liters?|litres?|l)\b/i, category: 'liters', standard: 'liters' },
  // Cups
  { regex: /^(cups?)\b/i, category: 'cups', standard: 'cups' },
  // Tablespoons
  { regex: /^(tbsp|tbs|tablespoons?)\b/i, category: 'tablespoons', standard: 'tbsp' },
  // Teaspoons
  { regex: /^(tsp|teaspoons?)\b/i, category: 'teaspoons', standard: 'tsp' },
  // Eggs / Egg Whites
  { regex: /^(pure\s+egg\s+whites?|egg\s+whites?|egg\s+yolks?|eggs?)\b/i, category: 'eggs', standard: 'eggs' },
  // Pieces / whole counts
  { regex: /^(pieces?|pcs?|cloves?|heads?|stalks?|slices?|cans?|packets?|bunches?|bundles?|pinches?)\b/i, category: 'pieces', standard: 'pcs' },
  // Pounds
  { regex: /^(lbs?|pounds?)\b/i, category: 'pounds', standard: 'lb' },
  // Ounces
  { regex: /^(oz|ounces?)\b/i, category: 'ounces', standard: 'oz' },
  // Inches
  { regex: /^(inches?|in)\b/i, category: 'other', standard: 'inches' }
];

/**
 * Parses numeric value at start of ingredient string
 * Supports mixed numbers (1 1/2), fractions (3/4), decimals (1.5), integers (500), and vulgar fractions (½)
 */
export function parseQuantity(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();

  // 1. Mixed fraction with unicode: e.g. "1 ½" or "2½"
  const mixedVulgar = trimmed.match(/^(\d+)\s*([½⅓⅔¼¾⅛⅜⅝⅞])/);
  if (mixedVulgar) {
    const whole = parseInt(mixedVulgar[1], 10);
    const frac = VULGAR_FRACTIONS[mixedVulgar[2]] || 0;
    return {
      value: whole + frac,
      rawString: mixedVulgar[0],
      rest: trimmed.slice(mixedVulgar[0].length).trim()
    };
  }

  // 2. Single vulgar fraction: e.g. "½"
  const singleVulgar = trimmed.match(/^([½⅓⅔¼¾⅛⅜⅝⅞])/);
  if (singleVulgar) {
    return {
      value: VULGAR_FRACTIONS[singleVulgar[1]] || 0,
      rawString: singleVulgar[0],
      rest: trimmed.slice(singleVulgar[0].length).trim()
    };
  }

  // 3. Mixed standard fraction: e.g. "1 1/2" or "2 1/4"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den > 0) {
      return {
        value: whole + (num / den),
        rawString: mixedMatch[0],
        rest: trimmed.slice(mixedMatch[0].length).trim()
      };
    }
  }

  // 4. Standard fraction: e.g. "1/2", "3/4"
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10);
    const den = parseInt(fractionMatch[2], 10);
    if (den > 0) {
      return {
        value: num / den,
        rawString: fractionMatch[0],
        rest: trimmed.slice(fractionMatch[0].length).trim()
      };
    }
  }

  // 5. Standard integer or decimal: e.g. "500", "1.5", "0.25"
  const numMatch = trimmed.match(/^(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (!isNaN(val)) {
      return {
        value: val,
        rawString: numMatch[0],
        rest: trimmed.slice(numMatch[0].length).trim()
      };
    }
  }

  return null;
}

/**
 * Parses an ingredient line into structured parts:
 * { structured: boolean, quantity, unit, unitCategory, unitText, name, original }
 */
export function parseIngredient(ingredientStr) {
  if (!ingredientStr || typeof ingredientStr !== 'string') {
    return { structured: false, original: ingredientStr || '', name: ingredientStr || '' };
  }

  const raw = ingredientStr.trim();
  const parsedQty = parseQuantity(raw);

  if (!parsedQty || parsedQty.value <= 0) {
    // Unstructured / unsupported format (e.g. "Pinch of salt", "Fresh tomato slices (garnish)")
    return {
      structured: false,
      original: raw,
      name: raw,
      quantity: null,
      unit: null
    };
  }

  const restAfterQty = parsedQty.rest;
  if (!restAfterQty) {
    return {
      structured: true,
      original: raw,
      quantity: parsedQty.value,
      unit: null,
      unitCategory: 'pieces',
      unitText: '',
      name: ''
    };
  }

  // Match known unit
  for (const u of UNITS_MAP) {
    const match = restAfterQty.match(u.regex);
    if (match) {
      const unitText = match[0];
      const name = restAfterQty.slice(unitText.length).replace(/^[,\s-]+/, '').trim();
      return {
        structured: true,
        original: raw,
        quantity: parsedQty.value,
        unit: u.standard,
        unitCategory: u.category,
        unitText,
        name: name || unitText
      };
    }
  }

  // Standalone whole count without explicit unit keyword (e.g. "1 sayote (chayote), peeled")
  return {
    structured: true,
    original: raw,
    quantity: parsedQty.value,
    unit: 'pcs',
    unitCategory: 'pieces',
    unitText: '',
    name: restAfterQty
  };
}

/**
 * Rounds scaled quantity according to culinary precision rules:
 * - Grams: nearest whole number
 * - Kilograms: up to 2 decimal places
 * - Milliliters: nearest whole number
 * - Pieces: round up to next whole number (Math.ceil)
 * - Eggs: round up to next whole egg (Math.ceil)
 * - Other measurements: retain sensible precision (up to 2 decimals)
 */
export function roundScaledQuantity(rawScaled, unitCategory, unit) {
  if (typeof rawScaled !== 'number' || isNaN(rawScaled) || rawScaled <= 0) return 0;

  switch (unitCategory) {
    case 'grams':
    case 'milliliters':
      return Math.round(rawScaled);

    case 'kilograms':
      return Number(rawScaled.toFixed(2));

    case 'pieces':
    case 'eggs':
      return Math.ceil(rawScaled);

    default:
      // cups, tablespoons, teaspoons, liters, pounds, ounces, etc.
      // If integer or very close to integer, return integer
      if (Math.abs(rawScaled - Math.round(rawScaled)) < 0.001) {
        return Math.round(rawScaled);
      }
      return Number(rawScaled.toFixed(2));
  }
}

/**
 * Format quantity for display (e.g. 1.5, 750, 2)
 */
export function formatQuantity(value) {
  if (value === null || value === undefined) return '';
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2)));
}

/**
 * Scales an individual ingredient line by multiplier
 */
export function scaleIngredient(ingredientStr, multiplier = 1) {
  const parsed = parseIngredient(ingredientStr);

  // If unstructured / unsupported, preserve original display without error
  if (!parsed.structured || parsed.quantity === null) {
    return {
      structured: false,
      original: ingredientStr,
      scaledText: ingredientStr,
      name: parsed.name || ingredientStr,
      displayName: parsed.name || ingredientStr,
      originalQuantityText: '—',
      scaledQuantityText: '—'
    };
  }

  if (multiplier === 1) {
    const qtyText = formatQuantity(parsed.quantity);
    const unitPart = parsed.unitText ? ` ${parsed.unitText}` : '';
    return {
      structured: true,
      original: ingredientStr,
      scaledText: ingredientStr,
      name: parsed.name,
      displayName: parsed.name,
      originalQuantityText: `${qtyText}${unitPart}`.trim(),
      scaledQuantityText: `${qtyText}${unitPart}`.trim(),
      originalQty: parsed.quantity,
      scaledQty: parsed.quantity,
      unit: parsed.unitText || parsed.unit
    };
  }

  const rawScaled = parsed.quantity * multiplier;
  const scaledValue = roundScaledQuantity(rawScaled, parsed.unitCategory, parsed.unit);

  const origQtyText = formatQuantity(parsed.quantity);
  const scaledQtyText = formatQuantity(scaledValue);
  const unitPart = parsed.unitText ? ` ${parsed.unitText}` : '';

  // Handle pluralization of unit or name when scaling 1 -> >1 if needed, but preserve original text casing
  let scaledText = `${scaledQtyText}${unitPart} ${parsed.name}`.trim();

  // If there was no unitText (e.g. "1 sayote"), format as "${scaledQtyText} ${parsed.name}"
  if (!parsed.unitText) {
    scaledText = `${scaledQtyText} ${parsed.name}`.trim();
  }

  return {
    structured: true,
    original: ingredientStr,
    scaledText,
    name: parsed.name,
    displayName: parsed.name,
    originalQuantityText: `${origQtyText}${unitPart}`.trim(),
    scaledQuantityText: `${scaledQtyText}${unitPart}`.trim(),
    originalQty: parsed.quantity,
    scaledQty: scaledValue,
    unit: parsed.unitText || parsed.unit
  };
}

/**
 * Dynamically scales recipe ingredient quantities
 * - Base servings defaults to 4 if missing or invalid
 * - Household members defaults to 4 (clamped 1 to 20)
 * - Returns new scaled object without mutating original recipe
 */
export function scaleRecipe(recipe, householdMembers = 4) {
  if (!recipe) return null;

  const rawBase = Number(recipe.base_servings || recipe.servings || recipe.baseServings);
  const baseServings = Math.max(1, Number.isFinite(rawBase) && rawBase > 0 ? Math.round(rawBase) : 4);

  const rawMembers = Number(householdMembers);
  const validMembers = Number.isFinite(rawMembers) ? rawMembers : 4;
  const members = Math.max(1, Math.min(20, Math.round(validMembers)));
  const scalingMultiplier = members / baseServings;

  const originalIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const scaledIngredients = originalIngredients.map(ing => scaleIngredient(ing, scalingMultiplier));

  return {
    ...recipe,
    base_servings: baseServings,
    baseServings,
    household_members: members,
    householdMembers: members,
    scaling_multiplier: scalingMultiplier,
    scalingMultiplier,
    scaledIngredients,
    scaledIngredientLines: scaledIngredients.map(s => s.scaledText)
  };
}
