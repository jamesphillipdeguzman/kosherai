/**
 * Utility to retrieve client session credentials and build authenticated headers.
 */

/**
 * Validates that a token is a legitimate non-mock session string.
 * Rejects legacy client mock tokens starting with "tok_".
 */
function isValidSessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  // Legacy client fallback mock tokens start with "tok_" - must be ignored to allow native cookie auth
  if (trimmed.startsWith('tok_')) return false;
  return trimmed.length > 5;
}

/**
 * Retrieves the active client authentication token from localStorage or document cookies.
 * Checks:
 * 1. kosherai_user_session (session.token, token, or user.token)
 * 2. kosherai_current_user (token)
 * 3. better-auth.session_token in localStorage
 * 4. better-auth.session_token in document cookies
 *
 * Ignores any mock tokens starting with "tok_".
 */
export function getClientAuthToken() {
  if (typeof window === 'undefined') return null;
  try {
    const rawSession = localStorage.getItem('kosherai_user_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      const token = parsed.token || parsed.session?.token || parsed.user?.token;
      if (isValidSessionToken(token)) return token.trim();
    }
    const rawUser = localStorage.getItem('kosherai_current_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (isValidSessionToken(parsed.token)) return parsed.token.trim();
    }
    const directToken = localStorage.getItem('better-auth.session_token') || localStorage.getItem('better-auth_session_token');
    if (isValidSessionToken(directToken)) return directToken.trim();

    if (typeof document !== 'undefined' && document.cookie) {
      const match = document.cookie.match(/(?:(?:__Secure-)?better-auth\.session_token|better-auth_session_token)=([^;]+)/);
      if (match) {
        const decoded = decodeURIComponent(match[1].trim()).replace(/^"|"$/g, '');
        if (isValidSessionToken(decoded)) return decoded;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Injects Authorization: Bearer <token> header and Content-Type when appropriate.
 */
export function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const token = getClientAuthToken();
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

