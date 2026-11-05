import { getAuthenticatedUser } from '../../../lib/auth';
import { headers } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

/**
 * Tenant-Scoped Food Waste Logs API
 * Enforces user_id filtering and insertion
 */
export async function GET(request: Request) {
  const reqHeaders = await headers();
  const user = await getAuthenticatedUser(reqHeaders);

  if (!user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required to view food waste logs.' },
      { status: 401 }
    );
  }

  const userId = user.id;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return NextResponse.json({ success: true, foodWaste: [], offline: true });
  }

  try {
    const sql = neon(databaseUrl);
    const { searchParams } = new URL(request.url);
    const targetWasteId = searchParams.get('id');

    let rows = [];
    if (targetWasteId) {
      rows = await sql`
        SELECT * FROM food_waste_logs 
        WHERE id = ${targetWasteId} AND user_id = ${userId};
      `;
    } else {
      rows = await sql`
        SELECT * FROM food_waste_logs 
        WHERE user_id = ${userId} 
        ORDER BY date DESC, created_at DESC;
      `;
    }

    const foodWaste = rows.map(r => ({
      id: r.id,
      userId: r.user_id,
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

    return NextResponse.json({
      success: true,
      userId,
      foodWaste
    });
  } catch (err: any) {
    console.error('Error fetching tenant food waste:', err);
    return NextResponse.json({ error: 'Database error', message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const reqHeaders = await headers();
  const user = await getAuthenticatedUser(reqHeaders);

  if (!user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required to save food waste.' },
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

    const wasteData = body.foodWaste || body.waste || body;
    const wasteId = wasteData.id || `waste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const date = wasteData.date || new Date().toISOString().split('T')[0];
    const projectWeek = Number(wasteData.projectWeek || wasteData.project_week || 1);
    const itemName = wasteData.itemName || wasteData.item_name || 'Food Waste';
    const measuredWeightG = Number(wasteData.measuredWeightG || wasteData.measured_weight_g || 0);
    const isEstimated = Boolean(wasteData.isEstimated ?? wasteData.is_estimated);
    const estimatedCost = Number(wasteData.estimatedCost || wasteData.estimated_cost || 0);
    const reason = wasteData.reason || 'Spoiled / Molded';
    const notes = wasteData.notes || '';

    // Force user_id = userId
    await sql`
      INSERT INTO food_waste_logs (
        id, user_id, date, project_week, item_name, measured_weight_g,
        is_estimated, estimated_cost, reason, notes, created_at
      ) VALUES (
        ${wasteId}, ${userId}, ${date}, ${projectWeek}, ${itemName}, ${measuredWeightG},
        ${isEstimated}, ${estimatedCost}, ${reason}, ${notes}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        date = EXCLUDED.date,
        project_week = EXCLUDED.project_week,
        item_name = EXCLUDED.item_name,
        measured_weight_g = EXCLUDED.measured_weight_g,
        is_estimated = EXCLUDED.is_estimated,
        estimated_cost = EXCLUDED.estimated_cost,
        reason = EXCLUDED.reason,
        notes = EXCLUDED.notes;
    `;

    return NextResponse.json({
      success: true,
      synced: true,
      userId,
      foodWaste: {
        id: wasteId,
        userId,
        itemName,
        measuredWeightG
      }
    });
  } catch (err: any) {
    console.error('Error saving tenant food waste:', err);
    return NextResponse.json({ error: 'Database error', message: err.message }, { status: 500 });
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
  const wasteId = searchParams.get('id');
  if (!wasteId) return NextResponse.json({ error: 'Waste ID required' }, { status: 400 });

  const sql = neon(databaseUrl);
  await sql`DELETE FROM food_waste_logs WHERE id = ${wasteId} AND user_id = ${userId};`;

  return NextResponse.json({ success: true, deletedId: wasteId });
}

