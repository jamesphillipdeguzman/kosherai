import React, { useState } from 'react';
export { renderAuthModalHtml, authenticateUser, isValidEmail } from './AuthModal.js';

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

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'signup' && formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = mode === 'signin' ? '/api/auth/sign-in' : '/api/auth/sign-up';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || (mode === 'signin' ? 'Invalid credentials' : 'Registration failed'));
      }

      const user = await res.json();
      localStorage.setItem('kosherai_user_session', JSON.stringify(user));
      try {
        localStorage.setItem('kosherai_current_user', JSON.stringify(user?.user || user));
      } catch (_) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosherai:auth-changed', { detail: user }));
        window.dispatchEvent(new CustomEvent('kosherai:sync-data'));
      }

      if (onAuthSuccess) onAuthSuccess(user);
      if (onSuccess) onSuccess(user);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Unable to authenticate. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-[#0b1329] border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Row with Title & Close Button */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium mb-2">
              <span>🛡️</span> Multi-Tenant Data Isolation
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {mode === 'signin' ? 'Sign In to KosherAI' : 'Create an Account'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {mode === 'signin'
                ? 'Access your personal shopping trips, scans, and diet tracking.'
                : 'Get started with personal food cost analysis and receipt tracking.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Mode Toggle Switch (Matches Supermarket / Wet Market pill style) */}
        <div className="flex p-1 mb-5 bg-[#070d1f] rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => { setMode('signin'); setErrorMsg(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMsg(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Feedback */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {mode === 'signup' && (
            <div className="flex flex-col gap-1 text-left">
              <label className="text-xs font-medium text-slate-300">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Maria Santos"
                className="w-full px-3.5 py-2.5 bg-[#060b17] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          )}

          <div className="flex flex-col gap-1 text-left">
            <label className="text-xs font-medium text-slate-300">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="patient@example.com"
              className="w-full px-3.5 py-2.5 bg-[#060b17] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1 text-left">
            <label className="text-xs font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-[#060b17] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {mode === 'signup' && (
            <div className="flex flex-col gap-1 text-left">
              <label className="text-xs font-medium text-slate-300">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={6}
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-[#060b17] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>

        {/* Mode Footer Switch */}
        <div className="mt-5 text-center">
          <p className="text-xs text-slate-400">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
            {' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setErrorMsg('');
              }}
              className="font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2 ml-1 cursor-pointer"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
