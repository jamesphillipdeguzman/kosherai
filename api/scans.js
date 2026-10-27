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
 * Checks whether DATABASE_URL is validly formatted
 */
export function isValidPostgresUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    (trimmed.startsWith('postgres://') || trimmed.startsWith('postgresql://')) &&
    !trimmed.includes('user:password@') &&
    trimmed.length > 15
  );
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

  const method = req.method ? req.method.toUpperCase() : 'GET';
  const databaseUrl = process.env.DATABASE_URL;

  // 1. Guard against unconfigured or invalid DATABASE_URL
  if (!isValidPostgresUrl(databaseUrl)) {
    console.warn('[API /api/scans] DATABASE_URL is not set or invalid. Skipping server-side database persistence.');
    if (method === 'GET') {
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        data: [],
        scans: [],
        message: 'DATABASE_URL is not set. Scan history is managed locally.'
      });
    }
    if (method === 'POST') {
      const body = await parseRequestBody(req);
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'Saved locally only. DATABASE_URL is not set.',
        data: body
      });
    }
    if (method === 'DELETE') {
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'Deleted locally only. DATABASE_URL is not set.'
      });
    }
    return sendJson(res, 200, { synced: false, data: [] });
  }

  let sql;
  try {
    sql = neon(databaseUrl.trim());
    await ensureTable(sql);
  } catch (err) {
    console.warn('[API /api/scans] Neon Connection Error:', err);
    if (method === 'GET') {
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        data: [],
        scans: [],
        message: err.message || 'Database connection failed. Operating in offline mode.'
      });
    }
    if (method === 'POST') {
      const body = await parseRequestBody(req);
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'Saved locally only. Database connection failed.',
        data: body
      });
    }
    if (method === 'DELETE') {
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'Deleted locally only. Database connection failed.'
      });
    }
    return sendJson(res, 200, { synced: false, data: [] });
  }

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
    // POST /api/scans: Accepts scan records OR verified receipt shopping trips
    // ----------------------------------------------------
    if (method === 'POST') {
      const body = await parseRequestBody(req);

      // Check if this payload represents a verified receipt shopping trip
      const isTripPayload = body.type === 'trip' || Boolean(body.trip) || (Boolean(body.storeName) && (body.totalAmountPaid !== undefined || body.totalScaleWeightKg !== undefined));

      if (isTripPayload) {
        const tripData = body.trip || body;
        const rawItems = Array.isArray(body.items) ? body.items : (Array.isArray(tripData.items) ? tripData.items : []);

        const tripId = tripData.id || `trip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const date = tripData.date || new Date().toISOString().split('T')[0];
        const projectWeek = Number(tripData.projectWeek || tripData.project_week || 1);
        const storeName = tripData.storeName || tripData.store_name || 'Supermarket';
        const tripType = tripData.tripType || tripData.trip_type || 'Supermarket';
        const totalAmountPaid = Number(tripData.totalAmountPaid || tripData.total_amount_paid || 0);
        const totalScaleWeightKg = Number(tripData.totalScaleWeightKg || tripData.total_scale_weight_kg || 0);
        const receiptImageUrl = tripData.receiptImageUrl || tripData.receipt_image_url || null;
        const receiptRawText = tripData.receiptRawText || tripData.receipt_raw_text || '';
        const notes = tripData.notes || '';
        const createdAt = tripData.createdAt || tripData.created_at || new Date().toISOString();

        // 1. Insert into shopping_trips
        await sql`
          CREATE TABLE IF NOT EXISTS shopping_trips (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            project_week INTEGER DEFAULT 1,
            store_name TEXT DEFAULT 'Supermarket',
            trip_type TEXT DEFAULT 'Supermarket',
            total_amount_paid NUMERIC(10, 2) DEFAULT 0,
            total_scale_weight_kg NUMERIC(10, 3) DEFAULT 0,
            receipt_image_url TEXT,
            receipt_raw_text TEXT,
            items_count INTEGER DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            synced BOOLEAN DEFAULT TRUE
          );
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS grocery_purchases (
            id TEXT PRIMARY KEY,
            trip_id TEXT NOT NULL REFERENCES shopping_trips(id) ON DELETE CASCADE,
            purchase_date TEXT NOT NULL,
            project_week INTEGER DEFAULT 1,
            name TEXT NOT NULL,
            raw_receipt_text TEXT,
            quantity NUMERIC(10, 2) DEFAULT 1,
            unit TEXT DEFAULT 'pcs',
            unit_price NUMERIC(10, 2) DEFAULT 0,
            total_price NUMERIC(10, 2) DEFAULT 0,
            weight_grams NUMERIC(10, 2) DEFAULT 0,
            category TEXT DEFAULT 'General Food',
            lid_status TEXT DEFAULT 'SAFE',
            lid_reason TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `;

        await sql`
          INSERT INTO shopping_trips (
            id, date, project_week, store_name, trip_type, 
            total_amount_paid, total_scale_weight_kg, 
            receipt_image_url, receipt_raw_text, items_count, 
            notes, created_at, synced
          ) VALUES (
            ${tripId}, ${date}, ${projectWeek}, ${storeName}, ${tripType},
            ${totalAmountPaid}, ${totalScaleWeightKg},
            ${receiptImageUrl}, ${receiptRawText}, ${rawItems.length},
            ${notes}, ${createdAt}, true
          )
          ON CONFLICT (id) DO UPDATE SET
            date = EXCLUDED.date,
            project_week = EXCLUDED.project_week,
            store_name = EXCLUDED.store_name,
            trip_type = EXCLUDED.trip_type,
            total_amount_paid = EXCLUDED.total_amount_paid,
            total_scale_weight_kg = EXCLUDED.total_scale_weight_kg,
            receipt_image_url = EXCLUDED.receipt_image_url,
            receipt_raw_text = EXCLUDED.receipt_raw_text,
            items_count = EXCLUDED.items_count,
            notes = EXCLUDED.notes,
            synced = true;
        `;

        // 2. Batch insert grocery_purchases items
        const savedItems = [];
        if (rawItems && rawItems.length > 0) {
          await sql`DELETE FROM grocery_purchases WHERE trip_id = ${tripId};`;

          for (let idx = 0; idx < rawItems.length; idx++) {
            const item = rawItems[idx];
            const itemId = item.id || `item_${tripId}_${idx}_${Math.random().toString(36).slice(2, 5)}`;
            const itemName = item.name || item.itemName || 'Grocery Item';
            const itemRawText = item.rawReceiptText || item.name || '';
            const quantity = Number(item.quantity || item.qty || 1);
            const unit = item.unit || 'pcs';
            const unitPrice = Number(item.unitPrice || item.price || 0);
            const totalPrice = Number(item.totalPrice || item.total || (quantity * unitPrice));
            const weightGrams = Number(item.weightGrams || item.weightG || 0);
            const category = item.category || 'General Food';
            const lidStatus = item.lidStatus || 'SAFE';
            const lidReason = item.lidReason || '';

            await sql`
              INSERT INTO grocery_purchases (
                id, trip_id, purchase_date, project_week, name,
                raw_receipt_text, quantity, unit, unit_price,
                total_price, weight_grams, category, lid_status, lid_reason, created_at
              ) VALUES (
                ${itemId}, ${tripId}, ${date}, ${projectWeek}, ${itemName},
                ${itemRawText}, ${quantity}, ${unit}, ${unitPrice},
                ${totalPrice}, ${weightGrams}, ${category}, ${lidStatus}, ${lidReason}, ${createdAt}
              )
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                quantity = EXCLUDED.quantity,
                unit = EXCLUDED.unit,
                unit_price = EXCLUDED.unit_price,
                total_price = EXCLUDED.total_price,
                weight_grams = EXCLUDED.weight_grams,
                category = EXCLUDED.category,
                lid_status = EXCLUDED.lid_status,
                lid_reason = EXCLUDED.lid_reason;
            `;

            savedItems.push({
              id: itemId,
              tripId,
              purchaseDate: date,
              projectWeek,
              name: itemName,
              rawReceiptText: itemRawText,
              quantity,
              unit,
              unitPrice,
              totalPrice,
              weightGrams,
              category,
              lidStatus,
              lidReason
            });
          }
        }

        return sendJson(res, 201, {
          success: true,
          synced: true,
          type: 'trip',
          trip: {
            id: tripId,
            date,
            projectWeek,
            storeName,
            tripType,
            totalAmountPaid,
            totalScaleWeightKg,
            receiptImageUrl,
            receiptRawText,
            itemsCount: savedItems.length,
            notes,
            createdAt,
            synced: true,
            items: savedItems
          },
          items: savedItems,
          message: `Verified shopping trip ${tripId} and ${savedItems.length} grocery items recorded to Neon PostgreSQL.`
        });
      }

      // Standard Food Label Scan Persistence
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
    console.warn('[API /api/scans] Query Execution Error:', err);
    if (method === 'GET') {
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        data: [],
        scans: [],
        message: err.message || 'Database not configured or offline'
      });
    }
    if (method === 'POST') {
      const body = await parseRequestBody(req).catch(() => ({}));
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'Saved locally only. Database error occurred.',
        data: body
      });
    }
    if (method === 'DELETE') {
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'Deleted locally only. Database error occurred.'
      });
    }
    return sendJson(res, 200, { synced: false, data: [] });
  }
}
