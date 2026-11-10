import React, { useState, useEffect } from 'react';
import { DIET_RECIPES } from '../data/dietRecipes.js';
import { RecipeCard } from './RecipeCard.jsx';
import { renderCookModeTab } from './CookModeTab.js';
import { getHouseholdMembers, setHouseholdMembers } from '../services/storage.js';
import AdminIngredientImagesModal from './AdminIngredientImagesModal.jsx';

export { DIET_RECIPES, renderCookModeTab };

/**
 * React Component for Cook Mode Dishes Catalog with dynamic household portion scaling
 */
export function CookModeTab({ activeDiet = 'pinoy_keto', onLoadRecipe, isAdmin = false }) {
  const [householdMembers, setMembers] = useState(() => getHouseholdMembers());
  const [showAdminImageModal, setShowAdminImageModal] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(() => {
    if (isAdmin) return true;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('kosherai_current_user') || localStorage.getItem('kosherai_user_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          const u = parsed.user || parsed;
          return Boolean(u && (u.role === 'admin' || u.role === 'administrator'));
        }
      } catch (_) {}
    }
    return false;
  });

  useEffect(() => {
    const householdHandler = (e) => {
      if (e.detail?.household_members) {
        setMembers(e.detail.household_members);
      }
    };
    const authHandler = (e) => {
      const u = e.detail?.user || e.detail;
      setUserIsAdmin(Boolean(u && (u.role === 'admin' || u.role === 'administrator')));
    };

    window.addEventListener('kosherai:household-changed', householdHandler);
    window.addEventListener('kosherai:auth-changed', authHandler);

    return () => {
      window.removeEventListener('kosherai:household-changed', householdHandler);
      window.removeEventListener('kosherai:auth-changed', authHandler);
    };
  }, []);

  const effectiveIsAdmin = Boolean(isAdmin || userIsAdmin);

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

        <div className="flex items-center gap-3 flex-wrap">
          {effectiveIsAdmin && (
            <button
              type="button"
              id="open-ingredient-admin-cook-btn"
              onClick={() => setShowAdminImageModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <span>🖼️</span>
              <span>Manage Ingredient Photos</span>
            </button>
          )}
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

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 my-3">
            {/* Modern Stepper Pill */}
            <div className="inline-flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700/80 rounded-full px-2 py-1.5 shadow-xs w-fit">
              {/* Decrement Button */}
              <button
                type="button"
                onClick={handleDec}
                disabled={householdMembers <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-2xs"
                aria-label="Decrease household members"
                title="Decrease members"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              </button>

              {/* Dynamic Count Display with Member Icon */}
              <div className="flex items-center gap-1.5 px-3 min-w-[7rem] justify-center select-none">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {householdMembers} {householdMembers === 1 ? 'Member' : 'Members'}
                </span>
              </div>

              {/* Increment Button */}
              <button
                type="button"
                onClick={handleInc}
                disabled={householdMembers >= 20}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-xs"
                aria-label="Increase household members"
                title="Increase members"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Quick Multiplier Context Badge */}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 w-fit">
              {(householdMembers / 4).toFixed(2)}x Recipe Ratio
            </span>
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

      {showAdminImageModal && (
        <AdminIngredientImagesModal
          isOpen={true}
          onClose={() => setShowAdminImageModal(false)}
          initialProtocol={activeDiet || 'lid'}
        />
      )}
    </div>
  );
}

export default CookModeTab;
