import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import OfferCountdown from './OfferCountdown';
import { optimizeImage } from '../utils/imageUtils';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import AuthModal from './auth/AuthModal';
import './SaleProductCard.css';

export default function SaleProductCard({ product, onAddToCart, onOfferExpire }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};
  const { addToCart: contextAddToCart, buyNowDirect } = useCart();
  const [selectedSize, setSelectedSize] = useState(null);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const isOutOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const availableSizes = product.sizes || (product.variants ? [...new Set(product.variants.map(v => v.size))] : []);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    
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
    
    // If not logged in, trigger account creation / login modal first
    if (!currentUser) {
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
      <Link to={`/product/${product.slug}`} className="sale-card__image-wrap">
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
        
        {isOutOfStock && (
          <div className="sale-card__overlay">OUT OF STOCK</div>
        )}

        <div className="sale-card__badges">
          <span className="sale-card__badge-sale">SALE</span>
          <span className="sale-card__badge-discount">{product.offer_discount_percentage}% OFF</span>
        </div>
      </Link>



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
        <div className="sale-card__sizes">
          {availableSizes.map((size) => (
            <button
              key={size}
              className={`sale-card__size ${selectedSize === size ? 'sale-card__size--selected' : ''} ${isOutOfStock ? 'sale-card__size--disabled' : ''}`}
              onClick={() => !isOutOfStock && setSelectedSize(size)}
              disabled={isOutOfStock}
            >
              {size}
            </button>
          ))}
        </div>

        {lowStock && (
          <span className="sale-card__stock-warning">Only {product.stock} left</span>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            className={`sale-card__add-btn ${isOutOfStock ? 'sale-card__add-btn--disabled' : ''}`}
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            style={{ flex: 1, margin: 0, ...(addedAnimation ? { background: '#22c55e', borderColor: '#22c55e', color: '#fff' } : {}) }}
          >
            {isOutOfStock ? 'OUT OF STOCK' : (addedAnimation ? 'ADDED ✓' : 'ADD TO CART')}
          </button>

          {!isOutOfStock && (
            <button
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

