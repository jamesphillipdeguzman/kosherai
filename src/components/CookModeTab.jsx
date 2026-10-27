import React from 'react';
import { DIET_RECIPES } from '../data/dietRecipes.js';
import { RecipeCard } from './RecipeCard.jsx';
import { renderCookModeTab } from './CookModeTab.js';

export { DIET_RECIPES, renderCookModeTab };

/**
 * React Component for Cook Mode Dishes Catalog
 */
export function CookModeTab({ activeDiet = 'pinoy_keto', onLoadRecipe }) {
  const currentDietData = DIET_RECIPES[activeDiet] || DIET_RECIPES.lid;
  const meals = currentDietData?.meals || [];

  return (
    <div className="cook-mode-react-container p-4 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-white">{currentDietData.title}</h2>
        <p className="text-sm text-slate-400 mt-1">{currentDietData.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {meals.map((meal) => (
          <RecipeCard key={meal.id} meal={meal} onLoadRecipe={onLoadRecipe} />
        ))}
      </div>
    </div>
  );
}

export default CookModeTab;
