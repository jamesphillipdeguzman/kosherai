// Serverless API Route for Meal Planning (Phase 4 & Persistence)
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { isValidPostgresUrl } from './trips.js';
import { getAuthenticatedUser, setCorsHeaders } from '../lib/auth.js';

export async function ensureMealPlansTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_week INTEGER DEFAULT 1,
      day_of_week TEXT DEFAULT 'Saturday',
      meal_type TEXT DEFAULT 'Dinner',
      dish_name TEXT NOT NULL,
      recipe_id TEXT,
      ingredients_needed JSONB DEFAULT '[]'::jsonb,
      allocated_grocery_item_ids JSONB DEFAULT '[]'::jsonb,
      lid_verified BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await sql`ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS user_id TEXT;`;
    await sql`ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
  } catch (_) {}
}

function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
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
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const method = req.method ? req.method.toUpperCase() : 'GET';
  const databaseUrl = process.env.DATABASE_URL;

  if (!isValidPostgresUrl(databaseUrl)) {
    if (method === 'GET') {
      return sendJson(res, 200, { success: true, synced: false, offline: true, mealPlans: [] });
    }
    const body = await parseRequestBody(req);
    return sendJson(res, 200, { success: true, synced: false, offline: true, plan: body });
  }

  let sql;
  try {
    sql = neon(databaseUrl.trim());
    await ensureMealPlansTable(sql);
  } catch (err) {
    console.warn('[API /api/meal-plans] Neon connection error:', err);
    return sendJson(res, 200, { success: false, synced: false, offline: true, mealPlans: [], message: err.message });
  }

  try {
    let user = null;
    try {
      user = await getAuthenticatedUser(req);
    } catch (_) {}

    const userId = typeof user === 'string' ? user : user?.id;

    if (!userId) {
      return sendJson(res, 401, {
        error: 'UNAUTHORIZED',
        message: 'Authentication required. Please sign in to access meal plans.'
      });
    }

    // 1. GET /api/meal-plans
    if (method === 'GET') {
      const params = parseQueryParams(req);
      const weekParam = params.project_week || params.projectWeek || params.week;

      let rows;
      if (weekParam !== undefined && weekParam !== null && weekParam !== '') {
        const weekNum = parseInt(weekParam, 10);
        rows = await sql`
          SELECT 
            id,
            user_id AS "userId",
            project_week AS "projectWeek",
            day_of_week AS "dayOfWeek",
            meal_type AS "mealType",
            dish_name AS "dishName",
            recipe_id AS "recipeId",
            ingredients_needed AS "ingredientsNeeded",
            allocated_grocery_item_ids AS "allocatedGroceryItemIds",
            lid_verified AS "lidVerified",
            notes,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM meal_plans
          WHERE user_id = ${userId} AND project_week = ${weekNum}
          ORDER BY created_at DESC;
        `;
      } else {
        rows = await sql`
          SELECT 
            id,
            user_id AS "userId",
            project_week AS "projectWeek",
            day_of_week AS "dayOfWeek",
            meal_type AS "mealType",
            dish_name AS "dishName",
            recipe_id AS "recipeId",
            ingredients_needed AS "ingredientsNeeded",
            allocated_grocery_item_ids AS "allocatedGroceryItemIds",
            lid_verified AS "lidVerified",
            notes,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM meal_plans
          WHERE user_id = ${userId}
          ORDER BY created_at DESC;
        `;
      }

      return sendJson(res, 200, { success: true, synced: true, mealPlans: rows });
    }

    // 2. POST /api/meal-plans (Upsert)
    if (method === 'POST') {
      const body = await parseRequestBody(req);
      const plans = Array.isArray(body.plans) ? body.plans : [body.plan || body];
      const saved = [];

      for (const p of plans) {
        if (!p.dishName && !p.dish_name) continue;
        const id = p.id || `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const projectWeek = parseInt(p.projectWeek || p.project_week || 2, 10);
        const dayOfWeek = p.dayOfWeek || p.day_of_week || 'Saturday';
        const mealType = p.mealType || p.meal_type || 'Dinner';
        const dishName = p.dishName || p.dish_name || 'Planned Meal';
        const recipeId = p.recipeId || p.recipe_id || null;
        const ingredientsNeeded = JSON.stringify(Array.isArray(p.ingredientsNeeded || p.ingredients_needed) ? (p.ingredientsNeeded || p.ingredients_needed) : []);
        const allocatedItemIds = JSON.stringify(Array.isArray(p.allocatedGroceryItemIds || p.allocated_grocery_item_ids) ? (p.allocatedGroceryItemIds || p.allocated_grocery_item_ids) : []);
        const lidVerified = Boolean(p.lidVerified ?? p.lid_verified ?? false);
        const notes = p.notes || '';

        const row = await sql`
          INSERT INTO meal_plans (
            id, user_id, project_week, day_of_week, meal_type, dish_name,
            recipe_id, ingredients_needed, allocated_grocery_item_ids, lid_verified,
            notes, updated_at
          ) VALUES (
            ${id}, ${userId}, ${projectWeek}, ${dayOfWeek}, ${mealType}, ${dishName},
            ${recipeId}, ${ingredientsNeeded}::jsonb, ${allocatedItemIds}::jsonb, ${lidVerified},
            ${notes}, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            project_week = EXCLUDED.project_week,
            day_of_week = EXCLUDED.day_of_week,
            meal_type = EXCLUDED.meal_type,
            dish_name = EXCLUDED.dish_name,
            recipe_id = EXCLUDED.recipe_id,
            ingredients_needed = EXCLUDED.ingredients_needed,
            allocated_grocery_item_ids = EXCLUDED.allocated_grocery_item_ids,
            lid_verified = EXCLUDED.lid_verified,
            notes = EXCLUDED.notes,
            updated_at = NOW()
          RETURNING
            id, user_id AS "userId", project_week AS "projectWeek",
            day_of_week AS "dayOfWeek", meal_type AS "mealType", dish_name AS "dishName",
            recipe_id AS "recipeId", ingredients_needed AS "ingredientsNeeded",
            allocated_grocery_item_ids AS "allocatedGroceryItemIds", lid_verified AS "lidVerified",
            notes, created_at AS "createdAt", updated_at AS "updatedAt";
        `;
        if (row && row[0]) saved.push(row[0]);
      }

      return sendJson(res, 200, { success: true, synced: true, mealPlans: saved });
    }

    // 3. DELETE /api/meal-plans
    if (method === 'DELETE') {
      const params = parseQueryParams(req);
      const body = await parseRequestBody(req);
      const planId = params.id || body.id;

      if (!planId) {
        return sendJson(res, 400, { success: false, error: 'Meal plan ID is required.' });
      }

      await sql`
        DELETE FROM meal_plans
        WHERE id = ${planId} AND user_id = ${userId};
      `;

      return sendJson(res, 200, { success: true, deletedId: planId });
    }

    return sendJson(res, 405, { error: `Method ${method} Not Allowed` });
  } catch (err) {
    console.error('[API /api/meal-plans] Handler error:', err);
    return sendJson(res, 500, { success: false, error: err.message });
  }
}

