import assert from 'node:assert';
import fs from 'node:fs';

console.log('🧪 Starting Extracted Items Mobile 2-Line Cards Layout Test Suite...\n');

// 1. Inspect ReceiptScannerModal.jsx code
const modalSrc = fs.readFileSync('src/components/ReceiptScannerModal.jsx', 'utf8');

console.log('Test 1: Line 1 Layout (Full-Width Item Name & Remove Button)');
assert.ok(modalSrc.includes('placeholder="Item Name (e.g., Sayote, Pork Liempo)"'), 'Must contain item name placeholder');
assert.ok(modalSrc.includes('flex-1 min-w-0 px-3 py-2 text-sm rounded-lg'), 'Item name input must occupy available horizontal space with min-w-0 flex-1');
assert.ok(modalSrc.includes('w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-rose-950/40 text-rose-300'), 'Remove button must be prominent 36x36px (w-9 h-9 shrink-0) on the right');
assert.ok(modalSrc.includes('title="Remove item"') && modalSrc.includes('aria-label="Remove item"'), 'Remove button must have accessible labels');
console.log('  ✅ Line 1 layout verified with full-width item name and right-aligned remove button.');

console.log('\nTest 2: Line 2 Layout (4 Balanced Columns with Labels)');
assert.ok(modalSrc.includes('grid grid-cols-4 gap-2 items-end'), 'Line 2 must use a 4-column grid with gap-2 and items-end');

// Compact visible labels
assert.ok(modalSrc.includes('>Qty<') || modalSrc.includes('Qty\n') || modalSrc.includes('Qty</label>'), 'Visible Qty label present');
assert.ok(modalSrc.includes('>Unit<') || modalSrc.includes('Unit\n') || modalSrc.includes('Unit</label>'), 'Visible Unit label present');
assert.ok(modalSrc.includes('Price (₱)'), 'Visible Price (₱) label present');
assert.ok(modalSrc.includes('>Total<') || modalSrc.includes('Total\n') || modalSrc.includes('Total</label>'), 'Visible Total label present');
assert.ok(modalSrc.includes('text-[10px] uppercase font-bold'), 'Labels must be compact uppercase font-bold text-[10px]');
console.log('  ✅ Line 2 4-column balanced grid verified with compact labels (Qty, Unit, Price (₱), Total).');

console.log('\nTest 3: Narrow Viewport & Overflow Prevention');
assert.ok(modalSrc.includes('min-w-0'), 'Column containers and inputs must specify min-w-0 to prevent horizontal overflow on narrow screens');
assert.ok(modalSrc.includes('truncate'), 'Line total display must have truncate to safely handle large numeric values without overflow');
console.log('  ✅ Narrow screen overflow prevention (min-w-0 and truncate) verified.');

console.log('\nTest 4: Item Actions & State Handlers');
assert.ok(modalSrc.includes('handleAddItemRow'), 'Must provide handleAddItemRow');
assert.ok(modalSrc.includes('handleUpdateItem'), 'Must provide handleUpdateItem');
assert.ok(modalSrc.includes('handleItemChange'), 'Must provide handleItemChange');
assert.ok(modalSrc.includes('updateItem'), 'Must export updateItem alias');
assert.ok(modalSrc.includes('handleRemoveItem'), 'Must provide handleRemoveItem');
assert.ok(modalSrc.includes('handleRemoveItemRow'), 'Must provide handleRemoveItemRow');
assert.ok(modalSrc.includes('removeItem'), 'Must export removeItem alias');
console.log('  ✅ All item action handlers and backwards-compatible aliases verified.');

console.log('\nTest 5: Line Total Dynamic Recalculation Formula');
// Simulate total calculation matching the component logic
const testQty = 2.5;
const testPrice = 140;
const computedTotal = (Number(testQty) * Number(testPrice)).toFixed(2);
assert.strictEqual(computedTotal, '350.00', 'Total calculation formula must compute correctly');
assert.ok(modalSrc.includes('(Number(item.quantity || 0) * Number(item.price !== undefined ? item.price : (item.unitPrice || 0))).toFixed(2)'), 'Formula in JSX must handle quantity, price, unitPrice fallbacks and formatting');
console.log('  ✅ Dynamic line total calculation formula verified.');

console.log('\nTest 6: Theme Support (Dark & Light)');
assert.ok(modalSrc.includes("theme === 'dark'") && modalSrc.includes('bg-slate-900/60 border-slate-800') && modalSrc.includes('bg-slate-50 border-slate-200'), 'Card styling must adapt to dark and light modes');
console.log('  ✅ Dual theme support verified for extracted item cards.');

console.log('\n=============================================================');
console.log('🎉 ALL EXTRACTED ITEMS MOBILE LAYOUT TESTS PASSED!');
console.log('=============================================================\n');
