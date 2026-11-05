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
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])
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
 * Helper to extract session and authenticated user across Next.js App Router,
 * Vercel Serverless, and standard Node/Connect HTTP requests.
 */
export async function getAuthenticatedUser(reqOrHeaders: any) {
  try {
    // 1. Check Better Auth session via request headers
    let headersObj: any = null;

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
        headersObj.forEach((val: any, key: string) => fetchHeaders.set(key, val));
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

      // 2. Direct session token fallback lookup from Cookie or Authorization Bearer header
      const cookieHeader = fetchHeaders.get('cookie') || (reqOrHeaders?.headers && reqOrHeaders.headers.cookie) || '';
      const cookieTokens: string[] = [];

      if (cookieHeader) {
        // Check for __Secure-better-auth.session_token
        const secureMatch = cookieHeader.match(/__Secure-better-auth\.session_token=([^;]+)/);
        if (secureMatch) {
          cookieTokens.push(decodeURIComponent(secureMatch[1].trim()).replace(/^"|"$/g, ''));
        }
        // Check for better-auth.session_token
        const standardMatch = cookieHeader.match(/(?:^|;\s*)better-auth\.session_token=([^;]+)/);
        if (standardMatch) {
          cookieTokens.push(decodeURIComponent(standardMatch[1].trim()).replace(/^"|"$/g, ''));
        }
        // Check for generic session_token
        const genericMatch = cookieHeader.match(/(?:^|;\s*)session_token=([^;]+)/);
        if (genericMatch) {
          cookieTokens.push(decodeURIComponent(genericMatch[1].trim()).replace(/^"|"$/g, ''));
        }
      }

      const authHeader = fetchHeaders.get('authorization') || fetchHeaders.get('Authorization') || '';
      let bearerToken: string | null = null;
      if (authHeader) {
        const m = authHeader.match(/^Bearer\s+(.*)$/i);
        const candidate = m ? m[1].trim() : authHeader.trim();
        // Do NOT abort or override if Authorization: Bearer starts with "tok_" (legacy mock prefix)
        if (!candidate.startsWith('tok_') && candidate.length > 5) {
          bearerToken = candidate;
        }
      }

      // Prioritize cookies (__Secure-better-auth.session_token / better-auth.session_token) first, then non-mock Bearer tokens
      const candidateTokens = [...cookieTokens];
      if (bearerToken) {
        candidateTokens.push(bearerToken);
      }

      if (candidateTokens.length > 0 && databaseUrl) {
        try {
          const sql = neon(databaseUrl);
          for (const cand of candidateTokens) {
            const raw = cand;
            // Strip Express/Better-Auth signed cookie prefix (s:) and signature (.sig)
            const clean = cand.replace(/^s%3A|^s:/, '').split('.')[0].trim();

            const sessionRows = await sql`
              SELECT 
                s.id AS session_id,
                COALESCE(s.user_id, s."userId") AS uid,
                s.token,
                u.name,
                u.email
              FROM "session" s
              JOIN "user" u ON (u.id = COALESCE(s.user_id, s."userId"))
              WHERE (s.token = ${clean} OR s.token = ${raw})
                AND (s.expires_at > NOW() OR s."expiresAt" > NOW() OR s.expires_at IS NULL OR s."expiresAt" IS NULL)
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
        } catch (dbErr: any) {
          console.warn('[getAuthenticatedUser] Session lookup query error:', dbErr?.message || dbErr);
        }
      }

      // Internal service-to-service calls: only honored if explicitly authorized with valid INTERNAL_SERVICE_KEY
      const internalKey = process.env.INTERNAL_SERVICE_KEY;
      const internalSecret = fetchHeaders.get('x-internal-secret') || fetchHeaders.get('x-service-key');
      if (internalKey && internalSecret && internalSecret === internalKey) {
        const tenantHeader = fetchHeaders.get('x-user-id');
        if (tenantHeader && tenantHeader.trim() && databaseUrl) {
          try {
            const sql = neon(databaseUrl);
            const userRows = await sql`SELECT id, email, name FROM "user" WHERE id = ${tenantHeader.trim()} LIMIT 1`;
            if (userRows.length > 0) {
              return {
                id: userRows[0].id,
                email: userRows[0].email,
                name: userRows[0].name || userRows[0].email,
                session: null
              };
            }
          } catch (_) {
            // fallback
          }
        }
      }
    }

    return null;
  } catch (err: any) {
    console.warn('[getAuthenticatedUser] Authentication check failed:', err?.message || err);
    return null;
  }
}
