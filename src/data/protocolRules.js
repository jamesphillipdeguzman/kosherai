// Clinical Protocol Guidelines for Radioactive Iodine (RAI) Therapy Preparation
// Medical Ground Truth Reference

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

export const SMART_SUBSTITUTES = [
  {
    forbidden: 'Potatoes (Russet, Red, French Fries)',
    iodineRisk: '~60 mcg per potato (Exceeds daily budget)',
    substitute: 'Sayote (Chayote) or Kalabasa (Squash)',
    culinaryTip: 'Cube sayote for soups and stews (it retains crisp tender bite like boiled potato). Roast cubed kalabasa with olive oil and kosher salt for a comforting, sweet carbohydrate side.'
  },
  {
    forbidden: 'Table Salt / Iodized Salt',
    iodineRisk: '~71 mcg per 1/4 tsp',
    substitute: 'Diamond Crystal or Morton Non-Iodized Kosher Salt',
    culinaryTip: 'Keep a small shaker of pure non-iodized kosher salt on your kitchen counter. It provides clean, bright seasoning with 0 mcg added iodine.'
  },
  {
    forbidden: 'Soy Sauce (Toyo)',
    iodineRisk: 'High iodized brine + thyroid NIS-inhibiting soy isoflavones',
    substitute: 'Homemade Garlic-Vinegar Glaze / Reduction',
    culinaryTip: 'Simmer pure cane vinegar, minced garlic, cracked black pepper, a pinch of brown sugar, and kosher salt. It provides the tangy, savory depth of adobo without soy.'
  },
  {
    forbidden: 'Whole Eggs & Egg Yolks',
    iodineRisk: '~12-25 mcg per yolk (Chickens fed iodine-fortified meal)',
    substitute: 'Pure Separated Egg Whites',
    culinaryTip: 'Use 2 egg whites for every 1 whole egg in omelets, scrambled eggs, and baking. Add fresh tomatoes, scallions, and peppers for flavor.'
  },
  {
    forbidden: 'Cow’s Milk & Butter',
    iodineRisk: '~80-110 mcg per glass of milk (Udder iodophors + dairy feed)',
    substitute: 'Homemade Oat Milk & Pure Coconut/Olive Oil',
    culinaryTip: 'Blend 1 cup rolled oats with 4 cups water and a pinch of brown sugar for 30 seconds; strain through a cloth. Use pure coconut oil or olive oil for cooking fat.'
  },
  {
    forbidden: 'Commercial White Bread',
    iodineRisk: '~150-300 mcg per slice from iodate dough conditioners',
    substitute: 'Homemade No-Knead Bread or Plain Boiled Rice',
    culinaryTip: 'Bake a simple loaf at home using unbleached flour, active dry yeast, filtered water, olive oil, and non-iodized kosher salt. Or enjoy fragrant jasmine rice!'
  },
  {
    forbidden: 'Canned Tuna & Seafood',
    iodineRisk: '100-300+ mcg per serving of marine animal protein',
    substitute: 'Fresh Raw Chicken Breast or Pork Tenderloin',
    culinaryTip: 'Shred poached fresh chicken breast with homemade egg-white mayo, celery, and black pepper for a delicious chicken salad sandwich filling.'
  }
];

export const PRE_COOKING_CHECKLIST = [
  { id: 'check-salt', text: 'Non-iodized salt verified (Morton Coarse or Diamond Crystal Kosher)?', critical: true },
  { id: 'check-meat', text: 'Fresh unbrined raw meat used (no injected broth/salt solutions)?', critical: true },
  { id: 'check-oil', text: 'Pure oil used (100% pure coconut, canola, or olive oil without butter/margarine)?', critical: true },
  { id: 'check-sauce', text: 'Zero soy sauce (toyo), fish sauce (patis), oyster sauce, or bouillon cubes?', critical: true },
  { id: 'check-eggs', text: 'Pure egg whites only (meticulously separated from yolks)?', critical: true },
  { id: 'check-dairy', text: 'Zero dairy milk, cheese, butter, or whey added?', critical: true },
  { id: 'check-veggies', text: 'Safe vegetables chosen (no potatoes, cassava, or cruciferous greens)?', critical: true }
];
