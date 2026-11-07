import React from 'react';
import { getGroceryItems, getShoppingTrips, getProjectConfig, LID_DATABASE } from '../services/courseProjectStorage.js';
import { formatNumber, escapeHtml } from './ShoppingTripsView.js';
import { normalizeWeek, resolveItemWeek } from '../utils/weekNormalization.js';

/**
 * GroceryPurchasesView
 *
 * Renders itemized grocery purchases table with single-source-of-truth week filtering.
 * Follows parent shopping trip's project week.
 */
export default function GroceryPurchasesView({
  items: propItems,
  trips: propTrips,
  selectedWeek = 'all',
  onSelectWeek,
  onSelectGrocery
}) {
  const allItems = propItems || (typeof getGroceryItems === 'function' ? getGroceryItems() : []);
  const allTrips = propTrips || (typeof getShoppingTrips === 'function' ? getShoppingTrips() : []);
  const config = typeof getProjectConfig === 'function' ? getProjectConfig() : {};
  const tripsMap = new Map(allTrips.map(t => [t.id, t]));

  const normSelectedWeek = normalizeWeek(selectedWeek);

  const filteredItems = normSelectedWeek === 'all'
    ? allItems
    : allItems.filter(i => resolveItemWeek(i, tripsMap, config) === normSelectedWeek);

  return (
    <div className="purchases-view-container">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2.5">
        <div>
          <h2 className="section-title text-base sm:text-lg font-bold text-slate-900 dark:text-white m-0">Itemized Grocery Purchases</h2>
          <p className="section-desc text-xs text-slate-500 dark:text-slate-400 m-0">
            All purchased food items across shopping trips, automatically tagged with Low-Iodine Diet (LID) safety indicators.
          </p>
        </div>
        <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {normSelectedWeek === 'all' ? (
            <span>Total Recorded Items: <strong className="text-slate-700 dark:text-slate-200">{allItems.length}</strong></span>
          ) : (
            <span>Week {normSelectedWeek} Items: <strong className="text-slate-700 dark:text-slate-200">{filteredItems.length}</strong> (of {allItems.length})</span>
          )}
        </div>
      </div>

      {normSelectedWeek !== 'all' && (
        <div className="flex items-center justify-between p-2.5 mb-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
          <span className="text-slate-600 dark:text-slate-300">
            Filtered to <strong>Week {normSelectedWeek} (W0{normSelectedWeek})</strong> • {filteredItems.length} items
          </span>
          {onSelectWeek && (
            <button
              type="button"
              className="text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer"
              onClick={() => onSelectWeek('all')}
            >
              Show All Weeks ({allItems.length})
            </button>
          )}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="empty-state-card p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800">
          <div className="text-3xl mb-2">🥬</div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {normSelectedWeek === 'all' ? 'No Grocery Items in Inventory' : `No Grocery Items in Week ${normSelectedWeek}`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            {normSelectedWeek === 'all'
              ? 'Scan a receipt or add a shopping trip to populate itemized grocery records.'
              : `No itemized groceries recorded for Week ${normSelectedWeek}. Switch to "All Weeks" above to view records.`}
          </p>
        </div>
      ) : (
        <div className="table-responsive overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="course-table w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="p-3">Item Description</th>
                <th className="p-3">Week & Date</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Unit Price</th>
                <th className="p-3">Line Total</th>
                <th className="p-3">Net Weight</th>
                <th className="p-3">LID Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredItems.map(i => {
                const status = (i.lidStatus || 'SAFE').toUpperCase();
                const dbItem = LID_DATABASE?.find(db => db.name.toLowerCase() === (i.name || '').toLowerCase() || db.id === i.id || db.id === i.itemId);
                const itemId = dbItem?.id || i.itemId || i.id || ('grocery-' + (i.name || '').toLowerCase().replace(/\s+/g, '-'));
                const itemWeek = resolveItemWeek(i, tripsMap, config);
                const parentTrip = tripsMap.get(i.tripId || i.trip_id);

                return (
                  <tr
                    key={i.id || itemId}
                    className="grocery-row grocery-card cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    data-item-id={itemId}
                    data-grocery-name={i.name}
                    onClick={() => onSelectGrocery && onSelectGrocery(i)}
                    role="button"
                    tabIndex={0}
                    title="Click to view food details and guidance"
                  >
                    <td className="p-3">
                      <div className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1.5">
                        <span>{dbItem?.icon || '🥬'}</span>
                        <span>{i.name}</span>
                      </div>
                      {i.rawReceiptText && i.rawReceiptText !== i.name && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{i.rawReceiptText}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      Week {itemWeek} • {i.purchaseDate || parentTrip?.date || '—'}
                    </td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-200">
                      {i.quantity} {i.unit}
                    </td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-200">
                      ₱{formatNumber(i.unitPrice)}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                      ₱{formatNumber(i.totalPrice)}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {i.weightGrams ? `${i.weightGrams} g` : '—'}
                    </td>
                    <td className="p-3">
                      <span className={`status-tag px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                        status === 'SAFE'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : status === 'AVOID'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {status === 'SAFE' ? '🟢 Safe' : (status === 'AVOID' ? '🔴 Avoid' : '🟡 Caution')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

