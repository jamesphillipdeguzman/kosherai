import React from 'react';
import { getRecipeImageUrl } from '../utils/cloudinary.js';

/**
 * Reusable React RecipeCard component for KosherAI Cook Mode.
 * Wraps recipe images with optimized Cloudinary transformations and resilient Unsplash fallbacks.
 */
export function RecipeCard({ meal, onLoadRecipe }) {
  if (!meal) return null;

  const title = meal.title || meal.name || 'Curated Meal';
  const category = meal.category || meal.type || 'Mains';
  const tag = meal.tag || meal.clinicalBadge || 'Protocol Compliant';
  const rawImage = meal.image || meal.imageUrl;
  const imageUrl = getRecipeImageUrl(rawImage);

  return (
    <article className="recipe-card bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl" id={`recipe-${meal.id}`}>
      <div className="relative w-full h-44 overflow-hidden bg-slate-800 flex items-center justify-center select-none">
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          className="w-full h-44 object-cover rounded-t-xl transition-transform duration-300 hover:scale-105"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
          }}
        />
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-black/60 backdrop-blur-md text-amber-400 border border-amber-500/30">
          {category}
        </div>
        {meal.netCarbs && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-500/20 backdrop-blur-md text-emerald-300 border border-emerald-500/40">
            {meal.netCarbs} Net Carbs
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="text-lg font-bold text-white leading-snug">{title}</h3>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 mb-4">
          <span>🛡️</span>
          <span>{tag}</span>
        </div>

        {meal.prepTime && (
          <div className="text-xs text-slate-400 mb-4">
            ⏱️ Prep: {meal.prepTime} {meal.cookTime ? `• Cook: ${meal.cookTime}` : ''}
          </div>
        )}

        {meal.clinicalRationale && (
          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-slate-300 leading-relaxed mb-4">
            <strong className="text-emerald-400 block mb-1">Clinical Rationale:</strong>
            {meal.clinicalRationale}
          </div>
        )}

        {onLoadRecipe && (
          <button
            onClick={() => onLoadRecipe(meal)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
          >
            <span>Load into Recipe Auditor</span>
          </button>
        )}
      </div>
    </article>
  );
}

export default RecipeCard;
