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
  const [editForm, setEditForm] = useState({});
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnit, setItemUnit] = useState('pc');

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
    const currentUnit = item?.unit || 'pc';

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
      unit: itemUnit ? itemUnit.trim() : 'pc',
      itemUnit: itemUnit ? itemUnit.trim() : 'pc'
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
                      ☁️✓ Neon Synced
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 trip-card-footer">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium leading-none rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/50 transition-all cursor-pointer edit-trip-btn"
                  data-edit-trip={trip.id}
                  onClick={() => startEdit(trip)}
                  title="Edit Trip"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium leading-none rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-800/50 transition-all cursor-pointer delete-trip-btn"
                  data-delete-trip={trip.id}
                  onClick={() => onDelete && onDelete(trip.id)}
                  title="Delete Trip"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Trip</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
