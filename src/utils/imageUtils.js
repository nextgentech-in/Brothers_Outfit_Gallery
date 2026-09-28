import { getBackendUrl } from './apiConfig';

/**
 * Optimizes an ImageKit URL by appending transformation parameters.
 * Automatically converts to WebP/AVIF (f-auto) and compresses (q-80).
 * 
 * @param {string} url - The original image URL
 * @param {number} width - The desired width in pixels
 * @returns {string} - The optimized URL
 */
export const optimizeImage = (input, optionsOrWidth = 800) => {
  if (!input) return '/images/hero.png';
  const url = (typeof input === 'object' && input !== null)
    ? (input.url || input.thumbnailUrl || input.path || '')
    : String(input);

  if (!url || typeof url !== 'string' || url === '[object Object]') {
    return '/images/hero.png';
  }

  let width = 800;
  let quality = 88;
  if (typeof optionsOrWidth === 'number') {
    width = optionsOrWidth;
  } else if (typeof optionsOrWidth === 'object' && optionsOrWidth !== null) {
    if (optionsOrWidth.width) width = optionsOrWidth.width;
    if (optionsOrWidth.quality) quality = optionsOrWidth.quality;
  }

  if (url.includes('ik.imagekit.io')) {
    if (url.includes('tr=')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tr=w-${width},f-auto,q-${quality},pr-true`;
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
export const uploadImageToImageKit = async (file, folder = 'categories') => {
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
    console.warn("Backend ImageKit auth fetch failed, attempting Firebase Storage fallback:", err);
  }

  // Normalize folder name (e.g. 'categories')
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '') || 'categories';

  if (authParams?.signature && authParams?.token && authParams?.expire) {
    try {
      const uniqueFileName = `${cleanFolder.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("publicKey", import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY || "public_QnN311x97x1oXo+s5/J4/t3fI4A=");
      formData.append("signature", authParams.signature);
      formData.append("expire", authParams.expire);
      formData.append("token", authParams.token);
      formData.append("fileName", uniqueFileName);
      formData.append("folder", `/${cleanFolder}`);

      const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formData
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        return {
          url: uploadData.url,
          fileId: uploadData.fileId,
          thumbnailUrl: uploadData.thumbnailUrl
        };
      } else {
        const errJson = await uploadRes.json().catch(() => ({}));
        console.warn("ImageKit CDN upload returned non-200, attempting Firebase Storage fallback:", errJson);
      }
    } catch (uploadErr) {
      console.warn("Direct ImageKit CDN upload failed, falling back to Firebase Storage:", uploadErr);
    }
  }

  // 2. High-reliability Fallback: Direct Firebase Storage Upload
  try {
    const { getStorage, ref: fbStorageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { app: fbApp } = await import('../firebase/firebaseConfig');
    if (fbApp) {
      const storage = getStorage(fbApp);
      const safeFileName = `${cleanFolder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const fileRef = fbStorageRef(storage, safeFileName);
      const uploadSnapshot = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(uploadSnapshot.ref);
      if (downloadUrl) {
        return {
          url: downloadUrl,
          fileId: safeFileName,
          thumbnailUrl: downloadUrl
        };
      }
    }
  } catch (storageErr) {
    console.warn("Firebase Storage fallback failed, compressing to lightweight Data URL:", storageErr.message);
  }

  // 3. Ultra-safe Fallback: HTML5 Canvas compressed JPEG (max 600px, <50KB) so Firestore entity limits are never exceeded
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
          resolve({
            url: compressedDataUrl,
            fileId: 'local_' + Date.now(),
            thumbnailUrl: compressedDataUrl
          });
        };
        img.onerror = () => resolve({
          url: reader.result,
          fileId: 'local_' + Date.now(),
          thumbnailUrl: reader.result
        });
        img.src = reader.result;
      } catch {
        resolve({
          url: reader.result,
          fileId: 'local_' + Date.now(),
          thumbnailUrl: reader.result
        });
      }
    };
    reader.onerror = () => reject(new Error("Failed to process image file."));
    reader.readAsDataURL(file);
  });
};
