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
 * Supermarket Receipt Scanner
 * Tries server-side /api/receipt-scan first (keeping API key secure on server).
 * Falls back to direct client Gemini Vision or Client Tesseract OCR if server is unreachable.
 */
export async function scanSupermarketReceipt(dataUrl, onProgress = () => {}, clientApiKey = '') {
  onProgress({ status: 'uploading', progress: 0.2, message: 'Processing receipt image...' });

  // 1. Try Server-Side /api/receipt-scan
  try {
    const res = await fetch('/api/receipt-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: dataUrl,
        mimeType: 'image/jpeg'
      })
    });

    if (res.ok) {
      const data = await res.json();
      onProgress({ status: 'done', progress: 1.0, message: 'Receipt extracted successfully!' });
      return {
        ...data,
        source: 'SERVER_GEMINI_AI'
      };
    } else {
      console.warn(`[ReceiptScan] Server endpoint returned ${res.status}. Attempting client fallback...`);
    }
  } catch (netErr) {
    console.warn('[ReceiptScan] Server endpoint not reachable. Attempting client fallback...', netErr);
  }

  // 2. Direct Client-side Gemini fallback if API key is present
  const activeKey = (clientApiKey || import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  if (activeKey) {
    try {
      onProgress({ status: 'ai_reasoning', progress: 0.6, message: 'Reading receipt with Gemini AI...' });
      const prompt = `
Extract supermarket receipt data from this image:
Return strict JSON:
{
  "storeName": "Store Name",
  "purchaseDate": "YYYY-MM-DD" or null,
  "items": [
    {
      "name": "Item Description",
      "rawReceiptText": "raw line",
      "quantity": 1.0,
      "unit": "pcs",
      "unitPrice": 0.0,
      "totalPrice": 0.0,
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(activeKey)}`;
      const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');

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
          onProgress({ status: 'done', progress: 1.0, message: 'Receipt extracted via client AI!' });
          return { ...parsed, source: 'CLIENT_GEMINI_AI' };
        }
      }
    } catch (clientErr) {
      console.warn('[ReceiptScan] Client Gemini fallback failed:', clientErr);
    }
  }

  // 3. Client OCR (Tesseract.js) fallback when fully offline
  try {
    onProgress({ status: 'ocr_fallback', progress: 0.7, message: 'Running offline OCR engine...' });
    const rawOcrText = await runClientOCR(dataUrl, (p) => {
      onProgress({ status: 'ocr_fallback', progress: 0.7 + (p.progress * 0.25), message: p.message });
    });

    const parsedOffline = parseOfflineReceiptText(rawOcrText);
    onProgress({ status: 'done', progress: 1.0, message: 'Extracted using offline OCR.' });
    return {
      ...parsedOffline,
      source: 'OFFLINE_TESSERACT_OCR',
      rawText: rawOcrText
    };
  } catch (ocrErr) {
    console.error('[ReceiptScan] Offline OCR also failed:', ocrErr);
    throw new Error('Could not scan receipt. Please enter items manually.');
  }
}

/**
 * Heuristic parser for offline raw OCR text
 */
function parseOfflineReceiptText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];
  let totalAmountPaid = 0;
  let storeName = lines[0] ? lines[0].slice(0, 30) : 'Supermarket';
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

  // Look for items with prices (numbers with decimal)
  const priceRegex = /([A-Za-z0-9\s\.\-]{3,35})\s+([₱P]?\s*(\d+[\.,]\d{2}))$/;
  lines.forEach(line => {
    const lower = line.toLowerCase();
    if (lower.includes('total') || lower.includes('subtotal') || lower.includes('vat') || lower.includes('cash') || lower.includes('change')) {
      const match = line.match(/(\d+[\.,]\d{2})/);
      if (match && lower.includes('total') && !lower.includes('sub')) {
        totalAmountPaid = parseFloat(match[1].replace(',', '.'));
      }
      return;
    }

    const match = line.match(priceRegex);
    if (match) {
      const name = match[1].trim();
      const price = parseFloat(match[3].replace(',', '.'));
      if (name.length > 2 && price > 0 && price < 100000) {
        items.push({
          name,
          rawReceiptText: line,
          quantity: 1,
          unit: 'pcs',
          unitPrice: price,
          totalPrice: price,
          weightGrams: null,
          discount: 0
        });
      }
    }
  });

  if (totalAmountPaid === 0 && items.length > 0) {
    totalAmountPaid = items.reduce((sum, i) => sum + i.totalPrice, 0);
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
