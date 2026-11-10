// KosherAI - Administrator Ingredient Image Management Hub
// Provides full administrative control to discover, upload, review, reassign, and delete Cloudinary ingredient photos.
// Structured as a responsive two-column workspace on desktop and clean single-column stack on mobile.

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

  // Active / selected ingredient resolution
  const activeSelectedId = selectedIngredientId || (displayedItems[0] ? displayedItems[0].id : 'salt-kosher');
  const selectedItem = LID_DATABASE.find(item => item.id === activeSelectedId) || displayedItems[0] || null;
  const selectedMapping = selectedItem ? mappingByIngredientId[selectedItem.id] : null;
  const isSelectedPending = selectedMapping && selectedMapping.status === 'pending_review';
  const isSelectedActive = selectedMapping && selectedMapping.status === 'active';
  const selectedItemImageUrl = selectedItem
    ? (selectedMapping?.secure_url || getIngredientImageUrl(selectedItem.id, activeProtocol, selectedItem.imageUrl))
    : null;

  // Render the core workspace content (usable both embedded in page and inside modal dialog)
  const workspaceContent = `
    <!-- Top Row: Protocol & Status Metrics Bar -->
    <div class="admin-image-metrics-bar grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
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

    <!-- Protocol Selection & Filter Control Card -->
    <div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md space-y-3.5 min-w-0">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <label for="admin-image-protocol-select" class="text-xs font-bold text-slate-300 uppercase tracking-wide shrink-0">
            Protocol:
          </label>
          <select id="admin-image-protocol-select" class="text-xs font-semibold bg-slate-800 text-slate-100 border border-slate-700/80 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-sm">
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
            class="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
            ${isDiscovering ? 'disabled' : ''}
            title="Automatically scan Cloudinary and match existing photographs"
          >
            <span>${isDiscovering ? '⏳' : '🔍'}</span>
            <span>${isDiscovering ? 'Scanning Cloudinary...' : 'Auto-Discover Photos'}</span>
          </button>
        </div>
      </div>

      <!-- Filter & Search Row -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-800/60">
        <!-- Status Filter Buttons -->
        <div class="flex flex-wrap items-center gap-1.5 text-xs">
          <button type="button" class="admin-status-filter-btn px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${statusFilter === 'all' ? 'bg-slate-700 text-white font-bold shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}" data-filter="all">
            All (${stats.totalIngredients || LID_DATABASE.length})
          </button>
          <button type="button" class="admin-status-filter-btn px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${statusFilter === 'active' ? 'bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}" data-filter="active">
            Mapped (${stats.withImage || 0})
          </button>
          <button type="button" class="admin-status-filter-btn px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${statusFilter === 'pending_review' ? 'bg-amber-900/60 text-amber-300 font-bold border border-amber-500/40 shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}" data-filter="pending_review">
            Review (${stats.pendingReview || 0})
          </button>
          <button type="button" class="admin-status-filter-btn px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${statusFilter === 'missing' ? 'bg-slate-700/60 text-slate-200 font-bold border border-slate-600 shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}" data-filter="missing">
            Missing (${stats.missingImage !== undefined ? stats.missingImage : (LID_DATABASE.length - (stats.withImage || 0))})
          </button>
        </div>

        <!-- Search Input -->
        <div class="w-full sm:w-64 min-w-0">
          <div class="relative">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">🔍</span>
            <input 
              type="text" 
              id="admin-image-search-input" 
              class="w-full text-xs bg-slate-800/80 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition" 
              placeholder="Search ingredient or ID..." 
              value="${escapeHtml(searchQuery)}"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Notification Banner if active -->
    ${statusMessage ? `
      <div class="p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-teal-200 text-xs flex items-center justify-between shadow-sm animate-fadeIn min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="shrink-0">📢</span>
          <span class="font-medium truncate">${escapeHtml(statusMessage)}</span>
        </div>
        <button type="button" id="admin-image-dismiss-msg" class="text-teal-400 hover:text-teal-200 font-bold ml-2 p-1 rounded shrink-0 cursor-pointer">✕</button>
      </div>
    ` : ''}

    <!-- Two-Column Workspace: Left Column (Ingredients List) | Right Column (Selected Ingredient Preview & Upload) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start min-w-0">

      <!-- Left Column: Ingredients Directory (col-span-5) -->
      <section class="lg:col-span-5 min-w-0 space-y-3" aria-label="Ingredients List">
        <div class="rounded-2xl bg-slate-900/85 border border-slate-800/80 p-4 shadow-xl min-w-0">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>📋</span>
              <span>Ingredients (${displayedItems.length})</span>
            </h3>
            <span class="text-[11px] text-slate-400 font-medium">Click item to inspect</span>
          </div>

          <div class="admin-ingredient-list-scroll space-y-2 mt-3 pr-1" style="max-height: 520px; overflow-y: auto;">
            ${displayedItems.length > 0 ? displayedItems.map(item => {
              const mapping = mappingByIngredientId[item.id];
              const hasMapping = Boolean(mapping && mapping.secure_url);
              const isPending = mapping && mapping.status === 'pending_review';
              const thumbUrl = mapping?.secure_url || getIngredientImageUrl(item.id, activeProtocol, item.imageUrl);
              const isSelected = selectedItem && selectedItem.id === item.id;

              let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">⚪ Missing</span>`;
              if (hasMapping) {
                if (isPending) {
                  statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">🟡 Review</span>`;
                } else {
                  statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">🟢 Active</span>`;
                }
              }

              return `
                <div 
                  class="admin-ingredient-card admin-image-item-card flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-emerald-500/80 bg-emerald-950/20 shadow-md ring-1 ring-emerald-500/30' 
                      : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60'
                  }"
                  data-select-ingredient="${item.id}"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <!-- Thumbnail Container with containment -->
                    <div class="w-12 h-12 rounded-xl bg-slate-800/90 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative p-1">
                      ${thumbUrl ? `
                        <img 
                          src="${escapeHtml(thumbUrl)}" 
                          alt="${escapeHtml(item.name)}" 
                          class="max-h-full max-w-full w-auto h-auto object-contain rounded-md" 
                          loading="lazy"
                          onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='inline-block';"
                        />
                        <span style="display: none;" class="text-xl">${escapeHtml(item.icon || getCategoryIcon(item.category, item.name))}</span>
                      ` : `
                        <span class="text-xl">${escapeHtml(item.icon || getCategoryIcon(item.category, item.name))}</span>
                      `}
                    </div>

                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <h4 class="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-[190px]">${escapeHtml(item.name)}</h4>
                      </div>
                      <div class="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 truncate">
                        <span class="font-mono text-slate-500">${escapeHtml(mapping?.public_id || item.id)}</span>
                        <span>•</span>
                        <span>${escapeHtml(item.category || 'General')}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    ${statusBadge}
                    ${isPending && mapping ? `
                      <button 
                        type="button" 
                        class="admin-approve-mapping-btn p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition cursor-pointer"
                        data-mapping-id="${mapping.id}"
                        data-ingredient-id="${item.id}"
                        title="Approve matched photograph"
                      >
                        <span>✓</span>
                      </button>
                    ` : ''}
                    ${hasMapping && mapping ? `
                      <button 
                        type="button" 
                        class="admin-delete-mapping-btn p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer"
                        data-mapping-id="${mapping.id}"
                        data-ingredient-id="${item.id}"
                        title="Unlink photograph"
                      >
                        <span>🗑️</span>
                      </button>
                    ` : ''}
                    <button 
                      type="button" 
                      class="admin-upload-for-item-btn p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 transition cursor-pointer"
                      data-ingredient-id="${item.id}"
                      title="Upload or replace photo for ${escapeHtml(item.name)}"
                    >
                      <span>📤</span>
                    </button>
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
        </div>
      </section>

      <!-- Right Column: Selected Ingredient Preview & Upload Workspace (col-span-7) -->
      <section class="lg:col-span-7 min-w-0 space-y-4" aria-label="Selected Ingredient Preview">
        ${selectedItem ? `
          <div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-4 min-w-0">
            <!-- Preview Card Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3.5 border-b border-slate-800/80 min-w-0">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-base sm:text-lg font-bold text-white truncate max-w-xs sm:max-w-md">
                    ${escapeHtml(selectedItem.name)}
                  </h3>
                  ${isSelectedActive ? `
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wide">
                      🟢 Active Photo
                    </span>
                  ` : isSelectedPending ? `
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wide">
                      🟡 Pending Review
                    </span>
                  ` : `
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wide">
                      ⚪ Needs Photo
                    </span>
                  `}
                </div>
                <div class="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span class="font-mono text-emerald-400/90 bg-slate-800/80 px-2 py-0.5 rounded text-[11px]">${escapeHtml(selectedItem.id)}</span>
                  <span>•</span>
                  <span>Category: <strong class="text-slate-300">${escapeHtml(selectedItem.category || 'General')}</strong></span>
                  <span>•</span>
                  <span class="uppercase text-[10px] font-bold text-teal-400">${escapeHtml(activeProtocol)}</span>
                </div>
              </div>

              <!-- Top-right Quick Actions -->
              <div class="flex items-center gap-2 shrink-0">
                <button 
                  type="button" 
                  id="admin-image-toggle-upload-btn"
                  class="px-3.5 py-2 rounded-xl text-xs font-semibold ${
                    uploadFormOpen 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                  } flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <span>${uploadFormOpen ? '✕ Close Upload' : '➕ Upload / Replace Photo'}</span>
                </button>
              </div>
            </div>

            <!-- Bounded Ingredient Image Preview (Height ~288px mobile, 320px desktop; object-contain) -->
            <div class="preview-stage space-y-2">
              <div class="flex items-center justify-between text-xs text-slate-400 px-1">
                <span class="font-bold uppercase tracking-wider text-[11px] text-slate-400">Photograph Preview</span>
                <span class="text-[11px] text-slate-500">${uploadPreviewUrl ? 'Upload Preview' : (selectedItemImageUrl ? 'Active Saved Image' : 'No photo linked')}</span>
              </div>

              <div 
                class="admin-image-preview-container relative w-full h-72 sm:h-80 min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center p-3 shadow-inner"
              >
                ${uploadPreviewUrl ? `
                  <img 
                    src="${uploadPreviewUrl}" 
                    alt="Upload Preview" 
                    class="admin-preview-bounded-img admin-image-preview-img block w-auto h-auto max-w-full max-h-full object-contain rounded-xl" 
                    style="width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain;"
                    loading="eager"
                  />
                ` : selectedItemImageUrl ? `
                  <img 
                    src="${escapeHtml(selectedItemImageUrl)}" 
                    alt="${escapeHtml(selectedItem.name)}" 
                    class="admin-preview-bounded-img admin-image-preview-img block w-auto h-auto max-w-full max-h-full object-contain rounded-xl" 
                    style="width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain;"
                    loading="eager"
                  />
                ` : `
                  <div class="flex flex-col items-center justify-center text-slate-500 text-xs py-8 text-center select-none">
                    <span class="text-5xl opacity-40 mb-2">${escapeHtml(selectedItem.icon || getCategoryIcon(selectedItem.category, selectedItem.name))}</span>
                    <span class="font-bold text-slate-300 text-sm">No Photograph Mapped</span>
                    <span class="text-xs text-slate-500 mt-1 max-w-xs">Upload a photograph below or run auto-discovery to sync from Cloudinary</span>
                  </div>
                `}
              </div>
            </div>

            <!-- Cloudinary Metadata Information Box -->
            <div class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-1.5 min-w-0">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-400 font-bold uppercase tracking-wider">Cloudinary CDN Link:</span>
                ${selectedMapping ? `
                  <span class="font-mono text-emerald-400 text-[10px]">Synced in Neon DB</span>
                ` : `
                  <span class="text-slate-500 text-[10px]">Unlinked</span>
                `}
              </div>
              <div class="font-mono text-[11px] text-teal-300/90 truncate bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800" title="${escapeHtml(selectedMapping?.public_id || selectedItemImageUrl || 'None')}">
                ☁️ ${escapeHtml(selectedMapping?.public_id || (selectedItemImageUrl ? selectedItemImageUrl.split('/upload/')[1] || selectedItemImageUrl : 'No Cloudinary asset linked'))}
              </div>
            </div>

            <!-- Action Buttons for Selected Mapping (Approve / Delete) -->
            ${selectedMapping ? `
              <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
                ${isSelectedPending ? `
                  <button 
                    type="button" 
                    class="admin-approve-mapping-btn px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 transition active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
                    data-mapping-id="${selectedMapping.id}"
                    data-ingredient-id="${selectedItem.id}"
                    title="Approve matched photograph as active"
                  >
                    <span>✓</span>
                    <span>Approve Image</span>
                  </button>
                ` : ''}

                <button 
                  type="button" 
                  class="admin-delete-mapping-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-500/30 hover:border-rose-500/60 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                  data-mapping-id="${selectedMapping.id}"
                  data-ingredient-id="${selectedItem.id}"
                  title="Unlink image mapping from this ingredient"
                >
                  <span>🗑️</span>
                  <span>Unlink Photo</span>
                </button>
              </div>
            ` : ''}

            <!-- Dedicated Upload & Dropzone Panel (collapsible) -->
            ${uploadFormOpen ? `
              <div class="upload-panel p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/40 shadow-xl space-y-4 animate-fadeIn mt-4">
                <div class="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <h4 class="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span>📤</span>
                    <span>Upload Photograph for ${escapeHtml(selectedItem.name)}</span>
                  </h4>
                  <span class="text-[10px] text-slate-400">Target: <strong class="text-emerald-400">${activeProtocol.toUpperCase()}</strong></span>
                </div>

                <form id="admin-image-upload-form" class="space-y-4">
                  <!-- Hidden or read-only ingredient selector matching current selection -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1" for="upload-ingredient-select">
                        Target Ingredient
                      </label>
                      <select id="upload-ingredient-select" required class="w-full text-xs bg-slate-800 text-slate-100 border border-slate-700/80 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer">
                        ${LID_DATABASE.map(item => `
                          <option value="${item.id}" ${item.id === selectedItem.id ? 'selected' : ''}>
                            ${item.name} (${item.id})
                          </option>
                        `).join('')}
                      </select>
                    </div>

                    <div>
                      <label class="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                        Dietary Protocol
                      </label>
                      <input type="text" readonly value="${activeProtocol.toUpperCase()} (${DIET_PROFILES[activeProtocol]?.name || 'Active'})" class="w-full text-xs font-medium bg-slate-800/50 text-slate-400 border border-slate-800 rounded-xl p-2.5" />
                    </div>
                  </div>

                  <!-- Dropzone Area -->
                  <div>
                    <label class="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                      Choose Photo File (WebP, JPG, PNG) <span class="text-emerald-400">*</span>
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
          </div>
        ` : `
          <div class="p-10 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-center text-slate-500 space-y-2">
            <span class="text-4xl block opacity-40">👈</span>
            <h4 class="text-base font-bold text-slate-300">Select an Ingredient</h4>
            <p class="text-xs text-slate-400">Choose any ingredient from the list on the left to preview its image, upload a new photo, or manage Cloudinary mappings.</p>
          </div>
        `}
      </section>
    </div>
  `;

  // Return embedded page container if rendered as a navigation page
  if (embedded) {
    return `
      <div class="admin-manage-page-container w-full max-w-6xl mx-auto min-w-0 px-4 py-5 sm:px-6 sm:py-6 pb-32 space-y-6">
        <!-- Embedded Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800 min-w-0">
          <div class="flex items-center gap-3.5 min-w-0">
            <span class="text-3xl sm:text-4xl shrink-0">🖼️</span>
            <div class="min-w-0">
              <div class="flex items-center gap-2.5 flex-wrap">
                <h1 class="font-extrabold text-xl sm:text-2xl text-slate-100 tracking-tight">Ingredient Image Management</h1>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 tracking-wide uppercase">Admin Hub</span>
              </div>
              <p class="text-xs sm:text-sm text-slate-400 mt-1">
                Manage, upload, replace, and review Cloudinary ingredient images.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-5 min-w-0">
          ${workspaceContent}
        </div>
      </div>
    `;
  }

  // Modal mode (when opened from modal overlay)
  return `
    <div class="modal-overlay" id="admin-image-modal-overlay">
      <div class="modal-content admin-image-modal-box relative flex flex-col w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="admin-image-title">
        
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
                Manage, upload, replace, and review Cloudinary ingredient images.
              </p>
            </div>
          </div>
          <button class="btn-icon text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-xl transition" id="admin-image-close-btn" aria-label="Close Image Manager">✕</button>
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
