import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getOptimizedImageSrcSet, optimizeImage } from '../utils/imageUtils';
import './ShopByCategory.css';

// Preferred display order — categories not listed here appear at the end alphabetically
const CATEGORY_DISPLAY_ORDER = [
  'Kurta', 'Shirts', 'T-Shirts', 'Jeans', 'Trousers', 'Shorts',
  'Jackets', 'Hoodies', 'Accessories', 'Perfumes', 'Slippers',
  'Caps', 'Sunglasses', 'Watches', 'Wallets', 'Belts', 'Ethnic Wear'
];

// Polished local fallbacks keep the storefront useful before every category has an admin upload.
const CATEGORY_FALLBACK_IMAGES = {
  Kurta: '/images/category-rail/kurta-cutout.jpg',
  Shirts: '/images/category-rail/shirts-cutout-v2.jpg',
  'T-Shirts': '/images/category-rail/tshirts-cutout.jpg',
  Jeans: '/images/category-rail/jeans-cutout.jpg',
  Trousers: '/images/category-rail/trousers-cutout.jpg',
  Shorts: '/images/category-rail/shorts-cutout.jpg',
  Accessories: '/images/category-rail/accessories-cutout.jpg',
  Perfumes: '/images/category-rail/perfumes-cutout.jpg',
  'Ethnic Wear': '/images/category-rail/ethnic-wear-cutout.jpg'
};

const CURATED_CATEGORY_NAMES = Object.keys(CATEGORY_FALLBACK_IMAGES);
const HIDDEN_CATEGORY_NAMES = new Set(['wallets']);

const getCuratedCategories = () => CURATED_CATEGORY_NAMES.map(name => ({
  name,
  imageUrl: CATEGORY_FALLBACK_IMAGES[name],
  fallbackImage: CATEGORY_FALLBACK_IMAGES[name],
  productCount: 0
}));

/**
 * Extract the best available image URL from a product.
 * Handles string arrays, object arrays with .url, thumbnailUrl, and legacy .image field.
 */
function getProductImageUrl(product) {
  if (!product) return null;

  // 1. thumbnailUrl (admin-set primary)
  if (product.thumbnailUrl && typeof product.thumbnailUrl === 'string' && product.thumbnailUrl.trim()) {
    return product.thumbnailUrl;
  }

  // 2. images array
  if (Array.isArray(product.images) && product.images.length > 0) {
    // Find primary image first
    const primary = product.images.find(img =>
      typeof img === 'object' && img !== null && img.isPrimary
    );
    if (primary?.url) return primary.url;

    const first = product.images[0];
    if (typeof first === 'string' && first.trim()) return first;
    if (first && typeof first.url === 'string' && first.url.trim()) return first.url;
  }

  // 3. Legacy image field
  if (product.image && typeof product.image === 'string' && product.image.trim()) {
    return product.image;
  }

  return null;
}

export default function ShopByCategory() {
  // Render the lightweight local rail immediately. Product counts and custom
  // categories are enhanced after first paint instead of delaying the page.
  const [categories, setCategories] = useState(getCuratedCategories);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const buildCategories = async () => {
      try {
        // Keep Firestore and its metadata out of the first home-page paint.
        const [productService, configService] = await Promise.all([
          import('../services/productService'),
          import('../services/configService')
        ]);
        const [allProducts, homepageConfig] = await Promise.all([
          productService.fetchAllActiveProducts(),
          configService.getHomepageConfig().catch(() => ({}))
        ]);

        // Get admin-set custom category images from homepage config
        const adminCategoryImages = homepageConfig?.categoryImages || {};

        // Filter to only active + in-stock products
        const activeProducts = allProducts.filter(
          p => p.active !== false && productService.isProductInStock(p)
        );

        // Group by categoryId
        const categoryMap = {};
        activeProducts.forEach(product => {
          const catKey = product.categoryId || product.category || '';
          if (!catKey) return;
          if (!categoryMap[catKey]) {
            categoryMap[catKey] = [];
          }
          categoryMap[catKey].push(product);
        });

        // Combine categories from products and any admin-configured custom category images
        const allCategoryNames = new Set([
          ...CURATED_CATEGORY_NAMES,
          ...Object.keys(categoryMap),
          ...Object.keys(adminCategoryImages).filter(k => adminCategoryImages[k])
        ]);

        // Build category entries with representative image
        const categoryEntries = Array.from(allCategoryNames)
          .map(name => {
            const products = categoryMap[name] || [];
            // Prefer the actual product cutout for a catalog-style category rail.
            let imageUrl = CATEGORY_FALLBACK_IMAGES[name] || getProductImageUrl(products[0]) || adminCategoryImages[name] || null;
            if (!imageUrl) {
              const matchedKey = Object.keys(adminCategoryImages).find(k => k.toLowerCase() === name.toLowerCase());
              if (matchedKey) imageUrl = adminCategoryImages[matchedKey];
            }

            return {
              name,
              imageUrl,
              fallbackImage: CATEGORY_FALLBACK_IMAGES[name] || null,
              productCount: products.length
            };
          })
          .filter(cat => cat.imageUrl && !HIDDEN_CATEGORY_NAMES.has(cat.name.toLowerCase()));

        // Sort by preferred display order
        categoryEntries.sort((a, b) => {
          const idxA = CATEGORY_DISPLAY_ORDER.indexOf(a.name);
          const idxB = CATEGORY_DISPLAY_ORDER.indexOf(b.name);
          const orderA = idxA >= 0 ? idxA : 999;
          const orderB = idxB >= 0 ? idxB : 999;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });

        if (!cancelled) {
          setCategories(categoryEntries);
        }
      } catch (err) {
        console.warn('ShopByCategory: Failed to load categories:', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Do not compete with the hero and local category assets during startup.
    const idleId = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(buildCategories, { timeout: 1500 })
      : window.setTimeout(buildCategories, 700);

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, []);

  // Don't render the section at all if no categories after loading
  if (!loading && categories.length === 0) return null;

  return (
    <section className="sbc-section" aria-label="Shop by Category">
      <div className="sbc-container">
        {/* Section Heading */}
        <div className="sbc-heading">
          <span className="sbc-heading-eyebrow">SHOP BY</span>
          <h2 className="sbc-heading-title">CATEGORY</h2>
          <div className="sbc-heading-line" aria-hidden="true" />
        </div>

        {/* Horizontally scrollable catalog rail */}
        <div className="sbc-grid" role="list">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
              <div key={`skel-${i}`} className="sbc-card sbc-skeleton" role="listitem" aria-hidden="true">
                <div className="sbc-skeleton-shimmer" />
              </div>
            ))
            : categories.map(cat => (
              <Link
                key={cat.name}
                to={cat.name === 'Accessories' ? '/accessories' : `/shop?category=${encodeURIComponent(cat.name)}`}
                className="sbc-card"
                role="listitem"
                aria-label={`Shop ${cat.name}`}
              >
                {/* Product image */}
                <img
                  src={optimizeImage(cat.imageUrl, { width: 480, quality: 78 })}
                  srcSet={getOptimizedImageSrcSet(cat.imageUrl, [240, 360, 480], 78)}
                  sizes="(max-width: 768px) 30vw, 258px"
                  alt={`${cat.name} collection`}
                  className="sbc-card-bg"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    const image = e.currentTarget;
                    if (cat.fallbackImage && image.dataset.fallbackApplied !== 'true') {
                      image.dataset.fallbackApplied = 'true';
                      image.src = cat.fallbackImage;
                      image.removeAttribute('srcset');
                      return;
                    }
                    image.style.opacity = '0';
                  }}
                />
                {/* Category label */}
                <div className="sbc-card-info">
                  <span className="sbc-card-name">{cat.name.toUpperCase()}</span>
                  <span className="sbc-card-count">{cat.productCount} {cat.productCount === 1 ? 'Product' : 'Products'}</span>
                </div>
                {/* Hover arrow icon */}
                <div className="sbc-card-arrow" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))
          }
        </div>

        {/* Shop All CTA */}
        {!loading && categories.length > 0 && (
          <div className="sbc-footer">
            <Link to="/shop" className="sbc-shop-all-btn">
              SHOP ALL
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
