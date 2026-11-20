/**
 * test/foodScannerOptimization.test.js
 * Verification suite for KosherAI Two-Stage Food Scanner Optimization
 */

import assert from 'node:assert';
import fs from 'node:fs';
import {
  evaluateFoodForProtocol,
  dataUrlToBlob
} from '../src/services/aiVerification.js';
import {
  renderScannerTab,
  cancelActiveScan,
  recheckFoodName
} from '../src/components/ScannerTab.js';

// Minimal browser globals for rendering tests
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}
globalThis.localStorage = new MockLocalStorage();
globalThis.window = { dispatchEvent: () => {} };
globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; } };

console.log('🧪 Starting KosherAI Food Scanner Optimization Test Suite...\n');

// Test 1: Stage 2 evaluation for Filipino produce (Kamote) under LID vs Pinoy Keto
{
  const kamoteRec = {
    foodName: 'Sweet Potato',
    localName: 'Kamote',
    isPackagedLabel: false,
    ingredientsText: '',
    confidence: 0.94,
    explanation: 'Fresh whole sweet potato tubers.',
    needsClarification: false
  };

  const lidResult = evaluateFoodForProtocol(kamoteRec, 'lid');
  assert.strictEqual(lidResult.status, 'SAFE', 'Kamote must be SAFE on Low-Iodine Diet');
  assert.strictEqual(lidResult.activeDiet, 'lid');
  assert.ok(lidResult.productName.includes('Kamote'), 'Display name should include local name Kamote');

  const ketoResult = evaluateFoodForProtocol(kamoteRec, 'pinoy_keto');
  assert.strictEqual(ketoResult.status, 'AVOID', 'Kamote must be AVOID on Pinoy Keto');
  assert.strictEqual(ketoResult.activeDiet, 'pinoy_keto');
  console.log('  ✅ Test 1 Passed: Stage 2 evaluates Kamote accurately per active protocol.');
}

// Test 2: Stage 2 evaluation for other produce & seafood
{
  const tomatoRec = { foodName: 'Tomatoes', localName: 'Kamatis', confidence: 0.95 };
  assert.strictEqual(evaluateFoodForProtocol(tomatoRec, 'lid').status, 'SAFE');

  const malunggayRec = { foodName: 'Moringa Leaves', localName: 'Malunggay', confidence: 0.92 };
  assert.strictEqual(evaluateFoodForProtocol(malunggayRec, 'lid').status, 'SAFE');

  const seafoodRec = { foodName: 'Shrimp', localName: 'Hipon (Seafood)', confidence: 0.91 };
  assert.strictEqual(evaluateFoodForProtocol(seafoodRec, 'lid').status, 'AVOID');

  const packagedRec = {
    foodName: 'Seasoning Packet',
    isPackagedLabel: true,
    ingredientsText: 'Water, Iodized Salt, Monosodium Glutamate, Sugar',
    confidence: 0.9
  };
  assert.strictEqual(evaluateFoodForProtocol(packagedRec, 'lid').status, 'AVOID');
  console.log('  ✅ Test 2 Passed: Stage 2 handles tomatoes, malunggay, seafood, and packaged labels.');
}

// Test 3: Low confidence / needsClarification triggers CAUTION
{
  const blurryRec = {
    foodName: 'Unknown Root Crop',
    confidence: 0.35,
    needsClarification: true
  };
  const res = evaluateFoodForProtocol(blurryRec, 'lid');
  assert.strictEqual(res.status, 'CAUTION', 'Low confidence recognition must return CAUTION');
  console.log('  ✅ Test 3 Passed: Low confidence / ambiguous items return CAUTION.');
}

// Test 4: recheckFoodName updates scanAnalysis immediately
{
  const state = {
    activeDiet: 'pinoy_keto',
    cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/kamote.jpg',
    scanAnalysis: { productName: 'Potato', status: 'AVOID', cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/kamote.jpg' }
  };
  let rendered = false;
  recheckFoodName('Malunggay', state, () => { rendered = true; });
  assert.strictEqual(rendered, true);
  assert.strictEqual(state.scanAnalysis.status, 'SAFE');
  assert.strictEqual(state.scanAnalysis.foodName, 'Malunggay');
  assert.strictEqual(state.scanAnalysis.cloudinaryUrl, 'https://res.cloudinary.com/demo/image/upload/kamote.jpg');
  console.log('  ✅ Test 4 Passed: recheckFoodName re-evaluates Stage 2 immediately without re-upload.');
}

// Test 5: cancelActiveScan resets loading state cleanly
{
  const state = { aiLoading: true, ocrStatus: { message: 'Identifying food...' }, ocrProgress: 0.5, scanError: null };
  let rendered = false;
  cancelActiveScan(state, () => { rendered = true; });
  assert.strictEqual(rendered, true);
  assert.strictEqual(state.aiLoading, false);
  assert.strictEqual(state.ocrStatus, null);
  assert.ok(state.scanError.includes('cancelled'), 'Cancel should set informative scanError');
  console.log('  ✅ Test 5 Passed: cancelActiveScan resets loading state cleanly.');
}

// Test 6: renderScannerTab renders 4-stage progress, cancel, retry, manual fallback, and food name correction UI
{
  globalThis.localStorage.setItem('kosherai_scanner_enabled', 'true');
  const progressHtml = renderScannerTab({
    scannerEnabled: true,
    ocrStatus: { message: 'Identifying food...', stage: 'identifying' },
    ocrProgress: 0.5
  });
  assert.ok(progressHtml.includes('1. Preparing image'), 'Progress UI must show Stage 1');
  assert.ok(progressHtml.includes('2. Identifying food'), 'Progress UI must show Stage 2');
  assert.ok(progressHtml.includes('3. Checking dietary compatibility'), 'Progress UI must show Stage 3');
  assert.ok(progressHtml.includes('4. Displaying results'), 'Progress UI must show Stage 4');
  assert.ok(progressHtml.includes('id="cancel-scan-btn"'), 'Progress UI must include Cancel button');

  const errorHtml = renderScannerTab({
    scannerEnabled: true,
    scanError: 'Food recognition timed out.',
    lastScannedFile: { name: 'kamote.jpg' }
  });
  assert.ok(errorHtml.includes('id="retry-scan-btn"'), 'Error UI must include Retry button');
  assert.ok(errorHtml.includes('id="manual-food-entry-btn"'), 'Error UI must include Manual Food Entry button');

  const resultHtml = renderScannerTab({
    scannerEnabled: true,
    activeDiet: 'lid',
    scanAnalysis: evaluateFoodForProtocol({ foodName: 'Sweet Potato', localName: 'Kamote', confidence: 0.94 }, 'lid')
  });
  assert.ok(resultHtml.includes('id="correct-food-name-input"'), 'Result UI must include food name correction input');
  assert.ok(resultHtml.includes('id="recheck-food-name-btn"'), 'Result UI must include Re-check Food button');
  console.log('  ✅ Test 6 Passed: Scanner UI renders 4 real stages, cancel, retry, manual entry, and food correction.');
}

// Test 7: Architectural guarantees in source files
{
  const aiSrc = fs.readFileSync(new URL('../src/services/aiVerification.js', import.meta.url), 'utf8');
  const apiSrc = fs.readFileSync(new URL('../api/receipt-scan.js', import.meta.url), 'utf8');
  const tabSrc = fs.readFileSync(new URL('../src/components/ScannerTab.js', import.meta.url), 'utf8');

  assert.ok(!aiSrc.includes('gemini-3.8-flash'), 'Invalid gemini-3.8-flash model must be removed');
  assert.ok(aiSrc.includes('thinkingBudget: 0'), 'thinkingBudget: 0 must be set on gemini-2.5-flash in aiVerification.js');
  assert.ok(apiSrc.includes('thinkingBudget: 0'), 'thinkingBudget: 0 must be set on gemini-2.5-flash in api/receipt-scan.js');
  assert.ok(tabSrc.includes('if (state.aiLoading)'), 'Duplicate submission guard must exist in executeScanWorkflow');
  assert.ok(!tabSrc.includes('await cloudinaryPromise'), 'Cloudinary upload must NOT be awaited before displaying results');
  assert.ok(tabSrc.includes('[ScannerPerf]'), 'Diagnostic [ScannerPerf] timing logs must be present');

  const blob = dataUrlToBlob('data:image/jpeg;base64,' + Buffer.from('hello').toString('base64'));
  assert.ok(blob instanceof Blob && blob.type === 'image/jpeg', 'dataUrlToBlob converts dataUrl to JPEG Blob');
  console.log('  ✅ Test 7 Passed: No gemini-3.8-flash, thinkingBudget: 0 enabled, Cloudinary decoupled, duplicate guard active.');
}

console.log('\n🎉 All Food Scanner Optimization Tests Passed!');
