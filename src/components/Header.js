// App Header Component with Connectivity Status & Settings Trigger

export function renderHeader(isOnline = navigator.onLine) {
  return `
    <header class="app-header">
      <div class="brand-wrapper" id="brand-logo-btn">
        <img src="/favicon.svg" alt="KosherAI Logo" class="brand-icon" />
        <div>
          <div class="brand-title">
            KosherAI
            <span class="brand-badge">LID RAI</span>
          </div>
          <div class="brand-subtitle">Low-Iodine Diet Clinical Companion</div>
        </div>
      </div>

      <div class="header-actions">
        <div class="status-pill" title="${isOnline ? 'Online - AI Verification Available' : 'Offline Mode - Local Database Active'}">
          <span class="status-dot ${isOnline ? '' : 'offline'}"></span>
          <span>${isOnline ? 'Offline-Ready' : 'Offline Active'}</span>
        </div>

        <button class="btn-icon" id="settings-open-btn" title="App & API Settings" aria-label="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </header>

    <div class="app-container" style="padding-top: 12px; padding-bottom: 0;">
      <div class="protocol-banner">
        <div class="banner-content">
          <span class="banner-icon">🛡️</span>
          <div>
            <div class="banner-title">Clinical Target: &lt;50 mcg Iodine/Day</div>
            <div class="banner-desc">Deplete thyroid iodine reserves prior to Radioactive Iodine ablation.</div>
          </div>
        </div>
        <div class="banner-target">Strict LID</div>
      </div>
    </div>
  `;
}
