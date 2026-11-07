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

  let items = getGroceryItems(trip.id);
  if (!items || items.length === 0) {
    if (Array.isArray(trip.items) && trip.items.length > 0) items = trip.items;
    else if (Array.isArray(trip.rawItems) && trip.rawItems.length > 0) items = trip.rawItems;
    else if (Array.isArray(trip.extractedItems) && trip.extractedItems.length > 0) items = trip.extractedItems;
    else if (Array.isArray(trip.groceryItems) && trip.groceryItems.length > 0) items = trip.groceryItems;
    else items = [];
  }

  const primaryItem = items[0] || null;
  const currentItemName = primaryItem?.name || primaryItem?.raw_receipt_text || primaryItem?.rawReceiptText || primaryItem?.itemName || trip?.extractedItemName || '';
  const currentQuantity = (primaryItem?.quantity !== undefined && primaryItem?.quantity !== null && primaryItem?.quantity !== '')
    ? primaryItem.quantity
    : (primaryItem?.qty ?? 1);
  const currentUnit = primaryItem?.unit || 'kg';

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

          <!-- Item Name / Extracted Item -->
          <div class="form-group mb-3">
            <label class="form-label" for="edit-item-name">Item Name / Extracted Item</label>
            ${items.length > 1 ? `
              <div class="edit-items-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; padding-right: 4px; margin-top: 4px;">
                ${items.map((item, idx) => {
    const rowName = item?.name || item?.raw_receipt_text || item?.rawReceiptText || item?.itemName || '';
    const rowQty = (item?.quantity !== undefined && item?.quantity !== null && item?.quantity !== '') ? item.quantity : (item?.qty ?? 1);
    const rowUnit = item?.unit || 'kg';
    return `
                    <div class="edit-item-row flex items-center gap-2 w-full" data-item-id="${item.id}" style="display: flex; align-items: center; gap: 8px; width: 100%;">
                      <!-- 1. Item Name Input (Takes up most of the space) -->
                      <input
                        type="text"
                        ${idx === 0 ? 'id="edit-item-name"' : ''}
                        name="itemName"
                        class="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 form-input edit-item-name"
                        style="flex: 1 1 auto; min-width: 0; width: 100%;"
                        placeholder="e.g. Bangus, Garlic, Cucumber"
                        value="${escapeHtml(rowName)}"
                        required
                      />

                      <!-- 2. Quantity Input (Fixed compact width) -->
                      <input
                        type="number"
                        step="any"
                        ${idx === 0 ? 'id="edit-item-qty"' : ''}
                        name="itemQty"
                        class="w-20 px-3 py-2 border rounded-lg text-sm text-center bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 form-input edit-item-qty"
                        style="width: 80px; min-width: 80px; max-width: 80px; text-align: center;"
                        placeholder="Qty"
                        value="${rowQty}"
                      />

                      <!-- 3. Unit Input / Selector (Fixed compact width) -->
                      <input
                        type="text"
                        ${idx === 0 ? 'id="edit-item-unit"' : ''}
                        name="itemUnit"
                        class="w-20 px-3 py-2 border rounded-lg text-sm text-center bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 form-input edit-item-unit"
                        style="width: 80px; min-width: 80px; max-width: 80px; text-align: center;"
                        placeholder="Unit (pc, kg)"
                        value="${escapeHtml(rowUnit)}"
                      />
                    </div>
                  `;
  }).join('')}
              </div>
            ` : `
              <div class="flex items-center gap-2 w-full" style="display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 4px;">
                <!-- 1. Item Name Input (Takes up most of the space) -->
                <input
                  type="text"
                  id="edit-item-name"
                  name="itemName"
                  class="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 form-input edit-item-name"
                  style="flex: 1 1 auto; min-width: 0; width: 100%;"
                  placeholder="e.g. Bangus, Garlic, Cucumber"
                  value="${escapeHtml(currentItemName)}"
                />

                <!-- 2. Quantity Input (Fixed compact width) -->
                <input
                  type="number"
                  step="any"
                  id="edit-item-qty"
                  name="itemQty"
                  class="w-20 px-3 py-2 border rounded-lg text-sm text-center bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 form-input edit-item-qty"
                  style="width: 80px; min-width: 80px; max-width: 80px; text-align: center;"
                  placeholder="Qty"
                  value="${currentQuantity}"
                />

                <!-- 3. Unit Input / Selector (Fixed compact width) -->
                <input
                  type="text"
                  id="edit-item-unit"
                  name="itemUnit"
                  class="w-20 px-3 py-2 border rounded-lg text-sm text-center bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 form-input edit-item-unit"
                  style="width: 80px; min-width: 80px; max-width: 80px; text-align: center;"
                  placeholder="Unit (pc, kg)"
                  value="${escapeHtml(currentUnit)}"
                />
              </div>
            `}
            <p class="mt-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
              Modifies itemized grocery purchase records linked to this trip.
            </p>
          </div>

          <!-- Notes -->
          <div class="form-group">
            <label class="form-label" for="edit-notes">Notes / Food Highlights</label>
            <input type="text" id="edit-notes" name="notes" class="form-input" value="${escapeHtml(trip.notes || '')}" />
          </div>

          <!-- Receipt / Produce Photo Management -->
          <div class="form-group edit-trip-photo-section mb-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70">
            <div class="flex items-center justify-between mb-2">
              <label class="form-label font-bold text-xs uppercase tracking-wider m-0 flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span>📷</span> Receipt / Produce Photo
              </label>
              <span id="edit-photo-status-badge" class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                ${trip.receiptImageUrl ? 'Photo Attached' : 'No Photo'}
              </span>
            </div>

            <!-- Hidden File Input for Mobile Camera & Desktop File Selection -->
            <input type="file" id="edit-trip-file-input" accept="image/*" capture="environment" style="display: none;" />
            <input type="hidden" id="edit-trip-receipt-url" name="receiptImageUrl" value="${trip.receiptImageUrl || ''}" />

            <!-- Photo Thumbnail / Preview Box -->
            <div id="edit-trip-photo-preview-container" class="w-full">
              ${trip.receiptImageUrl ? `
                <div class="relative w-full rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-black/40 flex items-center justify-center max-h-[180px] p-1">
                  <img id="edit-trip-photo-preview-img" src="${trip.receiptImageUrl}" alt="Current receipt photo" class="max-h-[170px] w-auto max-w-full object-contain rounded" />
                </div>
              ` : `
                <div id="edit-trip-photo-placeholder" class="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  No receipt photo attached yet.
                </div>
              `}
            </div>

            <!-- Photo Action Buttons -->
            <div class="flex flex-wrap items-center gap-2 mt-3">
              <button type="button" class="btn-secondary text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer" id="trigger-change-photo-btn">
                <span>📷</span> <span id="change-photo-btn-text">${trip.receiptImageUrl ? 'Rescan / Change Photo' : 'Add Photo / Scan'}</span>
              </button>
              <button type="button" class="btn-secondary text-xs px-3 py-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-300 dark:border-rose-900/40 cursor-pointer ${trip.receiptImageUrl ? '' : 'hidden'}" id="remove-trip-photo-btn" style="${trip.receiptImageUrl ? '' : 'display: none;'}">
                <span>🗑️</span> Remove Photo
              </button>
              <button type="button" class="border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${trip.receiptImageUrl ? '' : 'hidden'}" id="rerun-ocr-edit-btn" style="${trip.receiptImageUrl ? '' : 'display: none;'}" title="Extract items from photo using OCR">
                <span>⚡</span> Rerun OCR
              </button>
            </div>
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
  let items = getGroceryItems(trip.id);
  if (!items || items.length === 0) {
    if (Array.isArray(trip.items) && trip.items.length > 0) items = trip.items;
    else if (Array.isArray(trip.rawItems) && trip.rawItems.length > 0) items = trip.rawItems;
    else if (Array.isArray(trip.extractedItems) && trip.extractedItems.length > 0) items = trip.extractedItems;
    else if (Array.isArray(trip.groceryItems) && trip.groceryItems.length > 0) items = trip.groceryItems;
    else items = [];
  }
  const primaryItem = items[0] || null;
  const currentItemName = primaryItem?.name || primaryItem?.raw_receipt_text || primaryItem?.rawReceiptText || primaryItem?.itemName || trip?.extractedItemName || '';
  const currentQuantity = (primaryItem?.quantity !== undefined && primaryItem?.quantity !== null && primaryItem?.quantity !== '')
    ? primaryItem.quantity
    : (primaryItem?.qty ?? 1);
  const currentUnit = primaryItem?.unit || 'kg';

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

          <div class="form-group" style="margin-bottom: 10px;">
            <label class="form-label" for="edit-item-name-${trip.id}">Item Name / Extracted Item</label>
            <div class="flex items-center gap-2 w-full" style="display: flex; align-items: center; gap: 8px; width: 100%;">
              <input
                type="text"
                id="edit-item-name-${trip.id}"
                name="itemName"
                class="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 form-input edit-item-name"
                style="flex: 1 1 auto; min-width: 0; width: 100%;"
                value="${escapeHtml(currentItemName)}"
                placeholder="e.g. Bangus, Garlic, Cucumber"
              />
              <input
                type="number"
                step="any"
                id="edit-item-qty-${trip.id}"
                name="itemQty"
                class="w-20 px-3 py-2 border rounded-lg text-sm text-center bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 form-input edit-item-qty"
                style="width: 80px; min-width: 80px; max-width: 80px; text-align: center;"
                value="${currentQuantity}"
                placeholder="Qty"
              />
              <input
                type="text"
                id="edit-item-unit-${trip.id}"
                name="itemUnit"
                class="w-20 px-3 py-2 border rounded-lg text-sm text-center bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 form-input edit-item-unit"
                style="width: 80px; min-width: 80px; max-width: 80px; text-align: center;"
                value="${escapeHtml(currentUnit)}"
                placeholder="Unit (pc, kg)"
              />
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" for="edit-notes-${trip.id}">Notes</label>
            <input type="text" id="edit-notes-${trip.id}" name="notes" class="form-input edit-notes" value="${escapeHtml(trip.notes || '')}" />
          </div>

          <div class="trip-card-footer flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
            <button type="button" class="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer cancel-edit-trip-btn" data-cancel-trip="${trip.id}">Cancel</button>
            <button type="submit" class="rounded-lg px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 transition-all shadow-xs cursor-pointer save-edit-trip-btn" data-save-trip="${trip.id}">Save Changes</button>
          </div>
        </form>
      </div>
    `;
  }

  return `
    <div class="trip-card ${trip.receiptImageUrl ? 'cursor-pointer' : ''}" data-trip-id="${trip.id}" ${trip.receiptImageUrl ? `data-lightbox-trip-id="${trip.id}"` : ''}>
      <div class="trip-card-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="trip-store-icon">${(trip.tripType || '').includes('Wet') ? '🐟' : '🛒'}</span>
          <div>
            <div class="trip-store-name">${escapeHtml(trip.storeName)}</div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 2px;">
              <span class="trip-date-pill">Week ${trip.projectWeek} • ${trip.date}</span>
              ${trip.synced === false ? `
                <span class="trip-sync-badge offline" title="Saved locally in IndexedDB; will auto-sync to Neon when online">
                  ☁️⏳ OFFLINE
                </span>
              ` : `
                <span class="trip-sync-badge synced" title="Synced with Neon PostgreSQL cloud database">
                  ☁️✓ NEON SYNCED
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
        <div class="trip-receipt-preview cursor-pointer group" role="button" tabindex="0" data-lightbox-trip-id="${trip.id}" title="Click to view full photo">
          <img src="${trip.receiptImageUrl}" alt="Receipt photo for ${escapeHtml(trip.storeName)}" loading="lazy" class="group-hover:opacity-95 transition-opacity" />
          <span class="receipt-attached-badge flex items-center gap-1">
            <span>🔍</span> <span>View Full Photo</span>
          </span>
        </div>
      ` : ''}

      <!-- Items Preview -->
      ${items.length > 0 ? `
        <div class="trip-items-preview">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">Extracted Items:</div>
          <div class="trip-items-chips">
            ${items.slice(0, 5).map(i => `
              <span class="item-mini-chip grocery-card status-${(i.lidStatus || 'SAFE').toLowerCase()} cursor-pointer hover:opacity-85 transition-opacity" data-grocery-name="${escapeHtml(i.name)}" role="button" tabindex="0" title="Click to view food details and guidance">
                ${escapeHtml(i.name)} (${i.quantity} ${i.unit})
              </span>
            `).join('')}
            ${items.length > 5 ? `<span class="item-mini-chip" style="background: var(--bg-card-hover);">+${items.length - 5} more</span>` : ''}
          </div>
        </div>
      ` : ''}

      <div class="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100/80 dark:border-slate-800/80">
        <!-- Modern Edit Button -->
        <button
          type="button"
          class="edit-trip-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 shadow-xs transition-all active:scale-95 cursor-pointer dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
          data-edit-trip="${trip.id}"
          style="all: unset; display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; border-radius: 9999px; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; cursor: pointer;"
        >
          <svg style="width: 14px; height: 14px; flex-shrink: 0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span>Edit</span>
        </button>

        <!-- Modern Delete Button -->
        <button
          type="button"
          class="delete-trip-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 shadow-xs transition-all active:scale-95 cursor-pointer dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
          data-delete-trip="${trip.id}"
          style="all: unset; display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; border-radius: 9999px; background-color: #fff1f2; color: #be123c; border: 1px solid #fecdd3; cursor: pointer;"
        >
          <svg style="width: 14px; height: 14px; flex-shrink: 0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Delete</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders the Shopping Trips Tab view container
 */
export function renderShoppingTripsView(state = {}) {
  const allTrips = (state.trips && state.trips.length > 0) ? state.trips : getShoppingTrips();
  const activeWeekFilter = state.tripsWeekFilter || (state.selectedWeekView ? String(state.selectedWeekView) : 'all');
  const trips = (activeWeekFilter && activeWeekFilter !== 'all')
    ? allTrips.filter(t => Number(t.projectWeek) === Number(activeWeekFilter))
    : allTrips;

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

      <!-- Week Filtering (W01–W06) -->
      <div class="week-filter-bar flex items-center gap-2 mb-4 overflow-x-auto py-1">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Week Filter:</span>
        <button type="button" class="week-filter-chip px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${activeWeekFilter === 'all' ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}" data-trips-filter="all">
          All Weeks (${allTrips.length})
        </button>
        ${[1, 2, 3, 4, 5, 6].map(w => {
          const count = allTrips.filter(t => Number(t.projectWeek) === w).length;
          const isSelected = Number(activeWeekFilter) === w;
          return `
            <button type="button" class="week-filter-chip px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${isSelected ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}" data-trips-filter="${w}">
              W0${w} ${count > 0 ? `(${count})` : ''}
            </button>
          `;
        }).join('')}
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

/**
 * Renders an accessible full-screen Lightbox Modal displaying the uncropped receipt / produce image
 * with strict dimensions (min(92vw, 420px), max-h-[80dvh], image max-h-[35dvh], object-contain)
 * and guaranteed visible metadata footer.
 */
export function renderReceiptLightboxModal(trip) {
  if (!trip || !trip.receiptImageUrl) return '';

  return `
    <div class="modal-overlay receipt-lightbox-overlay" id="receipt-lightbox-overlay" role="dialog" aria-modal="true" aria-label="Receipt Photo Lightbox" style="position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; background: rgba(2, 6, 23, 0.88); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 12px; padding-bottom: max(16px, env(safe-area-inset-bottom, 16px)); box-sizing: border-box;">
      <div class="lightbox-dialog lightbox-modal-content" style="width: min(92vw, 420px); max-width: 420px; max-height: 80vh; max-height: 80dvh; height: auto; display: flex; flex-direction: column; overflow: hidden; background: #0f172a; color: #ffffff; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7); margin: auto; box-sizing: border-box;" onclick="event.stopPropagation();">
        
        <!-- Header: Fixed Natural Height -->
        <div class="lightbox-header" style="flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #0f172a; border-bottom: 1px solid #1e293b; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden;">
            <span style="font-size: 1.1rem; flex-shrink: 0;">🧾</span>
            <div style="min-width: 0; overflow: hidden;">
              <h3 style="font-weight: 700; font-size: 0.9rem; color: #ffffff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 8px;">
                <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHtml(trip.storeName || 'Shopping Trip')}</span>
                <span style="font-size: 11px; color: #94a3b8; font-weight: 400; flex-shrink: 0;">(Esc to close)</span>
              </h3>
              <p style="font-size: 11px; color: #94a3b8; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${trip.date} • ${escapeHtml(trip.tripType || trip.trip_type || 'Supermarket')}</p>
            </div>
          </div>
          <button type="button" class="btn-icon" id="close-lightbox-btn" aria-label="Close Lightbox" style="color: #94a3b8; background: #1e293b; border: none; border-radius: 9999px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; margin-left: 8px;">✕</button>
        </div>

        <!-- Image Area: Strictly Max 35dvh with Dark Neutral Background -->
        <div class="lightbox-image-stage lightbox-img-wrapper" style="flex: 0 1 auto; max-height: 35vh; max-height: 35dvh; min-height: 80px; height: auto; width: 100%; display: flex; align-items: center; justify-content: center; background: #020617; padding: 6px; overflow: hidden; box-sizing: border-box; user-select: none;">
          ${trip.receiptImageUrl ? `
            <img 
              src="${trip.receiptImageUrl}" 
              alt="Full receipt photo for ${escapeHtml(trip.storeName)}" 
              class="lightbox-photo lightbox-full-img object-contain"
              style="width: auto; height: auto; max-width: 100%; max-height: 35vh; max-height: 35dvh; object-fit: contain; display: block; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); margin: 0 auto;"
              loading="eager"
              onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;\\'>⚠️ Image could not be loaded or is unavailable.</div>';"
            />
          ` : `
            <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
              📷 No photo attached to this shopping trip.
            </div>
          `}
        </div>

        <!-- Details Footer: Solid Opaque Background, Always Visible (flex-shrink: 0) -->
        <div class="lightbox-footer-card lightbox-footer" style="flex-shrink: 0; background: #0f172a; border-top: 1px solid #1e293b; padding: 10px 14px; box-sizing: border-box; color: #ffffff;">
          <div class="lightbox-metadata-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">
            <div class="lightbox-meta-box" style="background: #020617; border: 1px solid #1e293b; border-radius: 10px; padding: 6px 4px; display: flex; flex-direction: column; justify-content: center;">
              <span class="lightbox-meta-label" style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 2px;">Amount Paid</span>
              <span class="lightbox-meta-val" style="font-size: 13px; font-weight: 700; color: #34d399; font-family: monospace;">₱${formatNumber(trip.totalAmountPaid)}</span>
            </div>
            <div class="lightbox-meta-box" style="background: #020617; border: 1px solid #1e293b; border-radius: 10px; padding: 6px 4px; display: flex; flex-direction: column; justify-content: center;">
              <span class="lightbox-meta-label" style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 2px;">Scale Weight</span>
              <span class="lightbox-meta-val" style="font-size: 13px; font-weight: 700; color: #67e8f9; font-family: monospace;">${trip.totalScaleWeightKg > 0 ? `${Number(trip.totalScaleWeightKg).toFixed(2)} kg` : '—'}</span>
            </div>
            <div class="lightbox-meta-box" style="background: #020617; border: 1px solid #1e293b; border-radius: 10px; padding: 6px 4px; display: flex; flex-direction: column; justify-content: center;">
              <span class="lightbox-meta-label" style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 2px;">Items Count</span>
              <span class="lightbox-meta-val" style="font-size: 13px; font-weight: 700; color: #e2e8f0; font-family: monospace;">${trip.itemsCount || (trip.items?.length || 0)} items</span>
            </div>
          </div>
          ${trip.notes ? `
            <div class="lightbox-notes-box" style="margin-top: 8px; background: #020617; border: 1px solid rgba(51, 65, 85, 0.7); border-radius: 10px; padding: 6px 10px; font-size: 11px; color: #cbd5e1; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              <strong style="color: #94a3b8; font-weight: 600;">Notes:</strong> ${escapeHtml(trip.notes)}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

