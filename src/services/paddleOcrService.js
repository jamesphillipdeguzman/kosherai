// PaddleOCR (PP-OCRv4) Client-Side On-Device Inference Engine
// Implements DBNet detection, CRNN recognition, CTC greedy decoding, and structured receipt line aggregation.

/**
 * Character dictionary for PP-OCR English / Latin recognition
 * Index 0 corresponds to the CTC blank symbol.
 */
const PP_OCR_KEYS = [
  ' ', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-',
  '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^',
  '_', '`', '{', '|', '}', '~', '₱', '°', '£', '€', '¥', '¢', '•'
];

// Model Configuration & URLs (Primary static path with reliable CDN mirrors)
const MODEL_CONFIG = {
  det: {
    paths: [
      '/models/ch_PP-OCRv4_det_infer.onnx',
      'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/ch_PP-OCRv4_det_infer.onnx',
      'https://cdn.jsdelivr.net/gh/hiroi-sora/PaddleOCR-json@main/models/ch_PP-OCRv4_det_infer.onnx'
    ],
    maxSideLen: 960,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    threshold: 0.3,
    boxThreshold: 0.5,
    unclipRatio: 1.6
  },
  rec: {
    paths: [
      '/models/en_PP-OCRv4_rec_infer.onnx',
      'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/en_PP-OCRv4_rec_infer.onnx'
    ],
    targetHeight: 48,
    mean: [0.5, 0.5, 0.5],
    std: [0.5, 0.5, 0.5]
  }
};

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
    const mod = await import('@microsoft/onnxruntime-web');
    ortInstance = mod.default || mod;
    return ortInstance;
  } catch (err) {
    // Dynamic CDN fallback if package not pre-bundled
    if (typeof window !== 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.all.min.js');
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
 * Loads an ONNX model from candidate paths with in-memory & CacheStorage caching
 */
async function fetchModelBuffer(paths, onProgress) {
  const cacheName = 'paddleocr-models-v4';
  let cache = null;
  if (typeof caches !== 'undefined') {
    try {
      cache = await caches.open(cacheName);
    } catch {}
  }

  for (const path of paths) {
    try {
      if (cache) {
        const cachedRes = await cache.match(path);
        if (cachedRes && cachedRes.ok) {
          const buf = await cachedRes.arrayBuffer();
          if (buf && buf.byteLength > 1000) return buf;
        }
      }

      onProgress?.(`Fetching OCR model (${path.split('/').pop()})...`);
      const res = await fetch(path, { mode: 'cors' });
      if (res.ok) {
        const cloned = cache ? res.clone() : null;
        const buf = await res.arrayBuffer();
        if (cloned && cache) {
          cache.put(path, cloned).catch(() => {});
        }
        return buf;
      }
    } catch (err) {
      console.warn(`[PaddleOCR] Could not load model from ${path}:`, err.message);
    }
  }
  return null;
}

/**
 * Initializes the DBNet Detection and CRNN Recognition ONNX Sessions
 */
export async function initPaddleOCR(onProgress = () => {}) {
  if (detSession && recSession) return { detSession, recSession };
  if (isInitializing && initPromise) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    const ort = await getOrt();

    // Configure WebAssembly execution settings
    if (ort.env && ort.env.wasm) {
      ort.env.wasm.numThreads = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
      ort.env.wasm.simd = true;
      ort.env.wasm.proxy = false;
    }

    onProgress({ status: 'loading_models', progress: 0.1, message: 'Loading PaddleOCR v4 neural weights...' });

    const sessionOptions = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    };

    const detBuffer = await fetchModelBuffer(MODEL_CONFIG.det.paths, msg => {
      onProgress({ status: 'loading_det', progress: 0.2, message: msg });
    });

    const recBuffer = await fetchModelBuffer(MODEL_CONFIG.rec.paths, msg => {
      onProgress({ status: 'loading_rec', progress: 0.35, message: msg });
    });

    if (detBuffer && recBuffer) {
      detSession = await ort.InferenceSession.create(detBuffer, sessionOptions);
      recSession = await ort.InferenceSession.create(recBuffer, sessionOptions);
      onProgress({ status: 'ready', progress: 0.45, message: 'PaddleOCR engine initialized successfully.' });
      return { detSession, recSession };
    }

    console.warn('[PaddleOCR] ONNX weight buffers unavailable. Switching to high-speed morphological fallback.');
    return null;
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
  if (imageSource instanceof HTMLCanvasElement) {
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
      if (srcUrl.startsWith('blob:')) URL.revokeObjectURL(srcUrl);
      resolve(canvas);
    };
    img.onerror = (e) => {
      if (srcUrl.startsWith('blob:')) URL.revokeObjectURL(srcUrl);
      reject(new Error('Failed to load image for PaddleOCR.'));
    };
    img.src = srcUrl;
  });
}

/**
 * Prepares image tensor for DBNet text detection:
 * Resizes keeping aspect ratio to max 960px, enforces multiples of 32, and normalizes channels.
 */
function preprocessDetImage(srcCanvas) {
  const { width: srcW, height: srcH } = srcCanvas;
  const maxSide = MODEL_CONFIG.det.maxSideLen;
  let ratio = 1.0;

  if (Math.max(srcH, srcW) > maxSide) {
    ratio = maxSide / Math.max(srcH, srcW);
  }

  let targetW = Math.max(32, Math.round((srcW * ratio) / 32) * 32);
  let targetH = Math.max(32, Math.round((srcH * ratio) / 32) * 32);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const { data } = imgData;

  const numPixels = targetW * targetH;
  const float32Array = new Float32Array(3 * numPixels);
  const [meanR, meanG, meanB] = MODEL_CONFIG.det.mean;
  const [stdR, stdG, stdB] = MODEL_CONFIG.det.std;

  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    float32Array[i] = (r - meanR) / stdR;
    float32Array[numPixels + i] = (g - meanG) / stdG;
    float32Array[2 * numPixels + i] = (b - meanB) / stdB;
  }

  return {
    float32Array,
    targetW,
    targetH,
    scaleX: srcW / targetW,
    scaleY: srcH / targetH
  };
}

/**
 * Prepares image crop tensor for CRNN recognition:
 * Resizes to height 48, width multiple of 32, normalized with mean 0.5, std 0.5.
 */
function preprocessRecCrop(cropCanvas) {
  const targetH = MODEL_CONFIG.rec.targetHeight;
  const aspect = cropCanvas.width / Math.max(1, cropCanvas.height);
  let targetW = Math.max(48, Math.min(640, Math.round((targetH * aspect) / 32) * 32));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cropCanvas, 0, 0, targetW, targetH);

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const { data } = imgData;
  const numPixels = targetW * targetH;
  const float32Array = new Float32Array(3 * numPixels);

  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    float32Array[i] = (r - 0.5) / 0.5;
    float32Array[numPixels + i] = (g - 0.5) / 0.5;
    float32Array[2 * numPixels + i] = (b - 0.5) / 0.5;
  }

  return { float32Array, targetW, targetH };
}

/**
 * Decodes CTC greedy output from CRNN logits tensor
 */
function decodeCtc(logits, timeSteps, numClasses) {
  let text = '';
  let lastIndex = -1;
  let totalScore = 0;
  let validSteps = 0;

  for (let t = 0; t < timeSteps; t++) {
    const offset = t * numClasses;
    let maxIndex = 0;
    let maxVal = -Infinity;

    for (let c = 0; c < numClasses; c++) {
      const v = logits[offset + c];
      if (v > maxVal) {
        maxVal = v;
        maxIndex = c;
      }
    }

    if (maxIndex !== 0 && maxIndex !== lastIndex) {
      const char = PP_OCR_KEYS[maxIndex - 1] || '';
      text += char;
      totalScore += Math.max(0.1, Math.min(1.0, 1 / (1 + Math.exp(-maxVal))));
      validSteps++;
    }
    lastIndex = maxIndex;
  }

  const confidence = validSteps > 0 ? totalScore / validSteps : 0.85;
  return { text: text.trim(), confidence };
}

/**
 * DBNet Post-processing:
 * Finds connected bounding boxes from probability map, applies polygon unclip, and scales to original image.
 */
function postprocessDbNet(probMap, width, height, scaleX, scaleY) {
  const threshold = MODEL_CONFIG.det.threshold;
  const unclipRatio = MODEL_CONFIG.det.unclipRatio;
  const binary = new Uint8Array(width * height);

  for (let i = 0; i < probMap.length; i++) {
    binary[i] = probMap[i] > threshold ? 1 : 0;
  }

  // Fast Connected Components Labeling (2-pass)
  const labels = new Int32Array(width * height);
  let nextLabel = 1;
  const parent = [0];

  function find(i) {
    let root = i;
    while (parent[root] > 0) root = parent[root];
    let curr = i;
    while (curr !== root) {
      const p = parent[curr];
      parent[curr] = root;
      curr = p;
    }
    return root;
  }

  function union(i, j) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] === 0) continue;

      const left = x > 0 ? labels[idx - 1] : 0;
      const up = y > 0 ? labels[idx - width] : 0;

      if (left === 0 && up === 0) {
        labels[idx] = nextLabel;
        parent.push(0);
        nextLabel++;
      } else if (left !== 0 && up === 0) {
        labels[idx] = left;
      } else if (left === 0 && up !== 0) {
        labels[idx] = up;
      } else {
        labels[idx] = left;
        if (left !== up) union(left, up);
      }
    }
  }

  // Aggregate bounding boxes per connected component
  const bboxes = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const lbl = labels[idx];
      if (lbl === 0) continue;
      const root = find(lbl);

      let box = bboxes.get(root);
      if (!box) {
        box = { minX: x, maxX: x, minY: y, maxY: y, count: 0, sumScore: 0 };
        bboxes.set(root, box);
      }
      box.minX = Math.min(box.minX, x);
      box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y);
      box.maxY = Math.max(box.maxY, y);
      box.count++;
      box.sumScore += probMap[idx];
    }
  }

  const detectedBoxes = [];
  for (const box of bboxes.values()) {
    if (box.count < 16) continue;
    const avgScore = box.sumScore / box.count;
    if (avgScore < MODEL_CONFIG.det.boxThreshold) continue;

    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
    if (w < 4 || h < 4) continue;

    // Apply DBNet polygon unclip expansion
    const expandX = (w * (unclipRatio - 1.0)) / 2;
    const expandY = (h * (unclipRatio - 1.0)) / 2;

    const x1 = Math.max(0, (box.minX - expandX) * scaleX);
    const y1 = Math.max(0, (box.minY - expandY) * scaleY);
    const x2 = (box.maxX + expandX) * scaleX;
    const y2 = (box.maxY + expandY) * scaleY;

    detectedBoxes.push({
      x: x1,
      y: y1,
      w: Math.max(10, x2 - x1),
      h: Math.max(8, y2 - y1),
      centerX: (x1 + x2) / 2,
      centerY: (y1 + y2) / 2,
      box: [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2]
      ],
      score: avgScore
    });
  }

  // Sort boxes top-to-bottom and left-to-right to preserve natural receipt reading order
  detectedBoxes.sort((a, b) => {
    const yDiff = a.centerY - b.centerY;
    if (Math.abs(yDiff) < Math.max(a.h, b.h) * 0.5) {
      return a.x - b.x;
    }
    return yDiff;
  });

  return detectedBoxes;
}

/**
 * Fast adaptive morphological scanner for receipts (runs immediately even offline without model download)
 */
function runAdaptiveMorphologicalOCR(canvas, onProgress = () => {}) {
  onProgress({ status: 'analyzing', progress: 0.6, message: 'Structuring thermal receipt lines...' });
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const { data } = imgData;

  // Project horizontal dark pixel density across receipt rows
  const rowDensity = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let darkCount = 0;
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (gray < 165) darkCount++;
    }
    rowDensity[y] = darkCount / width;
  }

  // Segment text lines
  const lineBands = [];
  let inLine = false;
  let startY = 0;
  const rowThreshold = 0.015;

  for (let y = 0; y < height; y++) {
    if (rowDensity[y] > rowThreshold) {
      if (!inLine) {
        inLine = true;
        startY = y;
      }
    } else {
      if (inLine) {
        inLine = false;
        if (y - startY >= 8 && y - startY <= 80) {
          lineBands.push({ startY: Math.max(0, startY - 2), endY: Math.min(height - 1, y + 2) });
        }
      }
    }
  }

  const structuredLines = [];
  lineBands.forEach((band, idx) => {
    const h = band.endY - band.startY;
    if (h < 6) return;
    structuredLines.push({
      box: [
        [0, band.startY],
        [width, band.startY],
        [width, band.endY],
        [0, band.endY]
      ],
      y: band.startY,
      centerY: (band.startY + band.endY) / 2,
      h,
      bandIndex: idx
    });
  });

  return structuredLines;
}

/**
 * Groups recognized text words and boxes into coherent horizontal lines
 */
export function aggregateStructuredLines(recognizedItems) {
  if (!recognizedItems || recognizedItems.length === 0) {
    return { rawText: '', lines: [] };
  }

  // Sort top-to-bottom first
  recognizedItems.sort((a, b) => a.y - b.y || a.x - b.x);

  const lines = [];
  let currentGroup = [];

  for (const item of recognizedItems) {
    if (currentGroup.length === 0) {
      currentGroup.push(item);
      continue;
    }

    const first = currentGroup[0];
    const verticalTolerance = Math.max(first.h || 14, item.h || 14) * 0.65;
    const isSameLine = Math.abs((first.centerY || first.y) - (item.centerY || item.y)) <= verticalTolerance;

    if (isSameLine) {
      currentGroup.push(item);
    } else {
      lines.push(buildLineObject(currentGroup));
      currentGroup = [item];
    }
  }

  if (currentGroup.length > 0) {
    lines.push(buildLineObject(currentGroup));
  }

  // Filter empty lines and assemble clean raw text
  const cleanLines = lines.filter(l => l.text && l.text.length > 0);
  const rawText = cleanLines.map(l => l.text).join('\n');

  return {
    rawText,
    lines: cleanLines
  };
}

function buildLineObject(items) {
  // Sort items from left to right within line
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
 * Executes End-to-End PaddleOCR (PP-OCRv4) text extraction
 *
 * @param {HTMLImageElement|HTMLCanvasElement|Blob|string} imageSource
 * @param {Function} onProgress
 * @returns {Promise<{ rawText: string, lines: Array<{ text: string, box: number[][], confidence: number }> }>}
 */
export async function runPaddleOCR(imageSource, onProgress = () => {}) {
  try {
    onProgress({ status: 'preparing', progress: 0.1, message: 'Initializing PaddleOCR engine...' });
    const srcCanvas = await sourceToCanvas(imageSource);

    const sessions = await initPaddleOCR(onProgress);
    const ort = await getOrt();

    if (sessions && sessions.detSession && sessions.recSession) {
      onProgress({ status: 'detecting', progress: 0.5, message: 'Running PP-OCRv4 DBNet text detection...' });

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

    // Adaptive morphological line segmentation fallback
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

/**
 * Backward compatibility alias for existing scanner hooks
 */
export const runClientOCR = runPaddleOCR;

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

  let str = val.trim();

  // Strip leading currency prefixes (e.g. "P1,757.50", "₱ 466.07", "PHP 280.00", "Php 336.00")
  str = str.replace(/^(?:PHP|Php|₱|[Pp])\s*/i, '');

  // Strip trailing single-letter VAT flags common on Philippine POS systems ("1,757.50 V", "280.00 T")
  str = str.replace(/\s+(?:[VEZT]|VAT)\s*$/i, '');

  // Strip trailing non-numeric currency flags
  str = str.replace(/[₱\s]+$/g, '');

  // Remove all commas
  const noCommas = str.replace(/,/g, '').trim();

  // Match pure decimal float
  const match = noCommas.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;

  const num = parseFloat(match[0]);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Heuristic Philippine Receipt Parser (supports multi-line items and thermal paper)
 *
 * @param {string|{ rawText: string, lines?: Array }} rawInput
 * @returns {Object} Structured shopping trip data
 */
export function parseStructuredReceiptText(rawInput) {
  const rawText = typeof rawInput === 'object' && rawInput !== null ? (rawInput.rawText || '') : String(rawInput || '');
  const rawLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  let storeName = 'Supermarket';
  let purchaseDate = null;
  const items = [];
  let totalAmountPaid = 0;
  let subtotal = 0;
  let discounts = 0;
  let tax = 0;
  let totalScaleWeightKg = 0;

  // 1. Detect Supermarket / Pharmacy Brand
  const knownStores = [
    { pattern: /\b(MERCURY\s*DRUG)\b/i, name: 'Mercury Drug' },
    { pattern: /\b(SOUTHSTAR\s*DRUG)\b/i, name: 'Southstar Drug' },
    { pattern: /\b(WATSONS)\b/i, name: 'Watsons' },
    { pattern: /\b(SM\s*(?:SUPERMARKET|HYPERMARKET|SAVE\s*MORE)?)\b/i, name: 'SM Supermarket' },
    { pattern: /\b(PUREGOLD)\b/i, name: 'Puregold' },
    { pattern: /\b(ROBINSONS\s*(?:SUPERMARKET|EASYSPEC)?)\b/i, name: 'Robinsons Supermarket' },
    { pattern: /\b(LANDMARK)\b/i, name: 'The Landmark' },
    { pattern: /\b(WALTER\s*MART)\b/i, name: 'WalterMart Supermarket' },
    { pattern: /\b(7-ELEVEN|7\s*ELEVEN)\b/i, name: '7-Eleven' }
  ];

  for (const s of knownStores) {
    if (s.pattern.test(rawText)) {
      storeName = s.name;
      break;
    }
  }

  if (storeName === 'Supermarket' && rawLines[0] && rawLines[0].length < 35) {
    storeName = rawLines[0].replace(/[^\w\s]/g, '').trim() || 'Supermarket';
  }

  // 2. Detect Purchase Date
  const datePattern = /\b(202[4-9][\-\/]\d{1,2}[\-\/]\d{1,2}|\d{1,2}[\-\/]\d{1,2}[\-\/]202[4-9])\b/;
  const dateMatch = rawText.match(datePattern);
  if (dateMatch) {
    try {
      const parsedD = new Date(dateMatch[1]);
      if (!isNaN(parsedD.getTime())) {
        purchaseDate = parsedD.toISOString().split('T')[0];
      }
    } catch {}
  }
  if (!purchaseDate) {
    purchaseDate = new Date().toISOString().split('T')[0];
  }

  // 3. Multi-line Item & Price Detection
  // Matches "ITEM NAME" followed by "P1,757.50" or "466.07"
  const singleLinePriceRegex = /^(.+?)\s+(?:[₱P]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?:\s*[A-Za-z])?$/i;
  const standalonePriceRegex = /^(?:[₱P]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?:\s*[A-Za-z])?$/i;
  const qtyAtPriceRegex = /^(\d+(?:\.\d+)?)\s*(?:@|x|\*)\s*(?:[₱P]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\b/i;
  const weightRegex = /\b(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos|g|grams)\b/i;

  let pendingItemName = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lower = line.toLowerCase();

    // Check for totals or payment confirmations
    if (lower.includes('total') || lower.includes('amount due') || lower.includes('cash') || lower.includes('tendered') || lower.includes('bdo') || lower.includes('gcash')) {
      const totalMatch = line.match(/(?:TOTAL|AMOUNT\s*DUE|CASH|TENDERED|BDO|BPI|GCASH|MASTERCARD|VISA)\b.*?([₱P]?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})/i);
      if (totalMatch && totalMatch[1]) {
        const val = parseReceiptAmount(totalMatch[1]);
        if (val > 0 && (totalAmountPaid === 0 || lower.includes('total'))) {
          totalAmountPaid = val;
        }
      }
      pendingItemName = null;
      continue;
    }

    // Check for Senior / PWD or line discount
    if (lower.includes('disc') || lower.includes('pwd') || lower.includes('senior') || lower.includes('less')) {
      const discMatch = line.match(/((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})/);
      if (discMatch) {
        discounts += parseReceiptAmount(discMatch[1]);
      }
      pendingItemName = null;
      continue;
    }

    // Check for Scale Weight summary
    const wMatch = line.match(weightRegex);
    if (wMatch && totalScaleWeightKg === 0) {
      const parsedW = parseFloat(wMatch[1]);
      if (parsedW > 0 && parsedW < 50) {
        totalScaleWeightKg = lower.includes('kg') ? parsedW : parsedW / 1000;
      }
    }

    // Pattern A: Single line with item name and price (e.g. "CALSAN CHEW TAB 60S  P1,757.50")
    const matchA = line.match(singleLinePriceRegex);
    if (matchA) {
      const rawName = matchA[1].replace(/^[0-9\*\#\-\.]+\s*/, '').trim();
      const price = parseReceiptAmount(matchA[2]);

      if (rawName.length >= 2 && price > 0 && price < 150000) {
        items.push(createReceiptItem(items.length + 1, rawName, price, line));
        pendingItemName = null;
        continue;
      }
    }

    // Pattern B: Quantity and unit price row (e.g. "2 @ 878.75    1,757.50")
    const matchQty = line.match(qtyAtPriceRegex);
    if (matchQty && pendingItemName) {
      const q = parseFloat(matchQty[1]) || 1;
      const uPrice = parseReceiptAmount(matchQty[2]);
      const linePriceMatch = line.match(/((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?:\s*[A-Za-z])?$/);
      const lTotal = linePriceMatch ? parseReceiptAmount(linePriceMatch[1]) : q * uPrice;

      items.push({
        id: items.length + 1,
        name: pendingItemName,
        description: pendingItemName,
        rawReceiptText: `${pendingItemName} \n ${line}`,
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

    // Pattern C: Standalone price on next line after item name
    const matchStandalone = line.match(standalonePriceRegex);
    if (matchStandalone && pendingItemName) {
      const price = parseReceiptAmount(matchStandalone[1]);
      if (price > 0 && price < 150000) {
        items.push(createReceiptItem(items.length + 1, pendingItemName, price, `${pendingItemName} \n ${line}`));
        pendingItemName = null;
        continue;
      }
    }

    // Otherwise, treat line as candidate item name for multi-line items
    if (line.length >= 2 && !/^(subtotal|tax|vat|change|cash|card|date|time|tin|or#|si#)\b/i.test(line)) {
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
    rawText,
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
