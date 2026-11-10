import React, { useState, useMemo } from 'react';
import '../styles/admin-ingredient-gallery.css';
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
    <div className="admin-gallery-container admin-manage-page-container w-full max-w-7xl mx-auto px-4 py-5 pb-32">
      {/* 1. Header & Live Statistics */}
      <div className="admin-gallery-header">
        <div className="admin-header-title-group">
          <div className="admin-header-badge-row">
            <span className="admin-role-badge">Admin Hub</span>
            <h1 className="admin-header-title">Ingredient Image Gallery</h1>
          </div>
          <p className="admin-header-subtitle">
            Manage Cloudinary asset mappings across food protocols
          </p>
        </div>

        {/* Counter Stats */}
        <div className="admin-stats-grid admin-image-metrics-bar">
          <div className="admin-stat-card metric-card">
            <span className="admin-stat-label">Total</span>
            <span className="admin-stat-value">{ingredients.length || 36}</span>
          </div>
          <div className="admin-stat-card stat-mapped metric-card">
            <span className="admin-stat-label">Mapped</span>
            <span className="admin-stat-value">{mappedList.length}</span>
          </div>
          <div className="admin-stat-card stat-missing metric-card">
            <span className="admin-stat-label">Missing</span>
            <span className="admin-stat-value">{ingredients.length - mappedList.length}</span>
          </div>
        </div>
      </div>

      {/* 2. Controls & Search Toolbar */}
      <div className="admin-toolbar-card">
        <div className="admin-toolbar-left">
          <div className="admin-select-wrapper">
            <label htmlFor="admin-protocol-select-react" className="admin-select-label">Protocol:</label>
            <select
              id="admin-protocol-select-react"
              value={selectedProtocol}
              onChange={(e) => setSelectedProtocol(e.target.value)}
              className="admin-select"
            >
              <option value="LID">🛡️ LID Protocol (Default)</option>
              <option value="diabetic">Diabetic</option>
              <option value="low_purine">Low Purine</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onAutoDiscover}
            className="admin-btn admin-btn-indigo"
          >
            ⚡ Auto-Discover Cloudinary
          </button>
        </div>

        <div className="admin-toolbar-right">
          <div className="admin-search-box">
            <span className="admin-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search ingredient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-search-input"
            />
          </div>

          <div className="admin-filter-pill-group">
            {['all', 'mapped', 'missing'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`admin-filter-pill ${filterStatus === status ? 'active' : ''}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Compact Responsive Grid Gallery */}
      <div className="ingredient-gallery grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filteredItems.map((item) => {
          const imageUrl = imageMappings[item.name] || imageMappings[item.id] || item.imageUrl;
          const isMapped = Boolean(imageUrl);
          const isUploading = uploadingId === (item.id || item.name);

          return (
            <div
              key={item.id || item.name}
              className="ingredient-card admin-image-item-card"
              onClick={() => setInspectedIngredient(item)}
            >
              {/* Bounded Thumbnail Container with object-contain */}
              <div className="ingredient-card__image h-24 sm:h-28 overflow-hidden bg-slate-950 flex items-center justify-center">
                {isMapped ? (
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="admin-preview-img"
                    loading="lazy"
                  />
                ) : (
                  <div className="ingredient-card__placeholder">
                    <span className="ingredient-card__placeholder-icon">📷</span>
                    <span>No Image</span>
                  </div>
                )}

                {/* Status indicator top corner */}
                <span
                  className={`ingredient-card__badge ${isMapped ? 'badge-active' : 'badge-missing'}`}
                >
                  {isMapped ? '✓' : 'Missing'}
                </span>

                {/* Uploading Overlay */}
                {isUploading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                    <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 'bold' }}>Uploading...</span>
                  </div>
                )}
              </div>

              {/* Ingredient Info & Quick Replace Action */}
              <div className="ingredient-card__details" onClick={(e) => e.stopPropagation()}>
                <span className="ingredient-card__name" title={item.name}>
                  {item.name}
                </span>
                
                <div className="ingredient-card__meta-row">
                  <span className="ingredient-card__slug">
                    {item.slug || item.id || 'ingredient'}
                  </span>
                  <span className="ingredient-card__status">
                    {isMapped ? 'Mapped' : 'Missing'}
                  </span>
                </div>

                <div className="ingredient-card__action-row">
                  <label className="ingredient-card__quick-btn">
                    {isMapped ? 'Replace' : '+ Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
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
        <div style={{ padding: '4rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
          No ingredients match your filter or search query.
        </div>
      )}

      {/* 4. Clean Centered Inspection & Editing Modal Dialog */}
      {inspectedIngredient && (
        <div
          className="admin-dialog-overlay fixed inset-0 backdrop-blur-sm"
          onClick={() => setInspectedIngredient(null)}
        >
          <div
            className="admin-dialog-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-dialog-header">
              <div>
                <h3 className="admin-dialog-title">{inspectedIngredient.name}</h3>
                <span className="admin-dialog-slug">{inspectedIngredient.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedIngredient(null)}
                className="admin-dialog-close-btn"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Strictly Bounded Dialog Image Preview (object-fit: contain) */}
            <div className="admin-dialog-preview admin-image-preview-container">
              {(imageMappings[inspectedIngredient.name] || imageMappings[inspectedIngredient.id] || inspectedIngredient.imageUrl) ? (
                <img
                  src={imageMappings[inspectedIngredient.name] || imageMappings[inspectedIngredient.id] || inspectedIngredient.imageUrl}
                  alt={inspectedIngredient.name}
                  className="admin-preview-bounded-img admin-image-preview-img"
                />
              ) : (
                <div className="admin-dialog-preview-empty">
                  <span>📷</span>
                  <span>No photograph mapped yet</span>
                </div>
              )}
            </div>

            {/* Cloudinary Metadata */}
            <div className="admin-dialog-meta">
              <div className="admin-dialog-meta-row">
                <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>Category:</span>
                <span>{inspectedIngredient.category || 'General'}</span>
              </div>
              <div className="admin-dialog-meta-id">
                ☁️ {(imageMappings[inspectedIngredient.name] || imageMappings[inspectedIngredient.id] || inspectedIngredient.imageUrl || 'No asset linked')}
              </div>
            </div>

            <div className="admin-dialog-actions">
              <button
                type="button"
                onClick={() => setInspectedIngredient(null)}
                className="btn-cancel"
              >
                Close
              </button>
              <label className="btn-save">
                Upload / Replace
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
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
