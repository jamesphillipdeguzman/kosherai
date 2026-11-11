import React, { useState } from 'react';
import { CHECKLIST_BY_DIET, PRE_COOKING_CHECKLIST } from '../data/protocolRules.js';
import { getChecklistState, saveChecklistState } from '../services/storage.js';

/**
 * PreCookingSafetyChecklist
 *
 * Collapsible Pre-Cooking Safety Checklist component for Cook Mode.
 * Collapsed by default, displaying a progress indicator (e.g. 0/7 Verified) in the header.
 */
export default function PreCookingSafetyChecklist({
  activeDiet = 'lid',
  defaultExpanded = false,
  checklistState: propChecklistState,
  onChecklistChange,
  onReset
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [internalState, setInternalState] = useState(() => getChecklistState());

  const checklistState = propChecklistState !== undefined ? propChecklistState : internalState;
  const activeChecklist = CHECKLIST_BY_DIET[activeDiet] || CHECKLIST_BY_DIET.lid || PRE_COOKING_CHECKLIST;
  const totalChecks = activeChecklist.length;
  const checkedCount = activeChecklist.filter(item => checklistState[item.id]).length;
  const isAllClear = checkedCount === totalChecks;

  const handleToggleItem = (id) => {
    const updated = {
      ...checklistState,
      [id]: !checklistState[id]
    };
    if (propChecklistState === undefined) {
      setInternalState(updated);
      saveChecklistState(updated);
    }
    if (onChecklistChange) onChecklistChange(updated);
  };

  const handleReset = (e) => {
    if (e) e.stopPropagation();
    if (propChecklistState === undefined) {
      setInternalState({});
      saveChecklistState({});
    }
    if (onReset) onReset();
    if (onChecklistChange) onChecklistChange({});
  };

  return (
    <div className={`checklist-card ${isExpanded ? 'is-expanded' : 'is-collapsed'}`} id="checklist-card-container">
      <div
        id="toggle-checklist-btn"
        className="checklist-header-wrapper flex items-center justify-between gap-3 cursor-pointer select-none"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label="Toggle Pre-Cooking Safety Checklist"
        onClick={() => setIsExpanded(prev => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(prev => !prev);
          }
        }}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span
            className="checklist-chevron inline-flex items-center justify-center w-5 h-5 transition-transform duration-200 text-slate-400 shrink-0"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="checklist-title m-0 text-base font-extrabold text-slate-900 dark:text-white">
                Pre-Cooking Safety Checklist
              </h2>
              <span
                id="checklist-header-badge"
                className={`checklist-progress-badge text-xs font-bold px-2 py-0.5 rounded-full border font-mono whitespace-nowrap ${
                  isAllClear
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {checkedCount}/{totalChecks} Verified
              </span>
            </div>
            {isExpanded && (
              <p className="checklist-desc m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
                Caregivers and home cooks: verify these {totalChecks} safety rules before turning on the stove.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            id="reset-checklist-btn"
            className="btn-secondary px-3 py-1 text-xs font-medium rounded-lg"
            title="Reset checklist progress"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="checklist-body mt-3.5" id="checklist-body">
          <div className="checklist-items flex flex-col gap-2.5">
            {activeChecklist.map((item) => {
              const isChecked = !!checklistState[item.id];
              return (
                <div
                  key={item.id}
                  className={`check-item ${isChecked ? 'checked' : ''}`}
                  data-check-id={item.id}
                  role="checkbox"
                  aria-checked={isChecked}
                  tabIndex={0}
                  onClick={() => handleToggleItem(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggleItem(item.id);
                    }
                  }}
                >
                  <div className="custom-checkbox">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="check-item-text">{item.text}</div>
                </div>
              );
            })}
          </div>

          <div className={`checklist-meter mt-4 p-3.5 rounded-xl flex items-center justify-between border ${
            isAllClear
              ? 'all-clear border-emerald-600/50 dark:border-emerald-400/50 bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
              : 'pending border-amber-600/50 dark:border-amber-400/50 bg-amber-500/10 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{isAllClear ? '🛡️' : '⚠️'}</span>
              <div>
                <div className="font-extrabold text-sm">
                  {isAllClear ? 'ALL CLEAR: SAFE TO COOK' : `${checkedCount} of ${totalChecks} Rules Verified`}
                </div>
                <div className="text-xs opacity-90">
                  {isAllClear ? 'Your kitchen setup fully protects against accidental contamination.' : 'Review any unchecked items before proceeding.'}
                </div>
              </div>
            </div>
            <div className="font-mono font-extrabold text-lg">
              {Math.round((checkedCount / totalChecks) * 100)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { PreCookingSafetyChecklist };

