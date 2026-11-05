import React, { useState } from 'react';
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
 * Optional React component representation for React-based harnesses
 */
export default function ShoppingTripsView({ trips = [], onEdit, onDelete, onSave, editingTripId }) {
  const [editingId, setEditingId] = useState(editingTripId || null);
  const [editForm, setEditForm] = useState({});

  const startEdit = (trip) => {
    setEditingId(trip.id);
    setEditForm({
      storeName: trip.storeName || '',
      tripType: trip.tripType || 'Supermarket',
      totalAmountPaid: trip.totalAmountPaid || 0,
      totalScaleWeightKg: trip.totalScaleWeightKg || 0,
      date: trip.date || '',
      notes: trip.notes || ''
    });
    if (onEdit) onEdit(trip);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = (tripId) => {
    if (onSave) onSave(tripId, editForm);
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
