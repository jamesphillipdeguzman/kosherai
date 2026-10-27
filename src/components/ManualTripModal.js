/**
 * Manual Trip Entry Modal (for wet market / palengke without receipts)
 * Captures high-level trip metadata (store, date, total cost, scale weight, notes)
 * and itemized purchases (item name, qty & unit, line price)
 */

export function parseQuantityAndUnit(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') {
    return { quantity: 1, unit: 'pcs', weightGrams: 0 };
  }

  const trimmed = rawStr.trim();
  if (!trimmed) {
    return { quantity: 1, unit: 'pcs', weightGrams: 0 };
  }

  const match = trimmed.match(/^([\d.,]+)\s*(.*)$/);
  let quantity = 1;
  let unit = 'pcs';

  if (match) {
    const parsedNum = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(parsedNum) && parsedNum > 0) {
      quantity = parsedNum;
    }
    const unitPart = match[2]?.trim();
    if (unitPart) {
      unit = unitPart;
    }
  } else {
    unit = trimmed;
  }

  let weightGrams = 0;
  const unitLower = unit.toLowerCase();

  if (unitLower === 'kg' || unitLower === 'kgs' || unitLower === 'kilo' || unitLower === 'kilos' || unitLower === 'kilogram' || unitLower === 'kilograms') {
    weightGrams = Math.round(quantity * 1000);
    unit = 'kg';
  } else if (unitLower === 'g' || unitLower === 'gm' || unitLower === 'gram' || unitLower === 'grams') {
    weightGrams = Math.round(quantity);
    unit = 'g';
  } else if (unitLower === 'pc' || unitLower === 'pcs' || unitLower === 'piece' || unitLower === 'pieces') {
    unit = 'pcs';
  }

  return { quantity, unit, weightGrams };
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createManualItemRowHtml(name = '', qtyUnit = '1 pcs', price = '') {
  return `
    <tr class="manual-item-row border-b border-slate-200 dark:border-slate-800 transition-colors">
      <td style="padding: 6px 8px;">
        <input type="text" class="table-input manual-item-name w-full" placeholder="e.g. Sayote" value="${escapeHtml(name)}" />
      </td>
      <td style="padding: 6px 8px; width: 130px;">
        <input type="text" class="table-input manual-item-qty-unit w-full" placeholder="e.g. 2 pcs or 1 kg" value="${escapeHtml(qtyUnit)}" />
      </td>
      <td style="padding: 6px 8px; width: 110px;">
        <input type="number" step="0.01" min="0" class="table-input manual-item-price w-full" placeholder="0.00" value="${price !== '' ? price : ''}" style="text-align: right;" />
      </td>
      <td style="padding: 6px 4px; width: 38px; text-align: center;">
        <button type="button" class="btn-icon remove-manual-item-btn text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg" title="Remove Item" style="width: 28px; height: 28px; min-height: unset; line-height: 1; padding: 0;">✕</button>
      </td>
    </tr>
  `;
}

export function renderManualTripModal(state = {}) {
  const currentDate = new Date().toISOString().split('T')[0];

  return `
    <div class="modal-overlay" id="manual-trip-overlay">
      <div class="modal-content" role="dialog" aria-modal="true" style="max-width: 620px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.25rem;">✍️</span>
            <div>
              <h2 class="modal-title">Manual Shopping Trip Entry</h2>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">Record wet market, palengke, or receipt-less food purchases</p>
            </div>
          </div>
          <button class="btn-icon" id="close-manual-trip-btn" type="button" aria-label="Close modal">✕</button>
        </div>

        <form id="manual-trip-form">
          <div class="form-group">
            <label class="form-label" for="manual-store-name">Store or Market Name</label>
            <input type="text" id="manual-store-name" class="form-input" placeholder="e.g. Local Wet Market / Palengke" required />
          </div>

          <div class="form-row-grid">
            <div class="form-group">
              <label class="form-label" for="manual-trip-date">Date</label>
              <input type="date" id="manual-trip-date" class="form-input" value="${currentDate}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="manual-trip-type">Trip Type</label>
              <select id="manual-trip-type" class="form-input">
                <option value="Wet Market / Palengke">Wet Market / Palengke</option>
                <option value="Supermarket">Supermarket</option>
                <option value="Specialty Pantry">Specialty Pantry</option>
                <option value="Convenience Store">Convenience Store</option>
              </select>
            </div>
          </div>

          <!-- CRITICAL FIELD: Whole-Grocery Scale Weight Card -->
          <div class="rounded-2xl p-4 bg-teal-50/70 border border-teal-200/80 dark:bg-slate-800/80 dark:border-teal-900/50 transition-colors w-full mb-3">
            <label class="text-xs font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1.5 mb-1.5" for="manual-scale-weight">
              ⚖️ Whole-Grocery Scale Weight (kg)
            </label>
            <input type="number" step="0.01" min="0" id="manual-scale-weight" class="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-teal-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-base focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. 4.25" required />
            <div class="text-[11px] text-teal-700/80 dark:text-slate-400 mt-2 font-normal leading-relaxed">
              Measured physical weight of food haul on your home scale before unpacking.
            </div>
          </div>

          <!-- Total Amount Paid -->
          <div class="form-group">
            <label class="form-label" for="manual-total-amount">Total Amount Paid (₱ PHP)</label>
            <input type="number" step="0.01" min="0" id="manual-total-amount" class="form-input" placeholder="e.g. 1500.00" required />
          </div>

          <!-- Itemized Purchases (Optional) Section -->
          <div class="form-group rounded-2xl p-3.5 bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 transition-colors">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
              <div>
                <label class="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  🥬 Itemized Purchases <span class="text-xs font-normal text-slate-500 dark:text-slate-400">(Optional)</span>
                </label>
                <div class="text-[11px] text-slate-600 dark:text-slate-400 font-normal mt-0.5">
                  Record wet market line items to populate the Neon <code class="font-mono text-teal-700 dark:text-teal-300">grocery_purchases</code> table.
                </div>
              </div>
              <button type="button" class="btn-text hover:bg-emerald-500/10 px-2 py-1 rounded-lg" id="add-manual-item-row" style="color: var(--safe-green, #10b981); font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                ➕ Add Item
              </button>
            </div>

            <div class="receipt-items-table-wrapper" style="max-height: 220px; overflow-y: auto; background: var(--bg-card); border-radius: 8px;">
              <table class="receipt-items-table" id="manual-items-table" style="width: 100%;">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th style="width: 130px;">Qty & Unit</th>
                    <th style="width: 110px; text-align: right;">Line Price (₱)</th>
                    <th style="width: 38px;"></th>
                  </tr>
                </thead>
                <tbody id="manual-items-tbody">
                  ${createManualItemRowHtml('', '1 pcs', '')}
                </tbody>
              </table>
            </div>

            <div id="manual-items-empty-hint" style="display: none; padding: 12px; text-align: center; font-size: 0.78rem; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 8px; margin-top: 6px;">
              No line items added yet. Click <strong>➕ Add Item</strong> to itemize wet market produce or meat.
            </div>

            <div id="manual-items-summary" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.75rem; color: var(--text-muted); padding: 0 4px;">
              <span id="manual-items-count-text">0 items with name</span>
              <button type="button" id="manual-sum-to-total-btn" class="btn-text hover:underline" style="font-size: 0.75rem; color: var(--accent-cyan, #06b6d4); font-weight: 600; cursor: pointer;">
                ⚡ Apply Sum to Total
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="manual-notes">Notes / Food Highlights</label>
            <input type="text" id="manual-notes" class="form-input" placeholder="Fresh vegetables, pork loin, pure kosher salt" />
          </div>

          <div class="modal-footer-actions">
            <button type="button" class="btn-secondary" id="cancel-manual-trip-btn">Cancel</button>
            <button type="submit" class="btn-primary" id="save-manual-trip-btn">Save Shopping Trip</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
