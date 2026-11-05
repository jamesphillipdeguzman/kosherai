'use client';

import { createAuthClient } from 'better-auth/react';

const baseURL = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173');

/**
 * Better Auth Client Instance
 */
export const authClient = createAuthClient({
  baseURL
});

/**
 * Client authentication utilities exported directly
 */
export const {
  signIn,
  signUp,
  useSession,
  getSession
} = authClient;

/**
 * Clear all tenant-specific cached data from client storage
 * Prevents data bleeding across different logins on the same device.
 */
export function clearClientTenantData() {
  if (typeof window === 'undefined') return;

  try {
    const keysToClear = [
      'kosherai_course_trips',
      'kosherai_course_grocery_items',
      'kosherai_course_food_waste',
      'kosherai_course_expenses',
      'kosherai_course_meal_plans',
      'kosherai_scan_history',
      'kosherai_current_user',
      'kosherai_user_session',
      'kosherai_venue_mode'
    ];

    keysToClear.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch (e) {
        // Ignore removal error
      }
    });

    sessionStorage.clear();

    // Clear IndexedDB offline cache if available
    if (window.indexedDB) {
      try {
        const req = window.indexedDB.deleteDatabase('KosherAICourseDB');
        req.onerror = () => {};
        req.onsuccess = () => {};
      } catch (e) {
        // Ignore IndexedDB delete error
      }
    }
  } catch (err) {
    console.warn('[Auth Client] Error clearing client tenant cache:', err);
  }
}

/**
 * Wrapped signOut helper that guarantees client cache purge
 */
export async function signOut(options?: any) {
  try {
    clearClientTenantData();
    const result = await authClient.signOut(options);
    return result;
  } catch (err) {
    console.error('[Auth Client] Sign out failed:', err);
    clearClientTenantData();
    throw err;
  }
}

export default authClient;

