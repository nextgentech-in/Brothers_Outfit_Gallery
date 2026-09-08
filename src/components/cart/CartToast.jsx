import React from 'react';
import { useCart } from '../../context/CartContext';
import { optimizeImage } from '../../utils/imageUtils';
import './CartToast.css';

export default function CartToast() {
  const { cartToast, hideToast, openCartDrawer } = useCart();

  if (!cartToast) return null;

  return (
    <div className="cart-toast" role="status" aria-live="polite">
      <div className="cart-toast-inner">
        {cartToast.image && (
          <img 
            src={optimizeImage(cartToast.image, 100)} 
            alt={cartToast.name} 
            className="cart-toast-thumb"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/images/hero.png';
            }}
          />
        )}
        <div className="cart-toast-content">
          <div className="cart-toast-badge">
            <span className="cart-toast-check">✓</span> ADDED TO BAG
          </div>
          <span className="cart-toast-name">{cartToast.name}</span>
          <span className="cart-toast-variant">
            {cartToast.size && `Size: ${cartToast.size}`}
            {cartToast.color && cartToast.color !== 'Standard' && cartToast.color !== 'Default' ? ` • ${cartToast.color}` : ''}
          </span>
        </div>

        <div className="cart-toast-actions">
          <button 
            type="button" 
            className="cart-toast-view-btn"
            onClick={() => {
              hideToast();
              openCartDrawer();
            }}
          >
            VIEW BAG
          </button>
          <button 
            type="button" 
            className="cart-toast-close-btn"
            onClick={hideToast}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
