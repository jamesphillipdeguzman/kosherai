import React, { useState } from 'react';
import generatedImages from '../data/generatedImages.json';
import { getCategoryEmoji } from '../data/lidDatabase.js';

/**
 * Reusable React thumbnail component for KosherAI ingredients and dishes.
 * Prioritizes:
 *  1. item.imageUrl (Verified public URL)
 *  2. generatedImageMap[item.id] (Cloudinary persistent Imagen asset)
 *  3. item.icon or category culinary emoji badge fallback (🍶, 🌶️, 🥩, 🧂, etc.)
 */
export function IngredientImage({ item, className = '', size = 'md' }) {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = !hasError ? (item?.imageUrl || generatedImages?.[item?.id] || null) : null;
  const fallbackEmoji = item?.icon || getCategoryEmoji(item?.category, item?.name);

  const sizeClasses = {
    sm: 'w-10 h-10 text-xl',
    md: 'w-12 h-12 sm:w-14 sm:h-14 text-2xl',
    lg: 'w-16 h-16 sm:w-20 sm:h-20 text-3xl',
    banner: 'w-full aspect-video sm:h-36 text-4xl'
  }[size] || 'w-12 h-12 sm:w-14 sm:h-14 text-2xl';

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center flex-shrink-0 card-thumbnail-wrap ${sizeClasses} ${className}`}
    >
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={item?.name || 'Food Item'}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="category-icon-fallback w-full h-full flex items-center justify-center select-none">
          {fallbackEmoji}
        </div>
      )}
    </div>
  );
}

export default IngredientImage;
