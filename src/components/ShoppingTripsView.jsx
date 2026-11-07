import React, { useState, useEffect } from 'react';
import { getGroceryItems, updateShoppingTrip } from '../services/courseProjectStorage.js';
import {
  escapeHtml,
  formatNumber,
  TRIP_TYPES,
  renderEditTripModal,
  renderTripCard,
  renderShoppingTripsView
} from './ShoppingTripsView.js';

export {
  escapeHtml,
  formatNumber,
  TRIP_TYPES,
  renderEditTripModal,
  renderTripCard,
  renderShoppingTripsView
};

/**
 * React component representation for React-based harnesses
 */
export default function ShoppingTripsView({ trips = [], onEdit, onDelete, onSave, editingTripId }) {
  const [editingId, setEditingId] = useState(editingTripId || null);
  const [lightboxTrip, setLightboxTrip] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnit, setItemUnit] = useState('kg');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && lightboxTrip) {
        setLightboxTrip(null);
      }
    };
    if (lightboxTrip) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxTrip]);

  const startEdit = (trip) => {
    setEditingId(trip.id);
    let allItems = getGroceryItems(trip.id);
    if (!allItems || allItems.length === 0) {
      if (Array.isArray(trip.items) && trip.items.length > 0) allItems = trip.items;
      else if (Array.isArray(trip.rawItems) && trip.rawItems.length > 0) allItems = trip.rawItems;
      else if (Array.isArray(trip.extractedItems) && trip.extractedItems.length > 0) allItems = trip.extractedItems;
      else if (Array.isArray(trip.groceryItems) && trip.groceryItems.length > 0) allItems = trip.groceryItems;
      else allItems = [];
    }
    const item = allItems[0] || {};
    const currentItemName = item?.name || item?.raw_receipt_text || item?.itemName || '';
    const currentQty = (item?.quantity !== undefined && item?.quantity !== null && item?.quantity !== '')
      ? Number(item.quantity)
      : 1;
    const currentUnit = item?.unit || 'kg';

    setItemName(currentItemName);
    setItemQuantity(currentQty);
    setItemUnit(currentUnit);

    setEditForm({
      storeName: trip.storeName || '',
      tripType: trip.tripType || 'Supermarket',
      totalAmountPaid: trip.totalAmountPaid || 0,
      totalScaleWeightKg: trip.totalScaleWeightKg || 0,
      date: trip.date || '',
      notes: trip.notes || '',
      itemName: currentItemName,
      quantity: currentQty,
      itemQuantity: currentQty,
      unit: currentUnit,
      itemUnit: currentUnit
    });
    if (onEdit) onEdit(trip);
  };

  useEffect(() => {
    if (editingTripId) {
      const trip = trips.find(t => t.id === editingTripId);
      if (trip) {
        startEdit(trip);
      }
    }
  }, [editingTripId, trips]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = (tripId) => {
    const formValues = {
      ...editForm,
      itemName: itemName ? itemName.trim() : '',
      quantity: (itemQuantity !== undefined && itemQuantity !== null && itemQuantity !== '' && !isNaN(Number(itemQuantity))) ? Number(itemQuantity) : 1,
      itemQuantity: (itemQuantity !== undefined && itemQuantity !== null && itemQuantity !== '' && !isNaN(Number(itemQuantity))) ? Number(itemQuantity) : 1,
      unit: itemUnit ? itemUnit.trim() : 'kg',
      itemUnit: itemUnit ? itemUnit.trim() : 'kg'
    };

    // Instant local-first save without blocking the UI
    updateShoppingTrip(tripId, formValues);
    if (onSave) onSave(tripId, formValues);
    setEditingId(null);
  };

  return (
    <div className="trips-view-container">
      <div className="trips-grid">
        {trips.map(trip => {
          const isEditing = editingId === trip.id;
          if (isEditing) {
            return (
              <div key={trip.id} className="trip-card is-editing" data-trip-id={trip.id}>
                <div className="form-group">
                  <label htmlFor={`edit-store-name-${trip.id}`}>Store Name</label>
                  <input
                    id={`edit-store-name-${trip.id}`}
                    name="storeName"
                    value={editForm.storeName}
                    onChange={e => setEditForm({ ...editForm, storeName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`edit-trip-type-${trip.id}`}>Trip Type</label>
                  <select
                    id={`edit-trip-type-${trip.id}`}
                    name="tripType"
                    value={editForm.tripType}
                    onChange={e => setEditForm({ ...editForm, tripType: e.target.value })}
                  >
                    {TRIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor={`edit-total-amount-${trip.id}`}>Total Amount Paid</label>
                  <input
                    type="number"
                    id={`edit-total-amount-${trip.id}`}
                    name="totalAmountPaid"
                    value={editForm.totalAmountPaid}
                    onChange={e => setEditForm({ ...editForm, totalAmountPaid: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`edit-scale-weight-${trip.id}`}>Total Scale Weight (kg)</label>
                  <input
                    type="number"
                    id={`edit-scale-weight-${trip.id}`}
                    name="totalScaleWeightKg"
                    value={editForm.totalScaleWeightKg}
                    onChange={e => setEditForm({ ...editForm, totalScaleWeightKg: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`edit-trip-date-${trip.id}`}>Date</label>
                  <input
                    type="date"
                    id={`edit-trip-date-${trip.id}`}
                    name="date"
                    value={editForm.date}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`edit-notes-${trip.id}`}>Notes</label>
                  <input
                    id={`edit-notes-${trip.id}`}
                    name="notes"
                    value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`edit-item-name-${trip.id}`}>Item Name / Extracted Item</label>
                  <div className="flex items-center gap-2 w-full">
                    {/* 1. Item Name Input (Takes up most of the space) */}
                    <input
                      type="text"
                      id={`edit-item-name-${trip.id}`}
                      className="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      placeholder="e.g. Bangus, Garlic, Cucumber"
                      value={itemName}
                      onChange={(e) => {
                        setItemName(e.target.value);
                        setEditForm(prev => ({ ...prev, itemName: e.target.value }));
                      }}
                    />

                    {/* 2. Quantity Input (Fixed compact width) */}
                    <input
                      type="number"
                      step="any"
                      id={`edit-item-qty-${trip.id}`}
                      className="w-20 px-3 py-2 border rounded-lg text-sm text-center bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      placeholder="Qty"
                      value={itemQuantity}
                      onChange={(e) => {
                        setItemQuantity(e.target.value);
                        setEditForm(prev => ({ ...prev, itemQuantity: e.target.value }));
                      }}
                    />

                    {/* 3. Unit Input / Selector (Fixed compact width) */}
                    <input
                      type="text"
                      id={`edit-item-unit-${trip.id}`}
                      className="w-20 px-3 py-2 border rounded-lg text-sm text-center bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      placeholder="Unit (pc, kg)"
                      value={itemUnit}
                      onChange={(e) => {
                        setItemUnit(e.target.value);
                        setEditForm(prev => ({ ...prev, itemUnit: e.target.value }));
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 trip-card-footer">
                  <button type="button" className="btn-secondary cancel-edit-trip-btn" onClick={cancelEdit}>Cancel</button>
                  <button type="button" className="btn-primary save-edit-trip-btn" onClick={() => handleSave(trip.id)}>Save Changes</button>
                </div>
              </div>
            );
          }

          return (
            <div key={trip.id} className="trip-card" data-trip-id={trip.id}>
              <div className="trip-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="trip-store-name">{trip.storeName}</div>
                <div className="trip-sync-badge-container">
                  {trip.synced === false ? (
                    <span className="trip-sync-badge offline" title="Saved locally in IndexedDB; will auto-sync to Neon when online">
                      ☁️⏳ Offline
                    </span>
                  ) : (
                    <span className="trip-sync-badge synced" title="Synced with Neon PostgreSQL cloud database">
                      ☁️✓ Synced
                    </span>
                  )}
                </div>
              </div>

              {/* Clickable Receipt / Produce Photo Thumbnail */}
              {trip.receiptImageUrl && (
                <div
                  className="trip-receipt-preview cursor-pointer group my-3 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/80 max-h-[140px] relative"
                  role="button"
                  tabIndex={0}
                  onClick={() => setLightboxTrip(trip)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setLightboxTrip(trip);
                    }
                  }}
                  title="Click to view full photo"
                >
                  <img
                    src={trip.receiptImageUrl}
                    alt={`Receipt photo for ${trip.storeName}`}
                    className="w-full h-[140px] object-cover block group-hover:scale-102 transition-transform duration-200"
                    loading="lazy"
                  />
                  <span className="receipt-attached-badge absolute bottom-1.5 right-1.5 bg-slate-900/85 text-emerald-400 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
                    <span>🔍</span> View Full Photo
                  </span>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100/80 dark:border-slate-800/80">
                {/* Modern Edit Button */}
                <button
                  type="button"
                  className="edit-trip-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 shadow-xs transition-all active:scale-95 cursor-pointer dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                  data-edit-trip={trip.id}
                  onClick={() => startEdit(trip)}
                  style={{
                    all: 'unset',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '9999px',
                    backgroundColor: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    cursor: 'pointer'
                  }}
                >
                  <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Edit</span>
                </button>

                {/* Modern Delete Button */}
                <button
                  type="button"
                  className="delete-trip-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 shadow-xs transition-all active:scale-95 cursor-pointer dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
                  data-delete-trip={trip.id}
                  onClick={() => onDelete && onDelete(trip.id)}
                  style={{
                    all: 'unset',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '9999px',
                    backgroundColor: '#fff1f2',
                    color: '#be123c',
                    border: '1px solid #fecdd3',
                    cursor: 'pointer'
                  }}
                >
                  <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxTrip && (
        <div
          className="modal-overlay receipt-lightbox-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Receipt Photo Lightbox"
          onClick={(e) => { if (e.target === e.currentTarget) setLightboxTrip(null); }}
        >
          <div
            className="lightbox-modal-content max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-4 bg-slate-900/95 text-white rounded-2xl shadow-2xl border border-slate-700/80 relative"
            style={{ maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-header flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🧾</span>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white m-0">{lightboxTrip.storeName || 'Shopping Trip'}</h3>
                  <p className="text-xs text-slate-400 m-0">{lightboxTrip.date} • {lightboxTrip.tripType || lightboxTrip.trip_type || 'Supermarket'}</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full w-9 h-9 flex items-center justify-center transition-colors cursor-pointer"
                onClick={() => setLightboxTrip(null)}
                aria-label="Close Lightbox"
              >
                ✕
              </button>
            </div>

            <div className="lightbox-img-wrapper w-full flex items-center justify-center bg-black/60 rounded-xl overflow-hidden p-2 min-h-[260px] max-h-[65vh]">
              {lightboxTrip.receiptImageUrl ? (
                <img
                  src={lightboxTrip.receiptImageUrl}
                  alt={`Full photo for ${lightboxTrip.storeName}`}
                  className="lightbox-full-img max-h-[62vh] w-auto max-w-full object-contain rounded-lg shadow-lg select-none"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.innerHTML = '<div class="p-8 text-center text-slate-400 text-sm">⚠️ Receipt image could not be loaded or is unavailable.</div>';
                    }
                  }}
                />
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  📷 No photo attached to this shopping trip.
                </div>
              )}
            </div>

            <div className="lightbox-details-grid grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Total Amount</span>
                <span className="font-bold text-sm text-emerald-400 font-mono">₱{formatNumber(lightboxTrip.totalAmountPaid)}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Whole Scale Weight</span>
                <span className="font-bold text-sm text-cyan-300 font-mono">{lightboxTrip.totalScaleWeightKg > 0 ? `${Number(lightboxTrip.totalScaleWeightKg).toFixed(2)} kg` : 'Not Weighed'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Items Recorded</span>
                <span className="font-bold text-sm text-slate-200">{lightboxTrip.itemsCount || (lightboxTrip.items?.length || 0)} items</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Venue / Trip Type</span>
                <span className="font-bold text-sm text-slate-200 capitalize">{lightboxTrip.tripType || lightboxTrip.trip_type || 'Supermarket'}</span>
              </div>
              {lightboxTrip.notes ? (
                <div className="col-span-2 sm:col-span-4 border-t border-slate-700/50 pt-2 text-slate-300">
                  <strong className="text-slate-400">Notes:</strong> {lightboxTrip.notes}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
