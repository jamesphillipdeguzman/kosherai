import React from 'react';

/**
 * Modern Touch-Friendly Interactive Pill Stepper for Household Size Dynamic Scaling.
 * Enables dynamic recipe portion scaling for 1–20 members.
 */
export default function RecipeScalingControl({
  householdSize: propSize,
  householdMembers: propMembers,
  setHouseholdSize: propSetSize,
  onChange
}) {
  const householdSize = propSize ?? propMembers ?? 4;
  const setHouseholdSize = propSetSize || onChange || (() => {});

  const handleDec = () => {
    setHouseholdSize(prev => {
      const current = typeof prev === 'number' ? prev : householdSize;
      return Math.max(1, current - 1);
    });
  };

  const handleInc = () => {
    setHouseholdSize(prev => {
      const current = typeof prev === 'number' ? prev : householdSize;
      return Math.min(20, current + 1);
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 my-3">
      {/* Modern Stepper Pill */}
      <div className="inline-flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700/80 rounded-full px-2 py-1.5 shadow-xs w-fit">
        {/* Decrement Button */}
        <button
          type="button"
          onClick={handleDec}
          disabled={householdSize <= 1}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-xs"
          aria-label="Decrease household members"
          title="Decrease members"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
          </svg>
        </button>

        {/* Dynamic Count Display with Member Icon */}
        <div className="flex items-center gap-1.5 px-3 min-w-[7rem] justify-center select-none">
          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {householdSize} {householdSize === 1 ? 'Member' : 'Members'}
          </span>
        </div>

        {/* Increment Button */}
        <button
          type="button"
          onClick={handleInc}
          disabled={householdSize >= 20}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-xs"
          aria-label="Increase household members"
          title="Increase members"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Quick Multiplier Context Badge */}
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 w-fit">
        {(householdSize / 4).toFixed(2)}x Recipe Ratio
      </span>
    </div>
  );
}

