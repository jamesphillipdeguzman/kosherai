// Settings Modal Component (API Keys, Cloudinary, Local Cache & Disclaimer)

export function renderSettingsModal(settings) {
  return `
    <div class="modal-overlay" id="settings-modal-overlay">
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="modal-header">
          <h2 id="settings-title" class="modal-title">Settings & Configuration</h2>
          <button class="btn-icon" id="settings-close-btn" aria-label="Close Settings">✕</button>
        </div>

        <form id="settings-form">
          <!-- Gemini AI Key -->
          <div class="form-group">
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

          <!-- Cloudinary Settings (Optional) -->
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

          <!-- Daily Target -->
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

          <!-- Offline Storage Stats & Reset -->
          <div class="form-group" style="padding-top: 10px; border-top: 1px solid var(--border-color);">
            <label class="form-label">Offline Data & Storage</label>
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card-subtle); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.82rem;">
              <span>Local Clinical Cache: <strong>Active (100+ items)</strong></span>
              <button type="button" id="clear-all-data-btn" style="color: #f87171; background: none; border: none; cursor: pointer; text-decoration: underline;">
                Reset Data
              </button>
            </div>
          </div>

          <!-- Clinical Disclaimer -->
          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 16px;">
            ⚠️ <strong>Medical Protocol Notice:</strong> KosherAI is an educational clinical companion. Always follow the specific timeline and orders of your attending nuclear medicine physician.
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
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
