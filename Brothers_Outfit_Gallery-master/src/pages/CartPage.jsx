import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import CartItemCard from '../components/cart/CartItemCard';
import OrderSummary from '../components/cart/OrderSummary';
import './CartPage.css';

export default function CartPage() {
  const { cartItems, cartSubtotal, totalItems } = useCart();

  if (cartItems.length === 0) {
    return (
      <div className="cart-empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2, margin: '0 auto 24px' }}>
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        <h1>YOUR CART IS EMPTY</h1>
        <p>Looks like you haven't added anything yet.</p>
        <Link to="/shop" className="btn-continue-shopping">CONTINUE SHOPPING →</Link>
      </div>
    );
  }

  return (
    <div className="cart-page-container">
      <div className="cart-header-block">
        <h1 className="cart-main-heading">YOUR CART</h1>
        <p className="cart-sub-heading">Review your items before checkout ({totalItems} items).</p>
      </div>

      <Link to="/shop" className="cart-continue-link">← CONTINUE SHOPPING</Link>

      <div className="cart-desktop-grid">
        <div className="cart-items-column">
          {cartItems.map(item => (
            <CartItemCard key={item.cartItemId} item={item} />
          ))}
        </div>
        
        <div className="cart-summary-column">
          <OrderSummary subtotal={cartSubtotal} itemCount={totalItems} />
        </div>
      </div>
    </div>
  );
}
