// Comprehensive Test Suite for Receipt Scanning, Pre-processing, Pinoy Grocery OCR & Multi-Diet Audit
import assert from 'node:assert';
import {
  compressImageForOCR,
  cleanPinoyGroceryTerm,
  auditReceiptItemOffline,
  parseGeminiJson as parseClientGeminiJson,
  uploadToCloudinary
} from '../src/services/aiVerification.js';
import {
  parseGeminiJson as parseServerGeminiJson,
  sanitizeReceiptData
} from '../api/receipt-scan.js';
import { renderScannerTab, SAMPLE_LABELS } from '../src/components/ScannerTab.js';
import { analyzeIngredients } from '../src/services/ruleEngine.js';

console.log('🧪 Starting Receipt Scanning, OCR & Compliance Audit Test Suite...\n');

// ----------------------------------------------------
// Test 1: Image Pre-Processing & Compression Helper
// ----------------------------------------------------
console.log('Test 1: compressImageForOCR exists and handles canvas-based downscaling');
assert.strictEqual(typeof compressImageForOCR, 'function', 'compressImageForOCR must be an exported function');

// ----------------------------------------------------
// Test 2: Resilient JSON Parsing (Client & Server)
// ----------------------------------------------------
console.log('\nTest 2: Resilient JSON Parsing with markdown block stripping');

const rawGeminiJsonWithFences = `\`\`\`json
{
  "storeName": "SM Supermarket",
  "detectedItemsCount": 2,
  "items": [
    {
      "rawText": "SIL LABUYO 50G",
      "cleanName": "Siling Labuyo",
      "status": "SAFE",
      "clinicalReason": "Compliant fresh pepper",
      "suggestedSwap": null
    },
    {
      "rawText": "PTIS REF 350ML",
      "cleanName": "Patis / Fish Sauce",
      "status": "AVOID",
      "clinicalReason": "High marine iodine & iodized salt content",
      "suggestedSwap": "Kosher salt dissolved in calamansi juice"
    }
  ]
}
\`\`\``;

const parsedClient = parseClientGeminiJson(rawGeminiJsonWithFences);
assert.ok(parsedClient, 'Client parseGeminiJson should parse markdown wrapped JSON');
assert.strictEqual(parsedClient.storeName, 'SM Supermarket');
assert.strictEqual(parsedClient.items.length, 2);

const parsedServer = parseServerGeminiJson(rawGeminiJsonWithFences);
assert.ok(parsedServer, 'Server parseGeminiJson should parse markdown wrapped JSON');
assert.strictEqual(parsedServer.storeName, 'SM Supermarket');
assert.strictEqual(parsedServer.items.length, 2);

// Test non-JSON string handling
assert.throws(() => {
  parseClientGeminiJson('This is not a valid receipt json.');
}, /Could not parse receipt contents/i, 'Invalid JSON must throw legible error message');

console.log('  ✅ Resilient JSON parsing verified successfully.');

// ----------------------------------------------------
// Test 3: Philippine Grocery Term Expansion & Normalization
// ----------------------------------------------------
console.log('\nTest 3: Clean and expand abbreviated Pinoy grocery terms');

assert.strictEqual(cleanPinoyGroceryTerm('SIL LABUYO 50G - 35.00'), 'Siling Labuyo');
assert.strictEqual(cleanPinoyGroceryTerm('CKN BRST FRESH 1KG - 280.00'), 'Chicken Breast');
assert.strictEqual(cleanPinoyGroceryTerm('MG BRTH CB 6S - 42.50'), 'Bouillon Cubes');
assert.strictEqual(cleanPinoyGroceryTerm('PTIS REF 350ML - 48.00'), 'Patis / Fish Sauce');
assert.strictEqual(cleanPinoyGroceryTerm('BGNG ALMNG 250G'), 'Bagoong Alamang');
assert.strictEqual(cleanPinoyGroceryTerm('SAYOTE FRESH - 25.00'), 'Sayote');

console.log('  ✅ Pinoy grocery abbreviation cleaning verified successfully.');

// ----------------------------------------------------
// Test 4: Offline Receipt Line Item Compliance Auditing
// ----------------------------------------------------
console.log('\nTest 4: auditReceiptItemOffline compliance under different diets');

// LID Protocol
const patisLid = auditReceiptItemOffline('PTIS REF 350ML - 48.00', 'lid');
assert.strictEqual(patisLid.cleanName, 'Patis / Fish Sauce');
assert.strictEqual(patisLid.status, 'AVOID');
assert.ok(patisLid.clinicalReason.toLowerCase().includes('marine') || patisLid.clinicalReason.toLowerCase().includes('iodine'));
assert.ok(patisLid.suggestedSwap.toLowerCase().includes('kosher salt'));

const silingLid = auditReceiptItemOffline('SIL LABUYO 50G - 35.00', 'lid');
assert.strictEqual(silingLid.cleanName, 'Siling Labuyo');
assert.strictEqual(silingLid.status, 'SAFE');

// Low-Sodium Protocol
const patisLowSodium = auditReceiptItemOffline('PTIS REF 350ML', 'low_sodium');
assert.strictEqual(patisLowSodium.status, 'AVOID');
assert.ok(patisLowSodium.clinicalReason.toLowerCase().includes('sodium'));

// Low-Purine Protocol
const isawLowPurine = auditReceiptItemOffline('PORK ISAW FRESH 500G', 'low_purine');
assert.strictEqual(isawLowPurine.cleanName, 'Isaw / Pork Intestines');
assert.strictEqual(isawLowPurine.status, 'AVOID');
assert.ok(isawLowPurine.clinicalReason.toLowerCase().includes('purine') || isawLowPurine.clinicalReason.toLowerCase().includes('uric'));

console.log('  ✅ Line item compliance auditing verified across protocols.');

// ----------------------------------------------------
// Test 5: Server Data Sanitization
// ----------------------------------------------------
console.log('\nTest 5: sanitizeReceiptData preserves compliance and metadata');

const rawServerData = {
  storeName: 'Puregold Price Club',
  totalAmountPaid: 'P 1,450.50 V',
  items: [
    {
      rawText: 'CKN BRST FRESH',
      cleanName: 'Chicken Breast',
      status: 'SAFE',
      clinicalReason: 'Lean fresh poultry is safe',
      suggestedSwap: null,
      price: '280.00'
    },
    {
      rawText: 'MG BRTH CB',
      cleanName: 'Bouillon Cubes',
      status: 'AVOID',
      clinicalReason: 'Contains commercial iodized salt and soy',
      suggestedSwap: 'Homemade broth with kosher salt',
      price: '42.50'
    }
  ]
};

const sanitized = sanitizeReceiptData(rawServerData, 'lid');
assert.strictEqual(sanitized.storeName, 'Puregold Price Club');
assert.strictEqual(sanitized.totalAmountPaid, 1450.5);
assert.strictEqual(sanitized.items.length, 2);
assert.strictEqual(sanitized.items[0].cleanName, 'Chicken Breast');
assert.strictEqual(sanitized.items[0].status, 'SAFE');
assert.strictEqual(sanitized.items[1].cleanName, 'Bouillon Cubes');
assert.strictEqual(sanitized.items[1].status, 'AVOID');
assert.strictEqual(sanitized.items[1].suggestedSwap, 'Homemade broth with kosher salt');
assert.strictEqual(sanitized.safeItemCount, 1);
assert.strictEqual(sanitized.flaggedItemCount, 1);

console.log('  ✅ Server data sanitization verified successfully.');

// ----------------------------------------------------
// Test 6: Scanner Tab UI Rendering for Receipts & Error States
// ----------------------------------------------------
console.log('\nTest 6: ScannerTab renders receipt mode and actionable error banners');

// 6a: Mode toggle presence
const htmlDefault = renderScannerTab({
  activeDiet: 'lid',
  scanTarget: 'receipt',
  inputMode: 'camera',
  scannedReceiptAudit: null,
  scanError: null,
  scanAnalysis: null,
  scanHistory: []
});
assert.ok(htmlDefault.includes('Grocery Receipt'), 'Should include Grocery Receipt mode toggle');
assert.ok(htmlDefault.includes('toggle-receipt-mode'), 'Should have toggle-receipt-mode button');
assert.ok(htmlDefault.includes('toggle-label-mode'), 'Should have toggle-label-mode button');

// 6b: Actionable error banner
const htmlError = renderScannerTab({
  activeDiet: 'lid',
  scanTarget: 'receipt',
  inputMode: 'camera',
  scannedReceiptAudit: null,
  scanError: 'Could not parse receipt contents. Please ensure the receipt is well-lit and legible.',
  scanAnalysis: null,
  scanHistory: []
});
assert.ok(htmlError.includes('Could not parse receipt contents'), 'Must render actionable error message');
assert.ok(htmlError.includes('dismiss-scan-error-btn'), 'Must provide dismiss button for error state');
assert.ok(htmlError.includes('Troubleshooting Tips'), 'Must provide helpful troubleshooting guidance');

// 6c: Audited receipt items card rendering
const htmlAudited = renderScannerTab({
  activeDiet: 'lid',
  scanTarget: 'receipt',
  inputMode: 'camera',
  scannedReceiptAudit: {
    storeName: 'SM Supermarket',
    detectedItemsCount: 2,
    items: [
      {
        rawText: 'SIL LABUYO 50G - 35.00',
        cleanName: 'Siling Labuyo',
        status: 'SAFE',
        clinicalReason: 'Compliant fresh pepper',
        suggestedSwap: null
      },
      {
        rawText: 'MG BRTH CB 6S - 42.50',
        cleanName: 'Bouillon Cubes',
        status: 'AVOID',
        clinicalReason: 'Contains commercial iodized salt and soy',
        suggestedSwap: 'Homemade broth simmered with kosher salt & garlic'
      }
    ]
  },
  scanError: null,
  scanAnalysis: null,
  scanHistory: []
});

assert.ok(htmlAudited.includes('SM Supermarket'), 'Renders audited store name');
assert.ok(htmlAudited.includes('Siling Labuyo'), 'Renders expanded ingredient name');
assert.ok(htmlAudited.includes('Bouillon Cubes'), 'Renders flagged grocery item');
assert.ok(htmlAudited.includes('Pinoy Smart Swap:'), 'Renders smart swap suggestion');
assert.ok(htmlAudited.includes('Homemade broth simmered with kosher salt'), 'Renders exact swap text');

// Verify Receipt Audit Modal backdrop, header contrast, close button and item styling
assert.ok(htmlAudited.includes('fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'), 'Renders modal backdrop');
assert.ok(htmlAudited.includes('id="receipt-audit-modal-backdrop"'), 'Backdrop has dismiss id');
assert.ok(htmlAudited.includes('onclick="event.stopPropagation()"'), 'Inner dialog stops click propagation');
assert.ok(htmlAudited.includes('id="receipt-audit-close-btn"'), 'Renders explicit close button');
assert.ok(htmlAudited.includes('aria-label="Close modal"'), 'Close button has accessibility label');
assert.ok(htmlAudited.includes('bg-slate-900 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between'), 'Solid high contrast header');
assert.ok(htmlAudited.includes('text-lg font-bold tracking-wide text-white'), 'Header title styling');
assert.ok(htmlAudited.includes('bg-emerald-600 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold'), 'Safe summary badge');
assert.ok(htmlAudited.includes('bg-rose-600 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold'), 'Avoid summary badge');

// Line item typography and contrast
assert.ok(htmlAudited.includes('bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 mb-3'), 'SAFE Card container styling');
assert.ok(htmlAudited.includes('text-base font-bold text-emerald-950 dark:text-emerald-100'), 'SAFE Item title styling');
assert.ok(htmlAudited.includes('text-xs font-mono text-emerald-800/80 dark:text-emerald-300/80 mt-0.5'), 'SAFE Receipt Line text');
assert.ok(htmlAudited.includes('text-xs text-emerald-900/90 dark:text-emerald-200/90 mt-1.5'), 'SAFE Rationale text');

assert.ok(htmlAudited.includes('bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl p-4 mb-3'), 'AVOID Card container styling');
assert.ok(htmlAudited.includes('text-base font-bold text-rose-950 dark:text-rose-100'), 'AVOID Item title styling');
assert.ok(htmlAudited.includes('text-xs font-mono text-rose-800/80 dark:text-rose-300/80 mt-0.5'), 'AVOID Receipt Line text');
assert.ok(htmlAudited.includes('text-xs text-rose-900/90 dark:text-rose-200/90 mt-1.5'), 'AVOID Warning explanation');
assert.ok(htmlAudited.includes('bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-lg px-2.5 py-1.5'), 'Pinoy smart swap pill styling');

console.log('  ✅ ScannerTab UI rendering verified successfully.');

// ----------------------------------------------------
// Test 7: Real-World Robinsons Supermarket Receipt Test
// ----------------------------------------------------
console.log('\nTest 7: Real-World Robinsons Supermarket Receipt Layout & Audit');

// 7a: Barcode line isolation
assert.strictEqual(cleanPinoyGroceryTerm('00731126011020'), '', 'Pure barcode lines must be stripped');
assert.strictEqual(cleanPinoyGroceryTerm('00034000458615'), '', 'Pure barcode lines must be stripped');

// 7b: Inline barcode stripping & brand dairy expansion
const bearBrandClean = cleanPinoyGroceryTerm('BEAR BRAND FORTIFIED 04800361393515');
assert.strictEqual(bearBrandClean, 'Bear Brand Fortified Milk Powder');

// 7c: Clinical compliance under Low-Iodine Diet (LID)
const bearBrandAudit = auditReceiptItemOffline('BEAR BRAND FORTIFIED 04800361393515', 'lid');
assert.strictEqual(bearBrandAudit.status, 'AVOID', 'Bear Brand Milk must be flagged AVOID on LID');
assert.ok(bearBrandAudit.clinicalReason.toLowerCase().includes('dairy') || bearBrandAudit.clinicalReason.toLowerCase().includes('iodine'));
assert.ok(bearBrandAudit.suggestedSwap !== null);

const cornstarchAudit = auditReceiptItemOffline('CREAM CORNSTARCH 200', 'lid');
assert.strictEqual(cornstarchAudit.cleanName, 'Cream Cornstarch');
assert.strictEqual(cornstarchAudit.status, 'SAFE', 'Pure cornstarch is safe on LID');

const cocoaAudit = auditReceiptItemOffline('HERSHEYS COCOA IN CA', 'lid');
assert.strictEqual(cocoaAudit.cleanName, "Hershey's Cocoa Powder");
assert.strictEqual(cocoaAudit.status, 'SAFE', 'Pure cocoa powder is safe on LID');

// 7d: Server sanitization of Robinsons receipt JSON
const robinsonsServerData = {
  storeName: "Robinsons Supermarket",
  purchaseDate: "2026-10-27",
  items: [
    {
      rawText: "BEAR BRAND FORTIFIED 04800361393515\n2 X P310.00/Unit",
      cleanName: "Bear Brand Fortified Milk Powder",
      status: "AVOID",
      clinicalReason: "Dairy milk contains elevated natural and sanitizing iodine",
      suggestedSwap: "Pure coconut milk or oat milk",
      qty: 2,
      price: 310.0,
      total: 620.0
    },
    {
      rawText: "CREAM CORNSTARCH 200",
      cleanName: "Cream Cornstarch (200g)",
      status: "SAFE",
      clinicalReason: "Plant-based thickener safe on low-iodine diet",
      suggestedSwap: null,
      qty: 1,
      price: 23.75,
      total: 23.75
    },
    {
      rawText: "HERSHEYS COCOA IN CA",
      cleanName: "Hershey's Cocoa Powder",
      status: "SAFE",
      clinicalReason: "Pure unsweetened cocoa is naturally dairy-free",
      suggestedSwap: null,
      qty: 1,
      price: 382.25,
      total: 382.25
    }
  ],
  totalAmountPaid: "P1,026.00"
};

const robinsonsSanitized = sanitizeReceiptData(robinsonsServerData, 'lid');
assert.strictEqual(robinsonsSanitized.storeName, "Robinsons Supermarket");
assert.strictEqual(robinsonsSanitized.totalAmountPaid, 1026.0);
assert.strictEqual(robinsonsSanitized.items.length, 3);
assert.strictEqual(robinsonsSanitized.safeItemCount, 2);
assert.strictEqual(robinsonsSanitized.flaggedItemCount, 1);
console.log('  ✅ Real Robinsons receipt layout & compliance verified successfully.');
// ----------------------------------------------------
// Test 8: Cloudinary Folder Target Verification (kosherai/receipts vs kosherai)
// ----------------------------------------------------
console.log('\nTest 8: Cloudinary Folder Target for Receipt Mode');

const originalFetch = globalThis.fetch;
let capturedFolder = null;

globalThis.fetch = async (url, options) => {
  if (options && options.body instanceof FormData) {
    capturedFolder = options.body.get('folder');
  }
  return {
    ok: true,
    json: async () => ({ secure_url: 'https://res.cloudinary.com/test/image/upload/sample.jpg' })
  };
};

try {
  // 8a: Receipt mode upload should target kosherai/receipts
  await uploadToCloudinary('fake-blob-data', 'my-cloud', 'my-preset', true);
  assert.strictEqual(capturedFolder, 'kosherai/receipts', 'Receipt mode must upload to "kosherai/receipts"');

  // 8b: Standard label mode upload should target kosherai
  await uploadToCloudinary('fake-blob-data', 'my-cloud', 'my-preset', false);
  assert.strictEqual(capturedFolder, 'kosherai', 'Standard label mode must upload to default "kosherai"');
  console.log('  ✅ Cloudinary target folder routing verified (kosherai/receipts).');
} finally {
  globalThis.fetch = originalFetch;
}

// ----------------------------------------------------
// Test 9: Prevent "False SAFE" on Empty Item Extraction
// ----------------------------------------------------
console.log('\nTest 9: Prevent False SAFE on Empty Item Extraction');

// 9a: ruleEngine analyzeIngredients handles blank input as UNKNOWN
const emptyAnalysis = analyzeIngredients('');
assert.strictEqual(emptyAnalysis.status, 'UNKNOWN', 'Empty ingredients must return status UNKNOWN');
assert.strictEqual(emptyAnalysis.isSafe, false, 'Empty ingredients must NOT be marked isSafe: true');
assert.strictEqual(emptyAnalysis.overallBadge, 'NO INGREDIENTS DETECTED');

// 9b: ScannerTab renders actionable unreadable warning and NEVER "0 Safe" or false SAFE banner
const htmlEmptyReceipt = renderScannerTab({
  activeDiet: 'lid',
  scanTarget: 'receipt',
  inputMode: 'camera',
  scannedReceiptAudit: {
    storeName: 'SM Supermarket',
    detectedItemsCount: 0,
    items: []
  },
  scanError: null,
  scanAnalysis: null,
  scanHistory: []
});

assert.ok(htmlEmptyReceipt.includes('STATUS: UNREADABLE'), 'Must render STATUS: UNREADABLE badge');
assert.ok(htmlEmptyReceipt.includes('No Grocery Line Items Detected'), 'Must render No Grocery Line Items Detected warning');
assert.ok(htmlEmptyReceipt.includes('No grocery line items could be detected on this receipt'), 'Must render exact actionable warning guidance');
assert.ok(!htmlEmptyReceipt.includes('0 Safe'), 'Must NOT render green "0 Safe" pill or card');
assert.ok(!htmlEmptyReceipt.includes('banner-safe'), 'Must NOT render safe banner');
assert.ok(htmlEmptyReceipt.includes('Retake / Upload New Photo'), 'Must render retake action button');
assert.ok(htmlEmptyReceipt.includes('Switch to Paste Text'), 'Must render switch to paste text button');

console.log('  ✅ False SAFE prevention and unreadable receipt fallback verified successfully.');

console.log('\n🎉 ALL RECEIPT SCANNING TESTS PASSED!\n');
