// Serverless API Route for Intelligent Supermarket Receipt Scanning
// Connects to Google Gemini Vision with server-side API key protection
import 'dotenv/config';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported for /api/receipt-scan.' });
  }

  try {
    const body = await parseRequestBody(req);
    const { imageBase64, mimeType = 'image/jpeg', clientHint = '', activeDiet = 'lid' } = body;

    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      req.body?.apiKey ||
      body?.apiKey ||
      ''
    ).trim();
    if (!apiKey) {
      return sendJson(res, 503, {
        error: 'GEMINI_API_KEY_NOT_CONFIGURED',
        message: 'GEMINI_API_KEY is not configured in Vercel Project Settings or KosherAI Settings. Falling back to on-device OCR.'
      });
    }

    const currentDiet = DIET_NAMES[activeDiet] ? activeDiet : 'lid';
    const currentDietName = DIET_NAMES[currentDiet];

    if (!imageBase64) {
      return sendJson(res, 400, {
        error: 'MISSING_IMAGE',
        message: 'imageBase64 payload is required for receipt scanning.'
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const prompt = `Perform quick document OCR on this receipt image. Return strictly JSON:
{
  "storeName": string,
  "purchaseDate": string,
  "totalAmount": number,
  "items": [
    { "name": string, "quantity": number, "price": number, "total": number }
  ]
}`;

    // Cascade: Try gemini-3.8-flash first, fall back to gemini-2.0-flash
    const models = ['gemini-3.8-flash', 'gemini-2.0-flash'];
    let response = null;
    let lastErrMessage = '';

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: cleanBase64
                    }
                  },
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
              maxOutputTokens: 1024,
              thinkingConfig: {
                thinkingBudget: 0 // Completely disables reasoning latency
              }
            }
          })
        });

        if (response.ok) {
          break;
        } else {
          const errData = await response.json().catch(() => ({}));
          lastErrMessage = errData.error?.message || `Model ${model} returned status ${response.status}`;
          console.warn(`[API /api/receipt-scan] Model ${model} failed (${response.status}): ${lastErrMessage}. Trying next model...`);
        }
      } catch (fetchErr) {
        lastErrMessage = fetchErr.message;
        console.warn(`[API /api/receipt-scan] Model ${model} fetch exception: ${lastErrMessage}`);
      }
    }

    if (!response || !response.ok) {
      return sendJson(res, 502, {
        error: 'GEMINI_API_ERROR',
        message: lastErrMessage || 'Failed to analyze receipt with Gemini Vision.'
      });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return sendJson(res, 502, {
        error: 'EMPTY_AI_RESPONSE',
        message: 'No response received from Gemini model.'
      });
    }

    // Step 3: Enforce Resilient JSON Parsing on the Response
    let rawResponse = candidateText;
    rawResponse = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsedData = null;
    try {
      parsedData = parseGeminiJson(rawResponse);
      if (!parsedData) {
        throw new Error("Could not parse receipt contents. Please ensure the receipt is well-lit and legible.");
      }
    } catch (err) {
      console.error("Failed to parse receipt scanner JSON:", rawResponse);
      return sendJson(res, 502, {
        error: 'INVALID_JSON_RESPONSE',
        message: 'Could not parse receipt contents. Please ensure the receipt is well-lit and legible.',
        raw: rawResponse
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
