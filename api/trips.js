// Serverless API Route for Sustaining Human Life Study Shopping Trips & Grocery Purchases
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

let isTablesInitialized = false;

/**
 * Ensures shopping_trips, grocery_purchases, and food_waste_logs tables exist in Neon PostgreSQL
 */
export async function ensureTripsTables(sql) {
  if (isTablesInitialized) return;

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
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      synced BOOLEAN DEFAULT TRUE
    );
  `;

  try {
    await sql`ALTER TABLE shopping_trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
  } catch (_) {}

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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await sql`ALTER TABLE grocery_purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
  } catch (_) {}

  await sql`
    CREATE TABLE IF NOT EXISTS food_waste_logs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      project_week INTEGER DEFAULT 1,
      item_name TEXT NOT NULL,
      measured_weight_g NUMERIC(10, 2) DEFAULT 0,
      is_estimated BOOLEAN DEFAULT FALSE,
      estimated_cost NUMERIC(10, 2) DEFAULT 0,
      reason TEXT DEFAULT 'Spoiled / Molded',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  isTablesInitialized = true;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
 * Primary API Handler for /api/trips
 * Supported Methods:
 * - GET: Returns shopping trips with linked grocery items
 * - POST: Accepts { trip, items } or verified receipt trip, inserts into shopping_trips and batch inserts grocery_purchases
 * - PUT / PATCH: Updates existing shopping_trips record (store_name, total_amount_paid, total_scale_weight_kg, date, notes)
 * - DELETE: Deletes trip by id (cascading to grocery_purchases)
 */
export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.statusCode = 204;
    return res.end();
  }

  const method = req.method ? req.method.toUpperCase() : 'GET';
  const databaseUrl = process.env.DATABASE_URL;

  // Guard against unconfigured or invalid DATABASE_URL
  if (!isValidPostgresUrl(databaseUrl)) {
    console.warn('[API /api/trips] DATABASE_URL is not set or invalid. Skipping server-side database persistence.');
    if (method === 'GET') {
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        trips: [],
        message: 'DATABASE_URL is not configured. Operating in offline/local mode.'
      });
    }
    if (method === 'POST') {
      const body = await parseRequestBody(req);
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'DATABASE_URL is not configured. Trip saved locally in client IndexedDB.',
        trip: body.trip || body,
        items: body.items || []
      });
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = await parseRequestBody(req);
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'DATABASE_URL is not configured. Trip updated locally in client IndexedDB.',
        trip: body.trip || body
      });
    }
    if (method === 'DELETE') {
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'DATABASE_URL is not configured. Deleted locally.'
      });
    }
    return sendJson(res, 200, { synced: false, trips: [] });
  }

  let sql;
  try {
    sql = neon(databaseUrl.trim());
    await ensureTripsTables(sql);
  } catch (err) {
    console.warn('[API /api/trips] Neon Connection Error:', err);
    if (method === 'GET') {
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        trips: [],
        message: err.message || 'Database connection error.'
      });
    }
    if (method === 'POST') {
      const body = await parseRequestBody(req);
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'Database connection failed. Persisting to client IndexedDB with synced: false.',
        trip: body.trip || body,
        items: body.items || []
      });
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = await parseRequestBody(req);
      return sendJson(res, 200, {
        synced: false,
        offline: true,
        message: 'Database connection failed. Persisting to client IndexedDB with synced: false.',
        trip: body.trip || body
      });
    }
    return sendJson(res, 200, { synced: false, trips: [] });
  }

  try {
    // Extract authenticated tenant user (strictly verified via Better Auth session)
    let user = null;
    try {
      const { getAuthenticatedUser } = await import('../lib/auth.ts');
      user = await getAuthenticatedUser(req);
    } catch (_) {}

    const query = parseQueryParams(req);
    const userId = typeof user === 'string' ? user : user?.id;

    if (!userId) {
      return sendJson(res, 401, {
        error: 'UNAUTHORIZED',
        message: 'Authentication required. Please sign in to access tenant data.'
      });
    }

    // ----------------------------------------------------
    // GET /api/trips: Returns trips with linked grocery items
    // ----------------------------------------------------
    if (method === 'GET') {
      const targetTripId = query.id || query.tripId;

      let tripRows = [];
      let purchaseRows = [];

      if (targetTripId) {
        tripRows = await sql`
          SELECT * FROM shopping_trips WHERE id = ${targetTripId} AND user_id = ${userId};
        `;
        purchaseRows = await sql`
          SELECT * FROM grocery_purchases WHERE trip_id = ${targetTripId} AND user_id = ${userId} ORDER BY created_at ASC;
        `;
      } else {
        tripRows = await sql`
          SELECT * FROM shopping_trips WHERE user_id = ${userId} ORDER BY date DESC, created_at DESC LIMIT 1000;
        `;
        purchaseRows = await sql`
          SELECT * FROM grocery_purchases WHERE user_id = ${userId} ORDER BY created_at ASC;
        `;
      }

      // Group purchases by trip_id
      const itemsByTrip = new Map();
      for (const p of purchaseRows) {
        const tId = p.trip_id;
        if (!itemsByTrip.has(tId)) itemsByTrip.set(tId, []);
        itemsByTrip.get(tId).push({
          id: p.id,
          tripId: p.trip_id,
          purchaseDate: p.purchase_date,
          projectWeek: Number(p.project_week || 1),
          name: p.name,
          rawReceiptText: p.raw_receipt_text || '',
          quantity: Number(p.quantity || 1),
          unit: p.unit || 'pcs',
          unitPrice: Number(p.unit_price || 0),
          totalPrice: Number(p.total_price || 0),
          weightGrams: Number(p.weight_grams || 0),
          category: p.category || 'General Food',
          lidStatus: p.lid_status || 'SAFE',
          lidReason: p.lid_reason || ''
        });
      }

      const formattedTrips = tripRows.map(row => ({
        id: row.id,
        date: row.date,
        projectWeek: Number(row.project_week || 1),
        storeName: row.store_name || 'Supermarket',
        tripType: row.trip_type || 'Supermarket',
        totalAmountPaid: Number(row.total_amount_paid || 0),
        totalScaleWeightKg: Number(row.total_scale_weight_kg || 0),
        receiptImageUrl: row.receipt_image_url || null,
        receiptRawText: row.receipt_raw_text || '',
        itemsCount: Number(row.items_count || (itemsByTrip.get(row.id)?.length || 0)),
        notes: row.notes || '',
        createdAt: row.created_at,
        synced: true,
        items: itemsByTrip.get(row.id) || []
      }));

      return sendJson(res, 200, {
        success: true,
        synced: true,
        trips: formattedTrips
      });
    }

    // ----------------------------------------------------
    // POST /api/trips: Insert shopping_trips and batch insert grocery_purchases
    // ----------------------------------------------------
    if (method === 'POST') {
      const body = await parseRequestBody(req);

      // Check if this is a food waste sync action delegated to /api/trips
      if (body.type === 'food_waste' || body.action === 'food_waste' || body.foodWaste) {
        const wasteData = body.foodWaste || body.waste || body;
        const wasteId = wasteData.id || `waste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const wDate = wasteData.date || new Date().toISOString().split('T')[0];
        const wWeek = Number(wasteData.projectWeek || wasteData.project_week || 1);
        const wItem = wasteData.itemName || wasteData.item_name || 'Food Waste';
        const wWeight = Number(wasteData.measuredWeightG || wasteData.measured_weight_g || 0);
        const wEst = Boolean(wasteData.isEstimated ?? wasteData.is_estimated);
        const wCost = Number(wasteData.estimatedCost || wasteData.estimated_cost || 0);
        const wReason = wasteData.reason || 'Spoiled / Molded';
        const wNotes = wasteData.notes || '';

        await sql`
          INSERT INTO food_waste_logs (
            id, user_id, date, project_week, item_name, measured_weight_g,
            is_estimated, estimated_cost, reason, notes, created_at
          ) VALUES (
            ${wasteId}, ${userId}, ${wDate}, ${wWeek}, ${wItem}, ${wWeight},
            ${wEst}, ${wCost}, ${wReason}, ${wNotes}, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
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
          id: wasteId,
          message: `Food waste entry ${wasteId} saved to Neon PostgreSQL.`
        });
      }

      const tripData = body.trip || body;
      const rawItems = (
        (Array.isArray(body.items) && body.items.length > 0 ? body.items : null) ||
        (Array.isArray(body.rawItems) && body.rawItems.length > 0 ? body.rawItems : null) ||
        (Array.isArray(body.extractedItems) && body.extractedItems.length > 0 ? body.extractedItems : null) ||
        (Array.isArray(body.groceryItems) && body.groceryItems.length > 0 ? body.groceryItems : null) ||
        (Array.isArray(tripData.items) && tripData.items.length > 0 ? tripData.items : null) ||
        (Array.isArray(tripData.rawItems) && tripData.rawItems.length > 0 ? tripData.rawItems : null) ||
        (Array.isArray(tripData.extractedItems) && tripData.extractedItems.length > 0 ? tripData.extractedItems : null) ||
        (Array.isArray(tripData.groceryItems) && tripData.groceryItems.length > 0 ? tripData.groceryItems : null) ||
        []
      );

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

      // 1. Insert into shopping_trips (Strict user_id scoped)
      await sql`
        INSERT INTO shopping_trips (
          id, user_id, date, project_week, store_name, trip_type, 
          total_amount_paid, total_scale_weight_kg, 
          receipt_image_url, receipt_raw_text, items_count, 
          notes, created_at, synced
        ) VALUES (
          ${tripId}, ${userId}, ${date}, ${projectWeek}, ${storeName}, ${tripType},
          ${totalAmountPaid}, ${totalScaleWeightKg},
          ${receiptImageUrl}, ${receiptRawText}, ${rawItems.length},
          ${notes}, ${createdAt}, true
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
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

      // 2. Batch insert linked grocery_purchases items
      const savedItems = [];
      if (rawItems && rawItems.length > 0) {
        // Clean out existing purchases for idempotent replacement on edits
        await sql`DELETE FROM grocery_purchases WHERE trip_id = ${tripId} AND user_id = ${userId};`;

        for (let idx = 0; idx < rawItems.length; idx++) {
          const item = rawItems[idx];
          const itemId = item.id || `item_${tripId}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
          const itemName = item.name || item.itemName || item.description || 'Grocery Item';
          const itemRawText = item.rawReceiptText || item.name || '';
          const quantity = Number(item.quantity || item.qty || 1);
          const unit = item.unit || 'pcs';
          const unitPrice = Number(item.unitPrice || item.price || 0);
          const totalPrice = Number(item.totalPrice || item.lineTotal || (quantity * unitPrice));
          const weightGrams = Number(item.weightGrams || item.weightG || 0);
          const category = item.category || 'General Food';
          const lidStatus = item.lidStatus || 'SAFE';
          const lidReason = item.lidReason || '';

          await sql`
            INSERT INTO grocery_purchases (
              id, user_id, trip_id, purchase_date, project_week, name,
              raw_receipt_text, quantity, unit, unit_price,
              total_price, weight_grams, category, lid_status, lid_reason, created_at
            ) VALUES (
              ${itemId}, ${userId}, ${tripId}, ${date}, ${projectWeek}, ${itemName},
              ${itemRawText}, ${quantity}, ${unit}, ${unitPrice},
              ${totalPrice}, ${weightGrams}, ${category}, ${lidStatus}, ${lidReason}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              user_id = EXCLUDED.user_id,
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

      const savedTrip = {
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
      };

      return sendJson(res, 201, {
        success: true,
        synced: true,
        trip: savedTrip,
        items: savedItems,
        message: `Shopping trip ${tripId} and ${savedItems.length} grocery items saved to Neon PostgreSQL.`
      });
    }

    // ----------------------------------------------------
    // PUT / PATCH /api/trips: Updates an existing shopping trip (Scoped to user_id)
    // ----------------------------------------------------
    if (method === 'PUT' || method === 'PATCH') {
      const query = parseQueryParams(req);
      const body = await parseRequestBody(req);
      const tripData = body.trip || body;
      const targetId = query.id || query.tripId || tripData.id || tripData.tripId;

      if (!targetId) {
        return sendJson(res, 400, { error: 'MISSING_ID', message: 'Trip ID is required for update.' });
      }

      // Fetch existing record to ensure ownership and fallback values
      const existingRows = await sql`
        SELECT * FROM shopping_trips WHERE id = ${targetId} AND user_id = ${userId} LIMIT 1;
      `;

      if (!existingRows || existingRows.length === 0) {
        return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Shopping trip not found or unauthorized.' });
      }

      const current = existingRows[0];
      const storeName = tripData.storeName !== undefined ? tripData.storeName : (tripData.store_name !== undefined ? tripData.store_name : current.store_name);
      const totalAmountPaid = tripData.totalAmountPaid !== undefined ? Number(tripData.totalAmountPaid) : (tripData.total_amount_paid !== undefined ? Number(tripData.total_amount_paid) : Number(current.total_amount_paid || 0));
      const totalScaleWeightKg = tripData.totalScaleWeightKg !== undefined ? Number(tripData.totalScaleWeightKg) : (tripData.total_scale_weight_kg !== undefined ? Number(tripData.total_scale_weight_kg) : Number(current.total_scale_weight_kg || 0));
      const date = tripData.date !== undefined ? tripData.date : current.date;
      const notes = tripData.notes !== undefined ? tripData.notes : (current.notes || '');
      const tripType = tripData.tripType !== undefined ? tripData.tripType : (tripData.trip_type !== undefined ? tripData.trip_type : current.trip_type);
      const projectWeek = tripData.projectWeek !== undefined ? Number(tripData.projectWeek) : (tripData.project_week !== undefined ? Number(tripData.project_week) : Number(current.project_week || 1));

      // Execute UPDATE shopping_trips SET store_name = $1, total_amount_paid = $2, total_scale_weight_kg = $3, date = $4, notes = $5, updated_at = NOW() WHERE id = $6 AND user_id = $7
      const updatedRows = await sql`
        UPDATE shopping_trips 
        SET store_name = ${storeName},
            total_amount_paid = ${totalAmountPaid},
            total_scale_weight_kg = ${totalScaleWeightKg},
            date = ${date},
            notes = ${notes},
            trip_type = ${tripType},
            project_week = ${projectWeek},
            updated_at = NOW()
        WHERE id = ${targetId} AND user_id = ${userId}
        RETURNING *;
      `;

      const row = updatedRows[0] || {
        ...current,
        store_name: storeName,
        total_amount_paid: totalAmountPaid,
        total_scale_weight_kg: totalScaleWeightKg,
        date,
        notes,
        trip_type: tripType,
        project_week: projectWeek
      };

      // Update grocery_purchases if itemName or items provided
      const itemName = tripData.itemName || tripData.item_name || body.itemName || body.item_name || null;
      const rawItems = (Array.isArray(body.items) && body.items.length > 0) ? body.items : (Array.isArray(tripData.items) ? tripData.items : null);

      if (rawItems && rawItems.length > 0) {
        for (const item of rawItems) {
          if (item.id && item.name) {
            const iQty = item.quantity !== undefined ? Number(item.quantity) : 1;
            const iUnit = item.unit || 'pcs';
            await sql`
              UPDATE grocery_purchases
              SET name = ${item.name},
                  raw_receipt_text = ${item.name},
                  quantity = ${iQty},
                  unit = ${iUnit},
                  updated_at = NOW()
              WHERE id = ${item.id} AND trip_id = ${targetId} AND user_id = ${userId};
            `;
          }
        }
      }

      if (itemName) {
        await sql`
          UPDATE grocery_purchases 
          SET name = ${itemName}, raw_receipt_text = ${itemName}, updated_at = NOW() 
          WHERE trip_id = ${targetId} AND user_id = ${userId};
        `;
      }

      // Query updated purchases for this trip to return in response
      const updatedPurchases = await sql`
        SELECT * FROM grocery_purchases WHERE trip_id = ${targetId} AND user_id = ${userId} ORDER BY created_at ASC;
      `;

      const formattedItems = updatedPurchases.map(p => ({
        id: p.id,
        tripId: p.trip_id,
        purchaseDate: p.purchase_date,
        projectWeek: Number(p.project_week || 1),
        name: p.name,
        rawReceiptText: p.raw_receipt_text || '',
        quantity: Number(p.quantity || 1),
        unit: p.unit || 'pcs',
        unitPrice: Number(p.unit_price || 0),
        totalPrice: Number(p.total_price || 0),
        weightGrams: Number(p.weight_grams || 0),
        category: p.category || 'General Food',
        lidStatus: p.lid_status || 'SAFE',
        lidReason: p.lid_reason || ''
      }));

      const updatedTrip = {
        id: row.id,
        date: row.date,
        projectWeek: Number(row.project_week || 1),
        storeName: row.store_name || 'Supermarket',
        tripType: row.trip_type || 'Supermarket',
        totalAmountPaid: Number(row.total_amount_paid || 0),
        totalScaleWeightKg: Number(row.total_scale_weight_kg || 0),
        receiptImageUrl: row.receipt_image_url || null,
        receiptRawText: row.receipt_raw_text || '',
        itemsCount: formattedItems.length || Number(row.items_count || 0),
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        synced: true,
        items: formattedItems
      };

      return sendJson(res, 200, {
        success: true,
        synced: true,
        trip: updatedTrip,
        items: formattedItems,
        message: `Shopping trip ${targetId} and grocery purchases updated successfully in Neon PostgreSQL.`
      });
    }

    // ----------------------------------------------------
    // DELETE /api/trips: Deletes trip and cascades to purchases (Scoped to user_id)
    // ----------------------------------------------------
    if (method === 'DELETE') {
      const query = parseQueryParams(req);
      const body = await parseRequestBody(req);
      const targetId = query.id || body.id;

      if (!targetId) {
        return sendJson(res, 400, { error: 'MISSING_ID', message: 'Trip ID is required for deletion.' });
      }

      await sql`DELETE FROM grocery_purchases WHERE trip_id = ${targetId} AND user_id = ${userId};`;
      await sql`DELETE FROM shopping_trips WHERE id = ${targetId} AND user_id = ${userId};`;
      return sendJson(res, 200, {
        success: true,
        deletedId: targetId,
        message: `Shopping trip ${targetId} deleted from Neon PostgreSQL.`
      });
    }

    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: `Method ${method} is not supported.` });
  } catch (err) {
    console.error('[API /api/trips] Database Execution Error:', err);
    return sendJson(res, 200, {
      synced: false,
      offline: true,
      message: err.message || 'Database error occurred. Saved locally in client IndexedDB.'
    });
  }
}
