// Offline LID Clinical Rule Engine & Ingredient Parser
// Evaluates raw text, scanned packaging OCR, and search queries against the clinical protocol

import { LID_DATABASE, STATUS, getItemStatus } from '../data/lidDatabase.js';

// High-risk prohibited keyword patterns for fast substring/regex detection
const FORBIDDEN_RULES = [
  {
    regex: /(?<!\bnon[-\s]?|\bun[-\s]?)(?:iodi[sz]ed|iodated)\b|\b(potassium iodate|calcium iodate|potassium iodide|e916|e917|iodophor)\b/i,
    exclude: /\b(non[- ]?iodi[sz]ed|un[- ]?iodi[sz]ed|noniodi[sz]ed)\b/i,
    name: 'Iodized Salt / Iodate Conditioners',
    reason: 'Contains fortified inorganic iodine or iodate dough conditioner (>70 mcg/serving).'
  },
  {
    regex: /\b(sea salt|himalayan salt|pink salt|maldon|fleur de sel|celtic salt|rock salt)\b/i,
    name: 'Sea Salt / Mineral Salt',
    reason: 'Marine or mined salt with high, unpredictable oceanic iodine content.'
  },
  {
    regex: /\b(carrageenan|e407|agar|agar-agar|e406|gulaman|alginate|sodium alginate|e401|e402|e403|e404|irish moss)\b/i,
    name: 'Seaweed Extract / Carrageenan / Agar',
    reason: 'Direct sea algae polysaccharide derivative loaded with concentrated marine iodine.'
  },
  {
    regex: /\b(seaweed|nori|kelp|kombu|wakame|lato|ar-arusip|dulse|spirulina|chlorella|sea moss)\b/i,
    name: 'Sea Vegetables / Marine Flora',
    reason: 'World’s highest natural source of iodine (can supply 2,000+ mcg in one portion).'
  },
  {
    regex: /\b(fish|tuna|salmon|cod|mackerel|sardines|tilapia|bangus|anchov(y|ies)|sushi|sashimi)\b/i,
    name: 'Marine or Freshwater Fish',
    reason: 'Fish bioaccumulate high environmental iodine; strictly prohibited on LID.'
  },
  {
    regex: /\b(shellfish|shrimp|prawns?|hipon|crab|lobster|oyster|mussels?|tahong|clams?|squid|pusit|octopus|aligue|bagoong|patis|fish sauce|oyster sauce)\b/i,
    name: 'Shellfish & Seafood Derivatives',
    reason: 'Mollusks and crustaceans store extreme amounts of elemental iodine.'
  },
  {
    regex: /\b(milk|dairy|butter|cheese|cheddar|mozzarella|parmesan|cottage cheese|ricotta|yogurt|whey|casein|caseinate|cream cheese|sour cream|heavy cream|ice cream|milk chocolate|evaporated milk|condensed milk|gatas)\b/i,
    name: 'Dairy Milk & Byproducts',
    reason: 'Cattle udders washed with iodophors and dairy cattle given iodine feed; milk delivers ~100 mcg/cup.'
  },
  {
    regex: /\b(egg yolk|whole eggs?|mayonnaise|mayo|custard|hollandaise)\b/i,
    name: 'Egg Yolks / Whole Eggs',
    reason: 'Iodine concentrates selectively in the egg yolk (~12-25 mcg each). Only pure egg whites are allowed.'
  },
  {
    regex: /\b(soy|soybeans?|soy sauce|toyo|tamari|tofu|tokwa|taho|edamame|tempeh|textured vegetable protein|tvp|soy lecithin)\b/i,
    name: 'Soy Products & Isoflavones',
    reason: 'Contains genistein/daidzein which inhibit the thyroid sodium-iodide symporter (NIS), blocking radioactive iodine.'
  },
  {
    regex: /\b(lima beans?|black beans?|green beans?|string beans?|baguio beans?|kidney beans?|lentils?|chickpeas?|garbanzos?)\b/i,
    name: 'Restricted Legumes & Pod Beans',
    reason: 'Legumes absorb high mineral iodides from soils; specific exclusion in medical protocol.'
  },
  {
    regex: /\b(turkey|turkey breast)\b/i,
    name: 'Turkey Breast',
    reason: 'Commercially processed with high-iodine brine/broth injections.'
  },
  {
    regex: /\b(?<!sweet\s)(potatoes?|potato starch|potato flour|french fries|mashed potato|hash browns?|patatas)\b/i,
    exclude: /\bsweet\s*potat/i,
    name: 'Potatoes (All Varieties)',
    reason: 'Potatoes store ~60 mcg iodine per medium tuber, exceeding the 50 mcg/day diet ceiling.'
  },
  {
    regex: /\b(watercress|cassava|kamoteng kahoy|millet)\b/i,
    name: 'Watercress & Cassava Goitrogens',
    reason: 'Goitrogenic substances and aquatic iodine concentration; strictly contraindicated.'
  },
  {
    regex: /\b(cabbage|repolyo|broccoli|cauliflower|brussels sprouts?|kale|bok choy|pechay|kohlrabi)\b/i,
    name: 'Cruciferous Vegetables (Goitrogens)',
    reason: 'Contains thiocyanates and goitrogens that hinder radioactive iodine uptake in thyroid tissue.'
  },
  {
    regex: /\b(red (dye )?#?3|red 3\b|erythrosine|e127|fd&c red 3|fd&c red #3)\b/i,
    name: 'FD&C Red Dye #3 (Erythrosine)',
    reason: 'Synthetic dye containing 58% elemental iodine by molecular weight.'
  },
  {
    regex: /\b(prunes?|dried prunes?|bananas?|pineapple|pinya|strawberr(y|ies)|cranberr(y|ies)|maraschino)\b/i,
    name: 'Restricted Fruits',
    reason: 'Fruits documented with higher botanical iodine accumulation per protocol.'
  },
  {
    regex: /\b(blackstrap molasses)\b/i,
    name: 'Blackstrap Molasses',
    reason: 'High concentrated mineral soil iodides.'
  },
  {
    regex: /\b(multivitamin|iodine pill|kelp pill|amiodarone|betadine|povidone-iodine|lugol)\b/i,
    name: 'Iodine Supplement / Antiseptic',
    reason: 'Direct pharmaceutical doses of inorganic iodine.'
  }
];

const CAUTION_RULES = [
  {
    regex: /\b(salt|sodium chloride)\b/i,
    exclude: /\b(kosher|non[- ]?iodi[sz]ed|un[- ]?iodi[sz]ed|noniodi[sz]ed|pickling|canning)\b/i,
    name: 'Unspecified Salt',
    reason: 'Packaging lists generic "salt". Unless labeled as non-iodized or kosher, commercially processed salt is usually iodized.'
  },
  {
    regex: /\b(dough conditioner|conditioner)\b/i,
    exclude: /\b(iodate-free)\b/i,
    name: 'Unspecified Dough Conditioner',
    reason: 'Commercial bakeries frequently use potassium iodate or calcium iodate. Must verify with manufacturer.'
  },
  {
    regex: /\b(natural flavors?|artificial flavors?|flavoring)\b/i,
    name: 'Flavors / Seasoning Blend',
    reason: 'Flavoring agents may conceal dairy extracts, seafood proteins, or iodized salt carriers.'
  },
  {
    regex: /\b(oat milk|almond milk|plant milk|coconut milk)\b/i,
    name: 'Packaged Plant Milk',
    reason: 'Check label for added sea salt or carrageenan thickener. Safe only if 100% pure.'
  },
  {
    regex: /\b(cocoa|cacao|dark chocolate)\b/i,
    name: 'Chocolate / Cacao Product',
    reason: 'Safe only if 100% free of milk solids, whey, butter oil, and soy lecithin.'
  },
  {
    regex: /\b(canned tomato|tomato paste|crushed tomatoes)\b/i,
    name: 'Canned Tomato Product',
    reason: 'Ensure canning salt is non-iodized or salt-free.'
  }
];

// Clean text for matching
function cleanToken(text) {
  return text.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ').replace(/\s{2,}/g, ' ').trim().toLowerCase();
}

/**
 * Evaluates an ingredients string or scanned label text
 */
export function analyzeIngredients(rawText) {
  if (!rawText || !rawText.trim()) {
    return {
      isSafe: true,
      status: STATUS.SAFE,
      overallBadge: 'NO INGREDIENTS DETECTED',
      reasons: ['No ingredient text provided.'],
      detectedForbidden: [],
      detectedCaution: [],
      safeTokens: [],
      parsedTokens: []
    };
  }

  const normalized = rawText.toLowerCase();

  // Split into candidate ingredient segments (commas, newlines, semicolons, bullets)
  const rawSegments = rawText
    .split(/[,;\n\r•·\t]+|\sand\s(?=(?:[a-z\s]+)(?:,|$))/i)
    .map(s => s.trim())
    .filter(s => s.length > 1);

  const detectedForbidden = [];
  const detectedCaution = [];
  const parsedTokens = [];

  // 1. Scan across the entire text against forbidden rules
  for (const rule of FORBIDDEN_RULES) {
    if (rule.regex.test(normalized)) {
      if (rule.exclude && rule.exclude.test(normalized)) {
        continue;
      }
      const match = normalized.match(rule.regex);
      detectedForbidden.push({
        name: rule.name,
        matchedWord: match ? match[0] : rule.name,
        reason: rule.reason
      });
    }
  }

  // 2. Scan across the entire text against caution rules
  for (const rule of CAUTION_RULES) {
    if (rule.regex.test(normalized)) {
      if (rule.exclude && rule.exclude.test(normalized)) {
        // Excluded (e.g. explicitly said kosher salt)
        continue;
      }
      const match = normalized.match(rule.regex);
      detectedCaution.push({
        name: rule.name,
        matchedWord: match ? match[0] : rule.name,
        reason: rule.reason
      });
    }
  }

  // 3. Classify individual segments for visual highlighting
  for (const seg of rawSegments) {
    let segmentStatus = STATUS.SAFE;
    let matchedReason = null;
    let matchedName = null;

    for (const rule of FORBIDDEN_RULES) {
      if (rule.regex.test(seg)) {
        if (rule.exclude && rule.exclude.test(seg)) continue;
        segmentStatus = STATUS.AVOID;
        matchedReason = rule.reason;
        matchedName = rule.name;
        break;
      }
    }

    if (segmentStatus === STATUS.SAFE) {
      for (const rule of CAUTION_RULES) {
        if (rule.regex.test(seg)) {
          if (rule.exclude && rule.exclude.test(seg)) continue;
          segmentStatus = STATUS.CAUTION;
          matchedReason = rule.reason;
          matchedName = rule.name;
          break;
        }
      }
    }

    parsedTokens.push({
      text: seg,
      status: segmentStatus,
      matchedName,
      matchedReason
    });
  }

  // Deduplicate forbidden and caution findings
  const uniqueForbidden = Array.from(new Map(detectedForbidden.map(f => [f.name, f])).values());
  const uniqueCaution = Array.from(new Map(detectedCaution.map(c => [c.name, c])).values());

  // Determine overall status
  let overallStatus = STATUS.SAFE;
  let isSafe = true;
  const reasons = [];

  if (uniqueForbidden.length > 0) {
    overallStatus = STATUS.AVOID;
    isSafe = false;
    uniqueForbidden.forEach(f => {
      reasons.push(`${f.name} ("${f.matchedWord}"): ${f.reason}`);
    });
  } else if (uniqueCaution.length > 0) {
    overallStatus = STATUS.CAUTION;
    isSafe = false;
    uniqueCaution.forEach(c => {
      reasons.push(`${c.name} ("${c.matchedWord}"): ${c.reason}`);
    });
  } else {
    reasons.push('No forbidden iodine sources, dairy, goitrogens, or questionable additives detected. Appears safe for Low-Iodine Diet!');
  }

  return {
    isSafe,
    status: overallStatus,
    overallBadge: overallStatus === STATUS.SAFE ? 'SAFE TO EAT' : overallStatus === STATUS.AVOID ? 'STRICTLY AVOID' : 'CHECK LABEL CAREFULLY',
    reasons,
    detectedForbidden: uniqueForbidden,
    detectedCaution: uniqueCaution,
    parsedTokens
  };
}

/**
 * Searches the offline food database reactively against the active dietary profile
 */
export function searchDatabase(query, filterStatus = 'ALL', filterCategory = 'ALL', activeDiet = 'lid') {
  let results = LID_DATABASE;

  if (query && query.trim()) {
    const cleanQ = cleanToken(query);

    results = results.filter(item => {
      const nameMatch = cleanToken(item.name).includes(cleanQ);
      const aliasMatch = (item.aliases || []).some(a => cleanToken(a).includes(cleanQ));
      const descMatch = cleanToken(item.description || '').includes(cleanQ);
      const catMatch = cleanToken(item.category || '').includes(cleanQ);
      const noteMatch = cleanToken(item.clinicalNotes || '').includes(cleanQ);
      const dietNote = cleanToken(item.dietaryStatus?.[activeDiet]?.note || '');

      return nameMatch || aliasMatch || descMatch || catMatch || noteMatch || dietNote;
    });

    // Sort: Exact name matches first, then alias matches, then description
    results.sort((a, b) => {
      const aExact = cleanToken(a.name) === cleanQ;
      const bExact = cleanToken(b.name) === cleanQ;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });
  }

  if (filterStatus !== 'ALL') {
    results = results.filter(item => getItemStatus(item, activeDiet) === filterStatus);
  }
  if (filterCategory !== 'ALL') {
    results = results.filter(item => item.category === filterCategory);
  }

  return results;
}


/**
 * Evaluates an entire recipe with ingredient lines
 */
export function analyzeRecipe(recipeTitle, ingredientLinesText) {
  const lines = ingredientLinesText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));

  const analyzedLines = lines.map(line => {
    const res = analyzeIngredients(line);
    return {
      line,
      status: res.status,
      reasons: res.reasons,
      forbidden: res.detectedForbidden,
      caution: res.detectedCaution
    };
  });

  const totalLines = analyzedLines.length;
  const avoidCount = analyzedLines.filter(l => l.status === STATUS.AVOID).length;
  const cautionCount = analyzedLines.filter(l => l.status === STATUS.CAUTION).length;
  const safeCount = analyzedLines.filter(l => l.status === STATUS.SAFE).length;

  let overallStatus = STATUS.SAFE;
  if (avoidCount > 0) {
    overallStatus = STATUS.AVOID;
  } else if (cautionCount > 0) {
    overallStatus = STATUS.CAUTION;
  }

  // Calculate safety score 0-100%
  const safetyScore = totalLines > 0 ? Math.round((safeCount / totalLines) * 100) : 100;

  return {
    title: recipeTitle || 'Custom Recipe',
    overallStatus,
    safetyScore,
    totalLines,
    avoidCount,
    cautionCount,
    safeCount,
    analyzedLines
  };
}
