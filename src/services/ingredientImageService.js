// KosherAI - Ingredient Image Management & Client Cache Service
// Provides instant synchronous URL lookup, offline localStorage persistence,
// direct Cloudinary upload, and administrator synchronization with Neon PostgreSQL.

import { CLOUD_NAME, UPLOAD_PRESET } from '../utils/cloudinary.js';
import generatedImages from '../data/generatedImages.json' with { type: 'json' };
import { getAuthHeaders } from './authHeaders.js';
import { LID_DATABASE } from '../data/lidDatabase.js';

// In-memory runtime cache for O(1) synchronous lookup
const inMemoryCache = {};

// Unified Global Storage Keys (Images are shared across ALL dietary protocols)
export const GLOBAL_MAPPINGS_KEY = 'kosherai_global_ingredient_image_mappings';
export const GLOBAL_ADMIN_STORAGE_KEY = 'kosherai_global_admin_image_summary';

/**
 * Gets storage key for a protocol (maintains backwards compatibility)
 */
function getStorageKey(protocolId = 'global') {
  const norm = (protocolId || 'global').toLowerCase();
  if (norm === 'global' || norm === 'all') return GLOBAL_MAPPINGS_KEY;
  return `kosherai_ingredient_images_${norm}`;
}

function getAdminStorageKey(protocolId = 'global') {
  const norm = (protocolId || 'global').toLowerCase();
  if (norm === 'global' || norm === 'all') return GLOBAL_ADMIN_STORAGE_KEY;
  return `kosherai_admin_image_summary_${norm}`;
}

/**
 * Loads cached mappings from localStorage into inMemoryCache.
 * Image mappings are globally shared across all protocols.
 */
export function initIngredientImageCache(protocolId = 'global', reload = false) {
  const normProto = (protocolId || 'global').toLowerCase();

  if (!inMemoryCache[normProto] || reload) {
    inMemoryCache[normProto] = {};
    if (typeof localStorage !== 'undefined') {
      try {
        let stored = null;
        // 1. Check protocol-specific key if specific protocol requested
        if (normProto !== 'global' && normProto !== 'all') {
          stored = localStorage.getItem(getStorageKey(normProto));
        }
        // 2. Fall back to global mappings key
        if (!stored) {
          stored = localStorage.getItem(GLOBAL_MAPPINGS_KEY) || localStorage.getItem('kosherai_ingredient_images_lid');
        }
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            inMemoryCache[normProto] = parsed;
            inMemoryCache['global'] = { ...(inMemoryCache['global'] || {}), ...parsed };
          }
        }
      } catch (_) {}
    }
  }

  if (!inMemoryCache['global']) {
    inMemoryCache['global'] = inMemoryCache[normProto] || {};
  }
  return inMemoryCache[normProto] || inMemoryCache['global'];
}

/**
 * Retrieves valid cached admin summary and mappings, globally available.
 * Returns null if no cache exists.
 */
export function getCachedAdminSummary(protocolId = 'global') {
  const normProto = (protocolId || 'global').toLowerCase();
  if (typeof localStorage === 'undefined') return null;

  // 1. Direct global admin summary cache
  try {
    let raw = localStorage.getItem(GLOBAL_ADMIN_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(getAdminStorageKey(normProto)) || localStorage.getItem('kosherai_admin_image_summary_lid');
      if (raw) {
        localStorage.setItem(GLOBAL_ADMIN_STORAGE_KEY, raw);
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.mappings) && parsed.mappings.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}

  // 2. Fallback: Reconstruct from standard global ingredient images cache
  try {
    const cachedImages = initIngredientImageCache('global');
    if (cachedImages && typeof cachedImages === 'object') {
      const mappings = [];
      for (const [key, val] of Object.entries(cachedImages)) {
        if (!val) continue;
        if (typeof val === 'string') {
          mappings.push({
            id: `cache_global_${key}`,
            protocol_id: 'global',
            ingredient_id: key,
            secure_url: val,
            public_id: val.split('/upload/')[1] || key,
            status: 'active'
          });
        } else if (typeof val === 'object' && (val.secure_url || val.url || val.public_id)) {
          mappings.push({
            id: val.id || `cache_global_${val.ingredient_id || key}`,
            protocol_id: val.protocol_id || 'global',
            ingredient_id: val.ingredient_id || key,
            secure_url: val.secure_url || val.url || (val.public_id ? buildCloudinaryUrl(val.public_id) : ''),
            public_id: val.public_id || key,
            status: val.status || 'active'
          });
        }
      }

      if (mappings.length > 0) {
        return {
          success: true,
          protocol: normProto,
          mappings,
          stats: {
            totalIngredients: 36,
            withImage: mappings.length,
            missingImage: Math.max(0, 36 - mappings.length),
            pendingReview: 0
          }
        };
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Persists refreshed admin summary and mappings into global localStorage,
 * and updates inMemoryCache for instant O(1) synchronous lookups across all protocols.
 */
export function saveAdminImageCache(protocolId = 'global', summaryData) {
  if (!summaryData || typeof localStorage === 'undefined') return;
  const normProto = (protocolId || 'global').toLowerCase();

  try {
    localStorage.setItem(GLOBAL_ADMIN_STORAGE_KEY, JSON.stringify(summaryData));
    localStorage.setItem(getAdminStorageKey(normProto), JSON.stringify(summaryData));
  } catch (_) {}

  // Synchronize global image cache so public/checker/search lookups across all protocols benefit immediately
  if (Array.isArray(summaryData.mappings)) {
    const imagesMap = {};
    for (const m of summaryData.mappings) {
      if (m.status === 'active' && (m.secure_url || m.url)) {
        imagesMap[m.ingredient_id] = {
          id: m.id,
          protocol_id: m.protocol_id || 'global',
          ingredient_id: m.ingredient_id,
          public_id: m.public_id,
          secure_url: m.secure_url || m.url,
          status: m.status
        };
        // Also index lowercase
        if (m.ingredient_id) {
          imagesMap[m.ingredient_id.toLowerCase()] = imagesMap[m.ingredient_id];
        }
      }
    }
    inMemoryCache['global'] = imagesMap;
    inMemoryCache[normProto] = imagesMap;
    try {
      localStorage.setItem(GLOBAL_MAPPINGS_KEY, JSON.stringify(imagesMap));
      localStorage.setItem(getStorageKey(normProto), JSON.stringify(imagesMap));
    } catch (_) {}
  }
}

/**
 * Standardized single helper for resolving ingredient gallery images across
 * gallery thumbnails, inspection dialog, and upload/replacement states.
 */
export function resolveGalleryIngredientImage(item, mapping, protocolId = 'lid') {
  const normProto = (protocolId || 'lid').toLowerCase();

  // 1. Direct mapping from database / API
  if (mapping) {
    const secureUrl = mapping.secure_url || mapping.url || (mapping.public_id ? buildCloudinaryUrl(mapping.public_id, mapping.version || mapping.asset_version) : null);
    if (secureUrl && /^https?:\/\//i.test(secureUrl)) {
      return {
        url: secureUrl,
        isMapped: mapping.status !== 'inactive',
        isPending: mapping.status === 'pending_review',
        publicId: mapping.public_id || null,
        status: mapping.status || 'active',
        mapping
      };
    }
  }

  // 2. Lookup in cache by item id / name / slug
  const itemId = typeof item === 'object' ? item.id : item;
  const itemUrl = typeof item === 'object' ? item.imageUrl : null;
  const cachedUrl = getIngredientImageUrl(itemId, normProto, itemUrl);
  if (cachedUrl && /^https?:\/\//i.test(cachedUrl)) {
    return {
      url: cachedUrl,
      isMapped: true,
      isPending: false,
      publicId: cachedUrl.split('/upload/')[1] || itemId,
      status: 'active',
      mapping: null
    };
  }

  return {
    url: null,
    isMapped: false,
    isPending: false,
    publicId: null,
    status: 'missing',
    mapping: null
  };
}

/**
 * Constructs an optimized Cloudinary delivery URL from a confirmed public ID.
 * Follows Cloudinary standard:
 * https://res.cloudinary.com/[CLOUD_NAME]/image/upload/f_auto,q_auto,w_400,c_limit/[VERSION/][PUBLIC_ID]
 *
 * @param {string} publicId - Confirmed Cloudinary public ID
 * @param {string|number|null} version - Optional asset version
 * @returns {string|null}
 */
export function buildCloudinaryUrl(publicId, version = null) {
  if (!publicId) return null;
  if (typeof publicId === 'string' && /^https?:\/\//i.test(publicId)) {
    return publicId;
  }

  const cleanId = String(publicId).replace(/^\/+/, '');
  const cloudName = CLOUD_NAME || 'dego6hgcb';
  const vPart = version ? `v${String(version).replace(/^v/, '')}/` : '';

  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_400,c_limit/${vPart}${cleanId}`;
}

/**
 * Centrally and safely resolves the ingredient image URL.
 * 
 * Supports:
 * 1. An existing complete Cloudinary HTTPS URL.
 * 2. An object with secure_url, url, or public_id (from Cloudinary or database mapping).
 * 3. An ingredient database item object (with id, imageUrl, image).
 * 4. An ingredient slug / identifier (checks Neon database mapping & local cache).
 * 5. A confirmed Cloudinary public ID (builds optimized delivery URL).
 * 
 * Never blindly prepends folders or invents unverified URLs.
 * Returns null or designed fallback when no image exists, avoiding 404 network errors.
 *
 * @param {string|object|null} imageOrItem - Image URL, public ID, database mapping, or ingredient item/ID
 * @param {string} protocolId - Dietary protocol ID (defaults to 'lid')
 * @param {string|null} fallback - Optional fallback URL
 * @returns {string|null} Resolved secure image URL or null
 */
export function getIngredientImageUrl(imageOrItem, protocolId = 'lid', fallback = null) {
  if (!imageOrItem) return fallback || null;
  const normProto = (protocolId || 'lid').toLowerCase();

  // 1. If imageOrItem is an object
  if (typeof imageOrItem === 'object') {
    // 1a: Direct Cloudinary / database mapping record
    if (imageOrItem.secure_url && typeof imageOrItem.secure_url === 'string') {
      return imageOrItem.secure_url;
    }
    if (imageOrItem.url && typeof imageOrItem.url === 'string') {
      return imageOrItem.url;
    }
    if (imageOrItem.public_id) {
      return buildCloudinaryUrl(imageOrItem.public_id, imageOrItem.version || imageOrItem.asset_version);
    }

    // 1b: Ingredient database item (e.g. { id: 'salt-kosher', imageUrl: ..., name: ... })
    if (imageOrItem.imageUrl && typeof imageOrItem.imageUrl === 'string' && /^https?:\/\//i.test(imageOrItem.imageUrl)) {
      return imageOrItem.imageUrl;
    }
    if (imageOrItem.image && typeof imageOrItem.image === 'string' && /^https?:\/\//i.test(imageOrItem.image)) {
      return imageOrItem.image;
    }
    if (imageOrItem.id) {
      return getIngredientImageUrl(imageOrItem.id, normProto, imageOrItem.imageUrl || fallback);
    }

    return fallback || null;
  }

  // 2. Complete HTTPS URL (preserve as-is)
  if (typeof imageOrItem === 'string' && /^https?:\/\//i.test(imageOrItem)) {
    return imageOrItem;
  }

  // 3. String value: could be an ingredient ID/slug OR a confirmed Cloudinary public ID
  if (typeof imageOrItem === 'string') {
    const trimmed = imageOrItem.trim();
    if (!trimmed) return fallback || null;

    // 3a. Check cached database mapping for this ingredient ID in protocol or global library
    const cachedProto = inMemoryCache[normProto];
    const cachedGlobal = inMemoryCache['global'] || initIngredientImageCache(normProto);
    const cached = (cachedProto && (cachedProto[trimmed] || cachedProto[trimmed.toLowerCase()])) ? cachedProto : cachedGlobal;
    let entry = cached ? (cached[trimmed] || cached[trimmed.toLowerCase()]) : null;

    // If not found directly, check canonical match across standard ingredient database
    if (!entry) {
      const match = LID_DATABASE.find(item => 
        item.id === trimmed ||
        item.id.toLowerCase() === trimmed.toLowerCase() ||
        item.name.toLowerCase() === trimmed.toLowerCase() ||
        (Array.isArray(item.aliases) && item.aliases.some(a => a.toLowerCase() === trimmed.toLowerCase()))
      );
      if (match && cached) {
        entry = cached[match.id] || cached[match.id.toLowerCase()] || cached[match.name] || cached[match.name.toLowerCase()];
      }
    }

    if (entry) {
      if (typeof entry === 'string') {
        if (/^https?:\/\//i.test(entry)) return entry;
        return buildCloudinaryUrl(entry);
      }
      if (entry.secure_url) return entry.secure_url;
      if (entry.url) return entry.url;
      if (entry.public_id) return buildCloudinaryUrl(entry.public_id, entry.version || entry.asset_version);
    }

    // 3b. Fallback to generated image asset cache if available
    if (generatedImages && generatedImages[trimmed]) {
      return generatedImages[trimmed];
    }

    // 3c. If a valid fallback URL was provided by caller
    if (fallback && typeof fallback === 'string' && /^https?:\/\//i.test(fallback)) {
      return fallback;
    }

    // 3d. If the string contains a slash (e.g. 'kosherai/all_ingredients/salt-kosher' or legacy path),
    // it is a confirmed Cloudinary public ID path
    if (trimmed.includes('/')) {
      return buildCloudinaryUrl(trimmed);
    }

    // 3e. Otherwise, it is an unmapped ingredient identifier or slug without a confirmed image.
    // Do NOT generate a fake URL that 404s; return fallback or null.
    return fallback || null;
  }

  return fallback || null;
}

/**
 * Fetches the latest active ingredient images from Neon PostgreSQL (/api/ingredient-images)
 * and updates the in-memory cache and localStorage.
 */
export async function fetchIngredientImages(protocolId = 'global', force = false) {
  const normProto = (protocolId || 'global').toLowerCase();

  try {
    const res = await fetch(`/api/ingredient-images?protocol=${encodeURIComponent(normProto)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders()
      }
    });

    if (!res.ok) {
      console.warn('[ingredientImageService] Failed to fetch ingredient images:', res.status);
      return inMemoryCache['global'] || inMemoryCache[normProto] || {};
    }

    const data = await res.json();
    if (data.success && data.images) {
      inMemoryCache['global'] = data.images;
      inMemoryCache[normProto] = data.images;
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(GLOBAL_MAPPINGS_KEY, JSON.stringify(data.images));
          localStorage.setItem(getStorageKey(normProto), JSON.stringify(data.images));
        } catch (_) {}
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosherai:ingredient-images-updated', {
          detail: { protocol: normProto, images: data.images }
        }));
      }

      return data.images;
    }
  } catch (err) {
    console.warn('[ingredientImageService] Fetch exception:', err?.message || err);
  }

  return inMemoryCache['global'] || inMemoryCache[normProto] || {};
}

/**
 * Uploads an ingredient image to Cloudinary and persists the mapping to Neon PostgreSQL.
 * Destination folder is standardized globally to: kosherai/all_ingredients
 *
 * @param {object} params
 * @param {File|Blob|string} params.file - Image file, Blob, or base64 data URI
 * @param {string} params.protocolId - Optional context protocol
 * @param {string} params.ingredientId - Target ingredient ID
 * @param {string} [params.status='active'] - Status of image mapping
 * @returns {Promise<object>} Created/updated global mapping record
 */
export async function uploadIngredientImage({ file, protocolId = 'global', ingredientId, status = 'active' }) {
  if (!file) throw new Error('No image file provided for upload.');
  if (!ingredientId) throw new Error('Target ingredient ID is required.');

  const normProto = (protocolId || 'global').toLowerCase();
  const cloudName = CLOUD_NAME;
  const uploadPreset = UPLOAD_PRESET;
  const folder = 'kosherai/all_ingredients';

  const formData = new FormData();
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    const fileName = file.name || `${ingredientId}.webp`;
    formData.append('file', file, fileName);
  } else if (typeof file === 'string') {
    formData.append('file', file);
  } else {
    throw new Error('Unsupported image format for upload.');
  }

  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);
  formData.append('public_id', `${ingredientId}`);

  // 1. Upload to Cloudinary via unsigned preset into kosherai/all_ingredients
  const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: 'POST',
    body: formData
  });

  if (!cloudRes.ok) {
    const errText = await cloudRes.text().catch(() => '');
    throw new Error(`Cloudinary upload failed (${cloudRes.status}): ${errText}`);
  }

  const cloudData = await cloudRes.json();
  const secureUrl = cloudData.secure_url || cloudData.url;
  const publicId = cloudData.public_id;

  if (!secureUrl) {
    throw new Error('Cloudinary response missing secure_url.');
  }

  // 2. Persist global mapping into Neon PostgreSQL via admin API
  const saveRes = await fetch('/api/admin/ingredient-images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      action: 'save',
      protocol_id: 'global',
      ingredient_id: ingredientId,
      public_id: publicId,
      secure_url: secureUrl,
      asset_version: cloudData.version ? String(cloudData.version) : null,
      format: cloudData.format || 'webp',
      original_filename: cloudData.original_filename || `${ingredientId}.webp`,
      status
    })
  });

  if (!saveRes.ok) {
    const errText = await saveRes.text().catch(() => '');
    throw new Error(`Failed to save mapping to Neon (${saveRes.status}): ${errText}`);
  }

  const saveData = await saveRes.json();
  const mapping = saveData.mapping || {
    id: `img_global_${ingredientId}`,
    protocol_id: 'global',
    ingredient_id: ingredientId,
    public_id: publicId,
    secure_url: secureUrl,
    status
  };

  // 3. Update global local cache immediately
  if (!inMemoryCache['global']) inMemoryCache['global'] = {};
  inMemoryCache['global'][ingredientId] = mapping;
  if (!inMemoryCache[normProto]) inMemoryCache[normProto] = {};
  inMemoryCache[normProto][ingredientId] = mapping;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(GLOBAL_MAPPINGS_KEY, JSON.stringify(inMemoryCache['global']));
      localStorage.setItem(getStorageKey(normProto), JSON.stringify(inMemoryCache['global']));

      // Synchronize cached admin summary
      const adminSummary = getCachedAdminSummary('global');
      if (adminSummary && Array.isArray(adminSummary.mappings)) {
        const existingIdx = adminSummary.mappings.findIndex(m => m.ingredient_id === ingredientId);
        if (existingIdx >= 0) {
          adminSummary.mappings[existingIdx] = mapping;
        } else {
          adminSummary.mappings.unshift(mapping);
          if (adminSummary.stats) {
            adminSummary.stats.withImage = (adminSummary.stats.withImage || 0) + 1;
            adminSummary.stats.missingImage = Math.max(0, (adminSummary.stats.totalIngredients || 36) - adminSummary.stats.withImage);
          }
        }
        saveAdminImageCache('global', adminSummary);
      }
    } catch (_) {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kosherai:ingredient-images-updated', {
      detail: { protocol: 'global', images: inMemoryCache['global'] }
    }));
  }

  return mapping;
}

/**
 * Runs discovery on Cloudinary and matches existing assets to ingredients.
 */
export async function discoverAndMatchCloudinaryAssets({ assets = null, protocol = 'lid', folder = 'kosherai' } = {}) {
  const res = await fetch('/api/admin/ingredient-images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      action: 'discover',
      protocol,
      folder,
      assets: assets || undefined
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Discovery failed with status ${res.status}`);
  }

  const data = await res.json();
  // Refresh cache for the protocol
  await fetchIngredientImages(protocol, true);
  return data;
}

/**
 * Retrieves administrative image summary, counts, and mapping list.
 */
export async function fetchAdminImageSummary(protocol = 'all', status = 'all', search = '') {
  const query = new URLSearchParams({
    protocol,
    status,
    search,
    limit: '200'
  });

  const res = await fetch(`/api/admin/ingredient-images?${query.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders()
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Admin summary failed with status ${res.status}`);
  }

  const data = await res.json();
  if (data && data.success) {
    saveAdminImageCache(protocol, data);
  }
  return data;
}

/**
 * Updates a mapping's status or assigned ingredient
 */
export async function updateIngredientMapping(id, updates = {}) {
  const res = await fetch('/api/admin/ingredient-images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      action: 'update',
      id,
      ...updates
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Update failed with status ${res.status}`);
  }

  return await res.json();
}

/**
 * Deletes an ingredient image mapping
 */
export async function deleteIngredientMapping(id, protocol = 'lid', ingredientId = null) {
  const res = await fetch('/api/admin/ingredient-images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      action: 'delete',
      id
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Delete failed with status ${res.status}`);
  }

  const normProto = (protocol || 'global').toLowerCase();
  if (ingredientId) {
    if (inMemoryCache['global']) delete inMemoryCache['global'][ingredientId];
    if (inMemoryCache[normProto]) delete inMemoryCache[normProto][ingredientId];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(GLOBAL_MAPPINGS_KEY, JSON.stringify(inMemoryCache['global'] || {}));
        localStorage.setItem(getStorageKey(normProto), JSON.stringify(inMemoryCache['global'] || {}));
      } catch (_) {}
    }
  }

  // Also remove from global admin summary cache
  if (typeof localStorage !== 'undefined') {
    try {
      const summaryKeys = [GLOBAL_ADMIN_STORAGE_KEY, getAdminStorageKey(normProto)];
      for (const summaryKey of summaryKeys) {
        const raw = localStorage.getItem(summaryKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.mappings)) {
            parsed.mappings = parsed.mappings.filter(m => m.id !== id && m.ingredient_id !== ingredientId);
            if (parsed.stats && typeof parsed.stats.withImage === 'number') {
              parsed.stats.withImage = Math.max(0, parsed.stats.withImage - 1);
              parsed.stats.missingImage = Math.min(parsed.stats.totalIngredients || 36, (parsed.stats.missingImage || 0) + 1);
            }
            localStorage.setItem(summaryKey, JSON.stringify(parsed));
          }
        }
      }
    } catch (_) {}
  }

  return await res.json();
}

export default {
  initIngredientImageCache,
  getCachedAdminSummary,
  saveAdminImageCache,
  resolveGalleryIngredientImage,
  buildCloudinaryUrl,
  getIngredientImageUrl,
  fetchIngredientImages,
  uploadIngredientImage,
  discoverAndMatchCloudinaryAssets,
  fetchAdminImageSummary,
  updateIngredientMapping,
  deleteIngredientMapping
};

