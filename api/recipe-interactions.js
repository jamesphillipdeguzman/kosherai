// Serverless API Route for Recipe Interactions (Views, Likes & Comments)
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

let isTablesInitialized = false;

/**
 * Ensures recipe_interactions and recipe_comments tables exist in Neon PostgreSQL
 */
export async function ensureRecipeInteractionsTables(sql) {
  if (isTablesInitialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS recipe_interactions (
      recipe_id TEXT PRIMARY KEY,
      views_count INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS recipe_comments (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      user_name TEXT DEFAULT 'Caregiver / Cook',
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_recipe_comments_recipe_id 
    ON recipe_comments(recipe_id);
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
 * Validates PostgreSQL connection string
 */
export function isValidPostgresUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    (trimmed.startsWith('postgres://') || trimmed.startsWith('postgresql://')) &&
    !trimmed.includes('endpoint') &&
    trimmed.length > 20
  );
}

/**
 * Main HTTP Handler for /api/recipe-interactions
 */
export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return sendJson(res, 200, { ok: true });
  }

  const dbUrl = process.env.DATABASE_URL;
  const isDbConfigured = isValidPostgresUrl(dbUrl);

  // Fallback offline mock response when Neon DATABASE_URL is not configured
  if (!isDbConfigured) {
    if (req.method === 'GET') {
      const query = parseQueryParams(req);
      const recipeId = query.recipeId || query.id;
      if (recipeId && recipeId !== 'all') {
        return sendJson(res, 200, {
          recipeId,
          views: 0,
          likes: 0,
          comments: [],
          offline: true
        });
      }
      return sendJson(res, 200, {
        interactions: {},
        offline: true
      });
    }

    if (req.method === 'POST') {
      const body = await parseRequestBody(req);
      return sendJson(res, 200, {
        success: true,
        offline: true,
        action: body.action || 'view',
        recipeId: body.recipeId,
        comment: body.action === 'comment' ? {
          id: body.id || `comment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          recipeId: body.recipeId,
          userName: body.userName || 'Caregiver / Cook',
          comment: body.comment || '',
          createdAt: new Date().toISOString()
        } : undefined
      });
    }

    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  // Connect to Neon Database
  let sql;
  try {
    sql = neon(dbUrl);
    await ensureRecipeInteractionsTables(sql);
  } catch (initErr) {
    console.error('[recipe-interactions] Database connection/init error:', initErr.message);
    return sendJson(res, 500, {
      error: 'DATABASE_INITIALIZATION_ERROR',
      message: initErr.message
    });
  }

  // ==================== GET INTERACTIONS ====================
  if (req.method === 'GET') {
    try {
      const query = parseQueryParams(req);
      const recipeId = query.recipeId || query.id;

      // Specific recipe lookup: returns views, likes, and full comments list
      if (recipeId && recipeId !== 'all') {
        const interactionRows = await sql`
          SELECT views_count, likes_count 
          FROM recipe_interactions 
          WHERE recipe_id = ${recipeId}
          LIMIT 1;
        `;

        const commentRows = await sql`
          SELECT id, recipe_id AS "recipeId", user_name AS "userName", comment, created_at AS "createdAt"
          FROM recipe_comments
          WHERE recipe_id = ${recipeId}
          ORDER BY created_at DESC
          LIMIT 100;
        `;

        const row = interactionRows[0] || {};
        return sendJson(res, 200, {
          recipeId,
          views: Number(row.views_count || 0),
          likes: Number(row.likes_count || 0),
          comments: commentRows.map(c => ({
            id: c.id,
            recipeId: c.recipeId,
            userName: c.userName || 'Caregiver / Cook',
            comment: c.comment,
            createdAt: c.createdAt
          }))
        });
      }

      // Bulk lookup: returns views, likes, and comment tally for all recipes
      const allInteractions = await sql`
        SELECT recipe_id, views_count, likes_count
        FROM recipe_interactions;
      `;

      const commentCounts = await sql`
        SELECT recipe_id, COUNT(*)::int AS count
        FROM recipe_comments
        GROUP BY recipe_id;
      `;

      const commentCountMap = {};
      for (const c of commentCounts) {
        commentCountMap[c.recipe_id] = Number(c.count);
      }

      const interactions = {};
      for (const row of allInteractions) {
        interactions[row.recipe_id] = {
          views: Number(row.views_count || 0),
          likes: Number(row.likes_count || 0),
          commentsCount: commentCountMap[row.recipe_id] || 0
        };
      }

      return sendJson(res, 200, { interactions });
    } catch (err) {
      console.error('[recipe-interactions] GET error:', err.message);
      return sendJson(res, 500, {
        error: 'FETCH_INTERACTIONS_FAILED',
        message: err.message
      });
    }
  }

  // ==================== POST ACTIONS ====================
  if (req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const action = body.action || 'view';
      const recipeId = body.recipeId;

      if (!recipeId) {
        return sendJson(res, 400, {
          error: 'MISSING_RECIPE_ID',
          message: 'recipeId is required.'
        });
      }

      // Action 1: Record View
      if (action === 'view') {
        const rows = await sql`
          INSERT INTO recipe_interactions (recipe_id, views_count, likes_count, updated_at)
          VALUES (${recipeId}, 1, 0, NOW())
          ON CONFLICT (recipe_id) DO UPDATE SET
            views_count = recipe_interactions.views_count + 1,
            updated_at = NOW()
          RETURNING views_count, likes_count;
        `;
        const updated = rows[0] || {};
        return sendJson(res, 200, {
          success: true,
          action: 'view',
          recipeId,
          views: Number(updated.views_count || 1),
          likes: Number(updated.likes_count || 0)
        });
      }

      // Action 2: Toggle Like
      if (action === 'like') {
        const delta = Number(body.delta) === -1 ? -1 : 1;
        const rows = await sql`
          INSERT INTO recipe_interactions (recipe_id, views_count, likes_count, updated_at)
          VALUES (${recipeId}, 0, ${Math.max(0, delta)}, NOW())
          ON CONFLICT (recipe_id) DO UPDATE SET
            likes_count = GREATEST(0, recipe_interactions.likes_count + ${delta}),
            updated_at = NOW()
          RETURNING views_count, likes_count;
        `;
        const updated = rows[0] || {};
        return sendJson(res, 200, {
          success: true,
          action: 'like',
          recipeId,
          likes: Number(updated.likes_count || 0)
        });
      }

      // Action 3: Post Comment
      if (action === 'comment') {
        const rawComment = (body.comment || '').trim();
        if (!rawComment) {
          return sendJson(res, 400, {
            error: 'MISSING_COMMENT_TEXT',
            message: 'Comment text cannot be empty.'
          });
        }

        const commentId = body.id || `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const userName = (body.userName || 'Caregiver / Cook').trim() || 'Caregiver / Cook';

        const rows = await sql`
          INSERT INTO recipe_comments (id, recipe_id, user_name, comment, created_at)
          VALUES (${commentId}, ${recipeId}, ${userName}, ${rawComment}, NOW())
          RETURNING id, recipe_id AS "recipeId", user_name AS "userName", comment, created_at AS "createdAt";
        `;

        const inserted = rows[0] || {
          id: commentId,
          recipeId,
          userName,
          comment: rawComment,
          createdAt: new Date().toISOString()
        };

        return sendJson(res, 201, {
          success: true,
          action: 'comment',
          comment: {
            id: inserted.id,
            recipeId: inserted.recipeId,
            userName: inserted.userName,
            comment: inserted.comment,
            createdAt: inserted.createdAt
          }
        });
      }

      return sendJson(res, 400, {
        error: 'INVALID_ACTION',
        message: `Action "${action}" is not supported.`
      });
    } catch (err) {
      console.error('[recipe-interactions] POST error:', err.message);
      return sendJson(res, 500, {
        error: 'RECIPE_INTERACTION_FAILED',
        message: err.message
      });
    }
  }

  return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
}
