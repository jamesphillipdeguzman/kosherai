// Serverless API Route for Sustaining Human Life Study Shopping Trips & Grocery Purchases
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { getAuthenticatedUser, setCorsHeaders } from '../lib/auth.js';

let isTablesInitialized = false;

/**
 * Ensures shopping_trips, grocery_purchases, and food_waste_logs tables exist in Neon PostgreSQL
 */
export async function ensureTripsTables(sql) {
  if (isTablesInitialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS shopping_trips (
      id TEXT PRIMARY KEY,
      user_id TEXT,
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
      is_draft BOOLEAN DEFAULT FALSE,
      synced BOOLEAN DEFAULT TRUE
    );
  `;

  try {
    await sql`ALTER TABLE shopping_trips ADD COLUMN IF NOT EXISTS user_id TEXT;`;
    await sql`ALTER TABLE shopping_trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
    await sql`ALTER TABLE shopping_trips ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;`;
  } catch (_) {}

  await sql`
    CREATE TABLE IF NOT EXISTS grocery_purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT,
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
    await sql`ALTER TABLE grocery_purchases ADD COLUMN IF NOT EXISTS user_id TEXT;`;
    await sql`ALTER TABLE grocery_purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
  } catch (_) {}

  await sql`
    CREATE TABLE IF NOT EXISTS food_waste_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
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

  try {
    await sql`ALTER TABLE food_waste_logs ADD COLUMN IF NOT EXISTS user_id TEXT;`;
    await sql`ALTER TABLE food_waste_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
  } catch (_) {}

  // Server-side tombstone table to prevent deleted records from being resurrected by stale devices
  await sql`
    CREATE TABLE IF NOT EXISTS deleted_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      record_type TEXT NOT NULL DEFAULT 'trip',
      deleted_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_deleted_records_user ON deleted_records(user_id);`;
  } catch (_) {}

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
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
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
      user = await getAuthenticatedUser(req);
    } catch (authErr) {
      console.warn('[API /api/trips] Authentication check error:', authErr);
    }

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
          price: Number(p.unit_price || 0),
          totalPrice: Number(p.total_price || 0),
          lineTotal: Number(p.total_price || 0),
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
        isDraft: Boolean(row.is_draft),
        is_draft: Boolean(row.is_draft),
        synced: true,
        items: itemsByTrip.get(row.id) || []
      }));

      // Fetch recent deleted tombstones for this tenant user so clients can purge them locally
      let deletedIds = [];
      try {
        const deletedRows = await sql`
          SELECT id FROM deleted_records WHERE user_id = ${userId} ORDER BY deleted_at DESC LIMIT 1000;
        `;
        deletedIds = deletedRows.map(r => r.id);
      } catch (delFetchErr) {
        console.warn('[API /api/trips] Error fetching deleted_records tombstones:', delFetchErr.message);
      }

      return sendJson(res, 200, {
        success: true,
        synced: true,
        trips: formattedTrips,
        deletedIds
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

      // Check if this payload is a standalone expense
      if (body.type === 'expense' || body.action === 'expense' || body.expense || (body.trip && body.trip.type === 'expense') || (body.isTripExpense === false && typeof body.id === 'string' && body.id.startsWith('exp_'))) {
        const expData = body.expense || body.trip || body;
        const expId = expData.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const expDate = expData.date || new Date().toISOString().split('T')[0];
        const expWeek = Number(expData.projectWeek || expData.project_week || 1);
        const expVendor = expData.vendor || expData.storeName || expData.store_name || 'Food Purchase';
        const expCategory = expData.category || expData.tripType || expData.trip_type || 'Wet Market / Other';
        const expAmount = Number(expData.amount || expData.totalAmountPaid || expData.total_amount_paid || 0);
        const expNotes = expData.notes || '[Standalone Expense]';

        await sql`
          INSERT INTO shopping_trips (
            id, user_id, date, project_week, store_name, trip_type, 
            total_amount_paid, total_scale_weight_kg, 
            receipt_image_url, receipt_raw_text, items_count, 
            notes, created_at, synced
          ) VALUES (
            ${expId}, ${userId}, ${expDate}, ${expWeek}, ${expVendor}, ${expCategory},
            ${expAmount}, 0,
            null, '', 0,
            ${expNotes}, NOW(), true
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            date = EXCLUDED.date,
            project_week = EXCLUDED.project_week,
            store_name = EXCLUDED.store_name,
            trip_type = EXCLUDED.trip_type,
            total_amount_paid = EXCLUDED.total_amount_paid,
            notes = EXCLUDED.notes,
            synced = true;
        `;

        return sendJson(res, 201, {
          success: true,
          synced: true,
          id: expId,
          expense: {
            id: expId,
            date: expDate,
            projectWeek: expWeek,
            vendor: expVendor,
            category: expCategory,
            amount: expAmount,
            isTripExpense: false,
            notes: expNotes,
            synced: true
          },
          message: `Standalone expense ${expId} saved to Neon PostgreSQL.`
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
      const isDraft = Boolean(tripData.isDraft ?? tripData.is_draft ?? false);

      // Check tombstone: reject resurrection of deleted trips from stale devices
      try {
        const tombstone = await sql`
          SELECT id FROM deleted_records WHERE id = ${tripId} AND user_id = ${userId} LIMIT 1;
        `;
        if (tombstone && tombstone.length > 0) {
          console.info(`[API /api/trips] Skipping re-insertion of deleted trip ${tripId} to prevent resurrection.`);
          return sendJson(res, 200, {
            success: true,
            deleted: true,
            skipped: true,
            trip: { id: tripId, deleted: true },
            message: `Trip ${tripId} was previously deleted. Re-insertion ignored to prevent resurrection.`
          });
        }
      } catch (tombErr) {
        console.warn('[API /api/trips] Tombstone check error:', tombErr.message);
      }

      // 1. Insert into shopping_trips (Strict user_id scoped)
      await sql`
        INSERT INTO shopping_trips (
          id, user_id, date, project_week, store_name, trip_type, 
          total_amount_paid, total_scale_weight_kg, 
          receipt_image_url, receipt_raw_text, items_count, 
          notes, created_at, is_draft, synced
        ) VALUES (
          ${tripId}, ${userId}, ${date}, ${projectWeek}, ${storeName}, ${tripType},
          ${totalAmountPaid}, ${totalScaleWeightKg},
          ${receiptImageUrl}, ${receiptRawText}, ${rawItems.length},
          ${notes}, ${createdAt}, ${isDraft}, true
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
          is_draft = EXCLUDED.is_draft,
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

          // Check if this specific item was tombstoned
          try {
            const itemTomb = await sql`SELECT id FROM deleted_records WHERE id = ${itemId} AND user_id = ${userId} LIMIT 1;`;
            if (itemTomb && itemTomb.length > 0) continue;
          } catch (_) {}
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
        isDraft,
        is_draft: isDraft,
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
      const targetId = query.id || query.tripId || tripData.id || tripData.tripId || body.tripId;

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
      const storeName = tripData.storeName !== undefined
        ? tripData.storeName
        : (tripData.store_name !== undefined ? tripData.store_name : null);

      const date = tripData.date !== undefined ? tripData.date : null;

      const tripType = tripData.tripType !== undefined
        ? tripData.tripType
        : (tripData.trip_type !== undefined ? tripData.trip_type : null);

      const totalScaleWeightKg = (tripData.totalScaleWeightKg !== undefined && tripData.totalScaleWeightKg !== null && tripData.totalScaleWeightKg !== '')
        ? Number(tripData.totalScaleWeightKg)
        : ((tripData.total_scale_weight_kg !== undefined && tripData.total_scale_weight_kg !== null && tripData.total_scale_weight_kg !== '')
          ? Number(tripData.total_scale_weight_kg)
          : null);

      const totalAmountPaid = (tripData.totalAmountPaid !== undefined && tripData.totalAmountPaid !== null && tripData.totalAmountPaid !== '')
        ? Number(tripData.totalAmountPaid)
        : ((tripData.total_amount_paid !== undefined && tripData.total_amount_paid !== null && tripData.total_amount_paid !== '')
          ? Number(tripData.total_amount_paid)
          : null);

      const notes = tripData.notes !== undefined ? tripData.notes : null;
      const isDraftVal = (tripData.isDraft !== undefined || tripData.is_draft !== undefined)
        ? Boolean(tripData.isDraft ?? tripData.is_draft)
        : null;

      const hasReceiptImageUrl = tripData.receiptImageUrl !== undefined || tripData.receipt_image_url !== undefined || body.receiptImageUrl !== undefined;
      const receiptImageUrlVal = tripData.receiptImageUrl !== undefined
        ? tripData.receiptImageUrl
        : (tripData.receipt_image_url !== undefined ? tripData.receipt_image_url : (body.receiptImageUrl !== undefined ? body.receiptImageUrl : null));

      // 1. Update shopping_trips using parameterized COALESCE query
      const updatedRows = hasReceiptImageUrl
        ? await sql`
            UPDATE shopping_trips 
            SET 
              store_name = COALESCE(${storeName}, store_name),
              date = COALESCE(${date}, date),
              trip_type = COALESCE(${tripType}, trip_type),
              total_scale_weight_kg = COALESCE(${totalScaleWeightKg}, total_scale_weight_kg),
              total_amount_paid = COALESCE(${totalAmountPaid}, total_amount_paid),
              notes = COALESCE(${notes}, notes),
              is_draft = COALESCE(${isDraftVal}, is_draft),
              receipt_image_url = ${receiptImageUrlVal},
              updated_at = NOW()
            WHERE id = ${targetId} AND user_id = ${userId}
            RETURNING *;
          `
        : await sql`
            UPDATE shopping_trips 
            SET 
              store_name = COALESCE(${storeName}, store_name),
              date = COALESCE(${date}, date),
              trip_type = COALESCE(${tripType}, trip_type),
              total_scale_weight_kg = COALESCE(${totalScaleWeightKg}, total_scale_weight_kg),
              total_amount_paid = COALESCE(${totalAmountPaid}, total_amount_paid),
              notes = COALESCE(${notes}, notes),
              is_draft = COALESCE(${isDraftVal}, is_draft),
              updated_at = NOW()
            WHERE id = ${targetId} AND user_id = ${userId}
            RETURNING *;
          `;

      const row = (updatedRows && updatedRows[0]) || current;

      // 2. Extract item details
      const rawItemName = tripData.itemName || tripData.item_name || body.itemName || body.item_name || null;
      const cleanItemName = rawItemName ? String(rawItemName).trim() : null;

      const rawQuantity = tripData.quantity !== undefined
        ? tripData.quantity
        : (body.quantity !== undefined
          ? body.quantity
          : (tripData.itemQuantity !== undefined
            ? tripData.itemQuantity
            : (tripData.itemQty !== undefined ? tripData.itemQty : null)));
      const cleanQuantity = (rawQuantity !== null && rawQuantity !== undefined && rawQuantity !== '' && !isNaN(Number(rawQuantity)))
        ? Number(rawQuantity)
        : null;

      const rawUnit = tripData.unit || body.unit || tripData.itemUnit || null;
      const cleanUnit = rawUnit ? String(rawUnit).trim() : null;

      const rawPrice = tripData.price !== undefined
        ? tripData.price
        : (body.price !== undefined
          ? body.price
          : (tripData.unitPrice !== undefined ? tripData.unitPrice : (body.unitPrice !== undefined ? body.unitPrice : null)));
      const cleanUnitPrice = (rawPrice !== null && rawPrice !== undefined && rawPrice !== '' && !isNaN(Number(rawPrice)))
        ? Number(rawPrice)
        : null;

      const rawTotal = tripData.totalPrice !== undefined
        ? tripData.totalPrice
        : (body.totalPrice !== undefined
          ? body.totalPrice
          : (tripData.lineTotal !== undefined ? tripData.lineTotal : (body.lineTotal !== undefined ? body.lineTotal : null)));
      const cleanTotalPrice = (rawTotal !== null && rawTotal !== undefined && rawTotal !== '' && !isNaN(Number(rawTotal)))
        ? Number(rawTotal)
        : ((cleanUnitPrice !== null && cleanQuantity !== null) ? Math.round(cleanUnitPrice * cleanQuantity * 100) / 100 : null);

      // If itemName, quantity, unit, price or totalPrice are supplied, update grocery_purchases linked to that tripId
      if (cleanItemName !== null || cleanQuantity !== null || cleanUnit !== null || cleanUnitPrice !== null || cleanTotalPrice !== null) {
        await sql`
          UPDATE grocery_purchases 
          SET 
            name = COALESCE(${cleanItemName}, name), 
            raw_receipt_text = COALESCE(${cleanItemName}, raw_receipt_text), 
            quantity = COALESCE(${cleanQuantity}, quantity),
            unit = COALESCE(${cleanUnit}, unit),
            unit_price = COALESCE(${cleanUnitPrice}, unit_price),
            total_price = COALESCE(${cleanTotalPrice}, total_price),
            updated_at = NOW() 
          WHERE trip_id = ${targetId} AND user_id = ${userId};
        `;
      }

      // Also support batch items update if items array provided
      const rawItems = (Array.isArray(body.items) && body.items.length > 0) ? body.items : (Array.isArray(tripData.items) ? tripData.items : null);
      if (rawItems && rawItems.length > 0) {
        for (let idx = 0; idx < rawItems.length; idx++) {
          const item = rawItems[idx];
          const itemId = item.id || `item_${targetId}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
          const iName = item.name ? String(item.name).trim() : null;
          const iQty = (item.quantity !== undefined && item.quantity !== null && !isNaN(Number(item.quantity))) ? Number(item.quantity) : null;
          const iUnit = item.unit ? String(item.unit).trim() : null;
          const rawItemPrice = item.price !== undefined ? item.price : (item.unitPrice !== undefined ? item.unitPrice : null);
          const iUnitPrice = (rawItemPrice !== null && rawItemPrice !== undefined && rawItemPrice !== '' && !isNaN(Number(rawItemPrice))) ? Number(rawItemPrice) : null;
          const rawItemTotal = item.totalPrice !== undefined ? item.totalPrice : (item.lineTotal !== undefined ? item.lineTotal : null);
          const iTotalPrice = (rawItemTotal !== null && rawItemTotal !== undefined && rawItemTotal !== '' && !isNaN(Number(rawItemTotal)))
            ? Number(rawItemTotal)
            : ((iUnitPrice !== null && iQty !== null) ? Math.round(iUnitPrice * iQty * 100) / 100 : null);

          const itemDate = row.date;
          const itemWeek = Number(row.project_week || 1);

          await sql`
            INSERT INTO grocery_purchases (
              id, user_id, trip_id, purchase_date, project_week, name,
              raw_receipt_text, quantity, unit, unit_price,
              total_price, weight_grams, category, lid_status, lid_reason, created_at, updated_at
            ) VALUES (
              ${itemId}, ${userId}, ${targetId}, ${itemDate}, ${itemWeek}, ${iName || 'Grocery Item'},
              ${iName || 'Grocery Item'}, ${iQty || 1}, ${iUnit || 'pcs'}, ${iUnitPrice || 0},
              ${iTotalPrice || 0}, ${Number(item.weightGrams || 0)}, ${item.category || 'General Food'},
              ${item.lidStatus || 'SAFE'}, ${item.lidReason || ''}, NOW(), NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              user_id = EXCLUDED.user_id,
              name = COALESCE(${iName}, grocery_purchases.name),
              raw_receipt_text = COALESCE(${iName}, grocery_purchases.raw_receipt_text),
              quantity = COALESCE(${iQty}, grocery_purchases.quantity),
              unit = COALESCE(${iUnit}, grocery_purchases.unit),
              unit_price = COALESCE(${iUnitPrice}, grocery_purchases.unit_price),
              total_price = COALESCE(${iTotalPrice}, grocery_purchases.total_price),
              updated_at = NOW();
          `;
        }
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
        price: Number(p.unit_price || 0),
        totalPrice: Number(p.total_price || 0),
        lineTotal: Number(p.total_price || 0),
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
        isDraft: Boolean(row.is_draft),
        is_draft: Boolean(row.is_draft),
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
    // Supports deleting whole trip (default) or individual grocery item (type='grocery')
    // Permanently records tombstones in deleted_records to prevent resurrection
    // ----------------------------------------------------
    if (method === 'DELETE') {
      const query = parseQueryParams(req);
      const body = await parseRequestBody(req);
      const targetId = query.id || body.id;
      const recordType = query.type || body.type || 'trip';

      if (!targetId) {
        return sendJson(res, 400, { error: 'MISSING_ID', message: 'Target ID is required for deletion.' });
      }

      if (recordType === 'grocery' || recordType === 'item') {
        // 1. Tombstone the grocery item
        await sql`
          INSERT INTO deleted_records (id, user_id, record_type, deleted_at)
          VALUES (${targetId}, ${userId}, 'grocery', NOW())
          ON CONFLICT (id) DO UPDATE SET deleted_at = NOW();
        `;
        // 2. Delete grocery purchase
        await sql`DELETE FROM grocery_purchases WHERE id = ${targetId} AND user_id = ${userId};`;

        return sendJson(res, 200, {
          success: true,
          deletedId: targetId,
          recordType: 'grocery',
          message: `Grocery item ${targetId} deleted and tombstoned in Neon PostgreSQL.`
        });
      }

      // Whole trip deletion:
      // 1. Tombstone all linked grocery items
      await sql`
        INSERT INTO deleted_records (id, user_id, record_type, deleted_at)
        SELECT id, ${userId}, 'grocery', NOW() FROM grocery_purchases WHERE trip_id = ${targetId} AND user_id = ${userId}
        ON CONFLICT (id) DO UPDATE SET deleted_at = NOW();
      `;

      // 2. Tombstone the trip itself
      await sql`
        INSERT INTO deleted_records (id, user_id, record_type, deleted_at)
        VALUES (${targetId}, ${userId}, 'trip', NOW())
        ON CONFLICT (id) DO UPDATE SET deleted_at = NOW();
      `;

      // 3. Cascade delete from Neon tables
      await sql`DELETE FROM grocery_purchases WHERE trip_id = ${targetId} AND user_id = ${userId};`;
      await sql`DELETE FROM shopping_trips WHERE id = ${targetId} AND user_id = ${userId};`;

      return sendJson(res, 200, {
        success: true,
        deletedId: targetId,
        recordType: 'trip',
        message: `Shopping trip ${targetId} and linked items deleted and tombstoned in Neon PostgreSQL.`
      });
    }

    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: `Method ${method} is not supported.` });
  } catch (err) {
    console.error('[API /api/trips] Database Execution Error:', err);
    return sendJson(res, 500, {
      success: false,
      synced: false,
      offline: false,
      message: err.message || 'Database error occurred. Saved locally in client IndexedDB.'
    });
  }
}
