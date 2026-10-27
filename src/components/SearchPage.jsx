import React, { useState, useMemo } from 'react';
import { LID_DATABASE, LID_CATEGORIES, STATUS, getItemDietaryInfo, getItemStatus } from '../data/lidDatabase.js';

export const QUICK_LOOKUPS = [
  'Sayote',
  'Patis',
  'Isaw',
  'Munggo',
  'Tuyo',
  'Toyomansi',
  'White Rice',
  'Banana Ketchup',
  'Kosher Salt',
  'Chicken Breast',
  'Egg Whites',
  'Kalabasa'
];

export function SearchPage({ foodItems = LID_DATABASE, activeDiet = 'lid', onSelectItem }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'safe' | 'avoid' | 'caution'
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Handler for quick lookup pills
  const handleQuickLookup = (pillText) => {
    setSearchQuery(pillText);
    setStatusFilter('all');
  };

  // 2. Controlled Multi-Diet Filtering Pipeline with Stricter Field Prioritization
  const filteredFoods = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return foodItems.filter(item => {
        const itemStatus = (getItemStatus(item, activeDiet) || item.status || item.compliance || '').toLowerCase();
        const matchesStatus = statusFilter === 'all' || itemStatus === statusFilter.toLowerCase();
        const matchesCategory = categoryFilter === 'all' || 
          (item.category && item.category.toLowerCase() === categoryFilter.toLowerCase());
        return matchesStatus && matchesCategory;
      });
    }

    // 1. Primary Direct Matches (High Confidence: name, aliases, category, tag)
    const directMatches = foodItems.filter((item) => {
      const nameMatch = item.name && item.name.toLowerCase().includes(query);
      const aliasMatch = Array.isArray(item.aliases) && 
        item.aliases.some(a => a && a.toLowerCase().includes(query));
      const categoryMatch = item.category && item.category.toLowerCase().includes(query);
      const tagMatch = item.tag && item.tag.toLowerCase().includes(query);

      return nameMatch || aliasMatch || categoryMatch || tagMatch;
    });

    // 2. Candidate Foods: If direct matches exist, use them. Otherwise, fall back to notes/description.
    // Exclude swaps/substitutes from matching to avoid unrelated items pulling through.
    const candidateFoods = directMatches.length > 0 
      ? directMatches 
      : foodItems.filter(item => {
          const descMatch = (item.description || item.generalDescription || '').toLowerCase().includes(query);
          const noteMatch = (item.clinicalNotes || item.notes || '').toLowerCase().includes(query);
          const dietNoteMatch = (item.dietaryStatus?.[activeDiet]?.note || '').toLowerCase().includes(query);
          return descMatch || noteMatch || dietNoteMatch;
        });

    return candidateFoods.filter((item) => {
      // Status & Category Filters
      const itemStatus = (getItemStatus(item, activeDiet) || item.status || item.compliance || '').toLowerCase();
      const matchesStatus = statusFilter === 'all' || itemStatus === statusFilter.toLowerCase();
      const matchesCategory = categoryFilter === 'all' || 
        (item.category && item.category.toLowerCase() === categoryFilter.toLowerCase());

      return matchesStatus && matchesCategory;
    });
  }, [foodItems, searchQuery, statusFilter, categoryFilter, activeDiet]);

  // Compute status counts for filtered foods or base query
  const safeCount = useMemo(() => {
    return filteredFoods.filter(item => (getItemStatus(item, activeDiet) || item.status || '').toLowerCase() === 'safe').length;
  }, [filteredFoods, activeDiet]);

  const avoidCount = useMemo(() => {
    return filteredFoods.filter(item => (getItemStatus(item, activeDiet) || item.status || '').toLowerCase() === 'avoid').length;
  }, [filteredFoods, activeDiet]);

  const cautionCount = useMemo(() => {
    return filteredFoods.filter(item => (getItemStatus(item, activeDiet) || item.status || '').toLowerCase() === 'caution').length;
  }, [filteredFoods, activeDiet]);

  const categories = Object.values(LID_CATEGORIES);

  return (
    <div className="search-page-container checker-tab-view">
      {/* 1. Controlled Search Box */}
      <div className="relative search-box-wrapper">
        <svg className="search-icon-left" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>

        <input
          type="text"
          id="search-page-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search food, ingredients, or brand (e.g. sayote, isaw, patis, banana ketchup)..."
          className="search-input w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
        />

        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Quick Lookup Pills */}
      <div className="flex gap-2 flex-wrap quick-tags-wrapper mt-3">
        <span className="quick-tag-label text-xs font-semibold text-slate-400 self-center">Quick Lookups:</span>
        {QUICK_LOOKUPS.map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => handleQuickLookup(pill)}
            className="px-2.5 py-1 rounded-lg text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
          >
            {pill}
          </button>
        ))}
      </div>

      {/* 3. Status Badges & Category Filter */}
      <div className="filters-bar flex gap-2 items-center flex-wrap mt-4">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'all'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/60'
          }`}
        >
          All Items ({filteredFoods.length})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('safe')}
          className={`filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'safe'
              ? 'border border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/60'
          }`}
        >
          🟢 Safe ({safeCount})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('avoid')}
          className={`filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'avoid'
              ? 'border border-rose-500/50 bg-rose-500/20 text-rose-300'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/60'
          }`}
        >
          🔴 Avoid ({avoidCount})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('caution')}
          className={`filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'caution'
              ? 'border border-amber-500/50 bg-amber-500/20 text-amber-300'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/60'
          }`}
        >
          🟡 Caution ({cautionCount})
        </button>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="category-select ml-auto text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 focus:outline-none focus:border-teal-500"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Results Grid or Clean Empty State */}
      <div className="results-grid mt-6" id="search-page-results">
        {filteredFoods.length > 0 ? (
          filteredFoods.map((item) => {
            const info = getItemDietaryInfo(item, activeDiet);
            const isSafe = info.status === STATUS.SAFE;
            const isAvoid = info.status === STATUS.AVOID;
            return (
              <div
                key={item.id}
                onClick={() => onSelectItem && onSelectItem(item)}
                className="ingredient-card p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition cursor-pointer"
              >
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-white text-base">{item.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      isSafe
                        ? 'border border-emerald-600/50 bg-emerald-500/10 text-emerald-300'
                        : isAvoid
                        ? 'border border-rose-600/50 bg-rose-500/10 text-rose-300'
                        : 'border border-amber-600/50 bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {info.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{item.category}</p>
                <p className="text-xs text-slate-300 mt-2 line-clamp-2">
                  {item.dietaryStatus?.[activeDiet]?.note || item.generalDescription || item.description || ''}
                </p>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-slate-400 w-full col-span-full">
            No items match "{searchQuery}" under the selected protocol.
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
