// Safe Substitute Suggestions Component
import { SMART_SUBSTITUTES } from '../data/protocolRules.js';

export function renderSubstitutesTab(state) {
  const { subSearch = '' } = state;

  const filteredSubs = SMART_SUBSTITUTES.filter(s => {
    if (!subSearch.trim()) return true;
    const cleanQ = subSearch.toLowerCase().trim();
    return s.forbidden.toLowerCase().includes(cleanQ) || 
           s.substitute.toLowerCase().includes(cleanQ) || 
           s.culinaryTip.toLowerCase().includes(cleanQ);
  });

  return `
    <div class="substitutes-container">
      <div class="scanner-hero" style="text-align: left; padding: 20px 24px; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <span style="font-size: 1.8rem;">🔄</span>
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">Safe Culinary Substitutes</h2>
            <p style="font-size: 0.84rem; color: var(--text-secondary);">
              Swap high-iodine grocery staples with delicious, hospital-safe alternatives so you never feel deprived.
            </p>
          </div>
        </div>
      </div>

      <!-- Search Input -->
      <div class="search-box-wrapper" style="margin-bottom: 16px;">
        <svg class="search-icon-left" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          type="text" 
          id="sub-search-input" 
          class="search-input" 
          placeholder="Search food to replace (e.g. potatoes, soy sauce, eggs, salt, milk)..." 
          value="${escapeHtml(subSearch)}"
        />
      </div>

      <!-- Substitutes Grid -->
      <div class="substitutes-grid">
        ${filteredSubs.map(item => `
          <div class="substitute-card">
            <div class="substitute-comparison">
              <!-- Prohibited -->
              <div class="compare-box compare-avoid">
                <span class="compare-label">🔴 AVOID (High Iodine)</span>
                <div class="compare-name">${escapeHtml(item.forbidden)}</div>
                <div class="compare-risk">${escapeHtml(item.iodineRisk)}</div>
              </div>

              <!-- Safe Replacement -->
              <div class="compare-box compare-safe">
                <span class="compare-label">🟢 SAFE REPLACEMENT</span>
                <div class="compare-name">${escapeHtml(item.substitute)}</div>
                <div class="compare-risk" style="color: #34d399;">Hospital Protocol Compliant</div>
              </div>
            </div>

            <div class="culinary-tip-box">
              <div class="culinary-tip-title">👨‍🍳 Kitchen & Cooking Guide:</div>
              <div>${escapeHtml(item.culinaryTip)}</div>
            </div>
          </div>
        `).join('')}
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
