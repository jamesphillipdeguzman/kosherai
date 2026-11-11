import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Starting Receipt Item Layout & OCR Normal Scroll Test Suite...\n');

const modalPath = path.resolve('src/components/ReceiptScannerModal.jsx');
const courseViewPath = path.resolve('src/components/CourseProjectView.js');
const stylePath = path.resolve('src/style.css');

const modalSrc = fs.readFileSync(modalPath, 'utf8');
const courseViewSrc = fs.readFileSync(courseViewPath, 'utf8');
const styleSrc = fs.readFileSync(stylePath, 'utf8');

// =========================================================================
// SECTION 1: AI / Neural OCR Toggle Document Flow & Normal Scrolling
// =========================================================================
console.log('--- Section 1: AI / Neural OCR Toggle Non-Sticky & Scrollable Document Flow ---');

// 1.1 In ReceiptScannerModal.jsx, verify the OCR toggle is inside the scrollable container
const scrollableBodyIdx = modalSrc.indexOf('flex-1 overflow-y-auto');
const ocrToggleInModalIdx = modalSrc.indexOf('AI / Neural OCR Scanning');
assert.ok(scrollableBodyIdx > 0, 'ReceiptScannerModal must define scrollable body (overflow-y-auto)');
assert.ok(ocrToggleInModalIdx > scrollableBodyIdx, 'AI / Neural OCR Toggle must be positioned inside scrollable body to scroll naturally');

// 1.2 In CourseProjectView.js, verify the OCR toggle is inside receipt-scanner-split
const splitBodyIdx = courseViewSrc.indexOf('receipt-scanner-split');
const ocrToggleInCourseIdx = courseViewSrc.indexOf('AI / Neural OCR Scanning');
assert.ok(splitBodyIdx > 0, 'CourseProjectView must define split scrollable body');
assert.ok(ocrToggleInCourseIdx > splitBodyIdx, 'AI / Neural OCR Toggle must be positioned inside receipt-scanner-split to scroll naturally');

// 1.3 In style.css, verify non-sticky / normal static positioning
assert.ok(styleSrc.includes('.ocr-toggle-card'), 'style.css defines .ocr-toggle-card');
assert.ok(styleSrc.includes('position: static !important;'), 'style.css enforces position: static !important on OCR toggle');
assert.ok(!styleSrc.includes('.ocr-toggle-card {\\n  position: sticky'), 'OCR toggle must NOT have position: sticky');
console.log('  ✅ AI / Neural OCR Toggle is placed in scrollable containers and styled with normal static flow.');

// =========================================================================
// SECTION 2: Two-Tier Receipt Item Layout
// =========================================================================
console.log('\n--- Section 2: Two-Tier Receipt Item Layout Structure ---');

// 2.1 Row 1: Item Name & Delete Button
assert.ok(modalSrc.includes('placeholder="Item Name (e.g., Sayote, Pork Liempo)"'), 'Item name input present with placeholder');
assert.ok(modalSrc.includes('flex-1 min-w-0'), 'Item name occupies available width with min-w-0 flex-1');
assert.ok(modalSrc.includes('title="Remove item"'), 'Delete button present with title');
assert.ok(modalSrc.includes('w-9 h-9 shrink-0'), 'Delete button has consistent touch target');
assert.ok(modalSrc.includes('bg-rose-950/40 text-rose-300'), 'Delete button has destructive styling');

// 2.2 Row 2: 4-Column Balanced Grid: Qty, Unit, Price (₱), Line Total
assert.ok(modalSrc.includes('grid grid-cols-4 gap-2 items-end'), 'Row 2 uses a 4-column grid with gap-2 and items-end');
assert.ok(modalSrc.includes('Qty'), 'Qty field present');
assert.ok(modalSrc.includes('Unit'), 'Unit field present');
assert.ok(modalSrc.includes('Price (₱)'), 'Price (₱) field present');
assert.ok(modalSrc.includes('Line Total'), 'Line Total field explicitly labeled');

// 2.3 Distinct Read-Only Calculated Line Total
assert.ok(modalSrc.includes('text-emerald-500 dark:text-emerald-400 truncate'), 'Line Total is styled as distinct calculated value in emerald');
assert.ok(modalSrc.includes('font-mono font-bold'), 'Line Total uses bold monospace font');

// 2.4 Mobile CSS Grid Rules in style.css
assert.ok(styleSrc.includes('grid-template-columns: repeat(12, 1fr) !important;'), 'Mobile CSS uses 12-column grid for precise 4-column balancing');
assert.ok(styleSrc.includes('.item-cell-name'), 'Item name row styling present');
assert.ok(styleSrc.includes('.item-cell-delete'), 'Item delete button styling present');
assert.ok(styleSrc.includes('.item-cell-qty'), 'Qty column styling present');
assert.ok(styleSrc.includes('.item-cell-unit'), 'Unit column styling present');
assert.ok(styleSrc.includes('.item-cell-price'), 'Price column styling present');
assert.ok(styleSrc.includes('.item-cell-total'), 'Line total column styling present');

// 2.5 Narrow screen adaptation (<= 360px)
assert.ok(styleSrc.includes('@media (max-width: 360px)'), 'style.css defines adaptation for narrow mobile screens <= 360px');

console.log('  ✅ Two-tier layout verified: Row 1 (Name + Delete), Row 2 (Qty, Unit, Price, Line Total) with 360px adaptation.');

// =========================================================================
// SECTION 3: Preservation of Handlers, Data & Calculations
// =========================================================================
console.log('\n--- Section 3: Handler & Dynamic Calculation Preservation ---');

assert.ok(modalSrc.includes('handleAddItemRow'), 'handleAddItemRow preserved');
assert.ok(modalSrc.includes('handleRemoveItemRow'), 'handleRemoveItemRow preserved');
assert.ok(modalSrc.includes('handleItemChange'), 'handleItemChange preserved');
assert.ok(modalSrc.includes('(Number(item.quantity || 0) * Number(item.price !== undefined ? item.price : (item.unitPrice || 0))).toFixed(2)'), 'Dynamic line total formula preserved');

console.log('  ✅ Handlers, calculations, and data persistence preserved.');

// =========================================================================
// SECTION 4: Desktop Full-Width Vertical Stack for OCR Card & Photo Capture
// =========================================================================
console.log('\n--- Section 4: Full-Width Vertical Stack & Desktop Clearance ---');

// 4.1 In style.css, verify .receipt-scanner-split uses flex flex-col on both mobile and desktop (no conflicting grid)
assert.ok(/\.receipt-scanner-split\s*\{[\s\S]*?display:\s*flex\s*!important/i.test(styleSrc), 'receipt-scanner-split is flex flex-col');
assert.ok(/\.split-left-pane\s*\{[\s\S]*?width:\s*100%\s*!important/i.test(styleSrc), 'split-left-pane spans full width on desktop');
assert.ok(/\.split-right-pane\s*\{[\s\S]*?width:\s*100%\s*!important/i.test(styleSrc), 'split-right-pane spans full width on desktop');
assert.ok(/\.ocr-toggle-wrapper\s*\{[\s\S]*?position:\s*static\s*!important/i.test(styleSrc), 'ocr-toggle-wrapper styled with static positioning');
assert.ok(styleSrc.includes('width: 100% !important;'), 'ocr-toggle-wrapper spans 100% width');

// 4.2 In CourseProjectView.js, verify the vertical order:
// 1. Header & tabs
// 2. AI / Neural OCR Scanning toggle card
// 3. Take Photo capture area (split-left-pane)
// 4. Physical Scale Weight banner (scale-reconciliation-card)
// 5. Stall Name and Purchase Date inputs (edit-store-name)
// 6. Itemized Purchases list (receipt-items-table)
const modalHeaderIdx = courseViewSrc.indexOf('modal-header');
const venueToggleIdx = courseViewSrc.indexOf('venue-mode-toggle');
const ocrCardIdx = courseViewSrc.indexOf('ocr-toggle-card');
const photoDropzoneIdx = courseViewSrc.indexOf('split-left-pane');
const scaleBannerIdx = courseViewSrc.indexOf('scale-reconciliation-card');
const storeNameIdx = courseViewSrc.indexOf('edit-store-name');
const itemsTableIdx = courseViewSrc.indexOf('receipt-items-table');

assert.ok(modalHeaderIdx > 0, 'Modal header present');
assert.ok(venueToggleIdx > modalHeaderIdx, '1. Venue mode toggle sits below header');
assert.ok(ocrCardIdx > venueToggleIdx, '2. AI / Neural OCR card sits below header/tabs');
assert.ok(photoDropzoneIdx > ocrCardIdx, '3. Photo capture area sits directly below OCR card');
assert.ok(scaleBannerIdx > photoDropzoneIdx, '4. Scale reconciliation banner sits below photo capture area');
assert.ok(storeNameIdx > scaleBannerIdx, '5. Store / Stall name input sits below banner');
assert.ok(itemsTableIdx > storeNameIdx, '6. Itemized purchases table sits below inputs');

console.log('  ✅ Strict vertical order verified: Tabs -> OCR Toggle -> Photo Capture -> Scale Banner -> Inputs -> Items.');

// 4.3 In ReceiptScannerModal.jsx, verify vertical stack classes
assert.ok(modalSrc.includes('className="flex flex-col gap-4 w-full"'), 'ReceiptScannerModal uses vertical stack flex flex-col gap-4 w-full');
console.log('  ✅ ReceiptScannerModal vertical stack verified.');

console.log('\n======================================================================');
console.log('🎉 ALL RECEIPT ITEM LAYOUT & OCR NORMAL SCROLL TESTS PASSED!');
console.log('======================================================================\n');
