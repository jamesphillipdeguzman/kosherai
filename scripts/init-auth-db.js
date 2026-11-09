import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { isProductionEnvironment } from '../lib/databaseSafety.js';

const sql = neon(process.env.DATABASE_URL);

export async function initAuthDatabase() {
  console.log('[Auth DB] Ensuring Better Auth tables in Neon PostgreSQL with exact schema...');

  // 1. User table (Better Auth) and legacy users table
  await sql`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
      image TEXT,
      role TEXT DEFAULT 'user',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // Ensure camelCase columns and role exist on user
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE;`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';`;

  // 2. Session table
  await sql`
    CREATE TABLE IF NOT EXISTS "session" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "userId" TEXT;`;
  await sql`ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ;`;
  await sql`ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;`;
  await sql`ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;`;
  await sql`ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  // Make legacy columns nullable
  await sql`ALTER TABLE "session" ALTER COLUMN user_id DROP NOT NULL;`;
  await sql`ALTER TABLE "session" ALTER COLUMN expires_at DROP NOT NULL;`;

  // 3. Account table
  await sql`
    CREATE TABLE IF NOT EXISTS "account" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "accessTokenExpiresAt" TIMESTAMPTZ,
      "refreshTokenExpiresAt" TIMESTAMPTZ,
      scope TEXT,
      "idToken" TEXT,
      password TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "userId" TEXT;`;
  await sql`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "accountId" TEXT;`;
  await sql`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "providerId" TEXT;`;
  await sql`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;`;
  await sql`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;`;
  await sql`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMPTZ;`;
  await sql`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMPTZ;`;
  await sql`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "idToken" TEXT;`;
  await sql`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  // Make legacy columns nullable
  await sql`ALTER TABLE "account" ALTER COLUMN user_id DROP NOT NULL;`;
  await sql`ALTER TABLE "account" ALTER COLUMN account_id DROP NOT NULL;`;
  await sql`ALTER TABLE "account" ALTER COLUMN provider_id DROP NOT NULL;`;

  // 4. Verification table
  await sql`
    CREATE TABLE IF NOT EXISTS "verification" (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ;`;
  await sql`ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE "verification" ALTER COLUMN expires_at DROP NOT NULL;`;

  // 5. Only seed mock admin in isolated non-production test environments if explicitly requested
  if (!isProductionEnvironment() && process.env.NODE_ENV === 'test' && process.env.SEED_TEST_USERS === 'true') {
    await sql`
      INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
      VALUES ('usr_primary_admin', 'Primary Admin', 'admin@kosherai.local', true, 'admin', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    `;
    console.log('[Auth DB] Synchronized test usr_primary_admin into test environment.');
  }

  console.log('[Auth DB] Tables created and synchronized successfully.');
}

if (process.argv[1]?.includes('init-auth-db.js')) {
  initAuthDatabase().catch(console.error);
}
