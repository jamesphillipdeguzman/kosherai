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
export async function runClientOCR(imageSource, onProgress = () => {}) {
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
 * Deep Clinical AI Verification via Gemini API
 */
export async function verifyWithGeminiAI(ingredientText, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Please add your Gemini API Key in Settings to enable online AI deep reasoning.');
  }

  const prompt = `
You are a nuclear medicine clinical endocrinology AI specialist for Radioactive Iodine (RAI) therapy preparation.
Patients MUST adhere to a strict Low-Iodine Diet (LID) (<50 mcg iodine/day).

Protocol Ground Rules:
- STRICTLY FORBIDDEN (AVOID):
  * Any iodized salt, sea salt, rock salt, himalayan pink salt
  * Seaweed, nori, kelp, carrageenan (E407), agar-agar (E406), alginate (E401-E404)
  * All marine fish, shellfish, crustaceans, fish sauce (patis), oyster sauce
  * All dairy (milk, cheese, yogurt, butter, whey, casein, cream, milk chocolate)
  * Whole eggs, egg yolks, mayonnaise with yolks
  * Soybeans, soy sauce (toyo), tofu, edamame, soy protein/isoflavones (NIS inhibitors)
  * Turkey breast (commercial brine)
  * Potatoes (russet/red/chips ~60mcg), watercress, cassava (kamoteng kahoy), millet
  * Cruciferous vegetables (cabbage, broccoli, cauliflower, brussels sprouts)
  * FD&C Red Dye #3 (erythrosine / E127 - 58% elemental iodine)
  * Prunes, bananas, pineapple, strawberries, cranberries
  * Commercially prepared bakery items with iodate conditioners (potassium iodate, calcium iodate)
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
  * "Natural flavors" or "dough conditioners" (may hide iodates or dairy)
  * Commercial plant milks with added sea salt or carrageenan

Analyze the following food ingredient text or packaging label:
"""${ingredientText}"""

Output ONLY a valid JSON object with this exact structure:
{
  "isSafe": boolean,
  "status": "SAFE" | "AVOID" | "CAUTION",
  "reasons": ["string explanation 1", "string explanation 2"],
  "detectedProblemIngredients": ["ingredient name 1", "ingredient name 2"],
  "safeSubstitutions": ["substitute advice if avoid or caution"],
  "clinicalSummary": "Concise medical rationale for the patient"
}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textOutput) {
    throw new Error('No AI response received.');
  }

  try {
    return JSON.parse(textOutput);
  } catch (err) {
    // If wrapped in markdown code blocks
    const cleaned = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

/**
 * Optional Cloudinary Upload for packaging log
 */
export async function uploadToCloudinary(blob, cloudName, uploadPreset) {
  if (!cloudName || !uploadPreset) {
    return null;
  }

  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', uploadPreset);

  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Cloudinary upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.secure_url;
}
