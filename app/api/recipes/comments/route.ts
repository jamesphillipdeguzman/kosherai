import { getAuthenticatedUser } from '../../../../lib/auth';
import { headers } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

/**
 * Tenant-Scoped Recipe Comments API
 * Attaches user_id to comments while extracting display name from verified session
 */
export async function GET(request: Request) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ success: true, comments: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const recipeId = searchParams.get('recipeId');

    if (!recipeId) {
      return NextResponse.json({ error: 'recipeId is required' }, { status: 400 });
    }

    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT id, recipe_id, user_id, user_name, comment, created_at
      FROM recipe_comments
      WHERE recipe_id = ${recipeId}
      ORDER BY created_at DESC
      LIMIT 100;
    `;

    return NextResponse.json({
      success: true,
      comments: rows.map(r => ({
        id: r.id,
        recipeId: r.recipe_id,
        userId: r.user_id,
        userName: r.user_name || 'Verified Cook',
        comment: r.comment,
        createdAt: r.created_at
      }))
    });
  } catch (err: any) {
    console.error('Error fetching recipe comments:', err);
    return NextResponse.json({ error: 'Database error', message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const reqHeaders = await headers();
  const user = await getAuthenticatedUser(reqHeaders);

  if (!user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required to post comments.' },
      { status: 401 }
    );
  }

  const userId = user.id;
  const displayName = user.name || user.email?.split('@')[0] || 'Caregiver / Cook';
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const recipeId = body.recipeId || body.recipe_id;
    const comment = (body.comment || '').trim();

    if (!recipeId || !comment) {
      return NextResponse.json({ error: 'recipeId and comment text are required' }, { status: 400 });
    }

    const commentId = body.id || `rc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sql = neon(databaseUrl);

    // Attach user_id = userId and verified display name
    await sql`
      INSERT INTO recipe_comments (
        id, recipe_id, user_id, user_name, comment, created_at
      ) VALUES (
        ${commentId}, ${recipeId}, ${userId}, ${displayName}, ${comment}, NOW()
      );
    `;

    return NextResponse.json({
      success: true,
      comment: {
        id: commentId,
        recipeId,
        userId,
        userName: displayName,
        comment,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('Error posting recipe comment:', err);
    return NextResponse.json({ error: 'Database error', message: err.message }, { status: 500 });
  }
}

