// KosherAI - Administrator Ingredient Image Management Hub
// Rebuilt as a Compact Responsive Photo Gallery (Grid of Bounded Thumbnails)
// Includes dedicated bounded editing dialog for uploading, replacing, or reviewing photos.

import { LID_DATABASE, getCategoryIcon } from '../data/lidDatabase.js';
import { DIET_PROFILES } from '../data/dietProfiles.js';
import { getIngredientImageUrl, resolveGalleryIngredientImage } from '../services/ingredientImageService.js';

export function renderIngredientImageAdminModal(props = {}) {
  const {
    activeProtocol = 'lid',
    stats = { totalIngredients: 36, withImage: 0, missingImage: 36, pendingReview: 0 },
    mappings = [],
    searchQuery = '',
    statusFilter = 'all',
    isLoading = false,
    statusMessage = '',
    uploadFormOpen = false,
    selectedIngredientId = null,
    uploadPreviewUrl = null,
    selectedFileName = null,
    selectedFileSize = null,
    isUploading = false,
    isDiscovering = false,
    embedded = false
  } = props;

  // Global map of currently mapped images for O(1) lookup across ALL protocols
  const mappingByIngredientId = {};
  for (const m of mappings) {
    if (m.ingredient_id) {
      mappingByIngredientId[m.ingredient_id] = m;
      mappingByIngredientId[m.ingredient_id.toLowerCase()] = m;
    }
    if (m.ingredient_name) {
      mappingByIngredientId[m.ingredient_name] = m;
      mappingByIngredientId[m.ingredient_name.toLowerCase()] = m;
    }
  }

  // Pre-seed any cached global mappings that might not be in the passed mappings array yet
  for (const item of LID_DATABASE) {
    if (!mappingByIngredientId[item.id]) {
      const resolved = resolveGalleryIngredientImage(item, null, activeProtocol);
      if (resolved.isMapped && resolved.url) {
        mappingByIngredientId[item.id] = {
          id: `cached_global_${item.id}`,
          protocol_id: 'global',
          ingredient_id: item.id,
          secure_url: resolved.url,
          public_id: resolved.publicId || item.id,
          status: 'active'
        };
      }
    }
  }

  // Calculate live authoritative stats ensuring accurate counters on initial load
  const mappedCount = Object.keys(mappingByIngredientId).filter(k => mappingByIngredientId[k]?.status === 'active').length;
  const reviewCount = Object.keys(mappingByIngredientId).filter(k => mappingByIngredientId[k]?.status === 'pending_review').length;
  const effectiveStats = {
    totalIngredients: stats.totalIngredients || LID_DATABASE.length,
    withImage: (stats.withImage && stats.withImage > 0) ? stats.withImage : mappedCount,
    missingImage: (stats.withImage && stats.withImage > 0 && stats.missingImage !== undefined) 
      ? stats.missingImage 
      : Math.max(0, (stats.totalIngredients || LID_DATABASE.length) - mappedCount),
    pendingReview: (stats.pendingReview && stats.pendingReview > 0) ? stats.pendingReview : reviewCount
  };

  // Filter items in the database for the active protocol
  let displayedItems = LID_DATABASE;
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    displayedItems = displayedItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  }

  if (statusFilter !== 'all') {
    displayedItems = displayedItems.filter(item => {
      const mapping = mappingByIngredientId[item.id] || mappingByIngredientId[item.name];
      if (statusFilter === 'active' || statusFilter === 'mapped') return mapping && mapping.status === 'active';
      if (statusFilter === 'pending_review' || statusFilter === 'review') return mapping && mapping.status === 'pending_review';
      if (statusFilter === 'missing') return !mapping || mapping.status === 'inactive';
      return true;
    });
  }

  // Active / selected ingredient resolution for editing dialog
  const activeSelectedId = selectedIngredientId || (displayedItems[0] ? displayedItems[0].id : 'salt-kosher');
  const selectedItem = LID_DATABASE.find(item => item.id === activeSelectedId) || displayedItems[0] || null;
  const selectedMapping = selectedItem ? (mappingByIngredientId[selectedItem.id] || mappingByIngredientId[selectedItem.name]) : null;
  const selectedResolved = selectedItem ? resolveGalleryIngredientImage(selectedItem, selectedMapping, activeProtocol) : null;
  const isSelectedPending = selectedMapping && selectedMapping.status === 'pending_review';
  const isSelectedActive = selectedResolved?.isMapped;
  const selectedItemImageUrl = selectedResolved?.url || null;

  // Render the core gallery workspace content
  const workspaceContent = `
    <!-- 1. Header & Live Statistics -->
    <div class="admin-gallery-header">
      <div class="admin-header-title-group">
        <div class="admin-header-badge-row">
          <span class="admin-role-badge">Admin Hub</span>
          <h1 class="admin-header-title">Ingredient Image Gallery</h1>
          <span class="hidden">Ingredient Image Management</span>
        </div>
        <p class="admin-header-subtitle">
          Manage, upload, replace, and review Cloudinary ingredient images.
        </p>
      </div>

      <!-- Live Counter Statistics -->
      <div class="admin-stats-grid admin-image-metrics-bar">
        <div class="admin-stat-card metric-card">
          <span class="admin-stat-label">Total Items</span>
          <span class="admin-stat-value">${effectiveStats.totalIngredients || LID_DATABASE.length}</span>
        </div>
        <div class="admin-stat-card stat-mapped metric-card">
          <span class="admin-stat-label">🟢 Mapped Photos</span>
          <span class="admin-stat-value">${isLoading && effectiveStats.withImage === 0 ? '<span class="admin-pulse">...</span>' : effectiveStats.withImage}</span>
        </div>
        <div class="admin-stat-card stat-review metric-card">
          <span class="admin-stat-label">🟡 Needs Review</span>
          <span class="admin-stat-value">${isLoading && effectiveStats.pendingReview === 0 ? '<span class="admin-pulse">...</span>' : effectiveStats.pendingReview}</span>
        </div>
        <div class="admin-stat-card stat-missing metric-card">
          <span class="admin-stat-label">⚪ Missing</span>
          <span class="admin-stat-value">${isLoading && effectiveStats.withImage === 0 ? '<span class="admin-pulse">...</span>' : effectiveStats.missingImage}</span>
        </div>
      </div>
    </div>

    <!-- 2. Protocol & Filter Toolbar Card -->
    <div class="admin-toolbar-card">
      <div class="admin-toolbar-left">
        <div class="admin-select-wrapper">
          <label for="admin-image-protocol-select" class="admin-select-label">Protocol:</label>
          <select id="admin-image-protocol-select" class="admin-select">
            ${Object.values(DIET_PROFILES).map(p => `
              <option value="${p.id}" ${p.id === activeProtocol ? 'selected' : ''}>
                ${p.icon} ${p.name}
              </option>
            `).join('')}
          </select>
        </div>

        <button
          type="button"
          id="admin-image-discover-btn"
          class="admin-btn admin-btn-indigo"
          ${isDiscovering ? 'disabled' : ''}
          title="Automatically scan Cloudinary and match existing photographs"
        >
          <span>${isDiscovering ? '⏳' : '⚡'}</span>
          <span>${isDiscovering ? 'Scanning Cloudinary...' : 'Auto-Discover Cloudinary'}</span>
        </button>

        <button
          type="button"
          id="admin-image-toggle-upload-btn"
          class="admin-btn admin-btn-emerald"
          title="Upload or replace an ingredient photograph"
        >
          <span>📤</span>
          <span>Upload Photo</span>
        </button>
      </div>

      <div class="admin-toolbar-right">
        <div class="admin-search-box">
          <span class="admin-search-icon">🔍</span>
          <input
            type="text"
            id="admin-image-search-input"
            class="admin-search-input"
            placeholder="Search ingredient..."
            value="${escapeHtml(searchQuery)}"
          />
        </div>

        <div class="admin-filter-pill-group">
          ${[
      { key: 'all', label: 'all' },
      { key: 'active', label: 'mapped' },
      { key: 'pending_review', label: 'review' },
      { key: 'missing', label: 'missing' }
    ].map((item) => {
      const isFilterActive = (statusFilter === item.key) || (item.key === 'active' && statusFilter === 'mapped') || (item.key === 'pending_review' && statusFilter === 'review');
      return `
              <button
                type="button"
                class="admin-filter-pill admin-status-filter-btn ${isFilterActive ? 'active' : ''}"
                data-filter="${item.key}"
              >
                ${item.label}
              </button>
            `;
    }).join('')}
        </div>
      </div>
    </div>

    <!-- Notification Banner if active -->
    ${statusMessage ? `
      <div style="margin-bottom: 1rem; padding: 0.75rem 1rem; border-radius: 12px; background: rgba(13, 148, 136, 0.2); border: 1px solid rgba(20, 184, 166, 0.4); color: #5eead4; font-size: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 0;">
          <span>📢</span>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(statusMessage)}</span>
        </div>
        <button type="button" id="admin-image-dismiss-msg" style="background: transparent; border: none; color: #5eead4; font-weight: bold; cursor: pointer; padding: 2px 6px;">✕</button>
      </div>
    ` : ''}

    <!-- 3. Responsive Ingredient Photo Gallery Grid -->
    ${isLoading ? `
      <div class="admin-loading-banner">
        <span class="admin-pulse">🔄</span> Fetching authoritative Cloudinary image mappings...
      </div>
    ` : ''}

    <div class="ingredient-gallery grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      ${displayedItems.map((item) => {
      const mapping = mappingByIngredientId[item.id] || mappingByIngredientId[item.name];
      const resolved = resolveGalleryIngredientImage(item, mapping, activeProtocol);
      const isMapped = resolved.isMapped;
      const isPending = resolved.isPending;
      const thumbUrl = resolved.url;
      const isItemUploading = isUploading && selectedIngredientId === item.id;
      const isSelected = selectedItem && selectedItem.id === item.id;
      const publicId = resolved.publicId || mapping?.public_id || item.id;

      return `
          <div
            class="ingredient-card admin-ingredient-card admin-image-item-card ${isSelected ? 'is-selected' : ''}"
            data-select-ingredient="${item.id}"
            data-ingredient-id="${item.id}"
          >
            <!-- Bounded Thumbnail Box with object-fit: contain -->
            <div class="ingredient-card__image">
              ${isMapped && thumbUrl ? `
                <img
                  src="${escapeHtml(thumbUrl)}"
                  alt="${escapeHtml(item.name)}"
                  class="admin-preview-img"
                  loading="lazy"
                  onerror="this.onerror=null; const p=document.createElement('div'); p.className='ingredient-card__placeholder'; p.innerHTML='<span class=\\'ingredient-card__placeholder-icon\\'>⚠️</span><span>Image Unavailable</span>'; this.replaceWith(p);"
                />
              ` : `
                <div class="ingredient-card__placeholder">
                  <span class="ingredient-card__placeholder-icon">📷</span>
                  <span>No Image</span>
                </div>
              `}

              <!-- Status Badge in Top Corner -->
              <span class="ingredient-card__badge ${isMapped ? (isPending ? 'badge-review' : 'badge-active') : 'badge-missing'}">
                ${isMapped ? (isPending ? '🟡 Review' : '🟢 Active') : '⚪ Missing'}
              </span>

              <!-- Uploading Pulse Overlay -->
              ${isItemUploading ? `
                <div style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 5;">
                  <span style="font-size: 10px; color: #34d399; font-weight: bold;">Uploading...</span>
                </div>
              ` : ''}
            </div>

            <!-- Card Details & Actions -->
            <div class="ingredient-card__details" onclick="event.stopPropagation()">
              <span class="ingredient-card__name" title="${escapeHtml(item.name)}">
                ${escapeHtml(item.name)}
              </span>
              
              <div class="ingredient-card__meta-row">
                <span class="ingredient-card__slug" title="${escapeHtml(mapping?.public_id || item.id)}">
                  ${escapeHtml(mapping?.public_id || item.id)}
                </span>
                <span class="ingredient-card__status">
                  ${isMapped ? (isPending ? 'Review' : 'Mapped') : 'Missing'}
                </span>
              </div>

              <div class="ingredient-card__action-row">
                ${isPending && mapping ? `
                  <button
                    type="button"
                    class="admin-approve-mapping-btn"
                    style="padding: 3px 6px; border-radius: 6px; background: rgba(16, 185, 129, 0.2); color: #6ee7b7; font-size: 10px; font-weight: bold; border: 1px solid rgba(16, 185, 129, 0.4); cursor: pointer;"
                    data-mapping-id="${mapping.id}"
                    data-ingredient-id="${item.id}"
                    title="Approve matched photograph"
                  >
                    ✓
                  </button>
                ` : ''}

                ${isMapped && mapping ? `
                  <button
                    type="button"
                    class="admin-delete-mapping-btn"
                    style="padding: 3px 6px; border-radius: 6px; background: rgba(244, 63, 94, 0.2); color: #fda4af; font-size: 10px; border: 1px solid rgba(244, 63, 94, 0.35); cursor: pointer;"
                    data-mapping-id="${mapping.id}"
                    data-ingredient-id="${item.id}"
                    title="Unlink photograph"
                  >
                    🗑️
                  </button>
                ` : ''}

                <label class="ingredient-card__quick-btn admin-upload-for-item-btn" data-ingredient-id="${item.id}">
                  ${isMapped ? 'Replace' : '+ Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    class="admin-grid-card-file-input hidden"
                    style="display: none;"
                    data-ingredient-id="${item.id}"
                  />
                </label>
              </div>
            </div>
          </div>
        `;
    }).join('')}
    </div>

    ${displayedItems.length === 0 ? `
      <div style="padding: 4rem 1rem; text-align: center; color: #64748b; font-size: 12px;">
        No ingredients match your filter or search query.
      </div>
    ` : ''}

    <!-- 4. Dedicated Centered Ingredient Image Editing Dialog -->
    ${uploadFormOpen && selectedItem ? `
      <div class="admin-dialog-overlay" id="admin-image-inspect-modal">
        <div class="admin-dialog-box" role="dialog" aria-modal="true" aria-labelledby="dialog-ingredient-name">
          
          <!-- Dialog Header -->
          <div class="admin-dialog-header">
            <div>
              <h3 id="dialog-ingredient-name" class="admin-dialog-title">${escapeHtml(selectedItem.name)}</h3>
              <span class="admin-dialog-slug">${escapeHtml(selectedItem.id)} • ${escapeHtml(selectedItem.category || 'General')}</span>
            </div>
            <button type="button" id="admin-image-cancel-upload-btn" class="admin-dialog-close-btn" aria-label="Close dialog">✕</button>
          </div>

          <!-- Bounded Dialog Image Preview Container (object-fit: contain) -->
          <div class="admin-dialog-preview admin-image-preview-container h-48 sm:h-56 overflow-hidden bg-slate-950 flex items-center justify-center">
            ${uploadPreviewUrl ? `
              <img
                src="${uploadPreviewUrl}"
                alt="Upload Preview"
                class="admin-preview-bounded-img admin-image-preview-img object-contain"
              />
            ` : (selectedItemImageUrl ? `
              <img
                src="${escapeHtml(selectedItemImageUrl)}"
                alt="${escapeHtml(selectedItem.name)}"
                class="admin-preview-bounded-img admin-image-preview-img object-contain"
              />
            ` : `
              <div class="admin-dialog-preview-empty">
                <span>📷</span>
                <span>Photograph Preview</span>
                <span style="font-size: 10px; color: #475569; margin-top: 2px;">Upload or drop an image below</span>
              </div>
            `)}
          </div>

          <!-- Cloudinary Metadata Information Box -->
          <div class="admin-dialog-meta">
            <div class="admin-dialog-meta-row">
              <span style="font-weight: 700; text-transform: uppercase; font-size: 10px; color: #94a3b8;">Cloudinary Public ID:</span>
              <span style="font-size: 10px; color: ${selectedMapping ? '#34d399' : '#64748b'};">
                ${selectedMapping ? '● Synced in Neon DB' : '○ Not Mapped'}
              </span>
            </div>
            <div class="admin-dialog-meta-id" title="${escapeHtml(selectedMapping?.public_id || 'None')}">
              ☁️ ${escapeHtml(selectedMapping?.public_id || (selectedItemImageUrl ? selectedItemImageUrl.split('/upload/')[1] || selectedItemImageUrl : 'No asset linked'))}
            </div>
          </div>

          <!-- Dropzone & File Upload Form -->
          <form id="admin-image-upload-form">
            <input type="hidden" id="upload-ingredient-select" value="${selectedItem.id}" />
            
            <div class="admin-image-dropzone" id="admin-image-dropzone">
              <input type="file" id="admin-image-file-input" accept="image/*" />
              <div class="admin-dropzone-text">
                <span class="text-xs text-slate-300 font-semibold">Click to browse</span> or drag & drop image here
              </div>
              <div class="admin-dropzone-sub">
                Supports WebP, PNG, JPG (Cloudinary auto-optimizes format and quality)
              </div>
              ${selectedFileName ? `
                <div class="admin-file-selected-chip">
                  <span>Selected</span>: ${escapeHtml(selectedFileName)} (${formatBytes(selectedFileSize)})
                </div>
              ` : ''}
            </div>

            <!-- Dialog Action Buttons -->
            <div class="admin-dialog-actions">
              ${isSelectedPending && selectedMapping ? `
                <button
                  type="button"
                  class="btn-approve admin-approve-mapping-btn"
                  data-mapping-id="${selectedMapping.id}"
                  data-ingredient-id="${selectedItem.id}"
                >
                  ✓ Approve Mapping
                </button>
              ` : ''}

              ${selectedMapping ? `
                <button
                  type="button"
                  class="btn-delete admin-delete-mapping-btn"
                  data-mapping-id="${selectedMapping.id}"
                  data-ingredient-id="${selectedItem.id}"
                >
                  🗑️ Unlink Photo
                </button>
              ` : ''}

              <button type="button" id="admin-image-cancel-upload-btn-secondary" class="btn-cancel">
                Cancel
              </button>

              <button type="submit" class="btn-save" ${isUploading ? 'disabled' : ''}>
                ${isUploading ? 'Uploading to Cloudinary & Saving...' : 'Save Photograph'}
              </button>
            </div>
          </form>

        </div>
      </div>
    ` : ''}
  `;

  // If embedded in page (Manage Tab)
  if (embedded) {
    return `
      <div class="admin-gallery-container admin-manage-page-container w-full max-w-7xl mx-auto px-4 py-5 pb-32">
        ${workspaceContent}
      </div>
    `;
  }

  // Modal mode (when opened from modal overlay)
  return `
    <div class="modal-overlay" id="admin-image-modal-overlay">
      <div class="modal-content admin-image-modal-box relative flex flex-col w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="admin-image-title">
        
        <!-- Fixed Header -->
        <div class="modal-header shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🖼️</span>
            <div>
              <div class="flex items-center gap-2">
                <h2 id="admin-image-title" class="font-bold text-base sm:text-lg text-slate-100">Ingredient Image Gallery</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 tracking-wide uppercase">Admin Hub</span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                Manage, upload, replace, and review Cloudinary ingredient images.
              </p>
            </div>
          </div>
          <button class="btn-icon text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-xl transition cursor-pointer" id="admin-image-close-btn" aria-label="Close Image Manager">✕</button>
        </div>

        <!-- Scrollable Content Area -->
        <div class="admin-image-modal-body space-y-4 overflow-y-auto p-4 sm:p-5">
          ${workspaceContent}
        </div>

        <!-- Fixed Footer -->
        <div class="modal-footer shrink-0 flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md text-xs text-slate-500">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Persists in Neon PostgreSQL & Cloudinary CDN.</span>
          </div>
          <button type="button" class="btn-secondary px-5 py-1.5 text-xs font-semibold cursor-pointer" id="admin-image-done-btn">Done</button>
        </div>

      </div>
    </div>
  `;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default {
  renderIngredientImageAdminModal
};
