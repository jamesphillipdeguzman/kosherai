import React, { useState, useEffect } from 'react';
import {
  getShoppingTrips,
  getGroceryItems,
  getFoodWasteRecords,
  getMealPlans,
  getProjectConfig,
  getProjectWeekSchedule,
  getProjectComparison
} from '../services/courseProjectStorage.js';
import { normalizeWeek } from '../utils/weekNormalization.js';
import ShoppingTripsView from './ShoppingTripsView.jsx';
import GroceryPurchasesView from './GroceryPurchasesView.jsx';

/**
 * SixWeekStudyView
 *
 * Consolidated Six-Week Research Study interface.
 * The large W1–W6 + All Weeks cards serve as the single source of truth for week filtering.
 */
export default function SixWeekStudyView({
  initialWeek = 'all',
  initialSubTab = 'trips',
  onSelectWeek: propOnSelectWeek
}) {
  const [selectedWeek, setSelectedWeek] = useState(normalizeWeek(initialWeek));
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab || 'trips');
  const [trips, setTrips] = useState([]);
  const [groceries, setGroceries] = useState([]);
  const [comparison, setComparison] = useState({ weeklyData: [], totals: {} });
  const [config, setConfig] = useState({});
  const [schedule, setSchedule] = useState([]);

  const refreshData = () => {
    const freshTrips = getShoppingTrips();
    const freshGroceries = getGroceryItems();
    const freshConfig = getProjectConfig();
    const freshSchedule = getProjectWeekSchedule(freshConfig.startDate);
    const freshComp = getProjectComparison();

    setTrips(freshTrips);
    setGroceries(freshGroceries);
    setConfig(freshConfig);
    setSchedule(freshSchedule);
    setComparison(freshComp);
  };

  useEffect(() => {
    refreshData();

    const handleUpdate = () => refreshData();
    window.addEventListener('kosherai-trips-updated', handleUpdate);
    window.addEventListener('kosherai-groceries-updated', handleUpdate);
    window.addEventListener('kosherai_storage_updated', handleUpdate);

    return () => {
      window.removeEventListener('kosherai-trips-updated', handleUpdate);
      window.removeEventListener('kosherai-groceries-updated', handleUpdate);
      window.removeEventListener('kosherai_storage_updated', handleUpdate);
    };
  }, []);

  const handleWeekSelect = (week) => {
    const norm = normalizeWeek(week);
    setSelectedWeek(norm);
    if (propOnSelectWeek) propOnSelectWeek(norm);
  };

  const normWeek = normalizeWeek(selectedWeek);

  return (
    <div className="course-project-container">
      {/* Course Research Project Header */}
      <div className="course-header-card bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 rounded-2xl mb-4">
        <div className="course-header-top flex justify-between items-start gap-4 mb-4 flex-wrap">
          <div>
            <div className="course-pill inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 mb-1.5">
              Course Research Project
            </div>
            <h1 className="course-title text-base sm:text-xl text-slate-900 dark:text-slate-100 font-bold m-0">
              Sustaining Human Life: Food Cost & Waste Tracker
            </h1>
            <p className="course-subtitle text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Six-week household study evaluating meal planning, food expenditure, whole-grocery weight, and waste reduction under Low-Iodine Diet (LID) requirements.
            </p>
          </div>
          <div className="course-calendar-badge flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-xl">📅</span>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Project Start</div>
              <div className="font-mono text-xs font-extrabold text-teal-600 dark:text-teal-400">
                {config.startDate || 'Oct 31, 2026'}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold">Sat – Fri Cycle</div>
            </div>
          </div>
        </div>

        {/* Large Week Cards Strip (Single Source of Truth) */}
        <div className="weekly-cycle-strip">
          {/* All Weeks Card at the beginning */}
          <button
            type="button"
            className={`week-step-pill ${
              normWeek === 'all'
                ? 'active bg-teal-600 text-white dark:bg-teal-500'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            } ${trips.length > 0 ? 'has-data' : ''}`}
            onClick={() => handleWeekSelect('all')}
            data-week-select="all"
            title="View all study weeks (Weeks 1–6)"
          >
            <div className="week-pill-num">All Weeks</div>
            <div className="week-pill-type">Overview</div>
            <div className="week-pill-dates">{trips.length} {trips.length === 1 ? 'Trip' : 'Trips'}</div>
          </button>

          {/* W1 – W6 Study Cards */}
          {schedule.map(w => {
            const isSelected = normWeek === w.weekNumber;
            const weekStats = comparison.weeklyData?.find(d => d.weekNumber === w.weekNumber);
            const hasData = weekStats && weekStats.hasRecords;
            const weekTrips = trips.filter(t => {
              const tripWeek = t.projectWeek ? Number(t.projectWeek) : null;
              return tripWeek === w.weekNumber;
            });

            return (
              <button
                key={w.weekNumber}
                type="button"
                className={`week-step-pill ${
                  isSelected
                    ? 'active bg-teal-600 text-white dark:bg-teal-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                } ${hasData || weekTrips.length > 0 ? 'has-data' : ''}`}
                onClick={() => handleWeekSelect(w.weekNumber)}
                data-week-select={w.weekNumber}
                title={`Filter study to Week ${w.weekNumber}`}
              >
                <div className="week-pill-num">W{w.weekNumber}</div>
                <div className="week-pill-type">{w.isBaseline ? 'Baseline' : (w.weekNumber === 2 ? 'Intervene' : 'Evaluate')}</div>
                <div className="week-pill-dates">
                  {w.startDate.slice(5)} • {weekTrips.length} {weekTrips.length === 1 ? 'trip' : 'trips'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sub-navigation Tabs */}
        <div className="course-subnav flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'trips'
                ? 'bg-teal-600 text-white dark:bg-teal-500'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            onClick={() => setActiveSubTab('trips')}
          >
            🧾 Shopping Trips & Receipts
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'groceries'
                ? 'bg-teal-600 text-white dark:bg-teal-500'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            onClick={() => setActiveSubTab('groceries')}
          >
            🥬 Grocery Purchases
          </button>
        </div>
      </div>

      {/* Subtab Content Area */}
      <div className="course-subtab-content">
        {activeSubTab === 'trips' && (
          <ShoppingTripsView
            trips={trips}
            selectedWeek={normWeek}
            onSelectWeek={handleWeekSelect}
          />
        )}
        {activeSubTab === 'groceries' && (
          <GroceryPurchasesView
            items={groceries}
            trips={trips}
            selectedWeek={normWeek}
            onSelectWeek={handleWeekSelect}
          />
        )}
      </div>
    </div>
  );
}
