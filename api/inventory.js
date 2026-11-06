// Serverless API Route for Household Inventory Management (Phase 4)
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { isValidPostgresUrl } from './trips.js';

/**
 * Ensures household_inventory table exists in Neon
 */
export async function ensureInventoryTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS household_inventory (
      id TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      category TEXT DEFAULT 'Other Perishables',
      quantity NUMERIC(10, 2) DEFAULT 1,
      original_quantity NUMERIC(10, 2) DEFAULT 1,
      consumed_quantity NUMERIC(10, 2) DEFAULT 0,
      wasted_quantity NUMERIC(10, 2) DEFAULT 0,
      unit TEXT DEFAULT 'pcs',
      purchase_date TEXT NOT NULL,
      expiration_date TEXT,
      storage_location TEXT DEFAULT 'Refrigerator',
      source TEXT DEFAULT 'manual',
      trip_id TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await sql`ALTER TABLE household_inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
  } catch (_) {}
}

function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.statusCode = 204;
    return res.end();
  }

  const method = req.method ? req.method.toUpperCase() : 'GET';
  const databaseUrl = process.env.DATABASE_URL;

  // Offline fallback if DATABASE_URL is not configured
  if (!isValidPostgresUrl(databaseUrl)) {
    if (method === 'GET') {
      return sendJson(res, 200, { success: true, synced: false, offline: true, inventory: [] });
    }
    const body = await parseRequestBody(req);
    return sendJson(res, 200, { success: true, synced: false, offline: true, item: body });
  }

  let sql;
  try {
    sql = neon(databaseUrl.trim());
    await ensureInventoryTable(sql);
  } catch (err) {
    console.warn('[API /api/inventory] Neon connection error:', err);
    return sendJson(res, 200, { success: false, synced: false, offline: true, inventory: [], message: err.message });
  }

  // 1. GET /api/inventory
  if (method === 'GET') {
    try {
      const rows = await sql`
        SELECT 
          id,
          item_name AS "itemName",
          category,
          quantity::float,
          original_quantity::float AS "originalQuantity",
          consumed_quantity::float AS "consumedQuantity",
          wasted_quantity::float AS "wastedQuantity",
          unit,
          purchase_date AS "purchaseDate",
          expiration_date AS "expirationDate",
          storage_location AS "storageLocation",
          source,
          trip_id AS "tripId",
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM household_inventory
        ORDER BY expiration_date ASC NULLS LAST, purchase_date DESC;
      `;
      return sendJson(res, 200, { success: true, synced: true, inventory: rows });
    } catch (err) {
      console.error('[API /api/inventory] Query error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 2. POST /api/inventory (Upsert)
  if (method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const items = Array.isArray(body.items) ? body.items : [body.item || body];

      for (const item of items) {
        if (!item.itemName && !item.name) continue;
        const id = item.id || `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const name = item.itemName || item.name;
        const category = item.category || 'Other Perishables';
        const qty = Number(item.quantity ?? 1);
        const origQty = Number(item.originalQuantity ?? qty);
        const consumed = Number(item.consumedQuantity ?? 0);
        const wasted = Number(item.wastedQuantity ?? 0);
        const unit = item.unit || 'pcs';
        const purchaseDate = item.purchaseDate || new Date().toISOString().split('T')[0];
        const expDate = item.expirationDate || null;
        const location = item.storageLocation || 'Refrigerator';
        const source = item.source || 'manual';
        const tripId = item.tripId || null;
        const notes = item.notes || '';

        await sql`
          INSERT INTO household_inventory (
            id, item_name, category, quantity, original_quantity, consumed_quantity, wasted_quantity,
            unit, purchase_date, expiration_date, storage_location, source, trip_id, notes, updated_at
          ) VALUES (
            ${id}, ${name}, ${category}, ${qty}, ${origQty}, ${consumed}, ${wasted},
            ${unit}, ${purchaseDate}, ${expDate}, ${location}, ${source}, ${tripId}, ${notes}, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            quantity = EXCLUDED.quantity,
            consumed_quantity = EXCLUDED.consumed_quantity,
            wasted_quantity = EXCLUDED.wasted_quantity,
            expiration_date = EXCLUDED.expiration_date,
            storage_location = EXCLUDED.storage_location,
            notes = EXCLUDED.notes,
            updated_at = NOW();
        `;
      }

      return sendJson(res, 200, { success: true, synced: true, count: items.length });
    } catch (err) {
      console.error('[API /api/inventory] Insert error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 3. DELETE /api/inventory
  if (method === 'DELETE') {
    try {
      const query = parseQueryParams(req);
      const body = await parseRequestBody(req);
      const id = query.id || body.id;

      if (!id) {
        return sendJson(res, 400, { success: false, error: 'MISSING_ID' });
      }

      await sql`DELETE FROM household_inventory WHERE id = ${id};`;
      return sendJson(res, 200, { success: true, synced: true, deletedId: id });
    } catch (err) {
      console.error('[API /api/inventory] Delete error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

