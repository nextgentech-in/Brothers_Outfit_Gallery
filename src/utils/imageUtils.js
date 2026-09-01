/**
 * Optimizes an ImageKit URL by appending transformation parameters.
 * If the URL is not from ImageKit, it returns the original URL.
 * 
 * @param {string} url - The original image URL
 * @param {number} width - The desired width in pixels
 * @returns {string} - The optimized URL
 */
export const optimizeImage = (url, width) => {
  if (typeof url !== 'string' || !url) return url;
  if (url.includes('ik.imagekit.io')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tr=w-${width}`;
  }
  return url;
};
