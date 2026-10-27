// Clinical Protocol Guidelines for Radioactive Iodine (RAI) Therapy Preparation
// Medical Ground Truth Reference
export { PROTOCOL_GUIDELINES, normalizeDietProtocolKey, getProtocolGuidelines } from './protocolGuidelines.js';

export const PROTOCOL_INFO = {
  title: 'Low-Iodine Diet (LID) Clinical Protocol',
  target: '< 50 micrograms of iodine per day',
  duration: 'Typically 1 to 2 weeks prior to RAI scan or ablation dose',
  purpose: 'Deplete the body and residual thyroid tissue of normal iodine so that when Radioactive Iodine (I-131 or I-123) is administered, any residual thyroid cells avidly absorb the radiation, maximizing therapeutic destruction of thyroid cancer or hyperthyroid tissue.',
  disclaimer: 'This application serves as an educational and grocery reference based on published nuclear medicine clinical guidelines. Always adhere to the specific protocol and dates provided by your attending endocrinologist.'
};

export const PROTOCOL_SECTIONS = [
  {
    id: 'forbidden',
    title: 'Strictly Prohibited (AVOID 🔴)',
    subtitle: 'Foods with high natural iodine, iodized salt, goitrogens, or dairy',
    items: [
      {
        title: 'Iodized Salt & Sea Salt',
        detail: 'Any table salt, rock salt, sea salt, or Himalayan pink salt. Standard iodized salt supplies ~71 mcg per 1/4 tsp.'
      },
      {
        title: 'Sea Vegetables & Marine Life',
        detail: 'All fish (tuna, cod, salmon, bangus, tilapia, sushi), shellfish (lobster, shrimp, crabs, oysters, mussels), and seaweeds (kombu, nori, wakame, kelp, lato, ar-arusip).'
      },
      {
        title: 'Dairy Products & Byproducts',
        detail: 'Cow/goat milk, butter, cheese, yogurt, cottage cheese, cheddar, sour cream, heavy cream, milk chocolate, whey, and casein.'
      },
      {
        title: 'Egg Yolks & Whole Eggs',
        detail: 'Whole eggs, egg yolks, mayonnaise made with whole eggs, custard, hollandaise, baked goods with yolks (~12-25 mcg per egg yolk).'
      },
      {
        title: 'Legumes & Specific Beans',
        detail: 'Lima beans, black beans, green beans/pod beans (Baguio beans), kidney beans, soybeans, and lentils.'
      },
      {
        title: 'Soy Products & NIS Inhibitors',
        detail: 'Soy sauce (toyo), tamari, soy milk, tofu (tokwa), taho, edamame, and soybean isoflavones.'
      },
      {
        title: 'Poultry Specifics',
        detail: 'Turkey breast (due to ubiquitous commercial salt/broth injection).'
      },
      {
        title: 'Specific Fruits',
        detail: 'Prunes, dried prunes, bananas, pineapple, strawberries, cranberries, and maraschino cherries.'
      },
      {
        title: 'Commercial Bakery Goods',
        detail: 'Store-bought sliced breads, rolls, hamburger buns made with iodate dough conditioners (potassium iodate / calcium iodate).'
      },
      {
        title: 'Specific Vegetables & Goitrogens',
        detail: 'Potatoes (~60 mcg per potato), watercress, cassava (kamoteng kahoy), millet, and cruciferous vegetables (cabbage / repolyo, broccoli, cauliflower, Brussels sprouts).'
      },
      {
        title: 'Food Additives & Dyes',
        detail: 'Seaweed additives: Carrageenan (E407), agar-agar (E406), alginate (E401-E404). FD&C Red Dye #3 (Erythrosine / E127). Blackstrap molasses.'
      },
      {
        title: 'Supplements & Medications',
        detail: 'Multivitamins containing iodine, kelp pills, herbal concoctions, expectorant syrups with KI, amiodarone, and topical povidone-iodine (Betadine).'
      },
      {
        title: 'Restaurant & Fast Food',
        detail: 'Takeout, fast food, and dining out due to universal commercial reliance on iodized salt and bouillon.'
      }
    ]
  },
  {
    id: 'allowed',
    title: 'Strictly Permitted (SAFE 🟢)',
    subtitle: 'Nutritious, zero-to-low iodine foods for home preparation',
    items: [
      {
        title: 'Pure Non-Iodized Salt',
        detail: 'Pure kosher salt (e.g. Diamond Crystal Kosher or Morton Coarse Kosher without yellow prussiate or iodine), pickling salt, canning salt.'
      },
      {
        title: 'Pure Egg Whites',
        detail: 'Fresh separated egg whites (albumen) or 100% pure liquid egg whites without added salt.'
      },
      {
        title: 'Fresh Raw Meats',
        detail: 'Uncured, unbrined, unseasoned fresh beef, pork, and chicken (fresh raw supermarket cuts without broth solution).'
      },
      {
        title: 'Safe Vegetables',
        detail: 'Sayote (chayote), kalabasa (squash), bell peppers, zucchini, eggplant (talong), ampalaya, patola, upo, fresh tomatoes, fresh onions, garlic, scallions, ginger, carrots, cucumbers, crisp lettuce.'
      },
      {
        title: 'Allowed Grains & Flours',
        detail: 'Plain unbleached flour, all-purpose flour, pure cornstarch, white/brown rice, rolled oats, and dry semolina pasta (egg-free).'
      },
      {
        title: 'Pure Oils & Fats',
        detail: '100% pure coconut oil, canola oil, corn oil, extra virgin olive oil, and avocado oil.'
      },
      {
        title: 'Pure Spices & Dried Herbs',
        detail: 'Pure black pepper, white pepper, fresh chili peppers (siling labuyo, siling haba), pure dried oregano, basil, rosemary, thyme, cumin, turmeric, and paprika (no salt blends).'
      },
      {
        title: 'Safe Sweets & Syrups',
        detail: 'Pure white/brown sugar, pure raw honey, 100% pure maple syrup, pure jams without Red #3, and pure unsulfured molasses.'
      },
      {
        title: 'Beverages',
        detail: 'Pure black coffee, pure green or black tea, pure club soda, homemade lemonade, calamansi juice, fresh apple juice, watermelon juice.'
      }
    ]
  },
  {
    id: 'caution',
    title: 'Check Label (CAUTION 🟡)',
    subtitle: 'Verify manufacturing ingredients before consuming',
    items: [
      {
        title: 'Canned Plain Tomato Products',
        detail: 'Safe only if canned without salt or explicitly with non-iodized salt. Most commercial brands use iodized salt.'
      },
      {
        title: 'Commercial Plant Milks',
        detail: 'Almond and oat milks often add sea salt and carrageenan (E407) as thickeners. Check label or make oat milk at home.'
      },
      {
        title: 'Frozen Plain Vegetables',
        detail: 'Inspect packaging: must contain only 100% single vegetables, zero added sodium, seasonings, or butter sauce.'
      },
      {
        title: 'Dark Chocolate',
        detail: 'Safe only if 100% dairy-free without milk solids, whey, or soy lecithin.'
      },
      {
        title: 'Coconut Aminos',
        detail: 'Safe only if verified made with non-iodized salt (some manufacturers use sea salt).'
      }
    ]
  }
];

export const ADDITIVES_REFERENCE = [
  { code: 'E127', name: 'Erythrosine / FD&C Red #3', status: 'AVOID', reason: 'Contains 58% elemental iodine by weight. Used in candies, cherries, pink syrups.' },
  { code: 'E407', name: 'Carrageenan', status: 'AVOID', reason: 'Derived directly from red seaweed algae. Ubiquitous thickener in plant milks and meats.' },
  { code: 'E406', name: 'Agar-Agar (Gulaman)', status: 'AVOID', reason: 'Red algae extract rich in marine iodine.' },
  { code: 'E401 - E404', name: 'Alginates (Sodium/Calcium Alginate)', status: 'AVOID', reason: 'Extracted from brown kelp and seaweeds.' },
  { code: 'E916', name: 'Calcium Iodate', status: 'AVOID', reason: 'Iodate dough conditioner used in industrial bakeries.' },
  { code: 'E917', name: 'Potassium Iodate', status: 'AVOID', reason: 'Potent iodate dough conditioner used in commercial breads.' },
  { code: 'Red Dye #40', name: 'Allura Red AC', status: 'SAFE', reason: 'Petroleum-based synthetic red color without iodine atoms.' },
  { code: 'E300', name: 'Ascorbic Acid (Vitamin C)', status: 'SAFE', reason: 'Safe antioxidant and dough improver.' },
  { code: 'E330', name: 'Citric Acid', status: 'SAFE', reason: 'Safe natural organic acid preservative.' },
  { code: 'E415', name: 'Xanthan Gum', status: 'SAFE', reason: 'Bacterial fermentation gum; does not contain oceanic iodine.' },
  { code: 'E412', name: 'Guar Gum', status: 'SAFE', reason: 'Derived from guar seeds; safe thickener.' }
];

export const SMART_SUBSTITUTES_BY_DIET = {
  lid: [
    {
      forbidden: 'Table Salt / Iodized Salt',
      risk: '~71 mcg per 1/4 tsp (Exceeds daily budget)',
      substitute: 'Diamond Crystal or Morton Non-Iodized Kosher Salt',
      culinaryTip: 'Keep a small shaker of pure non-iodized kosher salt on your kitchen counter. It provides clean, bright seasoning with 0 mcg added iodine.'
    },
    {
      forbidden: 'Soy Sauce (Toyo)',
      risk: 'High iodized brine + thyroid NIS-inhibiting soy isoflavones',
      substitute: 'Homemade Garlic-Vinegar Glaze / Reduction',
      culinaryTip: 'Simmer pure cane vinegar, minced garlic, cracked black pepper, a pinch of brown sugar, and kosher salt. It provides the tangy, savory depth of adobo without soy.'
    },
    {
      forbidden: 'Whole Eggs & Egg Yolks',
      risk: '~12-25 mcg per yolk (Chickens fed iodine-fortified meal)',
      substitute: 'Pure Separated Egg Whites',
      culinaryTip: 'Use 2 egg whites for every 1 whole egg in omelets, scrambled eggs, and baking. Add fresh tomatoes, scallions, and peppers for flavor.'
    },
    {
      forbidden: 'Cow’s Milk & Butter',
      risk: '~80-110 mcg per glass of milk (Udder iodophors + dairy feed)',
      substitute: 'Homemade Oat Milk & Pure Coconut/Olive Oil',
      culinaryTip: 'Blend 1 cup rolled oats with 4 cups water and a pinch of brown sugar for 30 seconds; strain through a cloth. Use pure coconut oil or olive oil for cooking fat.'
    },
    {
      forbidden: 'Commercial White Bread',
      risk: '~150-300 mcg per slice from iodate dough conditioners',
      substitute: 'Homemade No-Knead Bread or Plain Boiled Rice',
      culinaryTip: 'Bake a simple loaf at home using unbleached flour, active dry yeast, filtered water, olive oil, and non-iodized kosher salt. Or enjoy fragrant jasmine rice!'
    },
    {
      forbidden: 'Canned Tuna & Seafood',
      risk: '100-300+ mcg per serving of marine animal protein',
      substitute: 'Fresh Raw Chicken Breast or Pork Tenderloin',
      culinaryTip: 'Shred poached fresh chicken breast with homemade egg-white mayo, celery, and black pepper for a delicious chicken salad sandwich filling.'
    }
  ],
  pinoy_keto: [
    {
      forbidden: 'Table Sugar & Sweet Marinades',
      risk: 'Pure sucrose triggers rapid insulin response and breaks ketosis',
      substitute: 'Pure Erythritol / Monkfruit Sweetener',
      culinaryTip: 'Use a 1:1 sugar substitute in adobo, bistek, or coffee to preserve ketosis while enjoying authentic Pinoy sweetness.'
    },
    {
      forbidden: 'White Jasmine Rice & Pancit',
      risk: 'High glycemic carbohydrates (~45g net carbs per cup)',
      substitute: 'Riced Cauliflower or Shirataki Konjac Rice',
      culinaryTip: 'Sauté riced cauliflower in garlic and pure coconut oil for 3 minutes for an authentic low-carb garlic rice (sinangag).'
    },
    {
      forbidden: 'Banana Ketchup & Sweet Soy',
      risk: 'High-fructose corn syrup, refined sugar, and added starches',
      substitute: 'Fresh Calamansi Dip with Sili & Coconut Aminos',
      culinaryTip: 'Mix coconut aminos with crushed siling labuyo and freshly squeezed calamansi for a zero-sugar sawsawan.'
    },
    {
      forbidden: 'Potatoes & Sweet Potato (Kamote)',
      risk: 'Dense starchy root vegetables (~25-30g net carbs per serving)',
      substitute: 'Fresh Sayote (Chayote) or Labanos (Radish)',
      culinaryTip: 'Cubed sayote or daikon radish absorbs tinola or nilaga broth flavors perfectly with negligible net carbs.'
    },
    {
      forbidden: 'Flour Batter / Cornstarch Thickeners',
      risk: 'Refined flour coating adds 20-30g carbs to fried dishes',
      substitute: 'Crushed Chicharon (Pork Rind) or Almond Flour',
      culinaryTip: 'Dip pork chops or chicken in egg wash and dredge in finely crushed pork rinds for an ultra-crispy keto crust.'
    }
  ],
  low_purine: [
    {
      forbidden: 'Pork Isaw, Atay (Liver) & Bopis',
      risk: 'Extremely high purines (>400mg/100g) causing acute uric acid spikes',
      substitute: 'Skinless Chicken Breast or Tokwa (Firm Tofu)',
      culinaryTip: 'Marinate skinless chicken breast in calamansi and garlic for a flavorful, low-purine Pinoy BBQ or stir-fry.'
    },
    {
      forbidden: 'Tahong (Mussels) & Canned Sardines',
      risk: 'Concentrated purines trigger joint inflammation and gout attacks',
      substitute: 'Fresh Bangus (Milkfish) or Tilapia',
      culinaryTip: 'Pan-sear fresh bangus in olive oil with fresh tomatoes and onions for safe omega fats without purine overload.'
    },
    {
      forbidden: 'Bagoong Alamang (Shrimp Paste)',
      risk: 'Dense crustacean purines and high sodium causing kidney load',
      substitute: 'Roasted Garlic & Tomato Sawsawan',
      culinaryTip: 'Mash roasted garlic with ripe native tomatoes, a drop of vinegar, and ground pepper for rich kare-kare dip.'
    },
    {
      forbidden: 'Concentrated Bone Broth (Nilaga First Boil)',
      risk: 'Purines leach heavily into boiling water creating hyper-purine broth',
      substitute: 'Discarded First Boil or Vegetable Broth',
      culinaryTip: 'Boil meat for 5 minutes and discard the water; re-boil in fresh water with sayote, peppercorns, and ginger.'
    },
    {
      forbidden: 'Munggo Guisado (Mung Beans)',
      risk: 'High legume purine density (>150mg/100g)',
      substitute: 'Ginisang Sayote with Dahon ng Sili',
      culinaryTip: 'Sauté sliced sayote with lean ground pork and chili leaves for comforting vegetable stew with minimal purines.'
    }
  ],
  low_sodium: [
    {
      forbidden: 'Patis (Fish Sauce)',
      risk: 'Extremely high sodium (~1,200–1,500mg per tablespoon)',
      substitute: 'Fresh Calamansi + Minced Garlic & Siling Labuyo',
      culinaryTip: 'Combining acidity from calamansi with aromatic garlic and spicy sili tricks the palate, enhancing flavor without sodium.'
    },
    {
      forbidden: 'Regular Soy Sauce (Toyo)',
      risk: '~900–1,000mg sodium per tbsp leading to fluid retention',
      substitute: 'Low-Sodium Soy Sauce Diluted 1:1 or Coconut Aminos',
      culinaryTip: 'Dilute reduced-sodium soy sauce with mineral water and fresh calamansi juice to cut sodium intake by over 70%.'
    },
    {
      forbidden: 'Bouillon Cubes & Seasoning Granules',
      risk: 'Up to 2,000mg sodium per cube plus MSG preservatives',
      substitute: 'Roasted Onion, Garlic & Slow-Simmered Bones',
      culinaryTip: 'Brown onions and garlic in a dry pot before adding water and fresh ginger for deeply aromatic natural broth.'
    },
    {
      forbidden: 'Tuyo & Daing (Dried Salted Fish)',
      risk: 'Enormous salt brine saturation (>2,500mg sodium per fish)',
      substitute: 'Fresh Pan-Fried Tilapia with Native Tomatoes',
      culinaryTip: 'Pan-fry fresh tilapia seasoned only with black pepper and fresh calamansi; pair with sliced native tomatoes.'
    },
    {
      forbidden: 'Tocino, Longganisa & Canned Corned Beef',
      risk: 'Cured meats loaded with sodium nitrite, curing salts, and preservatives',
      substitute: 'Fresh Pork Tenderloin Marinated in Calamansi & Garlic',
      culinaryTip: 'Marinate thin pork slices in calamansi juice, garlic, black pepper, and a dash of annatto oil for fresh homemade tocino.'
    }
  ],
  diabetic: [
    {
      forbidden: 'White Jasmine Rice',
      risk: 'High glycemic index (~73-80) causes swift post-meal blood sugar surges',
      substitute: 'Cauliflower Rice or Moderate Brown/Red Rice',
      culinaryTip: 'Riced cauliflower steamed or lightly pan-fried provides the familiar texture of rice with almost zero glycemic impact.'
    },
    {
      forbidden: 'Refined White & Brown Sugar in Dishes',
      risk: 'Quickly absorbed sucrose drives insulin resistance',
      substitute: 'Fresh Calamansi, Tomatoes or Stevia',
      culinaryTip: 'Use slow-cooked caramelized onions and native tomatoes to bring natural sweetness to adobo and stews.'
    },
    {
      forbidden: 'Sweet Banana Ketchup',
      risk: 'Contains over 12g added sugars and high-fructose syrup per 2 tbsp',
      substitute: 'Fresh Homemade Tomato Salsa / Sawsawan',
      culinaryTip: 'Finely dice fresh red tomatoes, shallots, and fresh siling labuyo with calamansi juice for a vibrant zero-sugar dip.'
    },
    {
      forbidden: 'Sweetened Condensed & Evaporated Milk',
      risk: 'Over 55% refined sugar content by weight',
      substitute: 'Unsweetened Coconut Milk (Gata) or Almond Milk',
      culinaryTip: 'Pure coconut milk provides creamy richness for savory ginataan or desserts without spiking blood glucose.'
    },
    {
      forbidden: 'Commercial Sinigang Mix Packets',
      risk: 'Contains maltodextrin, sugar fillers, and high sodium',
      substitute: 'Fresh Sampaloc (Tamarind) or Fresh Calamansi',
      culinaryTip: 'Boil fresh tamarind pods and press the pulp through a sieve for authentic, chemical-free souring broth.'
    }
  ]
};

export const SMART_SUBSTITUTES = SMART_SUBSTITUTES_BY_DIET.lid;

export const CHECKLIST_BY_DIET = {
  pinoy_keto: [
    { id: 'keto-sugar', text: 'Zero sugar added (avoid table sugar, muscovado, condensed milk, sweet soy sauce).', critical: true },
    { id: 'keto-starch', text: 'Zero high-starch thickeners (no cornstarch, flour batter, or potato starches).', critical: true },
    { id: 'keto-fats', text: 'Healthy fats verified (pure coconut oil, lard, olive oil, or grass-fed butter).', critical: true },
    { id: 'keto-veggies', text: 'Low-carb vegetables selected (sayote, kangkong, cabbage; avoid potatoes, corn, and sweet potato).', critical: true },
    { id: 'keto-marinade', text: 'No sweetened marinades or commercial sweet-style banana ketchup.', critical: true }
  ],
  low_purine: [
    { id: 'purine-organs', text: 'Zero organ meats (strictly no isaw, atay, bopis, or dinuguan).', critical: true },
    { id: 'purine-broth', text: 'Broth management: Discard first boil or use light vegetable-based broths.', critical: true },
    { id: 'purine-shellfish', text: 'Moderate purines: Strictly limit shellfish (tahong, talaba) and canned sardines.', critical: true },
    { id: 'purine-yeast', text: 'Zero yeast-heavy bouillon cubes or beer marinades.', critical: true },
    { id: 'purine-hydration', text: 'Ample hydration greens included (upo, sayote, cucumber).', critical: true }
  ],
  low_sodium: [
    { id: 'sodium-patis', text: 'Zero patis (fish sauce) or bagoong alamang used for seasoning.', critical: true },
    { id: 'sodium-souring', text: 'Souring and umami sourced naturally (fresh calamansi, sampaloc, roasted garlic, siling labuyo).', critical: true },
    { id: 'sodium-soy', text: 'Low-sodium or diluted soy sauce used sparingly.', critical: true },
    { id: 'sodium-cubes', text: 'No processed bouillon cubes, MSG seasoning packets, or canned broth bases.', critical: true },
    { id: 'sodium-cured', text: 'Fresh unsalted cuts of meat (no cured meats like tocino, longganisa, or corned beef).', critical: true }
  ],
  diabetic: [
    { id: 'diabetic-sugar', text: 'Zero refined white/brown sugar added to sauces.', critical: true },
    { id: 'diabetic-fiber', text: 'Fiber foundation prepared (bitter melon, leafy talbos, or yardlong beans).', critical: true },
    { id: 'diabetic-carbs', text: 'Complex carbs portioned (substitute white rice with cauliflower rice or moderate brown rice).', critical: true },
    { id: 'diabetic-souring', text: 'Natural souring used instead of sweetened sinigang mixes.', critical: true }
  ],
  lid: [
    { id: 'check-salt', text: 'Non-iodized salt verified (Morton Coarse or Diamond Crystal Kosher)?', critical: true },
    { id: 'check-meat', text: 'Fresh unbrined raw meat used (no injected broth/salt solutions)?', critical: true },
    { id: 'check-oil', text: 'Pure oil used (100% pure coconut, canola, or olive oil without butter/margarine)?', critical: true },
    { id: 'check-sauce', text: 'Zero soy sauce (toyo), fish sauce (patis), oyster sauce, or bouillon cubes?', critical: true },
    { id: 'check-eggs', text: 'Pure egg whites only (meticulously separated from yolks)?', critical: true },
    { id: 'check-dairy', text: 'Zero dairy milk, cheese, butter, or whey added?', critical: true },
    { id: 'check-veggies', text: 'Safe vegetables chosen (no potatoes, cassava, or cruciferous greens)?', critical: true }
  ]
};

export const PRE_COOKING_CHECKLIST = CHECKLIST_BY_DIET.lid;

