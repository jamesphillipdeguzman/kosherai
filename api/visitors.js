// Serverless API Route for Unique Visitor Counter
// Connects to Neon PostgreSQL using DATABASE_URL
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { setCorsHeaders } from '../lib/auth.js';

let isTablesInitialized = false;
const recentRateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_HITS = 20;

const BOT_UA_PATTERN = /\b(bot|crawler|spider|headless|phantomjs|puppeteer|playwright|selenium|curl|wget|python-requests|httpclient|scrapy|go-http-client|java\/|ahrefs|semrush|bingpreview|slurp|duckduckbot|yandexbot)\b/i;
const VALID_VISITOR_ID_PATTERN = /^[a-zA-Z0-9_-]{16,64}$/;

/**
 * Ensures unique_visitors and site_stats tables exist in Neon PostgreSQL
 */
export async function ensureVisitorsTables(sql) {
  if (isTablesInitialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS unique_visitors (
      visitor_id TEXT PRIMARY KEY,
      first_seen_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS site_stats (
      stat_key TEXT PRIMARY KEY,
      total_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    INSERT INTO site_stats (stat_key, total_count, updated_at)
    VALUES ('unique_visitors', 0, NOW())
    ON CONFLICT (stat_key) DO NOTHING;
  `;

  isTablesInitialized = true;
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

function getHeader(req, name) {
  const headers = req?.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  return headers[name] || headers[name.toLowerCase()] || '';
}

function getVisitorIdFromCookie(req) {
  const cookieHeader = getHeader(req, 'cookie');
  if (!cookieHeader) return '';
  const match = cookieHeader.match(/(?:^|;\s*)kosherai_visitor_id=([^;]+)/);
  if (!match || !match[1]) return '';
  try {
    return decodeURIComponent(match[1].trim()).replace(/^"|"$/g, '');
  } catch {
    return '';
  }
}

function isAutomatedUserAgent(req) {
  const ua = getHeader(req, 'user-agent');
  if (!ua) return false;
  return BOT_UA_PATTERN.test(ua);
}

function isRateLimited(key) {
  if (!key) return false;
  const now = Date.now();
  const entry = recentRateLimitMap.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    recentRateLimitMap.set(key, { windowStart: now, count: 1 });
    if (recentRateLimitMap.size > 500) {
      const oldestKey = recentRateLimitMap.keys().next().value;
      if (oldestKey) recentRateLimitMap.delete(oldestKey);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_HITS;
}

/**
 * Creates HTTP handler for /api/visitors (supports dependency injection for tests)
 */
export function createVisitorsHandler(deps = {}) {
  const createSql = deps.createSql || ((url) => neon(url));

  return async function handler(req, res) {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!isValidPostgresUrl(dbUrl)) {
      return sendJson(res, 200, {
        success: false,
        offline: true,
        totalVisitors: null
      });
    }

    let sql;
    try {
      sql = createSql(dbUrl);
      await ensureVisitorsTables(sql);
    } catch (initErr) {
      console.error('[visitors] Database initialization error:', initErr.message);
      return sendJson(res, 500, {
        error: 'DATABASE_INITIALIZATION_ERROR',
        message: initErr.message
      });
    }

    // ==================== GET VISITOR COUNT ====================
    if (req.method === 'GET') {
      try {
        const rows = await sql`
          SELECT total_count AS "totalCount"
          FROM site_stats
          WHERE stat_key = 'unique_visitors'
          LIMIT 1;
        `;
        const totalVisitors = Number(rows[0]?.totalCount ?? 0);
        return sendJson(res, 200, {
          success: true,
          totalVisitors
        });
      } catch (err) {
        console.error('[visitors] GET error:', err.message);
        return sendJson(res, 500, {
          error: 'FETCH_VISITORS_FAILED',
          message: err.message
        });
      }
    }

    // ==================== POST REGISTER UNIQUE VISITOR ====================
    if (req.method === 'POST') {
      try {
        // Automated request protection: return current count without incrementing
        if (isAutomatedUserAgent(req)) {
          const rows = await sql`
            SELECT total_count AS "totalCount"
            FROM site_stats
            WHERE stat_key = 'unique_visitors'
            LIMIT 1;
          `;
          return sendJson(res, 200, {
            success: true,
            totalVisitors: Number(rows[0]?.totalCount ?? 0),
            isNewVisitor: false,
            ignoredBot: true
          });
        }

        const body = await parseRequestBody(req);
        const rawVisitorId = String(body.visitorId || getVisitorIdFromCookie(req) || '').trim();

        if (!VALID_VISITOR_ID_PATTERN.test(rawVisitorId)) {
          return sendJson(res, 400, {
            error: 'INVALID_VISITOR_ID',
            message: 'A valid anonymous visitorId is required.'
          });
        }

        if (isRateLimited(rawVisitorId)) {
          return sendJson(res, 429, {
            error: 'RATE_LIMITED',
            message: 'Too many requests.'
          });
        }

        // Atomic insert + increment in a single CTE statement
        const rows = await sql`
          WITH inserted AS (
            INSERT INTO unique_visitors (visitor_id, first_seen_at)
            VALUES (${rawVisitorId}, NOW())
            ON CONFLICT (visitor_id) DO NOTHING
            RETURNING visitor_id
          ),
          updated AS (
            UPDATE site_stats
            SET total_count = total_count + (SELECT COUNT(*)::int FROM inserted),
                updated_at = NOW()
            WHERE stat_key = 'unique_visitors'
            RETURNING total_count
          )
          SELECT
            (SELECT total_count FROM updated) AS "totalCount",
            EXISTS(SELECT 1 FROM inserted) AS "isNewVisitor";
        `;

        const result = rows[0] || {};
        const totalVisitors = Number(result.totalCount ?? 0);
        const isNewVisitor = Boolean(result.isNewVisitor);

        if (typeof res.setHeader === 'function') {
          res.setHeader(
            'Set-Cookie',
            `kosherai_visitor_id=${encodeURIComponent(rawVisitorId)}; Path=/; Max-Age=31536000; SameSite=Lax`
          );
        }

        return sendJson(res, 200, {
          success: true,
          totalVisitors,
          isNewVisitor
        });
      } catch (err) {
        console.error('[visitors] POST error:', err.message);
        return sendJson(res, 500, {
          error: 'REGISTER_VISITOR_FAILED',
          message: err.message
        });
      }
    }

    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  };
}

export default createVisitorsHandler();
