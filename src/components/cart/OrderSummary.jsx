import { useNavigate } from 'react-router-dom';
import './OrderSummary.css';

export default function OrderSummary({ subtotal, itemCount }) {
  const navigate = useNavigate();
  // Simplified math logics handling base discounts dynamically mapping over parameters smoothly
  const discount = subtotal > 2000 ? 250 : 0;
  const shipping = subtotal > 1500 ? 0 : 99;
  
  const finalTotal = subtotal - discount + shipping;

  return (
    <div className="order-summary-card">
      <h3 className="summary-title">ORDER SUMMARY</h3>
      
      <div className="summary-row">
        <span>Subtotal</span>
        <span>₹{subtotal}</span>
      </div>
      
      {discount > 0 && (
        <div className="summary-row discount">
          <span>Discount (Auto applied)</span>
          <span>-₹{discount}</span>
        </div>
      )}
      
      <div className="summary-row">
        <span>Shipping</span>
        <span>{shipping === 0 ? 'FREE' : `₹${shipping}`}</span>
      </div>
      
      <div className="summary-divider"></div>
      
      <div className="summary-row total">
        <span>TOTAL</span>
        <span>₹{finalTotal}</span>
      </div>

      <button className="btn-checkout-green" onClick={() => navigate('/checkout')}>
        PROCEED TO CHECKOUT →
      </button>

      <div className="summary-trust-badges">
        <span>🔒 Secure Checkout</span>
        <span>🛡️ Safe Payments</span>
        <span>🔁 Easy Returns</span>
      </div>
    </div>
  );
}
