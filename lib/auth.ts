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

      // 2. Direct session token from Authorization Bearer header or Cookie
      const authHeader = fetchHeaders.get('authorization') || fetchHeaders.get('Authorization');
      let token = null;
      if (authHeader) {
        const m = authHeader.match(/^Bearer\s+(.*)$/i);
        token = m ? m[1].trim() : authHeader.trim();
      }

      if (!token) {
        const cookieHeader = fetchHeaders.get('cookie') || fetchHeaders.get('Cookie');
        if (cookieHeader) {
          const match = cookieHeader.match(/(?:(?:__Secure-)?better-auth\.session_token|better-auth_session_token|session_token)=([^;]+)/);
          if (match) {
            token = decodeURIComponent(match[1].trim()).replace(/^"|"$/g, '');
          }
        }
      }

      let cleanToken = token;
      if (token) {
        // Strip Express/Better-Auth signed cookie prefix (s:) and signature (.sig) if present
        cleanToken = token.replace(/^s%3A|^s:/, '').split('.')[0].trim();
      }

      if ((token || cleanToken) && databaseUrl) {
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
            WHERE (s.token = ${token} OR s.token = ${cleanToken})
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
