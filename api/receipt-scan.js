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

function parseGeminiJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = rawText.trim();
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  } else if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  } else {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(text);
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
  sanitized.subtotal = sanitizeCurrency(data.subtotal);
  sanitized.discounts = sanitizeCurrency(data.discounts);
  sanitized.tax = sanitizeCurrency(data.tax);
  sanitized.totalAmountPaid = sanitizeCurrency(data.totalAmountPaid ?? data.total ?? data.amountPaid);

  let safeCount = 0;
  let flaggedCount = 0;

  if (Array.isArray(data.items)) {
    sanitized.items = data.items.map((item, idx) => {
      const name = item.name || item.description || `Grocery Item #${idx + 1}`;
      const qty = sanitizeCurrency(item.qty ?? item.quantity ?? 1) || 1;
      const unitPrice = sanitizeCurrency(item.unitPrice ?? item.price ?? 0);
      const lineTotal = sanitizeCurrency(item.lineTotal ?? item.totalPrice ?? item.total ?? (qty * unitPrice));

      const isSafeForDiet = item.isSafeForDiet !== false && item.dietStatus !== 'AVOID';
      const dietStatus = item.dietStatus || (isSafeForDiet ? 'SAFE' : 'AVOID');
      const dietFlagReason = item.dietFlagReason || item.flagReason || '';
      const suggestedSwap = item.suggestedSwap || item.swap || '';

      if (isSafeForDiet && dietStatus !== 'AVOID') {
        safeCount += 1;
      } else {
        flaggedCount += 1;
      }

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
        discount: sanitizeCurrency(item.discount || 0),
        isSafeForDiet,
        dietStatus,
        dietFlagReason,
        suggestedSwap
      };
    });
  } else {
    sanitized.items = [];
  }

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

  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return sendJson(res, 503, {
      error: 'GEMINI_API_KEY_NOT_CONFIGURED',
      message: 'Server-side GEMINI_API_KEY is not configured in process.env. Falling back to client-side OCR.'
    });
  }

  try {
    const body = await parseRequestBody(req);
    const { imageBase64, mimeType = 'image/jpeg', clientHint = '', activeDiet = 'lid' } = body;

    const currentDiet = DIET_NAMES[activeDiet] ? activeDiet : 'lid';
    const currentDietName = DIET_NAMES[currentDiet];

    if (!imageBase64) {
      return sendJson(res, 400, {
        error: 'MISSING_IMAGE',
        message: 'imageBase64 payload is required for receipt scanning.'
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const prompt = `
You are an expert document understanding, supermarket receipt OCR, and clinical nutrition specialist for the Philippines.
Analyze this supermarket/grocery receipt image with high precision, extract line items and financial totals, and cross-check compliance against the user's active dietary protocol.

CRITICAL PHILIPPINE RECEIPT CONVENTIONS & RULES:
1. Currency:
   - Currency is Philippine Peso, denoted by 'P', '₱', 'PHP', or 'Php' (e.g., "P1,757.50" or "₱ 1,757.50").
   - NEVER confuse the letter 'P' with digits (e.g. "P1,757.50" is 1757.50, NOT 11757.50).
2. Number Normalization & Thousands Commas:
   - Amounts frequently use commas for thousands (e.g. "1,757.50").
   - ALWAYS normalize all amounts into standard clean numeric floats in the JSON response (e.g. 1757.50, NEVER strings with commas).
3. VAT & Tax Suffixes:
   - Disregard trailing tax letters (e.g. "1,757.50 V" -> 1757.50, "120.00 T" -> 120.00, "50.00 E" -> 50.00, "NV", "VAT"). Strip tax classification letters from prices.
4. Line Items & Multi-line Parsing:
   - Combine two-line pharmacy/supermarket items (e.g. quantity line + product name line) into a single clean item.
   - For every purchased food/grocery product, extract:
     * "name": Clean human-readable product name. Expand obvious abbreviations (e.g., "CHK BRST" -> "Chicken Breast", "NIDO JR MILK", "ROAST CHICKEN").
     * "description": Clean product name.
     * "rawReceiptText": The exact text line(s) from receipt.
     * "qty" / "quantity": Number of units purchased as a numeric float.
     * "unit": e.g. "kg", "g", "pack", "pc", "bottle", "can", "bag", "box".
     * "price" / "unitPrice": Unit price in PHP as a numeric float.
     * "total" / "totalPrice" / "lineTotal": Final line total in PHP as a numeric float.
     * "weightGrams": If item specifies produce scale weight or grams, record in grams (e.g. 0.850 kg = 850). If not specified, return null.
     * "discount": Any discount deducted for this specific line item as a numeric float (0 if none).
5. Senior / PWD Discounts & Final Net Payable:
   - Look for the FINAL net payable amount settled by Cash/Card before Change as "totalAmountPaid".
   - Look for payment rows ("CASH", "TENDERED", "BDO", "BPI", "GCASH", "MASTERCARD", "VISA", "MAYA") to confirm final amount paid.
6. Store & Metadata:
   - "storeName": Supermarket or grocery name (e.g. SM Supermarket, Puregold, Robinsons Supermarket, Mercury Drug).
   - "purchaseDate" / "date": YYYY-MM-DD format if visible, or null.
   - "tripType": "Supermarket" | "Wet Market / Palengke" | "Specialty Grocery" | "Convenience Store" | "Pharmacy".
   - "subtotal": Gross subtotal before discounts/tax as a numeric float.
   - "discounts" / "discountTotal": Total discounts applied as a numeric float.
   - "tax": Tax or VAT indicated as a numeric float.

7. DIET-AWARE PHILIPPINE NUTRITION CROSS-CHECK:
   Active Dietary Protocol: "${currentDietName}" (Protocol key: "${currentDiet}")
   For EVERY extracted food/grocery item, evaluate compliance against "${currentDiet}":
   * If "lid" (Low-Iodine Protocol):
     - Flag iodized salt, table salt, sea salt, marine seafood (tuna, bangus, tilapia, salmon, sardines, shrimp, crab, tahong, squid), commercial dairy (milk, cheese, butter, yogurt, whey), whole eggs & egg yolks, soy products (toyo, tofu, tokwa), and seaweed/carrageenan.
     - Safe swap tip: Non-iodized kosher salt, fresh chicken/pork/beef, pure egg whites, sayote, kalabasa.
   * If "low_purine" (Gout / Anti-Uric Acid):
     - Flag organ meats (isaw, bopis, atay / liver, tripe, dinuguan), sardines, anchovies, shellfish (tahong, talaba, hipon, alimango), and mung beans (munggo / balatong).
     - Safe swap tip: Lean skinless chicken breast, sayote, kalabasa, egg whites.
   * If "low_sodium" (Heart-Care / DASH):
     - Flag patis (fish sauce), bagoong (alamang), toyomansi, instant noodles (pancit canton, ramen), bouillon cubes/granules (Knorr, Maggi cubes), dried salted fish (tuyo, daing, tinapa), and canned meats (corned beef, spam).
     - Safe swap tip: Fresh calamansi juice + crushed garlic + siling labuyo, unsalted fresh meats.
   * If "diabetic" (Diabetic / Low-GI):
     - Flag refined starches (white rice sacks, white bread, pancit), added sugars, sweet Filipino sauces (banana ketchup, sweet chili sauce), sweetened condensed milk, and sugary sodas/juices.
     - Safe swap tip: Cauliflower rice, red/brown rice, fresh tomato salsa, unsweetened coconut cream.
   * If "pinoy_keto" (Pinoy Keto / Low-Carb):
     - Flag high-carb starches (white rice, corn, potatoes, sweet potato/kamote, flour, pandesal, noodles), sugar, and sweet marinades.
     - Safe swap tip: Shirataki or riced cauliflower, pork belly, eggs, leafy greens.

   For EACH item object:
   * "isSafeForDiet": boolean (true if permitted on "${currentDiet}", false if flagged)
   * "dietStatus": "SAFE" | "CAUTION" | "AVOID"
   * "dietFlagReason": concise explanation if flagged, or empty string if safe
   * "suggestedSwap": Pinoy smart swap alternative if flagged, or empty string

Return STRICT JSON matching this schema:
{
  "storeName": "string" | null,
  "date": "YYYY-MM-DD" | null,
  "purchaseDate": "YYYY-MM-DD" | null,
  "invoiceNumber": "string" | null,
  "tripType": "Supermarket" | "Wet Market / Palengke" | "Specialty Grocery" | "Convenience Store" | "Pharmacy",
  "activeDiet": "${currentDiet}",
  "activeDietName": "${currentDietName}",
  "complianceSummary": "string",
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
      "weightGrams": 0.0 | null,
      "discount": 0.0,
      "isSafeForDiet": true,
      "dietStatus": "SAFE",
      "dietFlagReason": "",
      "suggestedSwap": ""
    }
  ],
  "subtotal": 0.0,
  "discountTotal": 0.0,
  "discounts": 0.0,
  "tax": 0.0,
  "totalAmountPaid": 0.0,
  "paymentMethod": "CASH",
  "cashTendered": 0.0 | null,
  "change": 0.0 | null,
  "uncertainFields": [],
  "mathValid": true,
  "discrepancyNote": "",
  "rawText": ""
}
`;

    // Cascade: Try gemini-2.5-flash first, fall back to gemini-1.5-flash
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
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
              responseMimeType: 'application/json',
              temperature: 0.05
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

    const parsed = parseGeminiJson(candidateText);
    if (!parsed) {
      return sendJson(res, 502, {
        error: 'INVALID_JSON_RESPONSE',
        message: 'Could not parse JSON structure from AI output.',
        raw: candidateText
      });
    }

    const sanitized = sanitizeReceiptData(parsed, currentDiet);
    return sendJson(res, 200, sanitized);
  } catch (err) {
    console.error('[API /api/receipt-scan] Exception:', err);
    return sendJson(res, 500, {
      error: 'SERVER_SCAN_ERROR',
      message: err.message || 'Internal server error occurred while scanning receipt.'
    });
  }
}
