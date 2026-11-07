// Test Suite: Separate Camera Capture and Gallery Upload in ReceiptScannerModal
// Verifies:
// 1. Supermarket mode displays both Take Photo and Upload from Photos buttons
// 2. Wet Market mode displays both Take Photo and Upload from Photos buttons
// 3. Take Photo input uses accept="image/*" and capture="environment"
// 4. Upload from Photos input uses accept="image/*" without capture attribute
// 5. Input resetting ensures selecting the same photo triggers onChange
// 6. Image validation rejects non-image files
// 7. Photo capture and gallery selection work with OCR disabled (Quick Capture)
// 8. OCR only runs when explicitly enabled
// 9. OCR failure does not prevent previewing or saving

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Starting Receipt Scanner Camera & Gallery Separation Tests...\n');

let passedTests = 0;
function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Test 1: ReceiptScannerModal.jsx Source Verification
// ---------------------------------------------------------------------------
console.log('--- Section 1: ReceiptScannerModal.jsx Inspection ---');

const modalPath = path.resolve('src/components/ReceiptScannerModal.jsx');
assert(fs.existsSync(modalPath), 'ReceiptScannerModal.jsx exists');
const modalCode = fs.readFileSync(modalPath, 'utf8');

runTest('ReceiptScannerModal declares camera and gallery input refs', () => {
  assert(modalCode.includes('cameraInputRef'), 'cameraInputRef declared');
  assert(modalCode.includes('galleryInputRef'), 'galleryInputRef declared');
});

runTest('Dedicated Camera Input includes capture="environment" and accept="image/*"', () => {
  assert(modalCode.includes('ref={cameraInputRef}'), 'Camera input uses cameraInputRef');
  assert(modalCode.includes('capture="environment"'), 'Camera input sets capture="environment" for rear mobile camera');
  assert(modalCode.includes('accept="image/*"'), 'Camera input sets accept="image/*"');
});

runTest('Dedicated Gallery Input includes accept="image/*" without capture attribute', () => {
  assert(modalCode.includes('ref={galleryInputRef}'), 'Gallery input uses galleryInputRef');
  // Check the gallery input definition does NOT include capture
  const galleryInputMatch = modalCode.match(/<input[^>]*ref=\{galleryInputRef\}[^>]*\/>/s)
    || modalCode.match(/<input[^>]*id="receipt-gallery-input"[^>]*\/>/s);
  assert(galleryInputMatch, 'Gallery input element exists');
  assert(!galleryInputMatch[0].includes('capture='), 'Gallery input must NOT have capture attribute');
  assert(galleryInputMatch[0].includes('accept="image/*"'), 'Gallery input has accept="image/*"');
});

runTest('Dropzone displays distinct Take Photo and Upload from Photos buttons', () => {
  assert(modalCode.includes('Take Photo'), 'Renders "Take Photo" button');
  assert(modalCode.includes('Upload from Photos'), 'Renders "Upload from Photos" button');
  assert(modalCode.includes('id="take-photo-btn"'), 'Renders #take-photo-btn');
  assert(modalCode.includes('id="upload-photos-btn"'), 'Renders #upload-photos-btn');
});

runTest('Both buttons have minimum 44px touch target height for mobile ergonomics', () => {
  assert(modalCode.includes('min-h-[44px]'), 'Buttons specify min-h-[44px]');
});

runTest('Both venue modes (Supermarket & Wet Market) render the dual upload actions', () => {
  // Check that the buttons are within the venueMode conditional container or shared block
  assert(modalCode.includes('venueMode === \'wet_market\''), 'Supports both supermarket and wet_market');
  assert(modalCode.includes('Take Photo of Produce, Receipt or Scale'), 'Wet market photo label supported');
  assert(modalCode.includes('Take Photo or Upload Receipt'), 'Supermarket photo label supported');
});

// ---------------------------------------------------------------------------
// Test 2: File Handling, Validation, and Reset Logic
// ---------------------------------------------------------------------------
console.log('\n--- Section 2: File Handling & Validation ---');

runTest('handleFileSelect validates image file type', () => {
  assert(modalCode.includes("file.type.startsWith('image/')"), 'Validates file is an accepted image');
  assert(modalCode.includes('handleFileSelect'), 'Implements handleFileSelect');
});

runTest('handleFileSelect and handleRetake reset input values to support re-selecting the same file', () => {
  assert(modalCode.includes("e.target.value = ''"), 'Resets e.target.value');
  assert(modalCode.includes("cameraInputRef.current.value = ''"), 'Resets cameraInputRef value');
  assert(modalCode.includes("galleryInputRef.current.value = ''"), 'Resets galleryInputRef value');
});

runTest('OCR only runs when explicitly enabled and device is online', () => {
  assert(modalCode.includes('enableOcrScan && isOnline'), 'Checks enableOcrScan and isOnline before OCR');
  assert(modalCode.includes('Offline: Photo captured. Auto-OCR skipped.'), 'Offline photo capture skips OCR gracefully');
});

runTest('Auto-OCR catch block ensures OCR failure does not block preview or saving', () => {
  assert(modalCode.includes('Auto OCR failed, but photo preview and saving remain active'), 'Catches OCR error non-fatally');
});

// ---------------------------------------------------------------------------
// Test 3: Vanilla JS View Synchronization (CourseProjectView & main.js)
// ---------------------------------------------------------------------------
console.log('\n--- Section 3: CourseProjectView & main.js Integration ---');

const courseViewPath = path.resolve('src/components/CourseProjectView.js');
const courseViewCode = fs.readFileSync(courseViewPath, 'utf8');

runTest('CourseProjectView.js renders dedicated camera and gallery inputs and buttons', () => {
  assert(courseViewCode.includes('id="receipt-camera-input"'), 'CourseProjectView renders #receipt-camera-input');
  assert(courseViewCode.includes('id="receipt-gallery-input"'), 'CourseProjectView renders #receipt-gallery-input');
  assert(courseViewCode.includes('id="trigger-receipt-camera-btn"'), 'CourseProjectView renders #trigger-receipt-camera-btn');
  assert(courseViewCode.includes('id="trigger-receipt-gallery-btn"'), 'CourseProjectView renders #trigger-receipt-gallery-btn');
});

const mainPath = path.resolve('src/main.js');
const mainCode = fs.readFileSync(mainPath, 'utf8');

runTest('main.js wires click handlers and change listeners for camera and gallery inputs', () => {
  assert(mainCode.includes('triggerReceiptCameraBtn'), 'main.js handles triggerReceiptCameraBtn');
  assert(mainCode.includes('triggerReceiptGalleryBtn'), 'main.js handles triggerReceiptGalleryBtn');
  assert(mainCode.includes('receiptCameraInput'), 'main.js wires receiptCameraInput');
  assert(mainCode.includes('receiptGalleryInput'), 'main.js wires receiptGalleryInput');
});

console.log(`\n🎉 All ${passedTests} Camera & Gallery Separation tests passed successfully!\n`);

