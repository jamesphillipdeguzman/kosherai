// Serverless API Route for Intelligent Supermarket Receipt Scanning
// Connects to Google Gemini Vision with server-side API key protection
import 'dotenv/config';
import { setCorsHeaders } from '../lib/auth.js';
import { GEMINI_MODELS, buildGeminiRequestConfig, classifyGeminiError } from '../lib/geminiConfig.js';

export const config = {
  maxDuration: 30, // Extends max execution time up to 30s
};

const DIET_NAMES = {
  lid: 'LID Protocol (Default)',
  low_purine: 'Low-Purine / Anti-Uric Acid',
  low_sodium: 'Low-Sodium / Heart-Care (DASH)',
  diabetic: 'Diabetic / Low-GI',
  pinoy_keto: 'Pinoy Keto / Low-Carb'
};

/**
 * Standardizes sending JSON responses across Vercel Serverless and Node/Connect HTTP
 */
function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * Parses request body for both pre-parsed environments (Vercel) and raw streams (Connect/Vite)
 */
async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export function parseGeminiJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = rawText.trim();
  // Strip markdown code block wrappers if present
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(text);
  } catch (err) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Sanitizes currency values for Philippine receipts.
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
 * Sanitizes and guarantees numeric float values and diet compliance metadata
 */
export function sanitizeReceiptData(data, activeDiet = 'lid') {
  if (!data || typeof data !== 'object') return data;

  const currentDietKey = DIET_NAMES[activeDiet] ? activeDiet : 'lid';
  const currentDietName = DIET_NAMES[currentDietKey];

  const sanitized = { ...data };
  sanitized.storeName = data.storeName || 'Unknown Store';
  sanitized.subtotal = sanitizeCurrency(data.subtotal);
  sanitized.discounts = sanitizeCurrency(data.discounts);
  sanitized.totalAmountPaid = sanitizeCurrency(data.totalAmountPaid ?? data.totalAmount ?? data.total ?? data.amountPaid);
  sanitized.totalAmount = sanitized.totalAmountPaid;

  let safeCount = 0;
  let flaggedCount = 0;

  if (Array.isArray(data.items)) {
    sanitized.items = data.items.map((item, idx) => {
      const cleanName = item.cleanName || item.name || item.description || `Grocery Item #${idx + 1}`;
      const name = cleanName;
      const rawText = item.rawText || item.rawReceiptText || name;
      const qty = sanitizeCurrency(item.qty ?? item.quantity ?? 1) || 1;
      const unitPrice = sanitizeCurrency(item.unitPrice ?? item.price ?? 0);
      const lineTotal = sanitizeCurrency(item.lineTotal ?? item.totalPrice ?? item.total ?? (qty * unitPrice));

      const rawStatus = String(item.status || item.dietStatus || (item.isSafeForDiet === false ? 'AVOID' : 'SAFE')).toUpperCase().trim();
      const status = ['SAFE', 'CAUTION', 'AVOID'].includes(rawStatus) ? rawStatus : 'SAFE';
      const isSafeForDiet = status === 'SAFE';
      const clinicalReason = item.clinicalReason || item.dietFlagReason || item.flagReason || '';
      const suggestedSwap = item.suggestedSwap || item.swap || null;

      if (status === 'SAFE') {
        safeCount += 1;
      } else {
        flaggedCount += 1;
      }

      return {
        id: item.id || idx + 1,
        name,
        cleanName,
        description: cleanName,
        rawText,
        rawReceiptText: rawText,
        qty,
        quantity: qty,
        unit: item.unit || 'pcs',
        price: unitPrice,
        unitPrice,
        total: lineTotal,
        totalPrice: lineTotal,
        lineTotal,
        weightGrams: item.weightGrams !== undefined && item.weightGrams !== null ? sanitizeCurrency(item.weightGrams) : null,
        discount: sanitizeCurrency(item.discount || 0),
        status,
        dietStatus: status,
        isSafeForDiet,
        clinicalReason,
        dietFlagReason: clinicalReason,
        suggestedSwap
      };
    });
  } else {
    sanitized.items = [];
  }

  sanitized.detectedItemsCount = sanitized.items.length;
  sanitized.discountTotal = sanitizeCurrency(data.discountTotal ?? data.discounts);
  sanitized.cashTendered = data.cashTendered !== undefined ? sanitizeCurrency(data.cashTendered) : null;
  sanitized.change = data.change !== undefined ? sanitizeCurrency(data.change) : null;
  sanitized.paymentMethod = data.paymentMethod || (sanitized.cashTendered ? 'CASH' : 'CASH');
  sanitized.invoiceNumber = data.invoiceNumber || data.siNumber || data.orNumber || null;

  // Multi-Diet metadata
  sanitized.activeDiet = currentDietKey;
  sanitized.activeDietName = currentDietName;
  sanitized.safeItemCount = safeCount;
  sanitized.flaggedItemCount = flaggedCount;
  sanitized.complianceSummary = `${safeCount} Safe, ${flaggedCount} Flagged for ${currentDietName}`;

  // Fallback: If totalAmountPaid is missing or 0 but item totals exist, calculate sum
  if (!sanitized.totalAmountPaid && sanitized.items.length > 0) {
    sanitized.totalAmountPaid = Math.round(sanitized.items.reduce((acc, it) => acc + it.totalPrice, 0) * 100) / 100;
  }

  return sanitized;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported for /api/receipt-scan.' });
  }

  const tStart = Date.now();
  try {
    const body = await parseRequestBody(req);
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      clientHint = '',
      activeDiet = 'lid',
      mode = ''
    } = body || {};

    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      ''
    ).trim();
    if (!apiKey) {
      return sendJson(res, 503, {
        error: 'GEMINI_API_KEY_NOT_CONFIGURED',
        errorType: 'AUTH_ERROR',
        retryable: false,
        message: 'Server Gemini API key is not configured.'
      });
    }

    const currentDiet = DIET_NAMES[activeDiet] ? activeDiet : 'lid';
    const currentDietName = DIET_NAMES[currentDiet];

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return sendJson(res, 400, {
        error: 'MISSING_IMAGE',
        errorType: 'INVALID_IMAGE',
        retryable: false,
        message: 'imageBase64 payload is required.'
      });
    }

    const supportedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const normalizedMime = String(mimeType || 'image/jpeg').toLowerCase().split(';')[0].trim();
    if (!supportedMimes.includes(normalizedMime)) {
      return sendJson(res, 400, {
        error: 'UNSUPPORTED_IMAGE_TYPE',
        errorType: 'INVALID_IMAGE',
        retryable: false,
        message: `Unsupported image MIME type: ${normalizedMime}`
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
    if (!cleanBase64 || cleanBase64.length < 32) {
      return sendJson(res, 400, {
        error: 'INVALID_IMAGE_DATA',
        errorType: 'INVALID_IMAGE',
        retryable: false,
        message: 'Captured image data is empty or corrupted.'
      });
    }
    // Guard against oversized payloads (~8MB base64)
    if (cleanBase64.length > 8 * 1024 * 1024) {
      return sendJson(res, 413, {
        error: 'IMAGE_TOO_LARGE',
        errorType: 'INVALID_IMAGE',
        retryable: false,
        message: 'Image payload is too large. Please retry with a smaller or compressed photo.'
      });
    }

    const isFoodRecognition = mode === 'food_recognition' || body.scanTarget === 'food_recognition';
    const isFoodLabel = !isFoodRecognition && (body.scanTarget === 'food_label' || body.scanType === 'food_label');

    let prompt = '';
    if (isFoodRecognition) {
      prompt = `Identify the food item, produce, dish, or packaged product in this image.
Recognize Filipino produce and local names when applicable (e.g., kamote/sweet potato, gabi/taro, ube, malunggay, sayote, kangkong, talong, sitaw, ampalaya, pechay, bangus, tilapia).
If this is a packaged product with a visible ingredient list, set "isPackagedLabel": true and put the extracted ingredients in "ingredientsText".
If the image is blurry, ambiguous, or not food, set "needsClarification": true and a low confidence.
Return strictly JSON:
{
  "foodName": "Common English food name",
  "localName": "Local Filipino name if applicable, or empty string",
  "isPackagedLabel": false,
  "ingredientsText": "",
  "confidence": 0.95,
  "explanation": "Short 1-sentence visual description",
  "needsClarification": false
}`;
    } else if (isFoodLabel) {
      prompt = `Extract all ingredient items and nutrition label details from this food packaging image.
Evaluate the product and every identified ingredient under the "${currentDietName}" (${currentDiet}) dietary compliance protocol.
If the label is blurry, unreadable, or contains no ingredient text, set "status": "UNKNOWN", "isSafe": false, and explain why. NEVER mark an unreadable or unverified label as "SAFE".
Return strictly JSON:
{
  "productName": "Product Name or Scanned Food Label",
  "status": "SAFE" | "AVOID" | "CAUTION" | "UNKNOWN",
  "reason": "Brief clinical explanation based on the active dietary protocol",
  "problemIngredients": ["ingredient1", "ingredient2"],
  "rawText": "Extracted ingredient list text",
  "ingredients": [
    {
      "name": "Ingredient name",
      "status": "SAFE" | "AVOID" | "CAUTION",
      "reason": "Reason"
    }
  ]
}`;
    } else {
      prompt = `Extract all purchased food line items and receipt details from this Philippine supermarket receipt image.
Evaluate each item under the "${currentDietName}" (${currentDiet}) dietary compliance protocol.
Return strictly JSON:
{
  "storeName": "Store or Supermarket Name",
  "purchaseDate": "YYYY-MM-DD",
  "totalAmountPaid": 0.00,
  "items": [
    {
      "name": "Clean Item Name",
      "quantity": 1,
      "unit": "pcs",
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "category": "Produce | Meat | Dairy/Alt | Pantry | Bakery | Beverages | General Food",
      "lidStatus": "SAFE | AVOID | CAUTION",
      "lidReason": "Brief dietary compliance reason"
    }
  ]
}`;
    }

    // Centralized Gemini 3.8 Flash cascade with thinkingLevel: 'LOW'
    const models = GEMINI_MODELS;
    const perModelTimeoutMs = isFoodRecognition ? 9500 : 15000;
    let response = null;
    let lastErrMessage = '';
    let lastClassification = classifyGeminiError(502, '');
    let modelUsed = '';
    const tGeminiStart = Date.now();

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), perModelTimeoutMs);
      const generationConfig = buildGeminiRequestConfig({
        thinkingLevel: 'LOW',
        maxOutputTokens: isFoodRecognition ? 512 : 4096,
        responseMimeType: 'application/json'
      });

      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: normalizedMime,
                      data: cleanBase64
                    }
                  },
                  { text: prompt }
                ]
              }
            ],
            generationConfig
          })
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          modelUsed = model;
          break;
        } else {
          const errData = await response.json().catch(() => ({}));
          lastErrMessage = errData.error?.message || `Model ${model} returned status ${response.status}`;
          lastClassification = classifyGeminiError(response.status, lastErrMessage);
          console.warn(`[API /api/receipt-scan] Model ${model} failed (${response.status}, type=${lastClassification.errorType}): ${lastErrMessage}`);
          // Do not retry permanent errors (invalid credentials or invalid image)
          if (!lastClassification.retryable) {
            break;
          }
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        lastErrMessage = fetchErr.name === 'AbortError'
          ? `Model ${model} timed out after ${perModelTimeoutMs}ms`
          : (fetchErr.message || 'Network request failed');
        lastClassification = classifyGeminiError(0, lastErrMessage, fetchErr.name);
        console.warn(`[API /api/receipt-scan] Model ${model} exception (type=${lastClassification.errorType}): ${lastErrMessage}`);
      }
    }
    const geminiMs = Date.now() - tGeminiStart;

    if (!response || !response.ok) {
      console.warn(`[API /api/receipt-scan] Gemini cascade failed in ${geminiMs}ms (${lastClassification.errorType}): ${lastErrMessage}`);
      return sendJson(res, lastClassification.httpStatus, {
        error: lastClassification.errorType,
        errorType: lastClassification.errorType,
        retryable: lastClassification.retryable,
        message: lastClassification.userMessage
      });
    }

    const data = await response.json().catch(() => null);
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return sendJson(res, 502, {
        error: 'EMPTY_AI_RESPONSE',
        errorType: 'MALFORMED_RESPONSE',
        retryable: true,
        message: 'Gemini returned an empty response. Please retry with the captured image.'
      });
    }

    const parsedData = parseGeminiJson(candidateText);
    if (!parsedData || typeof parsedData !== 'object') {
      console.error('[API /api/receipt-scan] Failed to parse Gemini JSON:', String(candidateText).slice(0, 300));
      return sendJson(res, 502, {
        error: 'INVALID_JSON_RESPONSE',
        errorType: 'MALFORMED_RESPONSE',
        retryable: true,
        message: 'Could not parse structured data from AI response. Please retry.'
      });
    }

    const totalMs = Date.now() - tStart;
    console.log(`[API /api/receipt-scan] mode=${isFoodRecognition ? 'food_recognition' : (isFoodLabel ? 'food_label' : 'receipt')} model=${modelUsed} geminiMs=${geminiMs} totalMs=${totalMs}`);

    if (isFoodRecognition) {
      const foodName = String(parsedData.foodName || parsedData.productName || '').trim();
      if (!foodName) {
        return sendJson(res, 502, {
          error: 'INCOMPLETE_AI_RESPONSE',
          errorType: 'MALFORMED_RESPONSE',
          retryable: true,
          message: 'AI could not identify a food name from the image. Please retry or enter manually.'
        });
      }
      return sendJson(res, 200, {
        success: true,
        source: 'GEMINI_VISION_STAGE1',
        foodName,
        localName: String(parsedData.localName || '').trim(),
        isPackagedLabel: Boolean(parsedData.isPackagedLabel),
        ingredientsText: String(parsedData.ingredientsText || '').trim(),
        confidence: typeof parsedData.confidence === 'number' ? parsedData.confidence : 0.85,
        explanation: String(parsedData.explanation || '').trim(),
        needsClarification: Boolean(parsedData.needsClarification),
        timings: { geminiMs, totalMs, modelUsed }
      });
    }

    if (isFoodLabel) {
      if (!parsedData.status) {
        return sendJson(res, 502, {
          error: 'INCOMPLETE_AI_RESPONSE',
          errorType: 'MALFORMED_RESPONSE',
          retryable: true,
          message: 'AI response was missing food safety status. Please retry.'
        });
      }
      return sendJson(res, 200, {
        success: true,
        source: 'GEMINI_VISION',
        ...parsedData,
        timings: { geminiMs, totalMs, modelUsed }
      });
    }

    const sanitized = sanitizeReceiptData(parsedData, currentDiet);

    // Optional non-blocking database persistence
    try {
      await maybeLogReceiptScan(sanitized, currentDiet);
    } catch (dbErr) {
      console.warn('[API /api/receipt-scan] Optional DB log failed non-blockingly:', dbErr?.message || dbErr);
    }

    return sendJson(res, 200, sanitized);
  } catch (err) {
    console.error('[API /api/receipt-scan] Exception:', err);
    return sendJson(res, 500, {
      error: 'SERVER_SCAN_ERROR',
      message: err.message || 'Internal server error occurred while scanning receipt.'
    });
  }
}

/**
 * Optional non-blocking database persistence for receipt scans
 * Safely guards against missing or invalid DATABASE_URL
 */
export async function maybeLogReceiptScan(receiptData, activeDiet = 'lid') {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || typeof databaseUrl !== 'string') return;
  const trimmed = databaseUrl.trim();
  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) return;

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(trimmed);
    const id = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const title = `${receiptData.storeName || 'Supermarket'} Receipt Audit`;
    const status = (receiptData.items || []).some(i => i.status === 'AVOID')
      ? 'AVOID'
      : (receiptData.items || []).some(i => i.status === 'CAUTION')
        ? 'CAUTION'
        : 'SAFE';
    const reason = `Audited ${(receiptData.items || []).length} items under ${(activeDiet || 'lid').toUpperCase()}`;
    const flagged = (receiptData.items || []).filter(i => i.status === 'AVOID').map(i => i.cleanName);
    const jsonFlagged = JSON.stringify(flagged);

    await sql`
      INSERT INTO scans (id, title, status, reason, flagged_ingredients, image_url, created_at)
      VALUES (${id}, ${title}, ${status}, ${reason}, ${jsonFlagged}::jsonb, NULL, NOW())
      ON CONFLICT (id) DO NOTHING;
    `;
    console.log('[API /api/receipt-scan] Optional DB log succeeded:', id);
  } catch (dbErr) {
    // Non-blocking: DB failure must NEVER crash receipt OCR response
    console.warn('[API /api/receipt-scan] Non-blocking DB log skipped:', dbErr?.message || dbErr);
  }
}
