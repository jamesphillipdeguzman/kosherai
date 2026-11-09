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
export function initIngredientImageCache(protocolId = 'lid') {
  const normProto = (protocolId || 'lid').toLowerCase();
  if (!inMemoryCache[normProto]) {
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
 * Synchronously resolves the ingredient image URL.
 * Checks Neon Cloudinary mapping -> item.imageUrl -> generatedImages -> fallback.
 * 
 * Never constructs unverified URLs with hardcoded recipe versions;
 * always serves genuine Cloudinary secure URLs.
 *
 * @param {string} ingredientId - Item ID (e.g. 'salt-kosher')
 * @param {string} protocolId - Active diet protocol (defaults to 'lid')
 * @param {string|null} fallback - Fallback URL or null
 * @returns {string|null} Resolved secure image URL or null
 */
export function getIngredientImageUrl(ingredientId, protocolId = 'lid', fallback = null) {
  if (!ingredientId) return fallback || null;
  const normProto = (protocolId || 'lid').toLowerCase();

  // 1. Check in-memory / local Neon cache
  const cached = inMemoryCache[normProto] || initIngredientImageCache(normProto);
  if (cached && cached[ingredientId]) {
    const entry = cached[ingredientId];
    const url = typeof entry === 'string' ? entry : entry.secure_url;
    if (url && typeof url === 'string') return url;
  }

  // 2. Fallback to generated image asset cache if available
  if (generatedImages && generatedImages[ingredientId]) {
    return generatedImages[ingredientId];
  }

  // 3. Fallback provided by caller (e.g. item.imageUrl)
  if (fallback && typeof fallback === 'string' && (fallback.startsWith('http://') || fallback.startsWith('https://'))) {
    return fallback;
  }

  return null;
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
  getIngredientImageUrl,
  fetchIngredientImages,
  uploadIngredientImage,
  discoverAndMatchCloudinaryAssets,
  fetchAdminImageSummary,
  updateIngredientMapping,
  deleteIngredientMapping
};

