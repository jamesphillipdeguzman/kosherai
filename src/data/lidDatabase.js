// Comprehensive Clinical Low-Iodine Diet (LID) Database for RAI Patients
// Follows strict clinical protocol for Radioactive Iodine Therapy preparation (<50 mcg iodine/day)

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

export const LID_DATABASE = [
  // ==================== SALTS & SEASONINGS ====================
  {
    id: 'salt-kosher',
    name: 'Kosher Salt (Non-Iodized)',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.SAFE,
    aliases: ['pure kosher salt', 'diamond crystal kosher salt', 'morton coarse kosher salt', 'non-iodized salt', 'pickling salt', 'canning salt', 'pure sodium chloride'],
    iodineContent: '< 1 mcg per serving (Negligible)',
    description: '100% pure coarse salt without potassium iodide or yellow prussiate of soda. This is the cornerstone salt for all home cooking on LID.',
    substitutes: [],
    clinicalNotes: 'Check label to ensure it does not state "This salt supplies iodide, a necessary nutrient". Diamond Crystal (red box) and Morton Coarse Kosher (blue box without iodine) are gold standards.'
  },
  {
    id: 'salt-iodized',
    name: 'Iodized Salt / Table Salt',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['table salt', 'iodized table salt', 'iodated salt', 'rock salt (iodized)', 'refined salt', 'iodized rock salt'],
    iodineContent: '~71 mcg per 1/4 tsp (Exceeds daily max in one pinch)',
    description: 'Commercial table salt fortified with potassium iodide or potassium iodate. Strictly forbidden on LID.',
    substitutes: ['Non-iodized pure kosher salt', 'Pickling salt', 'Canning salt'],
    clinicalNotes: 'Mandatory iodization laws in many countries mean nearly all commercial table salt and restaurant meals contain excessive iodine.'
  },
  {
    id: 'salt-sea',
    name: 'Sea Salt & Himalayan Pink Salt',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['sea salt', 'flaky sea salt', 'maldon salt', 'himalayan salt', 'pink salt', 'fleur de sel', 'celtic salt', 'black salt', 'kala namak'],
    iodineContent: 'Variable, often 20-50+ mcg per tsp plus trace oceanic iodides',
    description: 'Derived from evaporated sea water or mineral deposits containing unpredictable levels of naturally occurring iodine.',
    substitutes: ['Non-iodized kosher salt', 'Pure pickling salt'],
    clinicalNotes: 'Even non-iodized sea salt carries marine iodine residue and is contraindicated by most RAI nuclear medicine teams.'
  },
  {
    id: 'pepper-black-white',
    name: 'Pure Black & White Pepper',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.SAFE,
    aliases: ['black pepper', 'white pepper', 'peppercorns', 'ground black pepper', 'cracked pepper'],
    iodineContent: '0 mcg',
    description: 'Pure Piper nigrum peppercorns. Safe for seasoning all meats and vegetables.',
    substitutes: [],
    clinicalNotes: 'Ensure no seasoned pepper blends that list added salt or anti-caking additives.'
  },
  {
    id: 'pure-spices-herbs',
    name: 'Pure Spices & Dried Herbs',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.SAFE,
    aliases: ['garlic powder (pure)', 'onion powder (pure)', 'paprika', 'cumin', 'oregano', 'basil', 'thyme', 'rosemary', 'cinnamon', 'turmeric', 'chili powder (pure)', 'bay leaves', 'coriander'],
    iodineContent: '0 mcg',
    description: 'Pure single-ingredient dried herbs and spices without added salt or fillers.',
    substitutes: [],
    clinicalNotes: 'Always inspect the ingredient list to ensure "salt" is not included (e.g., use pure garlic powder, NOT garlic salt).'
  },
  {
    id: 'fresh-chilies',
    name: 'Fresh Chilies (Siling Haba & Labuyo)',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.SAFE,
    aliases: ['siling labuyo', 'siling haba', 'birds eye chili', 'jalapeno', 'serrano', 'cayenne fresh', 'red chili'],
    iodineContent: '0 mcg',
    description: 'Fresh pepper pods are completely safe and excellent for adding intense flavor without sodium.',
    substitutes: [],
    clinicalNotes: 'Great for building rich broths and sautéed dishes.'
  },
  {
    id: 'soy-sauce',
    name: 'Soy Sauce (Toyo)',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['soy sauce', 'toyo', 'tamari', 'shoyu', 'liquid aminos', 'bragg liquid aminos', 'dark soy sauce', 'light soy sauce'],
    iodineContent: 'Very High (~50-90 mcg per tbsp from iodized salt + soybean isoflavones)',
    description: 'Made from fermented soybeans, wheat, and high amounts of iodized brine. Soybeans actively block thyroidal iodine uptake.',
    substitutes: ['Homemade garlic-vinegar reduction', 'Coconut aminos made with verified non-iodized kosher salt', 'Balsamic reduction'],
    clinicalNotes: 'Soy is a double-threat: high iodine from commercial brine, plus soybean isoflavones (genistein/daidzein) inhibit the thyroid sodium-iodide symporter (NIS).'
  },
  {
    id: 'fish-sauce-patis',
    name: 'Fish Sauce (Patis) & Bagoong',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['patis', 'fish sauce', 'bagoong', 'bagoong alamang', 'shrimp paste', 'anchovy sauce', 'nam pla', 'nuoc mam'],
    iodineContent: 'Extremely High (Seafood extract + solar sea salt)',
    description: 'Fermented fish/krill liquid loaded with marine iodine and salt. Absolute contraindication.',
    substitutes: ['Garlic-infused olive oil with pure kosher salt and a squeeze of lemon or calamansi'],
    clinicalNotes: 'Even small drops can ruin preparation for radioactive iodine ablation.'
  },
  {
    id: 'oyster-sauce',
    name: 'Oyster Sauce & Seafood Pastes',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['oyster sauce', 'mama sita oyster sauce', 'lee kum kee oyster sauce', 'crab paste', 'aligue', 'belacan'],
    iodineContent: 'Extremely High (Oyster extracts, seafood base, iodized salt)',
    description: 'Thick brown sauce derived from boiled oysters and seasoned with sea salt and flavor enhancers.',
    substitutes: ['Sautéed garlic and caramelized shallots in olive oil with pure kosher salt and a splash of white vinegar'],
    clinicalNotes: 'Strictly prohibited due to direct mollusk derivation.'
  },
  {
    id: 'pure-oils',
    name: '100% Pure Vegetable Oils',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.SAFE,
    aliases: ['pure coconut oil', 'canola oil', 'extra virgin olive oil', 'corn oil', 'avocado oil', 'sunflower oil', 'sesame oil (pure)'],
    iodineContent: '0 mcg',
    description: 'Pure pressed vegetable and nut oils are 100% lipid and free from iodine.',
    substitutes: [],
    clinicalNotes: 'Avoid blended oils that state "butter flavor" or unverified emulsifiers.'
  },
  {
    id: 'vinegars',
    name: 'Pure Vinegars (White, Cane, Apple Cider)',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.SAFE,
    aliases: ['white vinegar', 'sukang paombong', 'sukang iloko', 'cane vinegar', 'apple cider vinegar', 'distilled vinegar'],
    iodineContent: '0 mcg',
    description: 'Natural fermented vinegars without added salt or caramel color derived from dairy.',
    substitutes: [],
    clinicalNotes: 'Verify label: only water and vinegar acidity. Do not use seasoned vinegar blends containing iodized salt.'
  },
  {
    id: 'mayonnaise',
    name: 'Commercial Mayonnaise',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['mayo', 'hellmanns', 'kewpie', 'best foods mayonnaise', 'sandwich spread'],
    iodineContent: '~15-30 mcg per serving (Whole egg yolks + iodized salt)',
    description: 'Standard mayonnaise is an emulsion of egg yolks, oil, and iodized salt.',
    substitutes: ['Homemade egg-white vegan mayo made with pasteurized egg whites, canola oil, pure kosher salt, and lemon juice', 'Mashed avocado with lemon and kosher salt'],
    clinicalNotes: 'Egg yolks are strictly forbidden on LID.'
  },

  // ==================== MEAT & PROTEINS ====================
  {
    id: 'fresh-chicken',
    name: 'Fresh Chicken (Unbrined & Uncured)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.SAFE,
    aliases: ['chicken breast (fresh)', 'chicken thigh', 'chicken wings', 'fresh whole chicken', 'manok'],
    iodineContent: '~5-10 mcg per 100g (Naturally low)',
    description: 'Fresh supermarket raw chicken cutlets that have not been injected with saline or broth solutions.',
    substitutes: [],
    clinicalNotes: 'Read the packaging label carefully: avoid chicken stating "contains up to 15% solution of broth, salt, or sodium phosphate". Buy 100% natural, unseasoned fresh cuts.'
  },
  {
    id: 'fresh-beef',
    name: 'Fresh Beef (Uncured & Raw)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.SAFE,
    aliases: ['beef steak', 'ground beef (fresh)', 'beef roast', 'beef ribs', 'sirloin', 'tenderloin', 'baka'],
    iodineContent: '~2-5 mcg per 100g',
    description: 'Unprocessed fresh butcher cuts of beef. Safe protein staple for LID.',
    substitutes: [],
    clinicalNotes: 'Avoid pre-marinated beef, corned beef, pastrami, beef patties with added salt, or deli cold cuts.'
  },
  {
    id: 'fresh-pork',
    name: 'Fresh Pork (Uncured & Raw)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.SAFE,
    aliases: ['pork chops', 'pork tenderloin', 'pork belly (fresh)', 'ground pork', 'baboy'],
    iodineContent: '~3-6 mcg per 100g',
    description: 'Fresh butcher pork cuts without brine injection or cure.',
    substitutes: [],
    clinicalNotes: 'Avoid ham, bacon, sausages, tocino, longganisa, spam, or hotdogs, as all cured meats contain copious iodized salt and preservatives.'
  },
  {
    id: 'turkey-breast',
    name: 'Turkey Breast',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['turkey', 'turkey breast', 'ground turkey', 'roast turkey deli meat'],
    iodineContent: '~30-40+ mcg (Frequently factory-injected with iodized broth)',
    description: 'Commercially processed turkey is heavily brined with salt solutions to prevent dryness. Protocol specifies avoiding turkey breast.',
    substitutes: ['Fresh chicken breast (100% natural, no broth injection)', 'Fresh pork loin'],
    clinicalNotes: 'Excluded specifically in the clinical protocol due to industry-wide basting/brine injection.'
  },
  {
    id: 'egg-whites',
    name: 'Egg Whites (Pure)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.SAFE,
    aliases: ['pure egg whites', 'egg white', 'liquid egg whites (100% pure)', 'separated egg whites'],
    iodineContent: '< 1 mcg per white',
    description: 'The white albumen of the egg contains virtually zero iodine. Excellent protein source for LID.',
    substitutes: [],
    clinicalNotes: 'Must be meticulously separated from the yolk. Discard if any trace of yellow yolk breaks into the white.'
  },
  {
    id: 'egg-yolks-whole',
    name: 'Whole Eggs & Egg Yolks',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['whole egg', 'egg yolk', 'scrambled eggs', 'boiled egg', 'sunny side up', 'salted egg', 'itlog na maalat'],
    iodineContent: '~12-25 mcg per single yolk (Chicken feed is fortified with iodine)',
    description: 'Iodine concentrates almost entirely in the yolk of the egg.',
    substitutes: ['Pure separated egg whites (use 2 whites for every 1 whole egg in cooking/baking)'],
    clinicalNotes: 'Also avoid any product with whole eggs: mayonnaise, custard, quiche, waffles, cakes, pasta.'
  },
  {
    id: 'seafood-fish',
    name: 'Fish (Tuna, Cod, Salmon, Tilapia, Bangus)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['fish', 'tuna', 'canned tuna', 'cod', 'salmon', 'tilapia', 'bangus', 'milkfish', 'sardines', 'mackerel', 'sushi', 'sashimi', 'anchovies'],
    iodineContent: 'Extremely High (90 to 200+ mcg per serving)',
    description: 'All marine and freshwater fish bioaccumulate iodine from water and oceanic algae.',
    substitutes: ['Fresh raw chicken breast', 'Fresh pork tenderloin', 'Fresh lean beef'],
    clinicalNotes: 'Even freshwater fish are prohibited on strict protocols to eliminate all risk of mislabeling or contamination.'
  },
  {
    id: 'shellfish-crustaceans',
    name: 'Shellfish & Crustaceans (Shrimp, Crab, Lobster)',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['shrimp', 'hipon', 'prawns', 'crab', 'alimango', 'alimasag', 'lobster', 'crawfish', 'squid', 'pusit', 'octopus', 'clams', 'mussels', 'tahong', 'oysters'],
    iodineContent: 'Extremely High (100 to 400+ mcg per serving)',
    description: 'Marine filter-feeders that store maximal concentrations of elemental iodine.',
    substitutes: ['Fresh unbrined chicken', 'Fresh beef'],
    clinicalNotes: 'One serving of shrimp or mussels can saturate thyroid receptors for weeks and cause RAI therapy failure.'
  },
  {
    id: 'tofu-soy-protein',
    name: 'Tofu, Soy Protein & Edamame',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['tofu', 'tokwa', 'taho', 'edamame', 'soy protein', 'soybeans', 'tempeh', 'textured vegetable protein', 'tvp'],
    iodineContent: 'Variable, but soy isoflavones suppress thyroid iodine uptake (NIS inhibitor)',
    description: 'Soy products contain genistein and daidzein which directly block the iodine uptake mechanism required for radioactive iodine treatment.',
    substitutes: ['Fresh beef', 'Fresh chicken', 'Egg whites'],
    clinicalNotes: 'Soy must be avoided not just for iodine content, but because it acts as an NIS inhibitor.'
  },
  {
    id: 'beans-legumes',
    name: 'Lima Beans, Black Beans & Green Beans',
    category: LID_CATEGORIES.PROTEINS,
    status: STATUS.AVOID,
    aliases: ['lima beans', 'black beans', 'green beans', 'string beans', 'baguio beans', 'kidney beans', 'pinto beans', 'lentils', 'chickpeas', 'garbanzos'],
    iodineContent: 'Moderate to High (legume root nodules absorb soil iodides readily)',
    description: 'Specific beans and pod vegetables specified for exclusion in the medical protocol.',
    substitutes: ['Sayote', 'Kalabasa (squash)', 'Zucchini', 'Carrots'],
    clinicalNotes: 'Green beans (Baguio beans) and lima beans are explicitly restricted on this protocol.'
  },

  // ==================== PRODUCE (VEGETABLES & FRUITS) ====================
  {
    id: 'sayote-chayote',
    name: 'Sayote (Chayote Squash)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['sayote', 'chayote', 'mirliton', 'christophine', 'vegetable pear'],
    iodineContent: '0 mcg',
    description: 'Crisp, mild gourd vegetable. The premier safe substitute for potatoes in soups, stews, and stir-fries.',
    substitutes: [],
    clinicalNotes: 'Outstanding potato replacement for nilaga, tinola, chicken soups, and roasted vegetable medleys.'
  },
  {
    id: 'kalabasa-squash',
    name: 'Kalabasa (Squash / Kabocha)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['kalabasa', 'squash', 'kabocha', 'butternut squash', 'acorn squash', 'pumpkin (fresh)'],
    iodineContent: '< 2 mcg (Very low)',
    description: 'Sweet, hearty, nutritious orange flesh. Excellent source of healthy carbohydrates without the high iodine of potatoes.',
    substitutes: [],
    clinicalNotes: 'Great roasted with pure olive oil and non-iodized kosher salt, or mashed as a potato puree alternative.'
  },
  {
    id: 'bell-peppers',
    name: 'Bell Peppers (Capsicum)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['bell pepper', 'red bell pepper', 'green bell pepper', 'yellow bell pepper', 'capsicum'],
    iodineContent: '0 mcg',
    description: 'Sweet, crisp, full of Vitamin C and completely safe for all low-iodine cooking.',
    substitutes: [],
    clinicalNotes: 'Adds vibrant color and flavor to safe chicken, pork, and rice dishes.'
  },
  {
    id: 'zucchini-eggplant',
    name: 'Zucchini & Eggplant (Talong)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['zucchini', 'eggplant', 'talong', 'courgette', 'aubergine'],
    iodineContent: '< 1 mcg',
    description: 'Tender gourds and nightshades that absorb delicious seasonings without iodine.',
    substitutes: [],
    clinicalNotes: 'Can be grilled, roasted, or sautéed with garlic and olive oil.'
  },
  {
    id: 'gourd-patola-upo-ampalaya',
    name: 'Native Gourds (Patola, Upo, Ampalaya)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['patola', 'sponge gourd', 'luffa', 'upo', 'bottle gourd', 'calabash', 'ampalaya', 'bitter gourd', 'bitter melon'],
    iodineContent: '0 mcg',
    description: 'Traditional native vegetables clinically confirmed safe on this protocol.',
    substitutes: [],
    clinicalNotes: 'Safe for ginisang dishes seasoned with pure kosher salt, garlic, and fresh tomatoes.'
  },
  {
    id: 'tomatoes-fresh',
    name: 'Fresh Tomatoes & Fresh Onions',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['fresh tomato', 'kamatis', 'onion', 'red onion', 'white onion', 'shallot', 'scallions', 'green onions', 'garlic', 'bawang', 'ginger', 'luya'],
    iodineContent: '< 1 mcg (Natural background)',
    description: 'The holy grail aromatic foundation for all homemade sauces, broths, and sautéing.',
    substitutes: [],
    clinicalNotes: 'Must be fresh whole produce. Do not buy jarred tomato sauces containing iodized salt.'
  },
  {
    id: 'potatoes-all',
    name: 'Potatoes (All Varieties)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.AVOID,
    aliases: ['potato', 'potatoes', 'russet potato', 'red potato', 'french fries', 'potato chips', 'mashed potatoes', 'hash browns', 'patatas', 'potato starch'],
    iodineContent: '~60 mcg per medium potato (Exceeds daily total allowable limit)',
    description: 'Potatoes concentrate significant amounts of iodine from the soil and potato skin.',
    substitutes: ['Sayote (chayote) cubes in soups', 'Kalabasa (squash) mashed or roasted', 'Extra carrots or zucchini'],
    clinicalNotes: 'A common pitfall for patients! One baked potato can deliver 60 mcg of iodine, which alone breaches the 50 mcg/day LID ceiling.'
  },
  {
    id: 'cassava-kamoteng-kahoy',
    name: 'Cassava (Kamoteng Kahoy) & Millet',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.AVOID,
    aliases: ['cassava', 'kamoteng kahoy', 'manioc', 'yuca', 'tapioca (raw root)', 'millet', 'bajra'],
    iodineContent: 'Goitrogenic cyanogenic glycosides that interfere with thyroid function',
    description: 'Potent goitrogen that competes with thyroid hormone synthesis and iodide trapping.',
    substitutes: ['White rice', 'Brown rice', 'Pure cornstarch', 'Oats'],
    clinicalNotes: 'Explicitly forbidden under the goitrogen category of this clinical protocol.'
  },
  {
    id: 'cruciferous-veggies',
    name: 'Cruciferous Vegetables (Cabbage, Broccoli, Cauliflower)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.AVOID,
    aliases: ['cabbage', 'repolyo', 'broccoli', 'cauliflower', 'brussels sprouts', 'kale', 'bok choy', 'pechay', 'kohlrabi'],
    iodineContent: 'High glucosinolates / goitrogens that inhibit thyroid iodide uptake',
    description: 'Cruciferous greens contain thiocyanates and goitrogens that compromise the efficacy of radioactive iodine therapy.',
    substitutes: ['Sayote', 'Bell peppers', 'Kalabasa', 'Cucumbers', 'Zucchini', 'Carrots'],
    clinicalNotes: 'Do not eat raw or cooked cruciferous vegetables during the 2-week preparation window.'
  },
  {
    id: 'watercress',
    name: 'Watercress',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.AVOID,
    aliases: ['watercress', 'cress'],
    iodineContent: '~35-45 mcg per cup',
    description: 'Aquatic plant that hyper-accumulates iodine and minerals from water sources.',
    substitutes: ['Fresh crisp iceberg or romaine lettuce', 'Arugula (check with doctor)'],
    clinicalNotes: 'Specifically prohibited by the clinical protocol.'
  },
  {
    id: 'seaweed-all',
    name: 'Sea Vegetables & Seaweed (Nori, Kelp, Wakame, Lato)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.AVOID,
    aliases: ['seaweed', 'kelp', 'kombu', 'wakame', 'nori', 'lato', 'sea grapes', 'ar-arusip', 'dulse', 'spirulina', 'chlorella', 'sea moss'],
    iodineContent: 'Catastrophic (Up to 2,000+ mcg in a single strip)',
    description: 'The highest natural source of iodine on planet Earth. Even trace amounts will shut down radioactive iodine uptake completely.',
    substitutes: ['Crispy oven-baked kale is NOT allowed either; try thinly sliced dehydrated zucchini chips with kosher salt'],
    clinicalNotes: 'Strictly check snack foods, sushi wraps, and seasoning powders for seaweed flakes.'
  },
  {
    id: 'avoid-fruits',
    name: 'Forbidden Fruits (Prunes, Bananas, Pineapple, Strawberries, Cranberries)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.AVOID,
    aliases: ['prunes', 'dried prunes', 'banana', 'saging', 'pineapple', 'pinya', 'strawberries', 'cranberries', 'cranberry juice', 'maraschino cherries'],
    iodineContent: 'Moderate to high iodine content per serving',
    description: 'These specific fruits are documented to harbor higher botanical concentrations of iodine or are processed with Red Dye #3.',
    substitutes: ['Fresh apples', 'Fresh watermelon (pakwan)', 'Fresh oranges', 'Fresh grapes', 'Calamansi', 'Mangoes', 'Melon'],
    clinicalNotes: 'Bananas contain ~3 mcg each and pineapple/berries absorb mineral iodides. Follow the protocol and stick to permitted fruits.'
  },
  {
    id: 'safe-fruits',
    name: 'Permitted Fruits (Apples, Oranges, Calamansi, Watermelon, Grapes, Mango)',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.SAFE,
    aliases: ['apple', 'orange', 'calamansi', 'lemon', 'lime', 'watermelon', 'pakwan', 'grapes', 'mango', 'cantaloupe', 'honeydew', 'peaches', 'pears'],
    iodineContent: '< 1 mcg (Trace)',
    description: 'Clean, safe fruits for snacking, fresh juices, and desserts during LID.',
    substitutes: [],
    clinicalNotes: 'Wash thoroughly with fresh water before peeling and slicing.'
  },

  // ==================== DAIRY & EGGS ====================
  {
    id: 'cow-milk',
    name: 'Cow’s Milk & Goat’s Milk',
    category: LID_CATEGORIES.DAIRY_EGGS,
    status: STATUS.AVOID,
    aliases: ['milk', 'whole milk', 'skim milk', 'low fat milk', 'evaporated milk', 'condensed milk', 'powdered milk', 'gatas', 'goat milk', 'raw milk'],
    iodineContent: '~80-110 mcg per cup (Exceeds daily allowance in 1 glass)',
    description: 'Cattle udders are cleaned with iodophor iodine disinfectants and dairy feed is enriched with iodine supplements.',
    substitutes: ['Homemade oat milk (filtered water + rolled oats + pure maple syrup, NO sea salt)', 'Black coffee / pure tea'],
    clinicalNotes: 'Commercial milk is one of the leading contributors to high dietary iodine worldwide.'
  },
  {
    id: 'butter-margarine',
    name: 'Butter & Commercial Margarine',
    category: LID_CATEGORIES.DAIRY_EGGS,
    status: STATUS.AVOID,
    aliases: ['butter', 'mantekilya', 'salted butter', 'unsalted butter', 'ghee', 'clarified butter', 'margarine', 'star margarine', 'blue band'],
    iodineContent: '~20-40 mcg per tbsp (Dairy lipids + dairy iodophors + iodized salt)',
    description: 'Dairy fat concentrates dairy iodines, and commercial margarines contain dairy solids, whey, and iodized salt.',
    substitutes: ['100% pure coconut oil', 'Extra virgin olive oil', 'Pure canola oil'],
    clinicalNotes: 'Even "unsalted butter" contains natural dairy iodine from cow feed and iodophor udder washes.'
  },
  {
    id: 'cheese-all',
    name: 'All Cheeses (Cheddar, Mozzarella, Kesong Puti, Cottage)',
    category: LID_CATEGORIES.DAIRY_EGGS,
    status: STATUS.AVOID,
    aliases: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'cottage cheese', 'kesong puti', 'cream cheese', 'ricotta', 'queso', 'processed cheese'],
    iodineContent: 'Extremely High (Concentrated dairy milk solids)',
    description: 'Because cheese is made by condensing large volumes of milk, the iodine content is multiplied exponentially.',
    substitutes: ['Nutritional yeast (only if verified non-iodine fortified)', 'Creamy mashed avocado with kosher salt and lemon'],
    clinicalNotes: 'All dairy cheese is strictly prohibited on the low-iodine diet.'
  },
  {
    id: 'yogurt',
    name: 'Yogurt & Cultured Dairy',
    category: LID_CATEGORIES.DAIRY_EGGS,
    status: STATUS.AVOID,
    aliases: ['yogurt', 'greek yogurt', 'kefir', 'sour cream', 'curd', 'labneh'],
    iodineContent: '~75-100 mcg per serving',
    description: 'Fermented cow’s milk products harboring high dairy iodine.',
    substitutes: ['Pure fresh fruit puree (mango, apple, watermelon)'],
    clinicalNotes: 'Avoid completely.'
  },
  {
    id: 'whey-casein',
    name: 'Whey & Casein Protein',
    category: LID_CATEGORIES.DAIRY_EGGS,
    status: STATUS.AVOID,
    aliases: ['whey', 'whey protein', 'casein', 'caseinate', 'sodium caseinate', 'calcium caseinate', 'milk solids', 'nonfat dry milk'],
    iodineContent: 'High (Dairy isolates)',
    description: 'Common additives in protein bars, packaged snacks, instant soups, and breads.',
    substitutes: ['Pure egg white protein powder (unflavored, no additives)'],
    clinicalNotes: 'Frequently sneaks into processed foods under "milk protein concentrate" or "whey".'
  },

  // ==================== GRAINS, FLOURS & BAKERY ====================
  {
    id: 'white-brown-rice',
    name: 'White & Brown Rice',
    category: LID_CATEGORIES.GRAINS,
    status: STATUS.SAFE,
    aliases: ['white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'sinandomeng', 'dinorado', 'red rice (pure)'],
    iodineContent: '< 1-2 mcg per cup',
    description: 'The foundation of the low-iodine diet in the Philippines and across Asia. 100% safe when cooked in plain water.',
    substitutes: [],
    clinicalNotes: 'Cook at home in fresh water. Do not cook with packaged seasoning packs or restaurant bouillon.'
  },
  {
    id: 'pure-flours',
    name: 'Plain Unbleached Flour & Cornstarch',
    category: LID_CATEGORIES.GRAINS,
    status: STATUS.SAFE,
    aliases: ['all purpose flour', 'unbleached flour', 'pure cornstarch', 'corn flour', 'wheat flour (plain)'],
    iodineContent: '< 1 mcg',
    description: 'Raw unconditioned baking flours and pure cornstarch used for thickening stews.',
    substitutes: [],
    clinicalNotes: 'Safe for homemade flatbreads, pancakes with egg whites, and thickening gravies with meat drippings.'
  },
  {
    id: 'plain-oats',
    name: 'Plain Rolled Oats & Steel-Cut Oats',
    category: LID_CATEGORIES.GRAINS,
    status: STATUS.SAFE,
    aliases: ['rolled oats', 'steel cut oats', 'quaker oats (plain)', 'quick oats (plain)'],
    iodineContent: '< 2 mcg per bowl',
    description: 'Pure 100% oats without added flavorings or instant milk packets.',
    substitutes: [],
    clinicalNotes: 'Cook with water, a pinch of pure non-iodized kosher salt, and top with honey or pure maple syrup.'
  },
  {
    id: 'plain-pasta',
    name: 'Plain Dry Pasta (Egg-Free, Salt-Free)',
    category: LID_CATEGORIES.GRAINS,
    status: STATUS.SAFE,
    aliases: ['dry pasta', 'spaghetti (dry)', 'penne (dry)', 'macaroni (dry, no egg)', 'semolina pasta'],
    iodineContent: '< 2 mcg per serving',
    description: 'Standard dried Italian-style pasta made strictly from semolina durum wheat and water.',
    substitutes: [],
    clinicalNotes: 'Check ingredient list: must contain ONLY semolina wheat. No eggs. Boil in water seasoned only with pure non-iodized kosher salt.'
  },
  {
    id: 'commercial-bread',
    name: 'Commercial White Bread & Bakery Goods',
    category: LID_CATEGORIES.GRAINS,
    status: STATUS.AVOID,
    aliases: ['white bread', 'pandesal (commercial)', 'sliced bread', 'tasty bread', 'hamburger buns', 'baguettes', 'croissants', 'pastries', 'dough conditioner'],
    iodineContent: 'Extremely High (~150-300 mcg per slice if made with iodate dough conditioner)',
    description: 'Industrial bakeries use potassium iodate or calcium iodate dough conditioners to improve volume and gluten structure.',
    substitutes: ['Homemade bread made with unbleached flour, active dry yeast, water, pure oil, and pure non-iodized kosher salt', 'Plain boiled rice'],
    clinicalNotes: 'A single commercial hamburger bun made with iodate conditioner can have 400 mcg of iodine. Strict avoidance of all commercial bread is essential unless the bakery certifies no iodates and non-iodized salt.'
  },

  // ==================== ADDITIVES, DYES & SUPPLEMENTS ====================
  {
    id: 'carrageenan-e407',
    name: 'Carrageenan (E407) & Agar-Agar (E406)',
    category: LID_CATEGORIES.ADDITIVES,
    status: STATUS.AVOID,
    aliases: ['carrageenan', 'e407', 'agar', 'agar-agar', 'e406', 'gulaman', 'alginate', 'sodium alginate', 'e401', 'alginic acid', 'irish moss extract'],
    iodineContent: 'Massive (Direct sea algae polysaccharide derivative)',
    description: 'Common thickener/stabilizer in almond milk, coconut milk, deli meats, ice cream, toothpastes, and jellies.',
    substitutes: ['Pure cornstarch', 'Tapioca starch (refined)', 'Pectin (pure fruit)'],
    clinicalNotes: 'Scrutinize every packaged food label for carrageenan or E407. It is one of the most widespread hidden sea additives.'
  },
  {
    id: 'red-dye-3-erythrosine',
    name: 'FD&C Red Dye #3 (Erythrosine / E127)',
    category: LID_CATEGORIES.ADDITIVES,
    status: STATUS.AVOID,
    aliases: ['red dye #3', 'red #3', 'erythrosine', 'e127', 'fd&c red 3', 'maraschino red'],
    iodineContent: 'Molecule is 58% elemental iodine by molecular weight!',
    description: 'Synthetic food coloring containing four iodine atoms per molecule. Widely used in cherries, candy, cake frostings, syrups, and pediatric meds.',
    substitutes: ['Beet juice concentrate', 'FD&C Red #40 (Allura Red - safe synthetic color without iodine)'],
    clinicalNotes: 'Red #3 releases free iodide upon metabolism. Absolute ban during RAI preparation.'
  },
  {
    id: 'blackstrap-molasses',
    name: 'Blackstrap Molasses',
    category: LID_CATEGORIES.ADDITIVES,
    status: STATUS.AVOID,
    aliases: ['blackstrap molasses', 'blackstrap'],
    iodineContent: '~30-40 mcg per tbsp',
    description: 'Boiled cane syrup residue that concentrates all minerals, including heavy amounts of soil iodides.',
    substitutes: ['Pure maple syrup', 'Pure honey', 'Unsulfured standard light molasses'],
    clinicalNotes: 'The protocol specifies avoiding blackstrap molasses. Standard unsulfured light molasses is permissible.'
  },
  {
    id: 'multivitamins-iodine',
    name: 'Multivitamins & Kelp Supplements',
    category: LID_CATEGORIES.ADDITIVES,
    status: STATUS.AVOID,
    aliases: ['multivitamin', 'iodine pill', 'kelp pill', 'sea kelp supplement', 'prenatal vitamins', 'mineral supplement', 'thyroid support supplement'],
    iodineContent: '150 to 500+ mcg per tablet (100% to 330%+ daily value)',
    description: 'Most standard multivitamins and thyroid supplements contain 150 mcg potassium iodide.',
    substitutes: ['Iodine-free multivitamin (if prescribed by physician)', 'Single pure vitamin D or vitamin C without iodine'],
    clinicalNotes: 'Discontinue all multivitamins at least 2 weeks before RAI therapy, as instructed by your endocrinologist.'
  },
  {
    id: 'medications-iodine',
    name: 'Iodine Medications (Amiodarone, Betadine, Cough Syrups)',
    category: LID_CATEGORIES.ADDITIVES,
    status: STATUS.AVOID,
    aliases: ['amiodarone', 'cordarone', 'povidone-iodine', 'betadine', 'potassium iodide syrup', 'sski', 'lugols solution', 'ct contrast dye'],
    iodineContent: 'Gigantic (Milligrams to grams of iodine)',
    description: 'Topical povidone iodine antiseptic, antiarrhythmic medication amiodarone, and radiological CT iodinated contrast.',
    substitutes: ['Chlorhexidine or soap and water for wound cleansing', 'Non-contrast CT imaging'],
    clinicalNotes: 'Alert your physician immediately if you have received IV contrast dye or take amiodarone, as this can delay RAI therapy for months.'
  },

  // ==================== BEVERAGES ====================
  {
    id: 'coffee-tea-black',
    name: 'Pure Black Coffee & Pure Tea',
    category: LID_CATEGORIES.BEVERAGES,
    status: STATUS.SAFE,
    aliases: ['black coffee', 'espresso', 'brewed coffee', 'green tea (pure)', 'black tea', 'peppermint tea', 'chamomile tea'],
    iodineContent: '0 mcg',
    description: 'Pure brewed tea leaves and roasted coffee beans steeped in filtered water.',
    substitutes: [],
    clinicalNotes: 'Drink black or sweeten with pure sugar or pure maple syrup. Do NOT add cow’s milk, soy milk, or commercial dairy creamers.'
  },
  {
    id: 'lemonade-sodas',
    name: 'Fresh Lemonade & Pure Sodas',
    category: LID_CATEGORIES.BEVERAGES,
    status: STATUS.SAFE,
    aliases: ['lemonade (fresh)', 'calamansi juice (fresh)', 'seltzer water', 'sparkling water', 'club soda', 'coca-cola (check red dye)', 'sprite'],
    iodineContent: '0 mcg',
    description: 'Homemade fresh citrus juices and clear sodas sweetened with pure sugar.',
    substitutes: [],
    clinicalNotes: 'Check colored sodas and fruit punches for Red Dye #3 (E127).'
  },

  // ==================== CAUTION ITEMS (CHECK LABEL) ====================
  {
    id: 'canned-tomatoes-plain',
    name: 'Canned Plain Tomatoes & Tomato Paste',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.CAUTION,
    aliases: ['canned tomatoes', 'crushed tomatoes', 'tomato paste', 'tomato sauce (canned)'],
    iodineContent: 'Variable (Depends on salt used in canning)',
    description: 'May be safe IF canned with plain non-iodized salt or salt-free. Many commercial canneries use iodized salt.',
    substitutes: ['Fresh whole tomatoes blanched and pureed at home'],
    clinicalNotes: 'Carefully verify the label: if it says "salt" without specifying non-iodized, assume it is iodized and avoid.'
  },
  {
    id: 'commercial-plant-milks',
    name: 'Commercial Oat & Almond Milks',
    category: LID_CATEGORIES.DAIRY_EGGS,
    status: STATUS.CAUTION,
    aliases: ['almond milk', 'oat milk', 'rice milk', 'coconut milk (packaged)'],
    iodineContent: 'Safe if pure; DANGEROUS if fortified with sea salt or carrageenan',
    description: 'Many commercial brands fortify plant milks with sea salt for flavor and carrageenan (E407) for texture.',
    substitutes: ['Homemade oat milk (blend rolled oats and water, strain through cheesecloth)'],
    clinicalNotes: 'Inspect ingredient list: Must NOT contain carrageenan, sea salt, or soy protein.'
  },
  {
    id: 'frozen-vegetables',
    name: 'Frozen Plain Vegetables',
    category: LID_CATEGORIES.PRODUCE,
    status: STATUS.CAUTION,
    aliases: ['frozen vegetables', 'frozen mixed veggies', 'frozen carrots', 'frozen corn'],
    iodineContent: 'Safe if 100% single ingredient; dangerous if seasoned',
    description: 'Ensure the ingredient list contains only the named safe vegetable, with NO added salt, butter sauce, or preservatives.',
    substitutes: ['Fresh raw vegetables from produce section'],
    clinicalNotes: 'Avoid frozen blends containing lima beans, green beans, broccoli, or potatoes.'
  },
  {
    id: 'dark-chocolate',
    name: 'Dark Chocolate (Dairy-Free)',
    category: LID_CATEGORIES.SNACKS_SWEETS,
    status: STATUS.CAUTION,
    aliases: ['dark chocolate', 'cocoa powder', 'baking chocolate'],
    iodineContent: 'Safe if 100% pure cacao without milk solids or soy lecithin',
    description: 'Milk chocolate is strictly forbidden. Dark chocolate is permitted ONLY if certified dairy-free and without soy lecithin.',
    substitutes: ['Pure unsweetened cocoa powder cooked with sugar, water, and coconut oil'],
    clinicalNotes: 'Check for "milk solids", "whey", "butter oil", or "soy lecithin".'
  },
  {
    id: 'restaurant-food',
    name: 'Restaurant & Takeout Food',
    category: LID_CATEGORIES.CONDIMENTS,
    status: STATUS.AVOID,
    aliases: ['restaurant meal', 'fast food', 'takeout', 'hotel food', 'canteen food', 'carinderia'],
    iodineContent: 'Extremely High (Universal use of iodized salt, MSG blends, and margarine)',
    description: 'Commercial kitchens almost universally use iodized salt, bouillon cubes, butter, and seafood sauces.',
    substitutes: ['Home-cooked meals prepared in advance and packed in containers'],
    clinicalNotes: 'Dining out is the #1 cause of unintentional diet failure during RAI prep. Cook your own food during the 2-week restriction.'
  }
];

// Quick index maps for high-performance offline searching
export const SEARCH_INDEX = LID_DATABASE.flatMap(item => {
  const terms = [item.name, ...item.aliases];
  return terms.map(term => ({
    term: term.toLowerCase().trim(),
    item
  }));
});
