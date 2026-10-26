// Settings Modal Component (Multi-Diet Selector, Theme Switcher, Project Visibility, API Keys, Cloudinary, Local Cache & Disclaimer)
import { DIET_PROFILES } from '../data/dietProfiles.js';

export function renderSettingsModal(settings = {}, currentTheme = 'dark', showProjectTab = true, activeDiet = 'lid') {
  const isDark = currentTheme === 'dark';

  return `
    <div class="modal-overlay" id="settings-modal-overlay">
      <div class="modal-content settings-modal-box" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="modal-header">
          <div>
            <h2 id="settings-title" class="modal-title">Settings & Preferences</h2>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
              Diet profile, theme, project visibility, and clinical AI configurations.
            </div>
          </div>
          <button class="btn-icon" id="settings-close-btn" aria-label="Close Settings">✕</button>
        </div>

        <form id="settings-form">
          <!-- 1. Dietary Protocol Profile Selector (LID Default) -->
          <div class="form-group">
            <label class="form-label" for="settings-diet-select">
              <span>Active Dietary Protocol</span>
              <span class="settings-sub-badge" style="color: var(--safe-green);">Default: LID</span>
            </label>
            <select id="settings-diet-select" class="form-input bg-teal-950/40 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-teal-500/30 rounded-xl px-3 py-1.5 focus:outline-none" style="cursor: pointer; font-weight: 600; font-size: 0.88rem; padding: 10px 14px;">
              ${Object.values(DIET_PROFILES).map(profile => `
                <option value="${profile.id}" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1.5" ${profile.id === activeDiet ? 'selected' : ''}>
                  ${profile.icon} ${profile.name} — ${profile.target}
                </option>
              `).join('')}
            </select>
            <div class="form-help">
              Tailors ingredient safety badges, smart substitutes, and Gemini receipt verification.
            </div>
          </div>

          <!-- 2. Interface Theme Switcher -->
          <div class="form-group" style="padding-top: 8px; border-top: 1px solid var(--border-color);">
            <label class="form-label">
              <span>Interface Theme</span>
              <span class="settings-sub-badge">${isDark ? '🌙 Dark Mode Active' : '☀️ Light Mode Active'}</span>
            </label>
            <div class="theme-segmented-control" role="radiogroup" aria-label="Theme selection">
              <button 
                type="button" 
                class="theme-segment-btn ${isDark ? 'active' : ''}" 
                data-theme-val="dark" 
                role="radio" 
                aria-checked="${isDark}"
              >
                <span class="theme-segment-icon">🌙</span>
                <span>Dark Mode</span>
              </button>
              <button 
                type="button" 
                class="theme-segment-btn ${!isDark ? 'active' : ''}" 
                data-theme-val="light" 
                role="radio" 
                aria-checked="${!isDark}"
              >
                <span class="theme-segment-icon">☀️</span>
                <span>Light Mode</span>
              </button>
            </div>
            <div class="form-help">
              Tailors colors between deep space navy and clean daylight slate with ambient aura gradients.
            </div>
          </div>

          <!-- 3. Project Tab Visibility Switch -->
          <div class="form-group settings-toggle-group">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 14px;">
              <div style="flex: 1;">
                <label class="form-label" for="toggle-project-tab-input" style="margin-bottom: 2px; cursor: pointer;">
                  Show Sustaining Human Life (6-Week Project)
                </label>
                <div class="form-help" style="margin-top: 2px; font-size: 0.74rem;">
                  Displays the academic research study dashboard, receipt scanner, and food waste logger.
                </div>
              </div>
              <label class="toggle-switch-wrapper" title="Toggle 6-Week Project Tab">
                <input type="checkbox" id="toggle-project-tab-input" ${showProjectTab ? 'checked' : ''} />
                <span class="toggle-switch-track"></span>
              </label>
            </div>
          </div>

          <!-- 4. Gemini AI Key -->
          <div class="form-group" style="padding-top: 8px; border-top: 1px solid var(--border-color);">
            <label class="form-label" for="gemini-key-input">
              <span>Google Gemini API Key</span>
              <span style="color: var(--safe-green); font-size: 0.75rem;">(Optional - For Deep AI Label Analysis)</span>
            </label>
            <input 
              type="password" 
              id="gemini-key-input" 
              class="form-input" 
              placeholder="AIzaSy..." 
              value="${escapeHtml(settings.geminiApiKey || '')}"
              autocomplete="off"
            />
            <div class="form-help">
              Enables online multi-ingredient reasoning for complex overseas labels. 
              Get a free API key at <a href="https://aistudio.google.com/" target="_blank" rel="noopener" style="color: #34d399;">Google AI Studio</a>.
            </div>
          </div>

          <!-- 5. Cloudinary Settings (Optional) -->
          <div class="form-group">
            <label class="form-label">
              <span>Cloudinary Storage</span>
              <span style="color: var(--text-muted); font-size: 0.75rem;">(Optional - Packaging Archive)</span>
            </label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <input 
                type="text" 
                id="cloudinary-name-input" 
                class="form-input" 
                placeholder="Cloud Name" 
                value="${escapeHtml(settings.cloudinaryCloudName || '')}" 
              />
              <input 
                type="text" 
                id="cloudinary-preset-input" 
                class="form-input" 
                placeholder="Upload Preset" 
                value="${escapeHtml(settings.cloudinaryPreset || '')}" 
              />
            </div>
            <div class="form-help">Saves scanned grocery photos to your personal Cloudinary cloud.</div>
          </div>

          <!-- 6. Target Date -->
          <div class="form-group">
            <label class="form-label" for="prep-date-input">
              <span>Target RAI Treatment Date</span>
            </label>
            <input 
              type="date" 
              id="prep-date-input" 
              class="form-input" 
              value="${escapeHtml(settings.prepDate || '')}"
            />
          </div>

          <!-- 7. Offline Storage Stats & Reset -->
          <div class="form-group" style="padding-top: 8px; border-top: 1px solid var(--border-color);">
            <label class="form-label">Offline Data & Storage</label>
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card-subtle); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.82rem;">
              <span>Local Clinical Cache: <strong>Active (100+ items)</strong></span>
              <button type="button" id="clear-all-data-btn" style="color: #f87171; background: none; border: none; cursor: pointer; text-decoration: underline;">
                Reset Data
              </button>
            </div>
          </div>

          <!-- 8. Clinical Disclaimer -->
          <div class="settings-disclaimer-box">
            ⚠️ <strong>Medical Protocol Notice:</strong> KosherAI is an educational clinical companion. Always follow the specific timeline and orders of your attending physician or registered dietitian.
          </div>

          <!-- Action Buttons -->
          <div class="settings-footer-actions">
            <button type="button" class="btn-secondary" id="settings-cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save Settings</button>
          </div>
        </form>
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
