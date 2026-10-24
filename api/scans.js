// Serverless API Route for KosherAI Multi-Device Scan History
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

let isTableInitialized = false;

/**
 * Auto-creates the scans table if it does not already exist
 */
async function ensureTable(sql) {
  if (isTableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT 'Scanned Food Label',
      status TEXT NOT NULL,
      reason TEXT,
      flagged_ingredients JSONB DEFAULT '[]'::jsonb,
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  isTableInitialized = true;
}

/**
 * Standardizes sending JSON responses across Vercel Serverless and Node/Connect HTTP
 */
function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

/**
 * Parses request body for both pre-parsed environments (Vercel) and raw streams (Connect/Vite)
 */
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
    req.on('data', chunk => {
      body += chunk;
    });
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

/**
 * Parses query parameters from request URL
 */
function parseQueryParams(req) {
  if (req.query) return req.query;
  try {
    const parsed = new URL(req.url, 'http://localhost');
    const params = {};
    for (const [key, value] of parsed.searchParams.entries()) {
      params[key] = value;
    }
    return params;
  } catch {
    return {};
  }
}

/**
 * Primary API Handler for /api/scans
 * Supported Methods:
 * - GET: Returns last 50 scans ordered by created_at DESC
 * - POST: Accepts { id, title, status, reason, flaggedIngredients, imageUrl } and upserts into scans
 * - DELETE: Clears history (if no id) or deletes scan by id
 */
export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.statusCode = 204;
    return res.end();
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || !databaseUrl.trim()) {
    return sendJson(res, 503, {
      error: 'DATABASE_URL_NOT_CONFIGURED',
      message: 'Neon PostgreSQL DATABASE_URL is not set. Scans will operate in offline-first localStorage mode.'
    });
  }

  let sql;
  try {
    sql = neon(databaseUrl.trim());
    await ensureTable(sql);
  } catch (err) {
    console.error('[API /api/scans] Neon Connection Error:', err);
    return sendJson(res, 500, {
      error: 'DATABASE_CONNECTION_ERROR',
      message: err.message || 'Failed to connect to Neon PostgreSQL database.'
    });
  }

  const method = req.method ? req.method.toUpperCase() : 'GET';

  try {
    // ----------------------------------------------------
    // GET /api/scans: Returns last 50 scans ordered by created_at DESC
    // ----------------------------------------------------
    if (method === 'GET') {
      const rows = await sql`
        SELECT 
          id, 
          title, 
          status, 
          reason, 
          flagged_ingredients, 
          image_url, 
          created_at
        FROM scans
        ORDER BY created_at DESC
        LIMIT 50;
      `;

      const formatted = rows.map(row => {
        let flagged = [];
        if (Array.isArray(row.flagged_ingredients)) {
          flagged = row.flagged_ingredients;
        } else if (typeof row.flagged_ingredients === 'string') {
          try {
            flagged = JSON.parse(row.flagged_ingredients);
          } catch {
            flagged = [];
          }
        }

        return {
          id: row.id,
          title: row.title || 'Scanned Food Label',
          status: row.status,
          reason: row.reason || '',
          flaggedIngredients: flagged,
          imageUrl: row.image_url || null,
          createdAt: row.created_at,
          timestamp: row.created_at
        };
      });

      return sendJson(res, 200, formatted);
    }

    // ----------------------------------------------------
    // POST /api/scans: Accepts { id, title, status, reason, flaggedIngredients, imageUrl }
    // ----------------------------------------------------
    if (method === 'POST') {
      const body = await parseRequestBody(req);

      const id = body.id || `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const title = body.title || 'Scanned Food Label';
      const status = body.status || 'SAFE';
      const reason = body.reason || '';
      const flaggedIngredients = Array.isArray(body.flaggedIngredients) ? body.flaggedIngredients : [];
      const imageUrl = body.imageUrl || null;
      const createdAt = body.createdAt || body.timestamp || new Date().toISOString();

      const jsonFlagged = JSON.stringify(flaggedIngredients);

      const rows = await sql`
        INSERT INTO scans (id, title, status, reason, flagged_ingredients, image_url, created_at)
        VALUES (${id}, ${title}, ${status}, ${reason}, ${jsonFlagged}::jsonb, ${imageUrl}, ${createdAt})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          reason = EXCLUDED.reason,
          flagged_ingredients = EXCLUDED.flagged_ingredients,
          image_url = EXCLUDED.image_url
        RETURNING id, title, status, reason, flagged_ingredients, image_url, created_at;
      `;

      const saved = rows[0] || {
        id,
        title,
        status,
        reason,
        flagged_ingredients: flaggedIngredients,
        image_url: imageUrl,
        created_at: createdAt
      };

      return sendJson(res, 201, {
        id: saved.id,
        title: saved.title,
        status: saved.status,
        reason: saved.reason,
        flaggedIngredients: Array.isArray(saved.flagged_ingredients) 
          ? saved.flagged_ingredients 
          : flaggedIngredients,
        imageUrl: saved.image_url,
        createdAt: saved.created_at,
        timestamp: saved.created_at
      });
    }

    // ----------------------------------------------------
    // DELETE /api/scans: Clears history or deletes by id
    // ----------------------------------------------------
    if (method === 'DELETE') {
      const query = parseQueryParams(req);
      const body = await parseRequestBody(req);
      const targetId = query.id || body.id;

      if (targetId) {
        await sql`DELETE FROM scans WHERE id = ${targetId};`;
        return sendJson(res, 200, {
          success: true,
          deletedId: targetId,
          message: `Scan record ${targetId} deleted successfully.`
        });
      } else {
        await sql`DELETE FROM scans;`;
        return sendJson(res, 200, {
          success: true,
          message: 'All scan history cleared successfully.'
        });
      }
    }

    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: `Method ${method} is not supported.` });
  } catch (err) {
    console.error('[API /api/scans] Query Execution Error:', err);
    return sendJson(res, 500, {
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An error occurred while executing the database query.'
    });
  }
}
