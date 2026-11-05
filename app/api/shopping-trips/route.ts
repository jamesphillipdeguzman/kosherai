import { getAuthenticatedUser } from '../../../lib/auth';
import { headers } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

/**
 * Tenant-Scoped Shopping Trips & Purchases API
 * Strict user_id enforcement on both GET and POST
 */
export async function GET(request: Request) {
  const reqHeaders = await headers();
  const user = await getAuthenticatedUser(reqHeaders);

  if (!user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required to view shopping trips.' },
      { status: 401 }
    );
  }

  const userId = user.id;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return NextResponse.json({ success: false, trips: [], offline: true });
  }

  try {
    const sql = neon(databaseUrl);
    const { searchParams } = new URL(request.url);
    const targetTripId = searchParams.get('id') || searchParams.get('tripId');

    let tripRows = [];
    let purchaseRows = [];

    if (targetTripId) {
      tripRows = await sql`
        SELECT * FROM shopping_trips 
        WHERE id = ${targetTripId} AND user_id = ${userId};
      `;
      purchaseRows = await sql`
        SELECT * FROM grocery_purchases 
        WHERE trip_id = ${targetTripId} AND user_id = ${userId} 
        ORDER BY created_at ASC;
      `;
    } else {
      tripRows = await sql`
        SELECT * FROM shopping_trips 
        WHERE user_id = ${userId} 
        ORDER BY date DESC, created_at DESC;
      `;
      purchaseRows = await sql`
        SELECT * FROM grocery_purchases 
        WHERE user_id = ${userId} 
        ORDER BY created_at ASC;
      `;
    }

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
      userId: row.user_id,
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

    return NextResponse.json({
      success: true,
      userId,
      trips: formattedTrips
    });
  } catch (err: any) {
    console.error('Error fetching tenant shopping trips:', err);
    return NextResponse.json({ error: 'Database error', message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const reqHeaders = await headers();
  const user = await getAuthenticatedUser(reqHeaders);

  if (!user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required to save shopping trips.' },
      { status: 401 }
    );
  }

  const userId = user.id;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const sql = neon(databaseUrl);

    const tripData = body.trip || body;
    const rawItems = (
      (Array.isArray(body.items) && body.items.length > 0 ? body.items : null) ||
      (Array.isArray(tripData.items) && tripData.items.length > 0 ? tripData.items : null) ||
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

    // 1. Force user_id = userId in shopping_trips insert
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
        ${notes}, NOW(), true
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

    // 2. Ensure all nested rows inserted into grocery_purchases include user_id = userId
    await sql`DELETE FROM grocery_purchases WHERE trip_id = ${tripId} AND user_id = ${userId};`;

    const savedItems = [];
    for (let idx = 0; idx < rawItems.length; idx++) {
      const item = rawItems[idx];
      const itemId = item.id || `item_${tripId}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
      const itemName = item.name || item.itemName || 'Grocery Item';
      const itemRawText = item.rawReceiptText || item.name || '';
      const quantity = Number(item.quantity || 1);
      const unit = item.unit || 'pcs';
      const unitPrice = Number(item.unitPrice || 0);
      const totalPrice = Number(item.totalPrice || (quantity * unitPrice));
      const weightGrams = Number(item.weightGrams || 0);
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
        userId,
        tripId,
        name: itemName,
        totalPrice
      });
    }

    return NextResponse.json({
      success: true,
      synced: true,
      userId,
      trip: {
        id: tripId,
        userId,
        itemsCount: savedItems.length,
        totalAmountPaid
      }
    });
  } catch (err: any) {
    console.error('Error saving tenant shopping trip:', err);
    return NextResponse.json({ error: 'Insert error', message: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const reqHeaders = await headers();
  const user = await getAuthenticatedUser(reqHeaders);

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return NextResponse.json({ success: false });

  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get('id') || searchParams.get('tripId');
  if (!tripId) return NextResponse.json({ error: 'Trip ID required' }, { status: 400 });

  const sql = neon(databaseUrl);
  await sql`DELETE FROM grocery_purchases WHERE trip_id = ${tripId} AND user_id = ${userId};`;
  await sql`DELETE FROM shopping_trips WHERE id = ${tripId} AND user_id = ${userId};`;

  return NextResponse.json({ success: true, deletedId: tripId });
}

