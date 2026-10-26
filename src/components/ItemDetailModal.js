// Item Detail Modal Component (Multi-Diet Clinical Guidance & Pinoy Smart Swaps)
import { STATUS, getItemDietaryInfo } from '../data/lidDatabase.js';
import { getDietProfile } from '../data/dietProfiles.js';

export function renderItemDetailModal(item, activeDiet = 'lid') {
  const info = getItemDietaryInfo(item, activeDiet);
  const profile = getDietProfile(activeDiet);

  const isSafe = info.status === STATUS.SAFE;
  const isAvoid = info.status === STATUS.AVOID;
  const isCaution = info.status === STATUS.CAUTION;

  const swaps = info.substitutes || [];

  return `
    <div class="modal-overlay" id="item-modal-overlay">
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="item-modal-title">
        <div class="modal-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;">
                ${escapeHtml(item.category)}
              </span>
              <span class="diet-tag-pill" style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; background: rgba(13, 148, 136, 0.15); color: #0d9488; font-weight: 700;">
                ${profile.icon} ${escapeHtml(profile.shortName)}
              </span>
            </div>
            <h2 id="item-modal-title" class="modal-title" style="margin-top: 4px;">${escapeHtml(item.name)}</h2>
          </div>
          <button class="btn-icon" id="item-modal-close-btn" aria-label="Close">✕</button>
        </div>

        <!-- Big Status Indicator Tailored to Active Diet -->
        <div class="result-banner ${isSafe ? 'banner-safe' : isAvoid ? 'banner-avoid' : 'banner-caution'}" style="margin-bottom: 16px;">
          <div class="banner-status-icon">${isSafe ? '🟢' : isAvoid ? '🔴' : '🟡'}</div>
          <div>
            <div class="banner-headline">
              ${isSafe ? `PERMITTED ON ${profile.badge}` : isAvoid ? `STRICTLY AVOID ON ${profile.badge}` : `USE CAUTION ON ${profile.badge}`}
            </div>
            <div class="banner-sub" style="font-family: var(--font-mono); font-weight: 700;">
              ${escapeHtml(info.metricLabel)}: ${escapeHtml(info.metricValue || info.note || '')}
            </div>
          </div>
        </div>

        <!-- Overview Description -->
        <div style="margin-bottom: 14px;">
          <h4 style="font-size: 0.82rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">
            Overview
          </h4>
          <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
            ${escapeHtml(item.description)}
          </p>
        </div>

        <!-- Active Diet Clinical Guidance -->
        <div style="background: var(--bg-card-subtle); border-left: 3px solid ${isSafe ? 'var(--safe-green)' : isAvoid ? 'var(--avoid-red)' : 'var(--caution-yellow)'}; padding: 12px 16px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-bottom: 16px;">
          <h4 style="font-size: 0.82rem; font-weight: 800; text-transform: uppercase; color: ${isSafe ? '#34d399' : isAvoid ? '#f87171' : '#fbbf24'}; margin-bottom: 4px;">
            ${profile.icon} ${escapeHtml(profile.name)} Guidance
          </h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
            ${escapeHtml(info.note || item.clinicalNotes || '')}
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

        <!-- Pinoy Smart Swaps for Avoid / Caution -->
        ${swaps && swaps.length > 0 ? `
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid var(--safe-border); border-radius: var(--radius-md); padding: 14px; margin-bottom: 18px;">
            <h4 style="font-size: 0.82rem; font-weight: 800; color: #34d399; margin-bottom: 6px;">
              🔄 Pinoy Smart Replacements (${escapeHtml(profile.shortName)}):
            </h4>
            <ul style="padding-left: 18px; font-size: 0.85rem; color: var(--text-primary); line-height: 1.45;">
              ${swaps.map(sub => `<li>${escapeHtml(sub)}</li>`).join('')}
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
