import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductBySlug, isProductInStock, subscribeToProduct } from '../services/productService';
import { getStoreSettings, DEFAULT_OFFERS_CONFIG } from '../services/adminService';
import ProductGallery from '../components/product/ProductGallery';
import ProductInfo from '../components/product/ProductInfo';
import ReviewsModule from '../components/product/ReviewsModule';
import RelatedProducts from '../components/product/RelatedProducts';
import SEO from '../components/common/SEO';
import './ProductPage.css';

export default function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(() => {
    try {
      const raw = sessionStorage.getItem('bo_products_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.data)) {
          return parsed.data.find(p => p.slug === slug || p.id === slug) || null;
        }
      }
    } catch { }
    return null;
  });
  const [loading, setLoading] = useState(() => !product);
  const [selectedColor, setSelectedColor] = useState('All');
  const [selectedColorIndex, setSelectedColorIndex] = useState(-1);
  const [offersConfig, setOffersConfig] = useState(() => {
    try {
      const cached = sessionStorage.getItem('bo_offers_config');
      if (cached) return JSON.parse(cached);
    } catch { }
    return DEFAULT_OFFERS_CONFIG;
  });
  const unsubscribeSnapshotRef = useRef(null);

  // Fetch offersConfig & store settings
  useEffect(() => {
    let isCurrent = true;
    getStoreSettings().then(settings => {
      if (isCurrent && settings?.offersConfig) {
        setOffersConfig(settings.offersConfig);
        try {
          sessionStorage.setItem('bo_offers_config', JSON.stringify(settings.offersConfig));
        } catch { }
      }
    }).catch(err => {
      console.warn('Could not load store settings:', err);
    });

    const handleOffersUpdated = (e) => {
      if (e?.detail) setOffersConfig(e.detail);
    };
    window.addEventListener('bo_offers_updated', handleOffersUpdated);

    return () => {
      isCurrent = false;
      window.removeEventListener('bo_offers_updated', handleOffersUpdated);
    };
  }, []);

  // Fetch product from Firebase (SWR background refresh + real-time stock subscription)
  useEffect(() => {
    window.scrollTo(0, 0);
    let isCurrent = true;

    if (unsubscribeSnapshotRef.current) {
      unsubscribeSnapshotRef.current();
      unsubscribeSnapshotRef.current = null;
    }

    // Check cache synchronously on slug change to avoid displaying previous product
    let cachedProd = null;
    try {
      const raw = sessionStorage.getItem('bo_products_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.data)) {
          cachedProd = parsed.data.find(p => p.slug === slug || p.id === slug) || null;
        }
      }
    } catch { }

    if (cachedProd) {
      setProduct(cachedProd);
      setLoading(false);
      setSelectedColor('All');

      // Attach real-time Firestore listener immediately if we have doc id
      if (cachedProd.id) {
        unsubscribeSnapshotRef.current = subscribeToProduct(cachedProd.id, (fresh) => {
          if (isCurrent && fresh) setProduct(fresh);
        });
      }
    } else {
      setProduct(null);
      setLoading(true);
    }

    setSelectedColorIndex(-1);

    const fetchProduct = async () => {
      try {
        // forceRefresh = true ensures we bypass stale session cache and get real-time stock
        const prod = await getProductBySlug(slug, true);
        if (isCurrent && prod) {
          setProduct(prod);
          setSelectedColor('All');

          if (!unsubscribeSnapshotRef.current && prod.id) {
            unsubscribeSnapshotRef.current = subscribeToProduct(prod.id, (fresh) => {
              if (isCurrent && fresh) setProduct(fresh);
            });
          }
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    fetchProduct();

    const handleProductsUpdated = () => {
      fetchProduct();
    };
    window.addEventListener('bo_products_updated', handleProductsUpdated);

    return () => {
      isCurrent = false;
      window.removeEventListener('bo_products_updated', handleProductsUpdated);
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }
    };
  }, [slug]);

  if (loading && !product) {
    return (
      <div className="product-page-container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', padding: '40px 0' }}>
          <div className="product-skeleton" style={{ minHeight: '500px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="product-skeleton" style={{ minHeight: '40px', width: '70%' }} />
            <div className="product-skeleton" style={{ minHeight: '30px', width: '40%' }} />
            <div className="product-skeleton" style={{ minHeight: '120px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!product || product.active === false || !isProductInStock(product)) {
    return (
      <div className="product-not-found">
        <SEO title="Product Not Available | Brother’s Outfit Gallery" noindex={true} />
        <h1>PRODUCT NOT AVAILABLE</h1>
        <p>This item is currently sold out or no longer available in the store.</p>
        <Link to="/shop" className="btn-back-shop">BACK TO SHOP</Link>
      </div>
    );
  }

  // Pre-bake images array ensuring a main image is pushed if images doesn't exist logically
  // Primary image is strictly first (index 0)
  let rawImages = product.images && product.images.length > 0
    ? [...product.images]
    : [product.thumbnailUrl || product.image || '/images/hero.png'];

  const primaryTarget = product.thumbnailUrl || null;
  rawImages.sort((a, b) => {
    const aIsPrimary = Boolean(
      (typeof a === 'object' && a !== null && a.isPrimary) ||
      (primaryTarget && (a === primaryTarget || (typeof a === 'object' && a?.url === primaryTarget)))
    );
    const bIsPrimary = Boolean(
      (typeof b === 'object' && b !== null && b.isPrimary) ||
      (primaryTarget && (b === primaryTarget || (typeof b === 'object' && b?.url === primaryTarget)))
    );
    if (aIsPrimary && !bIsPrimary) return -1;
    if (!aIsPrimary && bIsPrimary) return 1;
    return 0;
  });
  const allImages = rawImages.filter(Boolean);

  // Count actual displayable colors for gallery-color mapping
  const productColors = product.colors?.filter(c => {
    const name = c.name || c;
    return name !== 'Standard' && name !== 'Default';
  }) || [];
  const totalColors = productColors.length;

  const productName = product.title || product.name || 'Men’s Fashion Wear';
  const productPrice = Number(product.discountPrice || product.price || 0);
  const rawDescription = product.description
    ? product.description.replace(/<[^>]*>/g, '').trim().slice(0, 160)
    : `Shop ${productName} at Brother’s Outfit Gallery. Premium men’s fashion in Himatnagar, Gujarat. Express shipping across India and store pickup.`;

  const productImages = allImages.map(img =>
    typeof img === 'object' && img?.url ? img.url : (typeof img === 'string' ? img : '')
  ).filter(Boolean);

  const productUrl = `https://www.brothersoutfitgallery.com/product/${product.slug || slug}`;
  const ogImageUrl = productImages[0] || 'https://www.brothersoutfitgallery.com/images/hero.png';

  const productJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": productName,
      "description": rawDescription,
      "image": productImages.length > 0 ? productImages : [ogImageUrl],
      "sku": String(product.sku || product.id || slug),
      "category": product.category || "Men's Clothing",
      "brand": {
        "@type": "Brand",
        "name": "Brother’s Outfit Gallery"
      },
      "offers": {
        "@type": "Offer",
        "url": productUrl,
        "priceCurrency": "INR",
        "price": productPrice,
        "priceValidUntil": "2026-12-31",
        "itemCondition": "https://schema.org/NewCondition",
        "availability": isProductInStock(product)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        "seller": {
          "@type": "Organization",
          "name": "Brother’s Outfit Gallery"
        }
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.brothersoutfitgallery.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Shop",
          "item": "https://www.brothersoutfitgallery.com/shop"
        },
        ...(product.category ? [{
          "@type": "ListItem",
          "position": 3,
          "name": product.category,
          "item": `https://www.brothersoutfitgallery.com/shop?category=${encodeURIComponent(product.category)}`
        }] : []),
        {
          "@type": "ListItem",
          "position": product.category ? 4 : 3,
          "name": productName,
          "item": productUrl
        }
      ]
    }
  ];

  return (
    <div className="product-page-wrapper">
      <SEO
        title={`${productName} | Brother’s Outfit Gallery`}
        description={rawDescription}
        canonical={`/product/${product.slug || slug}`}
        ogImage={ogImageUrl}
        ogType="product"
        schema={productJsonLd}
      />
      <div className="product-page-container">
        {/* Navigation Breadcrumb creating natural space below navbar */}
        <nav aria-label="Breadcrumb" className="product-breadcrumbs">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/shop">Shop</Link>
          {product.category && (
            <>
              <span className="breadcrumb-separator">/</span>
              <Link to={`/shop?category=${encodeURIComponent(product.category)}`}>
                {product.category}
              </Link>
            </>
          )}
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current" title={product.title || product.name}>
            {product.title || product.name}
          </span>
        </nav>

        <div className="product-main-grid">
          <div className="product-gallery-section">
            <ProductGallery
              images={allImages}
              selectedColor={selectedColor}
              selectedColorIndex={selectedColorIndex}
              totalColors={totalColors}
              isOutOfStock={!isProductInStock(product)}
              productName={productName}
            />
          </div>

          <div className="product-info-section">
            <ProductInfo
              product={product}
              offersConfig={offersConfig}
              onColorChange={(colorName, colorIndex) => {
                if (colorName) setSelectedColor(colorName);
                if (colorIndex !== undefined) setSelectedColorIndex(colorIndex);
              }}
            />
          </div>
        </div>

        <RelatedProducts currentProductId={product.id} category={product.category || product.categoryId} currentProductSlug={product.slug} />

        <ReviewsModule product={product} />
      </div>
    </div>
  );
}
