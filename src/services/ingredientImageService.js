// KosherAI - Ingredient Image Management & Client Cache Service
// Provides instant synchronous URL lookup, offline localStorage persistence,
// direct Cloudinary upload, and administrator synchronization with Neon PostgreSQL.

import { CLOUD_NAME, UPLOAD_PRESET } from '../utils/cloudinary.js';
import generatedImages from '../data/generatedImages.json' with { type: 'json' };
import { getAuthHeaders } from './authHeaders.js';

// In-memory runtime cache for O(1) synchronous lookup
const inMemoryCache = {};

/**
 * Gets storage key for a protocol
 */
function getStorageKey(protocolId = 'lid') {
  return `kosherai_ingredient_images_${protocolId.toLowerCase()}`;
}

/**
 * Loads cached mappings from localStorage into inMemoryCache
 */
export function initIngredientImageCache(protocolId = 'lid', reload = false) {
  const normProto = (protocolId || 'lid').toLowerCase();
  if (!inMemoryCache[normProto] || reload) {
    inMemoryCache[normProto] = {};
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(getStorageKey(normProto));
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            inMemoryCache[normProto] = parsed;
          }
        }
      } catch (_) {}
    }
  }
  return inMemoryCache[normProto];
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

    // 3a. Check cached database mapping for this ingredient ID under protocol
    const cached = inMemoryCache[normProto] || initIngredientImageCache(normProto);
    if (cached && cached[trimmed]) {
      const entry = cached[trimmed];
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

    // 3d. If the string contains a slash (e.g. 'kosherai/lid_protocol/ingredients/salt-kosher'),
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
export async function fetchIngredientImages(protocolId = 'lid', force = false) {
  const normProto = (protocolId || 'lid').toLowerCase();

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
      return inMemoryCache[normProto] || {};
    }

    const data = await res.json();
    if (data.success && data.images) {
      inMemoryCache[normProto] = data.images;
      if (typeof localStorage !== 'undefined') {
        try {
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

  return inMemoryCache[normProto] || {};
}

/**
 * Uploads an ingredient image to Cloudinary and persists the mapping to Neon PostgreSQL.
 *
 * @param {object} params
 * @param {File|Blob|string} params.file - Image file, Blob, or base64 data URI
 * @param {string} params.protocolId - e.g. 'lid', 'diabetic', etc.
 * @param {string} params.ingredientId - Target ingredient ID
 * @param {string} [params.status='active'] - Status of image mapping
 * @returns {Promise<object>} Created/updated mapping record
 */
export async function uploadIngredientImage({ file, protocolId = 'lid', ingredientId, status = 'active' }) {
  if (!file) throw new Error('No image file provided for upload.');
  if (!ingredientId) throw new Error('Target ingredient ID is required.');

  const normProto = (protocolId || 'lid').toLowerCase();
  const cloudName = CLOUD_NAME;
  const uploadPreset = UPLOAD_PRESET;
  const folder = `kosherai/${normProto}_protocol/ingredients`;

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

  // 1. Upload to Cloudinary via unsigned preset
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

  // 2. Persist mapping into Neon PostgreSQL via admin API
  const saveRes = await fetch('/api/admin/ingredient-images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      action: 'save',
      protocol_id: normProto,
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
    id: `img_${normProto}_${ingredientId}`,
    protocol_id: normProto,
    ingredient_id: ingredientId,
    public_id: publicId,
    secure_url: secureUrl,
    status
  };

  // 3. Update local cache immediately
  if (!inMemoryCache[normProto]) inMemoryCache[normProto] = {};
  inMemoryCache[normProto][ingredientId] = mapping;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(getStorageKey(normProto), JSON.stringify(inMemoryCache[normProto]));
    } catch (_) {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kosherai:ingredient-images-updated', {
      detail: { protocol: normProto, images: inMemoryCache[normProto] }
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

  return await res.json();
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

  const normProto = (protocol || 'lid').toLowerCase();
  if (ingredientId && inMemoryCache[normProto] && inMemoryCache[normProto][ingredientId]) {
    delete inMemoryCache[normProto][ingredientId];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(getStorageKey(normProto), JSON.stringify(inMemoryCache[normProto]));
      } catch (_) {}
    }
  }

  return await res.json();
}

export default {
  initIngredientImageCache,
  buildCloudinaryUrl,
  getIngredientImageUrl,
  fetchIngredientImages,
  uploadIngredientImage,
  discoverAndMatchCloudinaryAssets,
  fetchAdminImageSummary,
  updateIngredientMapping,
  deleteIngredientMapping
};

