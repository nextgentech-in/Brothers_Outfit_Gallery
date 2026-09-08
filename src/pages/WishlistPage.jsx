import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { optimizeImage } from '../utils/imageUtils';
import './WishlistPage.css';

export default function WishlistPage() {
  const { wishlistItems, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const handleMoveToCart = (product) => {
    const size = product.sizes?.[0] || 'One Size';
    addToCart(product, size, 'Standard', 1, product.price);
    removeFromWishlist(product.id);
  };

  const handleMoveAllToCart = () => {
    wishlistItems.forEach(item => {
      const size = item.sizes?.[0] || 'One Size';
      addToCart(item, size, 'Standard', 1, item.price);
    });
    clearWishlist();
    navigate('/cart');
  };

  return (
    <div className="wishlist-page">
      <div className="wishlist-container">
        {/* Header */}
        <div className="wishlist-header">
          <div>
            <span className="wishlist-subtitle">SAVED ITEMS</span>
            <h1 className="wishlist-title">My Wishlist</h1>
            <p className="wishlist-count">
              {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
            </p>
          </div>

          {wishlistItems.length > 0 && (
            <div className="wishlist-header-actions">
              <button
                type="button"
                onClick={handleMoveAllToCart}
                className="wishlist-btn-move-all"
              >
                Move All to Cart
              </button>
              <button
                type="button"
                onClick={clearWishlist}
                className="wishlist-btn-clear"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Empty State */}
        {wishlistItems.length === 0 ? (
          <div className="wishlist-empty">
            <div className="wishlist-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <h2>Your wishlist is empty</h2>
            <p>
              Save items you love by tapping the heart icon on any product.
              Review and order them anytime from here.
            </p>
            <Link to="/shop" className="wishlist-explore-btn">
              Explore Collection
            </Link>
          </div>
        ) : (
          /* Grid of Saved Items */
          <div className="wishlist-grid">
            {wishlistItems.map((item) => {
              const hasDiscount = item.mrp && item.mrp > item.price;
              const discountPct = hasDiscount ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;

              return (
                <div key={item.id} className="wishlist-card">
                  {/* Remove Button */}
                  <button
                    type="button"
                    className="wishlist-remove-btn"
                    onClick={() => removeFromWishlist(item.id)}
                    aria-label={`Remove ${item.name} from wishlist`}
                    title="Remove from wishlist"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>

                  {/* Thumbnail */}
                  <Link to={`/product/${item.slug}`} className="wishlist-card-img-link">
                    <img
                      src={optimizeImage(item.image, 400)}
                      alt={item.name}
                      className="wishlist-card-img"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/images/hero.png';
                      }}
                    />
                    {hasDiscount && (
                      <span className="wishlist-card-badge">{discountPct}% OFF</span>
                    )}
                  </Link>

                  {/* Info */}
                  <div className="wishlist-card-info">
                    <span className="wishlist-card-category">{item.category || "Men's Collection"}</span>
                    <Link to={`/product/${item.slug}`} className="wishlist-card-title">
                      {item.name}
                    </Link>

                    <div className="wishlist-card-price-row">
                      <span className="wishlist-card-price">
                        ₹{(item.price || 0).toLocaleString('en-IN')}
                      </span>
                      {hasDiscount && (
                        <span className="wishlist-card-mrp">
                          ₹{item.mrp.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Move to Cart / Options CTA */}
                    <div className="wishlist-card-actions">
                      {item.sizes && item.sizes.length > 1 ? (
                        <Link
                          to={`/product/${item.slug}`}
                          className="wishlist-btn-options"
                        >
                          Choose Options
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="wishlist-btn-add"
                          onClick={() => handleMoveToCart(item)}
                        >
                          Move to Cart
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
