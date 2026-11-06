// KosherAI - Resilient Cloudinary Helper & Dynamic URL Builder

export const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'dego6hgcb';
export const UPLOAD_PRESET = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) || 'kosherai_uploads';

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
  const cloudName = CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${cleanFile}`;
}

/**
 * Uploads an image source (File, Blob, data: URL, or blob: URL) directly to Cloudinary
 * using the unsigned upload preset, returning a permanent secure HTTPS URL.
 *
 * If the source is already a Cloudinary HTTPS URL, it is returned immediately without re-uploading.
 *
 * @param {File|Blob|string} source
 * @returns {Promise<string|null>}
 */
export async function uploadReceiptImageToCloudinary(source) {
  if (!source) return null;
  if (typeof source === 'string') {
    if (source.startsWith('https://res.cloudinary.com')) {
      return source;
    }
  }

  const cloudName = CLOUD_NAME;
  const uploadPreset = UPLOAD_PRESET;

  try {
    let fileToUpload = source;
    if (typeof source === 'string') {
      if (source.startsWith('blob:') || source.startsWith('data:')) {
        const res = await fetch(source);
        fileToUpload = await res.blob();
      } else {
        return source;
      }
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'kosherai/receipts');

    const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      return data.secure_url || data.url || null;
    } else {
      const errText = await res.text().catch(() => '');
      console.warn('[Cloudinary Upload Error]', res.status, errText);
    }
  } catch (err) {
    console.warn('[Cloudinary Upload Exception]', err);
  }
  return null;
}

export default {
  CLOUD_NAME,
  UPLOAD_PRESET,
  getRecipeImageUrl,
  uploadReceiptImageToCloudinary
};
