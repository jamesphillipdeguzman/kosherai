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
        return res?.data?.user || res?.data || { id: 'usr_' + Date.now(), email, name: email.split('@')[0] };
      } else if (mode === 'signup' && authModule.signUp?.email) {
        const res = await authModule.signUp.email({
          name: (name || '').trim(),
          email: email.trim().toLowerCase(),
          password
        });
        if (res?.error) {
          throw new Error(res.error.message || 'Account registration failed. Please try again.');
        }
        return res?.data?.user || res?.data || { id: 'usr_' + Date.now(), email, name };
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
    body: JSON.stringify(bodyPayload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || data.error || (mode === 'signin'
      ? 'Invalid email or password. Please verify credentials.'
      : 'Failed to create account. Email may already be in use.'));
  }

  return data.user || data.data?.user || {
    id: data.id || 'usr_' + Date.now(),
    email: email.trim().toLowerCase(),
    name: name || email.split('@')[0]
  };
}

/**
 * Pure HTML generator for DOM-based rendering in vanilla main.js
 */
export function renderAuthModalHtml({
  isOpen = false,
  mode = 'signin',
  errorMsg = '',
  isLoading = false
} = {}) {
  if (!isOpen) return '';

  return `
    <div
      id="auth-modal-overlay"
      class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div class="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100 overflow-hidden" id="auth-modal-card">
        <button
          type="button"
          id="auth-modal-close-btn"
          aria-label="Close"
          class="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          ✕
        </button>

        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
            🌿
          </div>
          <h2 class="text-xl font-black tracking-tight text-white">KosherAI</h2>
        </div>
        <p class="text-xs text-slate-400 mb-5">
          ${mode === 'signin'
            ? 'Sign in to access your personal shopping trips, scans, and clinical diet records.'
            : 'Create your account to sync your multi-tenant clinical diet history across devices.'}
        </p>

        <div class="grid grid-cols-2 p-1 bg-slate-950/80 border border-slate-800 rounded-xl mb-5" role="tablist">
          <button
            type="button"
            id="auth-html-tab-signin"
            class="py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'signin' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }"
          >
            Sign In
          </button>
          <button
            type="button"
            id="auth-html-tab-signup"
            class="py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'signup' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }"
          >
            Create Account
          </button>
        </div>

        ${errorMsg ? `
          <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2 mb-4" role="alert">
            <span class="flex-shrink-0 text-rose-400 font-bold">⚠️</span>
            <span class="flex-1">${errorMsg}</span>
          </div>
        ` : ''}

        <form id="auth-modal-form" class="space-y-4">
          ${mode === 'signup' ? `
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1.5" for="auth-html-name">Full Name</label>
              <input
                id="auth-html-name"
                type="text"
                autocomplete="name"
                placeholder="Maria Santos"
                class="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                required
              />
            </div>
          ` : ''}

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5" for="auth-html-email">Email Address</label>
            <input
              id="auth-html-email"
              type="email"
              autocomplete="email"
              placeholder="patient@example.com"
              class="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              required
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5" for="auth-html-password">
              ${mode === 'signup' ? 'Password (min 6 chars)' : 'Password'}
            </label>
            <input
              id="auth-html-password"
              type="password"
              autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"
              placeholder="••••••••"
              class="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              required
              ${mode === 'signup' ? 'minlength="6"' : ''}
            />
          </div>

          ${mode === 'signup' ? `
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1.5" for="auth-html-confirm-password">Confirm Password</label>
              <input
                id="auth-html-confirm-password"
                type="password"
                autocomplete="new-password"
                placeholder="••••••••"
                class="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                required
              />
            </div>
          ` : ''}

          <button
            type="submit"
            id="auth-html-submit-btn"
            ${isLoading ? 'disabled' : ''}
            class="w-full min-h-[44px] py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            ${isLoading ? 'Processing...' : (mode === 'signin' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div class="text-center text-xs text-slate-400 mt-5">
          ${mode === 'signin' ? `
            Don't have an account?
            <button type="button" id="auth-html-switch-signup" class="text-emerald-400 hover:underline font-semibold cursor-pointer ml-1">
              Sign up
            </button>
          ` : `
            Already have an account?
            <button type="button" id="auth-html-switch-signin" class="text-emerald-400 hover:underline font-semibold cursor-pointer ml-1">
              Sign in
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

