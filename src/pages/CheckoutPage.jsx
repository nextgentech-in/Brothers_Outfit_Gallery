import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder } from '../services/orderService';
import { checkPincodeServiceability, lookupPincodeByPlace } from '../services/delhiveryService';
import { createAdminOrderNotification } from '../services/notificationService';
import { getBackendUrl } from '../utils/apiConfig';
import './CheckoutPage.css';


export default function CheckoutPage() {
  const { cartItems, cartSubtotal, clearCart } = useCart();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [delhiveryStatus, setDelhiveryStatus] = useState(null);
  const [checkingPincode, setCheckingPincode] = useState(false);

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

  // Pricing math: Free delivery for orders >= ₹1000, else ₹70
  const discount = cartSubtotal >= 2500 ? 250 : 0;
  const shippingCost = cartSubtotal >= 1000 ? 0 : 70;
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

  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [searchingPlace, setSearchingPlace] = useState(false);

  // Auto-verify Delhivery pincode serviceability & auto-fill city/state
  useEffect(() => {
    if (shippingAddress.pincode && shippingAddress.pincode.trim().length === 6) {
      const pin = shippingAddress.pincode.trim();
      setCheckingPincode(true);
      checkPincodeServiceability(pin)
        .then(res => {
          setDelhiveryStatus(res);
          setCheckingPincode(false);
          // Auto fill city and state if returned from pincode lookup
          if (res && res.serviceable) {
            setShippingAddress(prev => ({
              ...prev,
              city: prev.city || res.city || '',
              state: prev.state || res.state || ''
            }));
          }
        })
        .catch(() => {
          setDelhiveryStatus({ serviceable: false, error: 'Pincode check failed.' });
          setCheckingPincode(false);
        });
    } else {
      setDelhiveryStatus(null);
    }
  }, [shippingAddress.pincode]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setShippingAddress(prev => ({ ...prev, [name]: value }));

    // Auto-search pincode if user types city or place (>= 3 chars)
    if (name === 'city' && value.trim().length >= 3) {
      setSearchingPlace(true);
      lookupPincodeByPlace(value)
        .then(results => {
          setPlaceSuggestions(results);
          setSearchingPlace(false);
        })
        .catch(() => setSearchingPlace(false));
    } else if (name === 'city' && value.trim().length < 3) {
      setPlaceSuggestions([]);
    }
  };

  const handleSelectPlaceSuggestion = (suggestion) => {
    setShippingAddress(prev => ({
      ...prev,
      city: suggestion.city || suggestion.area,
      state: suggestion.state || prev.state,
      pincode: suggestion.pincode
    }));
    setPlaceSuggestions([]);
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.addressLine || !shippingAddress.city || !shippingAddress.pincode) {
      return setError('Please fill in all required shipping address fields.');
    }

    if (delhiveryStatus && !delhiveryStatus.serviceable) {
      return setError('Cannot place order: Please enter a valid and serviceable PIN code.');
    }

    setLoading(true);
    setError(null);

    const backendUrl = getBackendUrl();

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
        // Trigger Admin Alert
        await createAdminOrderNotification(newOrderId, orderPayload);

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
              // Trigger Admin Alert
              await createAdminOrderNotification(newOrderId, orderPayload);

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
            <div className="checkout-form-group" style={{ position: 'relative' }}>
              <label>City / Place *</label>
              <input
                type="text"
                name="city"
                value={shippingAddress.city}
                onChange={handleInputChange}
                required
                placeholder="Type City or Area..."
              />
              {placeSuggestions.length > 0 && (
                <div className="place-suggestions-dropdown">
                  <div className="suggestions-header">Click to select PIN code & location:</div>
                  {placeSuggestions.map((s, idx) => (
                    <div 
                      key={idx} 
                      className="suggestion-item"
                      onClick={() => handleSelectPlaceSuggestion(s)}
                    >
                      <strong>📍 {s.area || s.city} ({s.pincode})</strong>
                      <span>{s.city}, {s.state}</span>
                    </div>
                  ))}
                </div>
              )}
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
                maxLength={6}
                placeholder="380001"
              />
            </div>
          </div>

          {/* Delhivery Express Serviceability Badge */}
          {checkingPincode && (
            <div className="delhivery-status-banner checking">
              <span>🔄 Checking Delhivery express courier serviceability...</span>
            </div>
          )}
          {!checkingPincode && delhiveryStatus && (
            <div className={`delhivery-status-banner ${delhiveryStatus.serviceable ? 'success' : 'warning'}`}>
              <div className="delhivery-badge-header">
                <strong>📦 Delhivery Express Courier Coverage</strong>
                {delhiveryStatus.serviceable ? (
                  <span className="badge-available">✓ Serviceable</span>
                ) : (
                  <span className="badge-unavailable">⚠ Standard Shipping</span>
                )}
              </div>
              <p style={{ marginTop: '4px' }}>
                {delhiveryStatus.serviceable
                  ? `🚚 Fast Doorstep Delivery Available! Expected Arrival: ${delhiveryStatus.estimatedDeliveryDate ? delhiveryStatus.estimatedDeliveryDate : (delhiveryStatus.estimatedDays || '2-4 Days')}.`
                  : 'Pincode not directly covered by Delhivery Express; standard delivery will apply.'}
              </p>
            </div>
          )}

          {/* Free Shipping Banner */}
          <div className={`free-shipping-bar ${cartSubtotal >= 1000 ? 'unlocked' : 'pending'}`} style={{
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '700',
            background: cartSubtotal >= 1000 ? '#f0fdf4' : '#fffbeb',
            color: cartSubtotal >= 1000 ? '#15803d' : '#b45309',
            border: `1px solid ${cartSubtotal >= 1000 ? '#bbf7d0' : '#fde68a'}`
          }}>
            {cartSubtotal >= 1000 ? (
              <span>🎉 Congratulations! You unlocked FREE Delivery (Order over ₹1,000)!</span>
            ) : (
              <span>🚚 Add ₹{(1000 - cartSubtotal).toLocaleString('en-IN')} more for FREE Express Shipping!</span>
            )}
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
