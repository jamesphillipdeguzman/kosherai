import React, { useState, useEffect } from 'react';
import { updateFoodWasteRecord, getCourseConfig, getProjectWeekForDate } from '../services/courseProjectStorage.js';

/**
 * Standard disposal reasons for clinical and household food waste tracking
 */
export const WASTE_REASONS = [
  'Spoiled / Molded',
  'Cooked Excess / Leftover',
  'Accidental Spillage / Dropped',
  'Expired Pantry Item',
  'Plate Waste / Unfinished Meal',
  'Preparation Waste (Inedible/Trimmed)',
  'Expired Package',
  'Trimmings / Inedible',
  'Plate Scrapings',
  'LID Non-Compliant Purchase',
  'Other / Misc'
];

/**
 * EditWasteLogModal
 *
 * Dedicated, scroll-safe modal for updating existing food waste records.
 * Follows EditShoppingTripModal layout:
 * - Fixed header (shrink-0)
 * - Scrollable form body (flex-1 min-h-0 overflow-y-auto)
 * - Fixed footer (shrink-0) ensuring "Save Changes" is always reachable on mobile and desktop
 * - Numeric validations preventing negative values
 * - Preserves existing record ID and metadata
 */
export default function EditWasteLogModal({
  isOpen,
  record,
  log,
  onClose,
  onSave
}) {
  const targetRecord = log || record;
  const isModalOpen = isOpen !== undefined ? Boolean(isOpen) : Boolean(targetRecord);

  const [formData, setFormData] = useState({
    itemName: '',
    date: '',
    projectWeek: 1,
    measuredWeightG: 0,
    estimatedCost: 0,
    reason: 'Spoiled / Molded',
    isEstimated: false,
    notes: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (targetRecord && isModalOpen) {
      setFormData({
        itemName: targetRecord.itemName || targetRecord.item_name || targetRecord.foodDiscarded || targetRecord.name || '',
        date: targetRecord.date || targetRecord.wasteDate || new Date().toISOString().split('T')[0],
        projectWeek: Number(targetRecord.projectWeek || targetRecord.project_week || targetRecord.week || 1),
        measuredWeightG: Math.max(0, Number(targetRecord.measuredWeightG ?? targetRecord.measured_weight_g ?? targetRecord.scaleWeight ?? targetRecord.weight ?? 0)),
        estimatedCost: Math.max(0, Number(targetRecord.estimatedCost ?? targetRecord.estimated_cost ?? targetRecord.cost ?? 0)),
        reason: targetRecord.reason || targetRecord.disposalReason || 'Spoiled / Molded',
        isEstimated: Boolean(targetRecord.isEstimated ?? targetRecord.is_estimated ?? false),
        notes: targetRecord.notes || ''
      });
      setIsSaving(false);
      setErrorMessage('');
    }
  }, [targetRecord, isModalOpen]);

  // Handle escape key to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen && !isSaving) {
        onClose();
      }
    };
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isSaving, onClose]);

  if (!isModalOpen || !targetRecord) return null;

  const handleDateChange = (newDate) => {
    const config = getCourseConfig();
    const resolvedWeek = getProjectWeekForDate(newDate, config.startDate);
    setFormData(prev => ({
      ...prev,
      date: newDate,
      projectWeek: resolvedWeek || prev.projectWeek
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanItemName = formData.itemName.trim();
    if (!cleanItemName) {
      setErrorMessage('Please enter the name of the discarded food.');
      return;
    }

    const weight = Number(formData.measuredWeightG);
    if (isNaN(weight) || weight < 0) {
      setErrorMessage('Weight cannot be negative.');
      return;
    }

    const cost = Number(formData.estimatedCost);
    if (isNaN(cost) || cost < 0) {
      setErrorMessage('Estimated cost cannot be negative.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const updatedFields = {
        itemName: cleanItemName,
        date: formData.date,
        projectWeek: Number(formData.projectWeek || 1),
        measuredWeightG: Math.max(0, weight),
        isEstimated: Boolean(formData.isEstimated),
        estimatedCost: Math.max(0, cost),
        reason: formData.reason,
        notes: formData.notes.trim()
      };

      const updatedRecord = await updateFoodWasteRecord(targetRecord.id, updatedFields);

      if (onSave) {
        await onSave(updatedRecord || { ...targetRecord, ...updatedFields }, targetRecord.id);
      }
      onClose();
    } catch (err) {
      console.error('[EditWasteLogModal] Save error:', err);
      setErrorMessage('Could not update food waste log. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay edit-waste-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-waste-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        className="modal-content edit-waste-modal-dialog max-w-xl w-full mx-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden"
        style={{
          width: 'min(92vw, 520px)',
          maxWidth: '520px',
          maxHeight: '90dvh',
          height: 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Fixed Header: shrink-0 */}
        <div
          className="modal-header shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-5 sm:py-3.5 bg-white dark:bg-slate-900"
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #334155', boxSizing: 'border-box' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">⚖️</span>
            <div>
              <h2 id="edit-waste-modal-title" className="text-base sm:text-lg font-bold m-0 text-slate-900 dark:text-white">
                Edit Food Waste Record
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
                Update discarded food, weight, reason, or cost indicator
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-pointer"
            onClick={onClose}
            aria-label="Close modal"
            disabled={isSaving}
          >
            ✕
          </button>
        </div>

        {/* 2. Form connecting scrollable body and fixed footer */}
        <form
          id="edit-waste-form"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden m-0"
          style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, overflow: 'hidden', margin: 0 }}
        >
          {/* Scrollable Form Body */}
          <div
            className="edit-waste-form-body flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3.5"
            style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}
          >
            {errorMessage && (
              <div className="p-3 text-xs rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60 font-semibold">
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Food Discarded Name */}
            <div className="form-group flex flex-col gap-1">
              <label htmlFor="edit-waste-item-name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Food Discarded <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="edit-waste-item-name"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                placeholder="e.g. Leftover Rice, Spoiled Tomatoes, Chicken Bones"
                value={formData.itemName}
                onChange={e => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
                required
              />
            </div>

            {/* Scale Weight (grams) & Measurement Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group flex flex-col gap-1">
                <label htmlFor="edit-waste-weight" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Scale Weight (grams) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="edit-waste-weight"
                    step="any"
                    min="0"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none pr-10"
                    placeholder="e.g. 250"
                    value={formData.measuredWeightG}
                    onChange={e => setFormData(prev => ({ ...prev, measuredWeightG: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-mono text-slate-400 pointer-events-none">g</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {formData.measuredWeightG ? `${(formData.measuredWeightG / 1000).toFixed(3)} kg` : '0.000 kg'}
                </span>
              </div>

              {/* Estimated Cost (₱ PHP) */}
              <div className="form-group flex flex-col gap-1">
                <label htmlFor="edit-waste-cost" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Estimated Value (₱ PHP)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="edit-waste-cost"
                    step="any"
                    min="0"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none pl-7"
                    placeholder="e.g. 35.00"
                    value={formData.estimatedCost}
                    onChange={e => setFormData(prev => ({ ...prev, estimatedCost: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  />
                  <span className="absolute left-2.5 top-2.5 text-xs font-mono text-slate-400 pointer-events-none">₱</span>
                </div>
                <span className="text-[10px] text-slate-400">Tracked as loss indicator only; excluded from food expense totals.</span>
              </div>
            </div>

            {/* Disposal Reason */}
            <div className="form-group flex flex-col gap-1">
              <label htmlFor="edit-waste-reason" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Disposal Reason <span className="text-rose-500">*</span>
              </label>
              <select
                id="edit-waste-reason"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
                value={formData.reason}
                onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                required
              >
                {WASTE_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
                {!WASTE_REASONS.includes(formData.reason) && (
                  <option value={formData.reason}>{formData.reason}</option>
                )}
              </select>
            </div>

            {/* Date Discarded & Project Week */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group flex flex-col gap-1">
                <label htmlFor="edit-waste-date" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Date Discarded
                </label>
                <input
                  type="date"
                  id="edit-waste-date"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  value={formData.date}
                  onChange={e => handleDateChange(e.target.value)}
                  required
                />
              </div>

              <div className="form-group flex flex-col gap-1">
                <label htmlFor="edit-waste-week" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Study Project Week
                </label>
                <select
                  id="edit-waste-week"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
                  value={formData.projectWeek}
                  onChange={e => setFormData(prev => ({ ...prev, projectWeek: Number(e.target.value) }))}
                >
                  <option value="1">Week 1 (Baseline)</option>
                  <option value="2">Week 2 (Intervention Launch)</option>
                  <option value="3">Week 3 (Intervention)</option>
                  <option value="4">Week 4 (Intervention)</option>
                  <option value="5">Week 5 (Evaluation)</option>
                  <option value="6">Week 6 (Final Evaluation)</option>
                </select>
              </div>
            </div>

            {/* Measurement Method Checkbox */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                id="edit-waste-is-estimated"
                className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                checked={formData.isEstimated}
                onChange={e => setFormData(prev => ({ ...prev, isEstimated: e.target.checked }))}
              />
              <label htmlFor="edit-waste-is-estimated" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <strong>⚠️ Estimated Weight:</strong> Check this only if scale measurement was unavailable
              </label>
            </div>

            {/* Notes */}
            <div className="form-group flex flex-col gap-1">
              <label htmlFor="edit-waste-notes" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Notes & Context
              </label>
              <textarea
                id="edit-waste-notes"
                rows="2"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none"
                placeholder="Optional notes (e.g. inedible peels, forgot in crisper, child plate waste)..."
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          {/* 3. Fixed Footer: shrink-0 Pinned Actions (Always visible on mobile) */}
          <div
            className="modal-footer shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '12px 18px', borderTop: '1px solid #334155', boxSizing: 'border-box' }}
          >
            <button
              type="button"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

