// Multi-Diet Clinical Protocol Guidelines & Regulatory Ground Truth
// Unified dictionary defining clinical targets, guidelines, prohibited, and permitted foods across all 5 protocols.

export const DEFAULT_LID_ADDITIVES = [
  { code: 'E127', name: 'Erythrosine / FD&C Red #3', status: 'AVOID', reason: 'Contains 58% elemental iodine by weight. Used in candies, cherries, pink syrups, and sausage casings.' },
  { code: 'E407', name: 'Carrageenan', status: 'AVOID', reason: 'Derived directly from red seaweed algae (Eucheuma/Kappaphycus). Ubiquitous thickener in plant milks and canned meats.' },
  { code: 'E406', name: 'Agar-Agar (Gulaman)', status: 'AVOID', reason: 'Marine red algae gelatin substitute naturally saturated with coastal sea minerals and elemental iodine.' },
  { code: 'E401 - E404', name: 'Alginates (Sodium/Calcium Alginate)', status: 'AVOID', reason: 'Extracted from brown marine seaweeds and kelp; high bioavailable bound iodine load.' },
  { code: 'E916', name: 'Calcium Iodate', status: 'AVOID', reason: 'Industrial iodate dough conditioner used in commercial bakeries and loaf bread.' },
  { code: 'E917', name: 'Potassium Iodate', status: 'AVOID', reason: 'Potent iodate dough conditioner used in commercial sliced bread manufacturing.' },
  { code: 'Red Dye #40', name: 'Allura Red AC', status: 'SAFE', reason: 'Petroleum-based synthetic azo dye; chemically free of elemental iodine atoms.' },
  { code: 'E300', name: 'Ascorbic Acid (Vitamin C)', status: 'SAFE', reason: 'Safe antioxidant and dough improver; zero oceanic iodine.' },
  { code: 'E330', name: 'Citric Acid', status: 'SAFE', reason: 'Safe natural organic acid preservative and acidifier; zero marine origin.' },
  { code: 'E415', name: 'Xanthan Gum', status: 'SAFE', reason: 'Fermentation gum produced by Xanthomonas campestris; non-marine origin with zero iodine.' },
  { code: 'E412', name: 'Guar Gum', status: 'SAFE', reason: 'Derived from cluster bean / guar seeds; safe non-marine thickener.' }
];

export const PROTOCOL_ADDITIVES = {
  lid: DEFAULT_LID_ADDITIVES,

  diabetic: [
    { code: 'Maltodextrin', name: 'Maltodextrin', status: 'AVOID', reason: 'Ultra-high glycemic index (GI 85–105, higher than table sugar); triggers severe postprandial glucose spikes.' },
    { code: 'Dextrose', name: 'Dextrose / Pure D-Glucose', status: 'AVOID', reason: 'Direct crystalline glucose (GI 100); instantly absorbed into bloodstream provoking acute hyperglycemia.' },
    { code: 'E965', name: 'Maltitol & Maltitol Syrup', status: 'AVOID', reason: 'High-GI sugar alcohol (GI 35–52) with ~75% glycemic load of sucrose; triggers hidden glucose spikes in "sugar-free" treats.' },
    { code: 'Glucose Syrups', name: 'Glucose-Fructose / Corn Syrup Solids', status: 'AVOID', reason: 'Concentrated free simple sugars that rapidly saturate hepatic insulin pathways.' },
    { code: 'E951', name: 'Aspartame', status: 'CAUTION', reason: 'Zero direct glycemic impact, but synthetic sweetener that may heighten sweet cravings and alter microbiome.' },
    { code: 'E960', name: 'Steviol Glycosides (Pure Stevia)', status: 'SAFE', reason: 'Zero-calorie natural herbal plant sweetener with GI 0; zero glycemic response or insulin demand.' },
    { code: 'E968', name: 'Erythritol', status: 'SAFE', reason: 'Zero-calorie sugar alcohol with GI 0; rapidly absorbed in small intestine and excreted unchanged without glucose impact.' },
    { code: 'Monk Fruit', name: 'Luo Han Guo Extract (Mogrosides)', status: 'SAFE', reason: 'Intense natural antioxidant sweetener with GI 0; zero effect on blood glucose or HbA1c.' },
    { code: 'E415', name: 'Xanthan Gum / Soluble Fiber', status: 'SAFE', reason: 'Soluble dietary fiber that delays gastric emptying and blunts postprandial carbohydrate absorption.' },
    { code: 'E300', name: 'Ascorbic Acid (Vitamin C)', status: 'SAFE', reason: 'Safe antioxidant that supports vascular endothelial function in diabetic patients.' }
  ],

  low_purine: [
    { code: 'E627', name: 'Disodium Guanylate', status: 'AVOID', reason: 'Purine nucleotide synthesized from guanosine; directly metabolizes into uric acid and triggers acute gout flares.' },
    { code: 'E631', name: 'Disodium Inosinate', status: 'AVOID', reason: 'Inosine monophosphate (IMP) derived from meat or yeast extract; potent concentrated purine source.' },
    { code: 'E621', name: 'Monosodium Glutamate / Yeast Extract (MSG)', status: 'AVOID', reason: 'Commercial savory enhancer frequently formulated with brewer’s yeast and ribonucleotides (I+G) that elevate purine degradation.' },
    { code: 'HFCS', name: 'High-Fructose Corn Syrup', status: 'AVOID', reason: 'Hepatic fructolysis accelerates ATP degradation into AMP and uric acid, rapidly inducing hyperuricemia.' },
    { code: 'E150c/d', name: 'Ammonia / Caramel Color', status: 'CAUTION', reason: 'Industrial caramel color often formulated with malt or carbohydrate syrups; verify purity.' },
    { code: 'E300', name: 'Ascorbic Acid (Vitamin C)', status: 'SAFE', reason: 'Potent antioxidant that promotes renal uricosuric excretion and significantly lowers serum uric acid.' },
    { code: 'E330 / E332', name: 'Citric Acid & Potassium Citrate', status: 'SAFE', reason: 'Alkalinizes urine (elevates urinary pH), preventing crystallization of uric acid kidney stones.' },
    { code: 'E415', name: 'Xanthan Gum', status: 'SAFE', reason: 'Safe bacterial fermentation polysaccharide; negligible purine content.' },
    { code: 'E440', name: 'Pectin', status: 'SAFE', reason: 'Soluble dietary fiber from citrus peels; zero purine load.' }
  ],

  low_sodium: [
    { code: 'E211', name: 'Sodium Benzoate', status: 'AVOID', reason: 'Ubiquitous chemical preservative in bottled beverages, toyomansi, and sauces; adds substantial hidden sodium load.' },
    { code: 'E250', name: 'Sodium Nitrite', status: 'AVOID', reason: 'Curing salt in processed meats (tocino, longganisa, hotdogs, corned beef); concentrated sodium and vascular stressor.' },
    { code: 'E621', name: 'Monosodium Glutamate (MSG / Vetsin)', status: 'AVOID', reason: 'Concentrated sodium salt of glutamic acid (~12% pure sodium by weight); heavily added to commercial Pinoy seasoning granules.' },
    { code: 'E339 / E450', name: 'Disodium Phosphate & Sodium Polyphosphates', status: 'AVOID', reason: 'Inorganic sodium phosphate additives used as texturizers in processed cheese, cured meats, and canned soups.' },
    { code: 'E500', name: 'Sodium Bicarbonate (Baking Soda)', status: 'CAUTION', reason: 'High sodium density (1,260mg sodium per teaspoon) in commercial pancakes, baked snacks, and meat tenderizers.' },
    { code: 'E508', name: 'Potassium Chloride', status: 'SAFE', reason: 'Sodium-free mineral salt substitute; helps balance electrolytes and lower vascular pressure (with normal renal function).' },
    { code: 'E330', name: 'Citric Acid', status: 'SAFE', reason: 'Sodium-free organic acid providing clean tartness to enhance flavor without adding salt.' },
    { code: 'E300', name: 'Ascorbic Acid (Vitamin C)', status: 'SAFE', reason: '100% sodium-free antioxidant and natural preservative.' },
    { code: 'E440', name: 'Pectin', status: 'SAFE', reason: 'Natural citrus fruit fiber thickener completely free of added sodium minerals.' },
    { code: 'E415', name: 'Xanthan Gum', status: 'SAFE', reason: 'Sodium-free plant-based stabilizer and thickener for home-cooked sauces.' }
  ],

  pinoy_keto: [
    { code: 'Modified Starch', name: 'Modified Food Starch (E1400–E1451)', status: 'AVOID', reason: 'Industrial corn, tapioca, or potato starch; rapidly degrades into glucose and halts ketosis immediately.' },
    { code: 'Tapioca Flour', name: 'Cassava / Tapioca Starch', status: 'AVOID', reason: 'Ultra-dense starchy binder used in street food fish balls, kikiam, and gravies (~88% net carbs).' },
    { code: 'Maltodextrin', name: 'Maltodextrin / Corn Dextrin', status: 'AVOID', reason: 'High-GI carbohydrate filler (GI 85–105) bulked into powdered sweeteners; abruptly breaks nutritional ketosis.' },
    { code: 'E965', name: 'Maltitol & Maltitol Syrup', status: 'AVOID', reason: 'Insulin-spiking polyol (GI 35–52) disguised in commercial "low carb" snacks; halts hepatic ketone production.' },
    { code: 'E950', name: 'Acesulfame Potassium (Ace-K)', status: 'CAUTION', reason: 'Non-caloric sweetener often blended with sucralose, but may stimulate mild cephalic insulin response.' },
    { code: 'E968', name: 'Erythritol', status: 'SAFE', reason: '100% keto-approved polyol; GI 0, zero net carbs, does not elevate blood glucose or disrupt ketosis.' },
    { code: 'E960', name: 'Steviol Glycosides (Pure Stevia)', status: 'SAFE', reason: 'Natural herbal sweetener with zero carbs, zero calories, and zero effect on ketone production.' },
    { code: 'Monk Fruit', name: 'Pure Monk Fruit (Mogroside V)', status: 'SAFE', reason: '100% carbohydrate-free natural sweetener compatible with strict ketogenic macronutrient ratios.' },
    { code: 'E415', name: 'Xanthan Gum', status: 'SAFE', reason: 'Pure soluble fiber (<1g net carb); ideal low-carb thickener to replace cornstarch slurries in sauces and gravies.' },
    { code: 'E412', name: 'Guar Gum', status: 'SAFE', reason: 'Soluble seed fiber with negligible net carbs; safe thickener for keto dressings and sauces.' }
  ]
};

export const PROTOCOL_GUIDELINES = {
  lid: {
    id: "lid",
    name: "Low-Iodine Diet (LID / RAI)",
    dailyTarget: "< 50 mcg Iodine / Day",
    duration: "14 Days (Pre-RAI)",
    permittedSeasoning: "Pure Kosher / Non-Iodized Salt",
    rationale: "Strict low-iodine protocol to maximize radioiodine uptake in thyroid tissue.",
    prohibitedSubtitle: "Foods with high natural iodine, iodized salt, marine seaweeds, or dairy",
    prohibited: [
      { name: "Iodized Salt & Sea Salt", desc: "Table salt, rock salt, sea salt, Himalayan pink salt (-71 mcg per 1/4 tsp)." },
      { name: "Marine Seafood & Seaweeds", desc: "All fish, shellfish (hipon, alimango), nori, kelp, lato, and ar-arusip." },
      { name: "Dairy & Whey Products", desc: "Cow/goat milk, butter, cheese, yogurt, cottage cheese, and milk chocolate." },
      { name: "Egg Yolks & Whole Eggs", desc: "Whole eggs, mayo, custard, leche flan (egg whites are permitted)." },
      { name: "Soy & Commercial Sauces", desc: "Toyo (soy sauce), tamari, tofu, tokwa, taho, and soy isoflavones." },
      { name: "Commercial Bakery & Food Dyes", desc: "Bakery goods with iodate dough conditioners, Red Dye #3 (erythrosine)." }
    ],
    permittedSubtitle: "Nutritious, zero-to-low iodine foods for home preparation",
    permitted: [
      { name: "Pure Non-Iodized Salt", desc: "Pure kosher salt (Diamond Crystal / Morton coarse non-iodized), canning/pickling salt." },
      { name: "Pure Egg Whites", desc: "Fresh separated egg whites (albumen) or 100% pure liquid egg whites without added salt." },
      { name: "Fresh Raw Supermarket Meats", desc: "Fresh uncured beef, pork, and skinless chicken without broth injection or brines." },
      { name: "Safe Local Produce", desc: "Sayote (chayote), kalabasa (squash), ampalaya, eggplant, tomatoes, onions, garlic, calamansi." },
      { name: "Pure Grains & Plant Oils", desc: "White rice, rolled oats, dry semolina pasta, 100% pure coconut oil, olive oil, canola oil." }
    ],
    additives: PROTOCOL_ADDITIVES.lid,
    diningWarning: {
      title: "Dining Out & Restaurant Warning",
      text: "Commercial restaurants and caterers almost universally use iodized table salt, commercial bouillon powders, salted butter, and seafood bases. Dining out is the #1 documented cause of unintentional Low-Iodine Diet failure.",
      advice: "Prepare fresh chicken, boiled rice, sayote stir-fries, and sliced apples ahead of time in leakproof containers. If ordering at a restaurant, request completely unseasoned, unmarinated grilled beef or chicken cooked with clean dry heat, steamed white rice, and bring your own small jar of pure non-iodized kosher salt."
    }
  },

  diabetic: {
    id: "diabetic",
    name: "Diabetic & Low-GI Protocol",
    dailyTarget: "< 130g Total Carbs / Day (Low-GI)",
    duration: "Ongoing Lifestyle",
    permittedSeasoning: "Natural Herbs, Calamansi, Garlic, Bitter Melon",
    rationale: "Stabilize glycemic load, prevent insulin spikes, and promote cellular glucose uptake.",
    prohibitedSubtitle: "High-glycemic sugars, refined starches, and rapid-release carbohydrates",
    prohibited: [
      { name: "Refined Sugars & Syrups", desc: "White/brown sugar, condensed milk, muscovado, commercial sweet banana ketchup." },
      { name: "Refined Grains & White Rice", desc: "Uncontrolled polished white rice, white bread (pan de sal), rice flour noodles (bihon)." },
      { name: "Sweetened Drinks & Desserts", desc: "Sago't gulaman, bottled iced teas, sweetened juices, halo-halo with heavy syrups." },
      { name: "Deep-Fried Battered Foods", desc: "Starchy flour-battered fried chicken, tempura, and street food fish balls with sweet sauce." },
      { name: "High-GI Root Vegetables", desc: "Instant mashed potatoes, excessive cassava, sweet corn, and candied yams." }
    ],
    permittedSubtitle: "Fiber-rich vegetables, lean proteins, and low-glycemic staples",
    permitted: [
      { name: "Non-Starchy Vegetables", desc: "Ampalaya (bitter melon), talbos ng kamote, kangkong, sitaw, pechay, sayote, eggplant." },
      { name: "Lean Protein Sources", desc: "Skinless chicken breast, whole eggs, native bangus, lean beef, and firm tofu." },
      { name: "Complex & High-Fiber Carbohydrates", desc: "Controlled portions of brown rice, rolled oats, quinoa, cauliflower rice, and legumes." },
      { name: "Healthy Plant Fats", desc: "Pure olive oil, virgin coconut oil, native avocados, and raw nuts/seeds." },
      { name: "Natural Citrus & Acids", desc: "Fresh calamansi juice, sukang Paombong, garlic, fresh ginger, and siling labuyo." }
    ],
    additives: PROTOCOL_ADDITIVES.diabetic,
    diningWarning: {
      title: "Dining Out & Sweet Sauce Warning",
      text: "Philippine restaurant marinades, barbecue glazes, and tomato-based stews (afritada, mechado) commonly contain hidden refined white sugar, condensed milk, and cornstarch thickeners.",
      advice: "Opt for ihaw-ihaw grilled dishes requested with zero sweet basting sauce, order sinigang cooked with real calamansi or sampalok fruit (not powdered sugar-mix), and request extra vegetables instead of double rice."
    }
  },

  low_purine: {
    id: "low_purine",
    name: "Low-Purine & Anti-Uric Acid Protocol",
    dailyTarget: "< 100-150 mg Purines / Day",
    duration: "Ongoing Flare Prevention",
    permittedSeasoning: "Ginger, Calamansi, Pechay, Sayote Infusions",
    rationale: "Minimize serum uric acid formation to prevent gout flares and urate kidney stones.",
    prohibitedSubtitle: "High-purine meats, organ meats, yeast extracts, and specific seafood",
    prohibited: [
      { name: "Organ Meats (Offal)", desc: "Strictly no isaw, atay (liver), bopis, dinuguan, heart, kidneys, or tripe." },
      { name: "High-Purine Seafood", desc: "Canned sardines, anchovies (dilis), mackerel, tuna, mussels (tahong), and oysters (talaba)." },
      { name: "Concentrated Bone & Meat Broths", desc: "Long-boiled bulalo broths, heavy meat gravies, bouillon cubes, and beef extract stocks." },
      { name: "Alcohol & High-Fructose Syrups", desc: "Beer (contains brewer's yeast guanosine), hard spirits, and high-fructose corn syrup sodas." },
      { name: "Yeast Extracts", desc: "Brewer's yeast, nutritional yeast flakes, and concentrated yeast-based spreads." }
    ],
    permittedSubtitle: "Low-purine hydrating vegetables, plant-based foods, and moderate proteins",
    permitted: [
      { name: "Hydrating Vegetables", desc: "Bottle gourd (upo), patola, cucumber (pipino), sayote, carrots, and sweet bell peppers." },
      { name: "Low-Purine Protein", desc: "Farm-fresh whole eggs, low-fat dairy products, and moderate portions of skinless chicken." },
      { name: "Staple Carbohydrates", desc: "Steamed white/brown rice, corn grits, rolled oats, potatoes, and plain pasta." },
      { name: "Alkalizing Fruits", desc: "Calamansi, native cherries, apples, papayas, and vitamin C-rich fresh fruits." },
      { name: "Abundant Hydration", desc: "Drink 2.5–3 liters of clean filtered water daily to accelerate urinary uric acid excretion." }
    ],
    additives: PROTOCOL_ADDITIVES.low_purine,
    diningWarning: {
      title: "Dining Out & Carinderia Broth Warning",
      text: "Carinderia soups (bulalo, nilaga, batchoy) rely on marrow bone boiling and organ meat simmer broths that concentrate purines up to 400mg per serving.",
      advice: "Avoid meat broths and gravies completely when dining out. Choose pesang manok or vegetable stir-fries (ginisang upo) prepared with clean water, and stay well-hydrated throughout the day."
    }
  },

  low_sodium: {
    id: "low_sodium",
    name: "Low-Sodium & Heart-Care (DASH)",
    dailyTarget: "< 1,500 - 2,000 mg Sodium / Day",
    duration: "Ongoing Cardiovascular Care",
    permittedSeasoning: "Calamansi, Garlic, Roasted Ginger, Siling Labuyo",
    rationale: "Lower vascular resistance, decrease arterial fluid retention, and protect renal function.",
    prohibitedSubtitle: "Concentrated savory condiments, cured charcuterie, and bouillon enhancers",
    prohibited: [
      { name: "Traditional Fermented Sauces", desc: "Patis (fish sauce), bagoong alamang, bagoong isda, and commercial soy sauce (toyo)." },
      { name: "Cured & Processed Pinoy Meats", desc: "Tocino, longganisa, sweet ham, canned corned beef, luncheon meat, and hotdogs." },
      { name: "Bouillon Cubes & Monosodium Glutamate", desc: "Chicken/beef flavoring cubes, seasoning granules (Magic Sarap, Ajinomoto MSG)." },
      { name: "Preserved / Salted Seafood", desc: "Tuyo, daing, danggit, tinapa (smoked fish), and salted duck eggs (itlog na maalat)." },
      { name: "Instant Noodles & Canned Soups", desc: "Packaged ramen/pancit canton seasoning packets and commercial condensed cream soups." }
    ],
    permittedSubtitle: "High-potassium produce, fresh unseasoned meats, and natural acid enhancers",
    permitted: [
      { name: "Potassium-Rich Vegetables", desc: "Green cabbage (repolyo), Baguio beans, sayote, kalabasa, tomatoes, and pechay." },
      { name: "Fresh Unsalted Meats", desc: "Fresh raw beef loin, pork tenderloin, skinless chicken, and fresh bangus (unbrined)." },
      { name: "Natural Umami Enhancers", desc: "Pure calamansi juice, native garlic, roasted ginger, caramelized sweet onions, black pepper." },
      { name: "Whole Grains & Tubers", desc: "Kamote (sweet potato), steamed white or brown rice, singkamas (jicama), and rolled oats." },
      { name: "Clean Cooking Fats", desc: "Extra virgin olive oil, cold-pressed coconut oil, and unsalted sunflower oil." }
    ],
    additives: PROTOCOL_ADDITIVES.low_sodium,
    diningWarning: {
      title: "Dining Out & Hidden Sodium Warning",
      text: "Filipino fast food and commercial kitchens heavily rely on patis dipping saucers, toyomansi, and seasoning granules (MSG + salt). A single restaurant serving of adobo or sinigang can contain 2,500mg+ sodium.",
      advice: "Always ask for 'walang patis, walang vetsin' (no fish sauce, no MSG). Order fresh calamansi wedges and crushed garlic on the side to create your own zero-sodium table dip."
    }
  },

  pinoy_keto: {
    id: "pinoy_keto",
    name: "Pinoy Keto / Low-Carb Protocol",
    dailyTarget: "< 20-50g Net Carbs / Day",
    duration: "Ketogenic Phase",
    permittedSeasoning: "Pure Coconut Oil, Sukang Paombong, Coconut Aminos",
    rationale: "Induce nutritional ketosis by depleting glycogen stores and relying on dietary and body fats.",
    prohibitedSubtitle: "Starches, added sugars, high-carb vegetables, and seed oils",
    prohibited: [
      { name: "All Dietary Sugars & Sweeteners", desc: "Cane sugar, muscovado, corn syrup, honey, coconut sugar, condensed milk, sweet marinades." },
      { name: "Starchy Staples & Grains", desc: "White rice, brown rice, corn, oatmeal, wheat bread, pasta, and all flour noodles." },
      { name: "Starchy Root Vegetables", desc: "Potatoes, camote (sweet potato), cassava, gabi (taro), and ube." },
      { name: "Sweet Fruits & Tropical Juices", desc: "Ripe mango, ripe banana (saba/latundan), pineapple, watermelon, and fruit concentrates." },
      { name: "Starch Thickeners & Sweet Sauces", desc: "Cornstarch slurries, sweet banana ketchup, sweet-and-sour glazes, and flour roux." }
    ],
    permittedSubtitle: "Healthy fats, moderate proteins, and low-carb cruciferous greens",
    permitted: [
      { name: "Wholesome Pinoy Fats", desc: "Pure kakang gata (coconut cream), pure coconut oil, grass-fed butter, natural pork lard." },
      { name: "Meats & Seafood", desc: "Pork belly (liempo), chicken thigh with skin, beef shank, flaked tinapa, and bangus belly." },
      { name: "Low-Carb Vegetables", desc: "Kangkong, dahon ng sili, sayote in moderate amounts, pechay, ampalaya, cucumber, cabbage." },
      { name: "Whole Native Eggs", desc: "Farm-fresh chicken and duck eggs cooked in healthy fats (omelets, sunny-side up)." },
      { name: "Zero-Carb Condiments", desc: "Sukang Paombong/sukang tuba (coconut vinegar), crushed garlic, siling labuyo, black pepper." }
    ],
    additives: PROTOCOL_ADDITIVES.pinoy_keto,
    diningWarning: {
      title: "Dining Out & Hidden Sugar/Starch Warning",
      text: "Even savory-sounding Pinoy favorites (inasal, adobo, lechon sauce) frequently contain brown sugar marinades, sweet banana ketchup, and flour-thickened gravies.",
      advice: "Order plain roasted chicken (lechon manok) without gravy, or crispy pata / lechon kawali dipped exclusively in spiced coconut vinegar with garlic and sili. Decline the rice and ask for cucumber slices."
    }
  }
};

/**
 * Normalizes any diet key or label to one of the 5 canonical PROTOCOL_GUIDELINES keys:
 * 'lid' | 'diabetic' | 'low_purine' | 'low_sodium' | 'pinoy_keto'
 */
export function normalizeDietProtocolKey(activeDiet) {
  const d = (activeDiet || '').toLowerCase().trim();
  if (d.includes('diabetic') || d.includes('glucose') || d.includes('sugar')) return 'diabetic';
  if (d.includes('purine') || d.includes('uric') || d.includes('gout')) return 'low_purine';
  if (d.includes('sodium') || d.includes('heart') || d.includes('dash') || d.includes('pressure')) return 'low_sodium';
  if (d.includes('keto') || d.includes('carb')) return 'pinoy_keto';
  return 'lid';
}

/**
 * Retrieves the protocol guidelines object for a given diet
 */
export function getProtocolGuidelines(activeDiet) {
  const key = normalizeDietProtocolKey(activeDiet);
  return PROTOCOL_GUIDELINES[key] || PROTOCOL_GUIDELINES.lid;
}
