// Test Suite for Dynamic Copyright Footer & Actual Unique Visitor Counter
import assert from 'node:assert';
import { createVisitorsHandler, ensureVisitorsTables } from '../api/visitors.js';
import { renderFooter } from '../src/components/Footer.js';
import {
  VISITOR_ID_KEY,
  VISITOR_COUNT_CACHE_KEY,
  getOrCreateAnonymousVisitorId,
  getCachedVisitorCount,
  formatVisitorCount,
  registerAndFetchVisitorCount
} from '../src/services/visitorService.js';

console.log('🧪 Starting Footer & Unique Visitor Counter Test Suite...\n');

// ----------------------------------------------------
// Test 1: Reusable Footer Component & Dynamic Year
// ----------------------------------------------------
console.log('Test 1: Footer component dynamic copyright year & formatting');
{
  const currentYear = new Date().getFullYear();
  const htmlWithCount = renderFooter({ visitorCount: 1234 });
  assert.ok(
    htmlWithCount.includes(`&copy; ${currentYear} James Phillip De Guzman. All rights reserved.`),
    'Footer must render dynamic copyright year'
  );
  assert.ok(htmlWithCount.includes('1,234'), 'Footer must format visitor count with thousands separators');
  assert.ok(htmlWithCount.includes('Visitors:'), 'Footer must label visitor count');

  // When visitorCount is null (offline with no cache or before load), hide counter gracefully
  const htmlWithoutCount = renderFooter({ visitorCount: null });
  assert.ok(
    htmlWithoutCount.includes(`&copy; ${currentYear} James Phillip De Guzman. All rights reserved.`),
    'Copyright must still render when visitorCount is null'
  );
  assert.ok(!htmlWithoutCount.includes('Visitors:'), 'Visitor counter must be hidden when count is null');
  assert.strictEqual(formatVisitorCount(10500), '10,500');
}
console.log('  ✅ Footer component and formatting verified.');

// ----------------------------------------------------
// Test 2: Backend /api/visitors Atomic Deduplication & Bot Protection
// ----------------------------------------------------
console.log('\nTest 2: /api/visitors atomic registration, refresh deduplication, concurrency & bot guard');
{
  const visitorsSet = new Set();
  let totalCount = 0;

  const mockSql = async (strings, ...values) => {
    const query = strings.join(' ').replace(/\s+/g, ' ').trim();
    if (query.startsWith('CREATE TABLE') || query.startsWith('INSERT INTO site_stats')) {
      return [];
    }
    if (query.includes('SELECT total_count AS "totalCount" FROM site_stats')) {
      return [{ totalCount }];
    }
    if (query.includes('WITH inserted AS')) {
      const visitorId = values[0];
      const isNewVisitor = !visitorsSet.has(visitorId);
      if (isNewVisitor) {
        visitorsSet.add(visitorId);
        totalCount += 1;
      }
      return [{ totalCount, isNewVisitor }];
    }
    return [];
  };

  const createReqRes = (method, body = {}, headers = {}) => {
    const req = { method, url: '/api/visitors', body, headers };
    let statusCode = 200;
    let data = null;
    const setHeaders = {};
    const res = {
      statusCode: 200,
      setHeader(k, v) { setHeaders[k] = v; },
      status(c) { statusCode = c; return this; },
      json(d) { data = d; return this; },
      end(d) { if (d && !data) { try { data = JSON.parse(d); } catch { data = d; } } }
    };
    return { req, res, getStatus: () => statusCode, getData: () => data, setHeaders };
  };

  const origDb = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://testuser:testpass@ep-test-host.neon.tech/testdb?sslmode=require';

  try {
    // Verify schema helper
    const schemaQueries = [];
    await ensureVisitorsTables(async (s) => { schemaQueries.push(s.join('')); return []; });
    assert.ok(schemaQueries.join(' ').includes('unique_visitors'));
    assert.ok(schemaQueries.join(' ').includes('site_stats'));

    const handler = createVisitorsHandler({ createSql: () => mockSql });

    // Browser 1 first visit -> increments to 1
    const browser1Id = 'visitor_browser_one_123456';
    const r1 = createReqRes('POST', { visitorId: browser1Id }, { 'user-agent': 'Mozilla/5.0' });
    await handler(r1.req, r1.res);
    assert.strictEqual(r1.getStatus(), 200);
    assert.strictEqual(r1.getData().totalVisitors, 1);
    assert.strictEqual(r1.getData().isNewVisitor, true);

    // Browser 1 refresh / subsequent session -> stays 1
    const r1Refresh = createReqRes('POST', { visitorId: browser1Id }, { 'user-agent': 'Mozilla/5.0' });
    await handler(r1Refresh.req, r1Refresh.res);
    assert.strictEqual(r1Refresh.getData().totalVisitors, 1);
    assert.strictEqual(r1Refresh.getData().isNewVisitor, false);

    // Concurrent requests from Browser 2 -> increments once to 2
    const browser2Id = 'visitor_browser_two_789012';
    const c1 = createReqRes('POST', { visitorId: browser2Id }, { 'user-agent': 'Mozilla/5.0' });
    const c2 = createReqRes('POST', { visitorId: browser2Id }, { 'user-agent': 'Mozilla/5.0' });
    await Promise.all([handler(c1.req, c1.res), handler(c2.req, c2.res)]);
    assert.strictEqual(totalCount, 2, 'Concurrent requests for same visitor must increment only once');

    // Automated bot request -> ignored without incrementing
    const botReq = createReqRes('POST', { visitorId: 'visitor_bot_request_000111' }, { 'user-agent': 'curl/8.0.1' });
    await handler(botReq.req, botReq.res);
    assert.strictEqual(botReq.getData().ignoredBot, true);
    assert.strictEqual(botReq.getData().totalVisitors, 2);

    // Invalid visitorId -> 400
    const badReq = createReqRes('POST', { visitorId: 'bad' }, { 'user-agent': 'Mozilla/5.0' });
    await handler(badReq.req, badReq.res);
    assert.strictEqual(badReq.getStatus(), 400);

    // GET returns 2
    const getReq = createReqRes('GET');
    await handler(getReq.req, getReq.res);
    assert.strictEqual(getReq.getData().totalVisitors, 2);

    // Unconfigured DB -> offline: true, totalVisitors: null
    delete process.env.DATABASE_URL;
    const offReq = createReqRes('POST', { visitorId: browser1Id });
    await handler(offReq.req, offReq.res);
    assert.strictEqual(offReq.getData().offline, true);
    assert.strictEqual(offReq.getData().totalVisitors, null);
  } finally {
    if (origDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = origDb;
  }
}
console.log('  ✅ Backend atomic visitor tracking and anti-bot checks verified.');

// ----------------------------------------------------
// Test 3: Client Visitor Service (Persistence, Caching & Offline Fallback)
// ----------------------------------------------------
console.log('\nTest 3: Client visitorService persistence, cache & offline fallback');
{
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const id1 = getOrCreateAnonymousVisitorId();
  const id2 = getOrCreateAnonymousVisitorId();
  assert.strictEqual(id1, id2, 'Visitor ID must persist across calls');
  assert.ok(id1.length >= 16, 'Visitor ID must be valid length');
  assert.strictEqual(localStorage.getItem(VISITOR_ID_KEY), id1);

  // Initially no cached count
  assert.strictEqual(getCachedVisitorCount(), null);

  // Successful API fetch caches count
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ success: true, totalVisitors: 1234, isNewVisitor: true })
  });
  const count = await registerAndFetchVisitorCount();
  assert.strictEqual(count, 1234);
  assert.strictEqual(getCachedVisitorCount(), 1234);

  // API failure falls back to cached count
  globalThis.fetch = async () => { throw new Error('Network down'); };
  const fallbackCount = await registerAndFetchVisitorCount();
  assert.strictEqual(fallbackCount, 1234, 'API failure must return cached count when available');

  // API failure with no cache returns null (gracefully hides counter)
  localStorage.removeItem(VISITOR_COUNT_CACHE_KEY);
  const noCacheCount = await registerAndFetchVisitorCount();
  assert.strictEqual(noCacheCount, null, 'API failure without cache must return null');
}
console.log('  ✅ Client visitorService persistence and graceful fallback verified.');

console.log('\n🎉 ALL FOOTER & VISITOR COUNTER TESTS PASSED!');
