// App Header Component with Multi-Diet Selector, Connectivity Status & Settings Trigger
import { DIET_PROFILES, getDietProfile, DIET_DESCRIPTIONS, getDietDescription } from '../data/dietProfiles.js';

export { DIET_DESCRIPTIONS, getDietDescription };

export function renderHeader(isOnline = navigator.onLine, appMode = 'diet', showProjectTab = true, activeDiet = 'lid', theme = 'dark') {
  const currentProfile = getDietProfile(activeDiet);
  const activeDescription = getDietDescription(activeDiet);

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
        <div class="status-pill" title="${isOnline ? 'Online - AI Verification Available' : 'Offline Mode - Local Database Active'}">
          <span class="status-dot ${isOnline ? '' : 'offline'}"></span>
          <span class="status-label">${isOnline ? 'Online' : 'Offline'}</span>
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

    <div class="app-container" style="padding-top: 10px; padding-bottom: 0;">
      <!-- Centered Mode Selector Area with Dynamic Tagline -->
      <div class="header-mode-toggle-wrap flex flex-col items-center justify-center pt-1 pb-1 text-center px-4">
        ${showProjectTab ? `
          <!-- Segmented Pill Controls -->
          <div class="mode-switcher-bar inline-flex items-center gap-2 p-1 rounded-full bg-slate-900/60 dark:bg-slate-900/80 border border-slate-700/60 dark:border-slate-800 shadow-sm" role="tablist" aria-label="Application View Mode">
            <button class="mode-tab-btn ${appMode === 'diet' ? 'active' : ''} px-4 py-1.5 rounded-full text-xs font-semibold ${
              appMode === 'diet' 
                ? 'border border-teal-500/40 bg-teal-500/10 text-teal-300 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }" data-app-mode="diet" role="tab" aria-selected="${appMode === 'diet'}">
              ${currentProfile.icon} ${currentProfile.shortName}
            </button>
            <button class="mode-tab-btn course-mode ${appMode === 'course' ? 'active' : ''} px-4 py-1.5 rounded-full text-xs font-medium ${
              appMode === 'course' 
                ? 'border border-teal-500/40 bg-teal-500/10 text-teal-300 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }" data-app-mode="course" role="tab" aria-selected="${appMode === 'course'}">
              📊 6-Week Project (Oct 31)
            </button>
          </div>
        ` : `
          <div class="inline-flex items-center gap-2 p-1 rounded-full bg-slate-900/60 border border-slate-800">
            <button class="mode-tab-btn active px-4 py-1.5 rounded-full text-xs font-semibold border border-teal-500/40 bg-teal-500/10 text-teal-300 shadow-sm" data-app-mode="diet" role="tab">
              ${currentProfile.icon} ${currentProfile.shortName}
            </button>
          </div>
        `}

        <!-- Dynamic Tagline -->
        <p class="active-diet-tagline mt-2 text-xs text-slate-500 dark:text-slate-400 max-w-xl text-center leading-relaxed">
          ${activeDescription}
        </p>
      </div>

      ${appMode === 'diet' ? `
        <div class="protocol-banner mt-3 mb-2">
          <div class="banner-content min-w-0 flex-1">
            <span class="banner-icon flex-shrink-0">${currentProfile.icon}</span>
            <div class="min-w-0">
              <div class="banner-title">${currentProfile.target}</div>
              <div class="banner-desc truncate sm:whitespace-normal">${currentProfile.tagline}</div>
            </div>
          </div>
          <div class="banner-target inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border border-teal-600/60 dark:border-teal-400/60 bg-teal-500/10 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 banner-target-interactive" title="Change Diet Protocol">
            <label for="header-diet-selector" class="sr-only">Select Diet Protocol</label>
            <div class="protocol-pill-btn inline-flex items-center gap-1.5">
              <span class="protocol-pill-icon text-sm select-none">${currentProfile.icon}</span>
              <span class="protocol-pill-label truncate font-bold">${currentProfile.shortName}</span>
              <svg class="protocol-pill-chevron w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0 pointer-events-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            </div>
            <select id="header-diet-selector" class="protocol-select-native" aria-label="Select Dietary Protocol">
              ${Object.values(DIET_PROFILES).map(profile => `
                <option value="${profile.id}" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1.5" ${profile.id === activeDiet ? 'selected' : ''}>
                  ${profile.label || profile.name}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
