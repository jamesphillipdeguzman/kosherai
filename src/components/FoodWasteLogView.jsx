import React, { useState, useEffect } from 'react';
import {
  getFoodWasteRecords,
  updateFoodWasteRecord,
  deleteFoodWasteRecord,
  saveFoodWasteToIndexedDB,
  saveFoodWasteRecord,
  getCourseConfig
} from '../services/courseProjectStorage.js';
import { formatNumber } from './ShoppingTripsView.js';
import { normalizeWeek, resolveWasteWeek, isWasteLogMatchWeek } from '../utils/weekNormalization.js';
import EditWasteLogModal from './EditWasteLogModal.jsx';

/**
 * FoodWasteLogView
 *
 * Dedicated view for Food Waste Tracking (Kitchen & Plate Waste) under Sustaining Human Life Project.
 * Displays summary metrics, responsive table, and integrated EditWasteLogModal.
 */
export default function FoodWasteLogView({
  records: propRecords,
  wasteLogs,
  selectedWeek = 'all',
  onSelectWeek,
  onEditWaste,
  onDeleteWaste
}) {
  const incomingRecords = propRecords || wasteLogs;
  const [wasteList, setWasteList] = useState([]);
  const [editingLog, setEditingLog] = useState(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    itemName: '',
    measuredWeightG: 0,
    estimatedCost: 0,
    reason: 'Spoiled / Molded',
    date: new Date().toISOString().split('T')[0],
    isEstimated: false,
    notes: ''
  });

  const refreshWaste = () => {
    try {
      if (typeof getFoodWasteRecords === 'function') {
        const records = getFoodWasteRecords();
        if (Array.isArray(records)) {
          setWasteList(records);
        }
      }
    } catch (err) {
      console.warn('[FoodWasteLogView] Could not refresh food waste records:', err);
    }
  };

  useEffect(() => {
    if (incomingRecords && Array.isArray(incomingRecords)) {
      setWasteList(incomingRecords);
    } else {
      refreshWaste();
    }

    const handleUpdate = () => refreshWaste();
    window.addEventListener('kosherai-foodwaste-updated', handleUpdate);
    window.addEventListener('kosherai-food-waste-synced', handleUpdate);
    window.addEventListener('kosherai_storage_updated', handleUpdate);

    return () => {
      window.removeEventListener('kosherai-foodwaste-updated', handleUpdate);
      window.removeEventListener('kosherai-food-waste-synced', handleUpdate);
      window.removeEventListener('kosherai_storage_updated', handleUpdate);
    };
  }, [incomingRecords]);

  const normWeek = normalizeWeek(selectedWeek);
  const config = typeof getCourseConfig === 'function' ? getCourseConfig() : null;

  // Filter records by selected week if specified
  const filteredRecords = normWeek === 'all'
    ? wasteList
    : wasteList.filter(r => isWasteLogMatchWeek(r, normWeek, config));

  // Summary Banner Metrics (recalculated dynamically whenever wasteList changes)
  const totalGrams = filteredRecords.reduce((sum, r) => sum + Number(r.measuredWeightG || 0), 0);
  const totalCost = filteredRecords.reduce((sum, r) => sum + Number(r.estimatedCost || 0), 0);
  const totalKg = (totalGrams / 1000).toFixed(2);

  const handleDelete = async (id, itemName) => {
    if (onDeleteWaste) {
      onDeleteWaste(id);
      return;
    }
    if (typeof window !== 'undefined' && window.confirm(`Delete food waste record "${itemName || 'Item'}"?`)) {
      await deleteFoodWasteRecord(id);
      refreshWaste();
    }
  };

  const handleSaveEditedLog = async (firstArg, secondArg) => {
    const updatedData = (firstArg && typeof firstArg === 'object') ? firstArg : secondArg;
    const targetId = (typeof firstArg === 'string' && firstArg) ? firstArg : (secondArg?.id || updatedData?.id || editingLog?.id);

    if (!targetId || !updatedData) return;

    try {
      // 1. Update in the centralized storage service (courseProjectStorage.js)
      const savedRecord = await updateFoodWasteRecord(targetId, updatedData);
      const mergedRecord = savedRecord || { ...editingLog, ...updatedData, id: targetId };

      // 2. Update existing waste log in the current UI state immediately
      setWasteList(prev => prev.map(r => r.id === targetId ? { ...r, ...mergedRecord } : r));

      // 3. Close the modal after local save succeeds
      setEditingLog(null);

      // 4. Notify parent if onEditWaste callback provided
      if (onEditWaste) {
        onEditWaste(mergedRecord);
      }
    } catch (err) {
      console.error('[FoodWasteLogView] Failed to save edited waste log:', err);
      throw err;
    }
  };

  const handleCreateNewSubmit = async (e) => {
    e.preventDefault();
    if (!newForm.itemName.trim()) return;

    try {
      const saved = saveFoodWasteRecord({
        itemName: newForm.itemName.trim(),
        date: newForm.date,
        measuredWeightG: Math.max(0, parseFloat(newForm.measuredWeightG) || 0),
        estimatedCost: Math.max(0, parseFloat(newForm.estimatedCost) || 0),
        reason: newForm.reason,
        isEstimated: Boolean(newForm.isEstimated),
        notes: newForm.notes.trim(),
        synced: false
      });

      await saveFoodWasteToIndexedDB(saved, false).catch(() => {});
      setIsNewModalOpen(false);
      setNewForm({
        itemName: '',
        measuredWeightG: 0,
        estimatedCost: 0,
        reason: 'Spoiled / Molded',
        date: new Date().toISOString().split('T')[0],
        isEstimated: false,
        notes: ''
      });
      refreshWaste();
    } catch (err) {
      console.error('Failed to create waste record:', err);
    }
  };

  return (
    <div className="waste-view-container">
      {/* Header and Action Bar */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="section-title text-base sm:text-lg font-bold text-slate-900 dark:text-white m-0">
            Food Waste Tracker (Kitchen & Plate Waste)
          </h2>
          <p className="section-desc text-xs text-slate-500 dark:text-slate-400 m-0">
            Record actual measured food waste using your digital kitchen scale. Exclude packaging and non-food tare.
          </p>
        </div>
        <button
          type="button"
          id="open-waste-modal-btn"
          className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
          onClick={() => setIsNewModalOpen(true)}
        >
          ➕ Log Food Waste Entry
        </button>
      </div>

      {/* Active Week Context Strip */}
      <div className="flex justify-between items-center mb-3 px-3.5 py-2 bg-slate-50 dark:bg-slate-850/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Showing: <strong className="text-slate-800 dark:text-slate-100">{normWeek === 'all' ? 'All Weeks' : `Week ${normWeek} (W0${normWeek})`}</strong>
          {' '}• {filteredRecords.length} {filteredRecords.length === 1 ? 'log' : 'logs'} recorded
        </span>
        {normWeek !== 'all' && (
          <button
            type="button"
            className="text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer text-xs"
            onClick={() => onSelectWeek && onSelectWeek('all')}
          >
            Show All Weeks ({wasteList.length})
          </button>
        )}
      </div>

      {/* Summary Statistics Banner (Automatically recalculated without reload) */}
      <div className="waste-stats-banner grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="waste-stat-box p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="stat-label text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Measured Waste
          </span>
          <div className="stat-number text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {totalKg} kg <span className="text-xs font-medium text-slate-400">({totalGrams.toLocaleString()} g)</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5">
            {normWeek === 'all' ? 'Across all 6 study weeks' : `Week ${normWeek} totals`}
          </span>
        </div>

        <div className="waste-stat-box p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="stat-label text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Estimated Waste Value
          </span>
          <div className="stat-number text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mt-1">
            ₱{formatNumber(totalCost)}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5">
            Kept strictly separate from food expenses
          </span>
        </div>

        <div className="waste-stat-box p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="stat-label text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Waste Entries
          </span>
          <div className="stat-number text-lg sm:text-xl font-black text-teal-600 dark:text-teal-400 mt-1">
            {filteredRecords.length} <span className="text-xs font-medium text-slate-400">logs</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5">
            {normWeek === 'all' ? `All logs (${wasteList.length})` : `Filtered for Week ${normWeek}`}
          </span>
        </div>
      </div>

      {/* Waste Records Table or Empty State */}
      {filteredRecords.length === 0 ? (
        <div className="empty-state-card p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="empty-icon text-3xl mb-2">⚖️</div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white m-0">
            {normWeek === 'all' ? 'No Food Waste Logged' : `No food waste logs recorded for Week ${normWeek}`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {normWeek === 'all'
              ? 'Weigh any spoiled ingredients, cooked leftovers, or prep waste on your digital scale and log them here.'
              : `No food waste entries found for Week ${normWeek}. Select "All Weeks" to view all records.`}
          </p>
          <div className="flex gap-2 justify-center mt-3">
            {normWeek !== 'all' && (
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                onClick={() => onSelectWeek && onSelectWeek('all')}
              >
                Show All Weeks
              </button>
            )}
            <button
              type="button"
              id="empty-waste-btn"
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
              onClick={() => setIsNewModalOpen(true)}
            >
              ➕ Log First Waste Item
            </button>
          </div>
        </div>
      ) : (
        <div className="table-responsive bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <table className="course-table w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                <th className="p-3">Food Discarded</th>
                <th className="p-3">Date & Week</th>
                <th className="p-3">Scale Weight (g)</th>
                <th className="p-3">Measurement</th>
                <th className="p-3">Reason for Disposal</th>
                <th className="p-3">Estimated Cost</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredRecords.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white">{r.itemName}</span>
                      {r.synced ? (
                        <span className="trip-sync-badge synced text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60" title="Synced with Neon PostgreSQL cloud database">
                          ☁️✓ Synced
                        </span>
                      ) : (
                        <span className="trip-sync-badge offline text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60" title="Saved locally in IndexedDB; will auto-sync to Neon when online">
                          ☁️⏳ Offline
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <div className="text-[11px] text-slate-400 mt-0.5 font-normal">{r.notes}</div>
                    )}
                  </td>
                  <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    Week {resolveWasteWeek(r, config)} • {r.date}
                  </td>
                  <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {r.measuredWeightG} g
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      r.isEstimated
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {r.isEstimated ? '⚠️ Estimated' : '⚖️ Digital Scale'}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium">
                      {r.reason}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    ₱{formatNumber(r.estimatedCost)}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      {/* Modern Edit Button */}
                      <button
                        type="button"
                        className="edit-waste-btn inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 shadow-xs transition-all active:scale-95 cursor-pointer dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                        data-edit-waste={r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLog(r);
                        }}
                        title="Edit food waste log"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span>Edit</span>
                      </button>

                      {/* Modern Delete Button */}
                      <button
                        type="button"
                        className="delete-waste-btn inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 shadow-xs transition-all active:scale-95 cursor-pointer dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
                        data-delete-waste={r.id}
                        onClick={() => handleDelete(r.id, r.itemName)}
                        title="Delete food waste record"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Food Waste Modal */}
      {editingLog && (
        <EditWasteLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSave={handleSaveEditedLog}
        />
      )}

      {/* Add New Food Waste Modal */}
      {isNewModalOpen && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsNewModalOpen(false)}
        >
          <div
            className="modal-content max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 flex items-center gap-1.5">
                <span>➕</span> Log Food Waste Entry
              </h3>
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-white"
                onClick={() => setIsNewModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Food Discarded *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                  placeholder="e.g. Cooked Rice, Spoiled Milk, Inedible Rind"
                  value={newForm.itemName}
                  onChange={e => setNewForm(prev => ({ ...prev, itemName: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Scale Weight (grams) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                    placeholder="e.g. 240"
                    value={newForm.measuredWeightG}
                    onChange={e => setNewForm(prev => ({ ...prev, measuredWeightG: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Estimated Cost (₱)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                    placeholder="e.g. 30"
                    value={newForm.estimatedCost}
                    onChange={e => setNewForm(prev => ({ ...prev, estimatedCost: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Disposal Reason
                  </label>
                  <select
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                    value={newForm.reason}
                    onChange={e => setNewForm(prev => ({ ...prev, reason: e.target.value }))}
                  >
                    <option value="Spoiled / Molded">Spoiled / Molded</option>
                    <option value="Cooked Excess / Leftover">Cooked Excess / Leftover</option>
                    <option value="Expired Package">Expired Package</option>
                    <option value="Trimmings / Inedible">Trimmings / Inedible</option>
                    <option value="Plate Scrapings">Plate Scrapings</option>
                    <option value="Other / Misc">Other / Misc</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Date Discarded
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                    value={newForm.date}
                    onChange={e => setNewForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                  placeholder="Optional context..."
                  value={newForm.notes}
                  onChange={e => setNewForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  onClick={() => setIsNewModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-500 text-white"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export { FoodWasteLogView, FoodWasteLogView as FoodWasteLogTab };

