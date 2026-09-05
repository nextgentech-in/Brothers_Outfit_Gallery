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

