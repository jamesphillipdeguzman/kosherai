import React, { useState, useEffect } from 'react';
import { getGroceryItems } from '../services/courseProjectStorage.js';
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
    const currentItemName = item?.name || item?.raw_receipt_text || item?.rawReceiptText || item?.itemName || trip?.extractedItemName || '';
    const currentQty = item?.quantity ?? item?.qty ?? 1;
    const currentUnit = item?.unit ?? 'pc';

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
      itemQuantity: currentQty,
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
    if (onSave) onSave(tripId, { ...editForm, itemName, itemQuantity, itemUnit });
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
                <div className="trip-card-footer">
                  <button type="button" className="btn-secondary cancel-edit-trip-btn" onClick={cancelEdit}>Cancel</button>
                  <button type="button" className="btn-primary save-edit-trip-btn" onClick={() => handleSave(trip.id)}>Save Changes</button>
                </div>
              </div>
            );
          }

          return (
            <div key={trip.id} className="trip-card" data-trip-id={trip.id}>
              <div className="trip-store-name">{trip.storeName}</div>
              <div className="trip-card-footer">
                <button type="button" className="btn-text edit-trip-btn" data-edit-trip={trip.id} onClick={() => startEdit(trip)}>
                  ✏️ Edit
                </button>
                <button type="button" className="btn-text delete-trip-btn" data-delete-trip={trip.id} onClick={() => onDelete && onDelete(trip.id)}>
                  🗑️ Delete Trip
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
