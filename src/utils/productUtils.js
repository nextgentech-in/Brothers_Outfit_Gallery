const HOMEPAGE_CATEGORY_IMAGES = {
  shirts: '/images/product-shirt-blue.png',
  't-shirts': '/images/product-tshirt-black.png',
  jeans: '/images/product-jeans-dark.png',
  trousers: '/images/product-trouser-beige.png',
  pants: '/images/product-trouser-beige.png',
  hoodies: '/images/product-hoodie-grey.png',
  jackets: '/images/product-jacket-black.png',
  kurta: '/images/product-shirt-blue.png',
  'ethnic wear': '/images/product-shirt-blue.png'
};

export function getHomepageCategoryItems(products = [], configuredCategories = null) {
  const categoryCounts = new Map();
  products.forEach(product => {
    const name = String(product.category || product.categoryId || '').trim();
    if (!name) return;

    const key = name.toLowerCase();
    const existing = categoryCounts.get(key);
    const firstImage = Array.isArray(product.images) ? product.images[0] : null;
    const image = product.thumbnailUrl
      || product.image
      || (typeof firstImage === 'object' ? firstImage?.url : firstImage);

    if (existing) {
      existing.count += 1;
      if (!existing.image && image) existing.image = image;
    } else {
      categoryCounts.set(key, { name, image, count: 1 });
    }
  });

  if (Array.isArray(configuredCategories)) {
    return configuredCategories.filter(category => category?.name?.trim()).map((category, index) => {
      const name = category.name.trim();
      const categoryName = String(category.category || name).trim();
      const matchingProducts = categoryCounts.get(categoryName.toLowerCase());
      return {
        ...category,
        id: category.id || `category-${index}-${categoryName.toLowerCase()}`,
        name,
        category: categoryName,
        image: category.image || matchingProducts?.image
          || HOMEPAGE_CATEGORY_IMAGES[categoryName.toLowerCase()]
          || '/images/hero.png'
      };
    }).slice(0, 12);
  }

  return [...categoryCounts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 9)
    .map(category => ({
      ...category,
      id: `auto-${category.name.toLowerCase()}`,
      category: category.name,
      image: category.image
        || HOMEPAGE_CATEGORY_IMAGES[category.name.toLowerCase()]
        || '/images/hero.png'
    }))
    .slice(0, 12);
}

export function getProductDisplayName(value) {
  const name = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+\(\d+\)$/, '');
  if (!name) return '';

  const segments = name.split(/\s+[-–—|]\s+/);
  while (segments.length > 1) {
    const last = segments[segments.length - 1].toLowerCase();
    const previous = segments[segments.length - 2].toLowerCase();
    if (last !== previous) break;
    segments.pop();
  }
  if (segments.length < name.split(/\s+[-–—|]\s+/).length) {
    return segments.join(' - ');
  }

  const words = name.split(' ');
  for (let length = Math.floor(words.length / 2); length > 0; length -= 1) {
    const prefix = words.slice(words.length - length * 2, words.length - length);
    const suffix = words.slice(-length);
    if (prefix.join(' ').toLowerCase() === suffix.join(' ').toLowerCase()) {
      return words.slice(0, -length).join(' ');
    }
  }

  return name;
}

export function getProductImages(product) {
  const sourceImages = Array.isArray(product?.images) ? product.images : [];
  const preferredUrl = product?.thumbnailUrl || product?.image || '';
  const validImages = sourceImages
    .map((image, index) => ({
      image,
      index,
      url: typeof image === 'string' ? image : image?.url || image?.thumbnailUrl || ''
    }))
    .filter(entry => entry.url);

  if (validImages.length === 0) {
    const fallbackUrl = product?.thumbnailUrl || product?.image;
    return fallbackUrl ? [fallbackUrl] : [];
  }

  validImages.sort((a, b) => {
    const primaryDifference = Number(Boolean(b.image?.isPrimary)) - Number(Boolean(a.image?.isPrimary));
    if (primaryDifference) return primaryDifference;
    const preferredDifference = Number(b.url === preferredUrl) - Number(a.url === preferredUrl);
    if (preferredDifference) return preferredDifference;
    const orderA = Number.isFinite(Number(a.image?.sortOrder)) ? Number(a.image.sortOrder) : a.index;
    const orderB = Number.isFinite(Number(b.image?.sortOrder)) ? Number(b.image.sortOrder) : b.index;
    return orderA - orderB || a.index - b.index;
  });

  const seen = new Set();
  return validImages
    .filter(({ image, url }) => {
      const color = typeof image === 'object' && image !== null
        ? String(image.color || '').trim().toLowerCase()
        : '';
      const key = `${url.trim().toLowerCase()}|${color}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ image }) => image);
}

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
