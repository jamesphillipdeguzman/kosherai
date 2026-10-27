// Multi-Diet Philippine Nutrition Companion Profiles
// Default protocol is 'lid' (Low-Iodine Diet Protocol)

export const DIET_PROFILES = {
  lid: {
    id: 'lid',
    name: 'LID Protocol (Default)',
    label: 'LID Protocol (Default)',
    shortName: 'LID (Default)',
    badge: 'LID RAI',
    icon: '🛡️',
    emoji: '🛡️',
    target: 'Clinical Target: <50 mcg Iodine/Day',
    tagline: 'Strict low-iodine for thyroid cancer Radioactive Iodine (RAI) therapy preparation.',
    description: 'Depletes thyroid iodine reserves so residual thyroid tissue avidly absorbs therapeutic radiation.',
    metricLabel: 'Iodine Impact',
    flaggedKeywords: ['iodized salt', 'sea salt', 'seafood', 'dairy', 'egg yolks', 'soy', 'carrageenan'],
    swapTip: 'Use pure non-iodized kosher salt and fresh local produce (sayote, kalabasa).'
  },
  low_purine: {
    id: 'low_purine',
    name: 'Low-Purine / Anti-Uric Acid',
    label: 'Low-Purine / Anti-Uric Acid',
    shortName: 'Low-Purine (Gout Care)',
    badge: 'URIC CARE',
    icon: '🍖',
    emoji: '🍖',
    target: 'Clinical Target: <200 mg Purines/Day',
    tagline: 'Gout prevention & hyperuricemia control, limiting organ meats, bagoong, and munggo.',
    description: 'Reduces uric acid crystallization in joints and kidneys by avoiding high-purine meats and extracts.',
    metricLabel: 'Purine Level',
    flaggedKeywords: ['isaw', 'bopis', 'atay', 'liver', 'munggo', 'sardines', 'tahong', 'anchovies', 'beer'],
    swapTip: 'Swap organ meats and munggo for lean skinless chicken breast, sayote, and egg whites.'
  },
  low_sodium: {
    id: 'low_sodium',
    name: 'Low-Sodium / Heart-Care (DASH)',
    label: 'Low-Sodium / Heart-Care (DASH)',
    shortName: 'Low-Sodium (DASH)',
    badge: 'HEART CARE',
    icon: '❤️',
    emoji: '❤️',
    target: 'Clinical Target: <1,500–2,000 mg Sodium/Day',
    tagline: 'Hypertension & kidney care, limiting patis, toyomansi, and dried fish (tuyo/daing).',
    description: 'Supports blood pressure control and prevents water retention by eliminating high-sodium Pinoy staples.',
    metricLabel: 'Sodium Level',
    flaggedKeywords: ['patis', 'toyo', 'bagoong', 'tuyo', 'daing', 'instant noodles', 'bouillon cubes', 'chicharon'],
    swapTip: 'Swap patis and toyo for fresh calamansi juice, siling labuyo, garlic, and potassium herbs.'
  },
  diabetic: {
    id: 'diabetic',
    name: 'Diabetic / Low-GI',
    label: 'Diabetic / Low-GI',
    shortName: 'Diabetic / Low-GI',
    badge: 'GLUCOSE CARE',
    icon: '💧',
    emoji: '💧',
    target: 'Clinical Target: Low Glycemic Index & Low Free Sugar',
    tagline: 'Blood sugar management, limiting refined carbs, added sugars, and sweet sauces.',
    description: 'Stabilizes post-meal glucose spikes and prevents insulin surges from high-glycemic Filipino staples.',
    metricLabel: 'Glycemic Impact',
    flaggedKeywords: ['white rice', 'white sugar', 'sweetened condensed milk', 'banana ketchup', 'sweet chili sauce', 'soda'],
    swapTip: 'Swap white rice for cauliflower rice or brown/red rice; replace banana ketchup with fresh tomato salsa.'
  },
  pinoy_keto: {
    id: 'pinoy_keto',
    name: 'Pinoy Keto / Low-Carb',
    label: 'Pinoy Keto / Low-Carb',
    shortName: 'Pinoy Keto',
    badge: 'PINOY KETO',
    icon: '🥑',
    emoji: '🥑',
    target: 'Clinical Target: <20–50g Net Carbs/Day',
    tagline: 'Weight loss & metabolic health, high fat/protein with minimal starches and sugars.',
    description: 'Maintains nutritional ketosis by prioritizing healthy fats, quality proteins, and eliminating carb fillers.',
    metricLabel: 'Net Carbs',
    flaggedKeywords: ['white rice', 'pancit', 'pandesal', 'sugar', 'corn', 'potatoes', 'kamote', 'flour'],
    swapTip: 'Swap rice for shirataki or riced cauliflower; swap bread for almond/coconut flour keto bake.'
  }
};

export const DEFAULT_DIET = 'lid';

export function getActiveDiet() {
  if (typeof localStorage === 'undefined') return DEFAULT_DIET;
  const saved = localStorage.getItem('kosherai_active_diet');
  return saved && DIET_PROFILES[saved] ? saved : DEFAULT_DIET;
}

export function setActiveDiet(dietKey) {
  const validKey = DIET_PROFILES[dietKey] ? dietKey : DEFAULT_DIET;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('kosherai_active_diet', validKey);
  }
  return validKey;
}

export function getDietProfile(dietKey = 'lid') {
  return DIET_PROFILES[dietKey] || DIET_PROFILES[DEFAULT_DIET];
}

export const DIET_DESCRIPTIONS = {
  lid: {
    badge: "LID (Default)",
    tagline: "Strict low-iodine preparation (<50 mcg/day) to deplete thyroid stores and maximize radioactive iodine (RAI) uptake."
  },
  diabetic: {
    badge: "Diabetic / Low-GI",
    tagline: "Low glycemic-load protocol focused on high fiber and complex carbs to avoid postprandial glucose spikes."
  },
  low_purine: {
    badge: "Low-Purine (Gout Care)",
    tagline: "Restricts purine-dense offal, seafood, and gravies (<200 mg/day) to lower serum uric acid and prevent flares."
  },
  low_sodium: {
    badge: "Low-Sodium / Heart-Care",
    tagline: "Cardiovascular DASH protocol limiting sodium (<1,500–2,000 mg/day) by cutting patis, bagoong, and MSG."
  },
  pinoy_keto: {
    badge: "Pinoy Keto / Low-Carb",
    tagline: "Very low-carb (<20–50g net carbs/day), high-fat nutrition inducing ketosis while enjoying authentic Pinoy dishes."
  }
};

export function getDietDescription(activeDiet) {
  const d = (activeDiet || '').toLowerCase();
  if (d.includes('diabetic') || d.includes('glucose')) {
    return DIET_DESCRIPTIONS.diabetic.tagline;
  }
  if (d.includes('purine') || d.includes('uric') || d.includes('gout')) {
    return DIET_DESCRIPTIONS.low_purine.tagline;
  }
  if (d.includes('sodium') || d.includes('heart') || d.includes('dash')) {
    return DIET_DESCRIPTIONS.low_sodium.tagline;
  }
  if (d.includes('keto') || d.includes('carb')) {
    return DIET_DESCRIPTIONS.pinoy_keto.tagline;
  }
  return DIET_DESCRIPTIONS.lid.tagline;
}
