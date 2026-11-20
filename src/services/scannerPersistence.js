/**
 * Scanner State & Temporary Image Persistence
 * - Uses sessionStorage for Scanner tab/context restoration across mobile camera backgrounding/reloads.
 * - Uses IndexedDB for temporary captured image persistence so users can retry without retaking photos.
 */

const SESSION_KEY = 'kosherai_scanner_session';
const IDB_NAME = 'kosherai_scanner_temp_db';
const IDB_STORE = 'temp_images';
const IDB_RECORD_KEY = 'active_capture';

/**
 * Saves active scanner navigation/context state to sessionStorage.
 */
export function saveScannerSessionState(state) {
  if (typeof sessionStorage === 'undefined' || !state) return;
  try {
    const payload = {
      appMode: 'diet',
      activeTab: 'scanner',
      scannerTab: state.scannerTab || 'food_label',
      scanTarget: state.scanTarget || 'label',
      activeDiet: state.activeDiet || 'lid',
      scannerEnabled: state.scannerEnabled !== undefined ? Boolean(state.scannerEnabled) : true,
      savedAt: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch (_) {}
}

/**
 * Reads saved scanner session state from sessionStorage.
 * Returns null if none exists or if expired (> 30 minutes).
 */
export function loadScannerSessionState() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.activeTab !== 'scanner') return null;
    // Expire stale restoration state after 30 minutes so future visits aren't forced into Scanner
    if (parsed.savedAt && Date.now() - parsed.savedAt > 30 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

/**
 * Clears scanner restoration state from sessionStorage (call when user explicitly leaves Scanner).
 */
export function clearScannerSessionState() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (_) {}
}

function openTempImageDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return resolve(null);
    }
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Temporarily persists a compressed image dataUrl in IndexedDB for mobile reload/retry recovery.
 */
export async function saveTempScannerImage(dataUrl, meta = {}) {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  const db = await openTempImageDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({ dataUrl, meta, savedAt: Date.now() }, IDB_RECORD_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch (_) {
      try { db.close(); } catch {}
      resolve(false);
    }
  });
}

/**
 * Restores a temporarily persisted image dataUrl from IndexedDB.
 */
export async function loadTempScannerImage() {
  const db = await openTempImageDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_RECORD_KEY);
      req.onsuccess = () => {
        const record = req.result;
        db.close();
        if (!record || !record.dataUrl) return resolve(null);
        // Expire after 30 minutes
        if (record.savedAt && Date.now() - record.savedAt > 30 * 60 * 1000) {
          clearTempScannerImage().catch(() => {});
          return resolve(null);
        }
        resolve(record);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch (_) {
      try { db.close(); } catch {}
      resolve(null);
    }
  });
}

/**
 * Cleans up temporary scanner image data from IndexedDB.
 */
export async function clearTempScannerImage() {
  const db = await openTempImageDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.delete(IDB_RECORD_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch (_) {
      try { db.close(); } catch {}
      resolve();
    }
  });
}
