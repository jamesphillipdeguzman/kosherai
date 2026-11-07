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
 * Automatically unwraps compression result objects like { blob, dataUrl }.
 * Never passes invalid objects or [object Object] to Cloudinary.
 *
 * @param {File|Blob|string|object} source
 * @returns {Promise<string|null>}
 */
export async function uploadReceiptImageToCloudinary(source) {
  if (!source) return null;

  // 1. Unpack wrapper objects like { blob, dataUrl }, { file }, or compression results
  let fileToUpload = source;
  if (source && typeof source === 'object' && !(typeof Blob !== 'undefined' && source instanceof Blob)) {
    if (source.blob && typeof Blob !== 'undefined' && source.blob instanceof Blob) {
      fileToUpload = source.blob;
    } else if (typeof source.dataUrl === 'string' && source.dataUrl.startsWith('data:')) {
      fileToUpload = source.dataUrl;
    } else if (source.file && (typeof Blob !== 'undefined' && source.file instanceof Blob)) {
      fileToUpload = source.file;
    } else if (typeof source.url === 'string' && source.url.startsWith('http')) {
      return source.url;
    } else if (typeof source.secure_url === 'string' && source.secure_url.startsWith('http')) {
      return source.secure_url;
    } else {
      console.warn('[Cloudinary] Unsupported source object wrapper:', source);
      return null;
    }
  }

  // 2. Handle string sources (Cloudinary URLs, data URIs, blob URLs)
  if (typeof fileToUpload === 'string') {
    // If already on Cloudinary, return immediately
    if (fileToUpload.startsWith('https://res.cloudinary.com')) {
      return fileToUpload;
    }

    // Guard against literal '[object Object]' or invalid strings
    if (fileToUpload.includes('[object Object]') || !fileToUpload.trim()) {
      console.warn('[Cloudinary] Refusing to upload invalid string source:', fileToUpload);
      return null;
    }

    if (fileToUpload.startsWith('blob:')) {
      try {
        const res = await fetch(fileToUpload);
        fileToUpload = await res.blob();
      } catch (e) {
        console.warn('[Cloudinary] Could not resolve blob: URL:', e);
        return null;
      }
    } else if (fileToUpload.startsWith('data:')) {
      // Cloudinary upload API accepts data: URIs directly
    } else if (fileToUpload.startsWith('http://') || fileToUpload.startsWith('https://')) {
      // Valid remote URL supported by Cloudinary
    } else {
      console.warn('[Cloudinary] Unrecognized string format for image upload');
      return null;
    }
  }

  const cloudName = CLOUD_NAME;
  const uploadPreset = UPLOAD_PRESET;

  try {
    const formData = new FormData();

    if (typeof Blob !== 'undefined' && fileToUpload instanceof Blob) {
      const fileName = fileToUpload.name || 'receipt.jpg';
      formData.append('file', fileToUpload, fileName);
    } else if (typeof fileToUpload === 'string') {
      formData.append('file', fileToUpload);
    } else {
      console.warn('[Cloudinary] Refusing to append non-file source to FormData:', fileToUpload);
      return null;
    }

    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'kosherai/receipts');

    const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      const resolvedUrl = data.secure_url || data.url || null;
      if (resolvedUrl && typeof resolvedUrl === 'string') {
        return resolvedUrl;
      }
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
