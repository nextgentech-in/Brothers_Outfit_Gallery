import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { checkPincodeServiceability } from '../../services/delhiveryService';
import { isClothingProduct } from '../../utils/productUtils';
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
  const initialColor = product.colors && product.colors.length > 0 ? (product.colors[0].name || product.colors[0]) : 'Black';
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [deliveryPincode, setDeliveryPincode] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState(null);

  // Determine if item is Clothing (where size selection is mandatory) vs Accessories
  const isClothing = isClothingProduct(product);

  // Guard against missing properties gracefully reading legacy vs new admin schema
  const activeMrp = product.mrp || product.compareAtPrice || 0;
  const activeSale = product.salePrice || product.price || 0;
  
  // Calculate distinct UI variables
  const currentDiscount = activeMrp > activeSale ? Math.round(((activeMrp - activeSale) / activeMrp) * 100) : 0;
  const hasDiscount = currentDiscount > 0;
  
  // Read variants if present, else fallback
  const productColors = product.colors?.length > 0 ? product.colors.map(c => c.name || c) : [];
  const productSizes = product.variants?.length > 0 ? [...new Set(product.variants.map(v => v.size))] : (product.sizes || []);
  const productTotalStock = product.variants?.length > 0 ? product.variants.reduce((acc, v) => acc + (parseInt(v.stock, 10)||0), 0) : (product.stock || 0);

  const {
    name, rating = 4.8, offer_enabled, offer_end_at, description, shortDescription
  } = product;

  // Validation
  const outOfStock = productTotalStock === 0;
  const stock = productTotalStock;
  
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
      return alert('PLEASE SELECT A SIZE FOR THIS CLOTHING ITEM');
    }

    const sizeToUse = selectedSize || (productSizes.length > 0 ? productSizes[0] : 'One Size');
    addToCart(product, sizeToUse, selectedColor, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  const handleBuyNow = () => {
    if (isClothing && productSizes.length > 0 && !selectedSize) {
      return alert('PLEASE SELECT A SIZE FOR THIS CLOTHING ITEM');
    }

    const sizeToUse = selectedSize || (productSizes.length > 0 ? productSizes[0] : 'One Size');
    buyNowDirect(product, sizeToUse, selectedColor, quantity);
    navigate('/checkout');
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
      
      <div className="product-rating" onClick={() => window.location.hash = 'reviews'}>
        <span className="stars">
          ★★★★★
        </span>
        <span className="rating-value">{rating}</span>
        <span className="review-count">(124 Reviews)</span>
      </div>

      <div className="product-pricing">
        {hasDiscount ? (
          <>
            <div className="price-row-top" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
              <span className="price-original" style={{color: '#9ca3af', textDecoration: 'line-through', fontSize: '14px'}}>
                ₹{activeMrp.toLocaleString('en-IN')}
              </span>
              <span className="price-discount" style={{background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800'}}>
                {currentDiscount}% OFF
              </span>
            </div>
            <div className="price-current" style={{fontSize: '28px', fontWeight: '800', color: '#111827'}}>
              ₹{activeSale.toLocaleString('en-IN')}
            </div>
          </>
        ) : (
          <div className="price-current" style={{fontSize: '28px', fontWeight: '800', color: '#111827'}}>
            ₹{activeSale.toLocaleString('en-IN')}
          </div>
        )}
      </div>

      {offer_enabled && <MiniCountdown targetDate={offer_end_at} />}

      {/* Color Selection: Only show if product has multiple real colors defined */}
      {productColors.length > 0 && !productColors.every(c => c === 'Standard' || c === 'Default') && (
        <div className="product-selector-group">
          <h3 className="selector-title">COLOR <span className="selector-val">{selectedColor}</span></h3>
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
              ? 'SELECT VOLUME (ML) *'
              : (isClothing ? 'SELECT SIZE *' : 'SELECT SIZE')}
          </h3>
          {isClothing && <button className="btn-size-guide" onClick={() => alert("Size Guide Modal Trigger")}>SIZE GUIDE</button>}
        </div>

        {productSizes.length > 0 ? (
          <div className="size-buttons">
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
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="one-size-badge" style={{ fontSize: '13px', fontWeight: '700', color: '#4b5563', padding: '8px 12px', background: '#f3f4f6', borderRadius: '4px', display: 'inline-block' }}>
            ONE SIZE / STANDARD FIT
          </div>
        )}
      </div>


      <div className="product-stock-status">
        {outOfStock ? (
          <span className="stock-out">OUT OF STOCK</span>
        ) : stock <= 5 ? (
          <span className="stock-low">Only {stock} left - Order soon</span>
        ) : (
          <span className="stock-in">In Stock</span>
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

      <div className="delivery-checker">
        <h4 className="checker-title">📦 CHECK DELHIVERY EXPRESS SERVICEABILITY</h4>
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
          <p className="delivery-status-msg checking">🔄 Checking Delhivery courier coverage...</p>
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
          <summary>DESCRIPTION</summary>
          <div className="accordion-content">
            {description || shortDescription || "No description provided."}
          </div>
        </details>
        
        <details className="accordion-block">
          <summary>PRODUCT DETAILS</summary>
          <div className="accordion-content">
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Fabric: 100% Premium Material</li>
              <li>Fit: Modern Classic</li>
              <li>Pattern: Solid</li>
              <li>Country of Origin: India</li>
            </ul>
          </div>
        </details>
        
        <details className="accordion-block">
          <summary>SHIPPING & EXCHANGE POLICY</summary>
          <div className="accordion-content">
            Standard delivery takes 2-4 business days via Delhivery Express. We offer <strong>exchange or replacement only in the case of damaged or defective items</strong> received. To initiate an exchange, contact us on WhatsApp (+91 84602 33020) with package unboxing video/photo proof within 48 hours of delivery. General returns or refunds are not accepted.
          </div>
        </details>
      </div>
    </div>
  );
}
