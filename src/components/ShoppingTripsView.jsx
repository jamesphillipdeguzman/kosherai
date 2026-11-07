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
export default function ShoppingTripsView({
  trips: propTrips,
  shoppingTrips,
  filteredTrips,
  onEdit,
  onDelete,
  onSave,
  editingTripId,
  selectedWeek,
  onSelectGrocery,
  onSelectTrip
}) {
  const rawTrips = propTrips || shoppingTrips || filteredTrips || (typeof getShoppingTrips === 'function' ? getShoppingTrips() : []);
  const allTrips = Array.isArray(rawTrips) ? rawTrips : [];
  const [activeWeekFilter, setActiveWeekFilter] = useState(selectedWeek || 'all');
  const [selectedGrocery, setSelectedGrocery] = useState(null);
  const [editingId, setEditingId] = useState(editingTripId || null);
  const [lightboxTrip, setLightboxTrip] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnit, setItemUnit] = useState('kg');

  const trips = (activeWeekFilter && activeWeekFilter !== 'all')
    ? allTrips.filter(t => Number(t.projectWeek) === Number(activeWeekFilter))
    : allTrips;

  useEffect(() => {
    if (!lightboxTrip) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLightboxTrip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
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
      {/* Week Filter Bar (W01–W06) */}
      <div className="week-filter-bar flex items-center gap-2 mb-4 overflow-x-auto py-1">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Week Filter:</span>
        <button
          type="button"
          className={`week-filter-chip px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${activeWeekFilter === 'all' ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}`}
          onClick={() => setActiveWeekFilter('all')}
        >
          All Weeks ({allTrips.length})
        </button>
        {[1, 2, 3, 4, 5, 6].map(w => {
          const count = allTrips.filter(t => Number(t.projectWeek) === w).length;
          const isSelected = Number(activeWeekFilter) === w;
          return (
            <button
              key={w}
              type="button"
              className={`week-filter-chip px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${isSelected ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}`}
              onClick={() => setActiveWeekFilter(w)}
            >
              W0{w} {count > 0 ? `(${count})` : ''}
            </button>
          );
        })}
      </div>

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

          let items = getGroceryItems(trip.id);
          if (!items || items.length === 0) {
            if (Array.isArray(trip.items) && trip.items.length > 0) items = trip.items;
            else if (Array.isArray(trip.rawItems) && trip.rawItems.length > 0) items = trip.rawItems;
            else if (Array.isArray(trip.extractedItems) && trip.extractedItems.length > 0) items = trip.extractedItems;
            else if (Array.isArray(trip.groceryItems) && trip.groceryItems.length > 0) items = trip.groceryItems;
            else items = [];
          }

          return (
            <div
              key={trip.id}
              className={`trip-card ${trip.receiptImageUrl ? 'cursor-pointer' : ''}`}
              data-trip-id={trip.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (trip.receiptImageUrl) {
                  setLightboxTrip(trip);
                }
                if (onSelectTrip) onSelectTrip(trip);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (trip.receiptImageUrl) setLightboxTrip(trip);
                  if (onSelectTrip) onSelectTrip(trip);
                }
              }}
            >
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxTrip(trip);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
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

              {/* Extracted Items / Grocery Cards Preview */}
              {items.length > 0 && (
                <div className="trip-items-preview my-2.5">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Extracted Items:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.slice(0, 5).map((i, idx) => (
                      <span
                        key={i.id || idx}
                        className={`item-mini-chip grocery-card status-${(i.lidStatus || 'SAFE').toLowerCase()} cursor-pointer hover:opacity-80 transition-opacity`}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectGrocery) onSelectGrocery(i);
                          else setSelectedGrocery(i);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onSelectGrocery) onSelectGrocery(i);
                            else setSelectedGrocery(i);
                          }
                        }}
                        title="Click to view food details"
                      >
                        {i.name} ({i.quantity} {i.unit})
                      </span>
                    ))}
                    {items.length > 5 ? (
                      <span className="item-mini-chip" style={{ background: 'var(--bg-card-hover, rgba(148, 163, 184, 0.15))' }}>
                        +{items.length - 5} more
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100/80 dark:border-slate-800/80">
                {/* Modern Edit Button */}
                <button
                  type="button"
                  className="edit-trip-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 shadow-xs transition-all active:scale-95 cursor-pointer dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                  data-edit-trip={trip.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(trip);
                  }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDelete) onDelete(trip.id);
                  }}
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

      {/* Grocery Item Details Modal */}
      {selectedGrocery && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedGrocery(null)}
        >
          <div
            className="modal-content max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Itemized Grocery Record</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">{selectedGrocery.name}</h3>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                onClick={() => setSelectedGrocery(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="my-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl mb-3 flex items-center gap-3">
                <span className="text-2xl">🥬</span>
                <div>
                  <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    {selectedGrocery.lidStatus || 'SAFE'} on Active Diet
                  </div>
                  <div className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    {selectedGrocery.quantity} {selectedGrocery.unit} {selectedGrocery.unitPrice ? `• ₱${formatNumber(selectedGrocery.unitPrice)}/${selectedGrocery.unit}` : ''}
                  </div>
                </div>
              </div>
              {selectedGrocery.totalPrice ? (
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                  <strong>Total Expense:</strong> ₱{formatNumber(selectedGrocery.totalPrice)}
                </p>
              ) : null}
              {selectedGrocery.weightGrams ? (
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                  <strong>Net Weight:</strong> {selectedGrocery.weightGrams} g
                </p>
              ) : null}
              {selectedGrocery.rawReceiptText ? (
                <p className="text-xs text-slate-500 font-mono mt-2">
                  <strong>Receipt Line:</strong> {selectedGrocery.rawReceiptText}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer"
                onClick={() => setSelectedGrocery(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxTrip && (
        <div
          className="modal-overlay receipt-lightbox-overlay fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]"
          role="dialog"
          aria-modal="true"
          aria-label="Receipt Photo Lightbox"
          style={{ zIndex: 200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setLightboxTrip(null); }}
        >
          <div
            className="lightbox-modal-content max-w-lg w-full mx-auto flex flex-col max-h-[85dvh] bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden relative"
            style={{ maxHeight: '85dvh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="lightbox-header flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg shrink-0">🧾</span>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-white m-0 truncate flex items-center gap-2">
                    <span className="truncate">{lightboxTrip.storeName || 'Shopping Trip'}</span>
                    <span className="text-[11px] text-slate-400 font-normal hidden sm:inline shrink-0">(Esc to close)</span>
                  </h3>
                  <p className="text-xs text-slate-400 m-0 truncate">{lightboxTrip.date} • {lightboxTrip.tripType || lightboxTrip.trip_type || 'Supermarket'}</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                onClick={() => setLightboxTrip(null)}
                aria-label="Close Lightbox"
              >
                ✕
              </button>
            </div>

            {/* Full Image Container */}
            <div className="lightbox-img-wrapper flex-1 min-h-0 w-full flex items-center justify-center bg-slate-950 p-2 sm:p-3 overflow-hidden select-none">
              {lightboxTrip.receiptImageUrl ? (
                <img
                  src={lightboxTrip.receiptImageUrl}
                  alt={`Full photo for ${lightboxTrip.storeName}`}
                  className="lightbox-full-img max-h-[50dvh] sm:max-h-[52dvh] max-w-full w-auto h-auto object-contain rounded-lg shadow-md"
                  loading="eager"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs sm:text-sm">⚠️ Receipt image could not be loaded or is unavailable.</div>';
                    }
                  }}
                />
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs sm:text-sm">
                  📷 No photo attached to this shopping trip.
                </div>
              )}
            </div>

            {/* Metadata Footer */}
            <div className="lightbox-footer shrink-0 px-4 py-3 bg-slate-900 border-t border-slate-800 text-white">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5 tracking-wider">Amount Paid</span>
                  <span className="font-bold text-xs sm:text-sm text-emerald-400 font-mono">₱{formatNumber(lightboxTrip.totalAmountPaid)}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5 tracking-wider">Scale Weight</span>
                  <span className="font-bold text-xs sm:text-sm text-cyan-300 font-mono">{lightboxTrip.totalScaleWeightKg > 0 ? `${Number(lightboxTrip.totalScaleWeightKg).toFixed(2)} kg` : '—'}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5 tracking-wider">Items Count</span>
                  <span className="font-bold text-xs sm:text-sm text-slate-200 font-mono">{lightboxTrip.itemsCount || (lightboxTrip.items?.length || 0)} items</span>
                </div>
              </div>
              {lightboxTrip.notes ? (
                <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 line-clamp-2">
                  <strong className="text-slate-400 font-medium">Notes:</strong> {lightboxTrip.notes}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
