import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder } from '../services/orderService';
import './CheckoutPage.css';

export default function CheckoutPage() {
  const { cartItems, cartSubtotal, clearCart } = useCart();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [shippingAddress, setShippingAddress] = useState({
    fullName: userProfile?.fullName || '',
    phone: userProfile?.phone || '',
    email: currentUser?.email || userProfile?.email || '',
    addressLine: userProfile?.address?.line1 || '',
    city: userProfile?.address?.city || '',
    state: userProfile?.address?.state || '',
    pincode: userProfile?.address?.pincode || '',
  });

  const [paymentMethod, setPaymentMethod] = useState('razorpay'); // 'razorpay' or 'cod'

  // Pricing math
  const discount = cartSubtotal > 2000 ? 250 : 0;
  const shippingCost = cartSubtotal > 1500 ? 0 : 99;
  const finalTotal = cartSubtotal - discount + shippingCost;

  // Load Razorpay Script onto page
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  if (cartItems.length === 0) {
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <h2>YOUR CART IS EMPTY</h2>
        <button onClick={() => navigate('/shop')} className="btn-auth-primary" style={{ width: 'auto', margin: '20px auto' }}>
          RETURN TO SHOP
        </button>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setShippingAddress(prev => ({ ...prev, [name]: value }));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.addressLine || !shippingAddress.city || !shippingAddress.pincode) {
      return setError('Please fill in all required shipping address fields.');
    }

    setLoading(true);
    setError(null);

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

    if (paymentMethod === 'cod') {
      // Cash on Delivery
      try {
        const newOrderId = `ORD-${Date.now()}`;
        const orderPayload = {
          userId: currentUser?.uid || 'guest',
          userEmail: shippingAddress.email,
          shippingAddress,
          items: cartItems,
          subtotal: cartSubtotal,
          discount,
          shippingCost,
          totalAmount: finalTotal,
          paymentMethod: 'Cash on Delivery',
          paymentStatus: 'Pending (COD)',
          status: 'Processing',
          createdAt: new Date(),
        };

        await createOrder(newOrderId, orderPayload);
        clearCart();
        navigate(`/order-confirmation/${newOrderId}`);
      } catch (err) {
        setError(`Failed to place COD order: ${err.message}`);
        setLoading(false);
      }
      return;
    }

    // Razorpay Flow
    try {
      // 1. Create order on backend
      const res = await fetch(`${backendUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalTotal }),
      });

      if (!res.ok) {
        throw new Error('Failed to initiate Razorpay payment. Ensure backend server is running.');
      }

      const orderData = await res.json();

      // 2. Configure Razorpay modal options
      const options = {
        key: orderData.key || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_dummy',
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Brothers Outfit Gallery',
        description: `Order Payment (${cartItems.length} items)`,
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            // Verify signature
            const verifyRes = await fetch(`${backendUrl}/api/razorpay/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              const newOrderId = `ORD-${Date.now()}`;
              const orderPayload = {
                userId: currentUser?.uid || 'guest',
                userEmail: shippingAddress.email,
                shippingAddress,
                items: cartItems,
                subtotal: cartSubtotal,
                discount,
                shippingCost,
                totalAmount: finalTotal,
                paymentMethod: 'Razorpay Online Payment',
                paymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                paymentStatus: 'Paid',
                status: 'Processing',
                createdAt: new Date(),
              };

              await createOrder(newOrderId, orderPayload);
              clearCart();
              navigate(`/order-confirmation/${newOrderId}`);
            } else {
              setError('Payment verification failed: Signature mismatch.');
              setLoading(false);
            }
          } catch (err) {
            setError(`Error processing payment verification: ${err.message}`);
            setLoading(false);
          }
        },
        prefill: {
          name: shippingAddress.fullName,
          email: shippingAddress.email,
          contact: shippingAddress.phone,
        },
        theme: {
          color: '#111827',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setError(`Payment Failed: ${response.error.description}`);
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'Payment initiation failed.');
      setLoading(false);
    }
  };

  return (
    <div className="checkout-page-container">
      <div className="checkout-header">
        <h1>SECURE CHECKOUT</h1>
        <p>Complete your delivery address and select payment mode.</p>
      </div>

      {error && <div className="checkout-error-banner">{error}</div>}

      <form onSubmit={handlePlaceOrder} className="checkout-grid">
        {/* Left Column: Shipping Address */}
        <div className="checkout-address-section">
          <h3>1. Delivery Address</h3>
          <div className="checkout-form-group">
            <label>Full Name *</label>
            <input
              type="text"
              name="fullName"
              value={shippingAddress.fullName}
              onChange={handleInputChange}
              required
              placeholder="Full Name"
            />
          </div>

          <div className="checkout-form-row">
            <div className="checkout-form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                name="phone"
                value={shippingAddress.phone}
                onChange={handleInputChange}
                required
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="checkout-form-group">
              <label>Email *</label>
              <input
                type="email"
                name="email"
                value={shippingAddress.email}
                onChange={handleInputChange}
                required
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="checkout-form-group">
            <label>Address Line *</label>
            <input
              type="text"
              name="addressLine"
              value={shippingAddress.addressLine}
              onChange={handleInputChange}
              required
              placeholder="House/Flat No, Street, Area"
            />
          </div>

          <div className="checkout-form-row">
            <div className="checkout-form-group">
              <label>City *</label>
              <input
                type="text"
                name="city"
                value={shippingAddress.city}
                onChange={handleInputChange}
                required
                placeholder="City"
              />
            </div>
            <div className="checkout-form-group">
              <label>State *</label>
              <input
                type="text"
                name="state"
                value={shippingAddress.state}
                onChange={handleInputChange}
                required
                placeholder="State"
              />
            </div>
            <div className="checkout-form-group">
              <label>Pincode *</label>
              <input
                type="text"
                name="pincode"
                value={shippingAddress.pincode}
                onChange={handleInputChange}
                required
                placeholder="380001"
              />
            </div>
          </div>

          <h3 style={{ marginTop: '32px' }}>2. Select Payment Method</h3>
          <div className="payment-options">
            <label className={`payment-option ${paymentMethod === 'razorpay' ? 'active' : ''}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="razorpay"
                checked={paymentMethod === 'razorpay'}
                onChange={() => setPaymentMethod('razorpay')}
              />
              <div>
                <strong>💳 Online Payment (Razorpay)</strong>
                <p>Pay securely via UPI, Google Pay, PhonePe, Cards, or Net Banking.</p>
              </div>
            </label>

            <label className={`payment-option ${paymentMethod === 'cod' ? 'active' : ''}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                checked={paymentMethod === 'cod'}
                onChange={() => setPaymentMethod('cod')}
              />
              <div>
                <strong>💵 Cash on Delivery (COD)</strong>
                <p>Pay cash when your order is delivered to your doorstep.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="checkout-summary-section">
          <h3>Order Items ({cartItems.length})</h3>
          <div className="checkout-items-list">
            {cartItems.map((item) => (
              <div key={item.cartItemId} className="checkout-item">
                <img src={item.image} alt={item.name} className="checkout-item-thumb" />
                <div className="checkout-item-details">
                  <strong>{item.name}</strong>
                  <span>Size: {item.size} | Qty: {item.quantity}</span>
                  <span className="checkout-item-price">₹{item.price * item.quantity}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="checkout-totals">
            <div className="summary-row"><span>Subtotal</span><span>₹{cartSubtotal}</span></div>
            {discount > 0 && <div className="summary-row discount"><span>Discount</span><span>-₹{discount}</span></div>}
            <div className="summary-row"><span>Shipping</span><span>{shippingCost === 0 ? 'FREE' : `₹${shippingCost}`}</span></div>
            <div className="summary-divider"></div>
            <div className="summary-row total"><span>TOTAL AMOUNT</span><span>₹{finalTotal}</span></div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-pay-now"
          >
            {loading ? 'PROCESSING...' : (paymentMethod === 'razorpay' ? `PAY ₹${finalTotal} VIA RAZORPAY` : 'PLACE ORDER (COD)')}
          </button>
        </div>
      </form>
    </div>
  );
}
