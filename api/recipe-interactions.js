// Serverless API Route for Recipe Interactions (Views, Likes & Comments)
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { getAuthenticatedUser, isAdminUser, setCorsHeaders } from '../lib/auth.js';

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
      user_id TEXT NOT NULL,
      user_name TEXT DEFAULT 'Caregiver / Cook',
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await sql`ALTER TABLE recipe_comments ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  } catch (_) {}

  await sql`
    CREATE INDEX IF NOT EXISTS idx_recipe_comments_recipe_id 
    ON recipe_comments(recipe_id);
  `;

  try {
    await sql`
      CREATE INDEX IF NOT EXISTS idx_recipe_comments_user_id 
      ON recipe_comments(user_id);
    `;
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
 * Creates the HTTP Handler for /api/recipe-interactions (supports dependency injection for testing)
 */
export function createRecipeInteractionsHandler(deps = {}) {
  const createSql = deps.createSql || ((url) => neon(url));
  const resolveAuthUser = deps.getAuthenticatedUser || getAuthenticatedUser;
  const resolveIsAdmin = deps.isAdminUser || isAdminUser;

  return async function handler(req, res) {
  setCorsHeaders(req, res);
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
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

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = await parseRequestBody(req);
      return sendJson(res, 200, {
        success: true,
        offline: true,
        action: 'edit_comment',
        comment: {
          id: body.id || body.commentId,
          recipeId: body.recipeId,
          comment: body.comment || ''
        }
      });
    }

    if (req.method === 'DELETE') {
      const query = parseQueryParams(req);
      const body = await parseRequestBody(req);
      return sendJson(res, 200, {
        success: true,
        offline: true,
        action: 'delete_comment',
        deletedId: query.id || query.commentId || body.id || body.commentId
      });
    }

    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  // Connect to Neon Database
  let sql;
  try {
    sql = createSql(dbUrl);
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
          SELECT id, recipe_id AS "recipeId", user_id AS "userId", user_name AS "userName", comment, created_at AS "createdAt"
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
            userId: c.userId || null,
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
      for (const c of commentCounts) {
        if (!interactions[c.recipe_id]) {
          interactions[c.recipe_id] = {
            views: 0,
            likes: 0,
            commentsCount: Number(c.count)
          };
        }
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
        const authUser = await resolveAuthUser(req);
        if (!authUser?.id) {
          return sendJson(res, 401, {
            error: 'UNAUTHORIZED',
            message: 'You must be signed in to post a comment.'
          });
        }

        const rawComment = (body.comment || '').trim();
        if (!rawComment) {
          return sendJson(res, 400, {
            error: 'MISSING_COMMENT_TEXT',
            message: 'Comment text cannot be empty.'
          });
        }

        const commentId = body.id || `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const userId = authUser.id;
        const userName = (authUser.name || body.userName || 'Caregiver / Cook').trim() || 'Caregiver / Cook';

        const rows = await sql`
          INSERT INTO recipe_comments (id, recipe_id, user_id, user_name, comment, created_at)
          VALUES (${commentId}, ${recipeId}, ${userId}, ${userName}, ${rawComment}, NOW())
          RETURNING id, recipe_id AS "recipeId", user_id AS "userId", user_name AS "userName", comment, created_at AS "createdAt";
        `;

        const inserted = rows[0] || {
          id: commentId,
          recipeId,
          userId,
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
            userId: inserted.userId,
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

  // ==================== EDIT COMMENT (PATCH / PUT) ====================
  if (req.method === 'PATCH' || req.method === 'PUT') {
    try {
      const authUser = await resolveAuthUser(req);
      if (!authUser?.id) {
        return sendJson(res, 401, {
          error: 'UNAUTHORIZED',
          message: 'You must be signed in to edit a comment.'
        });
      }

      const query = parseQueryParams(req);
      const body = await parseRequestBody(req);
      const commentId = body.id || body.commentId || query.id || query.commentId;
      const rawComment = (body.comment || '').trim();

      if (!commentId) {
        return sendJson(res, 400, {
          error: 'MISSING_COMMENT_ID',
          message: 'Comment id is required.'
        });
      }
      if (!rawComment) {
        return sendJson(res, 400, {
          error: 'MISSING_COMMENT_TEXT',
          message: 'Comment text cannot be empty.'
        });
      }

      const existingRows = await sql`
        SELECT id, recipe_id AS "recipeId", user_id AS "userId"
        FROM recipe_comments
        WHERE id = ${commentId}
        LIMIT 1;
      `;
      if (existingRows.length === 0) {
        return sendJson(res, 404, {
          error: 'COMMENT_NOT_FOUND',
          message: 'Comment not found.'
        });
      }

      const existing = existingRows[0];
      const isOwner = Boolean(existing.userId && existing.userId === authUser.id);
      const admin = await resolveIsAdmin(authUser);
      if (!isOwner && !admin) {
        return sendJson(res, 403, {
          error: 'FORBIDDEN',
          message: 'You are not authorized to edit this comment.'
        });
      }

      const updatedRows = await sql`
        UPDATE recipe_comments
        SET comment = ${rawComment}
        WHERE id = ${commentId}
        RETURNING id, recipe_id AS "recipeId", user_id AS "userId", user_name AS "userName", comment, created_at AS "createdAt";
      `;

      return sendJson(res, 200, {
        success: true,
        action: 'edit_comment',
        comment: updatedRows[0]
      });
    } catch (err) {
      console.error('[recipe-interactions] PATCH error:', err.message);
      return sendJson(res, 500, {
        error: 'EDIT_COMMENT_FAILED',
        message: err.message
      });
    }
  }

  // ==================== DELETE COMMENT ====================
  if (req.method === 'DELETE') {
    try {
      const authUser = await resolveAuthUser(req);
      if (!authUser?.id) {
        return sendJson(res, 401, {
          error: 'UNAUTHORIZED',
          message: 'You must be signed in to delete a comment.'
        });
      }

      const query = parseQueryParams(req);
      const body = await parseRequestBody(req);
      const commentId = query.id || query.commentId || body.id || body.commentId;

      if (!commentId) {
        return sendJson(res, 400, {
          error: 'MISSING_COMMENT_ID',
          message: 'Comment id is required.'
        });
      }

      const existingRows = await sql`
        SELECT id, recipe_id AS "recipeId", user_id AS "userId"
        FROM recipe_comments
        WHERE id = ${commentId}
        LIMIT 1;
      `;
      if (existingRows.length === 0) {
        return sendJson(res, 404, {
          error: 'COMMENT_NOT_FOUND',
          message: 'Comment not found.'
        });
      }

      const existing = existingRows[0];
      const isOwner = Boolean(existing.userId && existing.userId === authUser.id);
      const admin = await resolveIsAdmin(authUser);
      if (!isOwner && !admin) {
        return sendJson(res, 403, {
          error: 'FORBIDDEN',
          message: 'You are not authorized to delete this comment.'
        });
      }

      await sql`
        DELETE FROM recipe_comments
        WHERE id = ${commentId};
      `;

      return sendJson(res, 200, {
        success: true,
        action: 'delete_comment',
        deletedId: commentId,
        recipeId: existing.recipeId
      });
    } catch (err) {
      console.error('[recipe-interactions] DELETE error:', err.message);
      return sendJson(res, 500, {
        error: 'DELETE_COMMENT_FAILED',
        message: err.message
      });
    }
  }

  return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  };
}

export default createRecipeInteractionsHandler();
