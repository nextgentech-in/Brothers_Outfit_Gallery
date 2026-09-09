import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { checkPincodeServiceability } from '../../services/delhiveryService';
import { isClothingProduct } from '../../utils/productUtils';
import { useWishlist } from '../../context/WishlistContext';
import SizeGuideModal from '../common/SizeGuideModal';
import AuthModal from '../auth/AuthModal';
import './ProductInfo.css';

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

export default function ProductInfo({ product }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};
  const { isInWishlist, toggleWishlist } = useWishlist() || {};
  const inWishlist = isInWishlist ? isInWishlist(product.id) : false;
  const [sizeError, setSizeError] = useState(false);

  const initialColor = product.colors && product.colors.length > 0 ? (product.colors[0].name || product.colors[0]) : 'Black';
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const defaultFrontVariant = useMemo(() => {
    return product.variants?.find(v => v.isDefaultPrice) || null;
  }, [product.variants]);

  const [selectedSize, setSelectedSize] = useState(() => defaultFrontVariant?.size || null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [deliveryPincode, setDeliveryPincode] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState(null);

  // Sync state if product changes without unmounting
  useEffect(() => {
    setSelectedSize(defaultFrontVariant?.size || null);
    setSelectedColor(product.colors && product.colors.length > 0 ? (product.colors[0].name || product.colors[0]) : 'Black');
  }, [product.id, defaultFrontVariant?.size]);

  // Determine if item is Clothing (where size selection is mandatory) vs Accessories
  const isClothing = isClothingProduct(product);

  // Read variants if present, else fallback - memoized to prevent unstable object references in effects/memos
  const productColors = useMemo(() => {
    return product.colors?.length > 0 ? product.colors.map(c => c.name || c) : [];
  }, [product.colors]);

  const productSizes = useMemo(() => {
    return product.variants?.length > 0 ? [...new Set(product.variants.map(v => v.size))] : (product.sizes || []);
  }, [product.variants, product.sizes]);

  const productTotalStock = useMemo(() => {
    return product.variants?.length > 0 ? product.variants.reduce((acc, v) => acc + (parseInt(v.stock, 10)||0), 0) : (product.stock || 0);
  }, [product.variants, product.stock]);

  // Dynamic size-wise pricing matching selected size
  const matchedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) return null;
    const targetSize = selectedSize || defaultFrontVariant?.size || (productSizes.length > 0 ? productSizes[0] : null);
    if (!targetSize) return null;
    return product.variants.find(v =>
      v.size === targetSize && (!v.color || v.color === selectedColor || v.color === 'Standard' || v.color === 'Default')
    ) || product.variants.find(v => v.size === targetSize);
  }, [product.variants, selectedSize, selectedColor, productSizes, defaultFrontVariant]);

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
  const activeVariantStock = matchedVariant ? parseInt(matchedVariant.stock, 10) : productTotalStock;
  const outOfStock = productSizes.length > 0 && selectedSize ? activeVariantStock === 0 : productTotalStock === 0;
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
    addToCart(product, sizeToUse, selectedColor, quantity, activeSale);
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  const executeBuyNow = () => {
    const sizeToUse = selectedSize || defaultFrontVariant?.size || (productSizes.length > 0 ? productSizes[0] : 'One Size');
    buyNowDirect(product, sizeToUse, selectedColor, quantity, activeSale);
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

    // Require account creation/login before navigating to checkout
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    executeBuyNow();
  };

  const onAuthSuccess = () => {
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
            <div className="price-row-top" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
              <span className="price-original" style={{color: '#9ca3af', textDecoration: 'line-through', fontSize: '14px'}}>
                ₹{activeMrp.toLocaleString('en-IN')}
              </span>
              <span className="price-discount" style={{background: 'var(--color-accent-gold-light)', color: 'var(--color-accent-gold-text)', border: '1px solid #E4CE9F', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700'}}>
                {currentDiscount}% OFF
              </span>
            </div>
            <div className="price-current" style={{fontSize: '28px', fontWeight: '800', color: 'var(--color-charcoal, #111111)'}}>
              ₹{activeSale.toLocaleString('en-IN')}
            </div>
          </>
        ) : (
          <div className="price-current" style={{fontSize: '28px', fontWeight: '800', color: 'var(--color-charcoal, #111111)'}}>
            ₹{activeSale.toLocaleString('en-IN')}
          </div>
        )}
      </div>

      {offer_enabled && <MiniCountdown targetDate={offer_end_at} />}

      {/* Color Selection: Only show if product has multiple real colors defined */}
      {productColors.length > 0 && !productColors.every(c => c === 'Standard' || c === 'Default') && (
        <div className="product-selector-group">
          <h3 className="selector-title">Color <span className="selector-val">{selectedColor}</span></h3>
          <div className="color-swatches">
             {product.colors && product.colors[0]?.hex ? (
                product.colors.map(col => (
                 <button 
                   key={col.name} 
                   className={`color-circle ${selectedColor === col.name ? 'selected' : ''}`}
                   style={{ backgroundColor: col.hex }}
                   onClick={() => setSelectedColor(col.name)}
                   title={col.name}
                   aria-label={`Select color ${col.name}`}
                 ></button>
                ))
             ) : (
                productColors.map(col => (
                 <button 
                   key={col} 
                   className={`color-circle ${selectedColor === col ? 'selected' : ''}`}
                   style={{ backgroundColor: col.toLowerCase() }}
                   onClick={() => setSelectedColor(col)}
                   title={col}
                   aria-label={`Select color ${col}`}
                 ></button>
                ))
             )}
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

        {productSizes.length > 0 ? (
          <div className="size-buttons" style={sizeError ? { outline: '2px solid var(--color-accent-gold)', borderRadius: '8px', padding: '4px' } : {}}>
            {productSizes.map(size => {
              // Read active stock distinct to color+size from variants matrix!
              let variantStock = null;
              if (product.variants?.length > 0) {
                const matchedVariant = product.variants.find(v => 
                  (v.color === selectedColor || !v.color || v.color === 'Standard' || v.color === 'Default') && v.size === size
                ) || product.variants.find(v => v.size === size);
                variantStock = matchedVariant ? parseInt(matchedVariant.stock, 10) : 0;
              }
              const isSizeOos = variantStock !== null ? variantStock === 0 : outOfStock;

              return (
                <button 
                  key={size} 
                  className={`size-btn ${selectedSize === size ? 'selected' : ''} ${isSizeOos ? 'disabled' : ''}`}
                  disabled={isSizeOos}
                  onClick={() => {
                    setSelectedSize(size);
                    setSizeError(false);
                  }}
                >
                  {size}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="one-size-badge" style={{ fontSize: '13px', fontWeight: '700', color: '#4b5563', padding: '8px 12px', background: '#f3f4f6', borderRadius: '4px', display: 'inline-block' }}>
            One Size / Standard Fit
          </div>
        )}
      </div>


      <div className="product-stock-status">
        {outOfStock ? (
          <span className="stock-out">Out of Stock</span>
        ) : stock <= 5 ? (
          <span className="stock-low">Only {stock} left in stock - Order soon</span>
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
        >
          {added ? 'ADDED TO CART ✓' : 'ADD TO CART'}
        </button>
      </div>

      <button className="btn-buy-now" onClick={handleBuyNow} disabled={outOfStock}>
        BUY NOW
      </button>

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

      {/* Delivery & Purchase Confidence Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--color-stone, #D9D3C7)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-charcoal, #111111)', marginBottom: '3px' }}>Delhivery Express</div>
          <div style={{ fontSize: '11.5px', color: '#6B665C' }}>Estimated 2-4 business days across India</div>
        </div>
        <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--color-stone, #D9D3C7)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-charcoal, #111111)', marginBottom: '3px' }}>48H Replacement</div>
          <div style={{ fontSize: '11.5px', color: '#6B665C' }}>For damaged/defective items with unboxing video</div>
        </div>
        <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--color-stone, #D9D3C7)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-charcoal, #111111)', marginBottom: '3px' }}>100% Genuine</div>
          <div style={{ fontSize: '11.5px', color: '#6B665C' }}>Direct from Himatnagar flagship store</div>
        </div>
        <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--color-stone, #D9D3C7)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-charcoal, #111111)', marginBottom: '3px' }}>Free Shipping</div>
          <div style={{ fontSize: '11.5px', color: '#6B665C' }}>On all prepaid & COD orders above ₹999</div>
        </div>
      </div>

      <div className="delivery-checker">
        <h4 className="checker-title">Check Delhivery Express Serviceability</h4>
        <form className="checker-form" onSubmit={handleDeliveryCheck}>
          <input 
            type="text" 
            placeholder="Enter 6-digit Pincode" 
            value={deliveryPincode}
            maxLength={6}
            onChange={(e) => setDeliveryPincode(e.target.value.replace(/\D/g, '').slice(0,6))}
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
        onSelectSize={(size) => setSelectedSize(size)}
      />

      {/* Account Login / Signup Modal on Buy Now */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={onAuthSuccess}
        initialTab="signup"
        message="Please create an account or sign in to proceed with your order."
      />
    </div>
  );
}
