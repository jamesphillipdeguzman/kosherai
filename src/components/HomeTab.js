// KosherAI Home Tab Component
// Welcoming landing experience positioning KosherAI as a smart food management and healthy eating companion for every Filipino household.

export function renderHomeTab(state = {}) {
  const showProjectTab = Boolean(state.showProjectTab);

  const benefitCards = [
    {
      id: 'budgeting',
      title: 'Smart Food Budgeting',
      icon: '💰',
      accent: 'emerald',
      bullets: [
        'Track grocery expenses.',
        'Understand household food spending.',
        'Make every peso count.'
      ],
      ctaLabel: 'Open Receipts & Spending',
      attr: 'data-home-course-tab="trips"'
    },
    {
      id: 'waste',
      title: 'Reduce Food Waste',
      icon: '♻️',
      accent: 'teal',
      bullets: [
        'Monitor grocery inventory.',
        'Track food consumption and waste.',
        'Make better use of available ingredients.'
      ],
      ctaLabel: 'Open Food Waste Log',
      attr: 'data-home-course-tab="waste"'
    },
    {
      id: 'mealplan',
      title: 'Healthy Meal Planning',
      icon: '🥗',
      accent: 'amber',
      bullets: [
        'Plan practical, nutritious meals.',
        'Encourage healthier household eating habits.',
        'Make informed food choices.'
      ],
      ctaLabel: 'Explore Meal Planner',
      attr: 'data-home-course-tab="mealplan"'
    },
    {
      id: 'dietary',
      title: 'Specialized Dietary Support',
      icon: '🛡️',
      accent: 'sky',
      bullets: [
        'Support specific dietary requirements.',
        'Retain low-iodine diet and RAI patient support.',
        'Available whenever your household needs it.'
      ],
      ctaLabel: 'Open Ingredient Checker',
      attr: 'data-home-diet-tab="checker"'
    }
  ];

  const steps = [
    {
      num: '01',
      title: 'Plan',
      description: 'Organize meals and make smarter grocery decisions.',
      icon: '🗓️'
    },
    {
      num: '02',
      title: 'Track',
      description: 'Monitor purchases, household inventory, spending, and food waste.',
      icon: '📊'
    },
    {
      num: '03',
      title: 'Improve',
      description: 'Build better food habits, reduce unnecessary expenses, and support healthier eating.',
      icon: '✨'
    }
  ];

  const featureLinks = [
    {
      title: 'Dashboard & Insights',
      desc: 'Household food spending, waste ratio, and savings overview.',
      icon: '📈',
      attr: 'data-home-course-tab="dashboard"'
    },
    {
      title: 'Shopping Trips & Receipts',
      desc: 'Log supermarket and wet market trips with receipt scanning.',
      icon: '🧾',
      attr: 'data-home-course-tab="trips"'
    },
    {
      title: 'Grocery Purchases',
      desc: 'Track pantry items, quantities, and household inventory.',
      icon: '🛒',
      attr: 'data-home-course-tab="groceries"'
    },
    {
      title: 'Food Waste Log',
      desc: 'Measure kitchen and plate waste to cut avoidable losses.',
      icon: '🥬',
      attr: 'data-home-course-tab="waste"'
    },
    {
      title: 'Weekly Meal Planner',
      desc: 'Plan family meals using ingredients you already have.',
      icon: '🍽️',
      attr: 'data-home-course-tab="mealplan"'
    },
    {
      title: 'CSV Export & Reports',
      desc: 'Download structured spending and waste reports anytime.',
      icon: '📥',
      attr: 'data-home-course-tab="export"'
    },
    {
      title: 'Ingredient Checker',
      desc: 'Verify ingredients and check nutritional suitability fast.',
      icon: '🔍',
      attr: 'data-home-diet-tab="checker"'
    },
    {
      title: 'Food & Label Scanner',
      desc: 'Scan product labels and ingredients right from your device.',
      icon: '📷',
      attr: 'data-home-diet-tab="scanner"'
    },
    {
      title: 'Cook Mode Recipes',
      desc: 'Step-by-step Filipino recipes scaled for your household.',
      icon: '👨‍🍳',
      attr: 'data-home-diet-tab="cook"'
    }
  ];

  return `
    <div class="home-tab-container space-y-8 pb-8">
      <!-- A. Hero Section -->
      <section aria-labelledby="home-hero-heading" class="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-slate-900 shadow-xl">
        <div class="grid grid-cols-1 lg:grid-cols-12 min-h-[420px]">
          <!-- Hero Image (Right on desktop, Top on mobile) -->
          <div class="relative lg:col-span-6 lg:order-2 min-h-[240px] sm:min-h-[300px] lg:min-h-full overflow-hidden">
            <img
              src="/hero.jpg"
              alt="Filipino family preparing fresh healthy vegetables together in the kitchen"
              class="w-full h-full object-cover object-center"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent lg:bg-gradient-to-r lg:from-slate-950 lg:via-slate-950/45 lg:to-transparent"></div>
          </div>

          <!-- Hero Copy (Left on desktop, Bottom on mobile) -->
          <div class="relative lg:col-span-6 lg:order-1 z-10 flex flex-col justify-center p-6 sm:p-8 lg:p-10 bg-slate-950 lg:bg-gradient-to-br lg:from-slate-950 lg:via-slate-900 lg:to-emerald-950/70">
            <div class="inline-flex items-center gap-2.5 mb-5">
              <img src="/favicon.svg" alt="KosherAI Logo" class="w-9 h-9 rounded-xl shadow-md" />
              <div class="flex flex-col">
                <span class="text-sm font-extrabold tracking-tight text-white leading-none">KosherAI</span>
                <span class="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mt-0.5">Smart Kitchen Companion</span>
              </div>
            </div>

            <h1 id="home-hero-heading" class="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold tracking-tight text-white leading-[1.12] mb-3">
              Eat Smart. Spend Wisely. <span class="text-emerald-400">Waste Less.</span>
            </h1>

            <p class="text-base sm:text-lg font-medium text-emerald-100/90 leading-snug mb-3">
              Your smart kitchen companion for healthier meals, smarter grocery spending, and less household food waste.
            </p>

            <p class="text-sm text-slate-300 leading-relaxed mb-6 max-w-xl">
              KosherAI helps Filipino households make better food decisions. Plan meals, manage grocery expenses, make the most of available ingredients, reduce food waste, and build healthier eating habits — all in one place.
            </p>

            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                id="home-explore-kitchen-btn"
                data-home-explore-kitchen="true"
                class="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/30 hover:scale-[1.01] transition-transform"
              >
                <span>Explore Your Kitchen</span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                data-home-diet-tab="cook"
                class="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                <span>Browse Recipes</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- B. Four Core Benefits -->
      <section aria-labelledby="home-benefits-heading" class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 id="home-benefits-heading" class="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Built for Every Filipino Household
            </h2>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Practical tools to stretch your grocery budget, minimize waste, and plan healthier family meals.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${benefitCards.map(card => `
            <button
              type="button"
              ${card.attr}
              class="group text-left flex flex-col justify-between p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 shadow-sm hover:shadow-md transition-all"
            >
              <div>
                <div class="w-11 h-11 rounded-xl flex items-center justify-center text-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 mb-4 group-hover:scale-105 transition-transform">
                  ${card.icon}
                </div>
                <h3 class="text-base font-bold text-slate-900 dark:text-white mb-2">
                  ${card.title}
                </h3>
                <ul class="space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  ${card.bullets.map(b => `
                    <li class="flex items-start gap-2">
                      <span class="text-emerald-500 font-bold mt-0.5">•</span>
                      <span>${b}</span>
                    </li>
                  `).join('')}
                </ul>
              </div>
              <div class="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span>${card.ctaLabel}</span>
                <span class="group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span>
              </div>
            </button>
          `).join('')}
        </div>
      </section>

      <!-- C. How KosherAI Helps -->
      <section aria-labelledby="home-steps-heading" class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/75 p-6 sm:p-7">
        <div class="mb-5">
          <h2 id="home-steps-heading" class="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            How KosherAI Helps
          </h2>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
            A simple three-step rhythm for smarter daily food management.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${steps.map(step => `
            <div class="relative p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-black tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  STEP ${step.num}
                </span>
                <span class="text-2xl" aria-hidden="true">${step.icon}</span>
              </div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                ${step.title}
              </h3>
              <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                ${step.description}
              </p>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- D. Existing Features Access -->
      <section aria-labelledby="home-features-heading" class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 id="home-features-heading" class="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Explore KosherAI Modules
            </h2>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Jump directly to any tool in your kitchen workspace.${!showProjectTab ? ' Selecting a tracking module opens the 6-Week Project workspace.' : ''}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${featureLinks.map(item => `
            <button
              type="button"
              ${item.attr}
              class="group text-left flex items-start gap-3.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/80 hover:border-teal-500/50 dark:hover:border-teal-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-all"
            >
              <span class="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                ${item.icon}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-bold text-slate-900 dark:text-white truncate">
                    ${item.title}
                  </h3>
                  <span class="text-xs text-teal-600 dark:text-teal-400 font-bold group-hover:translate-x-0.5 transition-transform" aria-hidden="true">→</span>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  ${item.desc}
                </p>
              </div>
            </button>
          `).join('')}
        </div>
      </section>

      <!-- E. Specialized Dietary Support (Secondary) -->
      <section aria-labelledby="home-specialized-heading" class="rounded-2xl border border-teal-500/25 bg-teal-500/5 dark:bg-teal-950/25 p-5 sm:p-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1.5 max-w-2xl">
            <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              <span aria-hidden="true">🩺</span>
              <span>Specialized Dietary Support</span>
            </div>
            <h2 id="home-specialized-heading" class="text-base font-bold text-slate-900 dark:text-white">
              Flexible for Specific Household Food Protocols
            </h2>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Every household has different nutritional needs. KosherAI also provides specialized dietary support for individuals following specific food protocols, including low-iodine diets.
            </p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              Informational food management support only — does not replace professional medical advice.
            </p>
          </div>
          <div class="shrink-0">
            <button
              type="button"
              data-home-diet-tab="cheatsheet"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-teal-600/40 dark:border-teal-400/40 bg-white/80 dark:bg-slate-900 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60 transition-colors"
            >
              <span>View Dietary Protocols</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  `;
}
