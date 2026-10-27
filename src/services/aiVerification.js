// AI Verification & Image Processing Service (Gemini API + PaddleOCR PP-OCRv4 + Cloudinary)
import { runPaddleOCR, parseReceiptAmount, parseStructuredReceiptText } from './paddleOcrService.js';

/**
 * Client-side canvas downscaling for OCR before dispatching to Cloudinary or API.
 * Prevents HTTP 413 Payload Too Large on serverless routes and avoids base64 encoder crashes.
 *
 * @param {File|Blob|string} file
 * @param {number} maxWidth
 * @param {number} quality
 * @returns {Promise<string>} dataUrl
 */
export const compressImageForOCR = (file, maxWidth = 1600, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (typeof file === 'string' && file.startsWith('data:')) {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = file;
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Compresses an image file client-side before OCR or upload
 */
export async function compressImage(file, maxWidth = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (typeof file === 'string' && file.startsWith('data:')) {
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
      img.src = file;
      return;
    }

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
 * Client-Side OCR using PaddleOCR v4 (PP-OCRv4 ONNX)
 */
export async function runClientOCR(imageSource, onProgress = () => { }) {
  try {
    const res = await runPaddleOCR(imageSource, onProgress);
    return typeof res === 'object' && res !== null ? res.rawText : String(res || '');
  } catch (err) {
    console.warn('[PaddleOCR] Client OCR error:', err);
    throw err;
  }
}

export { runPaddleOCR, parseReceiptAmount, parseStructuredReceiptText };

/**
 * Safe parser that strips markdown wrappers and handles JSON parsing gracefully
 */
export function parseGeminiJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = String(rawText).trim();

  // Strip markdown code block wrappers if present
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(text);
  } catch (err) {
    // Look for outermost JSON object brackets
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        // Fall through
      }
    }
    console.error("Failed to parse receipt scanner JSON:", rawText);
    throw new Error("Could not parse receipt contents. Please ensure the receipt is well-lit and legible.");
  }
}

/**
 * Deep Clinical AI Verification via Gemini API
 * Calls gemini-2.5-flash to enforce strict Radioactive Iodine (RAI) / Low-Iodine Diet protocol
 */
export async function verifyWithGeminiAI(ingredientTextOrPayload, apiKey, activeDiet = 'lid') {
  const activeKey = (apiKey?.trim() || import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  if (!activeKey) {
    throw new Error('Please add your Gemini API Key in Settings or set VITE_GEMINI_API_KEY to enable online AI deep reasoning.');
  }

  // Support string ingredient text or multimodal payload object { text, imageBase64, mimeType }
  const isMultimodal = typeof ingredientTextOrPayload === 'object' && ingredientTextOrPayload !== null;
  const ingredientText = isMultimodal ? (ingredientTextOrPayload.text || '') : String(ingredientTextOrPayload || '');
  const imageBase64 = isMultimodal ? ingredientTextOrPayload.imageBase64 : null;
  const mimeType = isMultimodal && ingredientTextOrPayload.mimeType ? ingredientTextOrPayload.mimeType : 'image/jpeg';

  let clinicalSpecialty = `nuclear medicine clinical endocrinology AI specialist for Radioactive Iodine (RAI) therapy preparation. Patients MUST adhere to a strict Low-Iodine Diet (LID) (<50 mcg iodine/day).`;
  let protocolRules = `
Protocol Ground Rules (Low-Iodine Diet - LID Protocol):
- STRICTLY FORBIDDEN (AVOID):
  * Hidden dairy, whey, milk, cheese, butter, yogurt, casein, cream, milk chocolate
  * Egg yolks, whole eggs, mayonnaise with yolks
  * Sea salt, iodized salt, rock salt, Himalayan pink salt
  * Marine fish, shellfish, crustaceans, fish sauce (patis), oyster sauce
  * Carrageenan (E407), agar-agar (E406), alginate (E401-E404), seaweed, nori, kelp
  * FD&C Red Dye #3 (erythrosine / E127 - 58% elemental iodine)
  * Soybeans, soy sauce (toyo), tofu, edamame, soy protein, soy isoflavones
  * Potatoes (russet/red/chips ~60mcg), watercress, cassava (kamoteng kahoy), millet
  * Cruciferous vegetables (cabbage, broccoli, cauliflower, brussels sprouts)
  * Iodate dough conditioners (potassium iodate, calcium iodate)
  * Prunes, bananas, pineapple, strawberries, cranberries
- STRICTLY SAFE:
  * Pure non-iodized kosher salt (Morton Coarse, Diamond Crystal), pickling salt
  * Pure egg whites, fresh unbrined chicken, beef, pork
  * Sayote, kalabasa (squash), bell peppers, zucchini, eggplant, tomatoes, onions, garlic
  * Plain white/brown rice, rolled oats, unbleached flour, pure cornstarch, pure vegetable oils
- CAUTION:
  * Unspecified "salt" on commercial packages (usually iodized)
  * "Natural flavors", "artificial flavors", or ambiguous "dough conditioners"
  * Commercial plant milks with added sea salt or carrageenan
`;

  if (activeDiet === 'low_purine') {
    clinicalSpecialty = `clinical rheumatology and nutrition AI specialist for hyperuricemia, gout prevention, and low-purine dietary management.`;
    protocolRules = `
Protocol Ground Rules (Low-Purine / Anti-Uric Acid):
- STRICTLY FORBIDDEN (AVOID):
  * Internal organs / organ meats: isaw, atay (liver), bopis, dinuguan, puso, balunbalunan, kidney, bone marrow
  * High-purine seafood: sardines (sardinas), anchovies (dilis), mackerel, tuna in oil, shellfish (tahong, talaba, alimasag, hipon, oyster, crabs)
  * Rich meat gravies, meat extracts, bouillon cubes, bagoong, patis
  * Legumes with elevated purines: mung beans (munggo), lentils in high volume
  * Alcohol, beer, brewer's yeast, nutritional yeast
- STRICTLY SAFE:
  * Chicken breast (lean, moderate portions), lean pork/beef loin
  * Sayote, kalabasa, carrots, cucumber, cabbage, leafy greens
  * Low-fat dairy, egg whites, whole eggs (eggs are very low purine)
  * Rice, oats, corn, fruits (cherries, berries, apples), calamansi juice, high water intake
- CAUTION:
  * Moderately high purine items: pork cuts with fat, beef, chicken thigh, beans/tofu
`;
  } else if (activeDiet === 'low_sodium') {
    clinicalSpecialty = `cardiovascular cardiology and nephrology clinical nutrition AI specialist for hypertension, heart-failure, kidney health, and DASH protocol.`;
    protocolRules = `
Protocol Ground Rules (Low-Sodium / Heart-Care DASH Protocol):
- STRICTLY FORBIDDEN (AVOID):
  * High-sodium condiments: fish sauce (patis), shrimp paste (bagoong), soy sauce (toyo/toyomansi), MSG (vetsin), bouillon cubes (Knorr/Maggi)
  * Preserved/cured meats: spam, corned beef, tocino, longganisa, hotdog, bacon, ham
  * Dried / salted seafood: tuyo, daing, tinapa, salted eggs (itlog na maalat)
  * Instant processed foods: instant noodles (pancit canton, ramen), canned soups, potato chips, chicharon
- STRICTLY SAFE:
  * Fresh unbrined meats (fresh chicken breast, fresh pork/beef cuts without marinade)
  * Fresh vegetables: sayote, kalabasa, pechay, kangkong, tomatoes, onions, garlic, ginger
  * Flavor enhancers: fresh calamansi juice, siling labuyo (chili), black pepper, vinegar, garlic, herbs
  * Plain grains: plain boiled rice, rolled oats, sweet potatoes without added salt
- CAUTION:
  * Commercial breads, canned tomato paste, commercial broths with reduced sodium
`;
  } else if (activeDiet === 'diabetic') {
    clinicalSpecialty = `clinical endocrinology and diabetes education AI specialist for glycemic control and diabetes prevention.`;
    protocolRules = `
Protocol Ground Rules (Diabetic / Low-Glycemic Index Protocol):
- STRICTLY FORBIDDEN (AVOID):
  * Added sugars and high-fructose syrups: white/brown sugar, condensed milk (condensada), sweet evaporated milk, honey, molasses, high-fructose corn syrup
  * Sweet Filipino sauces: banana ketchup, sweet-style spaghetti sauce, Mang Tomas, sweet teriyaki
  * High-sugar beverages: soft drinks, sweetened fruit juices, milk tea, 3-in-1 coffee mixes
  * High-GI refined carbohydrates: white bread, pandesal, pastries, kakanin with heavy sugar
- STRICTLY SAFE:
  * Non-starchy vegetables: sayote, leafy greens (kangkong, pechay), cauliflower, green beans, tomatoes
  * Lean proteins: chicken, fish, eggs, tofu, lean pork
  * Low-GI complex carbs in moderation: brown rice, quinoa, rolled oats, whole grains
  * Natural flavorings: calamansi, garlic, vinegar, black pepper, stevia/monkfruit
- CAUTION:
  * White rice (moderation required), ripe mango, banana, sweetened soy milk
`;
  } else if (activeDiet === 'pinoy_keto') {
    clinicalSpecialty = `ketogenic clinical nutrition AI specialist for low-carbohydrate / high-fat dietary management.`;
    protocolRules = `
Protocol Ground Rules (Pinoy Keto / Low-Carb Protocol):
- STRICTLY FORBIDDEN (AVOID):
  * Starchy staples: white rice (bigas/kanin), brown rice, noodles (bihon, canton, ramen), bread, pandesal, pasta
  * High-carb root vegetables: potatoes, sweet potatoes (kamote), cassava (kamoteng kahoy), gabi
  * Sugars: cane sugar, banana ketchup, sweet sauces, condensed milk, sweet desserts
  * High-carb tropical fruits: mangoes, bananas, pineapple, watermelon
- STRICTLY SAFE:
  * High-protein and healthy fats: pork belly (liempo/lechon kawali without sweet sauce), chicken with skin, beef, eggs
  * Low-carb vegetables: cauliflower (cauliflower rice), sayote, kangkong, pechay, cucumber, eggplant
  * Healthy fats: coconut oil, extra virgin olive oil, real butter, avocado
  * Low-carb seasonings: patis (in moderation), vinegar, calamansi (light), garlic, black pepper, siling labuyo
- CAUTION:
  * Onions, carrots, tomatoes in large amounts, processed sausages with flour fillers
`;
  }

  const prompt = `
You are a ${clinicalSpecialty}
Analyze the following food ingredient text or packaging label against the active protocol.

${protocolRules}

Target Ingredients or Label:
"""${ingredientText}"""

Return clean JSON:
{
  "status": "SAFE" | "AVOID" | "CAUTION",
  "reason": "Brief clinical explanation why based on the active diet protocol",
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
export async function uploadToCloudinary(blob, cloudName, uploadPreset, isReceiptScan = false) {
  const resolvedCloudName = (cloudName?.trim() || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || '').trim();
  const resolvedPreset = (uploadPreset?.trim() || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) || '').trim();

  if (!resolvedCloudName || !resolvedPreset) {
    console.warn('Cloudinary upload skipped: missing cloudName or uploadPreset credentials.');
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('upload_preset', resolvedPreset);

    // Target receipts folder specifically when in receipt mode
    const targetFolder = isReceiptScan ? 'kosherai/receipts' : 'kosherai';
    formData.append('folder', targetFolder);

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
 * High-accuracy on-device fallback via PaddleOCR (PP-OCRv4).
 *
 * Fallback to on-device PaddleOCR triggers ONLY if:
 *  1. The fetch explicitly rejects after the full 30s timeout (err.name === 'AbortError')
 *  2. The device is detected as strictly offline (!navigator.onLine)
 *  3. The API responds with a definitive server error (500/503/400)
 */
export async function scanSupermarketReceipt(dataUrl, onProgress = () => { }, clientApiKey = '', activeDiet = 'lid') {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Resolve API key from arguments, Vite env, or process env
  const resolvedApiKey = (
    clientApiKey ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.GEMINI_API_KEY) ||
    ''
  ).trim();

  // Condition 2: Strict offline check upfront
  if (!isOnline) {
    console.warn('[ReceiptScan] Device strictly offline. Running on-device PaddleOCR fallback...');
    return await executeLocalOcrFallback(dataUrl, onProgress, 'Switching to on-device PaddleOCR engine...', activeDiet);
  }

  console.log(`[ReceiptScan] Initiating supermarket receipt scan for protocol "${activeDiet}". Key present: ${Boolean(resolvedApiKey)}`);

  // Phased Status Feedback During Processing:
  // 0s–3s: "Uploading receipt image..."
  onProgress({
    status: 'uploading',
    progress: 0.15,
    message: 'Uploading receipt image...'
  });

  // 3s–15s: "✨ Gemini Vision is analyzing receipt items..."
  const timer3s = setTimeout(() => {
    onProgress({
      status: 'ai_vision',
      progress: 0.45,
      message: '✨ Gemini Vision is analyzing receipt items...'
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
  let ocrFallbackMessage = 'Switching to on-device PaddleOCR engine...';

  // 1. Primary: Server-Side Gemini Vision endpoint (/api/receipt-scan)
  try {
    console.log('[ReceiptScan] Sending receipt to /api/receipt-scan (Server Gemini Vision)...');
    const res = await fetch('/api/receipt-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: dataUrl,
        mimeType: 'image/jpeg',
        activeDiet: activeDiet || 'lid',
        apiKey: resolvedApiKey
      }),
      signal: controller.signal
    });

    clearScanningTimers();

    if (res.ok) {
      const data = await res.json();
      console.log(`[ReceiptScan] Server Gemini Vision receipt scan succeeded! Detected ${data.items?.length || 0} items.`);
      onProgress({ status: 'populating', progress: 0.95, message: 'Populating receipt items...' });
      return normalizeReceiptData(data, 'SERVER_GEMINI_VISION');
    }

    // Condition 3: API responds with a definitive server error (500/503/400)
    const isDefinitiveServerError = [400, 500, 502, 503].includes(res.status) || res.status >= 400;
    if (isDefinitiveServerError) {
      const errJson = await res.json().catch(() => ({}));
      console.warn(`[ReceiptScan] Server Gemini Vision returned status ${res.status}:`, errJson.message || errJson);
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
  if (shouldTriggerOcrFallback && !controller.signal.aborted && resolvedApiKey && isOnline) {
    try {
      console.log('[ReceiptScan] Attempting direct client-side Gemini Vision fallback with resolved API key...');
      const activeDietProtocol = activeDiet || 'lid';
      const prompt = `
You are an expert clinical nutrition auditor and optical character recognition (OCR) engine specialized in Philippine supermarket and grocery receipts (e.g., SM Supermarket, Puregold, Robinson's, Robinsons Easymart, Mercury Drug, WalterMart, The Landmark).
Analyze this grocery receipt image for dietary compliance under the active protocol: "${activeDietProtocol}".

INSTRUCTIONS:
1. Extract line-item food purchases, ignoring cashier metadata, blank customer form fields, totals, change, timestamps, and store headers.
2. Clean and expand abbreviated Pinoy grocery terms & brands (e.g., "SIL LABUYO" -> "Siling Labuyo", "CKN BRST" -> "Chicken Breast", "MG BRTH CB" -> "Bouillon Cubes", "PTIS REF" -> "Patis / Fish Sauce", "BEAR BRAND / NIDO / ALASKA" -> "Powdered Cow's Milk", "CREAM CORNSTARCH" -> "Cornstarch", "HERSHEYS COCOA IN CA" -> "Cocoa Powder").
3. Handle Philippine receipt formatting nuances:
   - Barcode numbers: Strip 8-14 digit UPC/EAN barcode numbers (e.g., "04800361393515", "00731126011020"). Never output barcode numbers as item names or separate items.
   - Multi-line quantities: When quantity and unit price appear on the next line (e.g., "2 X P310.00/Unit    620.00 V"), combine with the parent item (qty: 2, price: 310.0, total: 620.0).
   - Trailing tax letters: Disregard trailing letters such as "V" (VATable). Normalize amounts to clean numeric floats (e.g., "620.00 V" -> 620.0).
4. Audit each identified item against the active protocol guidelines. Mark as "SAFE", "CAUTION", or "AVOID".
5. For any item marked "AVOID", provide a direct "Pinoy Smart Swap" and a brief clinical reason.

RETURN ONLY VALID JSON (no markdown fences, no explanatory text):
{
  "storeName": "Detected Store Name or Unknown",
  "purchaseDate": "YYYY-MM-DD or null",
  "detectedItemsCount": 0,
  "items": [
    {
      "rawText": "Original line text from receipt",
      "cleanName": "Standardized Ingredient Name",
      "status": "SAFE" | "CAUTION" | "AVOID",
      "clinicalReason": "Brief explanation under protocol",
      "suggestedSwap": "Safe Pinoy alternative or null",
      "qty": 1.0,
      "price": 0.0,
      "total": 0.0
    }
  ],
  "subtotal": 0.0,
  "discounts": 0.0,
  "tax": 0.0,
  "totalAmountPaid": 0.0,
  "paymentMethod": "CASH"
}
`;
      // Cascade: Try gemini-3.8-pro first, fall back to gemini-1.5-flash
      const models = ['gemini-3.8-pro', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
      const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');

      for (const model of models) {
        console.log(`[ReceiptScan] Calling direct client Gemini Vision with model "${model}"...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(resolvedApiKey)}`;
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
            console.log(`[ReceiptScan] Direct client Gemini Vision call succeeded with model "${model}"! Detected ${parsed.items?.length || 0} items.`);
            onProgress({ status: 'populating', progress: 0.95, message: 'Populating receipt items...' });
            return normalizeReceiptData(parsed, 'CLIENT_GEMINI_VISION');
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn(`[ReceiptScan] Direct client Gemini Vision model "${model}" failed (${response.status}):`, errData.error?.message || response.statusText);
        }
      }
    } catch (clientErr) {
      console.warn('[ReceiptScan] Direct client Gemini fallback exception:', clientErr);
    }
  }

  // Graceful Client PaddleOCR (PP-OCRv4) fallback when fallback criteria are met
  if (shouldTriggerOcrFallback) {
    console.warn('[ReceiptScan] Gemini Vision endpoints unavailable or exhausted. Running on-device PaddleOCR fallback...');
    return await executeLocalOcrFallback(dataUrl, onProgress, ocrFallbackMessage, activeDiet);
  }

  throw new Error('Could not scan receipt. Please enter items manually.');
}

export const PINOY_GROCERY_ABBREVIATIONS = {
  'SIL LABUYO': 'Siling Labuyo',
  'CKN BRST': 'Chicken Breast',
  'MG BRTH CB': 'Bouillon Cubes',
  'PTIS REF': 'Patis / Fish Sauce',
  'PTIS': 'Patis / Fish Sauce',
  'BGNG ALMNG': 'Bagoong Alamang',
  'BGNG': 'Bagoong',
  'KNORR CB': 'Bouillon Cubes',
  'KNORR CUBE': 'Bouillon Cubes',
  'MG CUBE': 'Bouillon Cubes',
  'MG BRTH': 'Bouillon Cubes',
  'CHK BRST': 'Chicken Breast',
  'CHKN BRST': 'Chicken Breast',
  'CHICKN BRST': 'Chicken Breast',
  'PRK BELLY': 'Pork Belly (Liempo)',
  'PRK CHOP': 'Pork Chop',
  'BF SIRLOIN': 'Beef Sirloin',
  'SAYOTE FRESH': 'Sayote',
  'SAYOTE': 'Sayote',
  'KALABASA': 'Kalabasa',
  'KLBSA': 'Kalabasa',
  'KAMOTE': 'Sweet Potato (Kamote)',
  'BIGAS': 'White Rice',
  'RICE': 'White Rice',
  'MUNGGO': 'Mung Beans / Munggo',
  'BALATONG': 'Mung Beans / Munggo',
  'TOYO': 'Soy Sauce / Toyo',
  'TOFU': 'Tokwa / Tofu',
  'TKWA': 'Tokwa / Tofu',
  'ITLOG': 'Eggs',
  'ISAW': 'Isaw / Pork Intestines',
  'ATAY': 'Pork / Chicken Liver',
  'BANANA KETCHUP': 'Banana Ketchup',
  'UFC KETCHUP': 'Banana Ketchup',
  'BEAR BRAND': 'Bear Brand Fortified Milk Powder',
  'NIDO': 'Nido Powdered Milk',
  'ALASKA': 'Alaska Milk',
  'BIRCH TREE': 'Birch Tree Powdered Milk',
  'EDEN': 'Eden Cheese',
  'CORNSTARCH': 'Cream Cornstarch',
  'HERSHEY': 'Hershey\'s Cocoa Powder',
  'COCOA': 'Cocoa Powder'
};

export function cleanPinoyGroceryTerm(rawText) {
  if (!rawText || typeof rawText !== 'string') return rawText || '';
  const trimmed = rawText.trim();

  // If the line is purely an 8-16 digit barcode/EAN number or metadata, ignore it
  if (/^\d{8,16}$/.test(trimmed)) return '';

  const upper = trimmed.toUpperCase();

  for (const [abbr, clean] of Object.entries(PINOY_GROCERY_ABBREVIATIONS)) {
    if (upper.includes(abbr)) {
      return clean;
    }
  }
  return trimmed
    .replace(/\b\d{8,16}\b/g, '') // strip 8-16 digit barcode numbers
    .replace(/\b(?:P|₱)?\d+(?:\.\d+)?\b/g, '')
    .replace(/\b\d+(?:g|kg|pcs|pc|ml|l)\b/gi, '')
    .trim();
}

export function auditReceiptItemOffline(rawName, activeDiet = 'lid') {
  const cleanName = cleanPinoyGroceryTerm(rawName);
  const lower = cleanName.toLowerCase();
  let status = 'SAFE';
  let clinicalReason = `Compliant under ${activeDiet.toUpperCase()} guidelines.`;
  let suggestedSwap = null;

  if (activeDiet === 'lid') {
    if (lower.includes('patis') || lower.includes('bagoong') || lower.includes('tuna') || lower.includes('fish') || lower.includes('shrimp') || lower.includes('seafood')) {
      status = 'AVOID';
      clinicalReason = 'Marine seafood and fish sauces contain high iodine levels contraindicated for RAI.';
      suggestedSwap = 'Pure non-iodized kosher salt + fresh calamansi juice';
    } else if (lower.includes('cube') || lower.includes('bouillon') || lower.includes('msg') || lower.includes('knorr') || lower.includes('maggi')) {
      status = 'AVOID';
      clinicalReason = 'Commercial broth cubes contain iodized salt and artificial flavorings.';
      suggestedSwap = 'Homemade chicken broth with pure kosher salt';
    } else if (lower.includes('dairy') || lower.includes('milk') || lower.includes('cheese') || lower.includes('butter') || lower.includes('whey')) {
      status = 'AVOID';
      clinicalReason = 'Commercial dairy contains elevated milk iodine.';
      suggestedSwap = 'Pure vegetable oil or pure coconut cream';
    } else if (lower.includes('toyo') || lower.includes('soy') || lower.includes('tofu')) {
      status = 'AVOID';
      clinicalReason = 'Soy products interfere with thyroid hormone pathways.';
      suggestedSwap = 'Pure kosher salt with fresh garlic & ginger';
    } else {
      clinicalReason = 'Fresh ingredient permitted on strict low-iodine preparation.';
    }
  } else if (activeDiet === 'low_purine') {
    if (lower.includes('isaw') || lower.includes('atay') || lower.includes('liver') || lower.includes('organ') || lower.includes('dinuguan')) {
      status = 'AVOID';
      clinicalReason = 'Internal organs are extremely rich in purines and trigger acute gout flares.';
      suggestedSwap = 'Lean skinless chicken breast';
    } else if (lower.includes('sardines') || lower.includes('anchov') || lower.includes('dilis') || lower.includes('munggo')) {
      status = 'AVOID';
      clinicalReason = 'High-purine legumes and small fish elevate serum uric acid.';
      suggestedSwap = 'Sayote cubes or fresh white meat';
    }
  } else if (activeDiet === 'low_sodium') {
    if (lower.includes('patis') || lower.includes('bagoong') || lower.includes('toyo') || lower.includes('cube') || lower.includes('bouillon')) {
      status = 'AVOID';
      clinicalReason = 'High sodium condiment exceeds DASH daily target (<1,500mg/day).';
      suggestedSwap = 'Fresh calamansi juice + crushed garlic + siling labuyo';
    }
  } else if (activeDiet === 'diabetic') {
    if (lower.includes('banana ketchup') || lower.includes('sugar') || lower.includes('condensed') || lower.includes('syrup')) {
      status = 'AVOID';
      clinicalReason = 'High glycemic load and simple sugars trigger rapid glucose spikes.';
      suggestedSwap = 'Fresh tomato salsa with calamansi';
    }
  } else if (activeDiet === 'pinoy_keto') {
    if (lower.includes('rice') || lower.includes('bigas') || lower.includes('potato') || lower.includes('kamote') || lower.includes('sugar')) {
      status = 'AVOID';
      clinicalReason = 'High net carb content inhibits nutritional ketosis.';
      suggestedSwap = 'Riced cauliflower or shirataki';
    }
  }

  return {
    rawText: rawName,
    cleanName,
    status,
    clinicalReason,
    suggestedSwap
  };
}

/**
 * Executes local on-device PaddleOCR fallback with Pinoy receipt term cleaning & clinical auditing
 */
async function executeLocalOcrFallback(dataUrl, onProgress, statusMessage, activeDiet = 'lid') {
  try {
    onProgress({
      status: 'ocr_fallback',
      progress: 0.65,
      message: statusMessage || 'Switching to on-device PaddleOCR engine...'
    });

    const ocrResult = await runPaddleOCR(dataUrl, (p) => {
      onProgress({
        status: 'ocr_fallback',
        progress: 0.65 + ((p.progress || 0.5) * 0.25),
        message: p.message || statusMessage || 'Switching to on-device PaddleOCR engine...'
      });
    });

    const parsedOffline = parseStructuredReceiptText(ocrResult);
    if (Array.isArray(parsedOffline.items)) {
      parsedOffline.items = parsedOffline.items.map(it => {
        const audited = auditReceiptItemOffline(it.name || it.rawReceiptText || '', activeDiet);
        return {
          ...it,
          cleanName: audited.cleanName,
          status: audited.status,
          dietStatus: audited.status,
          isSafeForDiet: audited.status === 'SAFE',
          clinicalReason: audited.clinicalReason,
          suggestedSwap: audited.suggestedSwap
        };
      });
    }

    onProgress({ status: 'populating', progress: 0.95, message: 'Populating receipt items...' });

    return normalizeReceiptData({
      ...parsedOffline,
      rawText: ocrResult.rawText
    }, 'OFFLINE_PADDLE_OCR');
  } catch (ocrErr) {
    console.error('[ReceiptScan] Local PaddleOCR fallback failed:', ocrErr);
    throw new Error('Could not parse receipt contents. Please ensure the receipt is well-lit and legible.');
  }
}

// Convenient alias for receipt scanning orchestration
export const scanReceipt = scanSupermarketReceipt;

/**
 * High-level receipt audit function for Scanner tab & Course Project
 */
export async function auditGroceryReceipt(imageSource, onProgress = () => { }, clientApiKey = '', activeDiet = 'lid') {
  const resolvedApiKey = (
    clientApiKey ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.GEMINI_API_KEY) ||
    ''
  ).trim();

  console.log(`[auditGroceryReceipt] Starting receipt audit for diet "${activeDiet}". Live Gemini API key configured: ${Boolean(resolvedApiKey)}`);

  let dataUrl = imageSource;
  if (typeof imageSource !== 'string' || !imageSource.startsWith('data:')) {
    dataUrl = await compressImageForOCR(imageSource, 1600, 0.8);
  }

  try {
    const result = await scanSupermarketReceipt(dataUrl, onProgress, resolvedApiKey, activeDiet);
    console.log(`[auditGroceryReceipt] Receipt scan completed using engine "${result.source}". Detected items: ${result.items?.length || 0}`);
    return result;
  } catch (err) {
    console.error('[auditGroceryReceipt] Receipt scan pipeline failed with error:', err.message || err);
    throw err;
  }
}

/**
 * Manually trigger direct on-device PaddleOCR processing flow without calling /api/receipt-scan.
 * Parses raw text into structured Philippine receipt schema with proper amount and item sanitization.
 *
 * @param {string|Blob|File|HTMLCanvasElement} imageSource
 * @param {Function} onProgress
 * @returns {Promise<Object>}
 */
export async function scanReceiptWithPaddleOCR(imageSource, onProgress = () => { }, activeDiet = 'lid') {
  onProgress({
    status: 'paddle_manual',
    progress: 0.15,
    message: '⚡ Running local PaddleOCR on receipt...'
  });

  try {
    const ocrResult = await runPaddleOCR(imageSource, (p) => {
      onProgress({
        status: 'paddle_manual',
        progress: 0.15 + ((p.progress || 0.5) * 0.75),
        message: p.message || '⚡ Running local PaddleOCR on receipt...'
      });
    });

    const parsedOffline = parseStructuredReceiptText(ocrResult);
    if (Array.isArray(parsedOffline.items)) {
      parsedOffline.items = parsedOffline.items.map(it => {
        const audited = auditReceiptItemOffline(it.name || it.rawReceiptText || '', activeDiet);
        return {
          ...it,
          cleanName: audited.cleanName,
          status: audited.status,
          dietStatus: audited.status,
          isSafeForDiet: audited.status === 'SAFE',
          clinicalReason: audited.clinicalReason,
          suggestedSwap: audited.suggestedSwap
        };
      });
    }

    onProgress({ status: 'populating', progress: 0.95, message: 'Populating receipt items...' });

    return normalizeReceiptData({
      ...parsedOffline,
      rawText: ocrResult.rawText
    }, 'OFFLINE_PADDLE_OCR');
  } catch (err) {
    console.error('[ReceiptScan] Direct PaddleOCR invocation failed:', err);
    throw new Error('On-device OCR failed to read receipt. Please ensure the receipt is well-lit and legible.');
  }
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
 * Standardizes extracted receipt data into consistent schema with full number sanitization & diet auditing
 */
export function normalizeReceiptData(data, source = 'GEMINI_VISION') {
  const purchaseDate = data.date || data.purchaseDate || new Date().toISOString().split('T')[0];
  let safeCount = 0;
  let flaggedCount = 0;

  const items = Array.isArray(data.items) ? data.items.map((item, idx) => {
    const qty = sanitizeCurrency(item.qty ?? item.quantity ?? 1) || 1;
    const unitPrice = sanitizeCurrency(item.unitPrice ?? item.price ?? 0);
    const lineTotal = sanitizeCurrency(item.lineTotal ?? item.totalPrice ?? item.total ?? (qty * unitPrice));
    const cleanName = item.cleanName || item.name || item.description || `Grocery Item #${idx + 1}`;
    const name = cleanName;
    const rawText = item.rawText || item.rawReceiptText || name;

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
  }) : [];

  const totalAmountPaid = sanitizeCurrency(data.totalAmountPaid ?? data.total ?? data.subtotal ?? items.reduce((acc, it) => acc + it.totalPrice, 0));

  return {
    storeName: data.storeName || 'SM Supermarket',
    purchaseDate,
    date: purchaseDate,
    tripType: data.tripType || 'Supermarket',
    items,
    detectedItemsCount: data.detectedItemsCount || items.length,
    activeDiet: data.activeDiet || 'lid',
    activeDietName: data.activeDietName || 'LID Protocol (Default)',
    safeItemCount: data.safeItemCount ?? safeCount,
    flaggedItemCount: data.flaggedItemCount ?? flaggedCount,
    complianceSummary: data.complianceSummary || `${safeCount} Safe, ${flaggedCount} Flagged`,
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
 * Heuristic parser for offline raw OCR text with Philippine receipt conventions (backed by PaddleOCR)
 */
export function parseOfflineReceiptText(rawText) {
  return parseStructuredReceiptText(rawText);
}
