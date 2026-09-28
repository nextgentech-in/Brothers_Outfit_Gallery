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
 * Extract all in-stock available sizes from a product.
 * Returns only sizes that currently have stock > 0.
 * If targetColor is supplied, checks variants for that specific color.
 * If no targetColor is supplied, checks if ANY in-stock variant exists for that size.
 *
 * @param {Object} product
 * @param {string|null} targetColor
 * @returns {string[]}
 */
export function getAvailableProductSizes(product, targetColor = null) {
  if (!product) return [];
  if (product.active === false || product.inStock === false) return [];

  const totalStock = parseInt(product.stock ?? product.quantity ?? product.qty, 10);
  if (!isNaN(totalStock) && totalStock <= 0) return [];

  // 1. If product has variants, evaluate variant-level inventory
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const cleanColor = (targetColor && targetColor !== 'All') ? String(targetColor).trim().toLowerCase() : null;

    // Collect unique sizes that have at least one in-stock variant
    const inStockSizes = new Set();
    product.variants.forEach(v => {
      const vSize = String(v.size || '').trim();
      if (!vSize) return;

      const vStock = parseInt(v.stock ?? v.quantity ?? v.qty, 10);
      // Skip out-of-stock / discontinued sizes (stock <= 0)
      if (isNaN(vStock) || vStock <= 0) return;

      if (cleanColor) {
        const vCol = String(v.color || '').trim().toLowerCase();
        if (vCol === cleanColor || vCol === 'standard' || vCol === 'default' || !vCol) {
          inStockSizes.add(vSize);
        }
      } else {
        inStockSizes.add(vSize);
      }
    });

    return Array.from(inStockSizes);
  }

  // 2. If product has no variants, check if sizes array exists and product has positive stock
  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    if (!isNaN(totalStock) && totalStock <= 0) return [];
    return product.sizes
      .map(s => {
        if (typeof s === 'object' && s !== null) {
          // If size object has its own stock, check it
          const sStock = parseInt(s.stock ?? s.quantity ?? s.qty, 10);
          if (!isNaN(sStock) && sStock <= 0) return '';
          return s.size || s.name || '';
        }
        return String(s);
      })
      .map(s => String(s).trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Extract all available sizes from a product in a normalized string array
 * @param {Object} product
 * @param {boolean} inStockOnly
 * @returns {string[]}
 */
export function getProductSizes(product, inStockOnly = false) {
  if (!product) return [];
  if (inStockOnly) {
    return getAvailableProductSizes(product);
  }
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

/**
 * Extract all available color names from a product in a normalized string array
 * @param {Object} product
 * @returns {string[]}
 */
export function getProductColors(product) {
  if (!product) return [];
  const fromColors = Array.isArray(product.colors)
    ? product.colors.map(c => (typeof c === 'object' && c !== null ? (c.name || c.color || '') : String(c)))
    : [];
  const fromVariants = Array.isArray(product.variants)
    ? product.variants.map(v => v.color || '')
    : [];
  return [...new Set([...fromColors, ...fromVariants])]
    .map(c => String(c).trim())
    .filter(Boolean);
}


