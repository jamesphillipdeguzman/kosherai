// Serverless API Route for Intelligent Supermarket Receipt Scanning
// Connects to Google Gemini Vision with server-side API key protection
import 'dotenv/config';

export const config = {
  maxDuration: 30, // Extends max execution time up to 30s
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
 * Sanitizes and guarantees numeric float values across all financial and quantity fields
 */
export function sanitizeReceiptData(data) {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };
  sanitized.subtotal = sanitizeCurrency(data.subtotal);
  sanitized.discounts = sanitizeCurrency(data.discounts);
  sanitized.tax = sanitizeCurrency(data.tax);
  sanitized.totalAmountPaid = sanitizeCurrency(data.totalAmountPaid ?? data.total ?? data.amountPaid);

  if (Array.isArray(data.items)) {
    sanitized.items = data.items.map((item, idx) => {
      const name = item.name || item.description || `Grocery Item #${idx + 1}`;
      const qty = sanitizeCurrency(item.qty ?? item.quantity ?? 1) || 1;
      const unitPrice = sanitizeCurrency(item.unitPrice ?? item.price ?? 0);
      const lineTotal = sanitizeCurrency(item.lineTotal ?? item.totalPrice ?? item.total ?? (qty * unitPrice));

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
    });
  } else {
    sanitized.items = [];
  }

  sanitized.discountTotal = sanitizeCurrency(data.discountTotal ?? data.discounts);
  sanitized.cashTendered = data.cashTendered !== undefined ? sanitizeCurrency(data.cashTendered) : null;
  sanitized.change = data.change !== undefined ? sanitizeCurrency(data.change) : null;
  sanitized.paymentMethod = data.paymentMethod || (sanitized.cashTendered ? 'CASH' : 'CASH');
  sanitized.invoiceNumber = data.invoiceNumber || data.siNumber || data.orNumber || null;

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
    const { imageBase64, mimeType = 'image/jpeg', clientHint = '' } = body;

    if (!imageBase64) {
      return sendJson(res, 400, {
        error: 'MISSING_IMAGE',
        message: 'imageBase64 payload is required for receipt scanning.'
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const prompt = `
You are an expert document understanding and supermarket receipt OCR specialist for a household food cost and waste research project in the Philippines.
Analyze this supermarket receipt image with high precision.

CRITICAL PHILIPPINE RECEIPT CONVENTIONS & RULES:
1. Currency:
   - Currency is Philippine Peso, typically denoted by 'P', '₱', 'PHP', or 'Php' (e.g., "P1,757.50" or "₱ 1,757.50").
   - NEVER confuse the letter 'P' with digits (e.g. "P1,757.50" is 1757.50, NOT 11757.50).
2. Number Normalization & Thousands Commas:
   - Philippine receipt amounts frequently use commas for thousands (e.g. "1,757.50", "2,450.00").
   - ALWAYS normalize all amounts into standard clean numbers/floats in the JSON response (e.g. return 1757.50 as a numeric float, NEVER return strings with commas or currency signs).
3. VAT & Tax Suffixes:
   - Disregard trailing tax letters (e.g. "1,757.50 V" -> 1757.50, "120.00 T" -> 120.00, "50.00 E" -> 50.00, "NV", "VAT").
   - The letter 'V' indicates VATable in the Philippines. Strip tax classification letters from prices and line totals.
4. Line Items & Multi-line Parsing:
   - Retail & Pharmacy Multi-line Items: Line items often span two lines. The first line contains [Quantity] [SKU/Code] [@OriginalUnitPrice] [DiscountedPrice] [LineTotal] (e.g., "30 212025 @21.75 15.54 466.07"), and the line immediately below contains the product name (e.g. "CALSAN CHEW TAB"). Combine these into a single item object with the correct qty, unitPrice, and lineTotal.
   - For every purchased food/grocery/pharmacy product, extract:
     * "name": Clean human-readable product name. Expand obvious abbreviations (e.g., "CHK BRST" -> "Chicken Breast", "NIDO JR MILK POWDER", "CALSAN CHEW TAB").
     * "description": Clean product name.
     * "rawReceiptText": The exact text line(s) from the receipt.
     * "qty": Number of units purchased as a numeric float (e.g. 30.0).
     * "quantity": Number of units purchased as a numeric float (e.g. 30.0).
     * "unit": e.g. "kg", "g", "pack", "pc", "tab", "cap", "bottle", "can", "bag", "box".
     * "price": Unit price in PHP as a numeric float (e.g. 15.54).
     * "unitPrice": Unit price in PHP as a numeric float (e.g. 15.54).
     * "total": Final line total in PHP as a numeric float (e.g. 466.07).
     * "totalPrice": Final line total in PHP as a numeric float (e.g. 466.07).
     * "lineTotal": Final line total in PHP as a numeric float (e.g. 466.07).
     * "weightGrams": If item specifies produce scale weight or packaging grams/kg, record in grams (e.g. 0.850 kg = 850). If not specified, return null.
     * "discount": Any discount deducted for this specific line item as a numeric float (0 if none).
5. Senior / PWD Discounts & Multiple Totals:
   - Philippine receipts often show step-down totals: Gross -> Less 12% VAT -> Intermediate Total -> Less 20% Senior/PWD Disc -> Final Net Amount.
   - Always choose the FINAL net payable amount (matching the amount settled by Cash/Card before Change) as "totalAmountPaid". For example, choose 466.07, NOT 652.50 or 582.59.
   - Look for payment confirmation rows ("CASH", "TENDERED", or card/e-wallet names like "BDO", "BPI", "GCASH", "MASTERCARD", "VISA", "MAYA") to confirm the final amount paid.
   - Return "totalAmountPaid" as a clean numeric float (e.g. 466.07).
6. Store & Metadata:
   - "storeName": Supermarket, grocery, or pharmacy name (e.g. SM Supermarket, Mercury Drug, Southstar Drug, Watsons, Puregold, Robinsons).
   - "purchaseDate" / "date": YYYY-MM-DD format if visible, or null if uncertain.
   - "invoiceNumber": Official receipt, invoice, or transaction number if present.
   - "tripType": "Supermarket" | "Wet Market / Palengke" | "Specialty Grocery" | "Convenience Store" | "Pharmacy".
   - "subtotal": Gross subtotal before discounts/tax as a numeric float (e.g. 652.50).
   - "discounts" / "discountTotal": Total discounts applied as a numeric float (e.g. 116.52).
   - "tax": Tax or VAT indicated as a numeric float.
   - "paymentMethod": "CASH" | "CARD" | "E-WALLET".
   - "cashTendered": Amount handed by customer as numeric float (e.g. 500.00) or null.
   - "change": Change returned as numeric float (e.g. 33.93) or null.
   - "uncertainFields": Array of field names where text was faded, torn, or low confidence.
   - "mathValid": Boolean indicating whether sum of item prices minus discounts matches totalAmountPaid (within ₱1 margin of rounding error).
   - "discrepancyNote": Explanation of any mismatch or missing breakdown.
   - "rawText": Reconstructed complete text of the receipt from top to bottom.

Never invent or hallucinate missing items, quantities, or amounts.

Return STRICT JSON matching this schema (all financial and quantity fields MUST be numbers, NEVER strings):
{
  "storeName": "string" | null,
  "date": "YYYY-MM-DD" | null,
  "purchaseDate": "YYYY-MM-DD" | null,
  "invoiceNumber": "string" | null,
  "tripType": "Supermarket" | "Wet Market / Palengke" | "Specialty Grocery" | "Convenience Store" | "Pharmacy",
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
      "discount": 0.0
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
  "rawText": "string"
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

    const sanitized = sanitizeReceiptData(parsed);
    return sendJson(res, 200, sanitized);
  } catch (err) {
    console.error('[API /api/receipt-scan] Exception:', err);
    return sendJson(res, 500, {
      error: 'SERVER_SCAN_ERROR',
      message: err.message || 'Internal server error occurred while scanning receipt.'
    });
  }
}
