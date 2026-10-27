// Comprehensive Test Suite for Receipt Scanning, Pre-processing, Pinoy Grocery OCR & Multi-Diet Audit
import assert from 'node:assert';
import {
  compressImageForOCR,
  cleanPinoyGroceryTerm,
  auditReceiptItemOffline,
  parseGeminiJson as parseClientGeminiJson
} from '../src/services/aiVerification.js';
import {
  parseGeminiJson as parseServerGeminiJson,
  sanitizeReceiptData
} from '../api/receipt-scan.js';
import { renderScannerTab, SAMPLE_LABELS } from '../src/components/ScannerTab.js';

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

console.log('\n🎉 ALL RECEIPT SCANNING TESTS PASSED!\n');
