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
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 p-2 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 pl-2">
            <span className="text-lg select-none">👨‍👩‍👧‍👦</span>
            <span className="text-xs font-bold text-slate-300">Household:</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={handleDec}
              disabled={householdMembers <= 1}
              className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white font-bold flex items-center justify-center transition-colors cursor-pointer text-sm"
              aria-label="Decrease household members"
            >
              −
            </button>
            <span className="font-bold text-xs text-white px-2 min-w-[75px] text-center select-none">
              {householdMembers} {householdMembers === 1 ? 'Member' : 'Members'}
            </span>
            <button
              type="button"
              onClick={handleInc}
              disabled={householdMembers >= 20}
              className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white font-bold flex items-center justify-center transition-colors cursor-pointer text-sm"
              aria-label="Increase household members"
            >
              +
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
