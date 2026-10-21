// Quick Search & Checker Tab Component (Offline First)
import { LID_CATEGORIES, STATUS } from '../data/lidDatabase.js';

export function renderCheckerTab(state) {
  const { searchQuery, statusFilter, categoryFilter, searchResults } = state;

  const quickTags = [
    'Potatoes',
    'Sayote',
    'Kosher Salt',
    'Soy Sauce',
    'Cow Milk',
    'Egg Whites',
    'Carrageenan',
    'Tuna',
    'Kalabasa',
    'Red Dye #3',
    'Commercial Bread',
    'Chicken Breast'
  ];

  const categories = Object.values(LID_CATEGORIES);

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
          placeholder="Search 100+ ingredients, brands, or additives (e.g. sayote, toyo, carrageenan)..." 
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

      <!-- Filters Row -->
      <div class="filters-bar">
        <button class="filter-btn ${statusFilter === 'ALL' ? 'active' : ''}" data-status="ALL">
          All Items
        </button>
        <button class="filter-btn ${statusFilter === STATUS.SAFE ? 'active' : ''}" data-status="${STATUS.SAFE}">
          🟢 Safe (${searchResults.filter(r => r.status === STATUS.SAFE).length})
        </button>
        <button class="filter-btn filter-avoid ${statusFilter === STATUS.AVOID ? 'active' : ''}" data-status="${STATUS.AVOID}">
          🔴 Avoid (${searchResults.filter(r => r.status === STATUS.AVOID).length})
        </button>
        <button class="filter-btn filter-caution ${statusFilter === STATUS.CAUTION ? 'active' : ''}" data-status="${STATUS.CAUTION}">
          🟡 Caution (${searchResults.filter(r => r.status === STATUS.CAUTION).length})
        </button>

        <select id="category-filter-select" class="category-select" aria-label="Filter by Category">
          <option value="ALL" ${categoryFilter === 'ALL' ? 'selected' : ''}>All Categories</option>
          ${categories.map(cat => `
            <option value="${escapeHtml(cat)}" ${categoryFilter === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>
          `).join('')}
        </select>
      </div>

      <!-- Search Results Grid -->
      <div class="results-grid" id="results-grid">
        ${searchResults.length > 0 ? searchResults.map(item => renderIngredientCard(item)).join('') : renderEmptyState(searchQuery)}
      </div>
    </div>
  `;
}

function renderIngredientCard(item) {
  const isSafe = item.status === STATUS.SAFE;
  const isAvoid = item.status === STATUS.AVOID;
  const isCaution = item.status === STATUS.CAUTION;

  let statusClass = 'status-safe';
  let badgeClass = 'badge-safe';
  let badgeIcon = '🟢';
  let iodineClass = 'iodine-safe';

  if (isAvoid) {
    statusClass = 'status-avoid';
    badgeClass = 'badge-avoid';
    badgeIcon = '🔴';
    iodineClass = 'iodine-high';
  } else if (isCaution) {
    statusClass = 'status-caution';
    badgeClass = 'badge-caution';
    badgeIcon = '🟡';
    iodineClass = 'iodine-warn';
  }

  return `
    <div class="ingredient-card ${statusClass}" data-item-id="${item.id}" role="button" tabindex="0">
      <div class="card-header">
        <div class="card-title-group">
          <h3 class="card-name">${escapeHtml(item.name)}</h3>
          <span class="card-category">${escapeHtml(item.category)}</span>
        </div>
        <span class="badge-status ${badgeClass}">
          ${badgeIcon} ${item.status}
        </span>
      </div>

      <div class="card-iodine-bar ${iodineClass}">
        <span>📊 Iodine:</span>
        <span>${escapeHtml(item.iodineContent)}</span>
      </div>

      <p class="card-desc">${escapeHtml(item.description)}</p>

      ${item.substitutes && item.substitutes.length > 0 ? `
        <div class="card-substitutes-preview">
          <span>🔄 Safe Swap:</span>
          <strong>${escapeHtml(item.substitutes[0])}</strong>
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
        Try checking different spellings, botanical names (e.g., <em>sayote</em> instead of squash), or switch to the <strong>Scanner tab</strong> to read full package labels!
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
