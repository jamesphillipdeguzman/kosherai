import { getShoppingTrips, getGroceryItems } from '../services/courseProjectStorage.js';

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatNumber(num) {
  return Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const TRIP_TYPES = [
  'Supermarket',
  'Wet Market / Palengke',
  'Specialty Pantry',
  'Convenience Store'
];

/**
 * Renders an Edit Modal pre-populated with:
 * Store Name (storeName), Trip Type (tripType), Total Amount Paid (totalAmountPaid),
 * Total Scale Weight (totalScaleWeightKg), Date (date), Notes (notes).
 */
export function renderEditTripModal(state = {}) {
  const tripId = state.editingTripId || state.editingTrip?.id;
  if (!tripId) return '';

  const trips = getShoppingTrips();
  const trip = state.editingTrip || trips.find(t => t.id === tripId);
  if (!trip) return '';

  return `
    <div class="modal-overlay" id="edit-trip-overlay">
      <div class="modal-content" id="edit-trip-modal" role="dialog" aria-modal="true" style="max-width: 620px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.25rem;">✏️</span>
            <div>
              <h2 class="modal-title">Edit Shopping Trip</h2>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">Update store, date, expenditure, or physical scale weight</p>
            </div>
          </div>
          <button class="btn-icon" id="close-edit-trip-btn" type="button" aria-label="Close modal">✕</button>
        </div>

        <form id="edit-trip-form" data-trip-id="${trip.id}">
          <div class="form-group">
            <label class="form-label" for="edit-store-name">Store Name</label>
            <input type="text" id="edit-store-name" name="storeName" class="form-input" value="${escapeHtml(trip.storeName)}" required />
          </div>

          <div class="form-row-grid">
            <div class="form-group">
              <label class="form-label" for="edit-trip-date">Date</label>
              <input type="date" id="edit-trip-date" name="date" class="form-input" value="${trip.date}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="edit-trip-type">Trip Type</label>
              <select id="edit-trip-type" name="tripType" class="form-input">
                ${TRIP_TYPES.map(t => `<option value="${t}" ${(trip.tripType === t || trip.trip_type === t) ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Whole-Grocery Scale Weight -->
          <div class="scale-weight-field mb-3">
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1" for="edit-scale-weight">
              ⚖️ Whole-Grocery Scale Weight (kg)
            </label>
            <div class="scale-weight-wrapper relative flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus-within:border-emerald-500">
              <input type="number" step="0.01" min="0" id="edit-scale-weight" name="totalScaleWeightKg" class="scale-weight-input w-full bg-transparent text-slate-900 dark:text-white font-semibold outline-none border-none focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500" value="${trip.totalScaleWeightKg || 0}" required />
              <span class="scale-weight-unit ml-2 select-none text-xs font-bold uppercase text-slate-500 dark:text-slate-400">kg</span>
            </div>
            <p class="scale-weight-help mt-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
              Measured physical weight of food haul on your home scale before unpacking. Kept separate from receipt item weights for academic rigor.
            </p>
          </div>

          <!-- Total Amount Paid -->
          <div class="form-group">
            <label class="form-label" for="edit-total-amount">Total Amount Paid (₱ PHP)</label>
            <input type="number" step="0.01" min="0" id="edit-total-amount" name="totalAmountPaid" class="form-input" value="${trip.totalAmountPaid}" required />
          </div>

          <!-- Notes -->
          <div class="form-group">
            <label class="form-label" for="edit-notes">Notes / Food Highlights</label>
            <input type="text" id="edit-notes" name="notes" class="form-input" value="${escapeHtml(trip.notes || '')}" />
          </div>

          <div class="modal-footer-actions">
            <button type="button" class="btn-secondary" id="cancel-edit-trip-btn">Cancel</button>
            <button type="submit" class="btn-primary" id="save-edit-trip-btn">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Renders an individual shopping trip card with inline editing mode support
 * and Edit (pencil icon) & Delete Trip buttons.
 */
export function renderTripCard(trip, isEditing = false) {
  const items = getGroceryItems(trip.id);

  if (isEditing) {
    return `
      <div class="trip-card is-editing" data-trip-id="${trip.id}">
        <div class="trip-card-header" style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.1rem;">✏️</span>
            <div style="font-weight: 700; font-size: 0.95rem;">Editing Trip: ${escapeHtml(trip.storeName)}</div>
          </div>
        </div>

        <form class="trip-inline-edit-form" data-trip-id="${trip.id}">
          <div class="form-group" style="margin-bottom: 10px;">
            <label class="form-label" for="edit-store-name-${trip.id}">Store Name</label>
            <input type="text" id="edit-store-name-${trip.id}" name="storeName" class="form-input edit-store-name" value="${escapeHtml(trip.storeName)}" required />
          </div>

          <div class="form-row-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
            <div class="form-group">
              <label class="form-label" for="edit-trip-date-${trip.id}">Date</label>
              <input type="date" id="edit-trip-date-${trip.id}" name="date" class="form-input edit-trip-date" value="${trip.date}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="edit-trip-type-${trip.id}">Trip Type</label>
              <select id="edit-trip-type-${trip.id}" name="tripType" class="form-input edit-trip-type">
                ${TRIP_TYPES.map(t => `<option value="${t}" ${(trip.tripType === t || trip.trip_type === t) ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
            <div class="form-group">
              <label class="form-label" for="edit-total-amount-${trip.id}">Total Amount (₱)</label>
              <input type="number" step="0.01" min="0" id="edit-total-amount-${trip.id}" name="totalAmountPaid" class="form-input edit-total-amount" value="${trip.totalAmountPaid}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="edit-scale-weight-${trip.id}">Scale Weight (kg)</label>
              <input type="number" step="0.01" min="0" id="edit-scale-weight-${trip.id}" name="totalScaleWeightKg" class="form-input edit-scale-weight" value="${trip.totalScaleWeightKg || 0}" required />
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" for="edit-notes-${trip.id}">Notes</label>
            <input type="text" id="edit-notes-${trip.id}" name="notes" class="form-input edit-notes" value="${escapeHtml(trip.notes || '')}" />
          </div>

          <div class="trip-card-footer" style="display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; border-top: 1px solid var(--border-color);">
            <button type="button" class="btn-secondary cancel-edit-trip-btn" data-cancel-trip="${trip.id}">Cancel</button>
            <button type="submit" class="btn-primary save-edit-trip-btn" data-save-trip="${trip.id}">Save Changes</button>
          </div>
        </form>
      </div>
    `;
  }

  return `
    <div class="trip-card" data-trip-id="${trip.id}">
      <div class="trip-card-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="trip-store-icon">${(trip.tripType || '').includes('Wet') ? '🐟' : '🛒'}</span>
          <div>
            <div class="trip-store-name">${escapeHtml(trip.storeName)}</div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 2px;">
              <span class="trip-date-pill">Week ${trip.projectWeek} • ${trip.date}</span>
              ${trip.synced === false ? `
                <span class="trip-sync-badge offline" title="Saved locally in IndexedDB; will auto-sync to Neon when online">
                  ☁️⏳ Offline
                </span>
              ` : `
                <span class="trip-sync-badge synced" title="Synced with Neon PostgreSQL cloud database">
                  ☁️✓ Neon Synced
                </span>
              `}
            </div>
          </div>
        </div>
        <div class="trip-price-tag">₱${formatNumber(trip.totalAmountPaid)}</div>
      </div>

      <div class="trip-metrics-row">
        <div class="trip-metric">
          <span class="metric-label">Whole Scale Weight</span>
          <span class="metric-val text-cyan">${trip.totalScaleWeightKg > 0 ? `${Number(trip.totalScaleWeightKg).toFixed(2)} kg` : 'Not Weighed'}</span>
        </div>
        <div class="trip-metric">
          <span class="metric-label">Items Count</span>
          <span class="metric-val">${items.length || trip.itemsCount || 0} items</span>
        </div>
        <div class="trip-metric">
          <span class="metric-label">Trip Type</span>
          <span class="metric-val">${escapeHtml(trip.tripType || trip.trip_type || 'Supermarket')}</span>
        </div>
      </div>

      ${trip.receiptImageUrl ? `
        <div class="trip-receipt-preview">
          <img src="${trip.receiptImageUrl}" alt="Receipt image" loading="lazy" />
          <span class="receipt-attached-badge">Receipt Attached</span>
        </div>
      ` : ''}

      <!-- Items Preview -->
      ${items.length > 0 ? `
        <div class="trip-items-preview">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">Extracted Items:</div>
          <div class="trip-items-chips">
            ${items.slice(0, 5).map(i => `
              <span class="item-mini-chip status-${(i.lidStatus || 'SAFE').toLowerCase()}">
                ${escapeHtml(i.name)} (${i.quantity} ${i.unit})
              </span>
            `).join('')}
            ${items.length > 5 ? `<span class="item-mini-chip" style="background: var(--bg-card-hover);">+${items.length - 5} more</span>` : ''}
          </div>
        </div>
      ` : ''}

      <div class="trip-card-footer" style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
        <button type="button" class="btn-text edit-trip-btn" data-edit-trip="${trip.id}" title="Edit Trip">
          ✏️ Edit
        </button>
        <button type="button" class="btn-text delete-trip-btn" data-delete-trip="${trip.id}" title="Delete Trip">
          🗑️ Delete Trip
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders the Shopping Trips Tab view container
 */
export function renderShoppingTripsView(state = {}) {
  const trips = getShoppingTrips();

  return `
    <div class="trips-view-container">
      <!-- Actions Bar -->
      <div class="trips-action-bar">
        <div>
          <h2 class="section-title">Shopping Trips & Supermarket Receipts</h2>
          <p class="section-desc">
            Record shopping runs, scan receipts with AI document OCR, and input the <strong>whole-grocery physical scale weight</strong>.
          </p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn-secondary" id="open-manual-trip-btn">✍️ Add Manual Trip</button>
          <button class="btn-primary" id="open-receipt-scanner-btn">📷 Scan Food</button>
          <button class="btn-secondary" id="manual-sync-trips-btn" title="Synchronize local IndexedDB trips to Neon PostgreSQL">☁️ Sync Neon</button>
          <button class="btn-secondary" id="restore-neon-btn" title="Pull and restore latest data from Neon PostgreSQL cloud">☁️ Restore from Neon</button>
        </div>
      </div>

      <!-- Quick Guidance Callout -->
      <div class="guidance-callout">
        <span class="callout-icon">⚖️</span>
        <div>
          <strong>Whole-Grocery Scale Measurement:</strong>
          Upon arriving home from grocery shopping, weigh the entire food haul together using a kitchen scale or luggage scale (in kg). 
          This provides the physical mass baseline for food consumption and waste ratio analysis.
        </div>
      </div>

      <!-- Trips List -->
      ${trips.length === 0 ? `
        <div class="empty-state-card">
          <div class="empty-icon">🧾</div>
          <h3>No Shopping Trips Recorded Yet</h3>
          <p>Scan your first grocery receipt from your camera/phone or add a manual trip record for Week 1 baseline.</p>
          <div style="display: flex; gap: 10px; justify-content: center; margin-top: 14px;">
            <button class="btn-primary" id="empty-scan-btn">📷 Scan Food</button>
          </div>
        </div>
      ` : `
        <div class="trips-grid">
          ${trips.map(trip => renderTripCard(trip, state.editingTripId === trip.id)).join('')}
        </div>
      `}
    </div>
  `;
}
