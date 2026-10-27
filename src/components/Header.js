// App Header Component with Multi-Diet Selector, Connectivity Status & Settings Trigger
import { DIET_PROFILES, getDietProfile } from '../data/dietProfiles.js';

export function renderHeader(isOnline = navigator.onLine, appMode = 'diet', showProjectTab = true, activeDiet = 'lid', theme = 'dark') {
  const currentProfile = getDietProfile(activeDiet);

  return `
    <header class="app-header">
      <div class="brand-wrapper inline-flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60 shadow-sm backdrop-blur-md" id="brand-logo-btn">
        <img src="/favicon.svg" alt="KosherAI Logo" class="brand-icon" />
        <div>
          <div class="brand-title text-slate-900 dark:text-white font-black text-xl tracking-tight">
            KosherAI
            <span class="brand-badge">${appMode === 'course' ? 'SUSTAIN' : currentProfile.badge}</span>
          </div>
          <div class="brand-subtitle text-slate-600 dark:text-slate-400 text-xs font-medium">${appMode === 'course' ? 'Six-Week Food Cost & Waste Study' : currentProfile.name}</div>
        </div>
      </div>

      <div class="header-actions">
        <!-- Multi-Diet Profile Selector Dropdown (LID Default) -->
        <div class="header-diet-picker-wrap" title="Active Dietary Protocol">
          <label for="header-diet-selector" class="sr-only">Select Diet Protocol</label>
          <div class="diet-select-badge">
            <span class="diet-select-icon mr-1.5">${currentProfile.emoji || currentProfile.icon}</span>
            <select id="header-diet-selector" class="header-diet-dropdown bg-teal-950/40 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-teal-500/30 rounded-xl px-3 py-1.5 focus:outline-none" aria-label="Select Dietary Protocol">
              ${Object.values(DIET_PROFILES).map(profile => `
                <option value="${profile.id}" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1.5" ${profile.id === activeDiet ? 'selected' : ''}>
                  ${profile.label || profile.name}
                </option>
              `).join('')}
            </select>
            <span class="diet-select-chevron">▾</span>
          </div>
        </div>

        <div class="status-pill hidden sm:inline-flex" title="${isOnline ? 'Online - AI Verification Available' : 'Offline Mode - Local Database Active'}">
          <span class="status-dot ${isOnline ? '' : 'offline'}"></span>
          <span>${isOnline ? 'Offline-Ready' : 'Offline Active'}</span>
        </div>

        <!-- Quick Light / Dark Mode Toggle -->
        <button
          id="header-theme-toggle-btn"
          type="button"
          aria-label="Toggle theme"
          title="Toggle Light / Dark Mode"
          class="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          ${theme === 'dark' ? '☀️' : '🌙'}
        </button>

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
            ${currentProfile.icon} ${currentProfile.shortName}
          </button>
          <button class="mode-tab-btn course-mode ${appMode === 'course' ? 'active' : ''}" data-app-mode="course" role="tab" aria-selected="${appMode === 'course'}">
            📊 6-Week Project (Oct 31)
          </button>
        </div>
      ` : ''}

      ${appMode === 'diet' ? `
        <div class="protocol-banner">
          <div class="banner-content">
            <span class="banner-icon">${currentProfile.icon}</span>
            <div>
              <div class="banner-title">${currentProfile.target}</div>
              <div class="banner-desc">${currentProfile.tagline}</div>
            </div>
          </div>
          <div class="banner-target">${currentProfile.shortName}</div>
        </div>
      ` : ''}
    </div>
  `;
}
