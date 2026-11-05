/**
 * Utility to retrieve client session credentials and build authenticated headers.
 */

/**
 * Retrieves the active client authentication token from localStorage or document cookies.
 * Checks:
 * 1. kosherai_user_session (session.token, token, or user.token)
 * 2. kosherai_current_user (token)
 * 3. better-auth.session_token in localStorage
 * 4. better-auth.session_token in document cookies
 */
export function getClientAuthToken() {
  if (typeof window === 'undefined') return null;
  try {
    const rawSession = localStorage.getItem('kosherai_user_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      const token = parsed.token || parsed.session?.token || parsed.user?.token;
      if (token) return token;
    }
    const rawUser = localStorage.getItem('kosherai_current_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed.token) return parsed.token;
    }
    const directToken = localStorage.getItem('better-auth.session_token') || localStorage.getItem('better-auth_session_token');
    if (directToken) return directToken;

    if (typeof document !== 'undefined' && document.cookie) {
      const match = document.cookie.match(/(?:(?:__Secure-)?better-auth\.session_token|better-auth_session_token)=([^;]+)/);
      if (match) {
        return decodeURIComponent(match[1].trim()).replace(/^"|"$/g, '');
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

