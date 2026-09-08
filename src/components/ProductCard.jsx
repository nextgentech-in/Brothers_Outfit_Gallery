import { useState, useEffect, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { optimizeImage } from '../utils/imageUtils';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import AuthModal from './auth/AuthModal';
import './ProductCard.css';



/**
 * Calculates the offer price based on compareAtPrice (base) and offer discount.
 * If compareAtPrice is null, uses price as base.
 */
function getOfferPrice(product) {
  const base = product.mrp || product.compareAtPrice || product.salePrice || product.price;
  return Math.round(base * (1 - product.offer_discount_percentage / 100));
}

/**
 * Checks if an offer is currently active.
 */
function isOfferActive(product) {
  if (!product.offer_enabled) return false;
  const now = new Date();
  const start = product.offer_start_at ? new Date(product.offer_start_at) : null;
  const end = product.offer_end_at ? new Date(product.offer_end_at) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

/**
 * Returns remaining time string for an offer.
 */
function useCountdown(endDateStr) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!endDateStr) return;

    function update() {
      const now = new Date();
      const end = new Date(endDateStr);
      const diff = end - now;

      if (diff <= 0) {
        setRemaining('');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setRemaining(`${days}D ${String(hours).padStart(2, '0')}H LEFT`);
      } else if (hours > 0) {
        setRemaining(`${hours}H ${String(minutes).padStart(2, '0')}M LEFT`);
      } else {
        setRemaining(`${minutes}M LEFT`);
      }
    }

    update();
    const interval = setInterval(update, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [endDateStr]);

  return remaining;
}

function ProductCard({ product, onAddToCart, showNewBadge = false, showOffer = false }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};
  const { addToCart: contextAddToCart, buyNowDirect } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist() || {};
  const [selectedSize, setSelectedSize] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [sizePrompt, setSizePrompt] = useState(false);
  const isOutOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  
  const availableSizes = product.sizes || (product.variants ? [...new Set(product.variants.map(v => v.size))] : []);
  const inWishlist = isInWishlist ? isInWishlist(product.id) : false;
  const hasMultipleSizes = availableSizes.length > 1;
  const needsSizeSelection = hasMultipleSizes && !selectedSize;

  // Offer logic
  const offerActive = showOffer && isOfferActive(product);
  const offerPrice = offerActive ? getOfferPrice(product) : null;
  const countdown = useCountdown(offerActive ? product.offer_end_at : null);

  // Price display logic routing to new schema (mrp/salePrice) fallback legacy (compareAt/price)
  const defaultFrontVariant = product.variants?.find(v => v.isDefaultPrice);
  const defaultFrontPrice = (defaultFrontVariant?.price !== undefined && defaultFrontVariant?.price !== '' && !isNaN(Number(defaultFrontVariant?.price)))
    ? Number(defaultFrontVariant.price)
    : (defaultFrontVariant?.salePrice !== undefined && defaultFrontVariant?.salePrice !== '' && !isNaN(Number(defaultFrontVariant?.salePrice))
        ? Number(defaultFrontVariant.salePrice)
        : null);

  const baseMrp = product.mrp || product.compareAtPrice || 0;
  const baseSale = defaultFrontPrice !== null ? defaultFrontPrice : (product.salePrice || product.price || 0);

  // Selected size-wise price if applicable
  const matchedVariant = selectedSize && product.variants
    ? product.variants.find(v => v.size === selectedSize)
    : null;
  const variantSale = matchedVariant?.price || matchedVariant?.salePrice;
  const activeProductSale = variantSale ? Number(variantSale) : baseSale;

  const displayPrice = offerActive ? offerPrice : activeProductSale;
  const displayCompare = offerActive ? baseMrp : (baseMrp > displayPrice ? baseMrp : null);
  
  const displayDiscount = offerActive
    ? product.offer_discount_percentage
    : (product.discountPercentage || (displayCompare ? Math.round(((displayCompare - displayPrice) / displayCompare) * 100) : 0));
    
  const hasDiscount = displayCompare && displayCompare > displayPrice;
  const [addedAnimation, setAddedAnimation] = useState(false);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    
    if (needsSizeSelection) {
      setSizePrompt(true);
      setTimeout(() => setSizePrompt(false), 3000);
      return;
    }

    const sizeToUse = selectedSize || defaultFrontVariant?.size || (availableSizes.length > 0 ? availableSizes[0] : 'One Size');
    if (onAddToCart) {
      onAddToCart({
        ...product,
        selectedSize: sizeToUse,
        finalPrice: displayPrice,
      });
    } else {
      contextAddToCart(product, sizeToUse, product.colors?.[0] || 'Default', 1, displayPrice);
    }
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
  };

  const executeBuyNow = () => {
    const sizeToUse = selectedSize || defaultFrontVariant?.size || (availableSizes.length > 0 ? availableSizes[0] : 'One Size');
    buyNowDirect(product, sizeToUse, product.colors?.[0] || 'Default', 1, displayPrice);
    navigate('/checkout');
  };

  const handleBuyNow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    
    if (needsSizeSelection) {
      setSizePrompt(true);
      setTimeout(() => setSizePrompt(false), 3000);
      return;
    }

    // If not logged in, trigger account creation / login modal first
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    executeBuyNow();
  };

  // Multiple photos support
  const rawImages = (product.images && product.images.length > 0)
    ? product.images
    : [product.image || product.thumbnailUrl || '/images/hero.png'];

  const imagesList = rawImages.map(img => (typeof img === 'object' && img !== null && img.url) ? img.url : img).filter(Boolean);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const hasMultipleImages = imagesList.length > 1;
  const touchStartX = useRef(null);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX.current || !hasMultipleImages) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 30) {
      if (diff > 0) {
        setActiveImgIdx((prev) => (prev + 1) % imagesList.length);
      } else {
        setActiveImgIdx((prev) => (prev === 0 ? imagesList.length - 1 : prev - 1));
      }
    }
    touchStartX.current = null;
  };

  return (
    <div className={`product-card ${isOutOfStock ? 'product-card--oos' : ''}`}>
      {/* Image with multiple photos scroll option */}
      <div 
        className="product-card__image-wrap"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Link to={`/product/${product.slug}`} className="product-card__image-link">
          <img
            src={optimizeImage(imagesList[activeImgIdx] || imagesList[0], 400)}
            alt={`${product.name} - View ${activeImgIdx + 1}`}
            className="product-card__image"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/images/hero.png';
            }}
          />
        </Link>

        {isOutOfStock && (
          <div className="product-card__oos-badge">OUT OF STOCK</div>
        )}

        {/* Badges row */}
        <div className="product-card__badges">
          {showNewBadge && (
            <span className="product-card__new-badge">NEW</span>
          )}
          {hasDiscount && !isOutOfStock && (
            <span className="product-card__discount-badge">
              {displayDiscount}% OFF
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          className={`product-card__wishlist ${inWishlist ? 'product-card__wishlist--active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (toggleWishlist) toggleWishlist(product);
          }}
          aria-label={inWishlist ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={inWishlist ? "#c0392b" : "none"} stroke={inWishlist ? "#c0392b" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>

        {/* Multiple Photo Scroll Arrows & Dots */}
        {hasMultipleImages && (
          <>
            <button
              type="button"
              className="card-img-arrow card-img-arrow--prev"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveImgIdx((prev) => (prev === 0 ? imagesList.length - 1 : prev - 1));
              }}
              aria-label="Previous image"
            >
              ‹
            </button>

            <button
              type="button"
              className="card-img-arrow card-img-arrow--next"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveImgIdx((prev) => (prev + 1) % imagesList.length);
              }}
              aria-label="Next image"
            >
              ›
            </button>

            {/* Pagination Dots */}
            <div className="card-img-dots">
              {imagesList.map((_, i) => (
                <span
                  key={i}
                  className={`card-img-dot ${i === activeImgIdx ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveImgIdx(i);
                  }}
                  title={`Photo ${i + 1}`}
                />
              ))}
            </div>

            {/* Photo Counter */}
            <span className="card-img-counter">
              {activeImgIdx + 1}/{imagesList.length}
            </span>
          </>
        )}
      </div>


      {/* Info */}
      <div className="product-card__info">
        <div className="product-card__meta-row">
          <span className="product-card__category">{product.category || "Men's Collection"}</span>
          <span className="product-card__rating">★ 4.8</span>
        </div>

        <Link to={`/product/${product.slug}`} className="product-card__name">
          {product.name}
        </Link>

        {/* Sizes */}
        {sizePrompt && (
          <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '800', background: '#fee2e2', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>
            ⚠️ Please select a size first
          </div>
        )}
        <div 
          className="product-card__sizes"
          style={sizePrompt ? { outline: '2px solid #ef4444', borderRadius: '6px', padding: '4px' } : {}}
        >
          {availableSizes.map((size) => (
            <button
              key={size}
              className={`product-card__size ${selectedSize === size ? 'product-card__size--selected' : ''} ${isOutOfStock ? 'product-card__size--disabled' : ''}`}
              onClick={() => {
                if (!isOutOfStock) {
                  setSelectedSize(size);
                  setSizePrompt(false);
                }
              }}
              disabled={isOutOfStock}
            >
              {size}
            </button>
          ))}
        </div>

        {/* Offer Timer */}
        {offerActive && countdown && (
          <div className="product-card__offer-timer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>{countdown}</span>
          </div>
        )}

        {/* Price mapped to user spec hierarchy */}
        <div className="product-card__price-area">
          {hasDiscount && (
            <div className="product-card__price-top">
              <span className="product-card__compare-price" style={{fontSize: '12px', color: '#9ca3af', textDecoration: 'line-through'}}>
                ₹{displayCompare.toLocaleString('en-IN')}
              </span>
              <span className="product-card__discount" style={{background: '#fee2e2', color: '#ef4444', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '800'}}>
                {Math.round(((displayCompare - displayPrice) / displayCompare) * 100)}% OFF
              </span>
            </div>
          )}
          <span className="product-card__price" style={{fontSize: '18px', fontWeight: '800', color: '#111827'}}>
            ₹{displayPrice.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Stock */}
        {lowStock && (
          <span className="product-card__stock product-card__stock--low">
            Only {product.stock} left
          </span>
        )}

        {/* Buttons Row: Add to Cart & Buy Now */}
        <div className="product-card__btn-group" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            className={`product-card__add-btn ${isOutOfStock ? 'product-card__add-btn--disabled' : ''} ${addedAnimation ? 'product-card__add-btn--added' : ''}`}
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            style={{ flex: 1, margin: 0, ...(addedAnimation ? { background: '#22c55e', borderColor: '#22c55e', color: '#fff' } : {}) }}
          >
            {isOutOfStock ? 'OUT OF STOCK' : (addedAnimation ? 'ADDED ✓' : (needsSizeSelection ? 'CHOOSE SIZE' : 'ADD TO CART'))}
          </button>

          {!isOutOfStock && (
            <button
              className="product-card__buy-btn"
              onClick={handleBuyNow}
              style={{
                flex: 1,
                background: '#111827',
                color: '#ffffff',
                border: '1px solid #111827',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                padding: '10px 8px',
                transition: 'all 0.2s ease',
              }}
            >
              ⚡ BUY NOW
            </button>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={executeBuyNow}
        message="Sign in or create an account to complete your purchase."
      />
    </div>
  );
}

export default memo(ProductCard);
