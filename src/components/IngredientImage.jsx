import React from 'react';
import generatedImages from '../data/generatedImages.json';
import { MediaPlaceholder } from './MediaPlaceholder.jsx';

/**
 * Reusable React thumbnail component for KosherAI ingredients and dishes.
 * Prioritizes:
 *  1. item.imageUrl (Optional verified URL)
 *  2. generatedImages[item.id] (Cloudinary persistent Imagen asset)
 *  3. Category culinary icon fallback badge (🍶, 🌶️, 🥩, 🧂, 🍲, 🍛, 🍠, etc.)
 */
export function IngredientImage({ item, className = '', size = 'md' }) {
  const resolvedUrl = item?.imageUrl || generatedImages?.[item?.id] || null;

  const sizeClasses = {
    sm: 'w-10 h-10 text-xl',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-16 h-16 sm:w-20 sm:h-20 text-3xl',
    banner: 'w-full h-32 rounded-t-xl text-4xl'
  }[size] || 'w-14 h-14 text-2xl';

  return (
    <MediaPlaceholder
      imageUrl={resolvedUrl}
      alt={item?.name || item?.title}
      category={item?.type || item?.category}
      name={item?.name || item?.title}
      className={`${sizeClasses} ${className}`}
    />
  );
}

export default IngredientImage;
