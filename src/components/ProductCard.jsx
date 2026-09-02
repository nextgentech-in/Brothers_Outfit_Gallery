import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { optimizeImage } from '../utils/imageUtils';
import { isClothingProduct } from '../utils/productUtils';
import { useCart } from '../context/CartContext';
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

export default function ProductCard({ product, onAddToCart, showNewBadge = false, showOffer = false }) {
  const navigate = useNavigate();
  const { addToCart: contextAddToCart, buyNowDirect } = useCart();
  const [selectedSize, setSelectedSize] = useState(null);
  const isOutOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  
  const availableSizes = product.sizes || (product.variants ? [...new Set(product.variants.map(v => v.size))] : []);

  // Offer logic
  const offerActive = showOffer && isOfferActive(product);
  const offerPrice = offerActive ? getOfferPrice(product) : null;
  const countdown = useCountdown(offerActive ? product.offer_end_at : null);

  // Price display logic routing to new schema (mrp/salePrice) fallback legacy (compareAt/price)
  const baseMrp = product.mrp || product.compareAtPrice || 0;
  const baseSale = product.salePrice || product.price || 0;

  const displayPrice = offerActive ? offerPrice : baseSale;
  const displayCompare = offerActive ? baseMrp : (baseMrp > baseSale ? baseMrp : null);
  
  const displayDiscount = offerActive
    ? product.offer_discount_percentage
    : (product.discountPercentage || (displayCompare ? Math.round(((displayCompare - displayPrice) / displayCompare) * 100) : 0));
    
  const hasDiscount = displayCompare && displayCompare > displayPrice;
  const [addedAnimation, setAddedAnimation] = useState(false);

  const isClothing = isClothingProduct(product);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    
    const sizeToUse = selectedSize || (availableSizes.length > 0 ? availableSizes[0] : 'One Size');
    if (onAddToCart) {
      onAddToCart({
        ...product,
        selectedSize: sizeToUse,
        finalPrice: displayPrice,
      });
    } else {
      contextAddToCart(product, sizeToUse, product.colors?.[0] || 'Default');
    }
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
  };

  const handleBuyNow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    
    const sizeToUse = selectedSize || (availableSizes.length > 0 ? availableSizes[0] : 'One Size');
    buyNowDirect(product, sizeToUse, product.colors?.[0] || 'Default');
    navigate('/checkout');
  };


  return (
    <div className={`product-card ${isOutOfStock ? 'product-card--oos' : ''}`}>
      {/* Image */}
      <Link to={`/product/${product.slug}`} className="product-card__image-wrap">
        <img
          src={optimizeImage(product.image || product.thumbnailUrl, 400)}
          alt={product.name}
          className="product-card__image"
          loading="lazy"
        />
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
      </Link>


      {/* Info */}
      <div className="product-card__info">
        <Link to={`/product/${product.slug}`} className="product-card__name">
          {product.name}
        </Link>

        {/* Sizes */}
        <div className="product-card__sizes">
          {availableSizes.map((size) => (
            <button
              key={size}
              className={`product-card__size ${selectedSize === size ? 'product-card__size--selected' : ''} ${isOutOfStock ? 'product-card__size--disabled' : ''}`}
              onClick={() => !isOutOfStock && setSelectedSize(size)}
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
            {isOutOfStock ? 'OUT OF STOCK' : (addedAnimation ? 'ADDED ✓' : 'ADD TO CART')}
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
    </div>
  );
}

