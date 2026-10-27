import React from 'react';

/**
 * Resolves standard Philippine culinary category icon for food ingredients and dishes
 */
export function getCategoryIcon(category = '', name = '') {
  const c = String(category || '').toLowerCase();
  const n = String(name || '').toLowerCase();

  // 1. Salts & Seasonings
  if (c.includes('salt') || c.includes('seasoning')) return '🧂';

  // 2. Condiments, Vinegars, Sauces
  if (c.includes('vinegar') || c.includes('oil') || c.includes('sauce') || c.includes('condiment')) return '🍶';

  // 3. Soups & Stews
  if (c.includes('soup') || c.includes('stew') || c.includes('tinola') || c.includes('broth') || c.includes('sinigang') || c.includes('pesa') || c.includes('nilaga')) return '🍲';

  // 4. Breakfast / Silog / Morning
  if (c.includes('breakfast') || c.includes('silog') || c.includes('morning')) return '🍳';

  // 5. Snacks & Sides
  if (c.includes('snack') || c.includes('side')) return '🍠';

  // 6. Mains / Rice
  if (c.includes('main') || c.includes('rice')) return '🍛';

  // 6. Produce, Herbs, Chilies
  if (c.includes('produce') || c.includes('vegetable') || c.includes('greens') || c.includes('herb') || c.includes('chili') || c.includes('pepper')) {
    if (n.includes('sili') || n.includes('chili') || n.includes('pepper') || n.includes('labuyo')) return '🌶️';
    return '🥬';
  }

  // 7. Seafood & Pastes
  if (c.includes('seafood') || c.includes('fish') || c.includes('paste')) {
    if (n.includes('tahong') || n.includes('oyster') || n.includes('clam') || n.includes('talaba')) return '🦪';
    return '🐟';
  }

  // 8. Meats & Poultry
  if (c.includes('meat') || c.includes('pork') || c.includes('beef') || c.includes('poultry')) {
    if (n.includes('chicken') || n.includes('manok') || n.includes('poultry')) return '🍗';
    return '🥩';
  }

  // Name-based fallbacks if category is generic or empty
  if (n.includes('tahong') || n.includes('oyster') || n.includes('clam')) return '🦪';
  if (n.includes('chicken') || n.includes('manok')) return '🍗';
  if (n.includes('sili') || n.includes('chili') || n.includes('pepper')) return '🌶️';
  if (n.includes('salt') || n.includes('asin')) return '🧂';
  if (n.includes('toyo') || n.includes('patis') || n.includes('suka')) return '🍶';
  if (n.includes('soup') || n.includes('tinola') || n.includes('sinigang')) return '🍲';
  if (n.includes('adobo') || n.includes('bistek')) return '🍛';
  if (n.includes('kamote') || n.includes('singkamas')) return '🍠';
  if (n.includes('sayote') || n.includes('pechay') || n.includes('kangkong')) return '🥬';
  if (n.includes('bangus') || n.includes('tuyo') || n.includes('daing')) return '🐟';
  if (n.includes('baboy') || n.includes('baka') || n.includes('meat')) return '🥩';

  return '🥗';
}

/**
 * Clean, lightweight placeholder container for KosherAI food cards.
 * Renders optional persistent image or displays the category culinary icon on slate background.
 */
export function MediaPlaceholder({ imageUrl, alt, category, name, className = "w-14 h-14" }) {
  const icon = getCategoryIcon(category, name || alt);

  return (
    <div
      className={`relative flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 flex-shrink-0 select-none overflow-hidden ${className}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt || 'Food item'}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Hide broken image so the category icon displays underneath
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}

      {/* Fallback Icon Container */}
      <span className="text-2xl filter drop-shadow-sm pointer-events-none" aria-hidden="true">
        {icon}
      </span>
    </div>
  );
}

export default MediaPlaceholder;
