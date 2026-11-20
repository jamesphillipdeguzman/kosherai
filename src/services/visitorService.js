// Client-Side Anonymous Visitor Counter Service
// Generates a persistent anonymous visitor ID and syncs with /api/visitors

export const VISITOR_ID_KEY = 'kosherai_visitor_id';
export const VISITOR_COUNT_CACHE_KEY = 'kosherai_visitor_count_cache';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{16,64}$/;
let inFlightVisitorRequest = null;

function generateAnonymousId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `v_${Date.now().toString(36)}_${rand()}${rand()}`;
}

function readVisitorCookie() {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie.match(/(?:^|;\s*)kosherai_visitor_id=([^;]+)/);
  if (!match || !match[1]) return null;
  try {
    const val = decodeURIComponent(match[1].trim()).replace(/^"|"$/g, '');
    return VALID_ID_REGEX.test(val) ? val : null;
  } catch {
    return null;
  }
}

function writeVisitorCookie(id) {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${VISITOR_ID_KEY}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch (_) {}
}

/**
 * Retrieves or creates an anonymous persistent visitor ID (localStorage + cookie).
 * Contains no personally identifiable information.
 */
export function getOrCreateAnonymousVisitorId() {
  let existing = null;
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(VISITOR_ID_KEY);
      if (stored && VALID_ID_REGEX.test(stored)) {
        existing = stored;
      }
    } catch (_) {}
  }

  if (!existing) {
    existing = readVisitorCookie();
  }

  if (!existing) {
    existing = generateAnonymousId();
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(VISITOR_ID_KEY, existing);
    } catch (_) {}
  }
  writeVisitorCookie(existing);

  return existing;
}

/**
 * Returns the last cached visitor count if available, otherwise null.
 */
export function getCachedVisitorCount() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(VISITOR_COUNT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const count = Number(parsed?.count);
    return Number.isFinite(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

/**
 * Formats visitor count with thousands separators (e.g., 1,234).
 */
export function formatVisitorCount(count) {
  const num = Number(count);
  if (!Number.isFinite(num) || num < 0) return '';
  return Math.floor(num).toLocaleString('en-US');
}

/**
 * Registers the anonymous visitor once on the backend and returns the latest count.
 * Falls back to cached count if offline or API fails; returns null if no cache exists.
 */
export async function registerAndFetchVisitorCount() {
  const cached = getCachedVisitorCount();
  const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? navigator.onLine
    : true;

  if (!isOnline || typeof fetch !== 'function') {
    return cached;
  }

  if (inFlightVisitorRequest) {
    return inFlightVisitorRequest;
  }

  inFlightVisitorRequest = (async () => {
    try {
      const visitorId = getOrCreateAnonymousVisitorId();
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;

      const res = await fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitorId }),
        ...(controller ? { signal: controller.signal } : {})
      });
      if (timer) clearTimeout(timer);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success && typeof data.totalVisitors === 'number' && Number.isFinite(data.totalVisitors)) {
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(
                VISITOR_COUNT_CACHE_KEY,
                JSON.stringify({ count: data.totalVisitors, updatedAt: Date.now() })
              );
            } catch (_) {}
          }
          return data.totalVisitors;
        }
      }
      return cached;
    } catch (_) {
      return cached;
    } finally {
      inFlightVisitorRequest = null;
    }
  })();

  return inFlightVisitorRequest;
}
