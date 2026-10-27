// KosherAI - Curated Multi-Diet Pinoy Meal Collections & Recipes Dataset
// Structured with dedicated meals, snack collections, compliance audit targets, and lightweight optimized image thumbnails for each dietary protocol.

export const DIET_RECIPES = {
  lid: {
    title: "Practical LID / RAI Compliant Dishes",
    description: "Curated home-cooked meals strictly <5 mcg iodine per serving. Free of commercial dairy, sea salt, egg yolks, and bouillons.",
    sampleAudit: { name: "Safe Family Tinola", violations: 0 },
    meals: [
      {
        id: "lid-breakfast-silog",
        title: "LID Garlic Sinangag & Egg White Scramble",
        name: "LID Garlic Sinangag & Egg White Scramble",
        type: "Breakfast",
        category: "Breakfast",
        tag: "LID Compliant • Egg Whites Only",
        prepTime: "5 mins",
        cookTime: "10 mins",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/lid-garlic-sinangag-and-egg-white-scramble.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/lid-garlic-sinangag-and-egg-white-scramble.webp",
        ingredients: [
          "2 cups day-old cooked white rice (cooked with plain water & kosher salt)",
          "6 cloves native garlic, minced and browned in pure coconut oil",
          "3 pure egg whites (separated strictly from yolks), scrambled in coconut oil",
          "Pinch of pure non-iodized kosher salt",
          "Fresh native tomato slices (garnish)"
        ],
        instructions: [
          "In a skillet, heat 1 tbsp pure coconut oil and fry minced garlic until crispy and golden brown.",
          "Toss in cooked white rice, season with non-iodized kosher salt, and stir-fry for 5 minutes.",
          "In a separate nonstick pan, scramble pure egg whites in coconut oil until set (zero egg yolk).",
          "Serve garlic sinangag hot alongside scrambled egg whites and fresh sliced native tomatoes."
        ],
        clinicalRationale: "Provides clean energy for RAI prep without iodine contamination: utilizes non-iodized salt, egg whites only (iodine is concentrated in yolks), and unfortified rice.",
        clinicalNote: "Provides clean energy for RAI prep without iodine contamination: utilizes non-iodized salt, egg whites only (iodine is concentrated in yolks), and unfortified rice."
      },
      {
        id: "lid-tinola",
        title: "LID Chicken & Ginger Tinola Broth",
        name: "LID Chicken & Ginger Tinola Broth",
        type: "Soups & Stews",
        category: "Soups & Stews",
        prepTime: "10 mins",
        cookTime: "25 mins",
        tag: "LID Compliant • <5 mcg Iodine",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/lid-chicken-and-ginger-tinoa-broth.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/lid-chicken-and-ginger-tinoa-broth.webp",
        clinicalRationale: "Uses pure non-iodized kosher salt and skinless fresh chicken. Avoid store-bought chicken broth cubes.",
        clinicalNote: "Uses pure non-iodized kosher salt and skinless fresh chicken. Avoid store-bought chicken broth cubes.",
        instructions: [
          "Sauté ginger slices and crushed garlic in coconut oil until aromatic.",
          "Add fresh chicken cutlets and sear lightly on all sides.",
          "Pour filtered water and bring to a gentle simmer for 15 minutes.",
          "Add sliced sayote and season strictly with non-iodized kosher salt and black pepper.",
          "Toss in fresh dahon ng sili right before turning off the heat."
        ],
        ingredients: [
          "1 lb fresh chicken cutlets",
          "1 sayote (chayote), peeled and sliced",
          "1 tbsp pure coconut oil",
          "1 tsp non-iodized kosher salt",
          "Fresh ginger, garlic, and dahon ng sili"
        ]
      },
      {
        id: "lid-bistek",
        title: "Homemade LID Bistek Tagalog",
        name: "Homemade LID Bistek Tagalog",
        type: "Mains",
        category: "Mains",
        prepTime: "15 mins",
        cookTime: "20 mins",
        tag: "LID Compliant • No Soy Sauce",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/homemade-lid-bistek-tagalog.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/homemade-lid-bistek-tagalog.webp",
        clinicalRationale: "Traditional toyo is replaced with fresh calamansi reduction and caramelized onions for umami without fermented soy iodine.",
        clinicalNote: "Traditional toyo is replaced with fresh calamansi reduction and caramelized onions for umami without fermented soy iodine.",
        instructions: [
          "Marinate lean beef sirloin in pure calamansi juice, cracked black pepper, and kosher salt.",
          "Heat coconut oil in a pan and sear beef slices quickly over high heat.",
          "Sauté thick white onion rings in the same pan juices until translucent.",
          "Combine beef and onions, simmer for 2 minutes, and serve hot."
        ],
        ingredients: [
          "Lean beef sirloin, thinly sliced",
          "Fresh calamansi juice",
          "Non-iodized kosher salt and cracked black pepper",
          "White onions sliced into rings",
          "Pure coconut oil"
        ]
      },
      {
        id: "lid-snack-kamote",
        title: "Steamed Kamote with Coconut Oil",
        name: "Steamed Kamote with Coconut Oil",
        type: "Snacks & Sides",
        category: "Snacks & Sides",
        prepTime: "5 mins",
        cookTime: "15 mins",
        tag: "LID Compliant • Plant Fuel",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/steamed-kamote-with-coconut-oil.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793066348/steamed-kamote-with-coconut-oil.webp",
        clinicalRationale: "Yellow sweet potatoes are inherently low in iodine, rich in vitamin A, and completely free from commercial dairy coatings.",
        clinicalNote: "Yellow sweet potatoes are inherently low in iodine, rich in vitamin A, and completely free from commercial dairy coatings.",
        instructions: [
          "Wash, peel, and cut yellow sweet potato into bite-sized wedges.",
          "Steam over simmering filtered water for 15 minutes until fork-tender.",
          "Drizzle with cold-pressed virgin coconut oil and sprinkle with coarse non-iodized kosher salt."
        ],
        ingredients: [
          "1 medium native yellow sweet potato (kamote), peeled",
          "1 tsp cold-pressed virgin coconut oil",
          "Coarse non-iodized kosher salt to taste"
        ]
      }
    ]
  },

  diabetic: {
    title: "Practical Diabetic & Low-GI Pinoy Dishes",
    description: "Meals structured with high fiber, lean proteins, and complex carbohydrates to stabilize blood glucose and insulin sensitivity.",
    sampleAudit: { name: "Ginisang Ampalaya", violations: 0 },
    meals: [
      {
        id: "diabetic-breakfast-tortang-talong",
        title: "Skinless Chicken & Vegetable Tortang Talong",
        name: "Skinless Chicken & Vegetable Tortang Talong",
        type: "Breakfast",
        category: "Breakfast",
        tag: "Low GI • Protein & Fiber",
        prepTime: "10 mins",
        cookTime: "12 mins",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/skinless-chicken-and-vegetable-tortang-talong.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/skinless-chicken-and-vegetable-tortang-talong.webp",
        ingredients: [
          "1 large native eggplant (talong), roasted and peeled",
          "1 whole farm-fresh egg + 1 egg white, beaten",
          "2 tbsp cooked lean ground chicken breast",
          "1 tbsp finely diced native tomatoes & red onions",
          "1 tsp pure olive oil",
          "Fresh calamansi wedge and cracked black pepper"
        ],
        instructions: [
          "Roast eggplant over open flame until skin is charred; peel under cool water, keeping stem intact.",
          "Flatten roasted eggplant with a fork.",
          "Whisk egg with diced tomatoes, onions, lean chicken breast, and black pepper.",
          "Dip flattened eggplant into the egg mixture and pan-sear in olive oil until golden on both sides.",
          "Serve hot with a squeeze of fresh calamansi for natural acidity without ketchup."
        ],
        clinicalRationale: "Lowers postprandial glucose spike: eggplant offers soluble fiber that slows carbohydrate absorption, while lean chicken and egg provide sustained satiety without sugar.",
        clinicalNote: "Lowers postprandial glucose spike: eggplant offers soluble fiber that slows carbohydrate absorption, while lean chicken and egg provide sustained satiety without sugar."
      },
      {
        id: "diabetic-ampalaya",
        title: "Ginisang Ampalaya with Native Egg & Lean Chicken",
        name: "Ginisang Ampalaya with Native Egg & Lean Chicken",
        type: "Mains",
        category: "Mains",
        prepTime: "15 mins",
        cookTime: "12 mins",
        tag: "Low Glycemic • Charantin-Rich",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/ginisang-ampalaya-with-native-egg-and-lean-chicken.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/ginisang-ampalaya-with-native-egg-and-lean-chicken.webp",
        clinicalRationale: "Bitter melon contains charantin and polypeptide-p, clinical phytonutrients that help lower blood sugar levels naturally.",
        clinicalNote: "Bitter melon contains charantin and polypeptide-p, clinical phytonutrients that help lower blood sugar levels naturally.",
        instructions: [
          "Slice ampalaya thinly, massage with light salt, and rinse with cold water to temper bitterness.",
          "Sauté garlic, onions, and fresh tomatoes in olive or coconut oil.",
          "Add shredded lean chicken breast and cook through.",
          "Stir in ampalaya slices and gently fold in beaten native eggs until set."
        ],
        ingredients: [
          "Bitter gourd (ampalaya), sliced thin and salted to reduce bitterness",
          "2 whole eggs, beaten",
          "Skinless chicken breast flakes",
          "Tomatoes, garlic, and onions",
          "1 tsp olive oil or coconut oil"
        ]
      },
      {
        id: "diabetic-sinigang",
        title: "Sinigang na Bangus sa Fresh Calamansi & Kangkong",
        name: "Sinigang na Bangus sa Fresh Calamansi & Kangkong",
        type: "Soups & Stews",
        category: "Soups & Stews",
        prepTime: "10 mins",
        cookTime: "20 mins",
        tag: "Zero Sugar Souring • High Fiber",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/sinigang-na-bangus-sa-fresh-calamansi-and-kangkong.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/sinigang-na-bangus-sa-fresh-calamansi-and-kangkong.webp",
        clinicalRationale: "Commercial powdered sinigang mixes contain hidden maltodextrin and MSG; fresh calamansi provides clean, zero-sugar acidity.",
        clinicalNote: "Commercial powdered sinigang mixes contain hidden maltodextrin and MSG; fresh calamansi provides clean, zero-sugar acidity.",
        instructions: [
          "Boil fresh water with diced tomatoes and sliced white onions.",
          "Add fresh bangus slices and simmer gently for 8 minutes.",
          "Add sliced sayote and cook until tender.",
          "Pour pure calamansi juice and siling haba for gentle heat.",
          "Add kangkong leaves and turn off stove immediately to keep fiber intact."
        ],
        ingredients: [
          "Fresh milkfish (bangus), cleaned and sliced",
          "Pure calamansi extract (zero added sugar)",
          "Abundant water spinach (kangkong) and sayote",
          "Tomatoes and green finger chili (siling haba)"
        ]
      },
      {
        id: "diabetic-snack-talbos",
        title: "Ensaladang Talbos ng Kamote with Calamansi",
        name: "Ensaladang Talbos ng Kamote with Calamansi",
        type: "Snacks & Sides",
        category: "Snacks & Sides",
        prepTime: "8 mins",
        cookTime: "3 mins",
        tag: "Antioxidant & Fiber Dense",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/ensaladang-talbo-ng-kamote-with-calamansi.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084102/ensaladang-talbo-ng-kamote-with-calamansi.webp",
        clinicalRationale: "Sweet potato leaves have a very low glycemic load and are rich in polyphenols that improve insulin resistance.",
        clinicalNote: "Sweet potato leaves have a very low glycemic load and are rich in polyphenols that improve insulin resistance.",
        instructions: [
          "Blanch freshly washed talbos ng kamote in rolling boiled water for 90 seconds, then plunge into ice water.",
          "Drain thoroughly and toss with diced native tomatoes and red onions.",
          "Dress with freshly squeezed calamansi juice and a touch of extra virgin olive oil."
        ],
        ingredients: [
          "Blanched sweet potato leaves (talbos ng kamote)",
          "Diced native tomatoes and red onions",
          "Pure calamansi juice and a touch of olive oil"
        ]
      }
    ]
  },

  low_purine: {
    title: "Practical Low-Purine & Anti-Uric Acid Dishes",
    description: "Designed to lower serum uric acid and prevent gout flare-ups. Free of organ meats (isaw, atay), bagoong, shellfish, and excess yeast.",
    sampleAudit: { name: "Gout-Safe Pesang Manok", violations: 0 },
    meals: [
      {
        id: "purine-breakfast-oat-arrozcaldo",
        title: "Ginger & Garlic Rolled Oats Arroz Caldo",
        name: "Ginger & Garlic Rolled Oats Arroz Caldo",
        type: "Breakfast",
        category: "Breakfast",
        tag: "Alkalizing • Low Purine",
        prepTime: "5 mins",
        cookTime: "12 mins",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/ginger-and-garlic-rolled-oats-arroz-caldo.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/ginger-and-garlic-rolled-oats-arroz-caldo.webp",
        ingredients: [
          "1/2 cup rolled whole oats (low-purine grain alternative)",
          "2 cups water or weak vegetable broth",
          "2 inches fresh ginger, sliced into thin coins",
          "3 cloves garlic, crushed and toasted in canola oil",
          "1 soft-boiled egg (moderate purine protein)",
          "Chopped fresh scallions and native calamansi"
        ],
        instructions: [
          "In a saucepan, simmer sliced ginger in water for 5 minutes to create an aromatic ginger broth.",
          "Stir in rolled oats and cook over medium heat for 7 minutes until thick and comforting.",
          "Pour into a bowl, top with a halved soft-boiled egg and golden toasted garlic bits.",
          "Garnish with chopped scallions and squeeze fresh calamansi over the bowl."
        ],
        clinicalRationale: "Replaces high-purine chicken organs or beef bones with a soothing ginger-oat base. Whole oats and eggs supply steady nutrition without raising serum uric acid.",
        clinicalNote: "Replaces high-purine chicken organs or beef bones with a soothing ginger-oat base. Whole oats and eggs supply steady nutrition without raising serum uric acid."
      },
      {
        id: "purine-pesa",
        title: "Gout-Safe Pesang Manok with Pechay & Sayote",
        name: "Gout-Safe Pesang Manok with Pechay & Sayote",
        type: "Soups & Stews",
        category: "Soups & Stews",
        prepTime: "10 mins",
        cookTime: "25 mins",
        tag: "Fresh Broth • Low Purine Meat Cut",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/gout-safe-pesang-manok-with-pechay-and-sayote.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/gout-safe-pesang-manok-with-pechay-and-sayote.webp",
        clinicalRationale: "By discarding the first-boil broth and using skinless breast meat only, purine density is decreased by 40% compared to typical bone broths.",
        clinicalNote: "By discarding the first-boil broth and using skinless breast meat only, purine density is decreased by 40% compared to typical bone broths.",
        instructions: [
          "Simmer skinless chicken breast for 5 minutes in water; drain and discard this first water to wash out purines.",
          "Refill pot with fresh water, fresh ginger coins, crushed garlic, and peppercorns.",
          "Add sliced sayote and pechay leaves; simmer until vegetables are tender.",
          "Season with a pinch of salt and calamansi instead of patis or chicken cubes."
        ],
        ingredients: [
          "Skinless chicken breast cutlets (first boil broth discarded)",
          "Fresh ginger slices and pechay leaves",
          "Sliced sayote and whole black peppercorns",
          "Pure calamansi juice and light salt (no patis or bouillon)"
        ]
      },
      {
        id: "purine-upo",
        title: "Ginisang Upo with Egg & Garlic",
        name: "Ginisang Upo with Egg & Garlic",
        type: "Mains",
        category: "Mains",
        prepTime: "10 mins",
        cookTime: "15 mins",
        tag: "Hydrating • Minimal Purines",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/ginisang-upo-with-egg-and-garlic.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/ginisang-upo-with-egg-and-garlic.webp",
        clinicalRationale: "Bottle gourd (upo) is 96% water and alkalizing to kidneys, promoting urinary excretion of uric acid.",
        clinicalNote: "Bottle gourd (upo) is 96% water and alkalizing to kidneys, promoting urinary excretion of uric acid.",
        instructions: [
          "Sauté minced garlic and onions in vegetable oil until golden.",
          "Add sliced upo batons and 3 tablespoons of water.",
          "Cover and simmer for 8 minutes until upo turns translucent.",
          "Crack in native egg and gently scramble through the gourd."
        ],
        ingredients: [
          "Bottle gourd (upo), peeled and sliced into batons",
          "1 native egg",
          "Toasted garlic cloves and onions",
          "Vegetable cooking oil"
        ]
      },
      {
        id: "purine-snack-pipino",
        title: "Spiced Cucumber & Calamansi Salad",
        name: "Spiced Cucumber & Calamansi Salad",
        type: "Snacks & Sides",
        category: "Snacks & Sides",
        prepTime: "5 mins",
        cookTime: "0 mins",
        tag: "Alkalizing • Low Purine",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/spiced-cucumber-and-calamansi-salad.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793081339/spiced-cucumber-and-calamansi-salad.webp",
        clinicalRationale: "Cucumbers are virtually purine-free and help dissolve crystallized uric acid in the bloodstream.",
        clinicalNote: "Cucumbers are virtually purine-free and help dissolve crystallized uric acid in the bloodstream.",
        instructions: [
          "Thinly slice chilled native cucumbers.",
          "In a small bowl, whisk calamansi juice, organic apple cider vinegar, and cracked black pepper.",
          "Toss cucumber slices with dressing and fresh crushed garlic."
        ],
        ingredients: [
          "Chilled sliced cucumbers",
          "Calamansi juice and organic apple cider vinegar",
          "Cracked black pepper and crushed garlic"
        ]
      }
    ]
  },

  low_sodium: {
    title: "Practical Low-Sodium & Heart-Care (DASH) Dishes",
    description: "Formulated for blood pressure control and renal health. Eliminates patis, toyomansi, bagoong, and processed bouillon cubes.",
    sampleAudit: { name: "Potassium-Rich Nilagang Baka", violations: 0 },
    meals: [
      {
        id: "sodium-breakfast-poached-egg-kamote",
        title: "Poached Egg on Toasted Kamote Rounds",
        name: "Poached Egg on Toasted Kamote Rounds",
        type: "Breakfast",
        category: "Breakfast",
        tag: "DASH Aligned • Zero Added Salt",
        prepTime: "5 mins",
        cookTime: "10 mins",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/poached-egg-on-toasted-kamote-rounds.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/poached-egg-on-toasted-kamote-rounds.webp",
        ingredients: [
          "1 medium yellow sweet potato (kamote), scrubbed and sliced into 1/2-inch rounds",
          "1 fresh native egg, poached in simmering vinegar water",
          "1/2 cup fresh dahon ng kangkong or baby spinach, wilted",
          "1 tsp garlic-infused olive oil",
          "Freshly cracked black pepper and fresh calamansi juice"
        ],
        instructions: [
          "Steam or pan-toast sweet potato rounds in garlic olive oil until golden and fork-tender.",
          "Poach fresh egg in simmering water with a splash of vinegar until whites are firm and yolk is runny.",
          "Arrange warm kamote rounds on a plate, top with wilted greens and poached egg.",
          "Finish with cracked black pepper and a drop of calamansi for citrus brightness without salt."
        ],
        clinicalRationale: "Delivers over 500mg of natural dietary potassium from kamote and greens to help flush sodium and promote healthy vascular tone, completely eliminating added sodium.",
        clinicalNote: "Delivers over 500mg of natural dietary potassium from kamote and greens to help flush sodium and promote healthy vascular tone, completely eliminating added sodium."
      },
      {
        id: "sodium-nilaga",
        title: "Potassium-Rich Nilagang Baka with Cabbage",
        name: "Potassium-Rich Nilagang Baka with Cabbage",
        type: "Soups & Stews",
        category: "Soups & Stews",
        prepTime: "15 mins",
        cookTime: "45 mins",
        tag: "No Patis • Fresh Broth",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/potassium-rich-nilagang-baka-with-cabbage.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/potassium-rich-nilagang-baka-with-cabbage.webp",
        clinicalRationale: "High potassium from cabbage and Baguio beans actively counterbalances systemic sodium to normalize blood pressure.",
        clinicalNote: "High potassium from cabbage and Baguio beans actively counterbalances systemic sodium to normalize blood pressure.",
        instructions: [
          "Simmer lean beef shank in water for 5 minutes, then discard the first water to remove excess sodium and impurities.",
          "Refill with fresh water, whole black peppercorns, and whole sweet yellow onions; simmer until tender.",
          "Add Baguio beans and large green cabbage wedges in the last 4 minutes.",
          "Top with plenty of golden toasted garlic bits instead of dipping patis."
        ],
        ingredients: [
          "Lean beef shank simmered with discarded first-boil broth",
          "Whole green cabbage and Baguio beans",
          "Whole peppercorns and sweet whole yellow onion",
          "Savor with roasted garlic instead of fish sauce"
        ]
      },
      {
        id: "sodium-bistek",
        title: "Garlic-Calamansi Sautéed Pork Loin",
        name: "Garlic-Calamansi Sautéed Pork Loin",
        type: "Mains",
        category: "Mains",
        prepTime: "15 mins",
        cookTime: "15 mins",
        tag: "Soy-Free Umami",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/garlic-calamansi-sauteed-pork-loin.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/garlic-calamansi-sauteed-pork-loin.webp",
        clinicalRationale: "Utilizes calamansi citrus acids and natural onion sweetness to produce a savory glaze without any added sodium.",
        clinicalNote: "Utilizes calamansi citrus acids and natural onion sweetness to produce a savory glaze without any added sodium.",
        instructions: [
          "Slice lean pork loin into thin medallions and rub with cracked black pepper.",
          "Sear in garlic-infused oil over medium-high heat for 3 minutes per side.",
          "Caramelize white onion rings in the same pan, then deglaze with pure calamansi juice.",
          "Simmer pork medallions in the citrus glaze for 2 minutes and serve immediately."
        ],
        ingredients: [
          "Tender pork loin medallions",
          "Reduction of fresh calamansi, caramelized white onions, and cracked pepper",
          "Toasted garlic oil for depth without salt"
        ]
      },
      {
        id: "sodium-snack-singkamas",
        title: "Crisp Singkamas Slices with Calamansi-Sili Dip",
        name: "Crisp Singkamas Slices with Calamansi-Sili Dip",
        type: "Snacks & Sides",
        category: "Snacks & Sides",
        prepTime: "5 mins",
        cookTime: "0 mins",
        tag: "Crunchy • Zero Added Sodium",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/crisp-singkamas-slices-with-calamansi-sili-dip.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793082441/crisp-singkamas-slices-with-calamansi-sili-dip.webp",
        clinicalRationale: "Naturally refreshing, high-potassium jicama offers satisfying crunch without bagoong or salt dips.",
        clinicalNote: "Naturally refreshing, high-potassium jicama offers satisfying crunch without bagoong or salt dips.",
        instructions: [
          "Peel fresh jicama (singkamas) and cut into crisp matchstick fries.",
          "In a small dipping bowl, crush siling labuyo into fresh calamansi juice with toasted garlic flakes.",
          "Dip fresh singkamas sticks for zero-sodium afternoon snacking."
        ],
        ingredients: [
          "Peeled jicama (singkamas) cut into sticks",
          "Dip: Pure calamansi juice with crushed siling labuyo and roasted garlic bits"
        ]
      }
    ]
  },

  pinoy_keto: {
    title: "Practical Pinoy Keto & Low-Carb Dishes",
    description: "Ketogenic meals featuring hearty fats and moderate proteins while eliminating white rice, sugar, and high-starch tubers.",
    sampleAudit: { name: "Pinoy Keto Adobo & Veg", violations: 0 },
    meals: [
      {
        id: "keto-breakfast-egg-avocado-tinapa",
        title: "Pinoy Keto Silog (Cauliflower Rice)",
        name: "Flaked Smoked Tinapa, Egg & Avocado Bowl",
        type: "Breakfast",
        category: "Breakfast",
        tag: "Ketogenic • <4g Net Carbs",
        prepTime: "5 mins",
        cookTime: "5 mins",
        netCarbs: "2g",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/flaked-smoked-tinapa-egg-and-avocado-bowl.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/flaked-smoked-tinapa-egg-and-avocado-bowl.webp",
        ingredients: [
          "1/2 cup flaked smoked bangus or galunggong (tinapa, bones removed)",
          "2 sunny-side-up native eggs fried in pure coconut oil",
          "1/2 ripe native avocado, sliced",
          "1 cup fresh cucumber spears",
          "Spiced coconut vinegar with crushed garlic and siling labuyo (dipping sauce)"
        ],
        instructions: [
          "Fry eggs in pure coconut oil until whites are crisp on the edges.",
          "Briefly warm flaked tinapa in the residual coconut oil for 1 minute.",
          "Assemble bowl with fried eggs, flaked tinapa, fresh sliced avocado, and cucumber spears.",
          "Serve with spiced coconut vinegar as a zero-carb, sugar-free dipping acid."
        ],
        clinicalRationale: "Rich in healthy monounsaturated fats and omega-3s for robust ketosis. Eliminates all morning rice/starch while keeping total net carbs well under 4g.",
        clinicalNote: "Rich in healthy monounsaturated fats and omega-3s for robust ketosis. Eliminates all morning rice/starch while keeping total net carbs well under 4g."
      },
      {
        id: "keto-adobo",
        title: "Keto Pork Belly Adobo",
        name: "Traditional Pork Belly Adobo (Sugar-Free)",
        type: "Mains",
        category: "Mains",
        prepTime: "10 mins",
        cookTime: "35 mins",
        netCarbs: "3g",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/traditional-pork-belly-adobo-sugar.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/traditional-pork-belly-adobo-sugar.webp",
        clinicalRationale: "Rich pork belly provides healthy fats for ketone production; zero brown sugar or starch thickeners are used.",
        clinicalNote: "Rich pork belly provides healthy fats for ketone production; zero brown sugar or starch thickeners are used.",
        instructions: [
          "Brown pork belly cubes in a hot heavy-bottomed pot.",
          "Add crushed whole garlic head, bay leaves, and black peppercorns.",
          "Pour sukang paombong (coconut vinegar) and coconut aminos/tamari; do not stir until boiling.",
          "Lower heat, cover, and braise for 30 minutes until meat is tender and natural lard renders."
        ],
        ingredients: [
          "Pork belly (liempo) cut into cubes",
          "Coconut vinegar (sukang paombong)",
          "Low-carb coconut aminos or tamari",
          "Crushed garlic head and dried bay leaves",
          "Black peppercorns (no brown sugar or cornstarch)"
        ]
      },
      {
        id: "keto-ginataan",
        title: "Sinigang na Baboy with Kangkong & Radish",
        name: "Ginataang Sitaw at Kalabasa (Low-Carb Style)",
        type: "Soups & Stews",
        category: "Soups & Stews",
        prepTime: "10 mins",
        cookTime: "20 mins",
        netCarbs: "4g",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/ginataang-sitaw-at-kalabasa-low-carb-style.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/ginataang-sitaw-at-kalabasa-low-carb-style.webp",
        clinicalRationale: "Coconut milk supplies Medium Chain Triglycerides (MCTs) that rapidly convert to fuel in ketosis.",
        clinicalNote: "Coconut milk supplies Medium Chain Triglycerides (MCTs) that rapidly convert to fuel in ketosis.",
        instructions: [
          "Simmer pork shoulder slices with ginger and minced garlic in half cup of water until tender.",
          "Pour fresh first-press kakang gata and bring to a gentle boil.",
          "Add cut yardlong sitaw and small portions of squash cubes.",
          "Simmer until vegetables are cooked and coconut oil separates slightly on top."
        ],
        ingredients: [
          "Fresh kakang gata (first-press coconut milk)",
          "Yardlong beans (sitaw) and small portions of squash",
          "Pork shoulder cuts",
          "Ginger, garlic, and siling labuyo"
        ]
      },
      {
        id: "keto-snack-chicharon",
        title: "Crispy Pork Chicharon & Spiced Sinamak",
        name: "Pure Pork Backfat Chicharon with Spiced Coconut Vinegar",
        type: "Snacks & Sides",
        category: "Snacks & Sides",
        prepTime: "0 mins",
        cookTime: "0 mins",
        netCarbs: "0g",
        image: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/pure-pork-backfat-chicharon-with-spiced-coconut-vinegar.webp",
        imageUrl: "https://res.cloudinary.com/dego6hgcb/image/upload/v1793084523/pure-pork-backfat-chicharon-with-spiced-coconut-vinegar.webp",
        clinicalRationale: "Authentic Pinoy chicharon without flour/starch breading is a textbook zero-carb high-fat snack.",
        clinicalNote: "Authentic Pinoy chicharon without flour/starch breading is a textbook zero-carb high-fat snack.",
        instructions: [
          "Select clean, authentic pork rinds fried in natural pork lard.",
          "Serve alongside Sukang Iloco spiced with crushed native garlic and siling labuyo."
        ],
        ingredients: [
          "Air-fried or lard-fried pork rinds (chicharon without MSG/starch coating)",
          "Spiced sukang Iloco with garlic and sili dip"
        ]
      }
    ]
  }
};
