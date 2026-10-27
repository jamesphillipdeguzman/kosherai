// Quick Search & Multi-Diet Checker Tab Component (Offline First)
import { LID_CATEGORIES, STATUS, getItemDietaryInfo, getItemStatus } from '../data/lidDatabase.js';
import { searchDatabase } from '../services/ruleEngine.js';

export function renderCheckerTab(state) {
  const { searchQuery, statusFilter, categoryFilter, searchResults } = state;
  const activeDiet = state.activeDiet || 'lid';

  const quickTags = [
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

  const categories = Object.values(LID_CATEGORIES);

  // Compute reactive counts matching active diet and current query/category
  const baseMatches = searchDatabase(searchQuery, 'ALL', categoryFilter, activeDiet);
  const totalCount = baseMatches.length;
  const safeCount = baseMatches.filter(r => getItemStatus(r, activeDiet) === STATUS.SAFE).length;
  const avoidCount = baseMatches.filter(r => getItemStatus(r, activeDiet) === STATUS.AVOID).length;
  const cautionCount = baseMatches.filter(r => getItemStatus(r, activeDiet) === STATUS.CAUTION).length;

  return `
    <div class="checker-tab-view">
      <!-- Search Input -->
      <div class="search-box-wrapper">
        <svg class="search-icon-left" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        
        <input 
          type="text" 
          id="checker-search-input" 
          class="search-input" 
          placeholder="Search 100+ Pinoy ingredients, brands, or additives (e.g. sayote, isaw, patis, munggo)..." 
          value="${escapeHtml(searchQuery || '')}"
          autocomplete="off"
          spellcheck="false"
        />

        ${searchQuery ? `
          <button id="checker-clear-btn" class="search-clear-btn" title="Clear Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        ` : ''}
      </div>

      <!-- Quick Suggestion Tags -->
      <div class="quick-tags-wrapper">
        <span class="quick-tag-label">Quick Lookups:</span>
        ${quickTags.map(tag => `
          <button class="quick-tag-chip" data-query="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
        `).join('')}
      </div>

      <!-- Filters Row with Dynamic Multi-Diet Counts -->
      <div class="filters-bar">
        <button class="filter-btn ${statusFilter === 'ALL' ? 'active' : ''}" data-status="ALL">
          All Items (${totalCount})
        </button>
        <button class="filter-btn ${statusFilter === STATUS.SAFE ? 'active' : ''}" data-status="${STATUS.SAFE}">
          🟢 Safe (${safeCount})
        </button>
        <button class="filter-btn filter-avoid ${statusFilter === STATUS.AVOID ? 'active' : ''}" data-status="${STATUS.AVOID}">
          🔴 Avoid (${avoidCount})
        </button>
        <button class="filter-btn filter-caution ${statusFilter === STATUS.CAUTION ? 'active' : ''}" data-status="${STATUS.CAUTION}">
          🟡 Caution (${cautionCount})
        </button>

        <select id="category-filter-select" class="category-select" aria-label="Filter by Category">
          <option value="ALL" ${categoryFilter === 'ALL' ? 'selected' : ''}>All Categories</option>
          ${categories.map(cat => `
            <option value="${escapeHtml(cat)}" ${categoryFilter === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>
          `).join('')}
        </select>
      </div>

      <!-- Search Results Grid with Reactive Badges & Pinoy Swaps -->
      <div class="results-grid" id="results-grid">
        ${searchResults.length > 0 ? searchResults.map(item => renderIngredientCard(item, activeDiet)).join('') : renderEmptyState(searchQuery)}
      </div>
    </div>
  `;
}

function renderIngredientCard(item, activeDiet = 'lid') {
  const info = getItemDietaryInfo(item, activeDiet);
  const isSafe = info.status === STATUS.SAFE;
  const isAvoid = info.status === STATUS.AVOID;
  const isCaution = info.status === STATUS.CAUTION;

  let statusClass = 'status-safe';
  let badgeClass = 'badge-safe';
  let badgeIcon = '🟢';
  let metricClass = 'iodine-safe';

  if (isAvoid) {
    statusClass = 'status-avoid';
    badgeClass = 'badge-avoid';
    badgeIcon = '🔴';
    metricClass = 'iodine-high';
  } else if (isCaution) {
    statusClass = 'status-caution';
    badgeClass = 'badge-caution';
    badgeIcon = '🟡';
    metricClass = 'iodine-warn';
  }

  const swaps = info.substitutes || [];

  return `
    <div class="ingredient-card group ${statusClass}" data-item-id="${item.id}" role="button" tabindex="0">
      <div class="card-header flex items-start gap-3">
        ${item.imageUrl ? `
          <div class="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 card-thumbnail-wrap">
            <img
              src="${escapeHtml(item.imageUrl)}"
              alt="${escapeHtml(item.name)}"
              loading="lazy"
              decoding="async"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onerror="this.parentElement.style.display='none'"
            />
          </div>
        ` : ''}
        <div class="card-title-group flex-1 min-w-0">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <h3 class="card-name">${escapeHtml(item.name)}</h3>
            <span class="badge-status ${badgeClass}" style="flex-shrink: 0;">
              ${badgeIcon} ${info.status}
            </span>
          </div>
          <span class="card-category">${escapeHtml(item.category)}</span>
        </div>
      </div>

      <div class="card-iodine-bar ${metricClass}">
        <span>📊 ${escapeHtml(info.metricLabel)}:</span>
        <span style="font-size: 0.78rem;">${escapeHtml(info.metricValue || info.note || '')}</span>
      </div>

      <p class="card-desc">${escapeHtml(item.dietaryStatus?.[activeDiet]?.note || item.generalDescription || item.description || info.note || '')}</p>

      ${swaps && swaps.length > 0 ? `
        <div class="card-substitutes-preview">
          <span>🔄 Pinoy Smart Swap:</span>
          <strong>${escapeHtml(swaps[0])}</strong>
        </div>
      ` : ''}
    </div>
  `;
}

function renderEmptyState(query) {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">🔍</span>
      <h3 class="empty-state-title">No exact matches for "${escapeHtml(query)}"</h3>
      <p class="empty-state-desc">
        Try checking different Pinoy food terms (e.g., <em>sayote</em>, <em>patis</em>, <em>isaw</em>, <em>munggo</em>), or switch to the <strong>Scanner tab</strong> to read full package labels!
      </p>
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
