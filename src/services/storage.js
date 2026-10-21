// Local Storage & State Management for KosherAI (Offline First)

const KEYS = {
  SETTINGS: 'kosherai_settings',
  SCAN_HISTORY: 'kosherai_scan_history',
  RECENT_SEARCHES: 'kosherai_recent_searches',
  CHECKLIST: 'kosherai_checklist'
};

const DEFAULT_SETTINGS = {
  geminiApiKey: '',
  cloudinaryCloudName: '',
  cloudinaryPreset: '',
  prepDate: '',
  targetMaxIodine: 50
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
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
    const record = {
      id: 'scan_' + Date.now(),
      timestamp: new Date().toISOString(),
      ...scanRecord
    };
    // Keep last 30 scans
    const updated = [record, ...history.slice(0, 29)];
    localStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(updated));
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
