/**
 * Validates basic email formatting
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Authentication service helper with Better Auth integration and REST fallback
 */
export async function authenticateUser(mode, credentials) {
  const { email, password, name } = credentials;

  // 1. Attempt Better Auth client if available
  try {
    const authModule = await import('../../lib/auth-client.js').catch(() => null);
    if (authModule) {
      if (mode === 'signin' && authModule.signIn?.email) {
        const res = await authModule.signIn.email({
          email: email.trim().toLowerCase(),
          password
        });
        if (res?.error) {
          throw new Error(res.error.message || 'Invalid email or password. Please verify credentials.');
        }
        const userObj = res?.data?.user || res?.data || { id: 'usr_' + Date.now(), email, name: email.split('@')[0] };
        let token = res?.data?.token || res?.data?.session?.token;
        if (!token && typeof authModule.getSession === 'function') {
          try {
            const sess = await authModule.getSession();
            if (sess?.data?.session?.token) token = sess.data.session.token;
          } catch (_) {}
        }
        if (!token) {
          try {
            const sessionRes = await fetch('/api/auth/get-session', { method: 'GET', credentials: 'include' });
            if (sessionRes.ok) {
              const sessionData = await sessionRes.json().catch(() => ({}));
              if (sessionData?.session?.token) token = sessionData.session.token;
              if (sessionData?.user) {
                userObj.id = sessionData.user.id || userObj.id;
                userObj.email = sessionData.user.email || userObj.email;
                userObj.name = sessionData.user.name || userObj.name;
              }
            }
          } catch (_) {}
        }
        if (token) {
          userObj.token = token;
          try { localStorage.setItem('better-auth.session_token', token); } catch (_) {}
        }
        return userObj;
      } else if (mode === 'signup' && authModule.signUp?.email) {
        const res = await authModule.signUp.email({
          name: (name || '').trim(),
          email: email.trim().toLowerCase(),
          password
        });
        if (res?.error) {
          throw new Error(res.error.message || 'Account registration failed. Please try again.');
        }
        const userObj = res?.data?.user || res?.data || { id: 'usr_' + Date.now(), email, name };
        let token = res?.data?.token || res?.data?.session?.token;
        if (!token && typeof authModule.getSession === 'function') {
          try {
            const sess = await authModule.getSession();
            if (sess?.data?.session?.token) token = sess.data.session.token;
          } catch (_) {}
        }
        if (!token) {
          try {
            const sessionRes = await fetch('/api/auth/get-session', { method: 'GET', credentials: 'include' });
            if (sessionRes.ok) {
              const sessionData = await sessionRes.json().catch(() => ({}));
              if (sessionData?.session?.token) token = sessionData.session.token;
              if (sessionData?.user) {
                userObj.id = sessionData.user.id || userObj.id;
                userObj.email = sessionData.user.email || userObj.email;
                userObj.name = sessionData.user.name || userObj.name;
              }
            }
          } catch (_) {}
        }
        if (token) {
          userObj.token = token;
          try { localStorage.setItem('better-auth.session_token', token); } catch (_) {}
        }
        return userObj;
      }
    }
  } catch (err) {
    if (err.message && !err.message.includes('Cannot find') && !err.message.includes('Failed to load')) {
      throw err;
    }
  }

  // 2. Direct REST API execution to Better Auth endpoints
  const endpoint = mode === 'signin' ? '/api/auth/sign-in/email' : '/api/auth/sign-up/email';
  const bodyPayload = mode === 'signin'
    ? { email: email.trim().toLowerCase(), password }
    : { name: (name || '').trim(), email: email.trim().toLowerCase(), password };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(bodyPayload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || data.error || (mode === 'signin'
      ? 'Invalid email or password. Please verify credentials.'
      : 'Failed to create account. Email may already be in use.'));
  }

  const userObj = data.user || data.data?.user || {
    id: data.id || 'usr_' + Date.now(),
    email: email.trim().toLowerCase(),
    name: name || email.split('@')[0]
  };
  let token = data.token || data.session?.token;

  // Better Auth stores session in HttpOnly cookie; retrieve active session token via get-session
  try {
    const sessionRes = await fetch('/api/auth/get-session', {
      method: 'GET',
      credentials: 'include'
    });
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json().catch(() => ({}));
      if (sessionData?.session?.token) {
        token = sessionData.session.token;
      }
      if (sessionData?.user) {
        userObj.id = sessionData.user.id || userObj.id;
        userObj.email = sessionData.user.email || userObj.email;
        userObj.name = sessionData.user.name || userObj.name;
      }
    }
  } catch (_) {}

  if (token) {
    userObj.token = token;
    try { localStorage.setItem('better-auth.session_token', token); } catch (_) {}
  }

  return userObj;
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const EYE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;

function passwordField({ id, label, minlength = false }) {
  return `
    <div class="auth-field">
      <label class="auth-label" for="${id}">${label}</label>
      <div class="auth-input-wrap">
        <input
          id="${id}"
          type="password"
          class="auth-input auth-input--with-toggle"
          autocomplete="new-password"
          autocorrect="off"
          spellcheck="false"
          data-form-type="other"
          data-lpignore="true"
          placeholder="••••••••"
          ${minlength ? 'minlength="6"' : ''}
          required
        />
        <button type="button" class="auth-eye-btn" data-auth-toggle-password="${id}" aria-label="Show password" aria-pressed="false" title="Show password">
          ${EYE_ICON}
        </button>
      </div>
    </div>
  `;
}

/**
 * Pure HTML generator for DOM-based rendering in vanilla main.js.
 */
export function renderAuthModalHtml({
  isOpen = false,
  mode = 'signin',
  errorMsg = '',
  isLoading = false,
  values = {}
} = {}) {
  if (!isOpen) return '';
  const isSignUp = mode === 'signup';

  return `
    <div id="auth-modal-overlay" class="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div class="auth-card" id="auth-modal-card">
        <button type="button" id="auth-modal-close-btn" class="auth-close-btn" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>

        <div class="auth-brand">
          <img src="/favicon.svg" alt="" class="auth-brand-logo" />
          <h2 class="auth-title" id="auth-modal-title">KosherAI</h2>
        </div>
        <span class="auth-badge">🛡️ Multi-Tenant Data Isolation</span>
        <p class="auth-subtitle">Your dietary history, securely synced across your devices.</p>

        <div class="auth-segment" role="tablist" aria-label="Authentication mode">
          <button type="button" id="auth-html-tab-signin" role="tab" aria-selected="${!isSignUp}" class="auth-segment-btn ${!isSignUp ? 'is-active' : ''}">Sign In</button>
          <button type="button" id="auth-html-tab-signup" role="tab" aria-selected="${isSignUp}" class="auth-segment-btn ${isSignUp ? 'is-active' : ''}">Create Account</button>
        </div>

        ${errorMsg ? `
          <div class="auth-error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>${escapeAttr(errorMsg)}</span>
          </div>
        ` : ''}

        <form id="auth-modal-form" class="auth-form" autocomplete="off" autocorrect="off" spellcheck="false" novalidate>
          ${isSignUp ? `
            <div class="auth-field">
              <label class="auth-label" for="auth-html-name">Full Name</label>
              <input
                id="auth-html-name"
                type="text"
                class="auth-input"
                autocomplete="off"
                autocorrect="off"
                spellcheck="false"
                data-form-type="other"
                data-lpignore="true"
                placeholder="e.g. Maria Santos"
                value="${escapeAttr(values.name)}"
                required
              />
            </div>
          ` : ''}

          <div class="auth-field">
            <label class="auth-label" for="auth-html-email">Email Address</label>
            <input
              id="auth-html-email"
              type="email"
              class="auth-input"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              data-form-type="other"
              data-lpignore="true"
              placeholder="patient@example.com"
              value="${escapeAttr(values.email)}"
              required
            />
          </div>

          ${passwordField({
            id: 'auth-html-password',
            label: isSignUp ? 'Password <span class="auth-label-hint">(min 6 characters)</span>' : 'Password',
            minlength: isSignUp
          })}

          ${isSignUp ? passwordField({
            id: 'auth-html-confirm-password',
            label: 'Confirm Password',
            minlength: true
          }) : ''}

          <button type="submit" id="auth-html-submit-btn" class="auth-submit-btn" ${isLoading ? 'disabled aria-busy="true"' : ''}>
            ${isLoading ? '<span class="auth-spinner" aria-hidden="true"></span>' : ''}
            <span>${isLoading
              ? (isSignUp ? 'Creating Account…' : 'Signing In…')
              : (isSignUp ? 'Create Account' : 'Sign In')}</span>
          </button>
        </form>

        <p class="auth-switch">
          ${isSignUp
            ? `Already have an account? <button type="button" id="auth-html-switch-signin" class="auth-link-btn">Sign in</button>`
            : `Don't have an account? <button type="button" id="auth-html-switch-signup" class="auth-link-btn">Sign up</button>`}
        </p>
        <p class="auth-privacy">🔒 Encrypted session · Your data is isolated to your account only.</p>
      </div>
    </div>
  `;
}
