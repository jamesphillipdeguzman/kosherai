import React, { useState, useEffect } from 'react';
import { getGroceryItems, getShoppingTrips, getProjectConfig, LID_DATABASE } from '../services/courseProjectStorage.js';
import { formatNumber, escapeHtml } from './ShoppingTripsView.js';
import { normalizeWeek, resolveItemWeek, getGroceryItemName, matchesGroceryQuery } from '../utils/weekNormalization.js';

/**
 * GroceryPurchasesView
 *
 * Renders itemized grocery purchases table with single-source-of-truth week filtering
 * and responsive grocery search. Follows parent shopping trip's project week.
 */
export default function GroceryPurchasesView({
  items: propItems,
  trips: propTrips,
  selectedWeek = 'all',
  onSelectWeek,
  onSelectGrocery,
  searchQuery: propSearchQuery,
  onSearchChange
}) {
  const allItems = propItems || (typeof getGroceryItems === 'function' ? getGroceryItems() : []);
  const allTrips = propTrips || (typeof getShoppingTrips === 'function' ? getShoppingTrips() : []);
  const config = typeof getProjectConfig === 'function' ? getProjectConfig() : {};
  const tripsMap = new Map(allTrips.map(t => [t.id, t]));

  const [searchQuery, setSearchQuery] = useState(propSearchQuery || '');

  useEffect(() => {
    if (propSearchQuery !== undefined) {
      setSearchQuery(propSearchQuery);
    }
  }, [propSearchQuery]);

  const normSelectedWeek = normalizeWeek(selectedWeek);
  const cleanQuery = searchQuery.trim().toLowerCase();

  const filteredItems = allItems.filter(i => {
    const weekMatches = normSelectedWeek === 'all' || resolveItemWeek(i, tripsMap, config) === normSelectedWeek;
    if (!weekMatches) return false;
    if (!cleanQuery) return true;
    return matchesGroceryQuery(i, cleanQuery);
  });

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

      {/* Responsive Search Bar for Scanned Grocery Items */}
      <div className="grocery-search-container mb-3 max-w-[580px] w-full">
        <div className="search-box-wrapper relative m-0">
          <svg className="search-icon-left absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            id="grocery-search-input"
            className="search-input w-full pl-11 pr-10 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 box-border"
            placeholder="Search groceries (e.g. Mangga, Bawang, Tilapia)..."
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (onSearchChange) onSearchChange(val);
            }}
            autoComplete="off"
          />
          {searchQuery ? (
            <button
              type="button"
              className="search-clear-btn absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              id="grocery-search-clear"
              aria-label="Clear search"
              onClick={() => {
                setSearchQuery('');
                if (onSearchChange) onSearchChange('');
              }}
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between p-2.5 mb-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
        <span className="text-slate-600 dark:text-slate-300">
          Showing: <strong>{normSelectedWeek === 'all' ? 'All Weeks' : `Week ${normSelectedWeek} (W0${normSelectedWeek})`}</strong> • {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} {cleanQuery ? `matching "${searchQuery}"` : 'recorded'}
        </span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {cleanQuery && (
            <button
              type="button"
              className="text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer"
              onClick={() => {
                setSearchQuery('');
                if (onSearchChange) onSearchChange('');
              }}
            >
              Clear Search
            </button>
          )}
          {normSelectedWeek !== 'all' && onSelectWeek && (
            <button
              type="button"
              className="text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer"
              onClick={() => onSelectWeek('all')}
            >
              Show All Weeks ({allItems.length})
            </button>
          )}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-state-card p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800">
          <div className="text-3xl mb-2">{cleanQuery ? '🔍' : '🥬'}</div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {cleanQuery ? `No groceries matching "${searchQuery}"` : (normSelectedWeek === 'all' ? 'No Grocery Items in Inventory' : `No Grocery Items in Week ${normSelectedWeek}`)}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            {cleanQuery
              ? `No matching items found for ${normSelectedWeek === 'all' ? 'All Weeks' : `Week ${normSelectedWeek}`}. Try a different item name or clear your search.`
              : (normSelectedWeek === 'all'
                ? 'Scan a receipt or add a shopping trip to populate itemized grocery records.'
                : `No itemized groceries recorded for Week ${normSelectedWeek}. Switch to "All Weeks" above to view records.`)}
          </p>
          {cleanQuery && (
            <div className="mt-3.5">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                onClick={() => {
                  setSearchQuery('');
                  if (onSearchChange) onSearchChange('');
                }}
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="table-responsive overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="course-table w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="p-3">Item Description</th>
                <th className="p-3">Store & Week</th>
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
                const displayName = getGroceryItemName(i);
                const dbItem = LID_DATABASE?.find(db => db.name.toLowerCase() === displayName.toLowerCase() || db.id === i.id || db.id === i.itemId);
                const itemId = dbItem?.id || i.itemId || i.id || ('grocery-' + displayName.toLowerCase().replace(/\s+/g, '-'));
                const itemWeek = resolveItemWeek(i, tripsMap, config);
                const parentTrip = tripsMap.get(i.tripId || i.trip_id);

                return (
                  <tr
                    key={i.id || itemId}
                    className="grocery-row grocery-card cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    data-item-id={itemId}
                    data-grocery-name={displayName}
                    onClick={() => onSelectGrocery && onSelectGrocery(i)}
                    role="button"
                    tabIndex={0}
                    title="Click to view food details and guidance"
                  >
                    <td className="p-3">
                      <div className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1.5">
                        <span>{dbItem?.icon || '🥬'}</span>
                        <span>{displayName}</span>
                      </div>
                      {i.rawReceiptText && i.rawReceiptText !== displayName && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{i.rawReceiptText}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      <div>Week {itemWeek} • {i.purchaseDate || parentTrip?.date || '—'}</div>
                      {parentTrip?.storeName && (
                        <div className="text-[10px] text-slate-400">{parentTrip.storeName}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-200">
                      {i.quantity || 1} {i.unit || 'kg'}
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
    </div>
  );
}

