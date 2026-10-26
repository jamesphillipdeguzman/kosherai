// Serverless API Route for Intelligent Supermarket Receipt Scanning
// Connects to Google Gemini Vision with server-side API key protection
import 'dotenv/config';

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
      message: 'Server-side Gemini API Key is not configured. Please provide image or text for client fallback.'
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

Receipt Analysis Rules:
1. Extract the store or supermarket name (e.g. SM Supermarket, Puregold, Robinsons, Savemore, D-Grocer, etc.).
2. Extract the purchase date in YYYY-MM-DD format if visible. If not visible or uncertain, return null (never fabricate dates).
3. Extract each purchased food/grocery item with:
   - "name": Clean human-readable product name. Expand obvious abbreviations (e.g., "CHK BRST" -> "Chicken Breast", "CARROT LOCAL" -> "Local Carrots").
   - "rawReceiptText": The exact text line from the receipt.
   - "quantity": Number of units purchased (default 1.0).
   - "unit": e.g., "kg", "g", "pack", "pc", "bottle", "can", "bag".
   - "unitPrice": Numerical unit price in PHP (₱).
   - "totalPrice": Numerical final line total in PHP (₱).
   - "weightGrams": If the item was weighed on a produce scale or package specifies grams/kg, record in grams (e.g., 0.850 kg = 850). If not specified, return null.
   - "discount": Any discount deducted for this specific line item (0 if none).
4. Extract financial totals:
   - "subtotal": Subtotal amount before discounts/tax.
   - "discounts": Total discounts applied across receipt.
   - "tax": Tax or VAT indicated on receipt.
   - "totalAmountPaid": Final amount paid by customer in PHP.
5. Verification & Confidence:
   - "uncertainFields": Array of field names where text was faded, torn, or low confidence.
   - "mathValid": Boolean indicating whether sum of item prices minus discounts matches totalAmountPaid (within ₱1 margin of rounding error).
   - "discrepancyNote": Explanation of any mismatch or missing breakdown.
   - "rawText": Reconstructed complete text of the receipt from top to bottom.

Never invent or hallucinate missing items, quantities, or amounts.

Return STRICT JSON matching this schema:
{
  "storeName": "string",
  "purchaseDate": "YYYY-MM-DD" | null,
  "items": [
    {
      "name": "string",
      "rawReceiptText": "string",
      "quantity": 1.0,
      "unit": "string",
      "unitPrice": 0.0,
      "totalPrice": 0.0,
      "weightGrams": 0.0 | null,
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
  "rawText": "string"
}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
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

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[API /api/receipt-scan] Gemini error:', errData);
      return sendJson(res, response.status, {
        error: 'GEMINI_API_ERROR',
        message: errData.error?.message || `Gemini API returned status ${response.status}`
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

    return sendJson(res, 200, parsed);
  } catch (err) {
    console.error('[API /api/receipt-scan] Exception:', err);
    return sendJson(res, 500, {
      error: 'SERVER_SCAN_ERROR',
      message: err.message || 'Internal server error occurred while scanning receipt.'
    });
  }
}
