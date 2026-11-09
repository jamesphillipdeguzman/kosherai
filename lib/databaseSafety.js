// KosherAI - Production Database Safety & Test Isolation Utility
// Guarantees that automated tests, seed processes, and development scripts
// NEVER write to or create mock/dummy accounts in the production Neon database.
import 'dotenv/config';

/**
 * Checks whether the current process is running in a production deployment environment.
 */
export function isProductionEnvironment() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ||
    process.env.VERCEL === '1'
  );
}

/**
 * Normalizes a database connection URL (extracts protocol, host, and database path)
 * without logging or exposing credentials.
 */
export function normalizeDatabaseTarget(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Enforces test database isolation.
 * Throws a clear error if:
 * 1. Running in a production environment.
 * 2. DATABASE_URL_TEST is missing (never silently falls back to DATABASE_URL).
 * 3. DATABASE_URL_TEST target matches production DATABASE_URL.
 *
 * @param {string|null} overrideUrl - Optional connection string to validate
 * @returns {string} The verified, isolated test database connection URL
 */
export function assertTestDatabaseConnection(overrideUrl = null) {
  if (isProductionEnvironment()) {
    throw new Error('Test user seeding and live database test operations are disabled in production.');
  }

  const testDbUrl = overrideUrl || process.env.DATABASE_URL_TEST;
  if (!testDbUrl || !testDbUrl.trim()) {
    throw new Error(
      '[Test Database Protection] DATABASE_URL_TEST is not defined. Automated tests and seed scripts must run against an isolated test database, not production. Define DATABASE_URL_TEST in .env.test or your environment.'
    );
  }

  const prodDbUrl = process.env.DATABASE_URL;
  if (prodDbUrl) {
    const normTest = normalizeDatabaseTarget(testDbUrl);
    const normProd = normalizeDatabaseTarget(prodDbUrl);
    if (normTest === normProd) {
      throw new Error(
        '[Test Database Protection] Rejected: DATABASE_URL_TEST matches the production DATABASE_URL target. Tests cannot be run against the production database.'
      );
    }
  }

  return testDbUrl.trim();
}

/**
 * Safely checks if an isolated test database is available without throwing.
 *
 * @returns {string|null}
 */
export function getSafeTestDatabaseUrl() {
  try {
    return assertTestDatabaseConnection();
  } catch {
    return null;
  }
}

export default {
  isProductionEnvironment,
  normalizeDatabaseTarget,
  assertTestDatabaseConnection,
  getSafeTestDatabaseUrl
};

