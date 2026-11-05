import React, { useState, useEffect } from 'react';
import { isValidEmail, authenticateUser, renderAuthModalHtml } from './AuthModal.js';

export { isValidEmail, authenticateUser, renderAuthModalHtml };

/**
 * AuthModal Component
 *
 * Responsive modal overlay matching KosherAI dark slate design system (bg-slate-900, border-slate-800, emerald/teal accents).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {Function} props.onClose - Dismiss callback
 * @param {Function} [props.onSuccess] - Callback executed on successful auth with session data
 * @param {'signin'|'signup'} [props.initialMode='signin'] - Default mode to display
 */
export default function AuthModal({
  isOpen = false,
  onClose,
  onSuccess,
  initialMode = 'signin'
}) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync mode whenever initialMode or isOpen changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg('');
    }
  }, [isOpen, initialMode]);

  // Handle escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Common email validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address (e.g., user@example.com).');
      return;
    }

    // Password validation
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }

      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters in length.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify and try again.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const userRecord = await authenticateUser(mode, {
        email: trimmedEmail,
        password,
        name: fullName.trim()
      });

      const sessionPayload = {
        user: {
          id: userRecord.id || userRecord.userId || 'usr_' + Date.now(),
          email: trimmedEmail,
          name: userRecord.name || (mode === 'signup' ? fullName.trim() : trimmedEmail.split('@')[0])
        },
        session: {
          token: userRecord.token || 'tok_' + Date.now(),
          createdAt: new Date().toISOString()
        }
      };

      // 1. Save session info to localStorage
      try {
        localStorage.setItem('kosherai_user_session', JSON.stringify(sessionPayload));
        localStorage.setItem('kosherai_current_user', JSON.stringify(sessionPayload.user));
      } catch (storageErr) {
        console.warn('[AuthModal] LocalStorage save warning:', storageErr);
      }

      // 2. Trigger global custom events to refresh user's trips and scans
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosherai:auth-changed', { detail: sessionPayload }));
        window.dispatchEvent(new CustomEvent('kosherai:sync-data', { detail: { userId: sessionPayload.user.id } }));
      }

      // 3. Callback and close
      onSuccess?.(sessionPayload);
      onClose?.();
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 modal-overlay bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close"
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer disabled:opacity-50"
        >
          ✕
        </button>

        {/* Modal Branding Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
            🌿
          </div>
          <h2 id="auth-modal-title" className="text-xl font-black tracking-tight text-white">
            KosherAI
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          {mode === 'signin'
            ? 'Sign in to access your personal shopping trips, scans, and clinical diet records.'
            : 'Create your account to sync your multi-tenant clinical diet history across devices.'}
        </p>

        {/* Segmented Toggle: Sign In vs Create Account */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/80 border border-slate-800 rounded-xl mb-5" role="tablist">
          <button
            type="button"
            role="tab"
            id="auth-tab-signin"
            aria-selected={mode === 'signin'}
            onClick={() => handleModeSwitch('signin')}
            disabled={isLoading}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            id="auth-tab-signup"
            aria-selected={mode === 'signup'}
            onClick={() => handleModeSwitch('signup')}
            disabled={isLoading}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Inline Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2 mb-4" role="alert">
            <span className="flex-shrink-0 text-rose-400 font-bold">⚠️</span>
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="auth-modal-name">
                Full Name
              </label>
              <input
                id="auth-modal-name"
                type="text"
                autoComplete="name"
                placeholder="Maria Santos"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="auth-modal-email">
              Email Address
            </label>
            <input
              id="auth-modal-email"
              type="email"
              autoComplete="email"
              placeholder="patient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300" htmlFor="auth-modal-password">
                {mode === 'signup' ? 'Password (min 6 chars)' : 'Password'}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-teal-400 hover:underline cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="auth-modal-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              required
              minLength={mode === 'signup' ? 6 : undefined}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="auth-modal-confirm-password">
                Confirm Password
              </label>
              <input
                id="auth-modal-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                required
              />
            </div>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            id="auth-modal-submit-btn"
            disabled={isLoading}
            className="w-full min-h-[44px] py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{mode === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>
        </form>

        {/* Mode Switch Prompt */}
        <div className="text-center text-xs text-slate-400 mt-5">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => handleModeSwitch('signup')}
                disabled={isLoading}
                className="text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => handleModeSwitch('signin')}
                disabled={isLoading}
                className="text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
