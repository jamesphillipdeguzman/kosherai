// App Header Component with Connectivity Status & Settings Trigger

export function renderHeader(isOnline = navigator.onLine, appMode = 'diet', showProjectTab = true) {
  return `
    <header class="app-header">
      <div class="brand-wrapper bg-slate-200/60 dark:bg-slate-800/60 backdrop-blur-sm px-2.5 py-1 rounded-xl border border-slate-300/40 dark:border-slate-700/50" id="brand-logo-btn">
        <img src="/favicon.svg" alt="KosherAI Logo" class="brand-icon" />
        <div>
          <div class="brand-title text-slate-900 dark:text-white font-extrabold tracking-tight">
            KosherAI
            <span class="brand-badge">${appMode === 'course' ? 'SUSTAIN' : 'LID RAI'}</span>
          </div>
          <div class="brand-subtitle text-slate-600 dark:text-slate-400">${appMode === 'course' ? 'Six-Week Food Cost & Waste Study' : 'Low-Iodine Diet Clinical Companion'}</div>
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
      <!-- Main Application Mode Switcher (Conditionally rendered when showProjectTab is true) -->
      ${showProjectTab ? `
        <div class="mode-switcher-bar" role="tablist" aria-label="Application View Mode">
          <button class="mode-tab-btn ${appMode === 'diet' ? 'active' : ''}" data-app-mode="diet" role="tab" aria-selected="${appMode === 'diet'}">
            🛡️ LID Diet Protocol
          </button>
          <button class="mode-tab-btn course-mode ${appMode === 'course' ? 'active' : ''}" data-app-mode="course" role="tab" aria-selected="${appMode === 'course'}">
            📊 6-Week Project (Oct 31)
          </button>
        </div>
      ` : ''}

      ${appMode === 'diet' ? `
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
      ` : ''}
    </div>
  `;
}
