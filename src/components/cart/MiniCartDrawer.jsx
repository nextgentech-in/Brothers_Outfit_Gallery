import React, { useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useFocusTrap } from '../../utils/a11yUtils';
import { optimizeImage } from '../../utils/imageUtils';
import './MiniCartDrawer.css';

export default function MiniCartDrawer() {
  const {
    isCartDrawerOpen,
    closeCartDrawer,
    cartItems,
    updateQuantity,
    removeFromCart,
    totalItems,
    cartSubtotal
  } = useCart();

  const drawerRef = useRef(null);
  const navigate = useNavigate();

  useFocusTrap(drawerRef, isCartDrawerOpen, closeCartDrawer);

  useEffect(() => {
    if (isCartDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isCartDrawerOpen]);

  if (!isCartDrawerOpen) return null;

  const freeShippingThreshold = 999;
  const differenceForFreeShip = Math.max(0, freeShippingThreshold - cartSubtotal);
  const freeShippingProgress = Math.min(100, Math.round((cartSubtotal / freeShippingThreshold) * 100));

  const handleCheckout = () => {
    closeCartDrawer();
    navigate('/checkout');
  };

  const handleViewCart = () => {
    closeCartDrawer();
    navigate('/cart');
  };

  return (
    <div className="mini-cart-overlay" onClick={closeCartDrawer} role="dialog" aria-modal="true" aria-label="Shopping Cart Drawer">
      <div 
        ref={drawerRef} 
        className="mini-cart-drawer" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mini-cart-header">
          <div className="mini-cart-title-row">
            <h2 className="mini-cart-title">YOUR BAG</h2>
            <span className="mini-cart-count">({totalItems} {totalItems === 1 ? 'ITEM' : 'ITEMS'})</span>
          </div>
          <button 
            type="button" 
            className="mini-cart-close-btn" 
            onClick={closeCartDrawer}
            aria-label="Close cart drawer"
          >
            ✕
          </button>
        </div>

        {/* Free Shipping Progress Indicator */}
        <div className="mini-cart-shipping-bar">
          {differenceForFreeShip === 0 ? (
            <span className="shipping-unlocked-text">🎉 You've unlocked <strong>FREE EXPRESS SHIPPING</strong>!</span>
          ) : (
            <span className="shipping-progress-text">
              Add <strong>₹{differenceForFreeShip.toLocaleString('en-IN')}</strong> more for <strong>FREE EXPRESS SHIPPING</strong>
            </span>
          )}
          <div className="shipping-progress-track">
            <div 
              className="shipping-progress-fill" 
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="mini-cart-body">
          {cartItems.length === 0 ? (
            <div className="mini-cart-empty">
              <div className="mini-cart-empty-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <h3>Your bag is empty</h3>
              <p>Looks like you haven't added anything to your cart yet.</p>
              <button 
                type="button" 
                className="mini-cart-shop-btn"
                onClick={() => { closeCartDrawer(); navigate('/shop'); }}
              >
                START SHOPPING
              </button>
            </div>
          ) : (
            <div className="mini-cart-items">
              {cartItems.map((item) => (
                <div key={item.cartItemId} className="mini-cart-item">
                  <Link 
                    to={`/product/${item.slug}`} 
                    onClick={closeCartDrawer}
                    className="mini-cart-item-img-link"
                  >
                    <img 
                      src={optimizeImage(item.image, 160)} 
                      alt={item.name} 
                      className="mini-cart-item-img"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/images/hero.png';
                      }}
                    />
                  </Link>

                  <div className="mini-cart-item-details">
                    <div className="mini-cart-item-top">
                      <Link 
                        to={`/product/${item.slug}`} 
                        onClick={closeCartDrawer}
                        className="mini-cart-item-name"
                      >
                        {item.name}
                      </Link>
                      <button 
                        type="button" 
                        className="mini-cart-item-remove"
                        onClick={() => removeFromCart(item.cartItemId)}
                        aria-label={`Remove ${item.name} from cart`}
                        title="Remove item"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    <div className="mini-cart-item-variants">
                      {item.size && <span className="variant-pill">Size: {item.size}</span>}
                      {item.color && item.color !== 'Standard' && item.color !== 'Default' && (
                        <span className="variant-pill">Color: {item.color}</span>
                      )}
                    </div>

                    <div className="mini-cart-item-bottom">
                      <div className="mini-cart-qty-ctrl">
                        <button 
                          type="button" 
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button 
                          type="button" 
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          disabled={item.quantity >= (item.stock || 99)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <span className="mini-cart-item-price">
                        ₹{((item.price || 0) * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="mini-cart-footer">
            <div className="mini-cart-subtotal-row">
              <span className="subtotal-label">Subtotal</span>
              <span className="subtotal-amount">₹{cartSubtotal.toLocaleString('en-IN')}</span>
            </div>
            <p className="mini-cart-tax-notice">Taxes and shipping calculated at checkout</p>

            <button 
              type="button" 
              className="mini-cart-checkout-btn"
              onClick={handleCheckout}
            >
              PROCEED TO CHECKOUT • ₹{cartSubtotal.toLocaleString('en-IN')}
            </button>

            <button 
              type="button" 
              className="mini-cart-view-cart-btn"
              onClick={handleViewCart}
            >
              VIEW FULL BAG
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
