import { getBackendUrl } from './apiConfig';

/**
 * Optimizes an ImageKit URL by appending transformation parameters.
 * Automatically converts to WebP/AVIF (f-auto) and compresses (q-80).
 * 
 * @param {string} url - The original image URL
 * @param {number} width - The desired width in pixels
 * @returns {string} - The optimized URL
 */
export const optimizeImage = (input, width = 500) => {
  if (!input) return '/images/hero.png';
  const url = (typeof input === 'object' && input !== null)
    ? (input.url || input.thumbnailUrl || input.path || '')
    : String(input);

  if (!url || typeof url !== 'string' || url === '[object Object]') {
    return '/images/hero.png';
  }

  if (url.includes('ik.imagekit.io')) {
    if (url.includes('tr=')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tr=w-${width},f-auto,q-75`;
  }
  return url;
};

/**
 * Uploads an image file directly to ImageKit with zero-delay and fallback authentication
 * 
 * @param {File} file - Browser File object
 * @param {string} folder - Destination folder on ImageKit (e.g. 'hero/')
 * @returns {Promise<{ url: string, fileId: string, thumbnailUrl: string }>}
 */
export const uploadImageToImageKit = async (file, folder = 'hero/') => {
  if (!file) throw new Error("No image file provided.");

  const backendUrl = getBackendUrl();
  let authParams = null;

  // 1. Fetch authentication parameters from backend
  try {
    const res = await fetch(`${backendUrl}/api/imagekit/auth`);
    if (res.ok) {
      authParams = await res.json();
    }
  } catch (err) {
    console.warn("Backend ImageKit auth fetch failed, testing client fallback:", err);
  }

  if (!authParams?.signature) {
    throw new Error("Unable to obtain ImageKit authentication. Please ensure the backend server is running.");
  }

  const uniqueFileName = `hero-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("publicKey", import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY || "public_QnN311x97x1oXo+s5/J4/t3fI4A=");
  formData.append("signature", authParams.signature);
  formData.append("expire", authParams.expire);
  formData.append("token", authParams.token);
  formData.append("fileName", uniqueFileName);
  formData.append("folder", folder);

  const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: formData
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    let parsed;
    try { parsed = JSON.parse(errText); } catch {}
    throw new Error(parsed?.message || errText || "Image upload failed");
  }

  const uploadData = await uploadRes.json();
  return {
    url: uploadData.url,
    fileId: uploadData.fileId,
    thumbnailUrl: uploadData.thumbnailUrl
  };
};
