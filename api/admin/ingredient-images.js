// Serverless API Route for Ingredient Image Administration
// Admin-only endpoints for discovering, matching, persisting, and managing ingredient images.
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { setCorsHeaders, isAdminUser, getAuthenticatedUser } from '../../lib/auth.js';
import { isValidPostgresUrl } from '../trips.js';
import { ensureIngredientImagesTable } from '../ingredient-images.js';
import { matchAssetToIngredient } from '../../lib/ingredientImageMatcher.js';
import { LID_DATABASE } from '../../src/data/lidDatabase.js';

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

/**
 * Fetch assets from Cloudinary Admin API if credentials are provided in process.env
 */
async function fetchCloudinaryFolderAssets(folderPrefix = 'kosherai') {
  const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || 'dego6hgcb';
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    return [];
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/image?prefix=${encodeURIComponent(folderPrefix)}&max_results=500`;
    
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      console.warn('[Cloudinary Admin API] Error response:', res.status, await res.text().catch(() => ''));
      return [];
    }

    const data = await res.json();
    return Array.isArray(data.resources) ? data.resources : [];
  } catch (err) {
    console.warn('[Cloudinary Admin API] Fetch exception:', err);
    return [];
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // 1. Authorization Guard
  const isAuthorized = await isAdminUser(req);
  if (!isAuthorized) {
    const authUser = await getAuthenticatedUser(req).catch(() => null);
    return sendJson(res, 403, {
      error: 'FORBIDDEN',
      message: 'Administrator privileges required to access ingredient image management.',
      authenticated: Boolean(authUser)
    });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!isValidPostgresUrl(databaseUrl)) {
    return sendJson(res, 503, {
      error: 'DATABASE_UNAVAILABLE',
      message: 'Neon PostgreSQL database is currently unreachable.'
    });
  }

  let sql;
  try {
    sql = neon(databaseUrl.trim());
    await ensureIngredientImagesTable(sql);
  } catch (err) {
    return sendJson(res, 500, {
      error: 'DATABASE_INITIALIZATION_ERROR',
      message: err.message
    });
  }

  const method = req.method ? req.method.toUpperCase() : 'GET';
  const urlObj = new URL(req.url, 'http://localhost');
  const pathname = urlObj.pathname;
  const actionParam = urlObj.searchParams.get('action');

  try {
    // =========================================================================
    // GET /api/admin/ingredient-images
    // =========================================================================
    if (method === 'GET') {
      const protocol = (urlObj.searchParams.get('protocol') || 'all').toLowerCase();
      const statusFilter = (urlObj.searchParams.get('status') || 'all').toLowerCase();
      const searchQuery = (urlObj.searchParams.get('search') || '').trim().toLowerCase();
      const limit = parseInt(urlObj.searchParams.get('limit') || '100', 10);
      const offset = parseInt(urlObj.searchParams.get('offset') || '0', 10);

      // Fetch all mappings from Neon
      const allRows = await sql`
        SELECT 
          id, 
          protocol_id, 
          ingredient_id, 
          cloudinary_asset_id, 
          public_id, 
          secure_url, 
          asset_version, 
          format, 
          original_filename, 
          status, 
          created_at, 
          updated_at
        FROM ingredient_images
        ORDER BY updated_at DESC;
      `;

      // Compute Global & Protocol Stats
      const relevantItems = protocol === 'all' 
        ? LID_DATABASE 
        : LID_DATABASE; // Database items represent standard ingredient library
      
      const totalIngredients = relevantItems.length;
      
      const activeMappings = protocol === 'all'
        ? allRows.filter(r => r.status === 'active')
        : allRows.filter(r => r.status === 'active' && r.protocol_id === protocol);
      
      const pendingMappings = protocol === 'all'
        ? allRows.filter(r => r.status === 'pending_review')
        : allRows.filter(r => r.status === 'pending_review' && r.protocol_id === protocol);

      // Check which ingredients have an active image
      const mappedIngredientIds = new Set(activeMappings.map(r => r.ingredient_id));
      const withImage = relevantItems.filter(item => mappedIngredientIds.has(item.id)).length;
      const missingImage = Math.max(0, totalIngredients - withImage);

      // Filter rows for response list
      let filteredRows = allRows;
      if (protocol !== 'all') {
        filteredRows = filteredRows.filter(r => r.protocol_id === protocol);
      }
      if (statusFilter !== 'all') {
        filteredRows = filteredRows.filter(r => r.status === statusFilter);
      }
      if (searchQuery) {
        filteredRows = filteredRows.filter(r => 
          (r.ingredient_id && r.ingredient_id.toLowerCase().includes(searchQuery)) ||
          (r.public_id && r.public_id.toLowerCase().includes(searchQuery)) ||
          (r.original_filename && r.original_filename.toLowerCase().includes(searchQuery))
        );
      }

      const paginatedRows = filteredRows.slice(offset, offset + limit);

      return sendJson(res, 200, {
        success: true,
        stats: {
          totalIngredients,
          withImage,
          missingImage,
          pendingReview: pendingMappings.length
        },
        protocol,
        totalMatches: filteredRows.length,
        offset,
        limit,
        mappings: paginatedRows
      });
    }

    // =========================================================================
    // POST /api/admin/ingredient-images
    // Actions: 'discover', 'save', 'update', 'delete', 'batch_save'
    // =========================================================================
    if (method === 'POST') {
      const body = await parseRequestBody(req);
      const action = body.action || actionParam || 'save';

      // -----------------------------------------------------------------------
      // Action: DISCOVER
      // -----------------------------------------------------------------------
      if (action === 'discover' || pathname.endsWith('/discover')) {
        let assetsToProcess = [];

        // 1. Assets supplied directly by client/admin
        if (Array.isArray(body.assets) && body.assets.length > 0) {
          assetsToProcess = body.assets;
        } else {
          // 2. Query Cloudinary Admin API
          const folder = body.folder || 'kosherai';
          assetsToProcess = await fetchCloudinaryFolderAssets(folder);
        }

        if (assetsToProcess.length === 0) {
          return sendJson(res, 200, {
            success: true,
            discoveredCount: 0,
            matchedCount: 0,
            pendingReviewCount: 0,
            unmatchedCount: 0,
            message: 'No Cloudinary assets found for discovery. You can provide an asset list or configure Cloudinary API credentials in .env.',
            results: []
          });
        }

        const matchResults = [];
        let matchedCount = 0;
        let pendingReviewCount = 0;
        let unmatchedCount = 0;

        for (const asset of assetsToProcess) {
          const match = matchAssetToIngredient(asset, LID_DATABASE, body.protocol || null);
          const secureUrl = asset.secure_url || asset.url || '';
          const publicId = asset.public_id || '';
          const assetVersion = asset.version ? String(asset.version) : null;
          const format = asset.format || (publicId.endsWith('.webp') ? 'webp' : 'jpg');
          const originalFilename = asset.original_filename || publicId.split('/').pop() || '';

          if (match.matched && match.ingredientId) {
            const mappingId = `img_${match.protocolId}_${match.ingredientId}`;
            const status = match.status; // 'active' or 'pending_review'

            // Upsert into Neon PostgreSQL
            await sql`
              INSERT INTO ingredient_images (
                id, protocol_id, ingredient_id, cloudinary_asset_id, public_id, secure_url, asset_version, format, original_filename, status, updated_at
              ) VALUES (
                ${mappingId}, ${match.protocolId}, ${match.ingredientId}, ${asset.asset_id || null}, ${publicId}, ${secureUrl}, ${assetVersion}, ${format}, ${originalFilename}, ${status}, NOW()
              )
              ON CONFLICT (protocol_id, ingredient_id) DO UPDATE SET
                public_id = EXCLUDED.public_id,
                secure_url = EXCLUDED.secure_url,
                asset_version = EXCLUDED.asset_version,
                format = EXCLUDED.format,
                original_filename = EXCLUDED.original_filename,
                status = EXCLUDED.status,
                updated_at = NOW();
            `;

            if (status === 'active') matchedCount++;
            else pendingReviewCount++;

            matchResults.push({
              ingredientId: match.ingredientId,
              ingredientName: match.ingredientName,
              protocolId: match.protocolId,
              publicId,
              secureUrl,
              confidence: match.confidence,
              status,
              matchType: match.matchType
            });
          } else {
            unmatchedCount++;
            matchResults.push({
              ingredientId: null,
              ingredientName: null,
              protocolId: match.protocolId,
              publicId,
              secureUrl,
              confidence: 0,
              status: 'pending_review',
              matchType: 'unmatched'
            });
          }
        }

        return sendJson(res, 200, {
          success: true,
          discoveredCount: assetsToProcess.length,
          matchedCount,
          pendingReviewCount,
          unmatchedCount,
          results: matchResults
        });
      }

      // -----------------------------------------------------------------------
      // Action: SAVE (or upload registration)
      // -----------------------------------------------------------------------
      if (action === 'save') {
        const {
          protocol_id = 'lid',
          ingredient_id,
          public_id,
          secure_url,
          asset_version = null,
          format = 'webp',
          original_filename = null,
          status = 'active'
        } = body;

        if (!ingredient_id || !public_id || !secure_url) {
          return sendJson(res, 400, {
            error: 'MISSING_FIELDS',
            message: 'ingredient_id, public_id, and secure_url are required.'
          });
        }

        const id = body.id || `img_${protocol_id.toLowerCase()}_${ingredient_id}`;

        const rows = await sql`
          INSERT INTO ingredient_images (
            id, protocol_id, ingredient_id, cloudinary_asset_id, public_id, secure_url, asset_version, format, original_filename, status, updated_at
          ) VALUES (
            ${id}, ${protocol_id.toLowerCase()}, ${ingredient_id}, ${body.cloudinary_asset_id || null}, ${public_id}, ${secure_url}, ${asset_version ? String(asset_version) : null}, ${format}, ${original_filename}, ${status}, NOW()
          )
          ON CONFLICT (protocol_id, ingredient_id) DO UPDATE SET
            public_id = EXCLUDED.public_id,
            secure_url = EXCLUDED.secure_url,
            asset_version = EXCLUDED.asset_version,
            format = EXCLUDED.format,
            original_filename = EXCLUDED.original_filename,
            status = EXCLUDED.status,
            updated_at = NOW()
          RETURNING *;
        `;

        return sendJson(res, 200, {
          success: true,
          mapping: rows[0]
        });
      }

      // -----------------------------------------------------------------------
      // Action: UPDATE
      // -----------------------------------------------------------------------
      if (action === 'update') {
        const { id, ingredient_id, protocol_id, status } = body;
        if (!id) {
          return sendJson(res, 400, { error: 'MISSING_ID', message: 'Mapping id is required.' });
        }

        const updates = [];
        if (ingredient_id) updates.push(sql`ingredient_id = ${ingredient_id}`);
        if (protocol_id) updates.push(sql`protocol_id = ${protocol_id}`);
        if (status) updates.push(sql`status = ${status}`);

        const rows = await sql`
          UPDATE ingredient_images
          SET 
            ingredient_id = COALESCE(${ingredient_id || null}, ingredient_id),
            protocol_id = COALESCE(${protocol_id || null}, protocol_id),
            status = COALESCE(${status || null}, status),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *;
        `;

        if (rows.length === 0) {
          return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Mapping not found.' });
        }

        return sendJson(res, 200, {
          success: true,
          mapping: rows[0]
        });
      }

      // -----------------------------------------------------------------------
      // Action: DELETE
      // -----------------------------------------------------------------------
      if (action === 'delete') {
        const { id } = body;
        if (!id) {
          return sendJson(res, 400, { error: 'MISSING_ID', message: 'Mapping id is required.' });
        }

        await sql`
          DELETE FROM ingredient_images WHERE id = ${id};
        `;

        return sendJson(res, 200, {
          success: true,
          deletedId: id
        });
      }

      return sendJson(res, 400, {
        error: 'INVALID_ACTION',
        message: `Action '${action}' is not supported.`
      });
    }

    // =========================================================================
    // PATCH /api/admin/ingredient-images
    // =========================================================================
    if (method === 'PATCH') {
      const body = await parseRequestBody(req);
      const id = body.id || urlObj.searchParams.get('id');
      if (!id) {
        return sendJson(res, 400, { error: 'MISSING_ID', message: 'Mapping id is required.' });
      }

      const rows = await sql`
        UPDATE ingredient_images
        SET 
          ingredient_id = COALESCE(${body.ingredient_id || null}, ingredient_id),
          protocol_id = COALESCE(${body.protocol_id || null}, protocol_id),
          status = COALESCE(${body.status || null}, status),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *;
      `;

      if (rows.length === 0) {
        return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Mapping not found.' });
      }

      return sendJson(res, 200, {
        success: true,
        mapping: rows[0]
      });
    }

    // =========================================================================
    // DELETE /api/admin/ingredient-images
    // =========================================================================
    if (method === 'DELETE') {
      const id = urlObj.searchParams.get('id');
      if (!id) {
        return sendJson(res, 400, { error: 'MISSING_ID', message: 'Mapping id query parameter is required.' });
      }

      await sql`
        DELETE FROM ingredient_images WHERE id = ${id};
      `;

      return sendJson(res, 200, {
        success: true,
        deletedId: id
      });
    }

    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  } catch (err) {
    console.error('[API /api/admin/ingredient-images] Execution error:', err);
    return sendJson(res, 500, {
      success: false,
      error: 'SERVER_ERROR',
      message: err.message
    });
  }
}

