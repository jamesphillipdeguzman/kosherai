// KosherAI Home Tab Component
// Full-bleed gradient-blended hero and clean below-the-fold sections for every Filipino household.

export function renderHomeTab(state = {}) {
  const showProjectTab = Boolean(state.showProjectTab);

  const benefitCards = [
    {
      id: 'budgeting',
      title: 'Smart Food Budgeting',
      icon: '💰',
      description: 'Make every peso count. Track grocery expenses and understand household food spending.',
      ctaLabel: 'Receipts & Spending',
      attr: 'data-home-course-tab="trips"'
    },
    {
      id: 'waste',
      title: 'Reduce Food Waste',
      icon: '♻️',
      description: 'Use more, waste less. Monitor pantry inventory and track household food consumption.',
      ctaLabel: 'Food Waste Log',
      attr: 'data-home-course-tab="waste"'
    },
    {
      id: 'mealplan',
      title: 'Healthy Meal Planning',
      icon: '🥗',
      description: 'Build better eating habits. Plan practical, nutritious meals with ingredients you have.',
      ctaLabel: 'Weekly Meal Planner',
      attr: 'data-home-course-tab="mealplan"'
    },
    {
      id: 'dietary',
      title: 'Specialized Dietary Support',
      icon: '🛡️',
      description: 'Support specific dietary protocols, including low-iodine diets for RAI preparation.',
      ctaLabel: 'Ingredient Checker',
      attr: 'data-home-diet-tab="checker"'
    }
  ];

  const spotlightBenefits = [
    {
      icon: '🌱',
      title: 'Build Healthy Habits',
      desc: 'Develop sustainable food and meal-planning routines.'
    },
    {
      icon: '🎯',
      title: 'Plan with Purpose',
      desc: 'Organize meals and make more intentional food choices.'
    },
    {
      icon: '💰',
      title: 'Manage Your Budget',
      desc: 'Make your food spending more purposeful.'
    },
    {
      icon: '♻️',
      title: 'Reduce Food Waste',
      desc: 'Make better use of the food you purchase.'
    }
  ];

  const steps = [
    {
      badge: '01 — PLAN',
      title: 'Plan',
      description: 'Organize meals and make smarter grocery decisions.'
    },
    {
      badge: '02 — TRACK',
      title: 'Track',
      description: 'Monitor purchases, inventory, spending, and food waste.'
    },
    {
      badge: '03 — IMPROVE',
      title: 'Improve',
      description: 'Build healthier food habits and reduce unnecessary expenses.'
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
    <div class="home-page">
      <!-- 1. Full-Bleed Blended Hero Section -->
      <section aria-labelledby="home-hero-heading" class="home-hero-bleed">
        <img
          src="/hero.jpg"
          alt="Filipino family preparing fresh healthy vegetables together in the kitchen"
          class="home-hero-bg-img"
        />
        <div class="home-hero-gradient" aria-hidden="true"></div>
        <div class="home-hero-glow" aria-hidden="true"></div>

        <div class="home-hero-inner">
          <div class="home-hero-stack">
            <!-- Brand Header -->
            <div class="home-brand-header">
              <img src="/favicon.svg" alt="KosherAI Shield Logo" class="home-brand-logo" />
              <div class="home-brand-text">
                <span class="home-brand-name">Kosher<span class="home-brand-name-ai">AI</span></span>
                <span class="home-brand-subtitle">SMART KITCHEN COMPANION</span>
              </div>
            </div>

            <!-- Main Stacked Headline -->
            <h1 id="home-hero-heading" class="home-hero-title">
              Eat Smart.<br />
              Spend Wisely.<br />
              <span class="home-hero-title-accent">Waste Less.</span>
            </h1>

            <!-- Supporting Subtitle -->
            <p class="home-hero-subtitle">
              Smarter Food Choices for Every Filipino Household.
            </p>

            <!-- Feature Pills -->
            <div class="home-pills-row">
              <span class="home-feature-pill"><span class="home-pill-dot" aria-hidden="true"></span>Smart Food Budgeting</span>
              <span class="home-feature-pill"><span class="home-pill-dot" aria-hidden="true"></span>Food Waste Reduction</span>
              <span class="home-feature-pill"><span class="home-pill-dot" aria-hidden="true"></span>Healthy Eating</span>
            </div>

            <!-- Calls to Action -->
            <div class="home-hero-actions">
              <button
                type="button"
                id="home-explore-kitchen-btn"
                data-home-explore-kitchen="true"
                class="home-btn-primary"
              >
                <span>Explore Your Kitchen</span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                id="home-browse-recipes-btn"
                data-home-diet-tab="cook"
                class="home-btn-secondary"
              >
                <span>Browse Recipes</span>
              </button>
            </div>

            <!-- Footer Note -->
            <p class="home-hero-footer-note">
              Specialized dietary support, including low-iodine diets.
            </p>
          </div>
        </div>
      </section>

      <!-- 2. Below-the-Fold Sections -->
      <div class="home-lower-sections">
        <!-- Built for Every Filipino Household -->
        <section id="home-benefits-section" aria-labelledby="home-benefits-heading" class="home-section">
          <div class="home-section-header">
            <h2 id="home-benefits-heading" class="home-section-title">
              Built for Every Filipino Household
            </h2>
            <p class="home-section-subtitle">
              Practical tools to stretch your grocery budget, minimize waste, and plan healthier family meals.
            </p>
          </div>

          <div class="home-benefits-grid">
            ${benefitCards.map(card => `
              <button
                type="button"
                ${card.attr}
                class="home-benefit-card"
              >
                <div>
                  <div class="home-card-icon" aria-hidden="true">${card.icon}</div>
                  <h3 class="home-card-title">${card.title}</h3>
                  <p class="home-card-body">${card.description}</p>
                </div>
                <div class="home-card-footer">
                  <span>${card.ctaLabel}</span>
                  <span aria-hidden="true">→</span>
                </div>
              </button>
            `).join('')}
          </div>
        </section>

        <!-- 6-Week Project Spotlight -->
        <section aria-labelledby="home-spotlight-heading" class="home-project-spotlight">
          <div class="home-spotlight-top">
            <div class="home-spotlight-copy">
              <span class="home-eyebrow" style="margin-bottom: 0;">SUSTAINING HUMAN LIFE • 6-WEEK PROJECT</span>
              <h2 id="home-spotlight-heading" class="home-spotlight-title">
                Make Every Meal Count.
              </h2>
              <p class="home-spotlight-desc">
                Discover how small, intentional food choices can make a meaningful difference. The Sustaining Human Life 6-Week Project helps you build healthier eating habits, plan meals thoughtfully, manage your food budget, and reduce food waste—one week at a time.
              </p>
            </div>
            <button
              type="button"
              id="home-explore-project-btn"
              data-home-course-tab="dashboard"
              class="home-spotlight-cta"
            >
              <span>Explore the 6-Week Project</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div class="home-spotlight-grid">
            ${spotlightBenefits.map(item => `
              <div class="home-spotlight-item">
                <h3 class="home-spotlight-item-title">
                  <span aria-hidden="true">${item.icon}</span>
                  <span>${item.title}</span>
                </h3>
                <p class="home-spotlight-item-desc">${item.desc}</p>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- How KosherAI Helps -->
        <section aria-labelledby="home-steps-heading" class="home-section">
          <div class="home-section-header">
            <h2 id="home-steps-heading" class="home-section-title">
              How KosherAI Helps
            </h2>
            <p class="home-section-subtitle">
              A simple three-step rhythm for smarter daily food management.
            </p>
          </div>

          <div class="home-steps-grid">
            ${steps.map(step => `
              <div class="home-step-card">
                <span class="home-step-badge">${step.badge}</span>
                <h3 class="home-step-title">${step.title}</h3>
                <p class="home-step-desc">${step.description}</p>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- Explore KosherAI Modules -->
        <section aria-labelledby="home-features-heading" class="home-section">
          <div class="home-section-header">
            <h2 id="home-features-heading" class="home-section-title">
              Explore KosherAI Modules
            </h2>
            <p class="home-section-subtitle">
              Jump directly to any tool in your kitchen workspace.${!showProjectTab ? ' Selecting a tracking module opens the 6-Week Project workspace.' : ''}
            </p>
          </div>

          <div class="home-modules-grid">
            ${featureLinks.map(item => `
              <button
                type="button"
                ${item.attr}
                class="home-module-card"
              >
                <span class="home-module-icon" aria-hidden="true">${item.icon}</span>
                <div class="home-module-body">
                  <div class="home-module-title-row">
                    <h3 class="home-module-title">${item.title}</h3>
                    <span class="home-module-arrow" aria-hidden="true">→</span>
                  </div>
                  <p class="home-module-desc">${item.desc}</p>
                </div>
              </button>
            `).join('')}
          </div>
        </section>
      </div>
    </div>
  `;
}
