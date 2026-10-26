// Multi-Diet Philippine Food Database (LID Default Protocol)
// Supports:
//  1. 'lid' — Low-Iodine Diet Protocol (Default, <50 mcg iodine/day)
//  2. 'low_purine' — Low-Purine / Anti-Uric Acid (Gout Prevention)
//  3. 'low_sodium' — Low-Sodium / Heart-Care DASH (Hypertension & Renal)
//  4. 'diabetic' — Diabetic / Low-GI (Glycemic Control)
//  5. 'pinoy_keto' — Pinoy Keto / Low-Carb (Weight Loss & Metabolic)

export const LID_CATEGORIES = {
  PROTEINS: 'Meat & Proteins',
  PRODUCE: 'Vegetables & Fruits',
  GRAINS: 'Pantry, Flours & Grains',
  CONDIMENTS: 'Salts, Oils & Condiments',
  DAIRY_EGGS: 'Dairy & Eggs',
  SNACKS_SWEETS: 'Snacks & Sweets',
  BEVERAGES: 'Beverages',
  ADDITIVES: 'Additives, Dyes & Supplements'
};

export const STATUS = {
  SAFE: 'SAFE',
  AVOID: 'AVOID',
  CAUTION: 'CAUTION'
};

/**
 * Resolves diet-specific status, clinical guidance, metric value, and Pinoy smart swaps
 */
export function getItemDietaryInfo(item, dietKey = 'lid') {
  if (!item) {
    return {
      status: STATUS.SAFE,
      note: '',
      substitutes: [],
      metricLabel: 'Iodine Impact',
      metricValue: '0 mcg'
    };
  }

  const dietMap = item.dietaryStatus || {};
  const currentDiet = dietMap[dietKey] || dietMap.lid;

  // Metric labels per diet
  const metricLabels = {
    lid: 'Iodine Impact',
    low_purine: 'Purine Content',
    low_sodium: 'Sodium Impact',
    diabetic: 'Glycemic Impact',
    pinoy_keto: 'Net Carbs'
  };

  const metricLabel = metricLabels[dietKey] || 'Dietary Impact';

  if (currentDiet) {
    return {
      status: currentDiet.status || item.status || STATUS.SAFE,
      note: currentDiet.note || item.clinicalNotes || item.description || '',
      substitutes: currentDiet.substitutes || item.substitutes || [],
      metricLabel,
      metricValue: currentDiet.metricValue || (dietKey === 'lid' ? item.iodineContent : currentDiet.note || '')
    };
  }

  return {
    status: item.status || STATUS.SAFE,
    note: item.clinicalNotes || '',
    substitutes: item.substitutes || [],
    metricLabel,
    metricValue: dietKey === 'lid' ? item.iodineContent : ''
  };
}

export function getItemStatus(item, dietKey = 'lid') {
  return getItemDietaryInfo(item, dietKey).status;
}

export function getItemSubstitutes(item, dietKey = 'lid') {
  return getItemDietaryInfo(item, dietKey).substitutes;
}

export const LID_DATABASE = [
  // ==================== SALTS & CONDIMENTS ====================
  {
    id: 'salt-kosher',
    name: 'Kosher Salt (Non-Iodized)',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.SAFE,
    aliases: ['pure kosher salt', 'diamond crystal kosher salt', 'morton coarse kosher salt', 'non-iodized salt', 'pickling salt', 'canning salt', 'pure sodium chloride'],
    iodineContent: '< 1 mcg per serving (Negligible)',
    generalDescription: '100% pure coarse salt without potassium iodide or chemical iodine additives.',
    description: '100% pure coarse salt without potassium iodide. The cornerstone salt for home cooking on LID.',
    substitutes: [],
    clinicalNotes: 'Check label: ensure it states "This salt does not supply iodide". Diamond Crystal and Morton Coarse are gold standards.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: 'The cornerstone salt for home cooking on LID (<1 mcg iodine).', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: 'Purine-free. Safe for seasoning low-purine dishes.', substitutes: [] },
      low_sodium: { status: STATUS.CAUTION, note: 'Pure sodium chloride (~590mg Na/g). Use very sparingly under DASH restrictions.', substitutes: ['Fresh calamansi juice', 'Garlic powder', 'Siling labuyo'] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbohydrates and zero glycemic impact.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Crucial for replenishing electrolytes in keto adaptation.', substitutes: [] }
    }
  },
  {
    id: 'salt-iodized',
    name: 'Iodized Salt / Table Salt',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['table salt', 'iodized table salt', 'iodated salt', 'refined salt', 'iodized rock salt'],
    iodineContent: '~71 mcg per 1/4 tsp (Exceeds daily max in one pinch)',
    generalDescription: 'Commercial table salt fortified with potassium iodide or potassium iodate.',
    description: 'Commercial table salt fortified with potassium iodide or potassium iodate. Strictly forbidden on LID.',
    substitutes: ['Non-iodized pure kosher salt', 'Pickling salt', 'Canning salt'],
    clinicalNotes: 'Mandatory iodization laws in the Philippines mean nearly all commercial table salt contains excessive iodine.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: '~71 mcg per 1/4 tsp. Saturated with inorganic iodide. Severe contraindication for RAI.', substitutes: ['Non-iodized kosher salt', 'Pickling salt'] },
      low_purine: { status: STATUS.SAFE, note: 'Contains no purines; safe for gout prevention.', substitutes: [] },
      low_sodium: { status: STATUS.AVOID, note: 'Strictly avoid — use fresh herbs, calamansi, and garlic instead.', substitutes: ['Calamansi + siling labuyo', 'Fresh ginger and roasted garlic'] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbs, but monitor sodium intake to protect cardiovascular health.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Replenishes sodium on keto, but prioritize unrefined salts.', substitutes: [] }
    }
  },
  {
    id: 'salt-sea',
    name: 'Sea Salt & Himalayan Pink Salt',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['sea salt', 'flaky sea salt', 'maldon salt', 'himalayan salt', 'pink salt', 'fleur de sel', 'celtic salt', 'black salt'],
    iodineContent: 'Variable, often 20-50+ mcg per tsp plus trace oceanic iodides',
    description: 'Derived from evaporated sea water or mineral deposits containing unpredictable levels of marine iodine.',
    substitutes: ['Non-iodized kosher salt', 'Pure pickling salt'],
    clinicalNotes: 'Even non-iodized sea salt carries marine iodine residue and is contraindicated by most RAI nuclear medicine teams.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Marine oceanic salts retain natural iodides that compromise RAI ablation.', substitutes: ['Non-iodized kosher salt'] },
      low_purine: { status: STATUS.SAFE, note: 'Zero purine content.', substitutes: [] },
      low_sodium: { status: STATUS.CAUTION, note: 'Same sodium density as table salt (~2,000mg/tsp). Use sparingly.', substitutes: ['Fresh herbs', 'Calamansi juice'] },
      diabetic: { status: STATUS.SAFE, note: 'Zero glycemic effect.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Popular electrolyte source on keto diets.', substitutes: [] }
    }
  },
  {
    id: 'soy-sauce',
    name: 'Soy Sauce (Toyo)',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['soy sauce', 'toyo', 'tamari', 'shoyu', 'liquid aminos', 'dark soy sauce', 'light soy sauce'],
    iodineContent: 'Very High (~50-90 mcg per tbsp from iodized salt + soybean isoflavones)',
    description: 'Made from fermented soybeans, wheat, and iodized brine. Soybeans actively block thyroidal iodine uptake.',
    substitutes: ['Homemade garlic-vinegar reduction', 'Coconut aminos with verified non-iodized salt', 'Balsamic reduction'],
    clinicalNotes: 'Soy is a double threat: high iodine from commercial brine, plus genistein/daidzein inhibit thyroid NIS receptors.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'High iodine brine + soybean isoflavones block RAI absorption. Absolute ban.', substitutes: ['Homemade garlic-vinegar reduction', 'Balsamic glaze'] },
      low_purine: { status: STATUS.CAUTION, note: 'Moderate purine from fermented soybeans. High intake can trigger uric acid rise.', substitutes: ['Vinegar dip with garlic', 'Calamansi reduction'] },
      low_sodium: { status: STATUS.AVOID, note: 'Extreme sodium: ~900–1,000mg sodium per single tablespoon! Major hypertension hazard.', substitutes: ['Fresh calamansi juice + crushed siling labuyo', 'Garlic vinegar (Sukang Paombong)'] },
      diabetic: { status: STATUS.CAUTION, note: 'Commercial brands often add sugar or caramel coloring. Check nutrition facts.', substitutes: ['Sugar-free coconut aminos'] },
      pinoy_keto: { status: STATUS.CAUTION, note: 'Often contains wheat and added sugars (1–3g carbs/tbsp). Choose tamari or coconut aminos.', substitutes: ['Tamari (gluten-free)', 'Coconut aminos'] }
    }
  },
  {
    id: 'fish-sauce-patis',
    name: 'Fish Sauce (Patis) & Bagoong Alamang',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['patis', 'fish sauce', 'bagoong', 'bagoong alamang', 'shrimp paste', 'anchovy sauce', 'nam pla'],
    iodineContent: 'Extremely High (Seafood extract + solar sea salt)',
    description: 'Fermented fish/krill liquid loaded with marine iodine and salt. Absolute contraindication.',
    substitutes: ['Garlic-infused olive oil with kosher salt and calamansi', 'Calamansi juice + siling labuyo'],
    clinicalNotes: 'Even small drops can ruin preparation for radioactive iodine ablation.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Extremely high marine iodine from fermented fish and solar sea salt.', substitutes: ['Garlic-infused oil + kosher salt + calamansi'] },
      low_purine: { status: STATUS.AVOID, note: 'Highly concentrated purines from fermented small fish/krill. Direct gout flare trigger.', substitutes: ['Calamansi juice + siling labuyo + garlic'] },
      low_sodium: { status: STATUS.AVOID, note: 'Massive sodium: ~1,200–1,400mg sodium per tablespoon. Dangerous for heart and kidney patients.', substitutes: ['Calamansi juice + garlic + siling labuyo dip', 'Spiced native cane vinegar'] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbohydrates, but high sodium accelerates diabetic nephropathy.', substitutes: ['Calamansi + garlic'] },
      pinoy_keto: { status: STATUS.CAUTION, note: 'Zero carbs, but extreme sodium causes water retention; consume with high water intake.', substitutes: ['Garlic-vinegar reduction'] }
    }
  },
  {
    id: 'toyomansi-condiment',
    name: 'Toyomansi & Commercial Seasoning Liquids',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['toyomansi', 'silver swan toyomansi', 'datu puti toyomansi', 'maggi savor', 'knorr liquid seasoning'],
    iodineContent: 'Very High (Iodized salt + hydrolyzed soy protein + preservatives)',
    description: 'Blended soy sauce, calamansi flavor, MSG, and preservatives. Heavy sodium and soy isoflavones.',
    substitutes: ['Fresh squeezed calamansi juice mixed with garlic and pure vinegar', 'Fresh lemon juice with chili'],
    clinicalNotes: 'Contains iodized salt, hydrolyzed soy protein, and flavor enhancers prohibited on protocol.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Contains iodized brine and soy protein hydrolysates.', substitutes: ['Fresh calamansi juice + sukang paombong + crushed siling labuyo'] },
      low_purine: { status: STATUS.CAUTION, note: 'Soy extracts and yeast enhancers may elevate purines.', substitutes: ['Pure calamansi + chili dip'] },
      low_sodium: { status: STATUS.AVOID, note: 'Massive sodium bomb (>800mg per tbsp). Avoid for blood pressure management.', substitutes: ['Pure calamansi + crushed garlic + siling labuyo dip'] },
      diabetic: { status: STATUS.CAUTION, note: 'Commercial blends frequently add corn syrup and sugar.', substitutes: ['Fresh calamansi juice + pure vinegar'] },
      pinoy_keto: { status: STATUS.CAUTION, note: 'Often contains sugar and wheat starch fillers.', substitutes: ['Fresh calamansi + coconut aminos'] }
    }
  },
  {
    id: 'oyster-sauce',
    name: 'Oyster Sauce & Seafood Pastes',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['oyster sauce', 'mama sita oyster sauce', 'lee kum kee oyster sauce', 'crab paste', 'aligue', 'belacan'],
    iodineContent: 'Extremely High (Oyster extracts, seafood base, iodized salt)',
    description: 'Thick brown sauce derived from boiled oysters, seasoned with sea salt and caramel color.',
    substitutes: ['Sautéed garlic and caramelized shallots in olive oil with kosher salt and white vinegar'],
    clinicalNotes: 'Strictly prohibited due to direct mollusk derivation.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Direct oyster mollusk derivative packed with oceanic iodine.', substitutes: ['Caramelized shallot & garlic puree in olive oil'] },
      low_purine: { status: STATUS.AVOID, note: 'Oysters are high-purine mollusks. Known trigger for acute gout.', substitutes: ['Sautéed mushrooms and onions in olive oil'] },
      low_sodium: { status: STATUS.AVOID, note: 'High sodium (>500mg/tbsp) combined with sugar and MSG.', substitutes: ['Caramelized garlic and shallots with vinegar'] },
      diabetic: { status: STATUS.AVOID, note: 'High added sugar and cornstarch fillers (~5g sugar per tbsp).', substitutes: ['Sugar-free mushroom glaze'] },
      pinoy_keto: { status: STATUS.AVOID, note: 'Thickened with cornstarch and sugar (high carb density).', substitutes: ['Garlic butter with pure pepper'] }
    }
  },
  {
    id: 'banana-ketchup',
    name: 'Banana Ketchup (UFC, Papa, Jufran)',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['banana ketchup', 'ufc banana sauce', 'jufran ketchup', 'papa ketchup', 'tamis-anghang ketchup'],
    iodineContent: 'Moderate (Bananas + commercial iodized salt + red dye)',
    description: 'Sweet Filipino condiment made from mashed bananas, sugar, vinegar, spices, iodized salt, and Red #3.',
    substitutes: ['Homemade fresh tomato salsa with non-iodized salt and calamansi', 'Pure tomato paste with apple cider vinegar'],
    clinicalNotes: 'Combines multiple LID hazards: bananas, iodized salt, and synthetic FD&C Red Dye #3.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Tri-hazard for LID: banana base + iodized salt + FD&C Red Dye #3.', substitutes: ['Fresh tomato salsa with non-iodized kosher salt'] },
      low_purine: { status: STATUS.SAFE, note: 'Low purines from fruit and sugar base.', substitutes: [] },
      low_sodium: { status: STATUS.CAUTION, note: 'Contains ~250mg sodium per 2 tbsp plus preservatives.', substitutes: ['Fresh homemade tomato dip'] },
      diabetic: { status: STATUS.AVOID, note: 'High sugar content (~4-6g sugar per tablespoon). Spikes blood sugar rapidly.', substitutes: ['Fresh blended tomatoes + stevia + vinegar', 'Unsweetened tomato paste'] },
      pinoy_keto: { status: STATUS.AVOID, note: 'Packed with sucrose and refined starch. Knocks out ketosis.', substitutes: ['Sugar-free keto ketchup', 'Fresh calamansi and chili dip'] }
    }
  },
  {
    id: 'fresh-chilies',
    name: 'Fresh Chilies (Siling Labuyo & Siling Haba)',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.SAFE,
    aliases: ['siling labuyo', 'siling haba', 'birds eye chili', 'jalapeno', 'serrano', 'red chili'],
    iodineContent: '0 mcg',
    description: 'Fresh pepper pods are completely safe and add intense, lively flavor to all Pinoy dishes.',
    substitutes: [],
    clinicalNotes: 'Great for building rich flavor without sodium or iodized condiments.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: '0 mcg iodine. Adds vibrant spicy flavor without any thyroid risk.', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: 'Purine-free. Capsaicin has anti-inflammatory properties.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'The ultimate zero-sodium flavor enhancer for hypertension patients!', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Zero glycemic impact. May help insulin sensitivity.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Keto staple for spicy Filipino dishes.', substitutes: [] }
    }
  },
  {
    id: 'pure-oils',
    name: '100% Pure Vegetable Oils (Coconut, Olive, Canola)',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.SAFE,
    aliases: ['pure coconut oil', 'canola oil', 'extra virgin olive oil', 'corn oil', 'avocado oil', 'sunflower oil'],
    iodineContent: '0 mcg',
    description: 'Pure pressed vegetable and nut oils are 100% lipid and free from iodine and purines.',
    substitutes: [],
    clinicalNotes: 'Avoid blended oils that state "butter flavor" or unverified emulsifiers.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: 'Pure lipids contain 0 mcg iodine. Safe cooking fat.', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: 'Zero purines. Safe cooking medium.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Naturally sodium-free heart-healthy fat (especially Olive/Avocado).', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbs, zero glycemic index.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Premier healthy fat staple for fueling nutritional ketosis.', substitutes: [] }
    }
  },
  {
    id: 'vinegars',
    name: 'Pure Vinegars (Cane, Coconut, Apple Cider, White)',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.SAFE,
    aliases: ['sukang paombong', 'sukang iloko', 'cane vinegar', 'coconut vinegar', 'apple cider vinegar', 'distilled white vinegar'],
    iodineContent: '0 mcg',
    description: 'Natural fermented vinegars without added salt or caramel color.',
    substitutes: [],
    clinicalNotes: 'Verify label: only water and vinegar acidity. Avoid seasoned blends with iodized salt.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: 'Pure fermented acetic acid without iodine. Great for paksiw and adobo.', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: 'Purine-free. Acetic acid assists metabolic clearance.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Zero sodium. The essential acidic base for low-sodium Filipino cuisine.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Helps blunt post-meal blood glucose spikes.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Zero carb culinary staple.', substitutes: [] }
    }
  },

  // ==================== MEAT & PROTEINS ====================
  {
    id: 'organ-meats-isaw-atay',
    name: 'Organ Meats (Isaw, Bopis, Atay / Pork & Chicken Liver)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.SAFE,
    aliases: ['isaw', 'bopis', 'atay', 'pork liver', 'chicken liver', 'liver', 'bituka', 'tripe', 'goto', 'dinuguan'],
    iodineContent: '~5-12 mcg per 100g (Low if fresh and unbrined)',
    description: 'Filipino street food and stew delicacies made from internal organs and intestines.',
    substitutes: ['Skinless chicken breast', 'Lean pork tenderloin', 'Tofu (for non-LID)'],
    clinicalNotes: 'Safe for LID only if cooked from fresh raw cuts with kosher salt. Street-food isaw is boiled with iodized salt.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: 'Naturally low in iodine if cooked raw at home without iodized salt.', substitutes: [] },
      low_purine: { status: STATUS.AVOID, note: 'Extremely high purines (>400mg/100g). Liver and intestines trigger severe gout flares.', substitutes: ['Skinless chicken breast', 'Sayote cubes', 'Egg whites'] },
      low_sodium: { status: STATUS.CAUTION, note: 'Safe if fresh; street food isaw/bopis is boiled with heavy iodized salt & patis.', substitutes: ['Fresh pan-seared chicken breast'] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbs, nutrient-dense protein with high iron and vitamin A.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'High fat and protein, zero carbs. Excellent for keto.', substitutes: [] }
    }
  },
  {
    id: 'fresh-chicken',
    name: 'Fresh Chicken (Breast, Thigh - Unbrined & Uncured)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.SAFE,
    aliases: ['chicken breast (fresh)', 'chicken thigh', 'chicken wings', 'fresh whole chicken', 'manok'],
    iodineContent: '~5-10 mcg per 100g (Naturally low)',
    description: 'Fresh supermarket raw chicken cutlets not injected with broth or saline solutions.',
    substitutes: [],
    clinicalNotes: 'Check packaging: avoid chicken stating "contains up to 15% solution of broth or salt".',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: 'Naturally low iodine (~5–10 mcg/100g). Primary protein staple for LID.', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: 'Moderate purine: skinless chicken breast is the safest meat for gout patients.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Naturally low sodium (~70mg/100g). Ideal for DASH and renal diets.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Lean protein with zero glycemic index. Helps stabilize blood sugar.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'High protein staple for keto meal plans.', substitutes: [] }
    }
  },
  {
    id: 'fresh-pork',
    name: 'Fresh Pork (Uncured & Raw - Liempo, Kasim, Loin)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.SAFE,
    aliases: ['pork chops', 'pork tenderloin', 'pork belly (fresh)', 'ground pork', 'baboy', 'liempo (fresh)', 'kasim'],
    iodineContent: '~3-6 mcg per 100g',
    description: 'Fresh butcher pork cuts without brine injection, curing salt, or preservatives.',
    substitutes: [],
    clinicalNotes: 'Avoid cured pork: tocino, longganisa, ham, bacon, spam, or hotdogs, as all contain iodized salt and nitrites.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: 'Raw fresh pork cuts are low in iodine. Avoid cured versions (tocino/longganisa).', substitutes: [] },
      low_purine: { status: STATUS.CAUTION, note: 'Moderate purines (~120mg/100g). Limit portion sizes for active gout.', substitutes: ['Skinless chicken breast', 'Egg whites'] },
      low_sodium: { status: STATUS.SAFE, note: 'Naturally low sodium in raw fresh form. Avoid cured pork.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbs, high satiety protein.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Pork belly (liempo) is a cornerstone fat and protein source for Pinoy keto.', substitutes: [] }
    }
  },
  {
    id: 'fresh-beef',
    name: 'Fresh Beef (Uncured & Raw - Sirloin, Brisket)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.SAFE,
    aliases: ['beef steak', 'ground beef (fresh)', 'beef roast', 'beef ribs', 'sirloin', 'tenderloin', 'baka'],
    iodineContent: '~2-5 mcg per 100g',
    description: 'Unprocessed fresh butcher cuts of beef. Safe protein staple.',
    substitutes: [],
    clinicalNotes: 'Avoid pre-marinated beef, corned beef, pastrami, or patties with added iodized salt.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: 'Raw fresh beef contains only 2–5 mcg iodine per 100g. Safe for LID.', substitutes: [] },
      low_purine: { status: STATUS.CAUTION, note: 'Moderate-high purine (~110-150mg/100g). Restrict to small portions (<100g) on low-purine diet.', substitutes: ['Skinless chicken breast'] },
      low_sodium: { status: STATUS.SAFE, note: 'Naturally low in sodium in fresh cuts.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbs, zero sugar.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Premier nutrient-dense red meat for keto diets.', substitutes: [] }
    }
  },
  {
    id: 'mung-beans-munggo',
    name: 'Mung Beans (Ginisang Munggo / Balatong)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['munggo', 'mongo', 'mung beans', 'green mung beans', 'balatong', 'ginisang munggo'],
    iodineContent: 'Moderate to High (Legume root nodules absorb soil iodides readily)',
    description: 'Traditional Friday Filipino bean stew seasoned with garlic, onions, and greens.',
    substitutes: ['Sayote and kalabasa stew', 'Ginisang upo or patola'],
    clinicalNotes: 'Green pod beans and dried munggo are specifically restricted on the LID medical protocol.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Soil iodides concentrate in dried legume beans. Forbidden on LID.', substitutes: ['Sayote and kalabasa stew', 'Ginisang patola'] },
      low_purine: { status: STATUS.AVOID, note: 'High purines (~150–200mg/100g). Classic Filipino trigger for acute gout attacks.', substitutes: ['Sayote cubes', 'Kalabasa', 'Tofu (moderate)'] },
      low_sodium: { status: STATUS.SAFE, note: 'Plain boiled munggo is naturally very low sodium and high in potassium/magnesium.', substitutes: [] },
      diabetic: { status: STATUS.CAUTION, note: 'Complex carbs with high fiber; moderates glucose, but portion control is needed.', substitutes: ['Cauliflower rice with greens'] },
      pinoy_keto: { status: STATUS.AVOID, note: 'High in starch (~40g net carbs per cup). Knocks out ketosis.', substitutes: ['Sautéed spinach with ground pork', 'Ginisang sayote'] }
    }
  },
  {
    id: 'egg-whites',
    name: 'Egg Whites (Pure)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.SAFE,
    aliases: ['pure egg whites', 'egg white', 'liquid egg whites', 'separated egg whites'],
    iodineContent: '< 1 mcg per white',
    description: 'The white albumen of the egg contains virtually zero iodine and zero purines. Excellent protein source.',
    substitutes: [],
    clinicalNotes: 'Must be meticulously separated from the yolk. Discard if any yellow yolk breaks into the white.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: '< 1 mcg iodine. Perfect protein source for RAI prep.', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: 'Virtually zero purines! The best protein choice for severe gout sufferers.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Naturally low sodium (~55mg/white). Safe for heart/kidney.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbs, pure protein that stabilizes blood sugar.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Pure lean protein, zero carbs.', substitutes: [] }
    }
  },
  {
    id: 'egg-yolks-whole',
    name: 'Whole Eggs & Egg Yolks',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['whole egg', 'egg yolk', 'scrambled eggs', 'boiled egg', 'sunny side up', 'salted egg', 'itlog na maalat'],
    iodineContent: '~12-25 mcg per single yolk (Chicken feed is fortified with iodine)',
    description: 'Iodine concentrates almost entirely in the yolk of the egg.',
    substitutes: ['Pure separated egg whites (use 2 whites for every 1 whole egg)'],
    clinicalNotes: 'Avoid whole eggs and whole-egg products: mayonnaise, custard, quiche, waffles, pasta.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: '~12–25 mcg iodine per yolk. Iodine concentrates heavily in poultry yolks.', substitutes: ['Pure separated egg whites (2 whites = 1 egg)'] },
      low_purine: { status: STATUS.SAFE, note: 'Eggs are very low in purines and safe for gout patients.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Fresh whole eggs are low sodium (~70mg). Salted eggs (itlog na maalat) are STRICTLY AVOID.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'High choline and healthy fats with zero carbohydrates.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Gold standard keto food: perfect 1:1 fat-to-protein ratio.', substitutes: [] }
    }
  },
  {
    id: 'dried-fish-tuyo-daing',
    name: 'Dried Salted Fish (Tuyo, Daing, Tinapa)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['tuyo', 'daing', 'tinapa', 'dried fish', 'daing na bangus (salted)', 'bulad', 'danggit'],
    iodineContent: 'Extremely High (Marine fish + solar sea salt drying)',
    description: 'Salt-cured and sun-dried or smoked fish. Highly concentrated in marine iodine, purines, and sodium.',
    substitutes: ['Fresh pan-seared chicken breast', 'Fresh unbrined pork tenderloin'],
    clinicalNotes: 'Tri-hazard: marine iodine from the fish, copious sea salt curing, and extreme purines.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Extreme marine iodine and sea salt curing. Absolute contraindication.', substitutes: ['Fresh pan-seared chicken cutlet'] },
      low_purine: { status: STATUS.AVOID, note: 'Concentrated purines (>300mg/100g) from small dried fish trigger severe gout.', substitutes: ['Fresh skinless chicken breast', 'Egg whites'] },
      low_sodium: { status: STATUS.AVOID, note: 'Astronomical sodium (>1,800mg per serving). Dangerous for hypertension and kidney care.', substitutes: ['Fresh unsalted fish pan-seared with calamansi'] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbs, but the extreme sodium elevates cardiovascular risks in diabetics.', substitutes: [] },
      pinoy_keto: { status: STATUS.CAUTION, note: 'Zero carbs, but requires massive hydration due to salt load.', substitutes: ['Fresh pan-fried tilapia in olive oil'] }
    }
  },
  {
    id: 'seafood-fish',
    name: 'Fresh Fish (Tuna, Salmon, Tilapia, Bangus)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['fish', 'tuna', 'canned tuna', 'salmon', 'tilapia', 'bangus', 'milkfish', 'sardines', 'mackerel', 'sushi'],
    iodineContent: 'Extremely High (90 to 200+ mcg per serving)',
    description: 'Marine and freshwater fish bioaccumulate environmental iodine.',
    substitutes: ['Fresh raw chicken breast', 'Fresh pork loin', 'Fresh lean beef'],
    clinicalNotes: 'Even freshwater fish are prohibited on strict LID protocols to eliminate all risk of mislabeling or contamination.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'High natural iodine bioaccumulated from water and algae.', substitutes: ['Fresh chicken breast', 'Fresh lean beef'] },
      low_purine: { status: STATUS.CAUTION, note: 'Sardines and mackerel are high purine; white fish (tilapia/bangus) is moderate.', substitutes: ['Skinless chicken breast', 'Egg whites'] },
      low_sodium: { status: STATUS.SAFE, note: 'Fresh unseasoned fish is naturally low in sodium and heart-protective.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbs, high omega-3 fatty acids for cardiovascular health.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Premier healthy protein and fat source on keto.', substitutes: [] }
    }
  },
  {
    id: 'shellfish-crustaceans',
    name: 'Shellfish & Crustaceans (Tahong, Hipon, Alimango, Talaba)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['shrimp', 'hipon', 'prawns', 'crab', 'alimango', 'alimasag', 'lobster', 'squid', 'pusit', 'octopus', 'clams', 'mussels', 'tahong', 'oysters', 'talaba'],
    iodineContent: 'Extremely High (100 to 400+ mcg per serving)',
    description: 'Marine filter-feeders that store maximal concentrations of elemental iodine and purines.',
    substitutes: ['Fresh unbrined chicken', 'Fresh beef'],
    clinicalNotes: 'One serving of shrimp or mussels can saturate thyroid receptors for weeks and cause RAI therapy failure.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Extreme marine iodine storage. Satures thyroid receptors for weeks.', substitutes: ['Fresh chicken breast', 'Fresh pork tenderloin'] },
      low_purine: { status: STATUS.AVOID, note: 'Mussels (tahong), oysters (talaba), and shrimp are rich in purines. Primary gout trigger.', substitutes: ['Skinless chicken breast', 'Sayote and kalabasa stew'] },
      low_sodium: { status: STATUS.CAUTION, note: 'Naturally higher in sodium than finfish; avoid canned or brined varieties.', substitutes: ['Fresh chicken breast'] },
      diabetic: { status: STATUS.SAFE, note: 'Lean protein with zero carbs.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'High protein, low carb (squid has slight carbs, check portions).', substitutes: [] }
    }
  },
  {
    id: 'tofu-soy-protein',
    name: 'Tofu (Tokwa), Taho & Soy Protein',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['tofu', 'tokwa', 'taho', 'edamame', 'soy protein', 'soybeans', 'tempeh'],
    iodineContent: 'Variable, but soy isoflavones suppress thyroid iodine uptake (NIS inhibitor)',
    description: 'Soy products contain genistein and daidzein which directly block the iodine uptake mechanism.',
    substitutes: ['Fresh beef', 'Fresh chicken', 'Egg whites'],
    clinicalNotes: 'Soy must be avoided not just for iodine content, but because it acts as an NIS inhibitor.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Soy isoflavones act as NIS inhibitors blocking radioactive iodine.', substitutes: ['Fresh chicken breast', 'Egg whites'] },
      low_purine: { status: STATUS.CAUTION, note: 'Tofu has moderate purines, but plant purines are generally safer than organ meats.', substitutes: ['Egg whites', 'Skinless chicken breast'] },
      low_sodium: { status: STATUS.SAFE, note: 'Fresh tokwa is naturally very low sodium.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Low glycemic index, high protein and fiber. Excellent for blood sugar.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Firm tokwa is a great low-carb plant protein (~2g net carbs/100g).', substitutes: [] }
    }
  },

  // ==================== PRODUCE (VEGETABLES & FRUITS) ====================
  {
    id: 'sayote-chayote',
    name: 'Sayote (Chayote Squash)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['sayote', 'chayote', 'mirliton', 'vegetable pear'],
    iodineContent: '0 mcg',
    description: 'Crisp, mild gourd vegetable. The premier multi-diet safe substitute for potatoes.',
    substitutes: [],
    clinicalNotes: 'Outstanding potato replacement for nilaga, tinola, chicken soups, and roasted vegetable medleys.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: '0 mcg iodine. The #1 safe potato substitute on Low-Iodine Diet.', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: '0 purines! Alkalinizes urine and aids in uric acid clearance.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Virtually zero sodium with high potassium. Great for blood pressure.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Very low glycemic index and low net carbs (~2g/100g).', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Versatile low-carb vegetable for stir-fries and tinola.', substitutes: [] }
    }
  },
  {
    id: 'kalabasa-squash',
    name: 'Kalabasa (Squash / Kabocha)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['kalabasa', 'squash', 'kabocha', 'butternut squash', 'pumpkin (fresh)'],
    iodineContent: '< 2 mcg (Very low)',
    description: 'Sweet, hearty, nutritious orange flesh. Rich in Vitamin A and safe carbohydrates.',
    substitutes: [],
    clinicalNotes: 'Great roasted with pure olive oil and non-iodized kosher salt, or mashed as a potato puree alternative.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: '< 2 mcg iodine. Hearty, safe source of carbohydrates.', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: 'Zero purines. Safe vegetable for gout diets.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Low sodium, high potassium helps counter high blood pressure.', substitutes: [] },
      diabetic: { status: STATUS.CAUTION, note: 'Moderate GI (approx 65). High in fiber, but eat in moderation.', substitutes: ['Sayote', 'Zucchini'] },
      pinoy_keto: { status: STATUS.CAUTION, note: 'Contains ~7g net carbs per 100g. Count towards daily carb limits.', substitutes: ['Sayote', 'Cauliflower'] }
    }
  },
  {
    id: 'potatoes-all',
    name: 'Potatoes (All Varieties - French Fries, Chips, Mash)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.AVOID,
    aliases: ['potato', 'potatoes', 'russet potato', 'french fries', 'potato chips', 'mashed potatoes', 'patatas'],
    iodineContent: '~60 mcg per medium potato (Exceeds daily total allowable limit)',
    description: 'Potatoes concentrate significant amounts of iodine from the soil and potato skin.',
    substitutes: ['Sayote (chayote) cubes in soups', 'Kalabasa (squash) mashed or roasted'],
    clinicalNotes: 'A common pitfall! One baked potato can deliver 60 mcg of iodine, which alone breaches the 50 mcg/day LID ceiling.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: '~60 mcg iodine per tuber. Exceeds the 50 mcg daily ceiling.', substitutes: ['Sayote (chayote) cubes', 'Kalabasa cubes'] },
      low_purine: { status: STATUS.SAFE, note: 'Low in purines and safe for gout patients.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Fresh potatoes are high potassium; avoid salted french fries/chips.', substitutes: [] },
      diabetic: { status: STATUS.AVOID, note: 'Very high glycemic index (~85). Converts rapidly to blood glucose.', substitutes: ['Sayote', 'Mashed cauliflower', 'Turnip / Singkamas'] },
      pinoy_keto: { status: STATUS.AVOID, note: 'Dense starchy tuber (~30g net carbs). Strictly forbidden on keto.', substitutes: ['Cauliflower mash', 'Radish', 'Sayote'] }
    }
  },
  {
    id: 'cruciferous-veggies',
    name: 'Cruciferous Greens (Cabbage, Broccoli, Cauliflower, Pechay)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.AVOID,
    aliases: ['cabbage', 'repolyo', 'broccoli', 'cauliflower', 'brussels sprouts', 'kale', 'bok choy', 'pechay'],
    iodineContent: 'High glucosinolates / goitrogens that inhibit thyroid iodide uptake',
    description: 'Cruciferous greens contain thiocyanates and goitrogens that compromise radioactive iodine efficacy.',
    substitutes: ['Sayote', 'Bell peppers', 'Kalabasa', 'Cucumbers', 'Zucchini', 'Carrots'],
    clinicalNotes: 'Do not eat raw or cooked cruciferous vegetables during the 2-week preparation window.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Contains goitrogens and thiocyanates that interfere with thyroid RAI trapping.', substitutes: ['Sayote', 'Bell peppers', 'Zucchini'] },
      low_purine: { status: STATUS.SAFE, note: 'Vegetable purines in cabbage/cauliflower are safe and do not provoke gout.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Naturally low in sodium, rich in fiber and micronutrients.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Low GI, fiber-packed superfood for blood sugar stabilization.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Cornerstone vegetable for keto: low net carbs, perfect rice substitute.', substitutes: [] }
    }
  },
  {
    id: 'seaweed-all',
    name: 'Sea Vegetables & Seaweed (Nori, Kelp, Wakame, Lato)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.AVOID,
    aliases: ['seaweed', 'kelp', 'kombu', 'wakame', 'nori', 'lato', 'sea grapes', 'ar-arusip', 'spirulina', 'sea moss'],
    iodineContent: 'Catastrophic (Up to 2,000+ mcg in a single strip)',
    description: 'The highest natural source of iodine on planet Earth.',
    substitutes: ['Dehydrated zucchini chips with kosher salt'],
    clinicalNotes: 'Even trace amounts will shut down radioactive iodine uptake completely.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'World’s richest iodine source (up to 2,000 mcg). Total therapy blocker.', substitutes: ['Dehydrated zucchini chips'] },
      low_purine: { status: STATUS.SAFE, note: 'Generally low in purines, but avoid seaweed seasoned with fish extracts.', substitutes: [] },
      low_sodium: { status: STATUS.AVOID, note: 'Natural oceanic salinity delivers excessive sodium.', substitutes: ['Fresh vegetable snacks'] },
      diabetic: { status: STATUS.SAFE, note: 'Zero sugar, rich in minerals.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Low carb, but verify no added sugars in flavored seaweed snacks.', substitutes: [] }
    }
  },
  {
    id: 'bell-peppers',
    name: 'Bell Peppers, Eggplant & Cucumbers',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['bell pepper', 'red bell pepper', 'green bell pepper', 'eggplant', 'talong', 'cucumber', 'pipino', 'zucchini'],
    iodineContent: '< 1 mcg',
    description: 'Sweet, crisp, full of Vitamin C and completely safe across all multi-diet protocols.',
    substitutes: [],
    clinicalNotes: 'Adds vibrant color, volume, and flavor without sodium or purines.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: '0 mcg iodine. Completely safe for all dishes.', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: 'Zero purines. Safe and hydrating.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Zero sodium, rich in potassium and hydration.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Very low glycemic index, high in antioxidant Vitamin C.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Low net carbs, excellent filler for keto stews.', substitutes: [] }
    }
  },
  {
    id: 'tomatoes-fresh',
    name: 'Fresh Tomatoes, Onions, Garlic & Ginger',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['fresh tomato', 'kamatis', 'onion', 'shallots', 'garlic', 'bawang', 'ginger', 'luya'],
    iodineContent: '< 1 mcg',
    description: 'The foundational aromatic base (Gisa) for healthy Filipino cooking.',
    substitutes: [],
    clinicalNotes: 'Must be fresh whole produce. Do not buy jarred pastes with iodized salt.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: '< 1 mcg iodine. The aromatic foundation of safe home cooking.', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: 'Zero purines. Garlic and onions have anti-inflammatory benefits.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Builds delicious umami flavor without any added sodium.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Low glycemic impact. Fresh garlic aids insulin sensitivity.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Essential aromatics for flavoring keto dishes.', substitutes: [] }
    }
  },

  // ==================== GRAINS, FLOURS & BAKERY ====================
  {
    id: 'white-brown-rice',
    name: 'White & Brown Rice (Sinandomeng, Dinorado, Jasmine)',
    category: LID_CATEGORIES.GRAINS,
    status: STATUS.SAFE,
    aliases: ['white rice', 'brown rice', 'jasmine rice', 'sinandomeng', 'dinorado', 'red rice'],
    iodineContent: '< 1-2 mcg per cup',
    description: 'The staple grain of the Philippines. 100% safe for LID when cooked in plain water.',
    substitutes: ['Cauliflower rice (for Diabetic/Keto)'],
    clinicalNotes: 'Cook at home in fresh water. Do not add restaurant bouillon cubes.',
    dietaryStatus: {
      lid: { status: STATUS.SAFE, note: '< 2 mcg iodine. The primary safe carbohydrate foundation for LID.', substitutes: [] },
      low_purine: { status: STATUS.SAFE, note: 'Virtually purine-free. Safe staple for gout patients.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Zero sodium when cooked in plain water.', substitutes: [] },
      diabetic: { status: STATUS.CAUTION, note: 'High glycemic index (~73 for white rice). Spikes blood sugar; switch to red/brown or cauliflower rice.', substitutes: ['Cauliflower rice', 'Red / Black heirloom rice', 'Shirataki rice'] },
      pinoy_keto: { status: STATUS.AVOID, note: 'Very high carbs (~45g net carbs/cup). Eliminates ketosis.', substitutes: ['Riced cauliflower', 'Shirataki konjac rice'] }
    }
  },
  {
    id: 'commercial-bread',
    name: 'Commercial White Bread, Pandesal & Buns',
    category: LID_CATEGORIES.GRAINS,
    status: STATUS.AVOID,
    aliases: ['white bread', 'pandesal', 'sliced bread', 'tasty bread', 'hamburger buns', 'baguettes', 'dough conditioner'],
    iodineContent: 'Extremely High (~150-300 mcg per slice if made with iodate conditioner)',
    description: 'Industrial bakeries use potassium iodate conditioners and iodized salt.',
    substitutes: ['Homemade bread made with non-iodized salt and active yeast', 'Plain boiled rice'],
    clinicalNotes: 'A single commercial burger bun can contain 400 mcg iodine due to iodate conditioners.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Potassium iodate dough conditioners deliver catastrophic doses of iodine.', substitutes: ['Homemade bread without iodate', 'Plain boiled rice'] },
      low_purine: { status: STATUS.SAFE, note: 'Low in purines.', substitutes: [] },
      low_sodium: { status: STATUS.CAUTION, note: 'Commercial bread is a stealth sodium source (~150-250mg per slice).', substitutes: ['Unsalted homemade bread'] },
      diabetic: { status: STATUS.AVOID, note: 'Refined white flour converts quickly into glucose (high GI).', substitutes: ['100% whole grain sprouted bread', 'Low-carb almond bread'] },
      pinoy_keto: { status: STATUS.AVOID, note: 'Dense refined wheat flour (~15g net carbs per slice).', substitutes: ['Almond flour keto pandesal', 'Cloud bread'] }
    }
  },

  // ==================== DAIRY & SWEETS ====================
  {
    id: 'cow-milk',
    name: 'Cow’s Milk & Goat’s Milk',
    category: LID_CATEGORIES.DAIRY_EGGS,
    status: STATUS.AVOID,
    aliases: ['milk', 'whole milk', 'skim milk', 'evaporated milk', 'condensed milk', 'powdered milk', 'gatas'],
    iodineContent: '~80-110 mcg per cup (Exceeds daily allowance in 1 glass)',
    description: 'Cattle udders are cleaned with iodophor iodine disinfectants and dairy feed is enriched with iodine.',
    substitutes: ['Homemade oat milk (filtered water + oats)', 'Black coffee / pure tea'],
    clinicalNotes: 'Commercial milk is one of the leading contributors to dietary iodine.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: '~80–110 mcg iodine per glass from cattle feed and iodophor udder washes.', substitutes: ['Homemade oat milk', 'Water-based smoothies'] },
      low_purine: { status: STATUS.SAFE, note: 'Low-fat dairy lowers serum uric acid and reduces gout risk.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Moderate sodium (~120mg/cup), safe in moderation.', substitutes: [] },
      diabetic: { status: STATUS.CAUTION, note: 'Contains lactose (~12g sugar/cup). Choose unsweetened almond milk.', substitutes: ['Unsweetened almond milk'] },
      pinoy_keto: { status: STATUS.CAUTION, note: 'Lactose contributes ~12g carbs per cup. Choose heavy cream or almond milk.', substitutes: ['Heavy whipping cream', 'Unsweetened almond milk'] }
    }
  },
  {
    id: 'sweetened-condensed-milk',
    name: 'Sweetened Condensed Milk (Gatas Kondensada)',
    category: LID_CATEGORIES.DAIRY_EGGS,
    status: STATUS.AVOID,
    aliases: ['condensed milk', 'sweetened condensed milk', 'alaska condensed', 'carnation condensed', 'kondensada'],
    iodineContent: 'High (Concentrated dairy + iodized processing)',
    description: 'Heavy dairy milk with over 55% sugar by weight. Widely used in desserts, halo-halo, and coffee.',
    substitutes: ['Coconut milk with erythritol / stevia', 'Pure maple syrup with non-dairy milk'],
    clinicalNotes: 'Dairy iodine concentration plus massive sugar content.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Concentrated dairy iodine plus commercial processing.', substitutes: ['Coconut cream + stevia / maple syrup'] },
      low_purine: { status: STATUS.SAFE, note: 'Dairy purines are low, but high sugar can indirectly elevate uric acid.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Moderate sodium, but check portion size.', substitutes: [] },
      diabetic: { status: STATUS.AVOID, note: 'Extreme sugar bomb (>22g sugar per 2 tablespoons). Rapid glucose spike.', substitutes: ['Unsweetened coconut cream + monk fruit sweetener'] },
      pinoy_keto: { status: STATUS.AVOID, note: 'Over 55% pure sugar. Complete keto disqualifier.', substitutes: ['Heavy whipping cream + erythritol'] }
    }
  },
  {
    id: 'cheese-all',
    name: 'All Cheeses (Cheddar, Mozzarella, Kesong Puti)',
    category: LID_CATEGORIES.DAIRY_EGGS,
    status: STATUS.AVOID,
    aliases: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'kesong puti', 'cream cheese', 'processed cheese', 'eden cheese'],
    iodineContent: 'Extremely High (Concentrated dairy milk solids)',
    description: 'Because cheese condenses large volumes of milk, the iodine content is multiplied.',
    substitutes: ['Mashed avocado with kosher salt and lemon'],
    clinicalNotes: 'All dairy cheese is strictly prohibited on the low-iodine diet.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Heavily concentrated dairy milk solids laden with dairy iodides.', substitutes: ['Mashed avocado with pure lemon and kosher salt'] },
      low_purine: { status: STATUS.SAFE, note: 'Dairy proteins are low in purines and help lower uric acid levels.', substitutes: [] },
      low_sodium: { status: STATUS.AVOID, note: 'High sodium from curing salt (often 300–400mg per slice). Limit on DASH.', substitutes: ['Unsalted ricotta', 'Fresh kesong puti (unsalted)'] },
      diabetic: { status: STATUS.SAFE, note: 'Low carbohydrate, high protein and fat.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Staple keto fat and protein food.', substitutes: [] }
    }
  },

  // ==================== ADDITIVES & SUPPLEMENTS ====================
  {
    id: 'carrageenan-e407',
    name: 'Carrageenan (E407) & Agar-Agar (Gulaman)',
    category: LID_CATEGORIES.ADDITIVES,
    status: STATUS.AVOID,
    aliases: ['carrageenan', 'e407', 'agar', 'agar-agar', 'gulaman', 'alginate', 'sodium alginate'],
    iodineContent: 'Massive (Direct sea algae polysaccharide derivative)',
    description: 'Common thickener in almond milk, deli meats, ice cream, and jellies.',
    substitutes: ['Pure cornstarch', 'Tapioca starch', 'Pectin'],
    clinicalNotes: 'One of the most widespread hidden sea additives in processed foods.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Seaweed extract saturated with marine iodine.', substitutes: ['Pure cornstarch', 'Pectin'] },
      low_purine: { status: STATUS.SAFE, note: 'Zero purine content.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Zero sodium.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Soluble fiber, zero glycemic effect.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Zero net carbs.', substitutes: [] }
    }
  },
  {
    id: 'red-dye-3-erythrosine',
    name: 'FD&C Red Dye #3 (Erythrosine / E127)',
    category: LID_CATEGORIES.ADDITIVES,
    status: STATUS.AVOID,
    aliases: ['red dye #3', 'red #3', 'erythrosine', 'e127', 'fd&c red 3'],
    iodineContent: 'Molecule is 58% elemental iodine by molecular weight!',
    description: 'Synthetic food coloring containing four iodine atoms per molecule.',
    substitutes: ['Beet juice concentrate', 'FD&C Red #40 (Allura Red)'],
    clinicalNotes: 'Red #3 releases free iodide upon metabolism. Absolute ban during RAI preparation.',
    dietaryStatus: {
      lid: { status: STATUS.AVOID, note: 'Chemical molecule contains 58% elemental iodine by weight!', substitutes: ['Beet juice concentrate', 'FD&C Red #40'] },
      low_purine: { status: STATUS.SAFE, note: 'Zero purines.', substitutes: [] },
      low_sodium: { status: STATUS.SAFE, note: 'Zero sodium.', substitutes: [] },
      diabetic: { status: STATUS.SAFE, note: 'Zero carbs, but avoid colored sugary snacks.', substitutes: [] },
      pinoy_keto: { status: STATUS.SAFE, note: 'Zero carbs.', substitutes: [] }
    }
  }
];

// Quick index maps for high-performance offline searching
export const SEARCH_INDEX = LID_DATABASE.flatMap(item => {
  const terms = [item.name, ...(item.aliases || [])];
  return terms.map(term => ({
    term: term.toLowerCase().trim(),
    item
  }));
});
