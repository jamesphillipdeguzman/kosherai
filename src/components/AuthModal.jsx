import React, { useState } from 'react';
export { renderAuthModalHtml, authenticateUser, isValidEmail } from './AuthModal.js';

/**
 * React AuthModal.
 *
 * NOTE: Tailwind is NOT compiled in this project, so this component uses the
 * same scoped `.auth-*` classes as the vanilla renderer in AuthModal.js
 * (defined in the "AUTH MODAL" section of src/style.css). Both paths render
 * identically. Card: #0b1329 background, #1e293b (slate-800) border.
 */
function PasswordInput({ id, name, label, value, onChange, minLength }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          name={name}
          required
          minLength={minLength}
          value={value}
          onChange={onChange}
          autoComplete="new-password"
          autoCorrect="off"
          spellCheck="false"
          data-form-type="other"
          data-lpignore="true"
          placeholder="••••••••"
          className="auth-input auth-input--with-toggle"
        />
        <button
          type="button"
          className="auth-eye-btn"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function AuthModal({ isOpen, initialMode = 'signin', onClose, onAuthSuccess, onSuccess }) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const isSignUp = mode === 'signup';

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errorMsg) setErrorMsg('');
  };

  const switchMode = (next) => {
    setMode(next);
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return; // prevent duplicate submissions
    setErrorMsg('');

    if (isSignUp && formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = mode === 'signin' ? '/api/auth/sign-in/email' : '/api/auth/sign-up/email';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || (mode === 'signin' ? 'Invalid credentials' : 'Registration failed'));
      }

      const sessionData = await res.json();
      const token = sessionData.token || sessionData.session?.token;
      const userObj = sessionData.user || sessionData;
      const fullUser = {
        ...userObj,
        ...(token ? { token } : {})
      };
      const sessionPayload = {
        token: token,
        session: { token },
        user: fullUser
      };
      localStorage.setItem('kosherai_user_session', JSON.stringify(sessionPayload));
      localStorage.setItem('kosherai_current_user', JSON.stringify(fullUser));
      if (token) {
        try { localStorage.setItem('better-auth.session_token', token); } catch (_) {}
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosherai:auth-changed', { detail: sessionPayload }));
        window.dispatchEvent(new CustomEvent('kosherai:sync-data'));
      }

      if (onAuthSuccess) onAuthSuccess(sessionPayload);
      if (onSuccess) onSuccess(sessionPayload);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Unable to authenticate. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={() => { if (!isLoading) onClose(); }}
    >
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="auth-close-btn" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="auth-brand">
          <img src="/favicon.svg" alt="" className="auth-brand-logo" />
          <h2 className="auth-title" id="auth-modal-title">KosherAI</h2>
        </div>
        <span className="auth-badge">🛡️ Multi-Tenant Data Isolation</span>
        <p className="auth-subtitle">Your dietary history, securely synced across your devices.</p>

        {/* Mode Toggle (segmented control) */}
        <div className="auth-segment" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignUp}
            onClick={() => switchMode('signin')}
            className={`auth-segment-btn ${!isSignUp ? 'is-active' : ''}`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignUp}
            onClick={() => switchMode('signup')}
            className={`auth-segment-btn ${isSignUp ? 'is-active' : ''}`}
          >
            Create Account
          </button>
        </div>

        {/* Error Feedback */}
        {errorMsg && (
          <div className="auth-error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off" autoCorrect="off" spellCheck="false">
          {isSignUp && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-react-name">Full Name</label>
              <input
                id="auth-react-name"
                type="text"
                name="name"
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                data-form-type="other"
                data-lpignore="true"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Maria Santos"
                className="auth-input"
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-react-email">Email Address</label>
            <input
              id="auth-react-email"
              type="email"
              name="email"
              required
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              data-form-type="other"
              data-lpignore="true"
              value={formData.email}
              onChange={handleChange}
              placeholder="patient@example.com"
              className="auth-input"
            />
          </div>

          <PasswordInput
            id="auth-react-password"
            name="password"
            label={isSignUp ? 'Password (min 6 characters)' : 'Password'}
            value={formData.password}
            onChange={handleChange}
            minLength={6}
          />

          {isSignUp && (
            <PasswordInput
              id="auth-react-confirm-password"
              name="confirmPassword"
              label="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              minLength={6}
            />
          )}

          <button type="submit" disabled={isLoading} aria-busy={isLoading} className="auth-submit-btn">
            {isLoading && <span className="auth-spinner" aria-hidden="true" />}
            <span>
              {isLoading
                ? (isSignUp ? 'Creating Account…' : 'Signing In…')
                : (isSignUp ? 'Create Account' : 'Sign In')}
            </span>
          </button>
        </form>

        {/* Footer */}
        <p className="auth-switch">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button
            type="button"
            onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
            className="auth-link-btn"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
        <p className="auth-privacy">🔒 Encrypted session · Your data is isolated to your account only.</p>
      </div>
    </div>
  );
}
