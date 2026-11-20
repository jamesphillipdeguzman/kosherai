// Local Storage & State Management for KosherAI (Offline First)
import { getAuthHeaders } from './authHeaders.js';

const KEYS = {
  SETTINGS: 'kosherai_settings',
  SCAN_HISTORY: 'kosherai_scan_history',
  RECENT_SEARCHES: 'kosherai_recent_searches',
  CHECKLIST: 'kosherai_checklist',
  SCANNER_ENABLED: 'kosherai_scanner_enabled'
};

/**
 * Checks whether the food scanner is enabled.
 * Defaults to false if never configured in localStorage.
 */
export function isScannerEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    const val = localStorage.getItem('kosherai_scanner_enabled');
    if (val === null) return false;
    return val === 'true';
  } catch (_) {
    return false;
  }
}

/**
 * Persists the user's scanner preference and dispatches synchronization events.
 */
export function setScannerEnabled(enabled) {
  const bool = Boolean(enabled);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('kosherai_scanner_enabled', String(bool));
      window.dispatchEvent(new CustomEvent('kosherai_storage_updated', {
        detail: { key: 'kosherai_scanner_enabled', value: bool }
      }));
      window.dispatchEvent(new CustomEvent('kosherai:scanner-preference-changed', {
        detail: { enabled: bool }
      }));
    } catch (_) {}
  }
  return bool;
}

const DEFAULT_SETTINGS = {
  geminiApiKey: import.meta.env?.VITE_GEMINI_API_KEY || '',
  cloudinaryCloudName: import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME || '',
  cloudinaryPreset: import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET || '',
  prepDate: '',
  targetMaxIodine: 50,
  household_members: 4,
  enableOcrScan: false // Default: OFF for fast offline photo capture
};

export function isOcrScanEnabled() {
  if (typeof localStorage === 'undefined') return false;
  try {
    const direct = localStorage.getItem('kosherai_enable_ocr_scan');
    if (direct !== null) return direct === 'true' || direct === '1';
    const saved = localStorage.getItem('kosherai_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.enableOcrScan !== undefined) return Boolean(parsed.enableOcrScan);
      if (parsed.enable_ocr_scan !== undefined) return Boolean(parsed.enable_ocr_scan);
    }
  } catch (_) {}
  return false; // Default: OFF
}

export function setOcrScanEnabled(enabled) {
  const bool = Boolean(enabled);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('kosherai_enable_ocr_scan', String(bool));
      const current = getSettings();
      current.enableOcrScan = bool;
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(current));
    } catch (_) {}
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('kosherai:ocr-settings-changed', { detail: { enableOcrScan: bool } }));
    } catch (_) {}
  }
  return bool;
}

export function getHouseholdMembers() {
  if (typeof window === 'undefined') return 4;
  try {
    const direct = localStorage.getItem('kosherai_household_members');
    if (direct !== null && direct !== '') {
      const val = parseInt(direct, 10);
      if (!isNaN(val) && val >= 1 && val <= 20) return val;
    }
    const saved = localStorage.getItem('kosherai_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      const val = parseInt(parsed.household_members || parsed.householdMembers, 10);
      if (!isNaN(val) && val >= 1 && val <= 20) return val;
    }
  } catch (_) {}
  return 4;
}

export function setHouseholdMembers(count) {
  const num = Number(count);
  const valid = Number.isFinite(num) ? num : 4;
  const clamped = Math.max(1, Math.min(20, Math.round(valid)));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('kosherai_household_members', String(clamped));
      const current = getSettings();
      current.household_members = clamped;
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent('kosherai:household-changed', { detail: { household_members: clamped } }));

      if (typeof fetch === 'function' && typeof navigator !== 'undefined' && navigator.onLine) {
        fetch('/api/settings', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ household_members: clamped })
        }).catch(() => {});
      }
    } catch (_) {}
  }
  return clamped;
}

export function getShowProjectTabPreference() {
  if (typeof localStorage === 'undefined') return true;
  try {
    const saved = localStorage.getItem('kosherai_show_project_tab');
    return saved !== null ? saved === 'true' : true;
  } catch (_) {
    return true;
  }
}

export function getSettings() {
  let parsed = {};
  try {
    const saved = localStorage.getItem('kosherai_settings');
    if (saved) parsed = JSON.parse(saved);
  } catch (e) {
    console.warn('Error reading settings from localStorage', e);
  }

  return {
    geminiApiKey: parsed.geminiApiKey?.trim() || import.meta.env?.VITE_GEMINI_API_KEY || '',
    cloudinaryCloudName: parsed.cloudinaryCloudName?.trim() || import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME || '',
    cloudinaryPreset: parsed.cloudinaryPreset?.trim() || import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET || '',
    prepDate: parsed.prepDate || '',
    targetMaxIodine: parsed.targetMaxIodine ?? 50,
    household_members: getHouseholdMembers(),
    scannerEnabled: isScannerEnabled(),
    enableOcrScan: isOcrScanEnabled()
  };
}

export function saveSettings(newSettings) {
  try {
    const current = getSettings();
    const updated = { ...current, ...newSettings };
    if (newSettings.household_members !== undefined || newSettings.householdMembers !== undefined) {
      const hVal = Math.max(1, Math.min(20, Math.round(Number(newSettings.household_members ?? newSettings.householdMembers ?? 4))));
      updated.household_members = hVal;
      try {
        localStorage.setItem('kosherai_household_members', String(hVal));
      } catch (_) {}
    }
    if (newSettings.enableOcrScan !== undefined || newSettings.enable_ocr_scan !== undefined) {
      const bool = Boolean(newSettings.enableOcrScan ?? newSettings.enable_ocr_scan);
      updated.enableOcrScan = bool;
      try {
        localStorage.setItem('kosherai_enable_ocr_scan', String(bool));
      } catch (_) {}
    }
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));

    if (typeof fetch === 'function' && typeof navigator !== 'undefined' && navigator.onLine) {
      fetch('/api/settings', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ settings: updated })
      }).catch(() => {});
    }

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
export function saveLocalHistory(records) {
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

const inFlightScanSyncs = new Set();

/**
 * Generates a single deterministic UUID (with fallback) for a new scan submission.
 */
export function generateScanId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `scan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Merges two representations of the same scan ID into the most complete record.
 */
function mergeSameIdScan(primary, secondary) {
  if (!primary) return secondary;
  if (!secondary) return primary;
  const pickRemoteHttpUrl = (a, b) => {
    const aHttp = typeof a === 'string' && /^https?:\/\//i.test(a) ? a : null;
    const bHttp = typeof b === 'string' && /^https?:\/\//i.test(b) ? b : null;
    return aHttp || bHttp || a || b || null;
  };
  return {
    ...secondary,
    ...primary,
    id: primary.id || secondary.id,
    title: primary.title && primary.title !== 'Scanned Food Label'
      ? primary.title
      : (secondary.title || primary.title || 'Scanned Food Label'),
    reason: primary.reason || secondary.reason || '',
    imageUrl: pickRemoteHttpUrl(primary.imageUrl, secondary.imageUrl),
    cloudinaryUrl: pickRemoteHttpUrl(primary.cloudinaryUrl, secondary.cloudinaryUrl),
    flaggedIngredients: Array.isArray(primary.flaggedIngredients) && primary.flaggedIngredients.length > 0
      ? primary.flaggedIngredients
      : (Array.isArray(secondary.flaggedIngredients) ? secondary.flaggedIngredients : []),
    createdAt: primary.createdAt || secondary.createdAt || primary.timestamp || secondary.timestamp,
    timestamp: primary.timestamp || secondary.timestamp || primary.createdAt || secondary.createdAt,
    synced: primary.synced === true || secondary.synced === true
  };
}

/**
 * Conservatively deduplicates scan records by canonical ID.
 * Preserves distinct legitimate scans even if timestamps or labels happen to match.
 */
export function cleanupDuplicateScans(records = []) {
  if (!Array.isArray(records)) return [];
  const byId = new Map();
  for (const rec of records) {
    if (!rec || !rec.id) continue;
    const existing = byId.get(rec.id);
    byId.set(rec.id, existing ? mergeSameIdScan(existing, rec) : rec);
  }
  return Array.from(byId.values());
}

/**
 * Safely reconciles remote Neon scan records with local scan history.
 * - Deduplicates strictly by canonical scan ID
 * - Never overwrites newer local modifications or unsynced records
 * - Preserves user-corrected titles, locally enriched images, and flagged ingredients
 * - Retains pending offline scans (synced: false)
 * - Returns merged list sorted newest first
 */
export function reconcileScanRecords(remoteScans, localScans = []) {
  if (!Array.isArray(remoteScans)) return cleanupDuplicateScans(Array.isArray(localScans) ? localScans : []);
  const localList = cleanupDuplicateScans(Array.isArray(localScans) ? localScans : []);
  const localMap = new Map(localList.map(s => [s.id, s]));
  const remoteMap = new Map();

  for (const rem of remoteScans) {
    if (!rem || !rem.id) continue;
    const prev = remoteMap.get(rem.id);
    remoteMap.set(rem.id, prev ? mergeSameIdScan(prev, rem) : rem);
  }

  const merged = [];
  for (const [id, rem] of remoteMap.entries()) {
    const loc = localMap.get(id);
    if (loc && loc.synced === false) {
      merged.push(mergeSameIdScan(loc, rem));
      merged[merged.length - 1].synced = false;
    } else {
      const combined = mergeSameIdScan(rem, loc);
      combined.synced = true;
      merged.push(combined);
    }
  }

  // Preserve all local scans that are not yet in remote!
  for (const loc of localList) {
    if (loc && loc.id && !remoteMap.has(loc.id)) {
      merged.push(loc);
    }
  }

  // Sort newest first
  merged.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  return merged;
}

/**
 * Reads scan history:
 * - Attempts to fetch latest records from GET /api/scans
 * - Non-destructively reconciles with localStorage cache so offline and pending records are preserved
 * - If network fails, API returns an error, or device is offline, falls back to localStorage
 */
export async function getScanHistory() {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;

      const res = await fetch('/api/scans', {
        headers: getAuthHeaders({ 'Accept': 'application/json' }),
        credentials: 'include',
        signal: controller?.signal
      });
      if (timeoutId) clearTimeout(timeoutId);

      if (res && res.ok) {
        const payload = await res.json().catch(() => null);
        if (payload && !payload.offline) {
          const remoteScans = Array.isArray(payload) 
            ? payload 
            : (Array.isArray(payload.data) ? payload.data : (Array.isArray(payload.scans) ? payload.scans : null));

          if (Array.isArray(remoteScans)) {
            const localScans = getLocalScanHistory();
            const merged = reconcileScanRecords(remoteScans, localScans);
            saveLocalHistory(merged);
            return merged;
          }
        }
      }
    } catch {
      // Offline fallback without unhandled promise rejections
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
      id: scanRecord.id || generateScanId(),
      title,
      timestamp,
      createdAt: timestamp,
      status: scanRecord.status || 'SAFE',
      reason,
      flaggedIngredients: uniqueFlagged,
      imageUrl,
      synced: false,
      ...scanRecord
    };
    record.id = scanRecord.id || record.id;
    record.title = title;
    record.timestamp = timestamp;
    record.createdAt = timestamp;
    record.reason = reason;
    record.flaggedIngredients = uniqueFlagged;
    record.imageUrl = imageUrl;
    record.synced = scanRecord.synced === true;

    // 1. Save to localStorage as offline backup (deduplicated by canonical ID, keep last 50 scans)
    const updated = cleanupDuplicateScans([record, ...history.filter(item => item.id !== record.id)]).slice(0, 50);
    saveLocalHistory(updated);

    // 2. Concurrently send idempotent POST /api/scans when online (guarded against duplicate concurrent POSTs)
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine !== undefined ? navigator.onLine : true;
    if (isOnline && !inFlightScanSyncs.has(record.id)) {
      inFlightScanSyncs.add(record.id);
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
        headers: getAuthHeaders({
          'Content-Type': 'application/json'
        }),
        credentials: 'include',
        body: JSON.stringify(payload)
      })
        .then(async (res) => {
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            console.warn('[Storage] Remote POST /api/scans failed with status', res.status, errBody);
          } else {
            const resData = await res.json().catch(() => null);
            if (resData && (resData.id || resData.success || resData.status)) {
              console.log('[Storage] Successfully synced scan record to Neon PostgreSQL:', record.id);
              const currentHistory = getLocalScanHistory();
              const syncedHistory = currentHistory.map(s => s.id === record.id ? { ...s, synced: true } : s);
              saveLocalHistory(syncedHistory);
            }
          }
        })
        .catch((err) => {
          console.warn('[Storage] Remote POST /api/scans network error (saved locally):', err);
        })
        .finally(() => {
          inFlightScanSyncs.delete(record.id);
        });
    }

    return updated;
  } catch (e) {
    console.error('Failed to save scan result', e);
    return getLocalScanHistory();
  }
}

/**
 * Updates an existing scan record with its Cloudinary remote URL without creating a duplicate entry.
 */
export function updateScanRecordImage(scanId, remoteUrl) {
  if (!scanId || !remoteUrl) return getLocalScanHistory();
  const history = getLocalScanHistory();
  let targetRecord = null;
  const updated = history.map(item => {
    if (item && item.id === scanId) {
      targetRecord = {
        ...item,
        imageUrl: remoteUrl,
        cloudinaryUrl: remoteUrl
      };
      return targetRecord;
    }
    return item;
  });
  saveLocalHistory(updated);

  const isOnline = typeof navigator !== 'undefined' && navigator.onLine !== undefined ? navigator.onLine : true;
  if (targetRecord && isOnline && typeof fetch === 'function' && !inFlightScanSyncs.has(scanId)) {
    inFlightScanSyncs.add(scanId);
    fetch('/api/scans', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({
        id: targetRecord.id,
        title: targetRecord.title || 'Scanned Food Label',
        status: targetRecord.status || 'SAFE',
        reason: targetRecord.reason || '',
        flaggedIngredients: Array.isArray(targetRecord.flaggedIngredients) ? targetRecord.flaggedIngredients : [],
        imageUrl: remoteUrl,
        createdAt: targetRecord.createdAt || targetRecord.timestamp
      })
    })
      .then((res) => {
        if (res && res.ok) {
          const latest = getLocalScanHistory().map(s => s.id === scanId ? { ...s, synced: true } : s);
          saveLocalHistory(latest);
        }
      })
      .catch(() => {})
      .finally(() => {
        inFlightScanSyncs.delete(scanId);
      });
  }
  return updated;
}

/**
 * Auto-retries synchronization of pending offline scan records to Neon PostgreSQL
 */
export async function syncPendingScans() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { syncedCount: 0, pendingCount: 0 };
  if (typeof fetch !== 'function') return { syncedCount: 0, pendingCount: 0 };

  try {
    const history = cleanupDuplicateScans(getLocalScanHistory());
    const unsynced = history.filter(s => s && s.synced === false && !inFlightScanSyncs.has(s.id));
    if (unsynced.length === 0) return { syncedCount: 0, pendingCount: 0 };

    let syncedCount = 0;
    const syncedIds = new Set();

    for (const scan of unsynced) {
      inFlightScanSyncs.add(scan.id);
      try {
        let imageUrl = scan.imageUrl || null;
        if (imageUrl && (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:'))) {
          try {
            const { uploadReceiptImageToCloudinary } = await import('../utils/cloudinary.js');
            const cUrl = await uploadReceiptImageToCloudinary(imageUrl).catch(() => null);
            if (cUrl && typeof cUrl === 'string' && cUrl.startsWith('http')) {
              imageUrl = cUrl;
              scan.imageUrl = cUrl;
              scan.cloudinaryUrl = cUrl;
            }
          } catch (_) {}
        }

        const payload = {
          id: scan.id,
          title: scan.title || 'Scanned Food Label',
          status: scan.status || 'SAFE',
          reason: scan.reason || '',
          flaggedIngredients: Array.isArray(scan.flaggedIngredients) ? scan.flaggedIngredients : [],
          imageUrl,
          createdAt: scan.createdAt || scan.timestamp || new Date().toISOString()
        };

        const res = await fetch('/api/scans', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (res && res.ok) {
          const resData = await res.json().catch(() => null);
          if (resData && (resData.id || resData.success || resData.status)) {
            syncedIds.add(scan.id);
            syncedCount++;
          }
        }
      } catch (err) {
        console.warn(`[Sync] Failed to sync scan ${scan.id}:`, err);
      } finally {
        inFlightScanSyncs.delete(scan.id);
      }
    }

    if (syncedCount > 0) {
      const updatedHistory = history.map(s => syncedIds.has(s.id) ? { ...s, synced: true } : s);
      saveLocalHistory(updatedHistory);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosherai-scans-synced', { detail: { syncedCount } }));
      }
    }

    return { syncedCount, pendingCount: unsynced.length - syncedCount };
  } catch (err) {
    console.warn('[Sync] Error during syncPendingScans:', err);
    return { syncedCount: 0, pendingCount: 0 };
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
      await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
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
