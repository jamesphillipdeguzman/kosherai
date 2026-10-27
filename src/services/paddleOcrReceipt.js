// PaddleOCR Client-Side Inference Engine (PP-OCR with Hugging Face monkt/paddleocr-onnx models)
// Features DBNet text detection, CRNN recognition, CTC greedy decoding, and Cache API storage.

/**
 * Character dictionary for PP-OCR English / Latin recognition
 * Index 0 corresponds to the CTC blank symbol.
 */
let PP_OCR_KEYS = [
  ' ', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-',
  '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^',
  '_', '`', '{', '|', '}', '~', '₱', '°', '£', '€', '¥', '¢', '•'
];

let activeDict = PP_OCR_KEYS;

// Hugging Face monkt/paddleocr-onnx repository structure
const HF_BASE = 'https://huggingface.co/monkt/paddleocr-onnx/resolve/main';

export const OCR_MODELS = {
  // Text Detection (v5 or v3)
  detUrl: `${HF_BASE}/detection/v5/det.onnx`,
  
  // English Text Recognition
  recUrl: `${HF_BASE}/languages/english/rec.onnx`,
  
  // English Character Dictionary
  dictUrl: `${HF_BASE}/languages/english/dict.txt`
};

export const CACHE_NAME = 'kosherai-ocr-weights';

let ortInstance = null;
let detSession = null;
let recSession = null;
let isInitializing = false;
let initPromise = null;

/**
 * Dynamically resolves and initializes the ONNX Runtime Web environment
 */
async function getOrt() {
  if (ortInstance) return ortInstance;
  if (typeof window !== 'undefined' && window.ort) {
    ortInstance = window.ort;
    return ortInstance;
  }

  try {
    const mod = await import('onnxruntime-web');
    ortInstance = mod.default || mod;
    return ortInstance;
  } catch (err) {
    // Dynamic CDN fallback if package not pre-bundled
    if (typeof window !== 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/ort.all.min.js');
      if (window.ort) {
        ortInstance = window.ort;
        return ortInstance;
      }
    }
    throw new Error('ONNX Runtime Web library could not be loaded: ' + err.message);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('Document not available'));
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Loads an ONNX model buffer via fetch with strict HTTP status and response validation.
 * Rejects on HTTP error codes (e.g., 404), empty responses, or HTML routing fallbacks.
 *
 * @param {string} url
 * @returns {Promise<ArrayBuffer>}
 */
export async function loadModelBuffer(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) {
    throw new Error(`Failed to load OCR model from ${url}: ${res.status}`);
  }
  const contentType = res.headers?.get?.('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(`Failed to load OCR model from ${url}: returned HTML instead of binary model`);
  }
  const buffer = await res.arrayBuffer();
  if (!buffer || buffer.byteLength < 5000) {
    throw new Error(`Failed to load OCR model from ${url}: buffer too small or corrupt (${buffer?.byteLength || 0} bytes)`);
  }
  return buffer;
}

/**
 * Browser Cache API storage for downloaded .onnx buffers.
 * Checks caches.open('kosherai-ocr-weights') first to prevent repeated ~15MB downloads.
 * If not cached, fetches from Hugging Face and persists to cache.
 *
 * @param {string} url
 * @param {Function} [onProgress]
 * @param {string} [modelName]
 * @returns {Promise<ArrayBuffer>}
 */
export async function loadModelBufferWithCache(url, onProgress, modelName = 'model') {
  let cache = null;
  if (typeof caches !== 'undefined') {
    try {
      cache = await caches.open(CACHE_NAME);
    } catch (e) {
      console.warn(`[PaddleOCR] Cache API ('${CACHE_NAME}') unavailable:`, e.message);
    }
  }

  // 1. Check if model buffer exists in browser Cache API
  if (cache) {
    try {
      const cachedRes = await cache.match(url);
      if (cachedRes && cachedRes.ok) {
        const cachedBuffer = await cachedRes.arrayBuffer();
        if (cachedBuffer && cachedBuffer.byteLength > 5000) {
          const mbSize = (cachedBuffer.byteLength / (1024 * 1024)).toFixed(1);
          onProgress?.({
            status: 'cached',
            progress: 0.35,
            message: `Loaded ${modelName} from local cache (${mbSize} MB).`
          });
          return cachedBuffer;
        }
      }
    } catch (cacheErr) {
      console.warn(`[PaddleOCR] Cache lookup error for ${url}:`, cacheErr.message);
    }
  }

  // 2. Fetch model buffer from network
  onProgress?.({
    status: 'downloading',
    progress: 0.2,
    message: `Downloading ${modelName} from Hugging Face...`
  });
  const buffer = await loadModelBuffer(url);

  // 3. Put into cache ('kosherai-ocr-weights') for offline and future visits
  if (cache) {
    try {
      const responseToCache = new Response(buffer.slice(0), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(buffer.byteLength)
        }
      });
      await cache.put(url, responseToCache);
      console.info(`[PaddleOCR] Cached ${modelName} (${(buffer.byteLength / (1024 * 1024)).toFixed(1)} MB) in '${CACHE_NAME}'.`);
    } catch (putErr) {
      console.warn(`[PaddleOCR] Failed to write ${url} to cache:`, putErr.message);
    }
  }

  return buffer;
}

/**
 * Loads dynamic character dictionary from monkt/paddleocr-onnx languages/english/dict.txt
 */
export async function loadCharacterDictionary() {
  try {
    let cache = null;
    if (typeof caches !== 'undefined') {
      try { cache = await caches.open(CACHE_NAME); } catch {}
    }

    let dictText = null;
    if (cache) {
      const cached = await cache.match(OCR_MODELS.dictUrl);
      if (cached && cached.ok) {
        dictText = await cached.text();
      }
    }

    if (!dictText) {
      const res = await fetch(OCR_MODELS.dictUrl, { mode: 'cors' });
      if (res.ok) {
        const cloned = cache ? res.clone() : null;
        dictText = await res.text();
        if (cloned && cache) {
          cache.put(OCR_MODELS.dictUrl, cloned).catch(() => {});
        }
      }
    }

    if (dictText) {
      const lines = dictText.split(/\r?\n/).filter(Boolean);
      if (lines.length > 50) {
        // Index 0 represents CTC blank character
        activeDict = [' ', ...lines];
      }
    }
  } catch (err) {
    console.warn('[PaddleOCR] Dynamic dictionary load bypassed, using built-in English dictionary:', err.message);
  }
  return activeDict;
}

/**
 * Initializes the DBNet Detection and CRNN Recognition ONNX Sessions
 */
export async function initPaddleOCR(onProgress = () => {}) {
  if (detSession && recSession) return { detSession, recSession };
  if (isInitializing && initPromise) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      const ort = await getOrt();

      // Configure WebAssembly execution settings
      if (ort.env && ort.env.wasm) {
        ort.env.wasm.numThreads = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
        ort.env.wasm.simd = true;
        ort.env.wasm.proxy = false;
      }

      onProgress({ status: 'loading_models', progress: 0.1, message: 'Checking PaddleOCR neural weights...' });

      const sessionOptions = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      };

      // 1. Text Detection Model (v5 with v3 fallback)
      let detBuffer;
      try {
        detBuffer = await loadModelBufferWithCache(
          OCR_MODELS.detUrl,
          p => onProgress({ status: 'loading_det', progress: 0.25, message: p.message || p }),
          'detection model (det.onnx)'
        );
      } catch (detErr) {
        const v3Url = `${HF_BASE}/detection/v3/det.onnx`;
        console.warn(`[PaddleOCR] Detection v5 failed (${detErr.message}). Trying v3 fallback (${v3Url})...`);
        detBuffer = await loadModelBufferWithCache(
          v3Url,
          p => onProgress({ status: 'loading_det', progress: 0.25, message: p.message || p }),
          'detection model v3 fallback'
        );
      }

      // 2. English Text Recognition Model (rec.onnx)
      const recBuffer = await loadModelBufferWithCache(
        OCR_MODELS.recUrl,
        p => onProgress({ status: 'loading_rec', progress: 0.45, message: p.message || p }),
        'English recognition model (rec.onnx)'
      );

      // Async fetch character dictionary in background
      loadCharacterDictionary().catch(() => {});

      onProgress({ status: 'creating_sessions', progress: 0.50, message: 'Instantiating neural inference sessions...' });
      detSession = await ort.InferenceSession.create(detBuffer, sessionOptions);
      recSession = await ort.InferenceSession.create(recBuffer, sessionOptions);

      onProgress({ status: 'ready', progress: 0.55, message: 'PaddleOCR engine initialized successfully.' });
      return { detSession, recSession };
    } catch (err) {
      detSession = null;
      recSession = null;
      onProgress({
        status: 'error',
        progress: 0,
        message: `PaddleOCR Initialization Failed: ${err.message}`
      });
      throw err;
    }
  })();

  try {
    const res = await initPromise;
    return res;
  } finally {
    isInitializing = false;
  }
}

/**
 * Converts various image source formats to an HTMLCanvasElement
 */
export async function sourceToCanvas(imageSource) {
  if (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement) {
    return imageSource;
  }

  if (typeof HTMLImageElement !== 'undefined' && imageSource instanceof HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = imageSource.naturalWidth || imageSource.width;
    canvas.height = imageSource.naturalHeight || imageSource.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageSource, 0, 0);
    return canvas;
  }

  if (typeof ImageData !== 'undefined' && imageSource instanceof ImageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageSource.width;
    canvas.height = imageSource.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageSource, 0, 0);
    return canvas;
  }

  let srcUrl = '';
  if (typeof Blob !== 'undefined' && imageSource instanceof Blob) {
    srcUrl = URL.createObjectURL(imageSource);
  } else if (typeof imageSource === 'string') {
    srcUrl = imageSource;
  } else {
    throw new Error('Unsupported image source provided to PaddleOCR.');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      if (typeof Blob !== 'undefined' && imageSource instanceof Blob) {
        URL.revokeObjectURL(srcUrl);
      }
      resolve(canvas);
    };
    img.onerror = () => {
      if (typeof Blob !== 'undefined' && imageSource instanceof Blob) {
        URL.revokeObjectURL(srcUrl);
      }
      reject(new Error('Failed to load image for PaddleOCR.'));
    };
    img.src = srcUrl;
  });
}

/**
 * Preprocesses an image canvas for DBNet text detection
 */
function preprocessDetImage(canvas, maxSideLen = 960) {
  const w = canvas.width;
  const h = canvas.height;

  let ratio = 1.0;
  const maxSide = Math.max(w, h);
  if (maxSide > maxSideLen) {
    ratio = maxSideLen / maxSide;
  }

  let targetW = Math.round(w * ratio);
  let targetH = Math.round(h * ratio);

  // Resize dimensions must be multiples of 32 for DBNet
  targetW = Math.max(32, Math.round(targetW / 32) * 32);
  targetH = Math.max(32, Math.round(targetH / 32) * 32);

  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = targetW;
  resizeCanvas.height = targetH;
  const ctx = resizeCanvas.getContext('2d');
  ctx.drawImage(canvas, 0, 0, w, h, 0, 0, targetW, targetH);

  const imgData = ctx.getImageData(0, 0, targetW, targetH).data;
  const float32Array = new Float32Array(3 * targetH * targetW);

  // Normalization parameters for detection
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  const channelSize = targetH * targetW;
  for (let i = 0; i < channelSize; i++) {
    const r = imgData[i * 4] / 255.0;
    const g = imgData[i * 4 + 1] / 255.0;
    const b = imgData[i * 4 + 2] / 255.0;

    float32Array[i] = (r - mean[0]) / std[0];
    float32Array[channelSize + i] = (g - mean[1]) / std[1];
    float32Array[2 * channelSize + i] = (b - mean[2]) / std[2];
  }

  return {
    float32Array,
    targetW,
    targetH,
    scaleX: w / targetW,
    scaleY: h / targetH
  };
}

/**
 * Post-processes DBNet probability map to extract bounding boxes
 */
function postprocessDbNet(predData, width, height, scaleX, scaleY, threshold = 0.3, boxThreshold = 0.5, unclipRatio = 1.6) {
  const binaryMap = new Uint8Array(width * height);
  for (let i = 0; i < predData.length; i++) {
    binaryMap[i] = predData[i] > threshold ? 1 : 0;
  }

  const boxes = [];
  const visited = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryMap[idx] === 1 && visited[idx] === 0) {
        // Connected-component flood fill
        const queue = [x, y];
        visited[idx] = 1;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let scoreSum = 0;
        let pixelCount = 0;

        let head = 0;
        while (head < queue.length) {
          const cx = queue[head++];
          const cy = queue[head++];
          const cIdx = cy * width + cx;

          scoreSum += predData[cIdx];
          pixelCount++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // 4-connected neighbors
          const neighbors = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1]
          ];

          for (let n = 0; n < neighbors.length; n++) {
            const nx = neighbors[n][0];
            const ny = neighbors[n][1];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (binaryMap[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue.push(nx, ny);
              }
            }
          }
        }

        const avgScore = pixelCount > 0 ? scoreSum / pixelCount : 0;
        const boxW = maxX - minX + 1;
        const boxH = maxY - minY + 1;

        if (avgScore >= boxThreshold && boxW >= 6 && boxH >= 6) {
          // Unclip bounding box
          const expandW = (boxW * (unclipRatio - 1.0)) / 2;
          const expandH = (boxH * (unclipRatio - 1.0)) / 2;

          const realMinX = Math.max(0, (minX - expandW) * scaleX);
          const realMaxX = (maxX + expandW) * scaleX;
          const realMinY = Math.max(0, (minY - expandH) * scaleY);
          const realMaxY = (maxY + expandH) * scaleY;

          boxes.push({
            x: realMinX,
            y: realMinY,
            w: realMaxX - realMinX,
            h: realMaxY - realMinY,
            score: avgScore,
            centerY: realMinY + (realMaxY - realMinY) / 2
          });
        }
      }
    }
  }

  // Sort boxes top-to-bottom
  boxes.sort((a, b) => a.centerY - b.centerY);
  return boxes;
}

/**
 * Preprocesses a cropped text line canvas for CRNN recognition
 */
function preprocessRecCrop(cropCanvas, targetHeight = 48) {
  const w = cropCanvas.width;
  const h = cropCanvas.height;

  const ratio = targetHeight / Math.max(1, h);
  let targetW = Math.max(32, Math.round(w * ratio));
  targetW = Math.min(1024, Math.max(32, Math.round(targetW / 8) * 8));

  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = targetW;
  resizeCanvas.height = targetHeight;
  const ctx = resizeCanvas.getContext('2d');
  ctx.drawImage(cropCanvas, 0, 0, w, h, 0, 0, targetW, targetHeight);

  const imgData = ctx.getImageData(0, 0, targetW, targetHeight).data;
  const float32Array = new Float32Array(3 * targetHeight * targetW);

  const channelSize = targetHeight * targetW;
  for (let i = 0; i < channelSize; i++) {
    const r = imgData[i * 4] / 255.0;
    const g = imgData[i * 4 + 1] / 255.0;
    const b = imgData[i * 4 + 2] / 255.0;

    float32Array[i] = (r - 0.5) / 0.5;
    float32Array[channelSize + i] = (g - 0.5) / 0.5;
    float32Array[2 * channelSize + i] = (b - 0.5) / 0.5;
  }

  return {
    float32Array,
    targetW,
    targetH: targetHeight
  };
}

/**
 * Greedy CTC Best-Path Decoder
 */
function decodeCtc(data, timeSteps, numClasses) {
  let text = '';
  let lastClass = 0;
  let totalProb = 0;
  let count = 0;

  for (let t = 0; t < timeSteps; t++) {
    let maxProb = -Infinity;
    let maxIdx = 0;
    const offset = t * numClasses;

    for (let c = 0; c < numClasses; c++) {
      const prob = data[offset + c];
      if (prob > maxProb) {
        maxProb = prob;
        maxIdx = c;
      }
    }

    if (maxIdx > 0 && maxIdx !== lastClass && maxIdx < activeDict.length) {
      text += activeDict[maxIdx];
      totalProb += Math.exp(maxProb) || 0.8;
      count++;
    }
    lastClass = maxIdx;
  }

  return {
    text: text.trim(),
    confidence: count > 0 ? Math.min(1.0, totalProb / count) : 0
  };
}

/**
 * Aggregates horizontally aligned text tokens into structured receipt lines
 */
export function aggregateStructuredLines(items, yTolerance = 14) {
  if (!items || items.length === 0) {
    return { rawText: '', lines: [] };
  }

  // Sort tokens by Y coordinate first
  const sorted = [...items].sort((a, b) => a.centerY - b.centerY);

  const lines = [];
  let currentGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const groupAvgY = currentGroup.reduce((s, it) => s + it.centerY, 0) / currentGroup.length;

    if (Math.abs(item.centerY - groupAvgY) <= yTolerance) {
      currentGroup.push(item);
    } else {
      lines.push(buildLineObject(currentGroup));
      currentGroup = [item];
    }
  }

  if (currentGroup.length > 0) {
    lines.push(buildLineObject(currentGroup));
  }

  const cleanLines = lines.filter(l => l.text && l.text.length > 0);
  const rawText = cleanLines.map(l => l.text).join('\n');

  return {
    rawText,
    lines: cleanLines
  };
}

function buildLineObject(items) {
  items.sort((a, b) => a.x - b.x);

  const text = items.map(i => i.text.trim()).filter(Boolean).join('  ');
  const minX = Math.min(...items.map(i => i.x));
  const maxX = Math.max(...items.map(i => i.x + (i.w || 20)));
  const minY = Math.min(...items.map(i => i.y));
  const maxY = Math.max(...items.map(i => i.y + (i.h || 14)));

  const totalConf = items.reduce((sum, i) => sum + (i.confidence || 0.85), 0);
  const confidence = Math.round((totalConf / items.length) * 100) / 100;

  return {
    text,
    confidence,
    box: [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY]
    ]
  };
}

/**
 * Executes End-to-End PaddleOCR (PP-OCRv4/v5) text extraction
 *
 * @param {HTMLImageElement|HTMLCanvasElement|Blob|string} imageSource
 * @param {Function} [onProgress]
 * @param {Object} [options]
 * @param {boolean} [options.allowMorphologicalFallback=false]
 * @returns {Promise<{ rawText: string, lines: Array<{ text: string, box: number[][], confidence: number }> }>}
 */
export async function runPaddleOCR(imageSource, onProgress = () => {}, options = {}) {
  try {
    onProgress({ status: 'preparing', progress: 0.1, message: 'Initializing PaddleOCR engine...' });
    const srcCanvas = await sourceToCanvas(imageSource);

    let sessions = null;
    try {
      sessions = await initPaddleOCR(onProgress);
    } catch (modelErr) {
      console.error('[PaddleOCR] Model weights failed to load:', modelErr);
      onProgress({
        status: 'error',
        progress: 0,
        message: `OCR neural models unavailable (${modelErr.message}).`
      });

      if (options && options.allowMorphologicalFallback) {
        console.warn('[PaddleOCR] allowMorphologicalFallback is set; falling back to morphological segmentation.');
      } else {
        throw new Error(
          `Unable to run OCR: Failed to download or initialize neural models (${modelErr.message}). Please check your internet connection.`
        );
      }
    }

    const ort = await getOrt();

    if (sessions && sessions.detSession && sessions.recSession) {
      onProgress({ status: 'detecting', progress: 0.55, message: 'Running text detection...' });

      // 1. Text Detection (DBNet)
      const detPre = preprocessDetImage(srcCanvas);
      const detInputTensor = new ort.Tensor('float32', detPre.float32Array, [1, 3, detPre.targetH, detPre.targetW]);
      const detFeeds = { [sessions.detSession.inputNames[0]]: detInputTensor };
      const detResults = await sessions.detSession.run(detFeeds);
      const detOutput = detResults[sessions.detSession.outputNames[0]];

      const boxes = postprocessDbNet(
        detOutput.data,
        detPre.targetW,
        detPre.targetH,
        detPre.scaleX,
        detPre.scaleY
      );

      // 2. Text Recognition (CRNN)
      onProgress({ status: 'recognizing', progress: 0.7, message: `Recognizing ${boxes.length} text blocks...` });

      const recognizedItems = [];
      const cropCanvas = document.createElement('canvas');
      const cropCtx = cropCanvas.getContext('2d');

      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        const bw = Math.max(4, Math.round(b.w));
        const bh = Math.max(4, Math.round(b.h));

        cropCanvas.width = bw;
        cropCanvas.height = bh;
        cropCtx.clearRect(0, 0, bw, bh);
        cropCtx.drawImage(srcCanvas, b.x, b.y, bw, bh, 0, 0, bw, bh);

        const recPre = preprocessRecCrop(cropCanvas);
        const recInputTensor = new ort.Tensor('float32', recPre.float32Array, [1, 3, recPre.targetH, recPre.targetW]);
        const recFeeds = { [sessions.recSession.inputNames[0]]: recInputTensor };
        const recResults = await sessions.recSession.run(recFeeds);
        const recOutput = recResults[sessions.recSession.outputNames[0]];

        // CTC greedy decode
        const dims = recOutput.dims;
        const timeSteps = dims[1];
        const numClasses = dims[2];
        const { text, confidence } = decodeCtc(recOutput.data, timeSteps, numClasses);

        if (text && text.length > 0) {
          recognizedItems.push({
            text,
            confidence,
            x: b.x,
            y: b.y,
            w: b.w,
            h: b.h,
            centerY: b.centerY
          });
        }
      }

      // 3. Structured Line Aggregation
      const aggregated = aggregateStructuredLines(recognizedItems);
      onProgress({ status: 'done', progress: 1.0, message: 'PaddleOCR extraction complete.' });
      return aggregated;
    }

    if (!options?.allowMorphologicalFallback) {
      const failMsg = 'PaddleOCR neural inference sessions could not be created from candidate models.';
      onProgress({ status: 'error', progress: 0, message: failMsg });
      throw new Error(failMsg);
    }

    // Adaptive morphological line segmentation fallback
    onProgress({ status: 'morphological_fallback', progress: 0.8, message: 'Running morphological line segmentation...' });
    const bands = runAdaptiveMorphologicalOCR(srcCanvas, onProgress);
    const lines = bands.map((band, idx) => ({
      text: `Line ${idx + 1}`,
      box: band.box,
      confidence: 0.80
    }));

    onProgress({ status: 'done', progress: 1.0, message: 'Thermal receipt segmentation ready.' });
    return {
      rawText: lines.map(l => l.text).join('\n'),
      lines
    };
  } catch (err) {
    console.error('[PaddleOCR] Inference pipeline failure:', err);
    throw err;
  }
}

export const runClientOCR = runPaddleOCR;

/**
 * Adaptive Morphological OCR Segmentation (Opt-in Fallback)
 */
function runAdaptiveMorphologicalOCR(canvas, onProgress = () => {}) {
  onProgress({ status: 'segmenting', progress: 0.6, message: 'Detecting text bands from contrast gradient...' });
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h).data;

  const rowEnergy = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let diffSum = 0;
    const rowOffset = y * w * 4;
    for (let x = 1; x < w; x++) {
      const idx = rowOffset + x * 4;
      const prevIdx = idx - 4;
      const l1 = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      const l2 = 0.299 * imgData[prevIdx] + 0.587 * imgData[prevIdx + 1] + 0.114 * imgData[prevIdx + 2];
      diffSum += Math.abs(l1 - l2);
    }
    rowEnergy[y] = diffSum / w;
  }

  let totalEnergy = 0;
  for (let y = 0; y < h; y++) totalEnergy += rowEnergy[y];
  const avgEnergy = (totalEnergy / h) * 0.85;

  const bands = [];
  let inBand = false;
  let startY = 0;
  for (let y = 0; y < h; y++) {
    if (rowEnergy[y] > avgEnergy) {
      if (!inBand) { inBand = true; startY = y; }
    } else {
      if (inBand) {
        inBand = false;
        const bandH = y - startY;
        if (bandH >= 8 && bandH <= 80) {
          bands.push({
            box: [[0, startY], [w, startY], [w, y], [0, y]],
            centerY: startY + bandH / 2
          });
        }
      }
    }
  }

  return bands;
}

/**
 * High-precision Philippine currency amount parser.
 * Accurately cleans 'P', '₱', 'PHP', commas, and trailing VAT codes (V, E, Z, T, VAT).
 * Never confuses product letter 'P' with prices.
 *
 * @param {string|number} val
 * @returns {number} Float numeric value in PHP, or 0
 */
export function parseReceiptAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  if (typeof val !== 'string') return 0;

  let s = val.trim();

  // Strip trailing VAT classification indicators
  s = s.replace(/\s+[VEZT]$/i, '');
  s = s.replace(/\s+VAT$/i, '');

  // Strip standard currency prefixes
  s = s.replace(/^(?:PHP|Php|php|₱|[P|p])\s*/i, '');

  // Remove commas
  s = s.replace(/,/g, '');

  // Extract valid decimal or integer number
  const match = s.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;

  const num = parseFloat(match[0]);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Cleans OCR artifacts from Philippine supermarket terms
 */
export function cleanPinoyReceiptTerm(text) {
  if (!text) return '';
  let cleaned = text;

  // Common OCR misreads on thermal receipts
  cleaned = cleaned.replace(/CEEL1N/gi, 'CEELIN');
  cleaned = cleaned.replace(/B1OFLU/gi, 'BIOFLU');
  cleaned = cleaned.replace(/CAL5AN/gi, 'CALSAN');
  cleaned = cleaned.replace(/N1DO/gi, 'NIDO');
  cleaned = cleaned.replace(/CH1CKEN/gi, 'CHICKEN');
  cleaned = cleaned.replace(/BREA5T/gi, 'BREAST');
  cleaned = cleaned.replace(/MERCUR[YV]\s*DRU[GC]/gi, 'MERCURY DRUG');
  cleaned = cleaned.replace(/SM\s*SUPERMARK[ET]+/gi, 'SM SUPERMARKET');

  return cleaned.trim();
}

/**
 * Parses raw receipt OCR text into structured metadata and line items
 */
export function parseStructuredReceiptText(rawText) {
  if (!rawText) {
    return {
      storeName: 'Supermarket',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [],
      totalAmountPaid: 0,
      subtotal: 0,
      discounts: 0,
      tax: 0,
      totalScaleWeightKg: 0,
      rawText: ''
    };
  }

  const rawLines = typeof rawText === 'string'
    ? rawText.split('\n')
    : (Array.isArray(rawText.lines) ? rawText.lines.map(l => l.text) : []);

  const lines = rawLines
    .map(l => cleanPinoyReceiptTerm(l.trim()))
    .filter(Boolean);

  let storeName = 'Supermarket';
  let purchaseDate = new Date().toISOString().split('T')[0];
  let totalAmountPaid = 0;
  let subtotal = 0;
  let discounts = 0;
  let tax = 0;
  let totalScaleWeightKg = 0;
  const items = [];

  // 1. Detect Store Name
  const topLines = lines.slice(0, 6).join(' ').toLowerCase();
  if (topLines.includes('mercury drug')) {
    storeName = 'Mercury Drug';
  } else if (topLines.includes('sm supermarket') || topLines.includes('sm hypermarket') || topLines.includes('savemore')) {
    storeName = 'SM Supermarket';
  } else if (topLines.includes('puregold')) {
    storeName = 'Puregold';
  } else if (topLines.includes('robinsons')) {
    storeName = 'Robinsons Supermarket';
  } else if (topLines.includes('waltermart')) {
    storeName = 'WalterMart';
  } else if (lines.length > 0) {
    storeName = lines[0].replace(/[0-9\*\#\-\_]+/g, '').trim() || 'Supermarket';
  }

  // 2. Detect Date
  const dateRegex = /(?:DATE|TRANSACTION\s*DATE)?\s*[:\s]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i;
  for (const line of lines.slice(0, 10)) {
    const dMatch = line.match(dateRegex);
    if (dMatch) {
      const rawDate = dMatch[1];
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        purchaseDate = parsed.toISOString().split('T')[0];
        break;
      }
    }
  }

  // 3. Scan line items and totals
  let pendingItemName = null;
  const totalDueRegex = /(?:TOTAL\s*AMOUNT\s*DUE|TOTAL\s*DUE|AMOUNT\s*DUE|GRAND\s*TOTAL|NET\s*AMOUNT|TOTAL)[\s:]+(?:[₱P]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})/i;
  const subtotalRegex = /(?:SUBTOTAL|SUB-TOTAL|GROSS\s*AMOUNT)[\s:]+(?:[₱P]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})/i;
  const discountRegex = /(?:DISCOUNT|SC\s*DISCOUNT|PWD\s*DISCOUNT|SENIOR)[\s:]+(?:[₱P]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})/i;
  const weightRegex = /(\d+(?:\.\d+)?)\s*(?:kg|kgs|g|grams)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check for Total Due
    const totalMatch = line.match(totalDueRegex);
    if (totalMatch) {
      totalAmountPaid = parseReceiptAmount(totalMatch[1]);
      pendingItemName = null;
      continue;
    }

    // Check for Subtotal
    const subMatch = line.match(subtotalRegex);
    if (subMatch) {
      subtotal = parseReceiptAmount(subMatch[1]);
      pendingItemName = null;
      continue;
    }

    // Check for Discount
    const discMatch = line.match(discountRegex);
    if (discMatch) {
      discounts += parseReceiptAmount(discMatch[1]);
      pendingItemName = null;
      continue;
    }

    // Check for Scale Weight
    const wMatch = line.match(weightRegex);
    if (wMatch && totalScaleWeightKg === 0) {
      const parsedW = parseFloat(wMatch[1]);
      if (parsedW > 0 && parsedW < 50) {
        totalScaleWeightKg = lower.includes('kg') ? parsedW : parsedW / 1000;
      }
    }

    // Multi-line pattern: Quantity and unit price row (e.g. "2 PC @ 878.75    P1,757.50")
    const matchQty = line.match(/^(\d+(?:\.\d+)?)\s*(?:[A-Za-z]+)?\s*(?:@|x|\*)\s*(?:[₱P]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\s*(?:[₱P]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})?/i);
    if (matchQty) {
      const q = parseFloat(matchQty[1]) || 1;
      const uPrice = parseReceiptAmount(matchQty[2]);
      const lTotal = matchQty[3] ? parseReceiptAmount(matchQty[3]) : (q * uPrice);
      const name = pendingItemName || 'Grocery Item';

      items.push({
        id: items.length + 1,
        name,
        description: name,
        rawReceiptText: pendingItemName ? `${pendingItemName} \n ${line}` : line,
        qty: q,
        quantity: q,
        unit: 'pcs',
        price: uPrice,
        unitPrice: uPrice,
        total: lTotal,
        totalPrice: lTotal,
        lineTotal: lTotal,
        weightGrams: null,
        discount: 0
      });

      pendingItemName = null;
      continue;
    }

    // Single-line pattern: Item description followed by amount (e.g. "CHICKEN BREAST FRESH   P466.07")
    const matchItemLine = line.match(/^([A-Za-z0-9\s\.\-\/\&\(\)\'\#]+?)\s+(?:[₱P]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\s*(?:[VEZT]|VAT)?$/i);
    if (matchItemLine) {
      const candidateName = matchItemLine[1].trim();
      const amount = parseReceiptAmount(matchItemLine[2]);

      // Guard against footer summaries
      const skipKeywords = ['cash', 'tendered', 'change', 'subtotal', 'balance', 'mastercard', 'visa', 'card', 'vat', 'tax', 'total'];
      const isSkip = skipKeywords.some(k => candidateName.toLowerCase().startsWith(k));

      if (!isSkip && amount > 0 && candidateName.length >= 3) {
        items.push(createReceiptItem(items.length + 1, candidateName, amount, line));
        pendingItemName = null;
        continue;
      }
    }

    // Ignore known transaction summary labels
    if (
      lower.includes('cash tendered') ||
      lower.includes('change due') ||
      lower.includes('change:') ||
      lower.includes('tendered') ||
      lower.includes('approval') ||
      lower.includes('invoice') ||
      lower.includes('tin:') ||
      lower.includes('pos:') ||
      lower.includes('terminal') ||
      lower.includes('or no:')
    ) {
      pendingItemName = null;
      continue;
    }

    // Save as pending item header for next line's price/quantity row
    if (line.length >= 3 && !/^\d+$/.test(line) && !line.includes(':')) {
      pendingItemName = line;
    }
  }

  // Calculate totals if missing
  const calculatedSum = items.reduce((sum, it) => sum + it.totalPrice, 0);
  if (totalAmountPaid === 0) {
    totalAmountPaid = Math.round(calculatedSum * 100) / 100;
  }
  subtotal = Math.round(calculatedSum * 100) / 100;

  return {
    storeName,
    purchaseDate,
    date: purchaseDate,
    tripType: storeName.includes('Drug') ? 'Specialty Grocery' : 'Supermarket',
    items,
    totalAmountPaid,
    subtotal,
    discounts,
    discountTotal: discounts,
    tax,
    totalScaleWeightKg,
    rawText: typeof rawText === 'string' ? rawText : lines.join('\n'),
    source: 'OFFLINE_PADDLE_OCR',
    uncertainFields: items.length === 0 ? ['items'] : []
  };
}

function createReceiptItem(id, name, price, rawReceiptText) {
  return {
    id,
    name: name.replace(/^[0-9\*\#\-\.]+\s*/, '').trim(),
    description: name.trim(),
    rawReceiptText,
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
  };
}

export default {
  HF_BASE,
  OCR_MODELS,
  CACHE_NAME,
  loadModelBuffer,
  loadModelBufferWithCache,
  loadCharacterDictionary,
  initPaddleOCR,
  runPaddleOCR,
  runClientOCR,
  sourceToCanvas,
  parseReceiptAmount,
  parseStructuredReceiptText,
  aggregateStructuredLines,
  cleanPinoyReceiptTerm
};
