/**
 * Authentication URL Cleanup and Navigation Utility
 *
 * Automatically manages browser history and URL pathnames for authentication flows
 * (/sign-up, /login) using native window.history.replaceState() without page reloads,
 * routing dependencies, or duplicate history entries.
 */

export const AUTH_PATHNAMES = ['/login', '/signin', '/sign-in', '/signup', '/sign-up'];

/**
 * Checks whether a given pathname (or current window.location.pathname) is an auth route.
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function isAuthPathname(pathname) {
  if (typeof pathname !== 'string') {
    if (typeof window === 'undefined' || !window.location) return false;
    pathname = window.location.pathname || '';
  }
  const normalized = pathname.toLowerCase().trim().replace(/\/+$/, '') || '/';
  return AUTH_PATHNAMES.includes(normalized);
}

/**
 * Extracts and validates an intended post-authentication return URL from the query string.
 * Supports ?returnUrl=..., ?redirect=..., ?next=..., ?return_to=...
 * Enforces local relative paths to prevent open redirect vulnerabilities.
 *
 * @param {string} [searchString] - Optional query string or URL
 * @returns {string} Safe target destination (defaults to '/')
 */
export function getAuthRedirectDestination(searchString) {
  if (typeof searchString !== 'string') {
    if (typeof window === 'undefined' || !window.location) return '/';
    searchString = window.location.search || '';
  }

  try {
    const params = new URLSearchParams(searchString.startsWith('?') ? searchString : '?' + searchString);
    const candidate = params.get('returnUrl') ||
                      params.get('redirect') ||
                      params.get('next') ||
                      params.get('return_to');

    if (candidate && typeof candidate === 'string') {
      const decoded = decodeURIComponent(candidate.trim());
      // Prevent open redirect: must start with single '/', not '//' or '/\'
      if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.startsWith('/\\')) {
        return decoded;
      }
    }
  } catch (_) {}

  return '/';
}

/**
 * Determines whether the current path indicates a sign-in or sign-up modal view.
 * @param {string} [pathname]
 * @returns {'signin' | 'signup' | null}
 */
export function getAuthModeFromPathname(pathname) {
  if (typeof pathname !== 'string') {
    if (typeof window === 'undefined' || !window.location) return null;
    pathname = window.location.pathname || '';
  }
  const normalized = pathname.toLowerCase().trim().replace(/\/+$/, '');
  if (normalized === '/login' || normalized === '/signin' || normalized === '/sign-in') {
    return 'signin';
  }
  if (normalized === '/sign-up' || normalized === '/signup') {
    return 'signup';
  }
  return null;
}

/**
 * Clean up authentication URLs (/sign-up, /login) after Better Auth verifies an active session.
 * Replaces the browser URL with '/' (or return destination) via window.history.replaceState().
 * Does NOT reload the page or add extra history entries.
 *
 * @param {object|null} user - The verified authenticated user object
 * @param {object} [options]
 * @param {string} [options.destination] - Explicit destination override
 * @returns {boolean} True if a URL replacement occurred
 */
export function cleanAuthUrlIfAuthenticated(user, { destination = null } = {}) {
  if (!user || typeof user !== 'object') return false;
  if (typeof window === 'undefined' || !window.location || !window.history) return false;

  const currentPath = window.location.pathname || '';
  if (!isAuthPathname(currentPath)) return false;

  const target = destination || getAuthRedirectDestination(window.location.search);

  try {
    window.history.replaceState(window.history.state || {}, '', target);
    return true;
  } catch (err) {
    console.warn('[AuthNav] Failed to clean auth URL:', err);
    return false;
  }
}

/**
 * Updates browser address bar to reflect auth modal mode (/login or /sign-up)
 * using replaceState to avoid history clutter.
 *
 * @param {'signin' | 'signup'} mode
 */
export function setAuthUrl(mode) {
  if (typeof window === 'undefined' || !window.location || !window.history) return;
  const target = mode === 'signup' ? '/sign-up' : '/login';
  const currentPath = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
  if (currentPath !== target) {
    try {
      window.history.replaceState(window.history.state || {}, '', target);
    } catch (_) {}
  }
}

/**
 * Reverts URL to '/' if modal was dismissed while on an auth pathname.
 */
export function clearAuthUrlIfOnAuthPath() {
  if (typeof window === 'undefined' || !window.location || !window.history) return;
  if (isAuthPathname(window.location.pathname)) {
    try {
      window.history.replaceState(window.history.state || {}, '', '/');
    } catch (_) {}
  }
}

