/**
 * Helper function to determine if a product belongs to Clothing/Apparel category
 * requiring mandatory size selection (S, M, L, XL, etc.) versus Accessories/Non-Apparel
 * where size selection is optional/automatic.
 * 
 * @param {Object} product 
 * @returns {boolean}
 */
export function isClothingProduct(product) {
  if (!product) return true;

  const category = (product.categoryId || product.category || '').toLowerCase();
  const name = (product.name || '').toLowerCase();

  // Non-clothing category keywords (Accessories, Watches, Belts, Sunglasses, Wallets, Perfumes, Bags, Caps)
  const nonClothingKeywords = [
    'accessori', 'watch', 'belt', 'cap', 'sunglass', 'wallet', 
    'perfume', 'bag', 'jewel', 'goggle', 'fragrance', 'tie', 'wallet'
  ];

  const isNonClothingCategory = nonClothingKeywords.some(k => category.includes(k) || name.includes(k));
  if (isNonClothingCategory) {
    return false;
  }

  // Clothing category keywords
  const clothingKeywords = [
    'shirt', 't-shirt', 'tee', 'pant', 'jean', 'jacket', 'hoodie', 
    'sweatshirt', 'dress', 'cloth', 'wear', 'short', 'suit', 'kurta', 
    'top', 'bottom', 'oversized', 'trouser', 'denim', 'blazer'
  ];

  const isClothing = clothingKeywords.some(k => category.includes(k) || name.includes(k));
  if (isClothing) return true;

  // Check if product variants / sizes contain standard apparel sizes (S, M, L, XL, XXL, etc.)
  const sizes = product.variants?.length > 0
    ? product.variants.map(v => v.size)
    : (product.sizes || []);

  const standardApparelSizes = ['S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'XS'];
  const hasApparelSizes = sizes.some(s => standardApparelSizes.includes(String(s).toUpperCase()));

  return hasApparelSizes;
}

/**
 * Extract all available sizes from a product in a normalized string array
 * @param {Object} product
 * @returns {string[]}
 */
export function getProductSizes(product) {
  if (!product) return [];
  const fromSizes = Array.isArray(product.sizes)
    ? product.sizes.map(s => (typeof s === 'object' && s !== null) ? (s.size || s.name || '') : String(s))
    : [];
  const fromVariants = Array.isArray(product.variants)
    ? product.variants.map(v => v.size || '')
    : [];
  return [...new Set([...fromSizes, ...fromVariants])]
    .map(s => String(s).trim())
    .filter(Boolean);
}

