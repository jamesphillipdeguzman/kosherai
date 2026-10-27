// KosherAI - Resilient Cloudinary Helper & Dynamic URL Builder

export const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'dego6hgcb';

/**
 * Builds a fast, auto-formatted Cloudinary image URL.
 * Accepts either:
 * - A full Cloudinary URL
 * - A relative public ID path (e.g., 'kosherai/pinoy-keto/recipes/chicharon')
 * - A fallback placeholder
 *
 * @param {string|null} publicIdOrUrl
 * @param {string} fallback
 * @returns {string}
 */
export function getRecipeImageUrl(publicIdOrUrl, fallback = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80') {
  if (!publicIdOrUrl) return fallback;
  
  if (typeof publicIdOrUrl === 'string' && (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://'))) {
    return publicIdOrUrl;
  }

  // Auto-format, auto-quality, max width 800px for mobile performance
  const cleanPath = String(publicIdOrUrl).replace(/^\/+/, '');
  const cloudName = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'dego6hgcb';
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_800/${cleanPath}`;
}

export default {
  CLOUD_NAME,
  getRecipeImageUrl
};
