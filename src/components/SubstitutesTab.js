// Safe Substitute Suggestions Component
import { SMART_SUBSTITUTES_BY_DIET, SMART_SUBSTITUTES } from '../data/protocolRules.js';
import { getDietProfile } from '../data/dietProfiles.js';

export function renderSubstitutesTab(state) {
  const { subSearch = '', activeDiet = 'lid' } = state;
  const currentProfile = getDietProfile(activeDiet);
  const rawSubs = SMART_SUBSTITUTES_BY_DIET[activeDiet] || SMART_SUBSTITUTES_BY_DIET.lid || SMART_SUBSTITUTES;

  const getAvoidBadge = (dietKey) => {
    switch (dietKey) {
      case 'pinoy_keto': return 'AVOID (High Carbs)';
      case 'low_purine': return 'AVOID (High Purine)';
      case 'low_sodium': return 'AVOID (High Sodium)';
      case 'diabetic': return 'AVOID (High Glycemic)';
      case 'lid':
      default:
        return 'AVOID (High Iodine)';
    }
  };
  const avoidLabel = getAvoidBadge(activeDiet);

  const filteredSubs = rawSubs.filter(s => {
    if (!subSearch.trim()) return true;
    const cleanQ = subSearch.toLowerCase().trim();
    return s.forbidden.toLowerCase().includes(cleanQ) || 
           s.substitute.toLowerCase().includes(cleanQ) || 
           (s.risk && s.risk.toLowerCase().includes(cleanQ)) ||
           (s.iodineRisk && s.iodineRisk.toLowerCase().includes(cleanQ)) ||
           s.culinaryTip.toLowerCase().includes(cleanQ);
  });

  return `
    <div class="substitutes-container">
      <div class="rounded-2xl p-6 bg-slate-900 text-white shadow-lg border border-slate-800" style="text-align: left; padding: 20px 24px; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <span style="font-size: 1.8rem;">🔄</span>
          <div>
            <h2 class="text-white font-bold" style="font-size: 1.25rem;">Safe Culinary Substitutes</h2>
            <p class="text-slate-200" style="font-size: 0.84rem;">
              ${escapeHtml(currentProfile.swapTip || 'Swap risky grocery staples with delicious, compliant alternatives so you never feel deprived.')}
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
          placeholder="Search food to replace (e.g. rice, soy sauce, eggs, salt, milk)..." 
          value="${escapeHtml(subSearch)}"
        />
      </div>

      <!-- Substitutes Grid -->
      <div class="substitutes-grid">
        ${filteredSubs.map(item => `
          <div class="substitute-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-5">
            <div class="substitute-comparison">
              <!-- Prohibited -->
              <div class="compare-box compare-avoid rounded-xl p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
                <span class="compare-label font-bold text-red-600 dark:text-red-400 text-xs">🔴 ${escapeHtml(avoidLabel)}</span>
                <div class="compare-name text-slate-900 dark:text-white font-bold text-base mt-1">${escapeHtml(item.forbidden)}</div>
                <div class="compare-risk text-slate-700 dark:text-slate-200 text-xs mt-1 leading-relaxed">${escapeHtml(item.risk || item.iodineRisk)}</div>
              </div>

              <!-- Safe Replacement -->
              <div class="compare-box compare-safe rounded-xl p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                <span class="compare-label font-bold text-emerald-600 dark:text-emerald-400 text-xs">🟢 SAFE REPLACEMENT</span>
                <div class="compare-name text-slate-900 dark:text-white font-bold text-base mt-1">${escapeHtml(item.substitute)}</div>
                <div class="compare-risk text-emerald-700 dark:text-emerald-300 font-semibold text-xs mt-1">${escapeHtml(currentProfile.shortName)} Compliant</div>
              </div>
            </div>

            <div class="culinary-tip-box rounded-xl p-3.5 bg-slate-50 dark:bg-slate-800/60 border-l-4 border-emerald-500 text-slate-700 dark:text-slate-200 text-xs leading-relaxed mt-2">
              <div class="culinary-tip-title font-bold text-emerald-600 dark:text-emerald-400 mb-1">👨‍🍳 Kitchen & Cooking Guide:</div>
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
