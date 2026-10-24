// Local Storage & State Management for KosherAI (Offline First)

const KEYS = {
  SETTINGS: 'kosherai_settings',
  SCAN_HISTORY: 'kosherai_scan_history',
  RECENT_SEARCHES: 'kosherai_recent_searches',
  CHECKLIST: 'kosherai_checklist'
};

const DEFAULT_SETTINGS = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  cloudinaryCloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
  cloudinaryPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
  prepDate: '',
  targetMaxIodine: 50
};

export function getSettings() {
  let parsed = {};
  try {
    const saved = localStorage.getItem('kosherai_settings');
    if (saved) parsed = JSON.parse(saved);
  } catch (e) {
    console.warn('Error reading settings from localStorage', e);
  }

  return {
    geminiApiKey: parsed.geminiApiKey?.trim() || import.meta.env.VITE_GEMINI_API_KEY || '',
    cloudinaryCloudName: parsed.cloudinaryCloudName?.trim() || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
    cloudinaryPreset: parsed.cloudinaryPreset?.trim() || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
    prepDate: parsed.prepDate || '',
    targetMaxIodine: parsed.targetMaxIodine ?? 50
  };
}

export function saveSettings(newSettings) {
  try {
    const current = getSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

export function getLocalScanHistory() {
  try {
    const raw = localStorage.getItem(KEYS.SCAN_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Saves scan records to localStorage with automatic quota management
 */
function saveLocalHistory(records) {
  try {
    localStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(records));
  } catch (quotaErr) {
    console.warn('Storage quota exceeded, preserving recent images and trimming older ones...', quotaErr);
    const trimmed = records.map((item, idx) => {
      if (idx > 2 && item.imageUrl && item.imageUrl.startsWith('data:')) {
        return { ...item, imageUrl: null };
      }
      return item;
    });
    try {
      localStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(trimmed));
    } catch (e2) {
      const stripped = trimmed.map(item => item.imageUrl?.startsWith('data:') ? { ...item, imageUrl: null } : item);
      localStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(stripped));
    }
  }
}

/**
 * Reads scan history:
 * - Attempts to fetch latest records from GET /api/scans
 * - Caches remote scans back into localStorage so offline mode still displays recent records
 * - If network fails, API returns an error, or device is offline, falls back to localStorage
 */
export async function getScanHistory() {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/scans', {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const remoteScans = await res.json();
        if (Array.isArray(remoteScans)) {
          // Cache remote scans back into localStorage for offline availability
          saveLocalHistory(remoteScans);
          return remoteScans;
        }
      } else {
        console.warn(`[Storage] Remote GET /api/scans returned ${res.status}. Falling back to localStorage.`);
      }
    } catch (e) {
      console.warn('[Storage] Remote GET /api/scans failed or timed out. Falling back to localStorage:', e);
    }
  }

  return getLocalScanHistory();
}

/**
 * Saves a new scan result:
 * - Saves to localStorage immediately as offline backup
 * - Concurrently sends a POST /api/scans request when online
 */
export function saveScanResult(scanRecord) {
  try {
    const history = getLocalScanHistory();
    const flaggedIngredients = scanRecord.flaggedIngredients || (scanRecord.analysis ? [
      ...(scanRecord.aiAnalysis?.problemIngredients || []),
      ...(scanRecord.analysis.detectedForbidden || []).map(f => f.matchedWord || f.name),
      ...(scanRecord.analysis.detectedCaution || []).map(c => c.matchedWord || c.name)
    ] : []);
    const uniqueFlagged = [...new Set(flaggedIngredients.map(t => String(t).trim()))].filter(Boolean);
    const reason = scanRecord.reason || scanRecord.aiAnalysis?.reason || scanRecord.analysis?.reason || (scanRecord.analysis?.reasons && scanRecord.analysis.reasons[0]) || '';
    const imageUrl = scanRecord.imageUrl || scanRecord.cloudinaryUrl || scanRecord.imagePreviewUrl || null;
    const timestamp = scanRecord.createdAt || scanRecord.timestamp || new Date().toISOString();
    const title = scanRecord.title || (scanRecord.rawText ? scanRecord.rawText.slice(0, 45) + '...' : 'Scanned Food Label');

    const record = {
      id: scanRecord.id || ('scan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
      title,
      timestamp,
      createdAt: timestamp,
      status: scanRecord.status || 'SAFE',
      reason,
      flaggedIngredients: uniqueFlagged,
      imageUrl,
      ...scanRecord
    };
    record.title = title;
    record.timestamp = timestamp;
    record.createdAt = timestamp;
    record.reason = reason;
    record.flaggedIngredients = uniqueFlagged;
    record.imageUrl = imageUrl;

    // 1. Save to localStorage as offline backup (keep last 50 scans)
    const updated = [record, ...history.filter(item => item.id !== record.id).slice(0, 49)];
    saveLocalHistory(updated);

    // 2. Concurrently send POST /api/scans when online
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (isOnline) {
      const payload = {
        id: record.id,
        title: record.title,
        status: record.status,
        reason: record.reason,
        flaggedIngredients: record.flaggedIngredients,
        imageUrl: record.imageUrl,
        createdAt: record.createdAt || record.timestamp
      };

      fetch('/api/scans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
        .then(async (res) => {
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            console.warn('[Storage] Remote POST /api/scans failed with status', res.status, errBody);
          } else {
            console.log('[Storage] Successfully synced scan record to Neon PostgreSQL:', record.id);
          }
        })
        .catch((err) => {
          console.warn('[Storage] Remote POST /api/scans network error (saved locally):', err);
        });
    }

    return updated;
  } catch (e) {
    console.error('Failed to save scan result', e);
    return getLocalScanHistory();
  }
}

// Backwards-compatible alias for existing callers
export const addScanToHistory = saveScanResult;

/**
 * Clears scan history locally and remotely
 * If an id is provided, deletes that specific scan; otherwise clears all history
 */
export async function clearScanHistory(id = null) {
  try {
    if (id) {
      const remaining = getLocalScanHistory().filter(item => item.id !== id);
      saveLocalHistory(remaining);
    } else {
      localStorage.removeItem(KEYS.SCAN_HISTORY);
    }
  } catch (e) {
    console.error('Failed to clear local scan history', e);
  }

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    try {
      const url = id ? `/api/scans?id=${encodeURIComponent(id)}` : '/api/scans';
      await fetch(url, { method: 'DELETE' });
      console.log(`[Storage] Remote scan history ${id ? 'record ' + id : 'all'} cleared.`);
    } catch (err) {
      console.warn('[Storage] Remote DELETE /api/scans failed:', err);
    }
  }
}

export function getRecentSearches() {
  try {
    const raw = localStorage.getItem(KEYS.RECENT_SEARCHES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function addRecentSearch(query) {
  if (!query || !query.trim()) return;
  try {
    const clean = query.trim();
    const list = getRecentSearches().filter(q => q.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...list.slice(0, 9)];
    localStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to add recent search', e);
  }
}

export function getChecklistState() {
  try {
    const raw = localStorage.getItem(KEYS.CHECKLIST);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveChecklistState(state) {
  try {
    localStorage.setItem(KEYS.CHECKLIST, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save checklist state', e);
  }
}
