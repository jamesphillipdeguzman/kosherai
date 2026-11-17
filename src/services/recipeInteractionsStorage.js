// Client-Side Recipe Interactions Service (Views, Likes & Comments with Offline Queue)
// Handles optimistic updates, localStorage caching, and synchronization with /api/recipe-interactions
import { getAuthHeaders } from './authHeaders.js';

export const STORAGE_KEYS = {
  LIKED_RECIPES: 'kosherai_liked_recipes',
  INTERACTIONS_CACHE: 'kosherai_recipe_interactions',
  PENDING_ACTIONS: 'kosherai_pending_recipe_actions'
};

/**
 * Retrieves the set of liked recipe IDs from localStorage
 * @returns {string[]}
 */
export function getLikedRecipeIds() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LIKED_RECIPES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Checks if a recipe is currently marked as liked by the user
 * @param {string} recipeId
 * @returns {boolean}
 */
export function isRecipeLiked(recipeId) {
  if (!recipeId) return false;
  const liked = getLikedRecipeIds();
  return liked.includes(recipeId);
}

/**
 * Retrieves all cached interaction counts from localStorage
 * @returns {Record<string, { views: number, likes: number, commentsCount: number, comments?: any[] }>}
 */
export function getAllCachedInteractions() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INTERACTIONS_CACHE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Retrieves cached interaction for a specific recipe
 * @param {string} recipeId
 * @returns {{ views: number, likes: number, commentsCount: number, comments: any[] }}
 */
export function getCachedRecipeInteraction(recipeId) {
  if (!recipeId) return { views: 0, likes: 0, commentsCount: 0, comments: [] };
  const all = getAllCachedInteractions();
  const item = all[recipeId] || {};
  return {
    views: Number(item.views || 0),
    likes: Number(item.likes || 0),
    commentsCount: Number(item.commentsCount || (item.comments?.length || 0)),
    comments: Array.isArray(item.comments) ? item.comments : []
  };
}

/**
 * Saves updated interaction cache for a recipe
 */
export function setCachedRecipeInteraction(recipeId, partialData) {
  if (typeof localStorage === 'undefined' || !recipeId) return;
  try {
    const all = getAllCachedInteractions();
    const existing = all[recipeId] || { views: 0, likes: 0, commentsCount: 0, comments: [] };
    all[recipeId] = {
      ...existing,
      ...partialData
    };
    localStorage.setItem(STORAGE_KEYS.INTERACTIONS_CACHE, JSON.stringify(all));
  } catch (err) {
    console.warn('[recipeInteractions] Failed to update interactions cache:', err);
  }
}

/**
 * Retrieves queued offline actions
 */
export function getPendingRecipeActions() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_ACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Queues an action for later replay when online
 */
export function queueRecipeAction(actionObj) {
  if (typeof localStorage === 'undefined') return;
  try {
    const pending = getPendingRecipeActions();
    pending.push({
      ...actionObj,
      queuedAt: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(pending));
  } catch (err) {
    console.warn('[recipeInteractions] Failed to queue pending action:', err);
  }
}

/**
 * Fetches all recipe interaction counts from /api/recipe-interactions and updates cache
 * @returns {Promise<Record<string, { views: number, likes: number, commentsCount: number }>>}
 */
export async function fetchAllRecipeInteractions() {
  const localCache = getAllCachedInteractions();
  if (typeof fetch !== 'function') return localCache;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('/api/recipe-interactions', {
      method: 'GET',
      headers: getAuthHeaders({ 'Accept': 'application/json' }),
      credentials: 'include',
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res && res.ok) {
      const data = await res.json();
      if (data && data.interactions && typeof data.interactions === 'object') {
        const merged = { ...localCache };
        for (const [rid, stats] of Object.entries(data.interactions)) {
          merged[rid] = {
            ...(merged[rid] || {}),
            views: stats.views !== undefined ? stats.views : (merged[rid]?.views || 0),
            likes: stats.likes !== undefined ? stats.likes : (merged[rid]?.likes || 0),
            commentsCount: stats.commentsCount !== undefined ? stats.commentsCount : (merged[rid]?.commentsCount || 0)
          };
        }
        localStorage.setItem(STORAGE_KEYS.INTERACTIONS_CACHE, JSON.stringify(merged));
        return merged;
      }
    }
    return localCache;
  } catch (err) {
    console.warn('[recipeInteractions] fetchAllRecipeInteractions network notice (using cache):', err.message);
    return localCache;
  }
}

const inFlightRecipeDetailFetches = new Map();

/**
 * Fetches views, likes, and full comments list for a specific recipe
 * Deduplicates concurrent in-flight requests for the same recipeId.
 * @param {string} recipeId
 * @returns {Promise<{ views: number, likes: number, comments: any[] }>}
 */
export async function fetchRecipeDetails(recipeId) {
  const localData = getCachedRecipeInteraction(recipeId);
  if (!recipeId || typeof fetch !== 'function') return localData;

  if (inFlightRecipeDetailFetches.has(recipeId)) {
    return inFlightRecipeDetailFetches.get(recipeId);
  }

  const fetchPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`/api/recipe-interactions?recipeId=${encodeURIComponent(recipeId)}`, {
        method: 'GET',
        headers: getAuthHeaders({ 'Accept': 'application/json' }),
        credentials: 'include',
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res && res.ok) {
        const data = await res.json();
        const latestLocal = getCachedRecipeInteraction(recipeId);
        const updated = {
          views: data.views !== undefined ? data.views : latestLocal.views,
          likes: data.likes !== undefined ? data.likes : latestLocal.likes,
          commentsCount: Array.isArray(data.comments) ? data.comments.length : latestLocal.commentsCount,
          comments: Array.isArray(data.comments) ? data.comments : latestLocal.comments
        };
        setCachedRecipeInteraction(recipeId, updated);
        return updated;
      }
      return getCachedRecipeInteraction(recipeId);
    } catch (err) {
      console.warn(`[recipeInteractions] fetchRecipeDetails notice for ${recipeId}:`, err.message);
      return getCachedRecipeInteraction(recipeId);
    } finally {
      inFlightRecipeDetailFetches.delete(recipeId);
    }
  })();

  inFlightRecipeDetailFetches.set(recipeId, fetchPromise);
  return fetchPromise;
}

/**
 * Records a view for a recipe with optimistic local cache update
 * @param {string} recipeId
 * @returns {Promise<number>} Updated view count
 */
export async function recordRecipeView(recipeId) {
  if (!recipeId) return 0;
  const current = getCachedRecipeInteraction(recipeId);
  const newViews = current.views + 1;

  // Optimistic update
  setCachedRecipeInteraction(recipeId, { views: newViews });

  const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  if (!isOnline || typeof fetch !== 'function') {
    queueRecipeAction({ action: 'view', recipeId });
    return newViews;
  }

  try {
    const res = await fetch('/api/recipe-interactions', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ action: 'view', recipeId })
    });
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.views !== undefined) {
        setCachedRecipeInteraction(recipeId, { views: data.views });
        return data.views;
      }
    }
  } catch (err) {
    console.warn('[recipeInteractions] recordRecipeView network error (queued):', err.message);
    queueRecipeAction({ action: 'view', recipeId });
  }

  return newViews;
}

/**
 * Toggles like status for a recipe (optimistic UI update + server dispatch)
 * @param {string} recipeId
 * @returns {Promise<{ isLiked: boolean, likes: number }>}
 */
export async function toggleRecipeLike(recipeId) {
  if (!recipeId) return { isLiked: false, likes: 0 };

  const likedList = getLikedRecipeIds();
  const currentlyLiked = likedList.includes(recipeId);
  const newLikedState = !currentlyLiked;
  const delta = newLikedState ? 1 : -1;

  // 1. Update liked list in localStorage
  let updatedLikedList = [];
  if (newLikedState) {
    updatedLikedList = [...new Set([...likedList, recipeId])];
  } else {
    updatedLikedList = likedList.filter(id => id !== recipeId);
  }
  localStorage.setItem(STORAGE_KEYS.LIKED_RECIPES, JSON.stringify(updatedLikedList));

  // 2. Optimistic count update in cache
  const current = getCachedRecipeInteraction(recipeId);
  const newLikesCount = Math.max(0, current.likes + delta);
  setCachedRecipeInteraction(recipeId, { likes: newLikesCount });

  // 3. Dispatch to API or queue
  const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  if (!isOnline || typeof fetch !== 'function') {
    queueRecipeAction({ action: 'like', recipeId, delta });
    return { isLiked: newLikedState, likes: newLikesCount };
  }

  try {
    const res = await fetch('/api/recipe-interactions', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ action: 'like', recipeId, delta })
    });
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.likes !== undefined) {
        setCachedRecipeInteraction(recipeId, { likes: data.likes });
        return { isLiked: newLikedState, likes: data.likes };
      }
    }
  } catch (err) {
    console.warn('[recipeInteractions] toggleRecipeLike network error (queued):', err.message);
    queueRecipeAction({ action: 'like', recipeId, delta });
  }

  return { isLiked: newLikedState, likes: newLikesCount };
}

/**
 * Clears cached recipe interactions and pending actions (e.g. on sign-out or account switch)
 */
export function clearRecipeInteractionsCache() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEYS.INTERACTIONS_CACHE);
    localStorage.removeItem(STORAGE_KEYS.PENDING_ACTIONS);
    localStorage.removeItem(STORAGE_KEYS.LIKED_RECIPES);
  } catch (err) {
    console.warn('[recipeInteractions] Failed to clear cache:', err);
  }
}

/**
 * Posts a community compliance tip / comment on a recipe
 * @param {string} recipeId
 * @param {string} userName
 * @param {string} comment
 * @returns {Promise<object>} The posted comment
 */
export async function postRecipeComment(recipeId, userName, comment) {
  if (!recipeId || !comment || !comment.trim()) {
    throw new Error('Recipe ID and comment text are required.');
  }

  const commentObj = {
    id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recipeId,
    userName: (userName || 'Caregiver / Cook').trim() || 'Caregiver / Cook',
    comment: comment.trim(),
    createdAt: new Date().toISOString()
  };

  // 1. Optimistic update in cache
  const current = getCachedRecipeInteraction(recipeId);
  const previousComments = Array.isArray(current.comments) ? current.comments : [];
  const updatedComments = [commentObj, ...previousComments];
  setCachedRecipeInteraction(recipeId, {
    comments: updatedComments,
    commentsCount: updatedComments.length
  });

  // 2. Dispatch to API or queue
  const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  if (!isOnline || typeof fetch !== 'function') {
    queueRecipeAction({ action: 'comment', ...commentObj });
    return commentObj;
  }

  try {
    const res = await fetch('/api/recipe-interactions', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({
        action: 'comment',
        id: commentObj.id,
        recipeId,
        userName: commentObj.userName,
        comment: commentObj.comment
      })
    });

    if (res && res.ok) {
      const data = await res.json();
      if (data && data.comment) {
        const latest = getCachedRecipeInteraction(recipeId);
        const reconciled = (latest.comments || []).map(c =>
          c.id === commentObj.id ? data.comment : c
        );
        if (!reconciled.some(c => c.id === data.comment.id)) {
          reconciled.unshift(data.comment);
        }
        setCachedRecipeInteraction(recipeId, {
          comments: reconciled,
          commentsCount: reconciled.length
        });
        return data.comment;
      }
      return commentObj;
    }

    // Server rejected the request (e.g. 401 Unauthorized, 400, 500): rollback optimistic cache
    setCachedRecipeInteraction(recipeId, {
      comments: previousComments,
      commentsCount: previousComments.length
    });
    let errData = {};
    try {
      errData = await res.json();
    } catch (_) {}
    const apiErr = new Error(errData?.message || 'Failed to post comment.');
    apiErr.status = res?.status || 500;
    apiErr.code = errData?.error || 'POST_COMMENT_FAILED';
    throw apiErr;
  } catch (err) {
    if (err && typeof err.status === 'number') {
      throw err;
    }
    console.warn('[recipeInteractions] postRecipeComment network error (queued):', err.message);
    queueRecipeAction({ action: 'comment', ...commentObj });
    return commentObj;
  }
}

/**
 * Edits an existing recipe comment owned by the authenticated user (or admin)
 * @param {string} recipeId
 * @param {string} commentId
 * @param {string} commentText
 * @returns {Promise<object>} Updated comment
 */
export async function editRecipeComment(recipeId, commentId, commentText) {
  if (!recipeId || !commentId || !commentText || !commentText.trim()) {
    throw new Error('Recipe ID, comment ID, and comment text are required.');
  }

  const res = await fetch('/api/recipe-interactions', {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({
      id: commentId,
      recipeId,
      comment: commentText.trim()
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || 'Failed to edit comment.');
    err.status = res.status;
    err.code = data?.error || 'EDIT_COMMENT_FAILED';
    throw err;
  }

  const updatedComment = data.comment || { id: commentId, recipeId, comment: commentText.trim() };
  const current = getCachedRecipeInteraction(recipeId);
  const updatedList = (current.comments || []).map(c =>
    c.id === commentId ? { ...c, ...updatedComment } : c
  );
  setCachedRecipeInteraction(recipeId, {
    comments: updatedList,
    commentsCount: updatedList.length
  });

  return updatedComment;
}

/**
 * Deletes an existing recipe comment owned by the authenticated user (or admin)
 * @param {string} recipeId
 * @param {string} commentId
 * @returns {Promise<boolean>}
 */
export async function deleteRecipeComment(recipeId, commentId) {
  if (!recipeId || !commentId) {
    throw new Error('Recipe ID and comment ID are required.');
  }

  const res = await fetch(`/api/recipe-interactions?id=${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders({ 'Accept': 'application/json' }),
    credentials: 'include'
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || 'Failed to delete comment.');
    err.status = res.status;
    err.code = data?.error || 'DELETE_COMMENT_FAILED';
    throw err;
  }

  const current = getCachedRecipeInteraction(recipeId);
  const updatedList = (current.comments || []).filter(c => c.id !== commentId);
  setCachedRecipeInteraction(recipeId, {
    comments: updatedList,
    commentsCount: updatedList.length
  });

  return true;
}

/**
 * Synchronizes any queued offline interactions (views, likes, comments)
 */
export async function syncPendingRecipeInteractions() {
  const pending = getPendingRecipeActions();
  if (!pending.length || typeof fetch !== 'function') return { synced: 0, remaining: pending.length };

  const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  if (!isOnline) return { synced: 0, remaining: pending.length };

  let synced = 0;
  const remaining = [];

  for (const actionItem of pending) {
    try {
      const res = await fetch('/api/recipe-interactions', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(actionItem)
      });
      if (res && res.ok) {
        synced++;
      } else if (res && (res.status === 400 || res.status === 403 || res.status === 404)) {
        // Drop permanent client/authorization errors so they don't block the queue
      } else {
        remaining.push(actionItem);
      }
    } catch {
      remaining.push(actionItem);
    }
  }

  localStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(remaining));
  return { synced, remaining: remaining.length };
}
