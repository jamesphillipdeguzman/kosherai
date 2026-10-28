// Serverless API Route for Sustaining Human Life Study Food Waste Logs
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { ensureTripsTables, isValidPostgresUrl } from './trips.js';

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
 * Primary API Handler for /api/food-waste
 * Supported Methods:
 * - GET: Returns food waste logs from Neon PostgreSQL
 * - POST: Upserts a food waste log into food_waste_logs
 * - DELETE: Deletes a food waste log by ID
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

  const method = req.method ? req.method.toUpperCase() : 'GET';
  const databaseUrl = process.env.DATABASE_URL;

  // Guard against unconfigured or invalid DATABASE_URL (Offline fallback)
  if (!isValidPostgresUrl(databaseUrl)) {
    console.warn('[API /api/food-waste] DATABASE_URL is not set or invalid. Skipping server-side database persistence.');
    if (method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        synced: false,
        offline: true,
        foodWaste: [],
        message: 'DATABASE_URL is not configured. Operating in offline/local mode.'
      });
    }
    if (method === 'POST') {
      const body = await parseRequestBody(req);
      const waste = body.waste || body;
      return sendJson(res, 200, {
        success: true,
        synced: false,
        offline: true,
        id: waste.id || `waste_${Date.now()}`,
        message: 'DATABASE_URL is not configured. Food waste saved locally in client IndexedDB.'
      });
    }
    if (method === 'DELETE') {
      return sendJson(res, 200, {
        success: true,
        synced: false,
        offline: true,
        message: 'DATABASE_URL is not configured. Deleted locally.'
      });
    }
    return sendJson(res, 200, { success: true, synced: false, foodWaste: [] });
  }

  let sql;
  try {
    sql = neon(databaseUrl.trim());
    await ensureTripsTables(sql);
  } catch (err) {
    console.warn('[API /api/food-waste] Neon Connection Error:', err);
    if (method === 'GET') {
      return sendJson(res, 200, {
        success: false,
        synced: false,
        offline: true,
        foodWaste: [],
        message: err.message || 'Database connection error.'
      });
    }
    if (method === 'POST') {
      const body = await parseRequestBody(req);
      const waste = body.waste || body;
      return sendJson(res, 200, {
        success: true,
        synced: false,
        offline: true,
        id: waste.id || `waste_${Date.now()}`,
        message: 'Database connection failed. Persisting to client IndexedDB with synced: false.'
      });
    }
    return sendJson(res, 200, { success: false, synced: false, foodWaste: [] });
  }

  try {
    // ----------------------------------------------------
    // GET /api/food-waste
    // ----------------------------------------------------
    if (method === 'GET') {
      const query = parseQueryParams(req);
      let rows = [];

      if (query.id) {
        rows = await sql`
          SELECT * FROM food_waste_logs WHERE id = ${query.id};
        `;
      } else if (query.week || query.projectWeek) {
        const weekNum = Number(query.week || query.projectWeek);
        rows = await sql`
          SELECT * FROM food_waste_logs WHERE project_week = ${weekNum} ORDER BY date DESC, created_at DESC;
        `;
      } else {
        rows = await sql`
          SELECT * FROM food_waste_logs ORDER BY date DESC, created_at DESC LIMIT 2000;
        `;
      }

      const formatted = rows.map(r => ({
        id: r.id,
        date: r.date,
        projectWeek: Number(r.project_week || 1),
        itemName: r.item_name,
        measuredWeightG: Number(r.measured_weight_g || 0),
        isEstimated: Boolean(r.is_estimated),
        estimatedCost: Number(r.estimated_cost || 0),
        reason: r.reason || 'Spoiled / Molded',
        notes: r.notes || '',
        createdAt: r.created_at,
        synced: true
      }));

      return sendJson(res, 200, {
        success: true,
        synced: true,
        foodWaste: formatted
      });
    }

    // ----------------------------------------------------
    // POST /api/food-waste: Upsert food waste log
    // ----------------------------------------------------
    if (method === 'POST') {
      const body = await parseRequestBody(req);
      const wasteData = body.waste || body;

      const id = wasteData.id || `waste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const date = wasteData.date || new Date().toISOString().split('T')[0];
      const projectWeek = Number(wasteData.projectWeek || wasteData.project_week || 1);
      const itemName = wasteData.itemName || wasteData.item_name || 'Food Waste';
      const measuredWeightG = Number(wasteData.measuredWeightG || wasteData.measured_weight_g || 0);
      const isEstimated = Boolean(wasteData.isEstimated ?? wasteData.is_estimated);
      const estimatedCost = Number(wasteData.estimatedCost || wasteData.estimated_cost || 0);
      const reason = wasteData.reason || 'Spoiled / Molded';
      const notes = wasteData.notes || '';

      await sql`
        INSERT INTO food_waste_logs (
          id, date, project_week, item_name, measured_weight_g,
          is_estimated, estimated_cost, reason, notes, created_at
        ) VALUES (
          ${id}, ${date}, ${projectWeek}, ${itemName}, ${measuredWeightG},
          ${isEstimated}, ${estimatedCost}, ${reason}, ${notes}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          item_name = EXCLUDED.item_name,
          measured_weight_g = EXCLUDED.measured_weight_g,
          is_estimated = EXCLUDED.is_estimated,
          estimated_cost = EXCLUDED.estimated_cost,
          reason = EXCLUDED.reason,
          notes = EXCLUDED.notes;
      `;

      return sendJson(res, 200, {
        success: true,
        synced: true,
        id,
        message: `Food waste entry ${id} saved to Neon PostgreSQL.`
      });
    }

    // ----------------------------------------------------
    // DELETE /api/food-waste
    // ----------------------------------------------------
    if (method === 'DELETE') {
      const query = parseQueryParams(req);
      const body = await parseRequestBody(req);
      const targetId = query.id || body.id;

      if (!targetId) {
        return sendJson(res, 400, { error: 'MISSING_ID', message: 'Waste record ID is required for deletion.' });
      }

      await sql`DELETE FROM food_waste_logs WHERE id = ${targetId};`;
      return sendJson(res, 200, {
        success: true,
        deletedId: targetId,
        message: `Food waste record ${targetId} deleted from Neon PostgreSQL.`
      });
    }

    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: `Method ${method} is not supported.` });
  } catch (err) {
    console.error('Food waste sync failed:', err);
    return sendJson(res, 500, { success: false, error: err.message });
  }
}
