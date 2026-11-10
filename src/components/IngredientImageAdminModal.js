// KosherAI - Administrator Ingredient Image Management Hub
// Compact Responsive Grid Gallery for all ingredients (~160px-180px cards)
// Displays Cloudinary thumbnails, status badges, and quick-upload triggers.

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
      if (m.ingredient_name) {
        mappingByIngredientId[m.ingredient_name] = m;
      }
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
      const mapping = mappingByIngredientId[item.id] || mappingByIngredientId[item.name];
      if (statusFilter === 'active' || statusFilter === 'mapped') return mapping && mapping.status === 'active';
      if (statusFilter === 'pending_review' || statusFilter === 'review') return mapping && mapping.status === 'pending_review';
      if (statusFilter === 'missing') return !mapping || mapping.status === 'inactive';
      return true;
    });
  }

  // Active / selected ingredient resolution
  const activeSelectedId = selectedIngredientId || (displayedItems[0] ? displayedItems[0].id : 'salt-kosher');
  const selectedItem = LID_DATABASE.find(item => item.id === activeSelectedId) || displayedItems[0] || null;
  const selectedMapping = selectedItem ? (mappingByIngredientId[selectedItem.id] || mappingByIngredientId[selectedItem.name]) : null;
  const isSelectedPending = selectedMapping && selectedMapping.status === 'pending_review';
  const isSelectedActive = selectedMapping && selectedMapping.status === 'active';
  const selectedItemImageUrl = selectedItem
    ? (selectedMapping?.secure_url || getIngredientImageUrl(selectedItem.id, activeProtocol, selectedItem.imageUrl))
    : null;

  // Render the core workspace content (usable both embedded in page and inside modal dialog)
  const workspaceContent = `
    <!-- Top Row: Protocol & Status Metrics Bar -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            Admin Hub
          </span>
          <h1 class="text-lg sm:text-xl font-bold text-white tracking-wide">
            Ingredient Image Gallery
          </h1>
          <span class="hidden">Ingredient Image Management</span>
        </div>
        <p class="text-xs text-slate-400 mt-0.5">
          Manage, upload, replace, and review Cloudinary ingredient images.
        </p>
      </div>

      <!-- Counter Stats -->
      <div class="admin-image-metrics-bar flex flex-wrap items-center gap-2">
        <div class="metric-card px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span class="text-[10px] uppercase font-bold text-slate-400 block">Total Items</span>
          <span class="text-xs font-black text-white">${stats.totalIngredients || LID_DATABASE.length}</span>
        </div>
        <div class="metric-card px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-center">
          <span class="text-[10px] uppercase font-bold text-emerald-400 block">🟢 Mapped Photos</span>
          <span class="text-xs font-black text-emerald-300">${stats.withImage || 0}</span>
        </div>
        <div class="metric-card px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/50 text-center">
          <span class="text-[10px] uppercase font-bold text-amber-400 block">🟡 Needs Review</span>
          <span class="text-xs font-black text-amber-300">${stats.pendingReview || 0}</span>
        </div>
        <div class="metric-card px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-center">
          <span class="text-[10px] uppercase font-bold text-rose-400 block">⚪ Missing</span>
          <span class="text-xs font-black text-rose-300">${stats.missingImage !== undefined ? stats.missingImage : (LID_DATABASE.length - (stats.withImage || 0))}</span>
        </div>
      </div>
    </div>

    <!-- Protocol Selection & Filter Control Card -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5 p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl">
      <div class="flex items-center gap-2">
        <select
          id="admin-image-protocol-select"
          class="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
        >
          ${Object.values(DIET_PROFILES).map(p => `
            <option value="${p.id}" ${p.id === activeProtocol ? 'selected' : ''}>
              ${p.icon} ${p.name}
            </option>
          `).join('')}
        </select>

        <button
          type="button"
          id="admin-image-discover-btn"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          ${isDiscovering ? 'disabled' : ''}
          title="Automatically scan Cloudinary and match existing photographs"
        >
          <span>${isDiscovering ? '⏳' : '⚡'}</span>
          <span>${isDiscovering ? 'Scanning Cloudinary...' : 'Auto-Discover Cloudinary'}</span>
        </button>

        <button
          type="button"
          id="admin-image-toggle-upload-btn"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          title="Upload or replace an ingredient photograph"
        >
          <span>📤</span>
          <span>Upload Photo</span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative w-full sm:w-48">
          <input
            type="text"
            id="admin-image-search-input"
            placeholder="Search ingredient..."
            value="${escapeHtml(searchQuery)}"
            class="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
        <div class="flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700 shrink-0">
          ${[
            { key: 'all', label: 'all' },
            { key: 'active', label: 'mapped' },
            { key: 'pending_review', label: 'review' },
            { key: 'missing', label: 'missing' }
          ].map((item) => {
            const isFilterActive = (statusFilter === item.key) || (item.key === 'active' && statusFilter === 'mapped') || (item.key === 'pending_review' && statusFilter === 'review');
            return `
              <button
                key="${item.key}"
                type="button"
                class="admin-status-filter-btn px-2 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  isFilterActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }"
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
      <div class="mb-4 p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-teal-200 text-xs flex items-center justify-between shadow-sm animate-fadeIn min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="shrink-0">📢</span>
          <span class="font-medium truncate">${escapeHtml(statusMessage)}</span>
        </div>
        <button type="button" id="admin-image-dismiss-msg" class="text-teal-400 hover:text-teal-200 font-bold ml-2 p-1 rounded shrink-0 cursor-pointer">✕</button>
      </div>
    ` : ''}

    <!-- 3. Compact Responsive Grid Gallery (all 36 ingredients) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      ${displayedItems.map((item) => {
        const mapping = mappingByIngredientId[item.id] || mappingByIngredientId[item.name];
        const isMapped = Boolean(mapping && mapping.secure_url);
        const isPending = mapping && mapping.status === 'pending_review';
        const thumbUrl = mapping?.secure_url || getIngredientImageUrl(item.id, activeProtocol, item.imageUrl);
        const isItemUploading = isUploading && selectedIngredientId === item.id;
        const isSelected = selectedItem && selectedItem.id === item.id;

        return `
          <div
            class="admin-ingredient-card admin-image-item-card group relative flex flex-col justify-between bg-slate-900 border ${isSelected ? 'border-indigo-500/80 ring-1 ring-indigo-500/30' : 'border-slate-800/80'} hover:border-slate-700 rounded-xl overflow-hidden p-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
            data-select-ingredient="${item.id}"
            data-ingredient-id="${item.id}"
          >
            <!-- Compact Thumbnail Container (~96px to 110px max height) -->
            <div class="relative w-full h-24 sm:h-28 rounded-lg bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800/80">
              ${isMapped ? `
                <img
                  src="${escapeHtml(thumbUrl)}"
                  alt="${escapeHtml(item.name)}"
                  class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                  onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';"
                />
                <div style="display: none;" class="flex flex-col items-center justify-center text-slate-600 p-2 text-center">
                  <span class="text-xl mb-1">${escapeHtml(item.icon || getCategoryIcon(item.category, item.name))}</span>
                  <span class="text-[10px] text-slate-500">Image Error</span>
                </div>
              ` : `
                <div class="flex flex-col items-center justify-center text-slate-600 p-2 text-center">
                  <span class="text-xl mb-1">📷</span>
                  <span class="text-[10px] text-slate-500">No Image</span>
                </div>
              `}

              <!-- Status indicator top corner -->
              <span
                class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider backdrop-blur-md border ${
                  isMapped
                    ? (isPending ? 'bg-amber-950/80 text-amber-300 border-amber-600/50' : 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50')
                    : 'bg-rose-950/80 text-rose-300 border-rose-600/50'
                }"
              >
                ${isMapped ? (isPending ? '🟡 Review' : '🟢 Active') : '⚪ Missing'}
              </span>

              <!-- Uploading Overlay -->
              ${isItemUploading ? `
                <div class="absolute inset-0 bg-black/75 flex items-center justify-center">
                  <span class="text-[10px] text-emerald-400 font-bold animate-pulse">Uploading...</span>
                </div>
              ` : ''}
            </div>

            <!-- Ingredient Info & Quick Replace Action -->
            <div class="mt-2 flex-1 flex flex-col justify-between">
              <div>
                <h4 class="text-xs font-bold text-white line-clamp-1 group-hover:text-indigo-300 transition-colors" title="${escapeHtml(item.name)}">
                  ${escapeHtml(item.name)}
                </h4>
                <span class="block text-[9px] font-mono text-slate-400 truncate mt-0.5" title="${escapeHtml(mapping?.public_id || item.id)}">
                  ${escapeHtml(mapping?.public_id || item.id)}
                </span>
              </div>

              <div class="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between gap-1.5" onclick="event.stopPropagation()">
                ${isPending && mapping ? `
                  <button
                    type="button"
                    class="admin-approve-mapping-btn px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 transition cursor-pointer"
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
                    class="admin-delete-mapping-btn p-1 rounded bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 text-[10px] font-bold border border-rose-500/30 transition cursor-pointer"
                    data-mapping-id="${mapping.id}"
                    data-ingredient-id="${item.id}"
                    title="Unlink photograph"
                  >
                    🗑️
                  </button>
                ` : ''}

                <label class="admin-upload-for-item-btn flex-1 text-center py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-[10px] font-bold cursor-pointer transition-colors border border-slate-700/60" data-ingredient-id="${item.id}">
                  ${isMapped ? 'Replace' : '+ Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    class="admin-grid-card-file-input hidden"
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
      <div class="py-16 text-center text-slate-500 text-xs">
        No ingredients match your filter or search query.
      </div>
    ` : ''}

    <!-- Inspection / Direct Upload Modal Overlay -->
    ${uploadFormOpen && selectedItem ? `
      <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" id="admin-image-inspect-modal">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl relative">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 class="text-sm font-bold text-white">${escapeHtml(selectedItem.name)}</h3>
              <span class="text-[10px] font-mono text-slate-400">${escapeHtml(selectedItem.id)}</span>
            </div>
            <button type="button" id="admin-image-cancel-upload-btn" class="text-slate-400 hover:text-white text-xs p-1 rounded-lg cursor-pointer">✕</button>
          </div>

          <div class="mt-4 admin-image-preview-container relative w-full h-48 sm:h-56 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
            ${uploadPreviewUrl ? `
              <img src="${uploadPreviewUrl}" alt="Preview" class="admin-preview-bounded-img admin-image-preview-img w-full h-full object-contain" />
            ` : (selectedItemImageUrl ? `
              <img src="${escapeHtml(selectedItemImageUrl)}" alt="${escapeHtml(selectedItem.name)}" class="admin-preview-bounded-img admin-image-preview-img w-full h-full object-contain" />
            ` : `
              <div class="text-center text-slate-500 text-xs">
                <span class="text-3xl block mb-2 opacity-50">📷</span>
                Photograph Preview
              </div>
            `)}
          </div>

          <!-- Dropzone for upload -->
          <form id="admin-image-upload-form" class="mt-4 space-y-3">
            <input type="hidden" id="upload-ingredient-select" value="${selectedItem.id}" />
            <div class="admin-image-dropzone p-3 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 text-center cursor-pointer relative bg-slate-950/60" id="admin-image-dropzone">
              <input type="file" id="admin-image-file-input" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer" />
              <span class="text-xs text-slate-300 block font-semibold">Click to browse</span> or drag & drop image here
              ${selectedFileName ? `
                <div class="mt-2 text-[10px] text-emerald-400 font-mono">
                  Selected: ${escapeHtml(selectedFileName)} (${formatBytes(selectedFileSize)})
                </div>
              ` : ''}
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button type="button" id="admin-image-cancel-upload-btn-secondary" class="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer">Cancel</button>
              <button type="submit" class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer" ${isUploading ? 'disabled' : ''}>
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
      <div class="admin-manage-page-container w-full max-w-7xl mx-auto px-4 py-5 pb-32">
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
                Manage Cloudinary asset mappings across food protocols
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
