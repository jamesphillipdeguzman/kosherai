// KosherAI - Curated Multi-Diet Pinoy Meal Collections & Recipes Dataset
// Structured with dedicated meals, snack collections, and compliance audit targets for each dietary protocol.

export const DIET_RECIPES = {
  lid: {
    title: "Practical LID / RAI Compliant Dishes",
    description: "Curated home-cooked meals strictly <5 mcg iodine per serving. Free of commercial dairy, sea salt, egg yolks, and bouillons.",
    sampleAudit: { name: "Safe Family Tinola", violations: 0 },
    meals: [
      {
        id: "lid-tinola",
        name: "LID Chicken & Ginger Tinola Broth",
        type: "Soups & Stews",
        prepTime: "10 mins",
        cookTime: "25 mins",
        tag: "LID Compliant • <5 mcg Iodine",
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
        name: "Homemade LID Bistek Tagalog",
        type: "Mains",
        prepTime: "15 mins",
        cookTime: "20 mins",
        tag: "LID Compliant • No Soy Sauce",
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
        name: "Steamed Kamote with Coconut Oil",
        type: "Snacks & Sides",
        prepTime: "5 mins",
        cookTime: "15 mins",
        tag: "LID Compliant • Plant Fuel",
        clinicalNote: "Yellow/orange sweet potatoes provide unfortified complex carbohydrates and vitamin A safely on LID.",
        instructions: [
          "Wash and peel yellow kamote, cutting into bite-sized wedges.",
          "Steam over boiling water for 15 minutes until fork-tender.",
          "Drizzle with cold-pressed virgin coconut oil and sprinkle a pinch of pure kosher salt."
        ],
        ingredients: [
          "Yellow sweet potato (kamote), steamed",
          "Virgin coconut oil drizzle",
          "Pinch of pure kosher salt"
        ]
      }
    ]
  },

  diabetic: {
    title: "Practical Diabetic & Low-GI Pinoy Dishes",
    description: "Meals structured with high fiber, lean proteins, and complex carbohydrates to stabilize blood glucose and insulin sensitivity.",
    sampleAudit: { name: "Low-GI Pinakbet Haul", violations: 0 },
    meals: [
      {
        id: "diabetic-ampalaya",
        name: "Ginisang Ampalaya with Native Egg & Lean Chicken",
        type: "Mains",
        prepTime: "15 mins",
        cookTime: "12 mins",
        tag: "Low Glycemic • Charantin-Rich",
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
        name: "Sinigang na Bangus sa Fresh Calamansi & Kangkong",
        type: "Soups & Stews",
        prepTime: "10 mins",
        cookTime: "20 mins",
        tag: "Zero Sugar Souring • High Fiber",
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
        name: "Ensaladang Talbos ng Kamote with Calamansi",
        type: "Snacks & Sides",
        prepTime: "8 mins",
        cookTime: "3 mins",
        tag: "Antioxidant & Fiber Dense",
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
        id: "purine-pesa",
        name: "Pesang Manok with Pechay & Sayote",
        type: "Soups & Stews",
        prepTime: "10 mins",
        cookTime: "25 mins",
        tag: "Low Purine • Ginger Broth",
        clinicalNote: "Chicken breast has the lowest purine density among meats. Boiling with abundant ginger aids anti-inflammatory response.",
        instructions: [
          "Simmer lean skinless chicken breast with crushed ginger and peppercorns.",
          "Discard surface foam to ensure a clean, low-purine broth.",
          "Add sliced sayote and cook for 5 minutes.",
          "Add fresh pechay leaves and season with a light pinch of salt, completely avoiding yeast cubes."
        ],
        ingredients: [
          "Lean chicken breast (skin and fat removed)",
          "Fresh pechay leaves and sliced sayote",
          "Generous fresh ginger slices",
          "Light pinch of salt (avoiding bouillons/yeast cubes)"
        ]
      },
      {
        id: "purine-upo",
        name: "Ginisang Upo with Egg & Garlic",
        type: "Mains",
        prepTime: "10 mins",
        cookTime: "15 mins",
        tag: "Hydrating • Minimal Purines",
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
        name: "Spiced Cucumber & Calamansi Salad",
        type: "Snacks & Sides",
        prepTime: "5 mins",
        cookTime: "0 mins",
        tag: "Alkalizing • Low Purine",
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
    sampleAudit: { name: "Heart-Healthy Tinola", violations: 0 },
    meals: [
      {
        id: "sodium-nilaga",
        name: "Potassium-Rich Nilagang Baka with Cabbage",
        type: "Soups & Stews",
        prepTime: "15 mins",
        cookTime: "45 mins",
        tag: "No Patis • Fresh Broth",
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
        name: "Garlic-Calamansi Sautéed Pork Loin",
        type: "Mains",
        prepTime: "15 mins",
        cookTime: "15 mins",
        tag: "Soy-Free Umami",
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
        name: "Crisp Singkamas Slices with Calamansi-Sili Dip",
        type: "Snacks & Sides",
        prepTime: "5 mins",
        cookTime: "0 mins",
        tag: "Crunchy • Zero Added Sodium",
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
        id: "keto-adobo",
        name: "Traditional Pork Belly Adobo (Sugar-Free)",
        type: "Mains",
        prepTime: "10 mins",
        cookTime: "35 mins",
        tag: "High Fat • <3g Net Carbs",
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
        name: "Ginataang Sitaw at Kalabasa (Low-Carb Style)",
        type: "Soups & Stews",
        prepTime: "10 mins",
        cookTime: "20 mins",
        tag: "Pure Coconut Milk • Healthy Fats",
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
        name: "Pure Pork Backfat Chicharon with Spiced Coconut Vinegar",
        type: "Snacks & Sides",
        prepTime: "0 mins",
        cookTime: "0 mins",
        tag: "Zero Carb • Ketogenic",
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
