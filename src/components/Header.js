// App Header Component with Multi-Diet Selector, Connectivity Status & Settings Trigger
import { DIET_PROFILES, getDietProfile, DIET_DESCRIPTIONS, getDietDescription } from '../data/dietProfiles.js';

export { DIET_DESCRIPTIONS, getDietDescription };

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderHeader(isOnline = true, appMode = 'diet', showProjectTab = true, activeDiet = 'lid', theme = 'dark', user = null, isSyncing = false, justSynced = false) {
  let onlineVal = isOnline;
  let modeVal = appMode;
  let showProjVal = showProjectTab;
  let dietVal = activeDiet;
  let themeVal = theme;
  let userVal = user;
  let syncingVal = isSyncing;
  let justSyncedVal = justSynced;

  if (isOnline && typeof isOnline === 'object') {
    onlineVal = isOnline.isOnline !== undefined ? isOnline.isOnline : true;
    modeVal = isOnline.appMode || 'diet';
    showProjVal = isOnline.showProjectTab !== undefined ? isOnline.showProjectTab : true;
    dietVal = isOnline.activeDiet || 'lid';
    themeVal = isOnline.theme || 'dark';
    userVal = isOnline.user || isOnline.currentUser || null;
    syncingVal = isOnline.isSyncing || false;
    justSyncedVal = isOnline.justSynced || false;
  }

  const currentProfile = getDietProfile(dietVal);
  const activeDescription = getDietDescription(dietVal);
  const targetLimit = (currentProfile.target || '').replace(/^Clinical Target:\s*/i, '');

  let currentUser = userVal;
  if (!currentUser && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('kosherai_current_user') || localStorage.getItem('kosherai_user_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        currentUser = parsed.user || parsed;
      }
    } catch {
      currentUser = null;
    }
  }

  const rawName = (currentUser?.name || '').trim();
  const rawEmail = (currentUser?.email || '').trim();
  const initial = (rawName ? rawName[0] : (rawEmail ? rawEmail[0] : 'U')).toUpperCase();
  const firstName = rawName
    ? rawName.split(' ')[0]
    : (rawEmail ? rawEmail.split('@')[0] : 'User');

  return `
    <header class="app-header">
      <div class="brand-wrapper inline-flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60 shadow-sm backdrop-blur-md cursor-pointer hover:border-emerald-500/50 transition-all select-none group" id="brand-logo-btn" role="button" tabindex="0" title="Click to synchronize cloud data (/api/scans, /api/trips, /api/food-waste)">
        <img src="/favicon.svg" alt="KosherAI Logo" class="brand-icon ${syncingVal ? 'syncing animate-spin' : 'group-hover:scale-105'} transition-transform duration-300" />
        <div class="brand-title text-slate-900 dark:text-white font-black text-xl tracking-tight flex items-center gap-1.5 leading-none">
          <span>KosherAI</span>
          ${syncingVal ? `
            <span class="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 dark:bg-teal-500/20 px-1.5 py-0.5 rounded-full border border-teal-500/30 animate-pulse leading-none">
              Syncing...
            </span>
          ` : (justSyncedVal ? `
            <span class="synced-badge inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-full border border-emerald-500/30 animate-fade-in shadow-xs leading-none">
              ✓ Synced!
            </span>
          ` : '')}
        </div>
      </div>

      <div class="header-actions flex items-center gap-2">
        <!-- Consolidated Network Connection & User Status Pill -->
        ${currentUser && onlineVal ? `
          <div class="status-pill status-pill-user online inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition-all select-none shadow-2xs" title="Network connection active · Signed in as ${escapeAttr(currentUser.name || currentUser.email || 'User')}${currentUser.email ? ` (${escapeAttr(currentUser.email)})` : ''}">
            <span class="status-dot"></span>
            <span class="user-avatar-badge status-label user-initial font-bold text-xs select-none sm:hidden">
              ${escapeHtml(initial)}
            </span>
            <span class="user-desktop-name font-bold text-xs select-none hidden sm:inline max-w-[120px] truncate">
              ${escapeHtml(firstName)}
            </span>
          </div>
        ` : (!onlineVal ? `
          <div class="status-pill status-pill-offline offline inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition-all select-none shadow-2xs" title="Offline · Device has no active network connection">
            <span class="status-dot offline"></span>
            <span class="status-label font-semibold">Offline</span>
          </div>
        ` : `
          <div class="status-pill online inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 select-none shadow-2xs" title="Network connection active">
            <span class="status-dot"></span>
            <span class="status-label font-semibold">Online</span>
          </div>
        `)}

        <!-- Dynamic Auth State: Sign Out if logged in, Sign In/Get Started if logged out -->
        <div class="header-auth-controls inline-flex items-center gap-1.5 shrink-0" id="header-auth-container">
          ${currentUser ? `
            <button
              type="button"
              id="header-signout-btn"
              title="Sign Out"
              aria-label="Sign Out"
              class="header-signout-btn"
            >
              <svg class="signout-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span class="signout-text hidden sm:inline">Sign Out</span>
            </button>
          ` : `
            <div class="header-auth-buttons flex items-center gap-2">
              <button
                type="button"
                id="header-signin-btn"
                class="px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                id="header-signup-btn"
                class="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-sm cursor-pointer"
              >
                Get Started
              </button>
            </div>
          `}
        </div>

        <!-- Quick Light / Dark Mode Toggle -->
        <button
          id="header-theme-toggle-btn"
          type="button"
          aria-label="Toggle theme"
          title="Toggle Light / Dark Mode"
          class="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          ${theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <button class="btn-icon shrink-0" id="settings-open-btn" title="App & API Settings" aria-label="Settings">
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
        <div class="protocol-banner flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm mt-3 mb-2">
          <!-- Left / Top side: Icon + Clinical Target text -->
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <span class="text-2xl flex-shrink-0 select-none banner-icon">
              ${currentProfile.icon}
            </span>
            <div class="min-w-0">
              <h4 class="text-sm font-bold text-emerald-700 dark:text-emerald-400 banner-title">
                Clinical Target: ${targetLimit}
              </h4>
              <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed banner-desc sm:whitespace-normal">
                ${currentProfile.tagline}
              </p>
            </div>
          </div>

          <!-- Right / Bottom side: Diet Protocol Selector -->
          <div class="w-full sm:w-auto flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 flex justify-end">
            <div class="banner-target inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border border-teal-600/60 dark:border-teal-400/60 bg-teal-500/10 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 banner-target-interactive" title="Change Diet Protocol">
              <div class="protocol-pill-btn inline-flex items-center justify-between w-full gap-2">
                <span class="protocol-pill-info inline-flex items-center gap-1.5 min-w-0">
                  <span class="protocol-pill-icon text-sm select-none">${currentProfile.icon}</span>
                  <span class="protocol-pill-label truncate font-bold">${currentProfile.shortName}</span>
                </span>
                <svg class="protocol-pill-chevron w-4 h-4 flex-shrink-0 text-teal-600 dark:text-teal-400 pointer-events-none" width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
        </div>
      ` : ''}
    </div>
  `;
}
