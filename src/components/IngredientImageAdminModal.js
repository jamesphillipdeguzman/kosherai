// KosherAI - Administrator Ingredient Image Management Modal
// Provides full administrative control to discover, upload, review, reassign, and delete Cloudinary ingredient photos.

import { LID_DATABASE, getCategoryIcon } from '../data/lidDatabase.js';
import { DIET_PROFILES } from '../data/dietProfiles.js';
import { getIngredientImageUrl } from '../services/ingredientImageService.js';

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

  // Map of currently mapped images for O(1) lookup
  const mappingByIngredientId = {};
  for (const m of mappings) {
    if (m.protocol_id === activeProtocol || activeProtocol === 'all') {
      mappingByIngredientId[m.ingredient_id] = m;
    }
  }

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
      const mapping = mappingByIngredientId[item.id];
      if (statusFilter === 'active') return mapping && mapping.status === 'active';
      if (statusFilter === 'pending_review') return mapping && mapping.status === 'pending_review';
      if (statusFilter === 'missing') return !mapping || mapping.status === 'inactive';
      return true;
    });
  }

  const bodyContent = `
          <!-- Protocol & Status Metrics Bar -->
          <div class="admin-image-metrics-bar grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div class="metric-card bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 text-center shadow-sm">
              <span class="text-slate-400 text-[10px] sm:text-[11px] block uppercase font-bold tracking-wider">Total Items</span>
              <span class="text-lg sm:text-xl font-bold text-white mt-0.5 block">${stats.totalIngredients || LID_DATABASE.length}</span>
            </div>
            <div class="metric-card bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3 text-center shadow-sm">
              <span class="text-emerald-400 text-[10px] sm:text-[11px] block uppercase font-bold tracking-wider">🟢 Mapped Photos</span>
              <span class="text-lg sm:text-xl font-bold text-emerald-300 mt-0.5 block">${stats.withImage || 0}</span>
            </div>
            <div class="metric-card bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 text-center shadow-sm">
              <span class="text-amber-400 text-[10px] sm:text-[11px] block uppercase font-bold tracking-wider">🟡 Needs Review</span>
              <span class="text-lg sm:text-xl font-bold text-amber-300 mt-0.5 block">${stats.pendingReview || 0}</span>
            </div>
            <div class="metric-card bg-slate-800/30 border border-slate-700/40 rounded-xl p-3 text-center shadow-sm">
              <span class="text-slate-400 text-[10px] sm:text-[11px] block uppercase font-bold tracking-wider">⚪ Missing</span>
              <span class="text-lg sm:text-xl font-bold text-slate-300 mt-0.5 block">${stats.missingImage !== undefined ? stats.missingImage : (LID_DATABASE.length - (stats.withImage || 0))}</span>
            </div>
          </div>

          <!-- Protocol Selector & Action Buttons Toolbar -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
            <div class="flex items-center gap-2">
              <label for="admin-image-protocol-select" class="text-xs font-bold text-slate-300 uppercase tracking-wide">Protocol:</label>
              <select id="admin-image-protocol-select" class="text-xs font-medium bg-slate-800 text-slate-100 border border-slate-700/80 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer">
                ${Object.values(DIET_PROFILES).map(p => `
                  <option value="${p.id}" ${p.id === activeProtocol ? 'selected' : ''}>
                    ${p.icon} ${p.name}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="flex items-center gap-2 self-stretch sm:self-auto">
              <button 
                type="button" 
                id="admin-image-discover-btn" 
                class="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                ${isDiscovering ? 'disabled' : ''}
                title="Automatically scan Cloudinary and match existing photographs"
              >
                <span>${isDiscovering ? '⏳' : '🔍'}</span>
                <span>${isDiscovering ? 'Scanning Cloudinary...' : 'Auto-Discover'}</span>
              </button>

              <button 
                type="button" 
                id="admin-image-toggle-upload-btn" 
                class="flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold ${uploadFormOpen ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'} flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <span>${uploadFormOpen ? '✕ Close Form' : '➕ Upload Photo'}</span>
              </button>
            </div>
          </div>

          <!-- Notification Banner if active -->
          ${statusMessage ? `
            <div class="p-3 rounded-xl bg-teal-950/50 border border-teal-500/40 text-teal-200 text-xs flex items-center justify-between shadow-sm animate-fadeIn">
              <div class="flex items-center gap-2">
                <span>📢</span>
                <span class="font-medium">${escapeHtml(statusMessage)}</span>
              </div>
              <button type="button" id="admin-image-dismiss-msg" class="text-teal-400 hover:text-teal-200 font-bold ml-2 p-1 rounded">✕</button>
            </div>
          ` : ''}

          <!-- Collapsible Upload Form with Drag & Drop Dropzone and Constrained Preview -->
          ${uploadFormOpen ? `
            <div class="upload-panel p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-emerald-500/40 shadow-xl space-y-4 animate-fadeIn">
              <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                  <span class="text-base">📤</span>
                  <span>Upload & Map Ingredient Photograph</span>
                </h3>
                <span class="text-[11px] text-slate-400">Target protocol: <strong class="text-emerald-400">${activeProtocol.toUpperCase()}</strong></span>
              </div>
              
              <form id="admin-image-upload-form" class="space-y-4">
                <!-- Form Grid: Target Ingredient & Protocol -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label class="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5" for="upload-ingredient-select">
                      Target Ingredient <span class="text-emerald-400">*</span>
                    </label>
                    <select id="upload-ingredient-select" required class="w-full text-xs bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer">
                      <option value="">-- Choose Ingredient --</option>
                      ${LID_DATABASE.map(item => `
                        <option value="${item.id}" ${item.id === selectedIngredientId ? 'selected' : ''}>
                          ${item.name} (${item.id})
                        </option>
                      `).join('')}
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                      Dietary Protocol
                    </label>
                    <input type="text" readonly value="${activeProtocol.toUpperCase()} (${DIET_PROFILES[activeProtocol]?.name || 'Active'})" class="w-full text-xs font-medium bg-slate-800/50 text-slate-400 border border-slate-800 rounded-xl p-2.5" />
                  </div>
                </div>

                <!-- Dropzone Area -->
                <div>
                  <label class="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                    Photograph File (WebP, JPG, PNG) <span class="text-emerald-400">*</span>
                  </label>

                  <div 
                    class="admin-image-dropzone relative flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-700/80 hover:border-emerald-500/70 rounded-xl bg-slate-950/40 hover:bg-emerald-950/10 transition-all cursor-pointer group"
                    id="admin-image-dropzone"
                  >
                    <input 
                      type="file" 
                      id="admin-image-file-input" 
                      accept="image/*" 
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      aria-label="Upload photograph"
                    />
                    <div class="flex flex-col items-center pointer-events-none text-center">
                      <div class="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:border-emerald-500/50 group-hover:bg-emerald-500/10 transition">
                        <span class="text-xl">☁️</span>
                      </div>
                      <p class="text-xs font-semibold text-slate-200">
                        <span class="text-emerald-400 underline decoration-emerald-500/50 underline-offset-2">Click to browse</span> or drag & drop photo here
                      </p>
                      <p class="text-[11px] text-slate-400 mt-1">
                        WebP, PNG, JPG (recommended 400×400)
                      </p>
                    </div>
                  </div>

                  <!-- Selected File Information Pill -->
                  ${selectedFileName ? `
                    <div class="flex items-center justify-between p-2.5 mt-2 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 animate-fadeIn">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="text-sm">📄</span>
                        <span class="font-medium truncate max-w-[220px] sm:max-w-md" title="${escapeHtml(selectedFileName)}">${escapeHtml(selectedFileName)}</span>
                        ${selectedFileSize ? `<span class="text-[10px] text-emerald-400/80 shrink-0">(${formatBytes(selectedFileSize)})</span>` : ''}
                      </div>
                      <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full shrink-0">Selected</span>
                    </div>
                  ` : ''}
                </div>

                <!-- Constrained Image Preview -->
                <div>
                  <label class="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                    Image Preview
                  </label>
                  <div class="admin-image-preview-container relative w-full h-48 sm:h-56 rounded-xl overflow-hidden bg-black/60 flex items-center justify-center shadow-inner">
                    ${uploadPreviewUrl ? `
                      <img 
                        src="${uploadPreviewUrl}" 
                        alt="Upload Preview" 
                        class="admin-image-preview-img w-full h-full object-contain" 
                        loading="eager"
                      />
                    ` : (mappingByIngredientId[selectedIngredientId]?.secure_url || getIngredientImageUrl(selectedIngredientId, activeProtocol)) ? `
                      <div class="flex flex-col items-center justify-center h-full w-full p-2">
                        <img 
                          src="${mappingByIngredientId[selectedIngredientId]?.secure_url || getIngredientImageUrl(selectedIngredientId, activeProtocol)}" 
                          alt="Current Saved Photograph" 
                          class="admin-image-preview-img w-full h-full object-contain opacity-60" 
                          loading="eager"
                        />
                        <span class="text-[11px] text-slate-400 mt-1 font-medium select-none">Current saved photo — choose or drop new file above to replace</span>
                      </div>
                    ` : `
                      <div class="flex flex-col items-center justify-center text-slate-500 text-xs text-center select-none py-3">
                        <div class="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-2">
                          <span class="text-2xl opacity-60">🖼️</span>
                        </div>
                        <span class="font-medium text-slate-400 text-xs">Photograph Preview</span>
                        <span class="text-[10px] text-slate-500 mt-0.5">Preview appears here after choosing an image</span>
                      </div>
                    `}
                  </div>
                </div>

                <!-- Actions row: Cancel & Upload Submit -->
                <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button 
                    type="button" 
                    id="admin-image-cancel-upload-btn" 
                    class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    id="admin-image-submit-upload-btn" 
                    class="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    ${isUploading ? 'disabled' : ''}
                  >
                    ${isUploading ? `
                      <span class="inline-block animate-spin">⏳</span>
                      <span>Uploading to Cloudinary & Saving...</span>
                    ` : `
                      <span>☁️ Upload to Cloudinary & Save</span>
                    `}
                  </button>
                </div>
              </form>
            </div>
          ` : ''}

          <!-- Filter & Search Toolbar -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div class="flex flex-wrap items-center gap-1.5 text-xs">
              <button type="button" class="admin-status-filter-btn px-3 py-1.5 rounded-lg transition active:scale-95 ${statusFilter === 'all' ? 'bg-slate-700 text-white font-bold shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}" data-filter="all">
                All (${stats.totalIngredients || LID_DATABASE.length})
              </button>
              <button type="button" class="admin-status-filter-btn px-3 py-1.5 rounded-lg transition active:scale-95 ${statusFilter === 'active' ? 'bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}" data-filter="active">
                Mapped (${stats.withImage || 0})
              </button>
              <button type="button" class="admin-status-filter-btn px-3 py-1.5 rounded-lg transition active:scale-95 ${statusFilter === 'pending_review' ? 'bg-amber-900/60 text-amber-300 font-bold border border-amber-500/40 shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}" data-filter="pending_review">
                Review (${stats.pendingReview || 0})
              </button>
              <button type="button" class="admin-status-filter-btn px-3 py-1.5 rounded-lg transition active:scale-95 ${statusFilter === 'missing' ? 'bg-slate-700/60 text-slate-200 font-bold border border-slate-600 shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}" data-filter="missing">
                Missing (${stats.missingImage !== undefined ? stats.missingImage : (LID_DATABASE.length - (stats.withImage || 0))})
              </button>
            </div>

            <div class="w-full sm:w-64">
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">🔍</span>
                <input 
                  type="text" 
                  id="admin-image-search-input" 
                  class="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition" 
                  placeholder="Search ingredient or ID..." 
                  value="${escapeHtml(searchQuery)}"
                />
              </div>
            </div>
          </div>

          <!-- Ingredients Table / Gallery List -->
          <div class="admin-image-list space-y-2.5">
            ${displayedItems.length > 0 ? displayedItems.map(item => {
              const mapping = mappingByIngredientId[item.id];
              const hasMapping = Boolean(mapping && mapping.secure_url);
              const isPending = mapping && mapping.status === 'pending_review';
              const imgUrl = getIngredientImageUrl(item.id, activeProtocol, item.imageUrl);

              let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">⚪ No Image</span>`;
              if (hasMapping) {
                if (isPending) {
                  statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">🟡 Review</span>`;
                } else {
                  statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">🟢 Active</span>`;
                }
              }

              return `
                <div class="admin-image-item-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all">
                  <div class="flex items-center gap-3.5 min-w-0">
                    <!-- Thumbnail -->
                    <div class="w-14 h-14 rounded-xl bg-slate-800/90 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative p-1">
                      ${imgUrl ? `
                        <img 
                          src="${escapeHtml(imgUrl)}" 
                          alt="${escapeHtml(item.name)}" 
                          class="max-h-full max-w-full w-auto h-auto object-contain rounded-md" 
                          loading="lazy"
                          onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='inline-block';"
                        />
                        <span style="display: none;" class="text-2xl">${escapeHtml(item.icon || getCategoryIcon(item.category, item.name))}</span>
                      ` : `
                        <span class="text-2xl">${escapeHtml(item.icon || getCategoryIcon(item.category, item.name))}</span>
                      `}
                    </div>

                    <!-- Details -->
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h4 class="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">${escapeHtml(item.name)}</h4>
                        ${statusBadge}
                      </div>
                      <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                        <span class="font-mono text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded text-[10px]">${escapeHtml(item.id)}</span>
                        <span>•</span>
                        <span class="text-slate-300">${escapeHtml(item.category)}</span>
                        <span>•</span>
                        <span class="text-emerald-400/90 font-medium uppercase text-[10px]">${escapeHtml(activeProtocol)}</span>
                      </div>
                      ${mapping && mapping.public_id ? `
                        <div class="text-[10px] font-mono text-teal-400/90 truncate mt-1 flex items-center gap-1" title="${escapeHtml(mapping.public_id)}">
                          <span class="opacity-70">☁️</span>
                          <span class="truncate">${escapeHtml(mapping.public_id)}</span>
                        </div>
                      ` : ''}
                    </div>
                  </div>

                  <!-- Action Controls -->
                  <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                    ${isPending ? `
                      <button 
                        type="button" 
                        class="admin-approve-mapping-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 transition active:scale-95 cursor-pointer flex items-center gap-1"
                        data-mapping-id="${mapping.id}"
                        data-ingredient-id="${item.id}"
                        title="Approve matched photograph as active"
                      >
                        <span>✓</span>
                        <span>Approve</span>
                      </button>
                    ` : ''}

                    <button 
                      type="button" 
                      class="admin-upload-for-item-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 cursor-pointer flex items-center gap-1"
                      data-ingredient-id="${item.id}"
                      title="Upload or replace photograph for this ingredient"
                    >
                      <span>${hasMapping ? '🔄' : '➕'}</span>
                      <span>${hasMapping ? 'Replace' : 'Upload'}</span>
                    </button>

                    ${hasMapping ? `
                      <button 
                        type="button" 
                        class="admin-delete-mapping-btn p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition active:scale-95 cursor-pointer"
                        data-mapping-id="${mapping.id}"
                        data-ingredient-id="${item.id}"
                        title="Unlink image mapping"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('') : `
              <div class="text-center py-10 px-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-slate-500 text-xs">
                <span class="text-3xl block mb-2 opacity-50">🍃</span>
                <span class="font-medium text-slate-400 block mb-1">No ingredients found</span>
                <span>Try adjusting your search query or status filter.</span>
              </div>
            `}
          </div>
  `;

  if (embedded) {
    return `
      <div class="admin-manage-page-container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <!-- Embedded Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🖼️</span>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-bold text-xl sm:text-2xl text-slate-100">Ingredient Image Management</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 tracking-wide uppercase">Admin Hub</span>
              </div>
              <p class="text-sm text-slate-400 mt-1">
                Manage, upload, replace, and review Cloudinary ingredient images.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          ${bodyContent}
        </div>
      </div>
    `;
  }

  return `
    <div class="modal-overlay" id="admin-image-modal-overlay">
      <div class="modal-content admin-image-modal-box relative flex flex-col w-full max-w-lg max-h-[85vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="admin-image-title">
        
        <!-- Fixed Header -->
        <div class="modal-header shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🖼️</span>
            <div>
              <div class="flex items-center gap-2">
                <h2 id="admin-image-title" class="font-bold text-base sm:text-lg text-slate-100">Ingredient Image Management</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 tracking-wide uppercase">Admin Hub</span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                Cloudinary synchronization, drag-and-drop upload & ingredient photo mappings.
              </p>
            </div>
          </div>
          <button class="btn-icon text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-xl transition" id="admin-image-close-btn" aria-label="Close Image Manager">✕</button>
        </div>

        <!-- Independently Scrollable Content Area -->
        <div class="admin-image-modal-body space-y-4">
          ${bodyContent}
        </div>

        <!-- Fixed Footer -->
        <div class="modal-footer shrink-0 flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md text-xs text-slate-500">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Persists in Neon PostgreSQL & Cloudinary CDN.</span>
          </div>
          <button type="button" class="btn-secondary px-5 py-1.5 text-xs font-semibold" id="admin-image-done-btn">Done</button>
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
