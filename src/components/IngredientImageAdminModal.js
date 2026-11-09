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
    isUploading = false,
    isDiscovering = false
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
    const q = searchQuery.toLowerCase();
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

  return `
    <div class="modal-overlay" id="admin-image-modal-overlay">
      <div class="modal-content admin-image-modal-box" role="dialog" aria-modal="true" aria-labelledby="admin-image-title">
        
        <!-- Header -->
        <div class="modal-header">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xl">🖼️</span>
              <h2 id="admin-image-title" class="modal-title font-bold text-lg text-slate-100">Ingredient Image Management</h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">Admin Hub</span>
            </div>
            <p class="text-xs text-slate-400 mt-1">
              Synchronize, upload, and link Cloudinary ingredient photographs to the KosherAI multi-diet database.
            </p>
          </div>
          <button class="btn-icon" id="admin-image-close-btn" aria-label="Close Image Manager">✕</button>
        </div>

        <!-- Protocol & Status Metrics Bar -->
        <div class="admin-image-metrics-bar grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
          <div class="metric-card bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-center">
            <span class="text-slate-400 text-[11px] block uppercase font-semibold">Total Items</span>
            <span class="text-lg font-bold text-white">${stats.totalIngredients || LID_DATABASE.length}</span>
          </div>
          <div class="metric-card bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-2.5 text-center">
            <span class="text-emerald-400 text-[11px] block uppercase font-semibold">🟢 Mapped Photos</span>
            <span class="text-lg font-bold text-emerald-300">${stats.withImage || 0}</span>
          </div>
          <div class="metric-card bg-amber-950/20 border border-amber-900/40 rounded-xl p-2.5 text-center">
            <span class="text-amber-400 text-[11px] block uppercase font-semibold">🟡 Needs Review</span>
            <span class="text-lg font-bold text-amber-300">${stats.pendingReview || 0}</span>
          </div>
          <div class="metric-card bg-slate-800/40 border border-slate-700/40 rounded-xl p-2.5 text-center">
            <span class="text-slate-400 text-[11px] block uppercase font-semibold">⚪ Missing Photos</span>
            <span class="text-lg font-bold text-slate-300">${stats.missingImage !== undefined ? stats.missingImage : (LID_DATABASE.length - (stats.withImage || 0))}</span>
          </div>
        </div>

        <!-- Notification Banner if active -->
        ${statusMessage ? `
          <div class="p-3 mb-3 rounded-xl bg-teal-950/40 border border-teal-500/40 text-teal-200 text-xs flex items-center justify-between">
            <span>${escapeHtml(statusMessage)}</span>
            <button type="button" id="admin-image-dismiss-msg" class="text-teal-400 hover:text-teal-200 font-bold ml-2">✕</button>
          </div>
        ` : ''}

        <!-- Protocol Selector & Action Buttons -->
        <div class="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 mb-3">
          <div class="flex items-center gap-2">
            <label for="admin-image-protocol-select" class="text-xs font-semibold text-slate-300">Protocol:</label>
            <select id="admin-image-protocol-select" class="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none">
              ${Object.values(DIET_PROFILES).map(p => `
                <option value="${p.id}" ${p.id === activeProtocol ? 'selected' : ''}>
                  ${p.icon} ${p.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="flex items-center gap-2">
            <button 
              type="button" 
              id="admin-image-discover-btn" 
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              ${isDiscovering ? 'disabled' : ''}
              title="Automatically scan Cloudinary and match existing photographs"
            >
              <span>${isDiscovering ? '⏳' : '🔍'}</span>
              <span>${isDiscovering ? 'Scanning Cloudinary...' : 'Auto-Discover Cloudinary'}</span>
            </button>

            <button 
              type="button" 
              id="admin-image-toggle-upload-btn" 
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <span>${uploadFormOpen ? '✕ Cancel' : '➕ Upload Photo'}</span>
            </button>
          </div>
        </div>

        <!-- Collapsible Upload Form -->
        ${uploadFormOpen ? `
          <div class="upload-panel p-4 mb-4 rounded-xl bg-slate-900 border border-emerald-500/40 shadow-lg animate-fadeIn">
            <h3 class="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <span>📤 Upload & Map Ingredient Photograph</span>
            </h3>
            
            <form id="admin-image-upload-form" class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1" for="upload-ingredient-select">
                    Target Ingredient:
                  </label>
                  <select id="upload-ingredient-select" required class="w-full text-xs bg-slate-800 text-slate-100 border border-slate-700 rounded-lg p-2 focus:outline-none">
                    <option value="">-- Choose Ingredient --</option>
                    ${LID_DATABASE.map(item => `
                      <option value="${item.id}" ${item.id === selectedIngredientId ? 'selected' : ''}>
                        ${item.name} (${item.id})
                      </option>
                    `).join('')}
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">
                    Dietary Protocol:
                  </label>
                  <input type="text" readonly value="${activeProtocol.toUpperCase()}" class="w-full text-xs bg-slate-800/50 text-slate-400 border border-slate-800 rounded-lg p-2" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">
                  Photograph File (WebP, JPG, PNG):
                </label>
                <div class="flex items-center gap-3">
                  <input 
                    type="file" 
                    id="admin-image-file-input" 
                    accept="image/*" 
                    class="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                  />
                  ${uploadPreviewUrl ? `
                    <div class="w-12 h-12 rounded-lg overflow-hidden border border-emerald-500/60 shrink-0">
                      <img src="${uploadPreviewUrl}" alt="Preview" class="w-full h-full object-cover" />
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" id="admin-image-cancel-upload-btn" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  id="admin-image-submit-upload-btn" 
                  class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  ${isUploading ? 'disabled' : ''}
                >
                  <span>${isUploading ? '⏳ Uploading...' : 'Upload to Cloudinary & Save'}</span>
                </button>
              </div>
            </form>
          </div>
        ` : ''}

        <!-- Filter & Search Toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-1.5 text-xs">
            <button type="button" class="admin-status-filter-btn px-2.5 py-1 rounded-lg ${statusFilter === 'all' ? 'bg-slate-700 text-white font-bold' : 'bg-slate-800 text-slate-400'}" data-filter="all">
              All (${stats.totalIngredients || LID_DATABASE.length})
            </button>
            <button type="button" class="admin-status-filter-btn px-2.5 py-1 rounded-lg ${statusFilter === 'active' ? 'bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}" data-filter="active">
              Mapped (${stats.withImage || 0})
            </button>
            <button type="button" class="admin-status-filter-btn px-2.5 py-1 rounded-lg ${statusFilter === 'pending_review' ? 'bg-amber-900/60 text-amber-300 font-bold border border-amber-500/40' : 'bg-slate-800 text-slate-400'}" data-filter="pending_review">
              Review (${stats.pendingReview || 0})
            </button>
            <button type="button" class="admin-status-filter-btn px-2.5 py-1 rounded-lg ${statusFilter === 'missing' ? 'bg-slate-700/60 text-slate-300 font-bold border border-slate-600' : 'bg-slate-800 text-slate-400'}" data-filter="missing">
              Missing (${stats.missingImage !== undefined ? stats.missingImage : (LID_DATABASE.length - (stats.withImage || 0))})
            </button>
          </div>

          <div class="w-full sm:w-60">
            <input 
              type="text" 
              id="admin-image-search-input" 
              class="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500" 
              placeholder="Search ingredient or ID..." 
              value="${escapeHtml(searchQuery)}"
            />
          </div>
        </div>

        <!-- Ingredients Table / Gallery List -->
        <div class="admin-image-list overflow-y-auto max-h-[50vh] space-y-2 pr-1">
          ${displayedItems.length > 0 ? displayedItems.map(item => {
            const mapping = mappingByIngredientId[item.id];
            const hasMapping = Boolean(mapping && mapping.secure_url);
            const isPending = mapping && mapping.status === 'pending_review';
            const imgUrl = getIngredientImageUrl(item.id, activeProtocol, item.imageUrl);

            let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">⚪ No Image</span>`;
            if (hasMapping) {
              if (isPending) {
                statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">🟡 Pending Review</span>`;
              } else {
                statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">🟢 Active</span>`;
              }
            }

            return `
              <div class="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
                <div class="flex items-center gap-3 min-w-0">
                  <!-- Thumbnail -->
                  <div class="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0">
                    ${imgUrl ? `
                      <img 
                        src="${escapeHtml(imgUrl)}" 
                        alt="${escapeHtml(item.name)}" 
                        class="w-full h-full object-cover" 
                        loading="lazy"
                        onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='inline-block';"
                      />
                      <span style="display: none;" class="text-xl">${escapeHtml(item.icon || getCategoryIcon(item.category, item.name))}</span>
                    ` : `
                      <span class="text-xl">${escapeHtml(item.icon || getCategoryIcon(item.category, item.name))}</span>
                    `}
                  </div>

                  <!-- Details -->
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <h4 class="text-xs font-bold text-white truncate">${escapeHtml(item.name)}</h4>
                      ${statusBadge}
                    </div>
                    <div class="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span class="font-mono text-slate-500">${escapeHtml(item.id)}</span>
                      <span>•</span>
                      <span>${escapeHtml(item.category)}</span>
                    </div>
                    ${mapping && mapping.public_id ? `
                      <div class="text-[10px] font-mono text-teal-400/80 truncate mt-0.5" title="${escapeHtml(mapping.public_id)}">
                        ☁️ ${escapeHtml(mapping.public_id)}
                      </div>
                    ` : ''}
                  </div>
                </div>

                <!-- Action Controls -->
                <div class="flex items-center gap-1.5 shrink-0">
                  ${isPending ? `
                    <button 
                      type="button" 
                      class="admin-approve-mapping-btn px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 transition active:scale-95 cursor-pointer"
                      data-mapping-id="${mapping.id}"
                      data-ingredient-id="${item.id}"
                      title="Approve matched photograph as active"
                    >
                      ✓ Approve
                    </button>
                  ` : ''}

                  <button 
                    type="button" 
                    class="admin-upload-for-item-btn px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 cursor-pointer"
                    data-ingredient-id="${item.id}"
                    title="Upload or replace photograph for this ingredient"
                  >
                    ${hasMapping ? 'Replace' : 'Upload'}
                  </button>

                  ${hasMapping ? `
                    <button 
                      type="button" 
                      class="admin-delete-mapping-btn p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition active:scale-95 cursor-pointer"
                      data-mapping-id="${mapping.id}"
                      data-ingredient-id="${item.id}"
                      title="Unlink image mapping"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('') : `
            <div class="text-center py-8 text-slate-500 text-xs">
              No ingredients found matching the current search query or filter.
            </div>
          `}
        </div>

        <!-- Footer -->
        <div class="modal-footer flex items-center justify-between pt-3 mt-3 border-t border-slate-800 text-xs text-slate-500">
          <span>Persists in Neon PostgreSQL & Cloudinary CDN.</span>
          <button type="button" class="btn-secondary" id="admin-image-done-btn">Done</button>
        </div>

      </div>
    </div>
  `;
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

