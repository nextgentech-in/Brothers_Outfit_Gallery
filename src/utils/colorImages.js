// Helpers for colour-linked product images.
// Each image may carry `color` (linked colour name) and `isColorPrimary`
// (the cover photo shown first when that colour is selected).

const GENERAL_COLORS = new Set(['', 'all', 'general', 'all colors', 'standard', 'default']);

export const imageUrlOf = (img) =>
  (img && typeof img === 'object' ? img.url : typeof img === 'string' ? img : '') || '';

export const imageColorOf = (img) =>
  (img && typeof img === 'object' && img.color ? String(img.color).trim() : '');

export const isGeneralColor = (color) => GENERAL_COLORS.has(String(color || '').trim().toLowerCase());

const sameColor = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Images linked to `color`, with that colour's primary image first.
export const sortColorImages = (images, color) => {
  const matched = (images || []).filter(img => imageUrlOf(img) && sameColor(imageColorOf(img), color));
  const primaryIdx = matched.findIndex(img => img && typeof img === 'object' && img.isColorPrimary);
  if (primaryIdx > 0) matched.unshift(matched.splice(primaryIdx, 1)[0]);
  return matched;
};

// URL of the primary image for a colour, or '' when the colour has no linked images.
export const getColorPrimaryImageUrl = (product, color) => {
  if (!product || isGeneralColor(color)) return '';
  return imageUrlOf(sortColorImages(product.images, color)[0]);
};

// Ensure exactly one primary per linked colour (first image of the colour wins when none is set).
export const normalizeColorPrimaries = (images) => {
  const seen = new Set();
  const withFlags = images.map(img => {
    const key = imageColorOf(img).toLowerCase();
    if (isGeneralColor(key) || !img.isColorPrimary || seen.has(key)) return { ...img, isColorPrimary: false };
    seen.add(key);
    return { ...img, isColorPrimary: true };
  });
  return withFlags.map(img => {
    const key = imageColorOf(img).toLowerCase();
    if (isGeneralColor(key) || seen.has(key)) return img;
    seen.add(key);
    return { ...img, isColorPrimary: true };
  });
};
