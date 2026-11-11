import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Starting Edit Shopping Trip Per-Item Pricing Preservation Test Suite...\n');

// File paths
const editModalPath = path.resolve('src/components/EditShoppingTripModal.jsx');
const shoppingTripsJsPath = path.resolve('src/components/ShoppingTripsView.js');
const shoppingTripsJsxPath = path.resolve('src/components/ShoppingTripsView.jsx');
const mainJsPath = path.resolve('src/main.js');
const storagePath = path.resolve('src/services/courseProjectStorage.js');
const tripsApiPath = path.resolve('api/trips.js');
const groceryPurchasesPath = path.resolve('src/components/GroceryPurchasesView.jsx');

const editModalSrc = fs.readFileSync(editModalPath, 'utf8');
const shoppingTripsJsSrc = fs.readFileSync(shoppingTripsJsPath, 'utf8');
const shoppingTripsJsxSrc = fs.readFileSync(shoppingTripsJsxPath, 'utf8');
const mainJsSrc = fs.readFileSync(mainJsPath, 'utf8');
const storageSrc = fs.readFileSync(storagePath, 'utf8');
const tripsApiSrc = fs.readFileSync(tripsApiPath, 'utf8');
const groceryPurchasesSrc = fs.readFileSync(groceryPurchasesPath, 'utf8');

// =========================================================================
// SECTION 1: EditShoppingTripModal.jsx Component Requirements & State
// =========================================================================
console.log('--- Section 1: EditShoppingTripModal.jsx Pricing & Two-Tier Layout ---');

// 1.1 Item mapping in useEffect preserves unitPrice, price, totalPrice, lineTotal
assert.ok(editModalSrc.includes('const price = (item.price !== undefined'), 'useEffect maps item.price');
assert.ok(editModalSrc.includes('const lineTotal = (item.totalPrice !== undefined'), 'useEffect maps item.totalPrice / lineTotal');
assert.ok(editModalSrc.includes('unitPrice: Number(price) || 0'), 'useEffect stores unitPrice');
assert.ok(editModalSrc.includes('totalPrice: Math.round(Number(lineTotal) * 100) / 100 || 0'), 'useEffect stores totalPrice');

// 1.2 handleItemChange dynamically recalculates line total when price or quantity changes
assert.ok(editModalSrc.includes('if (field === \'price\') current.unitPrice = value;'), 'handleItemChange keeps price & unitPrice in sync');
assert.ok(editModalSrc.includes('const calcTotal = Math.round(qty * price * 100) / 100;'), 'handleItemChange dynamically calculates total');
assert.ok(editModalSrc.includes('current.totalPrice = calcTotal;'), 'handleItemChange updates totalPrice');
assert.ok(editModalSrc.includes('current.lineTotal = calcTotal;'), 'handleItemChange updates lineTotal');

// 1.3 handleAddItem initializes price and line total fields
assert.ok(editModalSrc.includes('price: 0'), 'handleAddItem initializes price');
assert.ok(editModalSrc.includes('unitPrice: 0'), 'handleAddItem initializes unitPrice');
assert.ok(editModalSrc.includes('totalPrice: 0'), 'handleAddItem initializes totalPrice');

// 1.4 Two-tier item rendering: Row 1 (Name + Remove), Row 2 (Qty, Unit, Price, Total)
assert.ok(editModalSrc.includes('placeholder="e.g. Bangus, Sayote"'), 'Row 1 renders item name input');
assert.ok(editModalSrc.includes('title="Remove item"'), 'Row 1 renders remove item button');
assert.ok(editModalSrc.includes('grid grid-cols-4 gap-2 items-end'), 'Row 2 uses 4-column responsive grid');
assert.ok(editModalSrc.includes('placeholder="Qty"'), 'Row 2 renders quantity input');
assert.ok(editModalSrc.includes('placeholder="₱ Price"'), 'Row 2 renders price input');
assert.ok(editModalSrc.includes('text-emerald-500 dark:text-emerald-400 truncate'), 'Row 2 renders distinct emerald line total');
assert.ok(editModalSrc.includes('₱{(Number(it.quantity || 0) * Number(it.price !== undefined ? it.price : (it.unitPrice || 0))).toFixed(2)}'), 'Line total calculated correctly in JSX');

// 1.5 handleSubmit preserves itemized pricing in updated payload
assert.ok(editModalSrc.includes('const processedItems = items.map'), 'handleSubmit processes items array');
assert.ok(editModalSrc.includes('unitPrice: price'), 'handleSubmit includes unitPrice');
assert.ok(editModalSrc.includes('totalPrice: lineTotal'), 'handleSubmit includes totalPrice');

console.log('  ✅ EditShoppingTripModal.jsx two-tier layout, dynamic calculation, and state preservation verified.');

// =========================================================================
// SECTION 2: ShoppingTripsView.js & ShoppingTripsView.jsx Parity
// =========================================================================
console.log('\n--- Section 2: ShoppingTripsView Markup & Two-Tier Item Rendering ---');

// 2.1 ShoppingTripsView.js modal template renders two-tier card layout with price & line total
assert.ok(shoppingTripsJsSrc.includes('name="itemPrice"'), 'renderEditTripModal renders itemPrice input');
assert.ok(shoppingTripsJsSrc.includes('edit-item-price'), 'renderEditTripModal has edit-item-price class');
assert.ok(shoppingTripsJsSrc.includes('edit-item-total'), 'renderEditTripModal has edit-item-total class');
assert.ok(shoppingTripsJsSrc.includes('id="add-edit-trip-item-btn"'), 'renderEditTripModal provides Add Item Row button');
assert.ok(shoppingTripsJsSrc.includes('btn-remove-edit-item'), 'renderEditTripModal provides remove item button');

// 2.2 ShoppingTripsView.js inline card edit renders two-tier layout with price & line total
assert.ok(shoppingTripsJsSrc.includes('id="edit-item-price-${trip.id}"'), 'renderTripCard inline edit renders itemPrice');
assert.ok(shoppingTripsJsSrc.includes('edit-item-total-display'), 'renderTripCard inline edit renders total display');

// 2.3 ShoppingTripsView.jsx inline card edit renders two-tier layout with price & line total
assert.ok(shoppingTripsJsxSrc.includes('setItemPrice'), 'ShoppingTripsView.jsx defines setItemPrice state');
assert.ok(shoppingTripsJsxSrc.includes('setItemTotalPrice'), 'ShoppingTripsView.jsx defines setItemTotalPrice state');
assert.ok(shoppingTripsJsxSrc.includes('placeholder="₱ Price"'), 'ShoppingTripsView.jsx renders price input');
assert.ok(shoppingTripsJsxSrc.includes('updateShoppingTrip(tripId, formValues)'), 'ShoppingTripsView.jsx saves trip with pricing');

console.log('  ✅ ShoppingTripsView.js and ShoppingTripsView.jsx two-tier layouts and pricing inputs verified.');

// =========================================================================
// SECTION 3: Event Wiring & Dynamic Calculations in main.js
// =========================================================================
console.log('\n--- Section 3: main.js Form Submission & Dynamic Calculations ---');

// 3.1 #edit-trip-form reads price and line total from item rows
assert.ok(mainJsSrc.includes('row.querySelector(\'.edit-item-price\')'), 'main.js reads price from .edit-item-price');
assert.ok(mainJsSrc.includes('row.querySelector(\'.edit-item-total\')'), 'main.js reads total from .edit-item-total');
assert.ok(mainJsSrc.includes('unitPrice: price'), 'main.js pushes unitPrice into items array');
assert.ok(mainJsSrc.includes('totalPrice: lineTotal'), 'main.js pushes totalPrice into items array');

// 3.2 Single-item fallback in main.js reads price and line total
assert.ok(mainJsSrc.includes('document.querySelector(\'#edit-item-price\')'), 'main.js reads #edit-item-price');
assert.ok(mainJsSrc.includes('document.querySelector(\'.edit-item-total\')'), 'main.js reads .edit-item-total');

// 3.3 Dynamic calculation listeners in main.js for modal and inline forms
assert.ok(mainJsSrc.includes('editTripModalEl.addEventListener(\'input\''), 'main.js attaches dynamic input listener on edit modal');
assert.ok(mainJsSrc.includes('trip-inline-edit-form\').forEach'), 'main.js attaches dynamic input listener on inline edit forms');
assert.ok(mainJsSrc.includes('addEditTripItemBtn.addEventListener(\'click\''), 'main.js wires Add Item Row button to append two-tier item cards');
assert.ok(mainJsSrc.includes('btn-remove-edit-item'), 'main.js wires remove item buttons');

console.log('  ✅ main.js submission extraction and real-time calculation listeners verified.');

// =========================================================================
// SECTION 4: Storage Service Layer Persistence (courseProjectStorage.js)
// =========================================================================
console.log('\n--- Section 4: courseProjectStorage.js Pricing Preservation ---');

// 4.1 Batch item updates preserve and update unitPrice and totalPrice
assert.ok(storageSrc.includes('item.unitPrice = itemPrice;'), 'updateShoppingTrip updates item.unitPrice on existing items');
assert.ok(storageSrc.includes('item.totalPrice = itemLineTotal;'), 'updateShoppingTrip updates item.totalPrice on existing items');

// 4.2 Appending new items during edit retains pricing
assert.ok(storageSrc.includes('const itemPrice = Number(newItem.unitPrice !== undefined ? newItem.unitPrice : (newItem.price || 0));'), 'New items in edit preserve unitPrice');
assert.ok(storageSrc.includes('unitPrice: itemPrice'), 'New items saved with unitPrice');
assert.ok(storageSrc.includes('totalPrice: itemTotal'), 'New items saved with totalPrice');

// 4.3 Single-item edit fallback updates item pricing
assert.ok(storageSrc.includes('const singlePrice = (updatedFields.price !== undefined'), 'Single item edit fallback handles updated price');
assert.ok(storageSrc.includes('item.unitPrice = singlePrice;'), 'Single item edit updates item.unitPrice');
assert.ok(storageSrc.includes('item.totalPrice = singleTotal;'), 'Single item edit updates item.totalPrice');

// 4.4 Background sync PATCH payload includes pricing
assert.ok(storageSrc.includes('unitPrice: (tripItems[0]?.unitPrice !== undefined'), 'PATCH payload includes unitPrice');
assert.ok(storageSrc.includes('totalPrice: (tripItems[0]?.totalPrice !== undefined'), 'PATCH payload includes totalPrice');

console.log('  ✅ courseProjectStorage.js data flow and storage updates verified.');

// =========================================================================
// SECTION 5: Backend API Endpoint Persistence (api/trips.js)
// =========================================================================
console.log('\n--- Section 5: api/trips.js SQL Persistence & Response Mapping ---');

// 5.1 Single-item SQL query in PATCH /api/trips updates unit_price and total_price
assert.ok(tripsApiSrc.includes('unit_price = COALESCE(${cleanUnitPrice}, unit_price)'), 'SQL updates unit_price in single-item PATCH');
assert.ok(tripsApiSrc.includes('total_price = COALESCE(${cleanTotalPrice}, total_price)'), 'SQL updates total_price in single-item PATCH');

// 5.2 Batch items SQL query in PATCH /api/trips upserts unit_price and total_price
assert.ok(tripsApiSrc.includes('INSERT INTO grocery_purchases'), 'Batch items uses INSERT INTO grocery_purchases in PATCH');
assert.ok(tripsApiSrc.includes('unit_price = COALESCE(${iUnitPrice}, grocery_purchases.unit_price)'), 'Batch items updates unit_price ON CONFLICT');
assert.ok(tripsApiSrc.includes('total_price = COALESCE(${iTotalPrice}, grocery_purchases.total_price)'), 'Batch items updates total_price ON CONFLICT');

// 5.3 Responses format unitPrice, price, totalPrice, lineTotal
assert.ok(tripsApiSrc.includes('unitPrice: Number(p.unit_price || 0)'), 'formattedItems maps unitPrice');
assert.ok(tripsApiSrc.includes('price: Number(p.unit_price || 0)'), 'formattedItems maps price alias');
assert.ok(tripsApiSrc.includes('totalPrice: Number(p.total_price || 0)'), 'formattedItems maps totalPrice');
assert.ok(tripsApiSrc.includes('lineTotal: Number(p.total_price || 0)'), 'formattedItems maps lineTotal alias');

console.log('  ✅ api/trips.js SQL queries and formatted item mappings verified.');

// =========================================================================
// SECTION 6: Grocery Purchases View Defensive Fallbacks
// =========================================================================
console.log('\n--- Section 6: GroceryPurchasesView.jsx Defensive Fallbacks ---');

// 6.1 Table cell renders unitPrice with fallback to price
assert.ok(groceryPurchasesSrc.includes('formatNumber(i.unitPrice !== undefined && i.unitPrice !== null ? i.unitPrice : i.price)'), 'GroceryPurchasesView handles unitPrice / price fallback in table');
assert.ok(groceryPurchasesSrc.includes('formatNumber(i.totalPrice !== undefined && i.totalPrice !== null ? i.totalPrice : (i.lineTotal !== undefined && i.lineTotal !== null ? i.lineTotal : ((Number(i.quantity) || 1) * (Number(i.unitPrice ?? i.price) || 0))))'), 'GroceryPurchasesView handles totalPrice / lineTotal fallback in table');

// 6.2 Modal details render unitPrice and lineTotal with fallbacks
assert.ok(groceryPurchasesSrc.includes('formatNumber(selectedItem.unitPrice !== undefined && selectedItem.unitPrice !== null ? selectedItem.unitPrice : selectedItem.price)'), 'GroceryPurchasesView details modal handles unitPrice / price fallback');
assert.ok(groceryPurchasesSrc.includes('formatNumber(selectedItem.totalPrice !== undefined && selectedItem.totalPrice !== null ? selectedItem.totalPrice : (selectedItem.lineTotal !== undefined && selectedItem.lineTotal !== null ? selectedItem.lineTotal : ((Number(selectedItem.quantity) || 1) * (Number(selectedItem.unitPrice ?? selectedItem.price) || 0))))'), 'GroceryPurchasesView details modal handles totalPrice / lineTotal fallback');

console.log('  ✅ GroceryPurchasesView.jsx defensive fallbacks verified.');

// =========================================================================
// SECTION 7: Functional Data-Flow Execution (Storage & API Integration)
// =========================================================================
console.log('\n--- Section 7: Functional Data-Flow Execution & Persistence ---');

// Setup mock browser environment for functional execution
const mockStore = new Map();
global.localStorage = {
  getItem: (key) => mockStore.get(String(key)) ?? null,
  setItem: (key, val) => mockStore.set(String(key), String(val)),
  removeItem: (key) => mockStore.delete(String(key)),
  clear: () => mockStore.clear()
};

global.window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  CustomEvent: class {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
};

const { saveShoppingTrip, getShoppingTrips, getGroceryItems, updateShoppingTrip } = await import('../src/services/courseProjectStorage.js');

// 7.1 Multi-item shopping trip creation and edit
const tripInput = {
  storeName: 'Robinsons Supermarket',
  date: '2026-11-10',
  totalScaleWeightKg: 2.5,
  totalAmountPaid: 435.00,
  tripType: 'Supermarket',
  notes: 'Weekly fresh produce'
};

const initialItems = [
  {
    id: 'item_multi_1',
    name: 'Bangus (Milkfish)',
    quantity: 2,
    unit: 'pcs',
    unitPrice: 180,
    price: 180,
    totalPrice: 360,
    lineTotal: 360
  },
  {
    id: 'item_multi_2',
    name: 'Sayote',
    quantity: 3,
    unit: 'pcs',
    unitPrice: 25,
    price: 25,
    totalPrice: 75,
    lineTotal: 75
  }
];

const saved = await saveShoppingTrip(tripInput, initialItems);
const tripId = saved?.trip?.id || saved?.id;
assert.ok(tripId, 'Trip successfully saved with ID');

const itemsBeforeEdit = getGroceryItems(tripId);
assert.strictEqual(itemsBeforeEdit.length, 2, 'Initial 2 items retrieved');
assert.strictEqual(itemsBeforeEdit[0].unitPrice, 180, 'Bangus unitPrice is 180');
assert.strictEqual(itemsBeforeEdit[0].totalPrice, 360, 'Bangus totalPrice is 360');
assert.strictEqual(itemsBeforeEdit[1].unitPrice, 25, 'Sayote unitPrice is 25');
assert.strictEqual(itemsBeforeEdit[1].totalPrice, 75, 'Sayote totalPrice is 75');

// 7.2 Perform edit with updated pricing and an added item
await updateShoppingTrip(tripId, {
  storeName: 'Robinsons Supermarket Galleria',
  totalScaleWeightKg: 2.8,
  totalAmountPaid: 690.00,
  items: [
    // Update Bangus quantity and price
    {
      id: 'item_multi_1',
      name: 'Fresh Bangus (Milkfish)',
      quantity: 3,
      unit: 'pcs',
      price: 190,
      unitPrice: 190,
      totalPrice: 570,
      lineTotal: 570
    },
    // Sayote retained
    {
      id: 'item_multi_2',
      name: 'Sayote',
      quantity: 3,
      unit: 'pcs',
      price: 25,
      unitPrice: 25,
      totalPrice: 75,
      lineTotal: 75
    },
    // Add Garlic
    {
      id: 'item_multi_3',
      name: 'Garlic Native',
      quantity: 1,
      unit: 'pack',
      price: 45,
      unitPrice: 45,
      totalPrice: 45,
      lineTotal: 45
    }
  ]
});

const itemsAfterEdit = getGroceryItems(tripId);
assert.strictEqual(itemsAfterEdit.length, 3, '3 items present after edit');

const updatedBangus = itemsAfterEdit.find(i => i.id === 'item_multi_1');
assert.ok(updatedBangus, 'Updated Bangus found');
assert.strictEqual(updatedBangus.quantity, 3, 'Bangus quantity updated to 3');
assert.strictEqual(updatedBangus.unitPrice, 190, 'Bangus unitPrice updated to 190');
assert.strictEqual(updatedBangus.totalPrice, 570, 'Bangus totalPrice recalculated to 570');

const retainedSayote = itemsAfterEdit.find(i => i.id === 'item_multi_2');
assert.ok(retainedSayote, 'Retained Sayote found');
assert.strictEqual(retainedSayote.unitPrice, 25, 'Sayote unitPrice preserved at 25');
assert.strictEqual(retainedSayote.totalPrice, 75, 'Sayote totalPrice preserved at 75');

const addedGarlic = itemsAfterEdit.find(i => i.id === 'item_multi_3');
assert.ok(addedGarlic, 'Added Garlic found');
assert.strictEqual(addedGarlic.unitPrice, 45, 'Added Garlic has unitPrice 45');
assert.strictEqual(addedGarlic.totalPrice, 45, 'Added Garlic has totalPrice 45');

// 7.3 Single-item photo capture trip edit
const singleTripInput = {
  storeName: 'Monterey Meatshop',
  date: '2026-11-10',
  totalScaleWeightKg: 1.5,
  totalAmountPaid: 525.00,
  tripType: 'Specialty Grocery'
};

const singleInitialItems = [
  {
    id: 'item_single_1',
    name: 'Pork Liempo',
    quantity: 1.5,
    unit: 'kg',
    price: 350,
    unitPrice: 350,
    totalPrice: 525,
    lineTotal: 525
  }
];

const savedSingle = await saveShoppingTrip(singleTripInput, singleInitialItems);
const singleTripId = savedSingle?.trip?.id || savedSingle?.id;

// Edit single item via single-item update fields
await updateShoppingTrip(singleTripId, {
  itemName: 'Choice Pork Liempo Cut',
  itemQty: 2.0,
  itemUnit: 'kg',
  price: 360,
  totalPrice: 720
});

const singleItemsAfterEdit = getGroceryItems(singleTripId);
assert.strictEqual(singleItemsAfterEdit.length, 1, '1 item present for single trip');
assert.strictEqual(singleItemsAfterEdit[0].name, 'Choice Pork Liempo Cut', 'Single item name updated');
assert.strictEqual(singleItemsAfterEdit[0].quantity, 2.0, 'Single item quantity updated');
assert.strictEqual(singleItemsAfterEdit[0].unitPrice, 360, 'Single item unitPrice updated to 360');
assert.strictEqual(singleItemsAfterEdit[0].totalPrice, 720, 'Single item totalPrice updated to 720');

console.log('  ✅ End-to-end multi-item & single-item editing workflows preserved and updated pricing correctly.');

console.log('\n======================================================================');
console.log('🎉 ALL EDIT SHOPPING TRIP PER-ITEM PRICING PRESERVATION TESTS PASSED!');
console.log('======================================================================\n');
