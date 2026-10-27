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
export function getRecipeImageUrl(imageRef, fallback = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80') {
  if (!imageRef) return fallback;
  
  if (typeof imageRef === 'string' && (imageRef.startsWith('http://') || imageRef.startsWith('https://'))) {
    return imageRef;
  }

  const clean = String(imageRef).replace(/^\/+/, '');
  const cleanFile = clean.endsWith('.webp') ? clean : `${clean}.webp`;
  const cloudName = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'dego6hgcb';
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${cleanFile}`;
}

export default {
  CLOUD_NAME,
  getRecipeImageUrl
};
