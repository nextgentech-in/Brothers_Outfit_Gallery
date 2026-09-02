import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import OfferCountdown from './OfferCountdown';
import { optimizeImage } from '../utils/imageUtils';
import { useCart } from '../context/CartContext';
import './SaleProductCard.css';

export default function SaleProductCard({ product, onAddToCart, onOfferExpire }) {
  const navigate = useNavigate();
  const { addToCart: contextAddToCart } = useCart();
  const [selectedSize, setSelectedSize] = useState(null);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const isOutOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const availableSizes = product.sizes || (product.variants ? [...new Set(product.variants.map(v => v.size))] : []);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    
    const sizeToUse = selectedSize || (availableSizes.length > 0 ? availableSizes[0] : 'One Size');
    if (onAddToCart) {
      onAddToCart({
        ...product,
        selectedSize: sizeToUse,
        finalPrice: salePrice,
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
    contextAddToCart(product, sizeToUse, product.colors?.[0] || 'Default');
    navigate('/checkout');
  };

  const handleExpire = () => {
    if (onOfferExpire) {
      onOfferExpire(product.id);
    }
  };

  // Pricing calculations
  const originalPrice = product.mrp || product.compareAtPrice || product.price || 0;
  const baseForDiscount = product.mrp || product.compareAtPrice || product.salePrice || product.price || 0;
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
    </div>
  );
}

