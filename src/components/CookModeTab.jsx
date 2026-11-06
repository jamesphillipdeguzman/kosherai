import React, { useState, useEffect } from 'react';
import { DIET_RECIPES } from '../data/dietRecipes.js';
import { RecipeCard } from './RecipeCard.jsx';
import { renderCookModeTab } from './CookModeTab.js';
import { getHouseholdMembers, setHouseholdMembers } from '../services/storage.js';

export { DIET_RECIPES, renderCookModeTab };

/**
 * React Component for Cook Mode Dishes Catalog with dynamic household portion scaling
 */
export function CookModeTab({ activeDiet = 'pinoy_keto', onLoadRecipe }) {
  const [householdMembers, setMembers] = useState(() => getHouseholdMembers());

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.household_members) {
        setMembers(e.detail.household_members);
      }
    };
    window.addEventListener('kosherai:household-changed', handler);
    return () => window.removeEventListener('kosherai:household-changed', handler);
  }, []);

  const handleDec = () => {
    if (householdMembers > 1) {
      const next = setHouseholdMembers(householdMembers - 1);
      setMembers(next);
    }
  };

  const handleInc = () => {
    if (householdMembers < 20) {
      const next = setHouseholdMembers(householdMembers + 1);
      setMembers(next);
    }
  };

  const currentDietData = DIET_RECIPES[activeDiet] || DIET_RECIPES.lid;
  const meals = currentDietData?.meals || [];

  return (
    <div className="cook-mode-react-container p-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-white">{currentDietData.title}</h2>
          <p className="text-sm text-slate-400 mt-1">{currentDietData.description}</p>
        </div>

        {/* Dynamic Household Portion Selector */}
        <div className="flex flex-col gap-1.5 my-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span className="text-base leading-none">👨‍👩‍👧‍👦</span>
            <span>Household Size Dynamic Scaling</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adjust recipe ingredients dynamically for your household (1–20 members).
          </p>

          {/* Modern Pill Stepper */}
          <div className="inline-flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-full px-1.5 py-1 w-fit shadow-2xs">
            {/* Decrement Button */}
            <button
              type="button"
              onClick={handleDec}
              disabled={householdMembers <= 1}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Decrease members"
              aria-label="Decrease household members"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4" />
              </svg>
            </button>

            {/* Member Count Display */}
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 min-w-16 text-center select-none">
              {householdMembers} {householdMembers === 1 ? 'Member' : 'Members'}
            </span>

            {/* Increment Button */}
            <button
              type="button"
              onClick={handleInc}
              disabled={householdMembers >= 20}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Increase members"
              aria-label="Increase household members"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {meals.map((meal) => (
          <RecipeCard
            key={meal.id}
            meal={meal}
            householdMembers={householdMembers}
            onLoadRecipe={onLoadRecipe}
          />
        ))}
      </div>
    </div>
  );
}

export default CookModeTab;
