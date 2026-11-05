'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from '../lib/auth-client';

export default function Navbar() {
  const { data: session, isPending } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            if (typeof window !== 'undefined') {
              window.location.href = '/sign-in';
            }
          }
        }
      });
    } catch (err) {
      console.error('Error signing out:', err);
      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in';
      }
    }
  };

  const user = session?.user;
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <a href="/" className="inline-flex items-center gap-2.5 group">
          <img src="/favicon.svg" alt="KosherAI Logo" className="w-8 h-8 transition-transform group-hover:scale-105" />
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-white leading-tight">
              Kosher<span className="text-emerald-400">AI</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium leading-none">
              Clinical Food Scanner & Study
            </span>
          </div>
        </a>

        {/* Dynamic Auth State Controls */}
        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="h-9 w-24 bg-slate-800/60 rounded-full animate-pulse" />
          ) : user ? (
            /* Logged In State: User Avatar, Email Tooltip & Dropdown Menu */
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-full border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                title={`Signed in as ${user.email || user.name}`}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {initial}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-white leading-tight max-w-[120px] truncate">
                    {user.name || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight max-w-[120px] truncate" title={user.email}>
                    {user.email}
                  </span>
                </div>
                <span className="text-xs text-slate-400 pr-1">▼</span>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 text-slate-200 animate-fadeIn">
                  <div className="px-4 py-2.5 border-b border-slate-800">
                    <p className="text-xs font-bold text-white truncate">{user.name || 'Account'}</p>
                    <p className="text-[11px] text-slate-400 truncate" title={user.email}>{user.email}</p>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span>Tenant ID:</span>
                      <span className="truncate max-w-[110px]">{user.id}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <a
                      href="/dashboard"
                      className="flex items-center gap-2 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span>📊</span> Dashboard & Study
                    </a>
                    <a
                      href="/scans"
                      className="flex items-center gap-2 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span>📷</span> Scans & Verified History
                    </a>
                    <a
                      href="/market"
                      className="flex items-center gap-2 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span>🛒</span> Grocery Intake
                    </a>
                  </div>

                  <div className="border-t border-slate-800 pt-1">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left font-semibold cursor-pointer"
                    >
                      <span>🚪</span> Sign Out & Clear Device Cache
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Logged Out State: Sign In & Get Started CTAs */
            <div className="flex items-center gap-2 sm:gap-3">
              <a
                href="/sign-in"
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
              >
                Sign In
              </a>
              <a
                href="/sign-up"
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm transition-all shadow-emerald-950/40"
              >
                Get Started
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

