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
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://kosherai-gel.vercel.app');

const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
if (!betterAuthSecret) {
  throw new Error('[Better Auth Config Error] BETTER_AUTH_SECRET environment variable is missing.');
}

/**
 * Server Authentication Instance
 * Configures Email/Password, optional Google OAuth, and handles Better Auth sessions.
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
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : [])
  ],
  secret: betterAuthSecret,
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
  }
});

/**
 * Standardizes CORS headers across all serverless API endpoints.
 * Supports credentials with specific requesting origin.
 */
export function setCorsHeaders(req, res) {
  const origin = req.headers?.origin || req.headers?.Origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-internal-secret');
}

/**
 * Helper to extract session and authenticated user across Next.js App Router,
 * Vercel Serverless, and standard Node/Connect HTTP requests.
 */
export async function getAuthenticatedUser(reqOrHeaders) {
  try {
    let headersObj = null;

    if (reqOrHeaders) {
      if (typeof reqOrHeaders.get === 'function') {
        headersObj = reqOrHeaders;
      } else if (reqOrHeaders.headers) {
        headersObj = reqOrHeaders.headers;
      } else if (typeof reqOrHeaders === 'object') {
        headersObj = reqOrHeaders;
      }
    }

    if (!headersObj) return null;

    const fetchHeaders = new Headers();
    if (typeof headersObj.forEach === 'function') {
      headersObj.forEach((val, key) => fetchHeaders.set(key, val));
    } else {
      for (const [key, val] of Object.entries(headersObj)) {
        if (val) fetchHeaders.set(key, String(val));
      }
    }

    // 1. Check Better Auth API session
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
    } catch (_) {}

    // 2. Direct session token lookup from Cookie or Authorization Bearer header
    const cookieHeader = fetchHeaders.get('cookie') || (reqOrHeaders?.headers && reqOrHeaders.headers.cookie) || '';
    const candidateTokens = [];

    if (cookieHeader) {
      const matches = [
        cookieHeader.match(/(?:^|;\s*)__Secure-better-auth\.session_token=([^;]+)/),
        cookieHeader.match(/(?:^|;\s*)better-auth\.session_token=([^;]+)/),
        cookieHeader.match(/(?:^|;\s*)better-auth_session_token=([^;]+)/),
        cookieHeader.match(/(?:^|;\s*)session_token=([^;]+)/)
      ];
      for (const m of matches) {
        if (m && m[1]) {
          candidateTokens.push(decodeURIComponent(m[1].trim()).replace(/^"|"$/g, ''));
        }
      }
    }

    const authHeader = fetchHeaders.get('authorization') || fetchHeaders.get('Authorization') || '';
    if (authHeader) {
      const m = authHeader.match(/^Bearer\s+(.*)$/i);
      const candidate = m ? m[1].trim() : authHeader.trim();
      if (!candidate.startsWith('tok_') && candidate.length > 5) {
        candidateTokens.push(candidate);
      }
    }

    if (candidateTokens.length > 0 && databaseUrl) {
      try {
        const sql = neon(databaseUrl);
        for (const cand of candidateTokens) {
          const raw = cand;
          const clean = cand.replace(/^s%3A|^s:/, '').split('.')[0].trim();

          const sessionRows = await sql`
            SELECT 
              s.id AS session_id,
              COALESCE(s."userId", s.user_id) AS uid,
              s.token,
              COALESCE(s."expiresAt", s.expires_at) AS expires_at,
              u.name,
              u.email
            FROM "session" s
            JOIN "user" u ON (u.id = COALESCE(s."userId", s.user_id))
            WHERE (s.token = ${clean} OR s.token = ${raw})
              AND (
                COALESCE(s."expiresAt", s.expires_at) > NOW()
                OR COALESCE(s."expiresAt", s.expires_at) IS NULL
              )
            LIMIT 1;
          `;

          if (sessionRows.length > 0) {
            const s = sessionRows[0];
            return {
              id: s.uid,
              email: s.email,
              name: s.name || s.email,
              session: s
            };
          }
        }
      } catch (dbErr) {
        console.warn('[getAuthenticatedUser] Session lookup query error:', dbErr?.message || dbErr);
      }
    }

    // Internal service-to-service calls with INTERNAL_SERVICE_KEY
    const internalKey = process.env.INTERNAL_SERVICE_KEY;
    const internalSecret = fetchHeaders.get('x-internal-secret') || fetchHeaders.get('x-service-key');
    if (internalKey && internalSecret && internalSecret === internalKey) {
      const tenantHeader = fetchHeaders.get('x-user-id');
      if (tenantHeader && tenantHeader.trim() && databaseUrl) {
        try {
          const sql = neon(databaseUrl);
          const userRows = await sql`SELECT id, email, name FROM "user" WHERE id = ${tenantHeader.trim()} LIMIT 1;`;
          if (userRows.length > 0) {
            return {
              id: userRows[0].id,
              email: userRows[0].email,
              name: userRows[0].name || userRows[0].email,
              session: null
            };
          }
        } catch (_) {}
      }
    }

    return null;
  } catch (err) {
    console.warn('[getAuthenticatedUser] Authentication check failed:', err?.message || err);
    return null;
  }
}

