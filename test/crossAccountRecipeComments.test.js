// Cross-Account Recipe Comments Test Suite
import assert from 'node:assert';
import {
  createRecipeInteractionsHandler,
  ensureRecipeInteractionsTables
} from '../api/recipe-interactions.js';
import { renderRecipeCommentsDrawer } from '../src/components/CookModeTab.js';
import {
  postRecipeComment,
  fetchRecipeDetails,
  editRecipeComment,
  deleteRecipeComment,
  clearRecipeInteractionsCache,
  getCachedRecipeInteraction
} from '../src/services/recipeInteractionsStorage.js';

console.log('🧪 Starting Cross-Account Recipe Comments Test Suite...\n');

// ----------------------------------------------------
// In-Memory PostgreSQL Simulator for recipe_interactions & recipe_comments
// ----------------------------------------------------
function createInMemorySql() {
  const interactionsTable = new Map();
  const commentsTable = [];

  const sql = async (strings, ...values) => {
    const query = strings.reduce(
      (acc, part, idx) => acc + part + (idx < values.length ? `$${idx + 1}` : ''),
      ''
    );
    const normalized = query.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('ALTER TABLE') || normalized.startsWith('CREATE INDEX')) {
      return [];
    }

    if (normalized.includes('FROM recipe_interactions WHERE recipe_id =')) {
      const recipeId = values[0];
      const row = interactionsTable.get(recipeId);
      return row ? [row] : [];
    }

    if (normalized.includes('FROM recipe_comments WHERE recipe_id =')) {
      const recipeId = values[0];
      return commentsTable
        .filter(c => c.recipe_id === recipeId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(c => ({
          id: c.id,
          recipeId: c.recipe_id,
          userId: c.user_id,
          userName: c.user_name,
          comment: c.comment,
          createdAt: c.created_at
        }));
    }

    if (normalized.includes('SELECT recipe_id, views_count, likes_count FROM recipe_interactions')) {
      return Array.from(interactionsTable.values());
    }

    if (normalized.includes('SELECT recipe_id, COUNT(*)::int AS count FROM recipe_comments GROUP BY recipe_id')) {
      const counts = new Map();
      for (const c of commentsTable) {
        counts.set(c.recipe_id, (counts.get(c.recipe_id) || 0) + 1);
      }
      return Array.from(counts.entries()).map(([recipe_id, count]) => ({ recipe_id, count }));
    }

    if (normalized.startsWith('INSERT INTO recipe_comments')) {
      const [id, recipe_id, user_id, user_name, comment] = values;
      if (!user_id) {
        throw new Error('null value in column "user_id" of relation "recipe_comments" violates not-null constraint');
      }
      const row = {
        id,
        recipe_id,
        user_id,
        user_name,
        comment,
        created_at: new Date().toISOString()
      };
      commentsTable.push(row);
      return [{
        id: row.id,
        recipeId: row.recipe_id,
        userId: row.user_id,
        userName: row.user_name,
        comment: row.comment,
        createdAt: row.created_at
      }];
    }

    if (normalized.startsWith('DELETE FROM recipe_comments WHERE id =')) {
      const id = values[0];
      const idx = commentsTable.findIndex(c => c.id === id);
      if (idx >= 0) commentsTable.splice(idx, 1);
      return [];
    }

    if (normalized.startsWith('SELECT') && normalized.includes('FROM recipe_comments WHERE id =')) {
      const id = values[0];
      const found = commentsTable.find(c => c.id === id);
      return found ? [{
        id: found.id,
        recipeId: found.recipe_id,
        userId: found.user_id,
        userName: found.user_name,
        comment: found.comment,
        createdAt: found.created_at
      }] : [];
    }

    if (normalized.startsWith('UPDATE recipe_comments SET comment =')) {
      const [comment, id] = values;
      const found = commentsTable.find(c => c.id === id);
      if (!found) return [];
      found.comment = comment;
      return [{
        id: found.id,
        recipeId: found.recipe_id,
        userId: found.user_id,
        userName: found.user_name,
        comment: found.comment,
        createdAt: found.created_at
      }];
    }

    return [];
  };

  return { sql, commentsTable };
}

function createMockReqRes(method, body = {}, headers = {}, url = '/api/recipe-interactions') {
  const req = {
    method,
    url,
    body,
    headers: { 'content-type': 'application/json', ...headers }
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    statusCode: 200,
    setHeader: () => {},
    status(code) { statusCode = code; return this; },
    json(data) { responseData = data; return this; },
    end(data) {
      if (data && !responseData) {
        try { responseData = JSON.parse(data); } catch { responseData = data; }
      }
    }
  };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

// Two genuinely separate authenticated accounts
const ACCOUNT_A = {
  id: 'usr_account_a_001',
  name: 'Alice Caregiver',
  email: 'alice@kosherai.test',
  role: 'user',
  token: 'session_token_account_a_valid'
};

const ACCOUNT_B = {
  id: 'usr_account_b_002',
  name: 'Bob HomeCook',
  email: 'bob@kosherai.test',
  role: 'user',
  token: 'session_token_account_b_valid'
};

const ADMIN_ACCOUNT = {
  id: 'usr_admin_999',
  name: 'Admin Reviewer',
  email: 'admin@kosherai.test',
  role: 'admin',
  token: 'session_token_admin_valid'
};

const TOKEN_MAP = new Map([
  [`Bearer ${ACCOUNT_A.token}`, ACCOUNT_A],
  [`Bearer ${ACCOUNT_B.token}`, ACCOUNT_B],
  [`Bearer ${ADMIN_ACCOUNT.token}`, ADMIN_ACCOUNT]
]);

const { sql, commentsTable } = createInMemorySql();

const origDbUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://testuser:testpass@ep-test-host.neon.tech/testdb?sslmode=require';

const handler = createRecipeInteractionsHandler({
  createSql: () => sql,
  getAuthenticatedUser: async (req) => {
    const auth = req.headers?.authorization || req.headers?.Authorization || '';
    return TOKEN_MAP.get(auth) || null;
  },
  isAdminUser: async (user) => user?.role === 'admin'
});

const RECIPE_ID = 'lid-chicken-tinola';

try {
  // 1. Schema includes user_id
  console.log('Test 1: Schema ensures user_id column and index on recipe_comments');
  const schemaQueries = [];
  await ensureRecipeInteractionsTables(async (strings, ...vals) => {
    schemaQueries.push(strings.join('?'));
    return [];
  });
  const schemaText = schemaQueries.join('\n');
  assert.ok(schemaText.includes('user_id TEXT NOT NULL'), 'recipe_comments must define user_id');
  console.log('  ✅ Schema verified.');

  // 2. Unauthenticated comment POST rejected
  console.log('\nTest 2: Unauthenticated user cannot post a comment');
  {
    const { req, res, getStatus, getData } = createMockReqRes('POST', {
      action: 'comment',
      recipeId: RECIPE_ID,
      comment: 'Anonymous attempt'
    });
    await handler(req, res);
    assert.strictEqual(getStatus(), 401);
    assert.strictEqual(getData().error, 'UNAUTHORIZED');
    assert.strictEqual(commentsTable.length, 0);
  }
  console.log('  ✅ Unauthenticated comment rejected with 401.');

  // 3. Account A posts a comment (and cannot spoof userId)
  console.log('\nTest 3: Account A posts a comment (session-derived userId)');
  let commentAId;
  {
    const { req, res, getStatus, getData } = createMockReqRes(
      'POST',
      {
        action: 'comment',
        recipeId: RECIPE_ID,
        userId: ACCOUNT_B.id, // Attempted impersonation in payload
        comment: 'Used Morton coarse non-iodized kosher salt.'
      },
      { authorization: `Bearer ${ACCOUNT_A.token}` }
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.comment.userId, ACCOUNT_A.id, 'Author ID must come from session, not body');
    assert.strictEqual(data.comment.userName, ACCOUNT_A.name);
    commentAId = data.comment.id;
  }
  console.log('  ✅ Account A comment saved with session-derived userId.');

  // 4. Account B views the recipe & bulk counts
  console.log('\nTest 4: Account B views the recipe and sees Account A comment');
  {
    const { req, res, getStatus, getData } = createMockReqRes(
      'GET',
      {},
      { authorization: `Bearer ${ACCOUNT_B.token}` },
      `/api/recipe-interactions?recipeId=${RECIPE_ID}`
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.comments.length, 1);
    assert.strictEqual(data.comments[0].id, commentAId);
    assert.strictEqual(data.comments[0].userId, ACCOUNT_A.id);
    assert.strictEqual(data.comments[0].userName, ACCOUNT_A.name);
    assert.strictEqual(data.comments[0].email, undefined, 'Must not expose private email');

    // Bulk lookup even without recipe_interactions row
    const bulk = createMockReqRes('GET', {}, { authorization: `Bearer ${ACCOUNT_B.token}` }, '/api/recipe-interactions');
    await handler(bulk.req, bulk.res);
    assert.strictEqual(bulk.getStatus(), 200);
    assert.strictEqual(bulk.getData().interactions[RECIPE_ID].commentsCount, 1);
  }
  console.log('  ✅ Account B sees Account A comment and bulk count.');

  // 5. Account B posts a comment on the same recipe
  console.log('\nTest 5: Account B posts a comment on the same recipe');
  let commentBId;
  {
    const { req, res, getStatus, getData } = createMockReqRes(
      'POST',
      {
        action: 'comment',
        recipeId: RECIPE_ID,
        comment: 'Swapped patis for coconut aminos + ginger.'
      },
      { authorization: `Bearer ${ACCOUNT_B.token}` }
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    assert.strictEqual(data.comment.userId, ACCOUNT_B.id);
    assert.strictEqual(data.comment.userName, ACCOUNT_B.name);
    commentBId = data.comment.id;
  }
  console.log('  ✅ Account B comment saved.');

  // 6. Account A refreshes and Account B logs out & logs back in -> both comments visible
  console.log('\nTest 6: Both Account A and Account B see both comments after refresh / re-login');
  for (const acct of [ACCOUNT_A, ACCOUNT_B]) {
    const { req, res, getStatus, getData } = createMockReqRes(
      'GET',
      {},
      { authorization: `Bearer ${acct.token}` },
      `/api/recipe-interactions?recipeId=${RECIPE_ID}`
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const ids = new Set(getData().comments.map(c => c.id));
    assert.ok(ids.has(commentAId) && ids.has(commentBId), `${acct.name} must see both comments`);
  }
  console.log('  ✅ Both accounts see both comments consistently.');

  // 7. Account B attempts to delete or edit Account A's comment -> 403 FORBIDDEN
  console.log('\nTest 7: Unauthorized user (Account B) cannot edit or delete Account A comment');
  {
    const delRes = createMockReqRes(
      'DELETE',
      {},
      { authorization: `Bearer ${ACCOUNT_B.token}` },
      `/api/recipe-interactions?id=${encodeURIComponent(commentAId)}`
    );
    await handler(delRes.req, delRes.res);
    assert.strictEqual(delRes.getStatus(), 403);
    assert.strictEqual(delRes.getData().error, 'FORBIDDEN');

    const editRes = createMockReqRes(
      'PATCH',
      { id: commentAId, recipeId: RECIPE_ID, comment: 'Tampered text' },
      { authorization: `Bearer ${ACCOUNT_B.token}` }
    );
    await handler(editRes.req, editRes.res);
    assert.strictEqual(editRes.getStatus(), 403);
    assert.strictEqual(editRes.getData().error, 'FORBIDDEN');
    assert.strictEqual(commentsTable.length, 2, 'Both comments must remain intact');
  }
  console.log('  ✅ Unauthorized edit and delete rejected with 403 FORBIDDEN.');

  // 8. Account A edits and deletes own comment; Admin can delete Account B comment
  console.log('\nTest 8: Owner edit/delete and Admin moderation');
  {
    const editRes = createMockReqRes(
      'PATCH',
      { id: commentAId, recipeId: RECIPE_ID, comment: 'Updated: Used Morton kosher salt (1 tsp).' },
      { authorization: `Bearer ${ACCOUNT_A.token}` }
    );
    await handler(editRes.req, editRes.res);
    assert.strictEqual(editRes.getStatus(), 200);
    assert.strictEqual(editRes.getData().comment.comment, 'Updated: Used Morton kosher salt (1 tsp).');

    const delOwn = createMockReqRes(
      'DELETE',
      {},
      { authorization: `Bearer ${ACCOUNT_A.token}` },
      `/api/recipe-interactions?id=${encodeURIComponent(commentAId)}`
    );
    await handler(delOwn.req, delOwn.res);
    assert.strictEqual(delOwn.getStatus(), 200);

    const delAdmin = createMockReqRes(
      'DELETE',
      {},
      { authorization: `Bearer ${ADMIN_ACCOUNT.token}` },
      `/api/recipe-interactions?id=${encodeURIComponent(commentBId)}`
    );
    await handler(delAdmin.req, delAdmin.res);
    assert.strictEqual(delAdmin.getStatus(), 200);
    assert.strictEqual(commentsTable.length, 0);
  }
  console.log('  ✅ Owner edit/delete and Admin moderation verified.');

  // 9. Frontend service & CookModeTab UI ownership rendering
  console.log('\nTest 9: Frontend storage reconciliation, error rollback & UI ownership controls');
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  // Mock fetch wired to our in-memory handler
  let activeAuthHeader = `Bearer ${ACCOUNT_A.token}`;
  globalThis.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : {};
    const headers = { ...(opts.headers || {}), ...(activeAuthHeader ? { authorization: activeAuthHeader } : {}) };
    const { req, res, getStatus, getData } = createMockReqRes(method, body, headers, url);
    await handler(req, res);
    const status = getStatus();
    const data = getData();
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => data
    };
  };

  // Account A posts via frontend service
  const postedA = await postRecipeComment(RECIPE_ID, ACCOUNT_A.name, 'Frontend test tip A');
  assert.strictEqual(postedA.userId, ACCOUNT_A.id);
  assert.strictEqual(getCachedRecipeInteraction(RECIPE_ID).comments[0].userId, ACCOUNT_A.id);

  // Switch to Account B (clear cache on switch, fetch details)
  clearRecipeInteractionsCache();
  activeAuthHeader = `Bearer ${ACCOUNT_B.token}`;
  const detailsForB = await fetchRecipeDetails(RECIPE_ID);
  assert.strictEqual(detailsForB.comments.length, 1);
  assert.strictEqual(detailsForB.comments[0].userId, ACCOUNT_A.id);

  // Render drawer for Account B -> must NOT show Delete/Edit for Account A's comment
  const drawerHtmlB = renderRecipeCommentsDrawer({ id: RECIPE_ID, title: 'Tinola' }, { user: ACCOUNT_B });
  assert.ok(drawerHtmlB.includes('Frontend test tip A'), 'Account B sees Account A comment in UI');
  assert.ok(!drawerHtmlB.includes(`data-delete-comment-id="${postedA.id}"`), 'Account B must not see Delete for Account A comment');

  // Render drawer for Account A -> MUST show Delete/Edit for Account A's comment
  const drawerHtmlA = renderRecipeCommentsDrawer({ id: RECIPE_ID, title: 'Tinola' }, { user: ACCOUNT_A });
  assert.ok(drawerHtmlA.includes(`data-delete-comment-id="${postedA.id}"`), 'Account A sees Delete for own comment');

  // Render drawer when logged out -> shows sign-in prompt instead of form
  const drawerHtmlGuest = renderRecipeCommentsDrawer({ id: RECIPE_ID, title: 'Tinola' }, { user: null });
  assert.ok(drawerHtmlGuest.includes('comments-signin-btn'), 'Logged-out user sees sign-in prompt');

  // Unauthenticated post via frontend service rolls back optimistic cache and throws 401
  activeAuthHeader = '';
  await assert.rejects(
    () => postRecipeComment(RECIPE_ID, 'Guest', 'Should fail'),
    (err) => err.status === 401
  );
  assert.strictEqual(getCachedRecipeInteraction(RECIPE_ID).comments.length, 1, 'Failed post must roll back optimistic cache');

  // Edit & Delete via frontend service as Account A
  activeAuthHeader = `Bearer ${ACCOUNT_A.token}`;
  const editedA = await editRecipeComment(RECIPE_ID, postedA.id, 'Edited tip A');
  assert.strictEqual(editedA.comment, 'Edited tip A');
  await deleteRecipeComment(RECIPE_ID, postedA.id);
  assert.strictEqual(getCachedRecipeInteraction(RECIPE_ID).comments.length, 0);

  console.log('  ✅ Frontend service & CookModeTab UI ownership verified.');

  // 10. 6-Week Project Toggle Default OFF & Preference Preservation
  console.log('\nTest 10: Sustaining Human Life (6-Week Project) toggle defaults to OFF & preserves saved preferences');
  {
    const { getShowProjectTabPreference } = await import('../src/services/storage.js');
    const { renderSettingsModal } = await import('../src/components/SettingsModal.js');
    const { renderHeader } = await import('../src/components/Header.js');

    // Fresh install (key unset)
    localStorage.removeItem('kosherai_show_project_tab');
    assert.strictEqual(getShowProjectTabPreference(), false, 'Default 6-Week Project preference must be false');

    // Explicit user opt-in preserved
    localStorage.setItem('kosherai_show_project_tab', 'true');
    assert.strictEqual(getShowProjectTabPreference(), true, 'Explicit true preference must be preserved');

    // Explicit user opt-out preserved
    localStorage.setItem('kosherai_show_project_tab', 'false');
    assert.strictEqual(getShowProjectTabPreference(), false, 'Explicit false preference must be preserved');

    // Default SettingsModal and Header parameters render toggle OFF
    const defaultModalHtml = renderSettingsModal({}, 'dark');
    const toggleMatch = defaultModalHtml.match(/<input[^>]*id="toggle-project-tab-input"[^>]*>/);
    assert.ok(toggleMatch && !toggleMatch[0].includes('checked'), 'SettingsModal toggle must be unchecked by default');

    const defaultHeaderHtml = renderHeader(true, 'diet');
    assert.ok(!defaultHeaderHtml.includes('data-app-mode="course"'), 'Header must not show 6-Week Project mode button by default');
  }
  console.log('  ✅ 6-Week Project toggle default OFF and preference preservation verified.');

  // 11. Recipe Comments Drawer Anti-Flicker & Fetch Deduplication
  console.log('\nTest 11: Comments drawer anti-flicker (cached immediate render, loading state, no-anim, dedupe)');
  {
    const { setCachedRecipeInteraction } = await import('../src/services/recipeInteractionsStorage.js');
    clearRecipeInteractionsCache();

    // Uncached + loading -> shows loading skeleton, NOT empty-state flash
    const loadingHtml = renderRecipeCommentsDrawer(
      { id: RECIPE_ID, title: 'Tinola' },
      { user: ACCOUNT_A, commentsLoadingRecipeId: RECIPE_ID }
    );
    assert.ok(loadingHtml.includes('comments-loading-state'), 'Uncached initial load must render loading skeleton');
    assert.ok(!loadingHtml.includes('comments-empty-state'), 'Uncached initial load must not flash empty state');

    // Cached comments + loading -> immediately renders cached comments without loading skeleton
    setCachedRecipeInteraction(RECIPE_ID, {
      views: 3,
      likes: 1,
      commentsCount: 1,
      comments: [{ id: 'c_cached_1', recipeId: RECIPE_ID, userId: ACCOUNT_A.id, userName: ACCOUNT_A.name, comment: 'Cached tip', createdAt: new Date().toISOString() }]
    });
    const cachedHtml = renderRecipeCommentsDrawer(
      { id: RECIPE_ID, title: 'Tinola' },
      { user: ACCOUNT_A, commentsLoadingRecipeId: RECIPE_ID, skipDrawerAnimation: true }
    );
    assert.ok(cachedHtml.includes('Cached tip'), 'Cached comments must render immediately');
    assert.ok(!cachedHtml.includes('comments-loading-state'), 'Cached comments must not be replaced by loading skeleton');
    assert.ok(cachedHtml.includes('comments-drawer-no-anim'), 'skipDrawerAnimation must add no-anim class');

    // Concurrent fetchRecipeDetails deduplication
    let fetchCount = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      fetchCount++;
      await new Promise(r => setTimeout(r, 20));
      return origFetch(url, opts);
    };
    await Promise.all([fetchRecipeDetails(RECIPE_ID), fetchRecipeDetails(RECIPE_ID)]);
    assert.strictEqual(fetchCount, 1, 'Concurrent fetchRecipeDetails calls for same recipeId must deduplicate');
    globalThis.fetch = origFetch;
  }
  console.log('  ✅ Comments drawer anti-flicker & fetch deduplication verified.');

  console.log('\n🎉 ALL CROSS-ACCOUNT RECIPE COMMENTS TESTS PASSED!');
} finally {
  if (origDbUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = origDbUrl;
  }
}
