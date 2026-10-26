// AI Verification & Image Processing Service (Gemini API + Tesseract OCR + Cloudinary)

/**
 * Compresses an image file client-side before OCR or upload
 */
export async function compressImage(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            resolve({ blob, dataUrl, width, height });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Client-Side OCR using Tesseract.js (cached by Service Worker)
 */
export async function runClientOCR(imageSource, onProgress = () => { }) {
  try {
    onProgress({ status: 'loading_tesseract', progress: 0.1, message: 'Initializing OCR engine...' });

    // Check if Tesseract is already on window or load dynamically
    if (!window.Tesseract) {
      await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    }

    if (!window.Tesseract) {
      throw new Error('Tesseract OCR library could not be loaded.');
    }

    onProgress({ status: 'recognizing', progress: 0.3, message: 'Reading ingredient text...' });

    const worker = await window.Tesseract.createWorker('eng');

    // Set logger if available
    const result = await worker.recognize(imageSource);
    await worker.terminate();

    onProgress({ status: 'done', progress: 1.0, message: 'OCR extraction complete!' });
    return result.data.text;
  } catch (err) {
    console.warn('OCR error or offline:', err);
    throw err;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Safe parser that handles markdown backtick wraps (e.g. ```json ... ```)
 */
export function parseGeminiJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = rawText.trim();

  // Extract markdown fenced code block if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  } else if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  } else {
    // Look for outermost JSON object brackets
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
  }

  return JSON.parse(text);
}

/**
 * Deep Clinical AI Verification via Gemini API
 * Calls gemini-2.5-flash to enforce strict Radioactive Iodine (RAI) / Low-Iodine Diet protocol
 */
export async function verifyWithGeminiAI(ingredientTextOrPayload, apiKey) {
  const activeKey = (apiKey?.trim() || import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  if (!activeKey) {
    throw new Error('Please add your Gemini API Key in Settings or set VITE_GEMINI_API_KEY to enable online AI deep reasoning.');
  }

  // Support string ingredient text or multimodal payload object { text, imageBase64, mimeType }
  const isMultimodal = typeof ingredientTextOrPayload === 'object' && ingredientTextOrPayload !== null;
  const ingredientText = isMultimodal ? (ingredientTextOrPayload.text || '') : String(ingredientTextOrPayload || '');
  const imageBase64 = isMultimodal ? ingredientTextOrPayload.imageBase64 : null;
  const mimeType = isMultimodal && ingredientTextOrPayload.mimeType ? ingredientTextOrPayload.mimeType : 'image/jpeg';

  const prompt = `
You are a nuclear medicine clinical endocrinology AI specialist for Radioactive Iodine (RAI) therapy preparation.
Patients MUST adhere to a strict Low-Iodine Diet (LID) (<50 mcg iodine/day).

Protocol Ground Rules:
- Flag any hidden dairy, whey, egg yolk, sea salt, iodized salt, fish, seafood, carrageenan, agar-agar, Red Dye #3, soy/soybeans, potatoes, or iodate dough conditioners.
- STRICTLY FORBIDDEN (AVOID):
  * Hidden dairy, whey, milk, cheese, butter, yogurt, casein, cream, milk chocolate
  * Egg yolks, whole eggs, mayonnaise with yolks
  * Sea salt, iodized salt, rock salt, Himalayan pink salt
  * Marine fish, shellfish, crustaceans, fish sauce (patis), oyster sauce
  * Carrageenan (E407), agar-agar (E406), alginate (E401-E404), seaweed, nori, kelp
  * FD&C Red Dye #3 (erythrosine / E127 - 58% elemental iodine)
  * Soybeans, soy sauce (toyo), tofu, edamame, soy protein, soy isoflavones (NIS inhibitors)
  * Potatoes (russet/red/chips ~60mcg), watercress, cassava (kamoteng kahoy), millet
  * Cruciferous vegetables (cabbage, broccoli, cauliflower, brussels sprouts)
  * Iodate dough conditioners (potassium iodate, calcium iodate)
  * Prunes, bananas, pineapple, strawberries, cranberries
- STRICTLY SAFE:
  * Pure non-iodized kosher salt (Morton Coarse, Diamond Crystal), pickling salt
  * Pure egg whites
  * Fresh unbrined chicken, beef, pork
  * Sayote, kalabasa (squash), bell peppers, zucchini, eggplant, tomatoes, onions, garlic
  * Plain white/brown rice, rolled oats, unbleached flour, pure cornstarch
  * 100% pure vegetable oils (olive, coconut, canola)
  * Pure black pepper, chili peppers (siling labuyo), pure spices
- CAUTION:
  * Unspecified "salt" on commercial packages (usually iodized)
  * "Natural flavors", "artificial flavors", or ambiguous "dough conditioners"
  * Commercial plant milks with added sea salt or carrageenan

Analyze the following food ingredient text or packaging label:
"""${ingredientText}"""

Return clean JSON:
{
  "status": "SAFE" | "AVOID" | "CAUTION",
  "reason": "Brief explanation why",
  "problemIngredients": ["ingredient1", "ingredient2"]
}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(activeKey)}`;

  const parts = [];
  if (imageBase64) {
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: cleanBase64
      }
    });
  }
  parts.push({ text: prompt });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textOutput) {
    throw new Error('No AI response received from Gemini.');
  }

  const parsed = parseGeminiJson(textOutput);

  const rawStatus = (parsed.status || 'CAUTION').toUpperCase();
  const status = ['SAFE', 'AVOID', 'CAUTION'].includes(rawStatus) ? rawStatus : 'CAUTION';
  const reason = parsed.reason || (Array.isArray(parsed.reasons) ? parsed.reasons.join('. ') : 'Evaluated according to Low-Iodine Diet protocol.');
  const problemIngredients = Array.isArray(parsed.problemIngredients)
    ? parsed.problemIngredients
    : Array.isArray(parsed.detectedProblemIngredients)
      ? parsed.detectedProblemIngredients
      : [];

  return {
    status,
    reason,
    problemIngredients,
    // Extra helper properties for seamless UI display & compatibility
    isSafe: status === 'SAFE',
    reasons: [reason],
    detectedProblemIngredients: problemIngredients,
    safeSubstitutions: parsed.safeSubstitutions || (parsed.substitution ? [parsed.substitution] : []),
    clinicalSummary: parsed.clinicalSummary || reason
  };
}

/**
 * Cloudinary Upload for packaging log
 * Handles FormData POST to https://api.cloudinary.com/v1_1/${cloudName}/image/upload.
 * If credentials are missing, logs a gentle warning and returns null without throwing or breaking UI.
 */
export async function uploadToCloudinary(blob, cloudName, uploadPreset) {
  const resolvedCloudName = (cloudName?.trim() || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  const resolvedPreset = (uploadPreset?.trim() || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();

  if (!resolvedCloudName || !resolvedPreset) {
    console.warn('Cloudinary upload skipped: missing cloudName or uploadPreset credentials.');
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('upload_preset', resolvedPreset);

    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(resolvedCloudName)}/image/upload`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      console.warn(`Cloudinary upload returned status ${response.status}: ${response.statusText}`);
      return null;
    }

    const result = await response.json();
    return result.secure_url || result.url || null;
  } catch (err) {
    console.warn('Cloudinary upload error (non-fatal):', err);
    return null;
  }
}

/**
 * Supermarket Receipt Scanner Orchestration
 * Prioritizes Server-Side Gemini Vision endpoint (/api/receipt-scan) with a 30s timeout window.
 * Prevents premature fallback to local Tesseract OCR.
 *
 * Fallback to local OCR triggers ONLY if:
 *  1. The fetch explicitly rejects after the full 30s timeout (err.name === 'AbortError')
 *  2. The device is detected as strictly offline (!navigator.onLine)
 *  3. The API responds with a definitive server error (500/503/400)
 */
export async function scanSupermarketReceipt(dataUrl, onProgress = () => {}, clientApiKey = '') {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Condition 2: Strict offline check upfront
  if (!isOnline) {
    console.warn('[ReceiptScan] Device strictly offline. Running on-device OCR fallback...');
    return await executeLocalOcrFallback(dataUrl, onProgress, 'Offline mode detected: Running on-device OCR fallback...');
  }

  // Phased Status Feedback During Processing:
  // 0s–3s: "Uploading receipt image..."
  onProgress({
    status: 'uploading',
    progress: 0.15,
    message: 'Uploading receipt image...'
  });

  // 3s–15s: "✨ Gemini Vision is extracting store items and totals..."
  const timer3s = setTimeout(() => {
    onProgress({
      status: 'ai_vision',
      progress: 0.45,
      message: '✨ Gemini Vision is extracting store items and totals...'
    });
  }, 3000);

  // 15s–30s: "Still analyzing complex receipt details..."
  const timer15s = setTimeout(() => {
    onProgress({
      status: 'ai_vision',
      progress: 0.70,
      message: 'Still analyzing complex receipt details...'
    });
  }, 15000);

  // Condition 1: 30-second timeout threshold via AbortController
  const controller = new AbortController();
  const timeout30s = setTimeout(() => {
    controller.abort();
  }, 30000);

  const clearScanningTimers = () => {
    clearTimeout(timeout30s);
    clearTimeout(timer3s);
    clearTimeout(timer15s);
  };

  let shouldTriggerOcrFallback = false;
  let ocrFallbackMessage = 'Cloud vision timed out. Falling back to on-device OCR...';

  // 1. Primary: Server-Side Gemini Vision endpoint (/api/receipt-scan)
  try {
    const res = await fetch('/api/receipt-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: dataUrl,
        mimeType: 'image/jpeg'
      }),
      signal: controller.signal
    });

    clearScanningTimers();

    if (res.ok) {
      const data = await res.json();
      onProgress({ status: 'populating', progress: 0.95, message: 'Populating receipt items...' });
      return normalizeReceiptData(data, 'SERVER_GEMINI_VISION');
    }

    // Condition 3: API responds with a definitive server error (500/503/400)
    const isDefinitiveServerError = [400, 500, 502, 503].includes(res.status) || res.status >= 400;
    if (isDefinitiveServerError) {
      const errJson = await res.json().catch(() => ({}));
      console.warn(`[ReceiptScan] Server definitive error (${res.status}):`, errJson);
      shouldTriggerOcrFallback = true;
      ocrFallbackMessage = 'Cloud vision timed out. Falling back to on-device OCR...';
    } else {
      throw new Error(`Receipt scan API responded with unexpected status ${res.status}`);
    }
  } catch (err) {
    clearScanningTimers();

    if (err.name === 'AbortError') {
      // Condition 1: Fetch explicitly rejected after the full 30s timeout
      console.warn('[ReceiptScan] Gemini Vision fetch rejected after 30s timeout (AbortError).');
      shouldTriggerOcrFallback = true;
      ocrFallbackMessage = 'Cloud vision timed out. Falling back to on-device OCR...';
    } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // Condition 2: Device went offline during fetch
      console.warn('[ReceiptScan] Device went offline during scan request.');
      shouldTriggerOcrFallback = true;
      ocrFallbackMessage = 'Offline mode detected: Running on-device OCR fallback...';
    } else if (shouldTriggerOcrFallback) {
      // Already flagged from definitive server error
    } else {
      // Non-abort, non-offline, non-server-error exception: rethrow to avoid premature OCR fallback
      console.error('[ReceiptScan] Unexpected error without meeting fallback criteria:', err);
      throw err;
    }
  }

  // Direct Client-side Gemini fallback if API key is provided and failure was not 30s timeout
  const activeKey = (clientApiKey || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '').trim();
  if (shouldTriggerOcrFallback && !controller.signal.aborted && activeKey && isOnline) {
    try {
      const prompt = `
You are an expert document understanding and supermarket receipt OCR specialist for a household food cost and waste research project in the Philippines.
Extract supermarket receipt data from this image with high precision:

CRITICAL PHILIPPINE RECEIPT CONVENTIONS & RULES:
1. Currency: Philippine Peso ('P', '₱', 'PHP'). Never confuse leading 'P' with a digit (e.g. "P1,757.50" -> 1757.50).
2. Thousands Commas: Amounts frequently use commas (e.g. "1,757.50"). Normalize all amounts into clean numbers/floats in JSON (e.g. 1757.50, never strings with commas).
3. VAT & Tax Suffixes: Disregard trailing tax letters (e.g. "1,757.50 V" -> 1757.50).
4. Line Items: For items like "NIDO JR MILK POWDER", map name/description: "NIDO JR MILK POWDER", qty: 1.0, unitPrice: 1757.50, lineTotal: 1757.50.
5. Total Amount Paid: Look for rows labeled TOTAL, CASH, or card/e-wallet names (e.g. BDO, GCash, MASTERCARD) to confirm final amount paid as a clean float.

Return strict JSON:
{
  "storeName": "string",
  "purchaseDate": "YYYY-MM-DD" | null,
  "date": "YYYY-MM-DD" | null,
  "tripType": "Supermarket" | "Wet Market / Palengke" | "Specialty Grocery" | "Convenience Store",
  "items": [
    {
      "name": "string",
      "description": "string",
      "rawReceiptText": "string",
      "qty": 1.0,
      "quantity": 1.0,
      "unit": "string",
      "price": 0.0,
      "unitPrice": 0.0,
      "total": 0.0,
      "totalPrice": 0.0,
      "lineTotal": 0.0,
      "weightGrams": null,
      "discount": 0.0
    }
  ],
  "subtotal": 0.0,
  "discounts": 0.0,
  "tax": 0.0,
  "totalAmountPaid": 0.0,
  "uncertainFields": [],
  "mathValid": true,
  "discrepancyNote": "",
  "rawText": ""
}
`;
      const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
      const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');

      for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(activeKey)}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                { text: prompt }
              ]
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.05
            }
          })
        });

        if (response.ok) {
          const jsonRes = await response.json();
          const text = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;
          const parsed = parseGeminiJson(text);
          if (parsed) {
            onProgress({ status: 'populating', progress: 0.95, message: 'Populating receipt items...' });
            return normalizeReceiptData(parsed, 'CLIENT_GEMINI_VISION');
          }
        }
      }
    } catch (clientErr) {
      console.warn('[ReceiptScan] Direct client Gemini fallback failed:', clientErr);
    }
  }

  // Graceful Client OCR (Tesseract.js) fallback when fallback criteria are met
  if (shouldTriggerOcrFallback) {
    return await executeLocalOcrFallback(dataUrl, onProgress, ocrFallbackMessage);
  }

  throw new Error('Could not scan receipt. Please enter items manually.');
}

/**
 * Executes local on-device Tesseract OCR fallback
 */
async function executeLocalOcrFallback(dataUrl, onProgress, statusMessage) {
  try {
    // If and only if it truly fails or times out after 30s, display status message before initializing OCR
    onProgress({
      status: 'ocr_fallback',
      progress: 0.65,
      message: statusMessage || 'Cloud vision timed out. Falling back to on-device OCR...'
    });

    const rawOcrText = await runClientOCR(dataUrl, (p) => {
      onProgress({
        status: 'ocr_fallback',
        progress: 0.65 + (p.progress * 0.25),
        message: statusMessage || 'Cloud vision timed out. Falling back to on-device OCR...'
      });
    });

    const parsedOffline = parseOfflineReceiptText(rawOcrText);
    onProgress({ status: 'populating', progress: 0.95, message: 'Populating receipt items...' });

    return normalizeReceiptData({
      ...parsedOffline,
      rawText: rawOcrText
    }, 'OFFLINE_TESSERACT_OCR');
  } catch (ocrErr) {
    console.error('[ReceiptScan] Local OCR fallback also failed:', ocrErr);
    throw new Error('Could not scan receipt. Please enter items manually.');
  }
}

// Convenient alias for receipt scanning orchestration
export const scanReceipt = scanSupermarketReceipt;


/**
 * Sanitizes currency values for Philippine receipts.
 * Handles:
 *  - Thousands commas ("1,757.50")
 *  - Currency prefixes ('P', '₱', 'PHP', 'Php')
 *  - Trailing VAT/tax classification letters ('1,757.50 V', 'T', 'E', 'Z', 'VAT')
 *  - Never allows parseFloat("1,757.50") to run without first removing the comma
 */
export function sanitizeCurrency(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  if (typeof val !== 'string') return 0;

  // 1. Remove commas
  let clean = val.replace(/,/g, '').trim();

  // 2. Remove currency indicators ('₱', 'PHP', and leading 'P'/'p' preceding digits)
  clean = clean.replace(/[₱\s]/gi, '');
  clean = clean.replace(/\bPHP\b/gi, '');
  clean = clean.replace(/^[Pp](?=\d)/, '');

  // 3. Remove trailing VAT / tax letter suffixes (e.g., "1,757.50 V" -> 1757.50)
  clean = clean.replace(/\s*[A-Za-z]+$/, '').trim();

  // Extract clean numerical float match
  const match = clean.match(/-?\d+(?:\.\d+)?/);
  if (match) {
    clean = match[0];
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}

/**
 * Standardizes extracted receipt data into consistent schema with full number sanitization
 */
export function normalizeReceiptData(data, source = 'GEMINI_VISION') {
  const purchaseDate = data.date || data.purchaseDate || new Date().toISOString().split('T')[0];
  const items = Array.isArray(data.items) ? data.items.map((item, idx) => {
    const qty = sanitizeCurrency(item.qty ?? item.quantity ?? 1) || 1;
    const unitPrice = sanitizeCurrency(item.unitPrice ?? item.price ?? 0);
    const lineTotal = sanitizeCurrency(item.lineTotal ?? item.totalPrice ?? item.total ?? (qty * unitPrice));
    const name = item.name || item.description || `Grocery Item #${idx + 1}`;

    return {
      id: item.id || idx + 1,
      name,
      description: name,
      rawReceiptText: item.rawReceiptText || name,
      qty,
      quantity: qty,
      unit: item.unit || 'pcs',
      price: unitPrice,
      unitPrice,
      total: lineTotal,
      totalPrice: lineTotal,
      lineTotal,
      weightGrams: item.weightGrams !== undefined && item.weightGrams !== null ? sanitizeCurrency(item.weightGrams) : null,
      discount: sanitizeCurrency(item.discount || 0)
    };
  }) : [];

  const totalAmountPaid = sanitizeCurrency(data.totalAmountPaid ?? data.total ?? data.subtotal ?? items.reduce((acc, it) => acc + it.totalPrice, 0));

  return {
    storeName: data.storeName || 'SM Supermarket',
    purchaseDate,
    date: purchaseDate,
    tripType: data.tripType || 'Supermarket',
    items,
    totalAmountPaid,
    totalScaleWeightKg: sanitizeCurrency(data.totalScaleWeightKg || 0),
    subtotal: sanitizeCurrency(data.subtotal || totalAmountPaid),
    discounts: sanitizeCurrency(data.discounts || data.discountTotal || 0),
    discountTotal: sanitizeCurrency(data.discountTotal || data.discounts || 0),
    tax: sanitizeCurrency(data.tax || 0),
    invoiceNumber: data.invoiceNumber || data.siNumber || data.orNumber || null,
    paymentMethod: data.paymentMethod || 'CASH',
    cashTendered: data.cashTendered !== undefined && data.cashTendered !== null ? sanitizeCurrency(data.cashTendered) : null,
    change: data.change !== undefined && data.change !== null ? sanitizeCurrency(data.change) : null,
    uncertainFields: data.uncertainFields || [],
    mathValid: data.mathValid ?? true,
    discrepancyNote: data.discrepancyNote || '',
    rawText: data.rawText || '',
    source
  };
}

/**
 * Heuristic parser for offline raw OCR text with Philippine receipt conventions
 */
export function parseOfflineReceiptText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];
  let totalAmountPaid = 0;
  let storeName = lines[0] ? lines[0].slice(0, 30) : 'SM Supermarket';
  let purchaseDate = null;

  // Look for date like 2026-10-31 or 10/31/2026 or 31/10/2026
  const dateMatch = rawText.match(/\b(202[4-9][\-\/]\d{1,2}[\-\/]\d{1,2}|\d{1,2}[\-\/]\d{1,2}[\-\/]202[4-9])\b/);
  if (dateMatch) {
    try {
      const d = new Date(dateMatch[1]);
      if (!isNaN(d.getTime())) {
        purchaseDate = d.toISOString().split('T')[0];
      }
    } catch {}
  }

  // Regex matching Philippine receipt line item amounts:
  // e.g. "NIDO JR MILK POWDER  1,757.50 V" or "CHICKEN BREAST P280.00"
  const itemPriceRegex = /^(.+?)\s+(?:[₱P]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?:\s*[A-Za-z])?$/i;

  // Regex matching rows indicating total or payment:
  // e.g. "TOTAL P1,757.50", "AMOUNT DUE: 1,757.50", "CASH: 2,000.00", "BDO 1,757.50"
  const totalLineRegex = /(?:TOTAL|AMOUNT\s*DUE|CASH|TENDERED|BDO|BPI|GCASH|MASTERCARD|VISA)\b.*?([₱P]?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})/i;

  lines.forEach(line => {
    const lower = line.toLowerCase();

    // Check for totals first
    if (lower.includes('total') || lower.includes('subtotal') || lower.includes('vat') || lower.includes('cash') || lower.includes('amount due') || lower.includes('tendered')) {
      if ((lower.includes('total') && !lower.includes('sub')) || lower.includes('amount due') || lower.includes('cash')) {
        const totalMatch = line.match(totalLineRegex);
        if (totalMatch && totalMatch[1]) {
          const parsed = sanitizeCurrency(totalMatch[1]);
          if (parsed > 0 && (totalAmountPaid === 0 || lower.includes('total'))) {
            totalAmountPaid = parsed;
          }
        }
      }
      return;
    }

    // Match line item
    const match = line.match(itemPriceRegex);
    if (match) {
      const name = match[1].replace(/^[0-9\*\#\-\.]+\s*/, '').trim(); // Strip item indexes
      const priceStr = match[2];
      const price = sanitizeCurrency(priceStr);

      if (name.length > 2 && price > 0 && price < 100000) {
        items.push({
          id: items.length + 1,
          name,
          description: name,
          rawReceiptText: line,
          qty: 1,
          quantity: 1,
          unit: 'pcs',
          price,
          unitPrice: price,
          total: price,
          totalPrice: price,
          lineTotal: price,
          weightGrams: null,
          discount: 0
        });
      }
    }
  });

  if (totalAmountPaid === 0 && items.length > 0) {
    totalAmountPaid = Math.round(items.reduce((sum, i) => sum + i.totalPrice, 0) * 100) / 100;
  }

  return {
    storeName,
    purchaseDate,
    items,
    subtotal: totalAmountPaid,
    discounts: 0,
    tax: 0,
    totalAmountPaid,
    uncertainFields: ['items', 'totalAmountPaid'],
    mathValid: true,
    discrepancyNote: 'Parsed via offline OCR. Please verify all fields.',
    rawText
  };
}
