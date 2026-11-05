import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

export async function initAuthDatabase() {
  console.log('[Auth DB] Ensuring Better Auth tables in Neon PostgreSQL with exact schema...');

  // 1. User table
  await sql`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
      image TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // Ensure camelCase columns exist on user
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE;`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`;

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

  // 5. Sync existing usr_primary_admin from users into "user"
  const existingUsers = await sql`SELECT * FROM users WHERE id = 'usr_primary_admin'`;
  if (existingUsers.length > 0) {
    const admin = existingUsers[0];
    await sql`
      INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      VALUES (${admin.id}, ${admin.full_name || 'Primary Admin'}, ${admin.email || 'admin@kosherai.local'}, true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email;
    `;
    console.log('[Auth DB] Synchronized usr_primary_admin into "user" table.');
  }

  console.log('[Auth DB] Tables created and synchronized successfully.');
}

if (process.argv[1]?.includes('init-auth-db.js')) {
  initAuthDatabase().catch(console.error);
}
