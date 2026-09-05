import { getBackendUrl } from './apiConfig';

/**
 * Optimizes an ImageKit URL by appending transformation parameters.
 * Automatically converts to WebP/AVIF (f-auto) and compresses (q-80).
 * 
 * @param {string} url - The original image URL
 * @param {number} width - The desired width in pixels
 * @returns {string} - The optimized URL
 */
export const optimizeImage = (url, width = 500) => {
  if (typeof url !== 'string' || !url) return url;
  if (url.includes('ik.imagekit.io')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tr=w-${width},f-auto,q-80`;
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

  // 2. Client-side fallback if backend is momentarily unreachable
  if (!authParams?.signature) {
    const privateKey = import.meta.env.VITE_IMAGEKIT_PRIVATE_KEY || import.meta.env.IMAGEKIT_PRIVATE_KEY;
    if (privateKey && typeof window !== 'undefined' && window.crypto?.subtle) {
      try {
        const token = window.crypto.randomUUID ? window.crypto.randomUUID() : ('tok_' + Math.random().toString(36).slice(2) + Date.now());
        const expire = Math.floor(Date.now() / 1000) + 1800;
        const enc = new TextEncoder();
        const cryptoKey = await window.crypto.subtle.importKey(
          'raw',
          enc.encode(privateKey),
          { name: 'HMAC', hash: 'SHA-1' },
          false,
          ['sign']
        );
        const sigBuf = await window.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(token + expire));
        const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        authParams = { token, signature, expire };
      } catch (clientErr) {
        console.warn("Client signature fallback failed:", clientErr);
      }
    }
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
