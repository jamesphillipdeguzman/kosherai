// Serverless API Route for Household Settings Persistence
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { isValidPostgresUrl } from './trips.js';
import { getAuthenticatedUser, setCorsHeaders } from '../lib/auth.js';

export async function ensureSettingsTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS household_settings (
      user_id TEXT PRIMARY KEY,
      household_members INTEGER DEFAULT 4,
      active_diet TEXT DEFAULT 'lid',
      theme TEXT DEFAULT 'dark',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
}

function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const method = req.method ? req.method.toUpperCase() : 'GET';
  const databaseUrl = process.env.DATABASE_URL;

  const defaultSettings = {
    household_members: 4,
    active_diet: 'lid',
    theme: 'dark'
  };

  if (!isValidPostgresUrl(databaseUrl)) {
    if (method === 'GET') {
      return sendJson(res, 200, { success: true, synced: false, offline: true, settings: defaultSettings });
    }
    const body = await parseRequestBody(req);
    return sendJson(res, 200, { success: true, synced: false, offline: true, settings: { ...defaultSettings, ...body } });
  }

  let sql;
  try {
    sql = neon(databaseUrl.trim());
    await ensureSettingsTable(sql);
  } catch (err) {
    console.warn('[API /api/settings] Neon connection error:', err);
    return sendJson(res, 200, { success: false, synced: false, offline: true, settings: defaultSettings, message: err.message });
  }

  try {
    let user = null;
    try {
      user = await getAuthenticatedUser(req);
    } catch (_) {}

    const userId = typeof user === 'string' ? user : user?.id;

    if (!userId) {
      return sendJson(res, 401, {
        error: 'UNAUTHORIZED',
        message: 'Authentication required. Please sign in to access settings.'
      });
    }

    // 1. GET /api/settings
    if (method === 'GET') {
      const rows = await sql`
        SELECT 
          user_id AS "userId",
          household_members AS "household_members",
          active_diet AS "active_diet",
          theme AS "theme",
          updated_at AS "updatedAt"
        FROM household_settings
        WHERE user_id = ${userId}
        LIMIT 1;
      `;

      if (rows && rows.length > 0) {
        return sendJson(res, 200, {
          success: true,
          synced: true,
          settings: {
            household_members: rows[0].household_members ?? 4,
            active_diet: rows[0].active_diet || 'lid',
            theme: rows[0].theme || 'dark'
          }
        });
      }

      return sendJson(res, 200, {
        success: true,
        synced: true,
        settings: defaultSettings
      });
    }

    // 2. POST / PUT /api/settings
    if (method === 'POST' || method === 'PUT') {
      const body = await parseRequestBody(req);
      const settings = body.settings || body;

      const members = Math.max(1, Math.min(20, Math.round(Number(settings.household_members ?? settings.householdMembers ?? 4))));
      const diet = settings.active_diet || settings.activeDiet || 'lid';
      const theme = settings.theme || 'dark';

      const rows = await sql`
        INSERT INTO household_settings (
          user_id, household_members, active_diet, theme, updated_at
        ) VALUES (
          ${userId}, ${members}, ${diet}, ${theme}, NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          household_members = EXCLUDED.household_members,
          active_diet = EXCLUDED.active_diet,
          theme = EXCLUDED.theme,
          updated_at = NOW()
        RETURNING
          household_members AS "household_members",
          active_diet AS "active_diet",
          theme AS "theme",
          updated_at AS "updatedAt";
      `;

      return sendJson(res, 200, {
        success: true,
        synced: true,
        settings: {
          household_members: rows[0].household_members,
          active_diet: rows[0].active_diet,
          theme: rows[0].theme
        }
      });
    }

    return sendJson(res, 405, { error: `Method ${method} Not Allowed` });
  } catch (err) {
    console.error('[API /api/settings] Handler error:', err);
    return sendJson(res, 500, { success: false, error: err.message });
  }
}

