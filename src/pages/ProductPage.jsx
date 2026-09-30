import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductBySlug, isProductInStock } from '../services/productService';
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
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(() => !product);
  const [selectedColor, setSelectedColor] = useState(() => {
    const firstCol = product?.colors?.[0];
    return firstCol ? (firstCol.name || firstCol) : 'Black';
  });
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  // Fetch product from Firebase (SWR background refresh)
  useEffect(() => {
    window.scrollTo(0, 0);
    let isCurrent = true;

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
    } catch {}

    if (cachedProd) {
      setProduct(cachedProd);
      setLoading(false);
      const firstCol = cachedProd?.colors?.[0];
      setSelectedColor(firstCol ? (firstCol.name || firstCol) : 'Black');
    } else {
      setProduct(null);
      setLoading(true);
    }

    setSelectedColorIndex(0);

    const fetchProduct = async () => {
      try {
        const prod = await getProductBySlug(slug);
        if (isCurrent && prod) {
          setProduct(prod);
          const firstCol = prod?.colors?.[0];
          setSelectedColor(firstCol ? (firstCol.name || firstCol) : 'Black');
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    fetchProduct();

    return () => {
      isCurrent = false;
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
