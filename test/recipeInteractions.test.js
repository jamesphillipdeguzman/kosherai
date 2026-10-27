// Test Suite for Recipe Interactions API & Client Pipeline
import assert from 'node:assert';
import handler, { ensureRecipeInteractionsTables, isValidPostgresUrl } from '../api/recipe-interactions.js';

console.log('🧪 Starting Recipe Interactions Test Suite...\n');

// ----------------------------------------------------
// Test 1: PostgreSQL URL Validation
// ----------------------------------------------------
console.log('Test 1: PostgreSQL connection URL validation');
assert.strictEqual(
  isValidPostgresUrl('postgresql://neondb_owner:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require'),
  true,
  'Valid Neon connection string should pass'
);
assert.strictEqual(
  isValidPostgresUrl('postgres://user:sample_pass@db.neon.tech/db'),
  true,
  'Valid postgres:// scheme should pass'
);
assert.strictEqual(isValidPostgresUrl(''), false, 'Empty string should fail');
assert.strictEqual(isValidPostgresUrl('postgresql://user:password@endpoint/db'), false, 'Placeholder URL should fail');
console.log('  ✅ PostgreSQL URL validation verified.');

// ----------------------------------------------------
// Test 2: Table Schema Definition
// ----------------------------------------------------
console.log('\nTest 2: ensureRecipeInteractionsTables schema definitions');
const executedSqlQueries = [];
const mockSql = async (strings, ...values) => {
  const query = strings.reduce((prev, curr, i) => prev + curr + (values[i] !== undefined ? `$${i + 1}` : ''), '');
  executedSqlQueries.push({ query, values });
  return [];
};
mockSql.query = async () => [];

await ensureRecipeInteractionsTables(mockSql);
assert.ok(executedSqlQueries.length >= 2, 'Must create recipe_interactions and recipe_comments');
const allQueriesText = executedSqlQueries.map(q => q.query).join(' ');
assert.ok(allQueriesText.includes('recipe_interactions'), 'Schema includes recipe_interactions table');
assert.ok(allQueriesText.includes('recipe_comments'), 'Schema includes recipe_comments table');
console.log('  ✅ Database schema tables successfully verified.');

// ----------------------------------------------------
// Test 3: Offline Fallback Responses when DATABASE_URL is unconfigured
// ----------------------------------------------------
console.log('\nTest 3: Offline fallback responses when DATABASE_URL is not configured');

function createMockReqRes(method, body = {}, url = '/api/recipe-interactions') {
  const req = {
    method,
    url,
    body,
    headers: { 'content-type': 'application/json' }
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    statusCode: 200,
    setHeader: () => {},
    status: function (code) { statusCode = code; return this; },
    json: function (data) { responseData = data; return this; },
    end: function (data) { if (data && !responseData) responseData = JSON.parse(data); }
  };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

const origDb = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

// Test GET offline
const { req: getReq, res: getRes, getData: getGetData } = createMockReqRes('GET', {}, '/api/recipe-interactions?recipeId=lid-tinola');
await handler(getReq, getRes);
const getResult = getGetData();
assert.strictEqual(getResult.offline, true, 'Without DATABASE_URL, GET returns offline: true');
assert.strictEqual(getResult.recipeId, 'lid-tinola');
assert.strictEqual(getResult.views, 0);

// Test POST view offline
const { req: viewReq, res: viewRes, getData: getViewData } = createMockReqRes('POST', { action: 'view', recipeId: 'lid-tinola' });
await handler(viewReq, viewRes);
const viewResult = getViewData();
assert.strictEqual(viewResult.offline, true, 'POST view offline returns offline: true');
assert.strictEqual(viewResult.success, true);

// Test POST like offline
const { req: likeReq, res: likeRes, getData: getLikeData } = createMockReqRes('POST', { action: 'like', recipeId: 'lid-tinola', delta: 1 });
await handler(likeReq, likeRes);
const likeResult = getLikeData();
assert.strictEqual(likeResult.offline, true, 'POST like offline returns offline: true');
assert.strictEqual(likeResult.success, true);

// Test POST comment offline
const { req: commentReq, res: commentRes, getData: getCommentData } = createMockReqRes('POST', {
  action: 'comment',
  recipeId: 'lid-tinola',
  userName: 'Nurse Joy',
  comment: 'Used Morton coarse non-iodized kosher salt and sayote.'
});
await handler(commentReq, commentRes);
const commentResult = getCommentData();
assert.strictEqual(commentResult.offline, true);
assert.strictEqual(commentResult.comment.userName, 'Nurse Joy');
assert.ok(commentResult.comment.comment.includes('non-iodized kosher salt'));

process.env.DATABASE_URL = origDb;
console.log('  ✅ Offline fallback responses verified.');

// ----------------------------------------------------
// Test 4: Local Interactions Storage Integration
// ----------------------------------------------------
console.log('\nTest 4: Client recipeInteractionsStorage integration');
const {
  isRecipeLiked,
  getCachedRecipeInteraction,
  setCachedRecipeInteraction
} = await import('../src/services/recipeInteractionsStorage.js');

// Mock localStorage if in node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

assert.strictEqual(isRecipeLiked('lid-tinola'), false, 'Recipe initially unliked');
setCachedRecipeInteraction('lid-tinola', { views: 5, likes: 2, commentsCount: 1 });
const cached = getCachedRecipeInteraction('lid-tinola');
assert.strictEqual(cached.views, 5, 'Cached views should match');
assert.strictEqual(cached.likes, 2, 'Cached likes should match');
assert.strictEqual(cached.commentsCount, 1, 'Cached comments count should match');

console.log('  ✅ Client interactions storage verified.');

console.log('\n🎉 ALL RECIPE INTERACTIONS TESTS PASSED SUCCESSFULLY!');
