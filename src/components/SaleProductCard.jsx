import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import OfferCountdown from './OfferCountdown';
import { optimizeImage } from '../utils/imageUtils';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import AuthModal from './auth/AuthModal';
import './SaleProductCard.css';

export default function SaleProductCard({ product, onAddToCart, onOfferExpire }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};
  const { addToCart: contextAddToCart, buyNowDirect } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist() || {};
  const [selectedSize, setSelectedSize] = useState(null);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [sizePrompt, setSizePrompt] = useState(false);
  const isOutOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const availableSizes = product.sizes || (product.variants ? [...new Set(product.variants.map(v => v.size))] : []);
  const inWishlist = isInWishlist ? isInWishlist(product.id) : false;
  const hasMultipleSizes = availableSizes.length > 1;
  const needsSizeSelection = hasMultipleSizes && !selectedSize;

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
        finalPrice: salePrice,
      });
    } else {
      contextAddToCart(product, sizeToUse, product.colors?.[0] || 'Default', 1, salePrice);
    }
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
  };

  const executeBuyNow = () => {
    const sizeToUse = selectedSize || defaultFrontVariant?.size || (availableSizes.length > 0 ? availableSizes[0] : 'One Size');
    buyNowDirect(product, sizeToUse, product.colors?.[0] || 'Default', 1, salePrice);
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

    // Display auth modal on mobile only when not logged in; desktop proceeds directly to checkout
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile && !currentUser) {
      setAuthModalOpen(true);
      return;
    }

    executeBuyNow();
  };


  const handleExpire = () => {
    if (onOfferExpire) {
      onOfferExpire(product.id);
    }
  };

  const defaultFrontVariant = product.variants?.find(v => v.isDefaultPrice);
  const defaultFrontPrice = (defaultFrontVariant?.price !== undefined && defaultFrontVariant?.price !== '' && !isNaN(Number(defaultFrontVariant?.price)))
    ? Number(defaultFrontVariant.price)
    : (defaultFrontVariant?.salePrice !== undefined && defaultFrontVariant?.salePrice !== '' && !isNaN(Number(defaultFrontVariant?.salePrice))
        ? Number(defaultFrontVariant.salePrice)
        : null);

  // Pricing calculations
  const originalPrice = product.mrp || product.compareAtPrice || product.price || 0;
  const baseForDiscount = defaultFrontPrice !== null ? defaultFrontPrice : (product.salePrice || product.price || product.mrp || 0);
  const salePrice = Math.round(baseForDiscount * (1 - (product.offer_discount_percentage || 0) / 100));

  return (
    <div className={`sale-card ${isOutOfStock ? 'sale-card--oos' : ''}`}>
      {/* Image Container */}
      <div className="sale-card__image-wrap">
        <Link to={`/product/${product.slug}`} style={{ display: 'block', width: '100%', height: '100%' }}>
          <img
            src={optimizeImage(product.image || product.thumbnailUrl, 400)}
            alt={product.name}
            className="sale-card__image"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/images/hero.png';
            }}
          />
        </Link>
        
        {isOutOfStock && (
          <div className="sale-card__overlay">OUT OF STOCK</div>
        )}

        <div className="sale-card__badges">
          <span className="sale-card__badge-sale">SALE</span>
          <span className="sale-card__badge-discount">{product.offer_discount_percentage}% OFF</span>
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          className={`sale-card__wishlist ${inWishlist ? 'sale-card__wishlist--active' : ''}`}
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
      </div>

      {/* Card Info */}
      <div className="sale-card__info">
        <Link to={`/product/${product.slug}`} className="sale-card__name">
          {product.name}
        </Link>
        
        {/* Dynamic Countdown */}
        <OfferCountdown offerEndAt={product.offer_end_at} onExpire={handleExpire} />

        {/* Pricing Layout (Highly Prominent Sale Price) */}
        <div className="sale-card__price-box">
          <div className="sale-card__price-original">
            <span className="sale-card__price-old">₹{originalPrice.toLocaleString('en-IN')}</span>
          </div>
          <span className="sale-card__price-new">₹{salePrice.toLocaleString('en-IN')}</span>
        </div>

        {/* Sizes */}
        {sizePrompt && (
          <div style={{ fontSize: '11px', color: 'var(--color-accent-gold-text)', fontWeight: '700', background: 'var(--color-accent-gold-light)', border: '1px solid #E4CE9F', padding: '3px 8px', borderRadius: '4px', textAlign: 'center', marginBottom: '4px' }}>
            Please select a size first
          </div>
        )}
        <div 
          className="sale-card__sizes"
          style={sizePrompt ? { outline: '2px solid var(--color-accent-gold)', borderRadius: '6px', padding: '4px' } : {}}
        >
          {availableSizes.map((size) => (
            <button
              key={size}
              className={`sale-card__size ${selectedSize === size ? 'sale-card__size--selected' : ''} ${isOutOfStock ? 'sale-card__size--disabled' : ''}`}
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

        {lowStock && (
          <span className="sale-card__stock-warning">Only {product.stock} left in stock</span>
        )}

        <div className="sale-card__btn-group">
          <button
            className={`sale-card__add-btn ${isOutOfStock ? 'sale-card__add-btn--disabled' : ''} ${needsSizeSelection ? 'sale-card__add-btn--options' : ''} ${addedAnimation ? 'sale-card__add-btn--added' : ''}`}
            onClick={handleAddToCart}
            disabled={isOutOfStock}
          >
            {isOutOfStock ? 'OUT OF STOCK' : (addedAnimation ? 'ADDED ✓' : (needsSizeSelection ? 'CHOOSE OPTIONS' : 'ADD TO CART'))}
          </button>

          {!isOutOfStock && (
            <button
              className="sale-card__buy-btn"
              onClick={handleBuyNow}
            >
              BUY NOW
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

