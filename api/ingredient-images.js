// Serverless API Route for Ingredient Images (Public Read Endpoint)
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { setCorsHeaders } from '../lib/auth.js';
import { isValidPostgresUrl } from './trips.js';

export async function ensureIngredientImagesTable(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ingredient_images (
        id TEXT PRIMARY KEY,
        protocol_id TEXT NOT NULL,
        ingredient_id TEXT NOT NULL,
        cloudinary_asset_id TEXT,
        public_id TEXT NOT NULL,
        secure_url TEXT NOT NULL,
        asset_version TEXT,
        format TEXT,
        original_filename TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_protocol_ingredient UNIQUE (protocol_id, ingredient_id)
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ingredient_images_protocol ON ingredient_images (protocol_id);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ingredient_images_status ON ingredient_images (status);
    `;
  } catch (err) {
    console.warn('[ensureIngredientImagesTable] Error ensuring table:', err?.message || err);
  }
}

function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const method = req.method ? req.method.toUpperCase() : 'GET';
  if (method !== 'GET') {
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Only GET allowed on public endpoint' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  const urlObj = new URL(req.url, 'http://localhost');
  const protocol = (urlObj.searchParams.get('protocol') || 'lid').toLowerCase();
  const includeAllStatus = urlObj.searchParams.get('all') === 'true';

  if (!isValidPostgresUrl(databaseUrl)) {
    return sendJson(res, 200, {
      success: true,
      protocol,
      count: 0,
      images: {},
      offline: true
    });
  }

  try {
    const sql = neon(databaseUrl.trim());
    await ensureIngredientImagesTable(sql);

    const rows = includeAllStatus
      ? await sql`
          SELECT id, protocol_id, ingredient_id, public_id, secure_url, asset_version, format, original_filename, status, updated_at
          FROM ingredient_images
          ORDER BY updated_at DESC;
        `
      : await sql`
          SELECT id, protocol_id, ingredient_id, public_id, secure_url, asset_version, format, original_filename, status, updated_at
          FROM ingredient_images
          WHERE status = 'active'
          ORDER BY updated_at DESC;
        `;

    // Map by ingredient_id for fast O(1) lookup
    const imagesMap = {};
    for (const r of rows) {
      imagesMap[r.ingredient_id] = {
        id: r.id,
        ingredient_id: r.ingredient_id,
        protocol_id: r.protocol_id,
        public_id: r.public_id,
        secure_url: r.secure_url,
        asset_version: r.asset_version,
        format: r.format,
        original_filename: r.original_filename,
        status: r.status,
        updated_at: r.updated_at
      };
    }

    return sendJson(res, 200, {
      success: true,
      protocol,
      count: Object.keys(imagesMap).length,
      images: imagesMap
    });
  } catch (err) {
    console.error('[API /api/ingredient-images] Query error:', err);
    return sendJson(res, 500, {
      success: false,
      error: 'DATABASE_QUERY_ERROR',
      message: err.message,
      protocol,
      images: {}
    });
  }
}

