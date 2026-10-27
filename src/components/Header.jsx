import React, { useMemo } from 'react';
import { DIET_PROFILES, getDietProfile, DIET_DESCRIPTIONS, getDietDescription } from '../data/dietProfiles.js';

export { DIET_DESCRIPTIONS, getDietDescription };

export function Header({
  isOnline = true,
  appMode = 'diet',
  showProjectTab = true,
  activeDiet = 'lid',
  theme = 'dark',
  onSelectDiet,
  onToggleTheme,
  onSelectMode,
  onOpenSettings
}) {
  const currentProfile = getDietProfile(activeDiet);

  const activeDescription = useMemo(() => {
    return getDietDescription(activeDiet);
  }, [activeDiet]);

  return (
    <div className="header-wrapper">
      <header className="app-header">
        <div className="brand-wrapper inline-flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60 shadow-sm backdrop-blur-md">
          <img src="/favicon.svg" alt="KosherAI Logo" className="brand-icon" />
          <div>
            <div className="brand-title text-slate-900 dark:text-white font-black text-xl tracking-tight">
              KosherAI
              <span className="brand-badge">{appMode === 'course' ? 'SUSTAIN' : currentProfile.badge}</span>
            </div>
            <div className="brand-subtitle text-slate-600 dark:text-slate-400 text-xs font-medium">
              {appMode === 'course' ? 'Six-Week Food Cost & Waste Study' : currentProfile.name}
            </div>
          </div>
        </div>

        <div className="header-actions">
          <div className="status-pill" title={isOnline ? 'Online - AI Verification Available' : 'Offline Mode - Local Database Active'}>
            <span className={`status-dot ${isOnline ? '' : 'offline'}`}></span>
            <span className="status-label">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <button
            id="header-theme-toggle-btn"
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button
            className="btn-icon"
            onClick={onOpenSettings}
            title="App & API Settings"
            aria-label="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="app-container" style={{ paddingTop: '12px', paddingBottom: 0 }}>
        {/* Dedicated Full-Width Diet Protocol Selector Strip */}
        <div className="diet-selector-strip w-full flex items-center justify-between gap-2 p-2 my-2 rounded-2xl bg-slate-100/90 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-800/80 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0 pl-1">
            <span className="text-lg flex-shrink-0">{currentProfile.emoji || currentProfile.icon}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dietary Protocol</div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{currentProfile.name}</div>
            </div>
          </div>

          <div className="header-diet-picker-wrap flex-shrink-0" title="Active Dietary Protocol">
            <label htmlFor="header-diet-selector" className="sr-only">Select Diet Protocol</label>
            <div className="diet-select-badge">
              <span className="diet-select-icon mr-1.5">{currentProfile.emoji || currentProfile.icon}</span>
              <select
                id="header-diet-selector"
                value={activeDiet}
                onChange={(e) => onSelectDiet && onSelectDiet(e.target.value)}
                className="header-diet-dropdown bg-teal-950/40 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-teal-500/30 rounded-xl px-3 py-1.5 focus:outline-none"
                aria-label="Select Dietary Protocol"
              >
                {Object.values(DIET_PROFILES).map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label || profile.name}
                  </option>
                ))}
              </select>
              <span className="diet-select-chevron">▾</span>
            </div>
          </div>
        </div>
        {/* Centered Selector Area with Dynamic Tagline */}
        <div className="flex flex-col items-center justify-center my-2 text-center px-4">
          {showProjectTab ? (
            <div className="inline-flex items-center gap-2 p-1 rounded-full bg-slate-900/60 border border-slate-800">
              <button
                type="button"
                onClick={() => onSelectMode && onSelectMode('diet')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold ${
                  appMode === 'diet'
                    ? 'border border-teal-500/40 bg-teal-500/10 text-teal-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {currentProfile.icon || '🥑'} {currentProfile.shortName}
              </button>
              <button
                type="button"
                onClick={() => onSelectMode && onSelectMode('course')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium ${
                  appMode === 'course'
                    ? 'border border-teal-500/40 bg-teal-500/10 text-teal-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📊 6-Week Project (Oct 31)
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 p-1 rounded-full bg-slate-900/60 border border-slate-800">
              <span className="px-4 py-1.5 rounded-full text-xs font-semibold border border-teal-500/40 bg-teal-500/10 text-teal-300 shadow-sm">
                {currentProfile.icon || '🥑'} {currentProfile.shortName}
              </span>
            </div>
          )}

          {/* New Dynamic Tagline */}
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-400 max-w-xl text-center leading-relaxed">
            {activeDescription}
          </p>
        </div>

        {appMode === 'diet' && (
          <div className="protocol-banner">
            <div className="banner-content">
              <span className="banner-icon">{currentProfile.icon}</span>
              <div>
                <div className="banner-title">{currentProfile.target}</div>
                <div className="banner-desc">{currentProfile.tagline}</div>
              </div>
            </div>
            <span className="banner-target inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border border-teal-600/60 dark:border-teal-400/60 bg-teal-500/10 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200">
              {currentProfile.shortName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Header;
