import React, { useState, useEffect, useMemo } from 'react';
import { DIET_PROFILES, getDietProfile, DIET_DESCRIPTIONS, getDietDescription } from '../data/dietProfiles.js';
import AuthModal from './AuthModal.jsx';
import { getAuthHeaders } from '../services/authHeaders.js';
import { syncAndHydrateUserData } from '../services/courseProjectStorage.js';

export { DIET_DESCRIPTIONS, getDietDescription };

export function Header({
  isOnline: propIsOnline,
  appMode = 'diet',
  showProjectTab = true,
  activeDiet = 'lid',
  theme = 'dark',
  user = undefined,
  isSyncing: propIsSyncing,
  justSynced: propJustSynced,
  onSync,
  authModalOpen: propAuthModalOpen,
  isAuthModalOpen: propIsAuthModalOpen,
  authInitialMode: propAuthInitialMode,
  authMode: propAuthMode,
  setAuthModalOpen: propSetAuthModalOpen,
  setIsAuthModalOpen: propSetIsAuthModalOpen,
  onOpenAuthModal,
  onCloseAuthModal,
  onSelectDiet,
  onToggleTheme,
  onSelectMode,
  onOpenSettings
}) {
  const currentProfile = getDietProfile(activeDiet);

  const activeDescription = useMemo(() => {
    return getDietDescription(activeDiet);
  }, [activeDiet]);

  const [isBrowserOnline, setIsBrowserOnline] = useState(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return propIsOnline !== undefined ? propIsOnline : true;
  });

  useEffect(() => {
    if (propIsOnline !== undefined) {
      setIsBrowserOnline(propIsOnline);
    }
  }, [propIsOnline]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState('signin');

  // Backwards-compatible aliases
  const authModalOpen = isAuthModalOpen;
  const setAuthModalOpen = setIsAuthModalOpen;
  const authMode = authInitialMode;
  const setAuthMode = setAuthInitialMode;

  // Synchronize with external props if provided
  useEffect(() => {
    const externalOpen = propAuthModalOpen !== undefined ? propAuthModalOpen : propIsAuthModalOpen;
    if (externalOpen !== undefined) {
      setIsAuthModalOpen(externalOpen);
    }
  }, [propAuthModalOpen, propIsAuthModalOpen]);

  useEffect(() => {
    const externalMode = propAuthInitialMode !== undefined ? propAuthInitialMode : propAuthMode;
    if (externalMode !== undefined) {
      setAuthInitialMode(externalMode);
    }
  }, [propAuthInitialMode, propAuthMode]);

  const handleOpenAuth = (mode = 'signin') => {
    setAuthInitialMode(mode);
    setIsAuthModalOpen(true);
    if (propSetAuthModalOpen) propSetAuthModalOpen(true);
    if (propSetIsAuthModalOpen) propSetIsAuthModalOpen(true);
    if (onOpenAuthModal) onOpenAuthModal(mode);
  };

  const openAuthModal = handleOpenAuth;

  const handleCloseAuth = () => {
    setIsAuthModalOpen(false);
    if (propSetAuthModalOpen) propSetAuthModalOpen(false);
    if (propSetIsAuthModalOpen) propSetIsAuthModalOpen(false);
    if (onCloseAuthModal) onCloseAuthModal();
  };

  const closeAuthModal = handleCloseAuth;

  const [currentUser, setCurrentUser] = useState(() => {
    if (user !== undefined) return user;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('kosherai_user_session') || localStorage.getItem('kosherai_current_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          return parsed.user || parsed;
        }
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (user !== undefined) {
      setCurrentUser(user);
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAuthChange = (e) => {
      if (e?.detail) {
        setCurrentUser(e.detail.user || e.detail);
      } else {
        try {
          const stored = localStorage.getItem('kosherai_user_session') || localStorage.getItem('kosherai_current_user');
          const parsed = stored ? JSON.parse(stored) : null;
          setCurrentUser(parsed ? (parsed.user || parsed) : null);
        } catch {
          setCurrentUser(null);
        }
      }
    };

    window.addEventListener('kosherai:auth-changed', handleAuthChange);
    return () => window.removeEventListener('kosherai:auth-changed', handleAuthChange);
  }, []);

  const handleSignOut = async () => {
    try {
      const keysToClear = [
        'kosherai_current_user',
        'kosherai_user_session',
        'better-auth.session_token'
      ];
      keysToClear.forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
      sessionStorage.clear();
      try {
        await fetch('/api/auth/sign-out', {
          method: 'POST',
          credentials: 'include'
        }).catch(() => {});
      } catch (_) {}
    } finally {
      setCurrentUser(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosherai:auth-changed', { detail: null }));
      }
    }
  };

  const [internalSyncing, setInternalSyncing] = useState(false);
  const [internalJustSynced, setInternalJustSynced] = useState(false);

  const isSyncing = propIsSyncing !== undefined ? propIsSyncing : internalSyncing;
  const justSynced = propJustSynced !== undefined ? propJustSynced : internalJustSynced;

  const rawName = (currentUser?.name || '').trim();
  const firstName = rawName
    ? rawName.split(' ')[0]
    : (currentUser?.email ? currentUser.email.split('@')[0] : 'User');
  const initial = (firstName || currentUser?.name || currentUser?.email || 'U')[0].toUpperCase();

  const handleLogoClick = async (e) => {
    e.preventDefault();
    if (isSyncing) return;
    setInternalSyncing(true);
    setInternalJustSynced(false);

    try {
      if (onSync) {
        await onSync();
      } else {
        await syncAndHydrateUserData();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kosherai:sync-data'));
        }
      }
      setInternalJustSynced(true);
      setTimeout(() => setInternalJustSynced(false), 2500);
    } catch (err) {
      console.warn('[Header] Sync error:', err);
    } finally {
      setInternalSyncing(false);
    }
  };

  return (
    <div className="header-wrapper">
      <header className="app-header">
        <button
          type="button"
          id="brand-logo-btn"
          onClick={handleLogoClick}
          title="Click to synchronize cloud data (/api/scans, /api/trips, /api/food-waste)"
          className="brand-wrapper inline-flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60 shadow-sm backdrop-blur-md cursor-pointer hover:border-emerald-500/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left select-none group"
        >
          <img
            src="/favicon.svg"
            alt="KosherAI Logo"
            className={`brand-icon ${isSyncing ? 'syncing animate-spin' : 'group-hover:scale-105'} transition-transform duration-300`}
          />
          <div>
            <div className="brand-title text-slate-900 dark:text-white font-black text-xl tracking-tight flex items-center gap-1.5 leading-none">
              <span>KosherAI</span>
              <span className="brand-badge leading-none">{appMode === 'course' ? 'SUSTAIN' : currentProfile.badge}</span>
              {isSyncing ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 dark:bg-teal-500/20 px-1.5 py-0.5 rounded-full border border-teal-500/30 animate-pulse leading-none">
                  Syncing...
                </span>
              ) : justSynced ? (
                <span className="synced-badge inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-full border border-emerald-500/30 animate-fade-in shadow-xs leading-none">
                  ✓ Synced!
                </span>
              ) : null}
            </div>
            <div className="brand-subtitle text-slate-600 dark:text-slate-400 text-xs font-medium">
              {appMode === 'course' ? 'Six-Week Food Cost & Waste Study' : currentProfile.name}
            </div>
          </div>
        </button>

        <div className="header-actions flex items-center gap-2">
          {/* Consolidated Network Connection & User Status Pill */}
          {currentUser && isBrowserOnline ? (
            <div
              className="status-pill status-pill-user online inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition-all select-none shadow-2xs"
              title={`Network connection active · Signed in as ${currentUser.name || currentUser.email || 'User'}${currentUser.email ? ` (${currentUser.email})` : ''}`}
            >
              <span className="status-dot"></span>
              <span className="user-avatar-badge w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] inline-flex items-center justify-center flex-shrink-0 select-none">
                {initial}
              </span>
              <span className="status-label user-first-name font-semibold truncate max-w-[110px]">
                {firstName || 'User'}
              </span>
            </div>
          ) : !isBrowserOnline ? (
            <div
              className="status-pill status-pill-offline offline inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition-all select-none shadow-2xs"
              title="Offline · Device has no active network connection"
            >
              <span className="status-dot offline"></span>
              <span className="status-label font-semibold">Offline</span>
            </div>
          ) : (
            <div
              className="status-pill online inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 select-none shadow-2xs"
              title="Network connection active"
            >
              <span className="status-dot"></span>
              <span className="status-label font-semibold">Online</span>
            </div>
          )}

          {/* Dynamic Auth State: Sign Out button if logged in, Sign In / Get Started buttons if logged out */}
          <div className="header-auth-controls inline-flex items-center gap-1.5" id="header-auth-container">
            {currentUser ? (
              <button
                type="button"
                id="header-signout-btn"
                onClick={handleSignOut}
                title="Sign out and clear local device cache"
                aria-label="Sign out"
                className="header-signout-btn"
              >
                <svg className="signout-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span className="signout-text">Sign Out</span>
              </button>
            ) : (
              <div className="header-auth-buttons flex items-center gap-2">
                <button
                  type="button"
                  id="header-signin-btn"
                  onClick={() => {
                    setAuthInitialMode('signin');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  id="header-signup-btn"
                  onClick={() => {
                    setAuthInitialMode('signup');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  Get Started
                </button>
              </div>
            )}
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
            id="settings-open-btn"
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

      <div className="app-container" style={{ paddingTop: '10px', paddingBottom: 0 }}>
        {/* Centered Mode Selector Area with Dynamic Tagline */}
        <div className="header-mode-toggle-wrap flex flex-col items-center justify-center pt-1 pb-1 text-center px-4">
          {showProjectTab ? (
            <div className="mode-switcher-bar inline-flex items-center gap-2 p-1 rounded-full bg-slate-900/60 dark:bg-slate-900/80 border border-slate-700/60 dark:border-slate-800 shadow-sm" role="tablist" aria-label="Application View Mode">
              <button
                type="button"
                onClick={() => onSelectMode && onSelectMode('diet')}
                className={`mode-tab-btn px-4 py-1.5 rounded-full text-xs font-semibold ${
                  appMode === 'diet'
                    ? 'border border-teal-500/40 bg-teal-500/10 text-teal-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                role="tab"
                aria-selected={appMode === 'diet'}
              >
                {currentProfile.icon || '🥑'} {currentProfile.shortName}
              </button>
              <button
                type="button"
                onClick={() => onSelectMode && onSelectMode('course')}
                className={`mode-tab-btn course-mode px-4 py-1.5 rounded-full text-xs font-medium ${
                  appMode === 'course'
                    ? 'border border-teal-500/40 bg-teal-500/10 text-teal-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                role="tab"
                aria-selected={appMode === 'course'}
              >
                📊 6-Week Project (Oct 31)
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 p-1 rounded-full bg-slate-900/60 border border-slate-800">
              <span className="mode-tab-btn active px-4 py-1.5 rounded-full text-xs font-semibold border border-teal-500/40 bg-teal-500/10 text-teal-300 shadow-sm">
                {currentProfile.icon || '🥑'} {currentProfile.shortName}
              </span>
            </div>
          )}

          {/* Dynamic Tagline */}
          <p className="active-diet-tagline mt-2 text-xs text-slate-500 dark:text-slate-400 max-w-xl text-center leading-relaxed">
            {activeDescription}
          </p>
        </div>

        {appMode === 'diet' && (
          <div className="protocol-banner flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm mt-3 mb-2">
            {/* Left / Top side: Icon + Clinical Target text */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="text-2xl flex-shrink-0 select-none banner-icon">
                {currentProfile.icon}
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 banner-title">
                  Clinical Target: {(currentProfile.target || '').replace(/^Clinical Target:\s*/i, '')}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed banner-desc sm:whitespace-normal">
                  {currentProfile.tagline}
                </p>
              </div>
            </div>

            {/* Right / Bottom side: Diet Protocol Selector */}
            <div className="w-full sm:w-auto flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 flex justify-end">
              <div className="banner-target inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border border-teal-600/60 dark:border-teal-400/60 bg-teal-500/10 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 banner-target-interactive" title="Change Diet Protocol">
                <div className="protocol-pill-btn inline-flex items-center justify-between w-full gap-2">
                  <span className="protocol-pill-info inline-flex items-center gap-1.5 min-w-0">
                    <span className="protocol-pill-icon text-sm select-none">{currentProfile.icon}</span>
                    <span className="protocol-pill-label truncate font-bold">{currentProfile.shortName}</span>
                  </span>
                  <svg className="protocol-pill-chevron w-4 h-4 flex-shrink-0 text-teal-600 dark:text-teal-400 pointer-events-none" width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
                <select
                  id="header-diet-selector"
                  value={activeDiet}
                  onChange={(e) => onSelectDiet && onSelectDiet(e.target.value)}
                  className="protocol-select-native"
                  aria-label="Select Dietary Protocol"
                >
                  {Object.values(DIET_PROFILES).map((profile) => (
                    <option key={profile.id} value={profile.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1.5">
                      {profile.label || profile.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Global Auth Modal Overlay */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authInitialMode}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user?.user || user);
          setIsAuthModalOpen(false);
        }}
        onSuccess={(sessionPayload) => {
          setCurrentUser(sessionPayload?.user || sessionPayload);
          setIsAuthModalOpen(false);
        }}
      />
    </div>
  );
}

export default Header;
