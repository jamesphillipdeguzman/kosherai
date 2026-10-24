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

export function getScanHistory() {
  try {
    const raw = localStorage.getItem(KEYS.SCAN_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function addScanToHistory(scanRecord) {
  try {
    const history = getScanHistory();
    const flaggedIngredients = scanRecord.flaggedIngredients || (scanRecord.analysis ? [
      ...(scanRecord.aiAnalysis?.problemIngredients || []),
      ...(scanRecord.analysis.detectedForbidden || []).map(f => f.matchedWord || f.name),
      ...(scanRecord.analysis.detectedCaution || []).map(c => c.matchedWord || c.name)
    ] : []);
    const uniqueFlagged = [...new Set(flaggedIngredients.map(t => String(t).trim()))].filter(Boolean);
    const reason = scanRecord.reason || scanRecord.aiAnalysis?.reason || scanRecord.analysis?.reason || (scanRecord.analysis?.reasons && scanRecord.analysis.reasons[0]) || '';
    const imageUrl = scanRecord.imageUrl || scanRecord.cloudinaryUrl || scanRecord.imagePreviewUrl || null;

    const record = {
      id: scanRecord.id || ('scan_' + Date.now()),
      timestamp: scanRecord.timestamp || new Date().toISOString(),
      status: scanRecord.status || 'SAFE',
      reason,
      flaggedIngredients: uniqueFlagged,
      imageUrl,
      ...scanRecord
    };
    record.reason = reason;
    record.flaggedIngredients = uniqueFlagged;
    record.imageUrl = imageUrl;

    // Keep last 30 scans
    let updated = [record, ...history.slice(0, 29)];
    try {
      localStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(updated));
    } catch (quotaErr) {
      console.warn('Storage quota exceeded, preserving recent images and trimming older ones...', quotaErr);
      updated = updated.map((item, idx) => {
        if (idx > 2 && item.imageUrl && item.imageUrl.startsWith('data:')) {
          return { ...item, imageUrl: null };
        }
        return item;
      });
      try {
        localStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(updated));
      } catch (e2) {
        const stripped = updated.map(item => item.imageUrl?.startsWith('data:') ? { ...item, imageUrl: null } : item);
        localStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(stripped));
      }
    }
    return updated;
  } catch (e) {
    console.error('Failed to add scan to history', e);
  }
}

export function clearScanHistory() {
  try {
    localStorage.removeItem(KEYS.SCAN_HISTORY);
  } catch (e) {
    console.error('Failed to clear scan history', e);
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
