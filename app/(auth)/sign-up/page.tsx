'use client';

import React, { useState } from 'react';
import { signUp } from '../../../lib/auth-client';

export default function SignUpPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters in length.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify and re-type.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp.email({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        callbackURL: '/dashboard'
      });

      if (result?.error) {
        setErrorMsg(result.error.message || 'Registration failed. The email may already be in use.');
        setIsLoading(false);
      } else {
        // Automatically redirect to /dashboard upon successful registration
        if (typeof window !== 'undefined') {
          window.location.href = '/dashboard';
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during account creation. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-2.5 mb-3">
            <img src="/favicon.svg" alt="KosherAI Logo" className="w-9 h-9" />
            <span className="text-2xl font-black tracking-tight text-white">
              Kosher<span className="text-emerald-400">AI</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              New Account
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Create your account</h1>
          <p className="text-xs text-slate-400 mt-1">
            Start a fresh, isolated workspace for receipts, scans, and food study logs
          </p>
        </div>

        {/* Error Notification Banner */}
        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-xl text-xs font-medium border bg-red-500/10 border-red-500/40 text-red-400 flex items-start gap-2 animate-fadeIn">
            <span className="text-sm select-none">⚠️</span>
            <span className="flex-1 leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-name" className="text-xs font-semibold text-slate-300">
              Full Name
            </label>
            <input
              id="signup-name"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rachel Green"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm transition-colors border outline-none bg-slate-800/80 text-white border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Email Address */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-email" className="text-xs font-semibold text-slate-300">
              Email Address
            </label>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm transition-colors border outline-none bg-slate-800/80 text-white border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="signup-password" className="text-xs font-semibold text-slate-300">
                Password
              </label>
              <span className="text-[10px] text-slate-500">Min. 8 characters</span>
            </div>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full min-h-[44px] px-3.5 pr-11 py-2.5 rounded-xl text-sm transition-colors border outline-none bg-slate-800/80 text-white border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-confirm-password" className="text-xs font-semibold text-slate-300">
              Confirm Password
            </label>
            <input
              id="signup-confirm-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type password"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm transition-colors border outline-none bg-slate-800/80 text-white border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>

          {/* Terms notice */}
          <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
            By registering, your account is provisioned with a private tenant partition in Neon PostgreSQL with zero cross-tenant visibility.
          </p>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={isLoading}
            className={`min-h-[46px] mt-2 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40 cursor-pointer ${
              isLoading ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              <span>Create Account & Launch Dashboard</span>
            )}
          </button>
        </form>

        {/* Link to Sign In */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Already have an account?{' '}
          <a href="/sign-in" className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

