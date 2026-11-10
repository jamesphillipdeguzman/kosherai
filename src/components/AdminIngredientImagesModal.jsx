import React, { useState, useMemo } from 'react';
import { LID_DATABASE } from '../data/lidDatabase.js';

export default function AdminIngredientImagesView({
  ingredients = LID_DATABASE,
  imageMappings = {},
  onSaveMapping,
  onAutoDiscover
}) {
  const [selectedProtocol, setSelectedProtocol] = useState('LID');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'mapped' | 'missing'
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [inspectedIngredient, setInspectedIngredient] = useState(null);

  // Compute metrics
  const mappedList = useMemo(() => {
    return ingredients.filter((item) => {
      const mapping = imageMappings[item.name] || imageMappings[item.id] || item.imageUrl;
      return Boolean(mapping);
    });
  }, [ingredients, imageMappings]);

  const filteredItems = useMemo(() => {
    return ingredients.filter((item) => {
      const mapping = imageMappings[item.name] || imageMappings[item.id] || item.imageUrl;
      const isMapped = Boolean(mapping);

      if (filterStatus === 'mapped' && !isMapped) return false;
      if (filterStatus === 'missing' && isMapped) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.category && item.category.toLowerCase().includes(q)) ||
          (item.id && item.id.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [ingredients, imageMappings, filterStatus, searchQuery]);

  const handleFileChange = async (ingredient, file) => {
    if (!file) return;
    setUploadingId(ingredient.id || ingredient.name);
    try {
      if (onSaveMapping) {
        await onSaveMapping(ingredient, file);
      }
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="admin-manage-page-container w-full max-w-7xl mx-auto px-4 py-5 pb-32">
      {/* 1. Header & Quick Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Admin Hub
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">
              Ingredient Image Gallery
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage Cloudinary asset mappings across food protocols
          </p>
        </div>

        {/* Counter Stats */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
            <span className="text-xs font-black text-white">{ingredients.length || 36}</span>
          </div>
          <div className="px-3 py-1 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block">Mapped</span>
            <span className="text-xs font-black text-emerald-300">{mappedList.length}</span>
          </div>
          <div className="px-3 py-1 rounded-xl bg-rose-950/40 border border-rose-800/50 text-center">
            <span className="text-[10px] uppercase font-bold text-rose-400 block">Missing</span>
            <span className="text-xs font-black text-rose-300">{ingredients.length - mappedList.length}</span>
          </div>
        </div>
      </div>

      {/* 2. Controls & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5 p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2">
          <select
            value={selectedProtocol}
            onChange={(e) => setSelectedProtocol(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="LID">🛡️ LID Protocol (Default)</option>
            <option value="diabetic">Diabetic</option>
            <option value="low_purine">Low Purine</option>
          </select>

          <button
            type="button"
            onClick={onAutoDiscover}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            ⚡ Auto-Discover Cloudinary
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search ingredient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-48 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <div className="flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700 shrink-0">
            {['all', 'mapped', 'missing'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  filterStatus === status
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Compact Grid Gallery */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filteredItems.map((item) => {
          const imageUrl = imageMappings[item.name] || imageMappings[item.id] || item.imageUrl;
          const isMapped = Boolean(imageUrl);
          const isUploading = uploadingId === (item.id || item.name);

          return (
            <div
              key={item.id || item.name}
              className="admin-image-item-card group relative flex flex-col justify-between bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl overflow-hidden p-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
              onClick={() => setInspectedIngredient(item)}
            >
              {/* Compact Thumbnail Container (~96px to 110px max height) */}
              <div className="relative w-full h-24 sm:h-28 rounded-lg bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800/80">
                {isMapped ? (
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-600 p-2 text-center">
                    <span className="text-xl mb-1">📷</span>
                    <span className="text-[10px] text-slate-500">No Image</span>
                  </div>
                )}

                {/* Status indicator top corner */}
                <span
                  className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider backdrop-blur-md border ${
                    isMapped
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                      : 'bg-rose-950/80 text-rose-300 border-rose-600/50'
                  }`}
                >
                  {isMapped ? '✓' : 'Missing'}
                </span>

                {/* Uploading Overlay */}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                    <span className="text-[10px] text-emerald-400 font-bold animate-pulse">Uploading...</span>
                  </div>
                )}
              </div>

              {/* Ingredient Info & Quick Replace Action */}
              <div className="mt-2 flex-1 flex flex-col justify-between" onClick={(e) => e.stopPropagation()}>
                <div>
                  <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-indigo-300 transition-colors" title={item.name}>
                    {item.name}
                  </h4>
                  <span className="block text-[9px] font-mono text-slate-400 truncate mt-0.5">
                    {item.slug || item.id || 'ingredient'}
                  </span>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between">
                  <label className="w-full text-center py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-[10px] font-bold cursor-pointer transition-colors border border-slate-700/60">
                    {isMapped ? 'Replace' : '+ Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileChange(item, e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="py-16 text-center text-slate-500 text-xs">
          No ingredients match your filter or search query.
        </div>
      )}

      {/* Clean Centered Inspection Modal */}
      {inspectedIngredient && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInspectedIngredient(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">{inspectedIngredient.name}</h3>
                <span className="text-[10px] font-mono text-slate-400">{inspectedIngredient.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedIngredient(null)}
                className="text-slate-400 hover:text-white text-xs p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 relative w-full h-56 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
              {(imageMappings[inspectedIngredient.name] || imageMappings[inspectedIngredient.id] || inspectedIngredient.imageUrl) ? (
                <img
                  src={imageMappings[inspectedIngredient.name] || imageMappings[inspectedIngredient.id] || inspectedIngredient.imageUrl}
                  alt={inspectedIngredient.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-500 text-xs">
                  <span className="text-3xl block mb-2 opacity-50">📷</span>
                  No photograph mapped yet
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-400">Category: {inspectedIngredient.category || 'General'}</span>
              <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition">
                Upload / Replace
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleFileChange(inspectedIngredient, e.target.files?.[0]);
                    setInspectedIngredient(null);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { AdminIngredientImagesView, AdminIngredientImagesView as AdminIngredientImagesModal };
