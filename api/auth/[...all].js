import { auth, setCorsHeaders, getAuthenticatedUser } from "../../lib/auth.js";
import { toNodeHandler } from "better-auth/node";

const authHandler = toNodeHandler(auth);

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const url = req.url || '';
  if (req.method === 'GET' && (url.includes('/get-session') || url.endsWith('/session'))) {
    try {
      const authUser = await getAuthenticatedUser(req);
      if (authUser?.id) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          session: authUser.session?.session || authUser.session || {
            id: 'sess_' + authUser.id,
            userId: authUser.id,
            token: authUser.session?.token || ''
          },
          user: {
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
            role: authUser.role || 'user'
          }
        }));
      }
    } catch (e) {
      console.warn('[api/auth/[...all].js] get-session fallback error:', e);
    }
  }

  return authHandler(req, res);
}

