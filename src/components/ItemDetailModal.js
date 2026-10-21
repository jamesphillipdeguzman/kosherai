// Item Detail Modal Component (Deep Clinical Rationale & Substitutes)
import { STATUS } from '../data/lidDatabase.js';

export function renderItemDetailModal(item) {
  const isSafe = item.status === STATUS.SAFE;
  const isAvoid = item.status === STATUS.AVOID;

  return `
    <div class="modal-overlay" id="item-modal-overlay">
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="item-modal-title">
        <div class="modal-header">
          <div>
            <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;">
              ${escapeHtml(item.category)}
            </span>
            <h2 id="item-modal-title" class="modal-title" style="margin-top: 2px;">${escapeHtml(item.name)}</h2>
          </div>
          <button class="btn-icon" id="item-modal-close-btn" aria-label="Close">✕</button>
        </div>

        <!-- Big Status Indicator -->
        <div class="result-banner ${isSafe ? 'banner-safe' : isAvoid ? 'banner-avoid' : 'banner-caution'}" style="margin-bottom: 16px;">
          <div class="banner-status-icon">${isSafe ? '🟢' : isAvoid ? '🔴' : '🟡'}</div>
          <div>
            <div class="banner-headline">${item.status === 'SAFE' ? 'PERMITTED ON PROTOCOL' : item.status === 'AVOID' ? 'STRICTLY FORBIDDEN' : 'CHECK LABEL FIRST'}</div>
            <div class="banner-sub" style="font-family: var(--font-mono); font-weight: 700;">Iodine Impact: ${escapeHtml(item.iodineContent)}</div>
          </div>
        </div>

        <!-- Description -->
        <div style="margin-bottom: 14px;">
          <h4 style="font-size: 0.82rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">
            Overview
          </h4>
          <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
            ${escapeHtml(item.description)}
          </p>
        </div>

        <!-- Clinical Rationale -->
        <div style="background: var(--bg-card-subtle); border-left: 3px solid ${isSafe ? 'var(--safe-green)' : 'var(--avoid-red)'}; padding: 12px 16px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-bottom: 16px;">
          <h4 style="font-size: 0.82rem; font-weight: 800; text-transform: uppercase; color: ${isSafe ? '#34d399' : '#f87171'}; margin-bottom: 4px;">
            Clinical Nuclear Medicine Note
          </h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
            ${escapeHtml(item.clinicalNotes)}
          </p>
        </div>

        <!-- Known Aliases / Regional Terms -->
        ${item.aliases && item.aliases.length > 0 ? `
          <div style="margin-bottom: 16px;">
            <h4 style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
              Also Known As / Package Aliases:
            </h4>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${item.aliases.map(a => `
                <span class="quick-tag-chip" style="font-size: 0.75rem; cursor: default;">${escapeHtml(a)}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Safe Substitutes if Avoided -->
        ${item.substitutes && item.substitutes.length > 0 ? `
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid var(--safe-border); border-radius: var(--radius-md); padding: 14px; margin-bottom: 18px;">
            <h4 style="font-size: 0.82rem; font-weight: 800; color: #34d399; margin-bottom: 6px;">
              🔄 Safe Replacements:
            </h4>
            <ul style="padding-left: 18px; font-size: 0.85rem; color: var(--text-primary);">
              ${item.substitutes.map(sub => `<li>${escapeHtml(sub)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: flex-end;">
          <button class="btn-primary" id="item-modal-done-btn" style="padding: 10px 24px;">Got It</button>
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
