// Protocol & Clinical Guidelines Component
// Dynamically renders clinical targets, guidelines, prohibited foods, permitted guidelines, and search filters across all 5 protocols.

import { PROTOCOL_GUIDELINES, getProtocolGuidelines, normalizeDietProtocolKey, DEFAULT_LID_ADDITIVES } from '../data/protocolGuidelines.js';
import { ADDITIVES_REFERENCE } from '../data/protocolRules.js';

export { PROTOCOL_GUIDELINES, getProtocolGuidelines, normalizeDietProtocolKey, DEFAULT_LID_ADDITIVES };

export function renderProtocolTab(state = {}) {
  const { 
    cheatSearch = '', 
    activeDiet = 'lid' 
  } = state;

  const protocol = getProtocolGuidelines(activeDiet);
  const cleanQ = (cheatSearch || '').toLowerCase().trim();

  // Filter prohibited items based on search input
  const prohibitedItems = protocol.prohibited || [];
  const filteredProhibited = prohibitedItems.filter(item => {
    if (!cleanQ) return true;
    const name = (item.name || item.title || '').toLowerCase();
    const desc = (item.desc || item.detail || '').toLowerCase();
    return name.includes(cleanQ) || desc.includes(cleanQ);
  });

  // Filter permitted items based on search input
  const permittedItems = protocol.permitted || [];
  const filteredPermitted = permittedItems.filter(item => {
    if (!cleanQ) return true;
    const name = (item.name || item.title || '').toLowerCase();
    const desc = (item.desc || item.detail || '').toLowerCase();
    return name.includes(cleanQ) || desc.includes(cleanQ);
  });

  // Filter additives reference reactively based on active diet protocol and search input
  const currentAdditives = protocol.additives || DEFAULT_LID_ADDITIVES;
  const filteredAdditives = currentAdditives.filter(add => {
    if (!cleanQ) return true;
    return (add.code || '').toLowerCase().includes(cleanQ) || 
           (add.name || '').toLowerCase().includes(cleanQ) || 
           (add.reason || add.rationale || '').toLowerCase().includes(cleanQ);
  });

  const diningWarning = protocol.diningWarning || {
    title: 'Dining Out & Restaurant Warning',
    text: 'Commercial dining and carinderias often introduce hidden seasonings and non-compliant ingredients.',
    advice: 'Prepare home-cooked staples ahead of time whenever possible and communicate dietary restrictions clearly.'
  };

  return `
    <div class="protocol-container">
      <!-- Protocol Overview Header Card -->
      <div class="protocol-header-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
          <h2 class="protocol-title" id="protocol-title-heading">${escapeHtml(protocol.name)}</h2>
          <button id="print-protocol-btn" class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">
            🖨️ Print Protocol
          </button>
        </div>

        <p class="protocol-subtitle">
          ${escapeHtml(protocol.rationale)}
        </p>

        <div class="protocol-stats-row">
          <div class="stat-box">
            <div class="stat-label">Daily Target</div>
            <div class="stat-value" id="protocol-daily-target">${escapeHtml(protocol.dailyTarget)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Protocol Duration</div>
            <div class="stat-value" id="protocol-duration">${escapeHtml(protocol.duration)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Permitted Seasoning</div>
            <div class="stat-value" id="protocol-permitted-seasoning" style="font-size: 0.95rem;">${escapeHtml(protocol.permittedSeasoning)}</div>
          </div>
        </div>
      </div>

      <!-- Quick Search Inside Protocol -->
      <div class="search-box-wrapper" style="margin-bottom: 8px;">
        <svg class="search-icon-left" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          type="text" 
          id="cheat-search-input" 
          class="search-input" 
          style="padding: 12px 16px 12px 46px; font-size: 0.9rem;" 
          placeholder="Filter clinical guidelines (e.g. potato, bread, dairy, restaurant, E407)..." 
          value="${escapeHtml(cheatSearch)}"
        />
      </div>

      <!-- Strictly Prohibited Section (AVOID 🔴) -->
      <div class="protocol-section" id="protocol-prohibited-section">
        <div class="section-header">
          <div class="section-title-wrap">
            <span class="section-icon-dot dot-forbidden"></span>
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">Strictly Prohibited (AVOID 🔴)</h3>
              <span style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(protocol.prohibitedSubtitle)}</span>
            </div>
          </div>
          <span class="prohibited-count-badge" style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${filteredProhibited.length} items</span>
        </div>

        <div class="prohibited-items-list">
          ${filteredProhibited.length > 0 ? filteredProhibited.map(item => `
            <div class="protocol-item-row">
              <div class="item-row-title">${escapeHtml(item.name || item.title)}</div>
              <div class="item-row-detail">${escapeHtml(item.desc || item.detail)}</div>
            </div>
          `).join('') : `
            <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
              No prohibited guidelines match "${escapeHtml(cheatSearch)}".
            </div>
          `}
        </div>
      </div>

      <!-- Strictly Permitted Section (SAFE 🟢) -->
      <div class="protocol-section" id="protocol-permitted-section">
        <div class="section-header">
          <div class="section-title-wrap">
            <span class="section-icon-dot dot-allowed"></span>
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">Strictly Permitted (SAFE 🟢)</h3>
              <span style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(protocol.permittedSubtitle || 'Allowed nutritious foods and permitted staples')}</span>
            </div>
          </div>
          <span class="permitted-count-badge" style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${filteredPermitted.length} items</span>
        </div>

        <div class="permitted-items-list">
          ${filteredPermitted.length > 0 ? filteredPermitted.map(item => `
            <div class="protocol-item-row">
              <div class="item-row-title">${escapeHtml(item.name || item.title)}</div>
              <div class="item-row-detail">${escapeHtml(item.desc || item.detail)}</div>
            </div>
          `).join('') : `
            <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
              No permitted guidelines match "${escapeHtml(cheatSearch)}".
            </div>
          `}
        </div>
      </div>

      <!-- Additives & Watch List Reference Card -->
      <div class="protocol-section">
        <div class="section-header" style="background: var(--bg-card-subtle);">
          <div class="section-title-wrap">
            <span style="font-size: 1.2rem;">🧪</span>
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">Food Additives & E-Numbers Reference</h3>
              <span style="font-size: 0.78rem; color: var(--text-muted);">Watch list for industrial thickeners, stabilizers, conditioners, and flavor enhancers</span>
            </div>
          </div>
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${filteredAdditives.length} items</span>
        </div>

        <div style="overflow-x: auto;">
          <table class="additives-table">
            <thead>
              <tr>
                <th>Code / E-Number</th>
                <th>Additive Name</th>
                <th>Status</th>
                <th>Clinical Rationale</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAdditives.length > 0 ? filteredAdditives.map(add => `
                <tr>
                  <td><span class="code-badge">${escapeHtml(add.code)}</span></td>
                  <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(add.name)}</td>
                  <td>
                    <span class="badge-status ${add.status === 'SAFE' ? 'badge-safe' : add.status === 'CAUTION' ? 'badge-caution' : 'badge-avoid'}">
                      ${add.status === 'SAFE' ? '🟢 SAFE' : add.status === 'CAUTION' ? '🟡 CAUTION' : '🔴 AVOID'}
                    </span>
                  </td>
                  <td style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(add.reason || add.rationale || '')}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="4" style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                    No additives match "${escapeHtml(cheatSearch)}".
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Dining Out Survival Guide (Reactive to Active Diet) -->
      <div class="protocol-header-card" style="border-left: 4px solid var(--avoid-red);">
        <h3 style="font-size: 1.1rem; font-weight: 800; color: #f87171; margin-bottom: 8px;">
          ⚠️ ${escapeHtml(diningWarning.title)}
        </h3>
        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
          ${escapeHtml(diningWarning.text)}
        </p>
        <div style="background: var(--bg-card-subtle); padding: 12px 16px; border-radius: var(--radius-md); font-size: 0.82rem; color: var(--text-secondary);">
          💡 <strong>Safe Dining Advice:</strong> ${escapeHtml(diningWarning.advice)}
        </div>
      </div>
    </div>
  `;
}

// Alias renderCheatSheetTab to renderProtocolTab for complete drop-in compatibility
export const renderCheatSheetTab = renderProtocolTab;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
