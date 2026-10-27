// Multi-Diet Clinical Protocol Guidelines & Regulatory Ground Truth
// Unified dictionary defining clinical targets, guidelines, prohibited, and permitted foods across all 5 protocols.

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
