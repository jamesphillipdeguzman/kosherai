import React, { useState, useEffect, useRef } from 'react';
import { getGroceryItems, updateShoppingTrip } from '../services/courseProjectStorage.js';
import { TRIP_TYPES, formatNumber, escapeHtml } from './ShoppingTripsView.js';
import { compressImage } from '../services/aiVerification.js';
import { uploadReceiptImageToCloudinary } from '../utils/cloudinary.js';

/**
 * EditShoppingTripModal
 *
 * Dedicated modal for updating shopping trip details with photo management:
 * - Displays current receipt or produce photo
 * - "Rescan / Change Photo" action triggering device camera or desktop file picker
 * - Image preview before saving
 * - Option to remove photo
 * - Non-destructive: preserves existing photo if not changed
 * - Compresses and persists replacement photo
 */
export default function EditShoppingTripModal({
  isOpen = false,
  trip,
  onClose,
  onSave
}) {
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    storeName: '',
    date: '',
    tripType: 'Supermarket',
    totalScaleWeightKg: 0,
    totalAmountPaid: 0,
    notes: ''
  });

  const [items, setItems] = useState([]);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');

  useEffect(() => {
    if (trip && isOpen) {
      setFormData({
        storeName: trip.storeName || '',
        date: trip.date || new Date().toISOString().split('T')[0],
        tripType: trip.tripType || trip.trip_type || 'Supermarket',
        totalScaleWeightKg: trip.totalScaleWeightKg || 0,
        totalAmountPaid: trip.totalAmountPaid || 0,
        notes: trip.notes || ''
      });

      let tripItems = getGroceryItems(trip.id);
      if (!tripItems || tripItems.length === 0) {
        if (Array.isArray(trip.items) && trip.items.length > 0) tripItems = trip.items;
        else if (Array.isArray(trip.rawItems) && trip.rawItems.length > 0) tripItems = trip.rawItems;
        else if (Array.isArray(trip.extractedItems) && trip.extractedItems.length > 0) tripItems = trip.extractedItems;
        else tripItems = [];
      }

      setItems(tripItems.map((item, idx) => ({
        id: item.id || `item_${idx}`,
        name: item.name || item.raw_receipt_text || item.rawReceiptText || '',
        quantity: item.quantity !== undefined ? item.quantity : (item.qty ?? 1),
        unit: item.unit || 'kg'
      })));

      setPhotoPreview(trip.receiptImageUrl || null);
      setPendingFile(null);
      setPhotoRemoved(false);
      setIsSaving(false);
      setOcrStatus('');
    }
  }, [trip, isOpen]);

  // Handle escape key to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen || !trip) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setPhotoRemoved(false);
      const preview = URL.createObjectURL(file);
      setPhotoPreview(preview);
    }
    if (e.target) e.target.value = '';
  };

  const handleRemovePhoto = () => {
    setPendingFile(null);
    setPhotoPreview(null);
    setPhotoRemoved(true);
  };

  const handleItemChange = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        quantity: 1,
        unit: 'kg'
      }
    ]);
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);

    try {
      let resolvedPhotoUrl = trip.receiptImageUrl;

      if (pendingFile) {
        // Compress image first
        try {
          const compressed = await compressImage(pendingFile, 1600, 0.8);
          const cUrl = await uploadReceiptImageToCloudinary(compressed);
          resolvedPhotoUrl = cUrl || compressed;
        } catch (err) {
          console.warn('[EditModal] Upload fallback:', err);
          resolvedPhotoUrl = photoPreview;
        }
      } else if (photoRemoved) {
        resolvedPhotoUrl = null;
      }

      const updatedPayload = {
        storeName: formData.storeName.trim() || 'Supermarket',
        tripType: formData.tripType,
        trip_type: formData.tripType,
        date: formData.date,
        totalScaleWeightKg: Number(formData.totalScaleWeightKg) || 0,
        totalAmountPaid: Number(formData.totalAmountPaid) || 0,
        notes: formData.notes.trim(),
        receiptImageUrl: resolvedPhotoUrl,
        items
      };

      await updateShoppingTrip(trip.id, updatedPayload);

      if (onSave) {
        onSave(trip.id, updatedPayload);
      }
      onClose();
    } catch (err) {
      console.error('[EditModal] Save error:', err);
      alert('Could not update shopping trip. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay edit-trip-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-trip-modal-title"
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', boxSizing: 'border-box' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        className="modal-content edit-trip-modal-dialog max-w-xl w-full mx-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden"
        style={{ width: 'min(92vw, 520px)', maxWidth: '520px', maxHeight: '90dvh', height: 'auto', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, boxSizing: 'border-box' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header: Fixed Height, shrink-0 */}
        <div
          className="modal-header edit-trip-header shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-5 sm:py-3.5 bg-white dark:bg-slate-900"
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #334155', boxSizing: 'border-box' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <div>
              <h2 id="edit-trip-modal-title" className="text-base sm:text-lg font-bold m-0 text-slate-900 dark:text-white">Edit Shopping Trip</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0">Update store, date, photo, or item details</p>
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

        {/* Form Container connecting scrollable body and pinned footer */}
        <form
          id="edit-trip-form"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden m-0"
          style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, overflow: 'hidden', margin: 0 }}
        >
          {/* 2. Form Body: Scrollable flex-1 min-h-0 overflow-y-auto */}
          <div
            className="edit-trip-form-body flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4"
            style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}
          >
            {/* Photo Management Section: Fixed 80x80 thumbnail + action buttons beside it */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70">
              <div className="flex items-center gap-3.5">
                {/* 80px x 80px fixed thumbnail */}
                <div
                  className="edit-trip-thumb-box w-20 h-20 min-w-20 min-h-20 shrink-0 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-950 flex items-center justify-center"
                  style={{ width: '80px', height: '80px', minWidth: '80px', minHeight: '80px', maxWidth: '80px', maxHeight: '80px', flexShrink: 0, overflow: 'hidden', background: '#020617', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Receipt Preview"
                      className="edit-trip-thumb-img w-full h-full object-contain rounded select-none block"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 text-[10px] text-center p-1">
                      <span className="text-xl mb-0.5">📷</span>
                      <span>No photo</span>
                    </div>
                  )}
                </div>

                {/* Actions & Status Beside Thumbnail */}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 m-0">
                      Receipt / Produce Photo
                    </label>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {pendingFile ? '📸 New photo (unsaved)' : (photoPreview ? 'Photo attached' : 'No photo')}
                    </span>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />

                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSaving}
                      className="btn-secondary text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                      id="trigger-change-photo-btn"
                    >
                      <span>📷</span> <span>{photoPreview ? 'Rescan / Change Photo' : 'Add Photo / Scan'}</span>
                    </button>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={isSaving}
                        className="btn-secondary text-xs px-2.5 py-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-300 dark:border-rose-900/40 cursor-pointer"
                        id="remove-trip-photo-btn"
                      >
                        <span>🗑️</span> Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Store Name & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">Store Name</label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  required
                  className="form-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">Purchase Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="form-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Trip Type & Total Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">Trip Type</label>
                <select
                  value={formData.tripType}
                  onChange={(e) => setFormData({ ...formData, tripType: e.target.value })}
                  className="form-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {TRIP_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">Total Amount Paid (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.totalAmountPaid}
                  onChange={(e) => setFormData({ ...formData, totalAmountPaid: e.target.value })}
                  required
                  className="form-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Scale Weight */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                ⚖️ Whole-Grocery Scale Weight (kg)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.totalScaleWeightKg}
                onChange={(e) => setFormData({ ...formData, totalScaleWeightKg: e.target.value })}
                className="form-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            {/* Itemized Purchases */}
            <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Itemized Purchases ({items.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  ➕ Add Item Row
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <div key={it.id || idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={it.name}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      placeholder="e.g. Bangus, Sayote"
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      required
                    />
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={it.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="w-16 px-2 py-1.5 text-xs text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <select
                      value={it.unit || 'kg'}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                      className="w-16 px-2 py-1.5 text-xs text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="pcs">pcs</option>
                      <option value="pack">pack</option>
                      <option value="bundle">bundle</option>
                      <option value="can">can</option>
                      <option value="bottle">bottle</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-rose-500 hover:text-rose-600 p-1 text-sm cursor-pointer"
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">Notes</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="form-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                placeholder="e.g. Weekly family market haul"
              />
            </div>
          </div>

          {/* 3. Footer: Fixed Height, shrink-0, Solid Background with Border */}
          <div
            className="modal-footer edit-trip-footer shrink-0 flex items-center justify-end gap-2 px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: '1px solid #334155', background: '#0f172a', boxSizing: 'border-box' }}
          >
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer"
              id="cancel-edit-trip-btn"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              id="save-edit-trip-btn"
              disabled={isSaving}
            >
              {isSaving ? '💾 Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

