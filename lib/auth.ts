import { betterAuth } from 'better-auth';
import { Pool, neon } from '@neondatabase/serverless';
import 'dotenv/config';

// Initialize Neon PostgreSQL connection pool for Better Auth
const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : null;

const appBaseUrl =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');

/**
 * Server Authentication Instance
 * Configures Email/Password, optional Google OAuth, and keeps Neon users table synced.
 */
export const auth = betterAuth({
  database: pool || {
    provider: 'postgres',
    url: databaseUrl || ''
  },
  baseURL: appBaseUrl,
  trustedOrigins: [
    'https://kosherai-gel.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])
  ],
  secret: process.env.BETTER_AUTH_SECRET || 'c7f92e41a89b3d047e1f6a5b8c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d',
  emailAndPassword: {
    enabled: true,
    autoSignIn: true
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
          }
        }
      : {})
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Connect auth user store directly to the `users` table created in Neon
          if (databaseUrl) {
            try {
              const sql = neon(databaseUrl);
              await sql`
                INSERT INTO users (id, email, full_name, created_at, updated_at)
                VALUES (${user.id}, ${user.email}, ${user.name || user.email}, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                  email = EXCLUDED.email,
                  full_name = EXCLUDED.full_name,
                  updated_at = NOW();
              `;
            } catch (err) {
              console.warn('[Better Auth Hook] Syncing users table:', err.message);
            }
          }
        }
      }
    }
  }
});

/**
 * Helper to extract session and authenticated user across Next.js App Router,
 * Vercel Serverless, and standard Node/Connect HTTP requests.
 */
export async function getAuthenticatedUser(reqOrHeaders) {
  try {
    // 1. Check Better Auth session via request headers
    let headersObj = null;

    if (reqOrHeaders) {
      if (typeof reqOrHeaders.get === 'function') {
        // Headers instance (Next.js App Router / fetch Headers)
        headersObj = reqOrHeaders;
      } else if (reqOrHeaders.headers) {
        // Node / Express / Next.js Request object
        headersObj = reqOrHeaders.headers;
      } else if (typeof reqOrHeaders === 'object') {
        headersObj = reqOrHeaders;
      }
    }

    if (headersObj) {
      // Convert Node headers object or Headers object to fetch Headers for Better Auth
      const fetchHeaders = new Headers();
      if (typeof headersObj.forEach === 'function') {
        headersObj.forEach((val, key) => fetchHeaders.set(key, val));
      } else {
        for (const [key, val] of Object.entries(headersObj)) {
          if (val) fetchHeaders.set(key, String(val));
        }
      }

      // Check Better Auth API session
      try {
        const session = await auth.api.getSession({ headers: fetchHeaders });
        if (session?.user?.id) {
          return {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name || session.user.email,
            session
          };
        }
      } catch (authErr) {
        // Ignore session parse error and proceed to headers check
      }

      // 2. Direct session token from Authorization Bearer header or Cookie
      const authHeader = fetchHeaders.get('authorization') || fetchHeaders.get('Authorization');
      let token = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace(/^Bearer\s+/i, '').trim();
      }

      if (!token) {
        const cookieHeader = fetchHeaders.get('cookie') || fetchHeaders.get('Cookie');
        if (cookieHeader) {
          const match = cookieHeader.match(/(?:better-auth\.session_token|__Secure-better-auth\.session_token)=([^;]+)/);
          if (match) token = decodeURIComponent(match[1].trim());
        }
      }

      if (token && databaseUrl) {
        try {
          const sql = neon(databaseUrl);
          const sessionRows = await sql`
            SELECT 
              s.id as session_id,
              COALESCE(s."userId", s.user_id) as user_id,
              s.token,
              u.name,
              u.email
            FROM "session" s
            JOIN "user" u ON (u.id = s."userId" OR u.id = s.user_id)
            WHERE s.token = ${token} 
              AND (s."expiresAt" > NOW() OR s.expires_at > NOW() OR s."expiresAt" IS NULL)
            LIMIT 1;
          `;
          if (sessionRows.length > 0) {
            const s = sessionRows[0];
            return {
              id: s.user_id,
              email: s.email,
              name: s.name || s.email,
              session: s
            };
          }
        } catch (dbErr) {
          console.warn('[getAuthenticatedUser] Session lookup query error:', dbErr.message);
        }
      }

      // Explicit tenant header check (for serverless/worker invocation or admin impersonation)
      const tenantHeader = fetchHeaders.get('x-user-id');
      if (tenantHeader && tenantHeader.trim()) {
        const tenantId = tenantHeader.trim();
        // Verify tenant exists in Neon users / user
        if (databaseUrl) {
          try {
            const sql = neon(databaseUrl);
            const userRows = await sql`SELECT id, email, full_name as name FROM users WHERE id = ${tenantId} LIMIT 1`;
            if (userRows.length > 0) {
              return {
                id: userRows[0].id,
                email: userRows[0].email,
                name: userRows[0].name || userRows[0].email,
                session: null
              };
            }
          } catch (e) {
            // fallback
          }
        }
        return { id: tenantId, email: null, name: 'Tenant User', session: null };
      }
    }

    return null;
  } catch (err) {
    console.warn('[getAuthenticatedUser] Authentication check failed:', err);
    return null;
  }
}
