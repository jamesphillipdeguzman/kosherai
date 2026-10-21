// Protocol Cheat Sheet Component (Complete Clinical Guidelines & E-Numbers Reference)
import { PROTOCOL_INFO, PROTOCOL_SECTIONS, ADDITIVES_REFERENCE } from '../data/protocolRules.js';

export function renderCheatSheetTab(state) {
  const { cheatSearch = '' } = state;

  const filteredSections = PROTOCOL_SECTIONS.map(sec => {
    if (!cheatSearch.trim()) return sec;
    const cleanQ = cheatSearch.toLowerCase().trim();
    const matchedItems = sec.items.filter(item => 
      item.title.toLowerCase().includes(cleanQ) || item.detail.toLowerCase().includes(cleanQ)
    );
    return { ...sec, items: matchedItems };
  }).filter(sec => sec.items.length > 0);

  const filteredAdditives = ADDITIVES_REFERENCE.filter(add => {
    if (!cheatSearch.trim()) return true;
    const cleanQ = cheatSearch.toLowerCase().trim();
    return add.code.toLowerCase().includes(cleanQ) || 
           add.name.toLowerCase().includes(cleanQ) || 
           add.reason.toLowerCase().includes(cleanQ);
  });

  return `
    <div class="protocol-container">
      <!-- Protocol Overview Header Card -->
      <div class="protocol-header-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
          <h2 class="protocol-title">${PROTOCOL_INFO.title}</h2>
          <button id="print-protocol-btn" class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">
            🖨️ Print Protocol
          </button>
        </div>

        <p class="protocol-subtitle">
          Official nuclear medicine dietary guidelines for thyroid cancer and hyperthyroidism preparation prior to I-131 Radioactive Iodine therapy.
        </p>

        <div class="protocol-stats-row">
          <div class="stat-box">
            <div class="stat-label">Daily Iodine Ceiling</div>
            <div class="stat-value">&lt; 50 mcg / day</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Dietary Duration</div>
            <div class="stat-value">14 Days</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Primary Salt Permitted</div>
            <div class="stat-value" style="font-size: 0.95rem;">Pure Kosher Salt</div>
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

      <!-- Protocol Sections (Forbidden / Allowed / Caution) -->
      ${filteredSections.map(sec => `
        <div class="protocol-section">
          <div class="section-header">
            <div class="section-title-wrap">
              <span class="section-icon-dot ${sec.id === 'forbidden' ? 'dot-forbidden' : sec.id === 'allowed' ? 'dot-allowed' : 'dot-caution'}"></span>
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(sec.title)}</h3>
                <span style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(sec.subtitle)}</span>
              </div>
            </div>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${sec.items.length} items</span>
          </div>

          <div>
            ${sec.items.map(item => `
              <div class="protocol-item-row">
                <div class="item-row-title">${escapeHtml(item.title)}</div>
                <div class="item-row-detail">${escapeHtml(item.detail)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}

      <!-- Additives & E-Numbers Reference Card -->
      <div class="protocol-section">
        <div class="section-header" style="background: var(--bg-card-subtle);">
          <div class="section-title-wrap">
            <span style="font-size: 1.2rem;">🧪</span>
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">Food Additives & E-Numbers Reference</h3>
              <span style="font-size: 0.78rem; color: var(--text-muted);">Watch list for industrial thickeners, stabilizers, conditioners, and dyes</span>
            </div>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="additives-table">
            <thead>
              <tr>
                <th>Code / E-Number</th>
                <th>Additive Name</th>
                <th>Status</th>
                <th>Medical Risk</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAdditives.map(add => `
                <tr>
                  <td><span class="code-badge">${escapeHtml(add.code)}</span></td>
                  <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(add.name)}</td>
                  <td>
                    <span class="badge-status ${add.status === 'SAFE' ? 'badge-safe' : 'badge-avoid'}">
                      ${add.status === 'SAFE' ? '🟢 SAFE' : '🔴 AVOID'}
                    </span>
                  </td>
                  <td>${escapeHtml(add.reason)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Dining Out Survival Guide -->
      <div class="protocol-header-card" style="border-left: 4px solid var(--avoid-red);">
        <h3 style="font-size: 1.1rem; font-weight: 800; color: #f87171; margin-bottom: 8px;">
          ⚠️ Dining Out & Restaurant Warning
        </h3>
        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
          Commercial restaurants and caterers almost universally use iodized table salt, commercial bouillon powders, salted butter, and seafood bases. 
          <strong>Dining out is the #1 documented cause of unintentional Low-Iodine Diet failure.</strong>
        </p>
        <div style="background: var(--bg-card-subtle); padding: 12px 16px; border-radius: var(--radius-md); font-size: 0.82rem; color: var(--text-secondary);">
          💡 <strong>Safe Travel Advice:</strong> Prepare fresh chicken, boiled rice, sayote stir-fries, and sliced apples ahead of time in leakproof containers. If you must order at a restaurant, request completely unseasoned, unmarinated grilled beef or chicken cooked with clean dry heat, steamed white rice, and bring your own small jar of pure non-iodized kosher salt.
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
