// Settings Modal Component (Multi-Diet Selector, Theme Switcher, Project Visibility, API Keys, Cloudinary, Local Cache & Disclaimer)
import { DIET_PROFILES } from '../data/dietProfiles.js';
import { isScannerEnabled } from '../services/storage.js';

export function renderSettingsModal(settings = {}, currentTheme = 'dark', showProjectTab = true, activeDiet = 'lid', scannerEnabled = null) {
  const isDark = currentTheme === 'dark';
  const isScannerActive = scannerEnabled !== null ? Boolean(scannerEnabled) : (settings.scannerEnabled !== undefined ? Boolean(settings.scannerEnabled) : isScannerEnabled());

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

          <!-- 2. Household Size (Portion Scaling) -->
          <div class="form-group" style="padding-top: 8px; border-top: 1px solid var(--border-color);">
            <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              <span class="text-base leading-none">👨‍👩‍👧‍👦</span>
              <span>Household Size Dynamic Scaling</span>
              <span class="settings-sub-badge" id="settings-household-badge">${settings.household_members || 4} Members</span>
            </div>
            <div class="form-help mb-2">
              Adjust recipe ingredients dynamically for your household (1–20 members).
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center gap-3 my-3">
              <!-- Modern Stepper Pill -->
              <div class="inline-flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700/80 rounded-full px-2 py-1.5 shadow-xs w-fit">
                <button 
                  type="button" 
                  id="settings-household-dec-btn"
                  class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="Decrease members"
                  aria-label="Decrease household members"
                  ${(settings.household_members || 4) <= 1 ? 'disabled' : ''}
                >
                  <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
                  </svg>
                </button>
                <div class="flex items-center gap-1.5 px-3 min-w-[7rem] justify-center select-none">
                  <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span id="settings-household-val" class="text-sm font-bold text-slate-800 dark:text-slate-100">
                    ${settings.household_members || 4} ${(settings.household_members || 4) === 1 ? 'Member' : 'Members'}
                  </span>
                </div>
                <button 
                  type="button" 
                  id="settings-household-inc-btn"
                  class="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-xs"
                  title="Increase members"
                  aria-label="Increase household members"
                  ${(settings.household_members || 4) >= 20 ? 'disabled' : ''}
                >
                  <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <input type="hidden" id="household-members-input" name="household_members" value="${settings.household_members || 4}" />
              </div>

              <!-- Quick Multiplier Context Badge -->
              <span id="settings-household-ratio" class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 w-fit">
                ${((settings.household_members || 4) / 4).toFixed(2)}x Recipe Ratio
              </span>
            </div>
          </div>

          <!-- 3. Interface Theme Switcher -->
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

          <!-- 4. Hardware & Performance: Camera & Food Scanner Toggle -->
          <div class="form-group settings-toggle-group" style="padding-top: 8px; border-top: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 14px;">
              <div style="flex: 1;">
                <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
                  <span class="text-base leading-none">📷</span>
                  <label for="settings-scanner-toggle" style="cursor: pointer; margin: 0; font-weight: 600;">Enable Camera & Food Scanner</label>
                  <span class="settings-sub-badge" id="settings-scanner-badge" style="color: ${isScannerActive ? 'var(--safe-green)' : 'var(--text-muted)'};">
                    ${isScannerActive ? 'Enabled' : 'Disabled (Default)'}
                  </span>
                </div>
                <div class="form-help" style="margin-top: 2px; font-size: 0.74rem;">
                  Enable image capture and food label scanning. Disabled by default to conserve device memory and battery.
                </div>
              </div>
              <label class="toggle-switch-wrapper" title="Toggle Food Scanner">
                <input type="checkbox" id="settings-scanner-toggle" ${isScannerActive ? 'checked' : ''} />
                <span class="toggle-switch-track"></span>
              </label>
            </div>
          </div>

          <!-- 5. Gemini AI Key -->
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
