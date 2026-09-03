import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { validateCoupon } from '../../services/couponService';
import './OrderSummary.css';

export default function OrderSummary({ subtotal, itemCount }) {
  const navigate = useNavigate();
  const { appliedCoupon, applyCoupon, removeCoupon } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMsg, setCouponMsg] = useState(null);

  const discount = subtotal >= 2500 ? 250 : 0;
  const shipping = subtotal >= 1000 ? 0 : 70;
  const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  
  const finalTotal = Math.max(0, subtotal - discount - couponDiscount + shipping);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponMsg(null);

    const res = await validateCoupon(couponCode, subtotal);
    setCouponLoading(false);

    if (res.valid) {
      applyCoupon(res);
      setCouponMsg({ type: 'success', text: res.message });
      setCouponCode('');
    } else {
      setCouponMsg({ type: 'error', text: res.error });
    }
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponMsg(null);
  };

  return (
    <div className="order-summary-card">
      <h3 className="summary-title">ORDER SUMMARY</h3>
      
      <div className="summary-row">
        <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
        <span>₹{subtotal.toLocaleString('en-IN')}</span>
      </div>
      
      {discount > 0 && (
        <div className="summary-row discount">
          <span>Auto Tier Discount</span>
          <span>-₹{discount.toLocaleString('en-IN')}</span>
        </div>
      )}

      {appliedCoupon && (
        <div className="summary-row discount" style={{ color: '#16a34a' }}>
          <span>
            Coupon: <strong>{appliedCoupon.coupon?.code || 'APPLIED'}</strong>
            <button 
              type="button" 
              onClick={handleRemoveCoupon} 
              style={{ background: 'none', border: 'none', color: '#ef4444', marginLeft: '8px', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
            >
              Remove
            </button>
          </span>
          <span>-₹{couponDiscount.toLocaleString('en-IN')}</span>
        </div>
      )}
      
      <div className="summary-row">
        <span>Shipping</span>
        <span>{shipping === 0 ? <strong style={{ color: '#16a34a' }}>FREE</strong> : `₹${shipping}`}</span>
      </div>

      {/* Coupon Application Box */}
      <div className="coupon-box-wrapper" style={{ margin: '16px 0', borderTop: '1px dashed #e2e8f0', borderBottom: '1px dashed #e2e8f0', padding: '14px 0' }}>
        {!appliedCoupon ? (
          <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Coupon code (e.g. SAVE10)"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                if (couponMsg) setCouponMsg(null);
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'inherit',
                textTransform: 'uppercase',
                fontWeight: '600'
              }}
            />
            <button
              type="submit"
              disabled={couponLoading || !couponCode.trim()}
              style={{
                padding: '10px 16px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '1px',
                cursor: couponLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {couponLoading ? '...' : 'APPLY'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', padding: '8px 12px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
              ✓ Code {appliedCoupon.coupon?.code} active (-₹{couponDiscount})
            </span>
            <button 
              type="button" 
              onClick={handleRemoveCoupon} 
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}

        {couponMsg && (
          <p style={{
            margin: '8px 0 0',
            fontSize: '11px',
            color: couponMsg.type === 'success' ? '#15803d' : '#dc2626',
            fontWeight: '600'
          }}>
            {couponMsg.text}
          </p>
        )}
      </div>
      
      <div className="summary-divider" style={{ margin: '16px 0' }}></div>
      
      <div className="summary-row total">
        <span>TOTAL</span>
        <span>₹{finalTotal.toLocaleString('en-IN')}</span>
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
