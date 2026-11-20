import React, { useState, useEffect } from 'react';
import { renderSettingsModal } from './SettingsModal.js';
import { getSettings, saveSettings, isScannerEnabled, setScannerEnabled } from '../services/storage.js';

export { renderSettingsModal };

/**
 * SettingsModal React Component
 * Modern modal for theme switching, household size dynamic scaling, scanner toggle, and API keys.
 */
export default function SettingsModal({
  isOpen = false,
  onClose,
  currentTheme = 'dark',
  showProjectTab = true,
  activeDiet = 'lid',
  onSave
}) {
  const [settings, setSettingsState] = useState(() => getSettings());
  const [householdMembers, setHouseholdMembers] = useState(() => settings.household_members || 4);
  const [scannerActive, setScannerActive] = useState(() => isScannerEnabled());

  useEffect(() => {
    const current = getSettings();
    setSettingsState(current);
    setHouseholdMembers(current.household_members || 4);
    setScannerActive(isScannerEnabled());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDec = () => {
    if (householdMembers > 1) {
      setHouseholdMembers(prev => prev - 1);
    }
  };

  const handleInc = () => {
    if (householdMembers < 20) {
      setHouseholdMembers(prev => prev + 1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updated = {
      ...settings,
      household_members: householdMembers,
      scannerEnabled: scannerActive
    };
    saveSettings(updated);
    setScannerEnabled(scannerActive);
    if (onSave) onSave(updated);
    if (onClose) onClose();
  };

  return (
    <div className="modal-overlay active" id="settings-modal" role="dialog" aria-modal="true">
      <div className="modal-content modal-content-mobile-scroll" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <div>
              <h2 className="modal-title text-base sm:text-lg font-bold text-slate-900 dark:text-white">Settings & Preferences</h2>
              <div className="text-xs text-slate-500 dark:text-slate-400">Configure diets, household portion scaling, scanner & storage</div>
            </div>
          </div>
          <button type="button" className="close-btn text-slate-400 hover:text-slate-200" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 text-xs">
          {/* Household Size Stepper */}
          <div className="form-group pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              <span className="text-base leading-none">👨‍👩‍👧‍👦</span>
              <span>Household Size Dynamic Scaling</span>
              <span className="settings-sub-badge ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                {householdMembers} Members
              </span>
            </div>
            <div className="form-help mb-2 text-slate-500 dark:text-slate-400 text-[11px]">
              Adjust recipe ingredients dynamically for your household (1–20 members).
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 my-2">
              <div className="inline-flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700/80 rounded-full px-2 py-1.5 shadow-xs w-fit">
                {/* Decrement Button */}
                <button
                  type="button"
                  id="settings-household-dec-btn"
                  onClick={handleDec}
                  disabled={householdMembers <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-xs"
                  title="Decrease members"
                  aria-label="Decrease household members"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>

                <div className="flex items-center gap-1.5 px-3 min-w-[7rem] justify-center select-none">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span id="settings-household-val" className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {householdMembers} {householdMembers === 1 ? 'Member' : 'Members'}
                  </span>
                </div>

                {/* Increment Button */}
                <button
                  type="button"
                  id="settings-household-inc-btn"
                  onClick={handleInc}
                  disabled={householdMembers >= 20}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-xs"
                  title="Increase members"
                  aria-label="Increase household members"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <span id="settings-household-ratio" className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 w-fit">
                {(householdMembers / 4).toFixed(2)}x Recipe Ratio
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button type="button" className="btn-secondary px-3.5 py-1.5 text-xs rounded-lg" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary px-3.5 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-500 text-white">Save Settings</button>
          </div>
        </form>
      </div>
    </div>
  );
}

