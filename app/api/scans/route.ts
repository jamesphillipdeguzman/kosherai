import { getAuthenticatedUser } from '../../../lib/auth';
import { headers } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

/**
 * Tenant-Scoped Scans API
 * Enforces user_id partitioning on all saved product/food label audits
 */
export async function GET(request: Request) {
  const reqHeaders = await headers();
  const user = await getAuthenticatedUser(reqHeaders);

  if (!user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required to retrieve scan history.' },
      { status: 401 }
    );
  }

  const userId = user.id;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return NextResponse.json({ success: true, scans: [], offline: true });
  }

  try {
    const sql = neon(databaseUrl);
    const { searchParams } = new URL(request.url);
    const targetScanId = searchParams.get('id');

    let rows = [];
    if (targetScanId) {
      rows = await sql`
        SELECT * FROM scans 
        WHERE id = ${targetScanId} AND user_id = ${userId} 
        LIMIT 1;
      `;
    } else {
      rows = await sql`
        SELECT * FROM scans 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC 
        LIMIT 100;
      `;
    }

    const scans = rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      title: r.title || 'Scanned Food Label',
      status: r.status,
      reason: r.reason,
      flaggedIngredients: r.flagged_ingredients || [],
      imageUrl: r.image_url,
      createdAt: r.created_at
    }));

    return NextResponse.json({
      success: true,
      userId,
      scans
    });
  } catch (err: any) {
    console.error('Error fetching tenant scans:', err);
    return NextResponse.json({ error: 'Database error', message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const reqHeaders = await headers();
  const user = await getAuthenticatedUser(reqHeaders);

  if (!user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required to save scans.' },
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

    const scanId = body.id || `scan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const title = body.title || body.productName || 'Scanned Food Label';
    const status = body.status || 'SAFE';
    const reason = body.reason || '';
    const flaggedIngredients = JSON.stringify(body.flaggedIngredients || body.flagged_ingredients || []);
    const imageUrl = body.imageUrl || body.image_url || null;

    // Force user_id = userId
    await sql`
      INSERT INTO scans (
        id, user_id, title, status, reason, flagged_ingredients, image_url, created_at
      ) VALUES (
        ${scanId}, ${userId}, ${title}, ${status}, ${reason}, ${flaggedIngredients}::jsonb, ${imageUrl}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        flagged_ingredients = EXCLUDED.flagged_ingredients,
        image_url = EXCLUDED.image_url;
    `;

    return NextResponse.json({
      success: true,
      userId,
      scan: {
        id: scanId,
        userId,
        title,
        status
      }
    });
  } catch (err: any) {
    console.error('Error saving tenant scan:', err);
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
  const scanId = searchParams.get('id');
  const sql = neon(databaseUrl);

  if (scanId) {
    await sql`DELETE FROM scans WHERE id = ${scanId} AND user_id = ${userId};`;
  } else {
    // Clear all scans for this user only
    await sql`DELETE FROM scans WHERE user_id = ${userId};`;
  }

  return NextResponse.json({ success: true, deletedId: scanId || 'all' });
}

