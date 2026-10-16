import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { checkPincodeServiceability } from '../../services/delhiveryService';
import { isClothingProduct, getAvailableProductSizes } from '../../utils/productUtils';
import { useWishlist } from '../../context/WishlistContext';
import SizeGuideModal from '../common/SizeGuideModal';
import { flyProductToCart } from '../../utils/cartFlyAnimation';
import { normalizeToStandardColor } from '../../data/colorMaster.js';
import './ProductInfo.css';

const COLOR_SWATCHES = [
  ['black', '#111111'], ['white', '#f8fafc'], ['grey', '#9ca3af'], ['gray', '#9ca3af'],
  ['maroon', '#7f1d1d'], ['marron', '#7f1d1d'], ['brown', '#8b5e3c'], ['beige', '#d6c3a1'],
  ['khaki', '#b6a26d'], ['pink', '#d58a91'], ['purple', '#77608e'], ['blue', '#35679b'],
  ['green', '#259b4a'], ['olive', '#667a36'], ['yellow', '#d5a321'], ['red', '#bd3f3f'],
  ['orange', '#d96f29'], ['navy', '#173c6b'], ['cyan', '#59d5de'], ['rani', '#C41242']
];

function getColorSwatchStyle({ name, hex }) {
  if (hex && /^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(hex.trim())) {
    return { backgroundColor: hex.trim() };
  }

  const standard = normalizeToStandardColor(name);
  if (standard && standard.hex) {
    return { backgroundColor: standard.hex };
  }

  const normalizedName = String(name || '').toLowerCase();
  const colors = [...new Set(
    COLOR_SWATCHES
      .filter(([keyword]) => normalizedName.includes(keyword))
      .map(([, color]) => color)
  )];

  if (colors.length > 1) {
    return { backgroundImage: `linear-gradient(135deg, ${colors.join(', ')})` };
  }

  return { backgroundColor: colors[0] || '#9ca3af' };
}

// Reusable mock countdown logic mimicking SalePage behavior securely inside component space
function MiniCountdown({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!targetDate) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(targetDate).getTime() - now;
      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft('EXPIRED');
        return;
      }
      const d = Math.floor(distance / (1000 * 60 * 60 * 24));
      const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${d}D : ${h}H : ${m}M : ${s}S`);
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate || timeLeft === 'EXPIRED' || timeLeft === '') return null;

  return (
    <div className="product-info-countdown">
      OFFER ENDS IN {timeLeft}
    </div>
  );
}

export default function ProductInfo({ product, onColorChange, offersConfig }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};
  const { isInWishlist, toggleWishlist } = useWishlist() || {};
  const inWishlist = isInWishlist ? isInWishlist(product.id) : false;
  const [sizeError, setSizeError] = useState(false);

  const defaultFrontVariant = useMemo(() => {
    return product.variants?.find(v => v.isDefaultPrice) || null;
  }, [product.variants]);

  // Read variants/colors if present, else fallback - memoized
  const productColors = useMemo(() => {
    return product.colors?.length > 0 ? product.colors.map(c => c.name || c) : [];
  }, [product.colors]);

  // Extract all distinct colors available across colors and image tagging
  const availableColors = useMemo(() => {
    const list = [];
    if (product.colors && product.colors.length > 0) {
      product.colors.forEach(c => {
        const name = typeof c === 'object' ? c.name : c;
        const hex = typeof c === 'object' ? c.hex : null;
        if (name && !list.some(item => item.name.toLowerCase() === name.toLowerCase())) {
          list.push({ name, hex });
        }
      });
    }
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach(img => {
        if (typeof img === 'object' && img?.color) {
          const colName = String(img.color).trim();
          const lower = colName.toLowerCase();
          if (colName && lower !== 'all' && lower !== 'general' && lower !== 'all colors' && lower !== 'standard' && lower !== 'default') {
            if (!list.some(item => item.name.toLowerCase() === lower)) {
              list.push({ name: colName, hex: null });
            }
          }
        }
      });
    }
    return list;
  }, [product.colors, product.images]);

  const [selectedColor, setSelectedColor] = useState('All');
  const [selectedSize, setSelectedSize] = useState(() => defaultFrontVariant?.size || null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [deliveryPincode, setDeliveryPincode] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState(null);

  // Sync state if product changes without unmounting
  useEffect(() => {
    setSelectedSize(defaultFrontVariant?.size || null);
    setSelectedColor('All');
    onColorChange?.('All', -1);
  }, [product.id, defaultFrontVariant?.size]);

  // Determine if item is Clothing (where size selection is mandatory) vs Accessories
  const isClothing = isClothingProduct(product);

  const productSizes = useMemo(() => {
    return product.variants?.length > 0 ? [...new Set(product.variants.map(v => v.size))] : (product.sizes || []);
  }, [product.variants, product.sizes]);

  const productTotalStock = useMemo(() => {
    return product.variants?.length > 0 ? product.variants.reduce((acc, v) => acc + (parseInt(v.stock, 10) || 0), 0) : (product.stock || 0);
  }, [product.variants, product.stock]);

  // Available colors that have stock > 0
  const inStockColors = useMemo(() => {
    if (!product.variants || product.variants.length === 0) return availableColors;
    return availableColors.filter(col => {
      const colName = String(col.name || '').trim().toLowerCase();
      const colVariants = product.variants.filter(v => {
        const vCol = String(v.color || '').trim().toLowerCase();
        return vCol === colName || vCol === 'standard' || vCol === 'default';
      });
      return colVariants.length === 0 || colVariants.some(v => (parseInt(v.stock, 10) || 0) > 0);
    });
  }, [availableColors, product.variants]);

  // Only display sizes on front that currently have inventory > 0
  const visibleSizes = useMemo(() => {
    return getAvailableProductSizes(product, selectedColor);
  }, [product, selectedColor]);

  useEffect(() => {
    if (visibleSizes.length > 0 && (!selectedSize || !visibleSizes.includes(selectedSize))) {
      setSelectedSize(visibleSizes[0]);
    } else if (visibleSizes.length === 0 && selectedSize) {
      setSelectedSize(null);
    }
  }, [visibleSizes, selectedSize]);

  // Dynamic size-wise pricing matching selected size
  const matchedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) return null;
    const targetSize = selectedSize || defaultFrontVariant?.size || (productSizes.length > 0 ? productSizes[0] : null);
    if (!targetSize) return null;
    const effectiveColor = (selectedColor && selectedColor !== 'All')
      ? selectedColor
      : (availableColors[0]?.name || productColors[0] || null);

    return product.variants.find(v =>
      v.size === targetSize && (!v.color || v.color === effectiveColor || v.color === 'Standard' || v.color === 'Default')
    ) || product.variants.find(v => v.size === targetSize);
  }, [product.variants, selectedSize, selectedColor, productSizes, defaultFrontVariant, availableColors, productColors]);

  const defaultFrontPrice = (defaultFrontVariant?.price !== undefined && defaultFrontVariant?.price !== '' && !isNaN(Number(defaultFrontVariant?.price)))
    ? Number(defaultFrontVariant.price)
    : (defaultFrontVariant?.salePrice !== undefined && defaultFrontVariant?.salePrice !== '' && !isNaN(Number(defaultFrontVariant?.salePrice))
      ? Number(defaultFrontVariant.salePrice)
      : null);

  const baseMrp = product.mrp || product.compareAtPrice || 0;
  const baseSale = defaultFrontPrice !== null ? defaultFrontPrice : (product.salePrice || product.price || 0);

  const activeSale = (matchedVariant?.price !== undefined && matchedVariant?.price !== '' && !isNaN(Number(matchedVariant?.price)))
    ? Number(matchedVariant.price)
    : ((matchedVariant?.salePrice !== undefined && matchedVariant?.salePrice !== '' && !isNaN(Number(matchedVariant?.salePrice)))
      ? Number(matchedVariant.salePrice)
      : baseSale);

  const activeMrp = (matchedVariant?.mrp !== undefined && matchedVariant?.mrp !== '' && !isNaN(Number(matchedVariant?.mrp)))
    ? Number(matchedVariant.mrp)
    : (activeSale > baseMrp ? Math.round(activeSale * 1.25) : baseMrp);

  // Calculate distinct UI variables
  const currentDiscount = (activeMrp > activeSale && activeMrp > 0) ? Math.round(((activeMrp - activeSale) / activeMrp) * 100) : 0;
  const hasDiscount = currentDiscount > 0;

  const productRating = Number(product.rating || product.avgRating || 0);
  const reviewCount = Number(product.reviewsCount || product.reviewCount || (Array.isArray(product.reviews) ? product.reviews.length : 0));

  const {
    name, offer_enabled, offer_end_at, description, shortDescription
  } = product;

  // Stock status for selected size or whole product
  const activeVariantStock = matchedVariant ? parseInt(matchedVariant.stock ?? matchedVariant.quantity, 10) : productTotalStock;
  const isEntirelySoldOut = productTotalStock <= 0 || product.inStock === false || product.active === false || (productSizes.length > 0 && visibleSizes.length === 0);
  const outOfStock = isEntirelySoldOut || (selectedSize && activeVariantStock <= 0);
  const stock = selectedSize && matchedVariant ? activeVariantStock : productTotalStock;

  const { addToCart, buyNowDirect } = useCart();

  const handleQuantity = (delta) => {
    setQuantity(prev => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > stock) return stock;
      return next;
    });
  };

  const handleAddToCart = () => {
    // Only require mandatory size selection if item is Clothing/Apparel and has size options
    if (isClothing && productSizes.length > 0 && !selectedSize) {
      setSizeError(true);
      const sizeEl = document.querySelector('.product-selector-group');
      sizeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setSizeError(false), 3500);
      return;
    }

    const sizeToUse = selectedSize || defaultFrontVariant?.size || (productSizes.length > 0 ? productSizes[0] : 'One Size');
    const colorToUse = (selectedColor && selectedColor !== 'All') ? selectedColor : (availableColors[0]?.name || productColors[0] || 'Default');
    addToCart(product, sizeToUse, colorToUse, quantity, activeSale);

    // Trigger visual flying animation from main product gallery image to the navbar cart
    const galleryMainImg = document.querySelector('.product-gallery-main img, .image-zoom-img') || document.querySelector('.product-gallery-section img');
    const fallbackImg = product.images?.[0]?.url || product.images?.[0] || product.image;
    flyProductToCart(galleryMainImg, fallbackImg);

    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  const executeBuyNow = () => {
    const sizeToUse = selectedSize || defaultFrontVariant?.size || (productSizes.length > 0 ? productSizes[0] : 'One Size');
    const colorToUse = (selectedColor && selectedColor !== 'All') ? selectedColor : (availableColors[0]?.name || productColors[0] || 'Default');
    buyNowDirect(product, sizeToUse, colorToUse, quantity, activeSale);
    navigate('/checkout');
  };

  const handleBuyNow = () => {
    if (isClothing && productSizes.length > 0 && !selectedSize) {
      setSizeError(true);
      const sizeEl = document.querySelector('.product-selector-group');
      sizeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setSizeError(false), 3500);
      return;
    }

    executeBuyNow();
  };



  const [checkingDelivery, setCheckingDelivery] = useState(false);

  const handleDeliveryCheck = async (e) => {
    e.preventDefault();
    if (!deliveryPincode || deliveryPincode.length !== 6) {
      setDeliveryStatus({ error: 'Please enter a valid 6-digit PIN Code.' });
      return;
    }

    setCheckingDelivery(true);
    setDeliveryStatus(null);

    const res = await checkPincodeServiceability(deliveryPincode);
    setCheckingDelivery(false);
    setDeliveryStatus(res);
  };

  return (
    <div className="product-info-wrapper">
      <h1 className="product-title">{name}</h1>

      {/* Sub-Category & GSL Badges */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
        {product.subCategory && (
          <span style={{ fontSize: '11px', fontWeight: '700', background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: '20px', border: '1px solid #e2e8f0', letterSpacing: '0.3px' }}>
            {product.subCategory}
          </span>
        )}
        {product.gsl && (
          <span style={{ fontSize: '11px', fontWeight: '700', background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: '20px', border: '1px solid #fde68a', letterSpacing: '0.3px' }}>
            GSL: {product.gsl}
          </span>
        )}
      </div>

      {productRating > 0 ? (
        <div
          className="product-rating"
          onClick={() => { const el = document.getElementById('reviews') || document.querySelector('.reviews-module-wrapper'); el?.scrollIntoView({ behavior: 'smooth' }); }}
          role="button"
          tabIndex={0}
          aria-label={`${productRating.toFixed(1)} stars out of 5 from ${reviewCount} reviews`}
        >
          <span className="stars">
            {'★'.repeat(Math.round(productRating))}{'☆'.repeat(5 - Math.round(productRating))}
          </span>
          <span className="rating-value">{productRating.toFixed(1)}</span>
          {reviewCount > 0 && <span className="review-count">({reviewCount} {reviewCount === 1 ? 'Review' : 'Reviews'})</span>}
        </div>
      ) : (
        <div
          className="product-rating product-rating--empty"
          onClick={() => { const el = document.getElementById('reviews') || document.querySelector('.reviews-module-wrapper'); el?.scrollIntoView({ behavior: 'smooth' }); }}
          role="button"
          tabIndex={0}
        >
          <span className="rating-empty-link">★ Be the first to review this product</span>
        </div>
      )}

      <div className="product-pricing">
        {hasDiscount ? (
          <>
            <div className="price-row-top" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="price-original" style={{ color: '#9ca3af', textDecoration: 'line-through', fontSize: '14px' }}>
                ₹{activeMrp.toLocaleString('en-IN')}
              </span>
              <span className="price-discount" style={{ background: 'var(--color-accent-gold-light)', color: 'var(--color-accent-gold-text)', border: '1px solid #E4CE9F', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                {currentDiscount}% OFF
              </span>
            </div>
            <div className="price-current" style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-charcoal, #111111)' }}>
              ₹{activeSale.toLocaleString('en-IN')}
            </div>
          </>
        ) : (
          <div className="price-current" style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-charcoal, #111111)' }}>
            ₹{activeSale.toLocaleString('en-IN')}
          </div>
        )}
      </div>

      {offer_enabled && <MiniCountdown targetDate={offer_end_at} />}

      {/* Offers Box (Shop More, Save More) - Fully Customizable & Category Targeted */}
      {(() => {
        if (!offersConfig || offersConfig.enabled === false) return null;
        const cats = offersConfig.categories || ['all'];
        const isAll = cats.length === 0 || cats.includes('all') || cats.includes('All');
        if (!isAll) {
          const pCat = String(product.category || product.categoryId || '').trim().toLowerCase();
          const pSubCat = String(product.subCategory || '').trim().toLowerCase();
          const match = cats.some(c => {
            const lower = String(c).trim().toLowerCase();
            return lower === pCat || lower === pSubCat || (lower && pCat.includes(lower));
          });
          if (!match) return null;
        }

        const items = (offersConfig.items || []).filter(item => {
          const t = typeof item === 'string' ? item : item?.text;
          return Boolean(t && String(t).trim());
        });
        if (items.length === 0) return null;

        return (
          <div className="product-offers-container" aria-label="Special Offers">
            <div className="product-offers-banner">
              {offersConfig.title || 'OFFERS FOR YOU – SHOP MORE, SAVE MORE!'}
            </div>
            <div className="product-offers-content">
              {items.map((item, idx) => {
                const text = typeof item === 'string' ? item : item.text;
                const icon = typeof item === 'object' ? (item.icon || 'discount') : 'discount';
                const link = typeof item === 'object' ? item.link : null;

                const rowContent = (
                  <div className="product-offer-row" key={idx}>
                    <span className="product-offer-icon" aria-hidden="true">
                      {icon === 'whatsapp' ? (
                        <svg className="offer-svg-whatsapp" viewBox="0 0 24 24" width="18" height="18" fill="none">
                          <path fill="#25D366" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2Z" />
                          <path fill="#ffffff" d="M17.52 14.33C17.22 14.18 15.75 13.45 15.48 13.35C15.21 13.25 15.01 13.2 14.81 13.5C14.61 13.8 14.04 14.47 13.86 14.67C13.69 14.87 13.51 14.9 13.21 14.75C12.91 14.6 11.95 14.28 10.81 13.26C9.92 12.47 9.32 11.5 9.14 11.2C8.97 10.9 9.12 10.74 9.27 10.59C9.41 10.46 9.57 10.24 9.72 10.07C9.87 9.9 9.92 9.77 10.02 9.57C10.12 9.37 10.07 9.2 10 9.05C9.92 8.9 9.32 7.43 9.07 6.83C8.83 6.25 8.58 6.33 8.4 6.32H7.83C7.63 6.32 7.3 6.39 7.03 6.69C6.75 6.99 6 7.69 6 9.13C6 10.57 7.05 11.96 7.2 12.16C7.35 12.36 9.27 15.31 12.21 16.58C12.91 16.88 13.46 17.06 13.88 17.2C14.58 17.42 15.22 17.39 15.72 17.31C16.28 17.23 17.44 16.61 17.68 15.93C17.93 15.26 17.93 14.68 17.85 14.56C17.78 14.43 17.62 14.38 17.52 14.33Z" />
                        </svg>
                      ) : icon === 'shipping' ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#B88A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13"></rect>
                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                          <circle cx="5.5" cy="18.5" r="2.5"></circle>
                          <circle cx="18.5" cy="18.5" r="2.5"></circle>
                        </svg>
                      ) : icon === 'star' ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="#B88A2E" stroke="#B88A2E" strokeWidth="1">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#B88A2E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" strokeDasharray="3 3"></circle>
                          <path d="m9 15 6-6"></path>
                          <circle cx="9.5" cy="9.5" r=".5" fill="#B88A2E"></circle>
                          <circle cx="14.5" cy="14.5" r=".5" fill="#B88A2E"></circle>
                        </svg>
                      )}
                    </span>
                    <span className="product-offer-text">{text}</span>
                  </div>
                );

                if (link && String(link).trim()) {
                  return (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="product-offer-link-wrapper"
                    >
                      {rowContent}
                    </a>
                  );
                }
                return rowContent;
              })}
            </div>
          </div>
        );
      })()}

      {/* Color Selection: Show buttons if in-stock colors exist */}
      {inStockColors.length > 0 && !inStockColors.every(c => c.name === 'Standard' || c.name === 'Default') && (
        <div className="product-selector-group">
          <div className="color-selector-header">
            <h3 className="selector-title">
              Color: <span className="selector-val">{selectedColor === 'All' ? 'All Colors' : selectedColor}</span>
            </h3>
          </div>
          <div className="color-buttons">
            <button
              type="button"
              className={`color-btn color-btn--all ${selectedColor === 'All' ? 'selected' : ''}`}
              onClick={() => { setSelectedColor('All'); onColorChange?.('All', -1); }}
              aria-label="View all colors"
              aria-pressed={selectedColor === 'All'}
            >
              <span className="color-btn-all-icon">⊞</span>
              <span>All</span>
            </button>
            {inStockColors.map((col, idx) => (
              <button
                key={col.name || idx}
                type="button"
                className={`color-btn color-btn--swatch ${selectedColor === col.name ? 'selected' : ''}`}
                onClick={() => { setSelectedColor(col.name); onColorChange?.(col.name, idx); }}
                aria-label={`Select color ${col.name}`}
                aria-pressed={selectedColor === col.name}
                title={col.name}
              >
                <span
                  className="color-btn-dot"
                  style={getColorSwatchStyle(col)}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Size Selection Group */}
      <div className="product-selector-group">
        <div className="size-header">
          <h3 className="selector-title">
            {((product.categoryId || product.category || '').toLowerCase().includes('perfume') || (product.name || '').toLowerCase().includes('perfume'))
              ? 'Select Volume (ml)'
              : (isClothing ? 'Select Size *' : 'Select Size')}
          </h3>
          <button
            type="button"
            className="btn-size-guide"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSizeGuideOpen(true);
            }}
            title="Open comprehensive sizing chart & fit finder"
          >
            {((product.categoryId || product.category || '').toLowerCase().includes('perfume') || (product.name || '').toLowerCase().includes('perfume'))
              ? 'Volume Guide'
              : 'Size Guide'}
          </button>
        </div>

        {sizeError && (
          <div style={{ background: 'var(--color-accent-gold-light)', color: 'var(--color-accent-gold-text)', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', marginBottom: '10px', border: '1px solid #E4CE9F' }}>
            Please select your size below before proceeding.
          </div>
        )}

        {visibleSizes.length > 0 ? (
          <div className="size-buttons" style={sizeError ? { outline: '2px solid var(--color-accent-gold)', borderRadius: '8px', padding: '4px' } : {}}>
            {visibleSizes.map(size => {
              return (
                <button
                  key={size}
                  className={`size-btn ${selectedSize === size ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedSize(size);
                    setSizeError(false);
                  }}
                >
                  {size}
                </button>
              );
            })}
          </div>
        ) : productSizes.length > 0 ? (
          <div className="size-out-of-stock-msg" style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626', padding: '10px 14px', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fee2e2' }}>
            {selectedColor !== 'All' ? `Currently out of stock in ${selectedColor}. Please select another color.` : 'All sizes currently sold out.'}
          </div>
        ) : (
          <div className="one-size-badge" style={{ fontSize: '13px', fontWeight: '700', color: '#4b5563', padding: '8px 12px', background: '#f3f4f6', borderRadius: '4px', display: 'inline-block' }}>
            One Size / Standard Fit
          </div>
        )}
      </div>


      <div className="product-stock-status">
        {outOfStock ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#fef2f2',
            border: '1.5px solid #ef4444',
            color: '#dc2626',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '800',
            letterSpacing: '0.8px',
            textTransform: 'uppercase'
          }}>
            <span>✕</span> OUT OF STOCK
          </div>
        ) : (
          <span className="stock-in">✓ In Stock • Ready to Dispatch</span>
        )}
      </div>

      <div className="product-actions-group">
        <div className="quantity-selector">
          <button onClick={() => handleQuantity(-1)} disabled={quantity <= 1 || outOfStock}>−</button>
          <span>{outOfStock ? 0 : quantity}</span>
          <button onClick={() => handleQuantity(1)} disabled={quantity >= stock || outOfStock}>+</button>
        </div>

        <button
          className={`btn-add-to-cart ${added ? 'added' : ''}`}
          onClick={handleAddToCart}
          disabled={outOfStock}
          style={outOfStock ? { background: '#94a3b8', borderColor: '#94a3b8', color: '#ffffff', cursor: 'not-allowed' } : {}}
        >
          {outOfStock ? 'OUT OF STOCK' : (added ? 'ADDED TO CART ✓' : 'ADD TO CART')}
        </button>
      </div>

      {!outOfStock && (
        <button className="btn-buy-now" onClick={handleBuyNow} disabled={outOfStock}>
          BUY NOW
        </button>
      )}

      {/* Wishlist Button on Product Page */}
      <button
        type="button"
        onClick={() => toggleWishlist && toggleWishlist(product)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px 16px',
          border: '1px solid var(--color-stone, #D9D3C7)',
          borderRadius: '4px',
          background: inWishlist ? '#fff1f2' : '#ffffff',
          color: inWishlist ? '#e11d48' : 'var(--color-charcoal, #111111)',
          fontWeight: '700',
          fontSize: '12px',
          letterSpacing: '0.8px',
          cursor: 'pointer',
          width: '100%',
          marginTop: '10px',
          marginBottom: '16px',
          transition: 'all 0.2s ease'
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={inWishlist ? "#e11d48" : "none"} stroke={inWishlist ? "#e11d48" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
        {inWishlist ? 'SAVED TO WISHLIST ✓' : 'SAVE TO WISHLIST'}
      </button>

      <div className="delivery-checker">
        <h4 className="checker-title">Check Delhivery Express Serviceability</h4>
        <form className="checker-form" onSubmit={handleDeliveryCheck}>
          <input
            type="text"
            placeholder="Enter 6-digit Pincode"
            value={deliveryPincode}
            maxLength={6}
            onChange={(e) => setDeliveryPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <button type="submit" disabled={checkingDelivery}>
            {checkingDelivery ? 'CHECKING...' : 'CHECK'}
          </button>
        </form>

        {checkingDelivery && (
          <p className="delivery-status-msg checking">Checking Delhivery courier coverage...</p>
        )}

        {deliveryStatus && (
          <div className={`delivery-result-badge ${deliveryStatus.serviceable ? 'success' : 'error'}`}>
            {deliveryStatus.serviceable ? (
              <>
                <div className="res-title">✓ Delivery Available for PIN {deliveryPincode}</div>
                {deliveryStatus.city && <div className="res-location">📍 Location: {deliveryStatus.city}, {deliveryStatus.state}</div>}
                <div className="res-time">
                  🚚 Expected Delivery: <strong>{deliveryStatus.estimatedDeliveryDate ? deliveryStatus.estimatedDeliveryDate : (deliveryStatus.estimatedDays || '2-4 Days')}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="res-title">❌ Delivery NOT Available</div>
                <div className="res-msg">{deliveryStatus.error || `PIN code ${deliveryPincode} is currently invalid or unserviceable.`}</div>
              </>
            )}
          </div>
        )}

      </div>


      {/* Accordions / Details */}
      <div className="product-details-accordions">
        <details className="accordion-block" open>
          <summary>Description</summary>
          <div className="accordion-content">
            {description || shortDescription || "No description provided."}
          </div>
        </details>

        <details className="accordion-block">
          <summary>Product Details</summary>
          <div className="accordion-content">
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {product.gsl && <li><strong>GSL:</strong> {product.gsl}</li>}
              {product.subCategory && <li><strong>Type:</strong> {product.subCategory}</li>}
              <li>Fabric: 100% Premium Material</li>
              <li>Fit: Modern Classic</li>
              <li>Pattern: Solid</li>
              <li>Country of Origin: India</li>
            </ul>
          </div>
        </details>

        <details className="accordion-block">
          <summary>Shipping & Exchange Policy</summary>
          <div className="accordion-content">
            Standard delivery takes 2-4 business days via Delhivery Express. We offer <strong>exchange or replacement only in the case of damaged or defective items</strong> received. To initiate an exchange, contact us on WhatsApp (+91 84602 33020) with package unboxing video/photo proof within 48 hours of delivery. General returns or refunds are not accepted.
          </div>
        </details>
      </div>

      {/* Delivery & Purchase Confidence Badges (Moved right after Shipping & Exchange Policy) */}
      <div className="product-confidence-cards">
        <div className="confidence-card">
          <div className="confidence-card-header">
            <span className="confidence-card-icon">🚚</span>
            <span className="confidence-card-title">Delhivery Express</span>
          </div>
          <div className="confidence-card-desc">Estimated 2-4 business days across India</div>
        </div>

        <div className="confidence-card">
          <div className="confidence-card-header">
            <span className="confidence-card-icon">🔄</span>
            <span className="confidence-card-title">48H Replacement</span>
          </div>
          <div className="confidence-card-desc">For damaged/defective items with unboxing video</div>
        </div>

        <div className="confidence-card">
          <div className="confidence-card-header">
            <span className="confidence-card-icon">✨</span>
            <span className="confidence-card-title">100% Genuine</span>
          </div>
          <div className="confidence-card-desc">Direct from Himatnagar flagship store</div>
        </div>

        <div className="confidence-card">
          <div className="confidence-card-header">
            <span className="confidence-card-icon">📦</span>
            <span className="confidence-card-title">Free Shipping</span>
          </div>
          <div className="confidence-card-desc">On all prepaid & COD orders above ₹999</div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Purchase Bar */}
      <aside className="product-sticky-bar" aria-label="Mobile Quick Purchase Bar">
        <div className="product-sticky-bar__inner">
          <div className="product-sticky-bar__info">
            <span className="product-sticky-bar__price">
              ₹{activeSale.toLocaleString('en-IN')}
            </span>
            {selectedSize && (
              <span className="product-sticky-bar__size">
                Size: {selectedSize}
              </span>
            )}
          </div>
          <div className="product-sticky-bar__actions">
            <button
              type="button"
              className={`product-sticky-bar__btn product-sticky-bar__btn--cart ${added ? 'added' : ''}`}
              onClick={handleAddToCart}
              disabled={outOfStock}
            >
              {added ? 'ADDED ✓' : 'ADD TO CART'}
            </button>
            <button
              type="button"
              className="product-sticky-bar__btn product-sticky-bar__btn--buy"
              onClick={handleBuyNow}
              disabled={outOfStock}
            >
              BUY NOW
            </button>
          </div>
        </div>
      </aside>

      {/* Interactive Online Size & Volume Guide Modal */}
      <SizeGuideModal
        isOpen={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        category={product.categoryId || product.category || 'Shirts'}
        customSizeGuide={product.sizeGuide}
        onSelectSize={(size) => setSelectedSize(size)}
      />
    </div>
  );
}
