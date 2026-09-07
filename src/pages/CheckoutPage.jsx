import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder } from '../services/orderService';
import { checkPincodeServiceability, lookupPincodeByPlace } from '../services/delhiveryService';
import { createAdminOrderNotification } from '../services/notificationService';
import { validateCoupon } from '../services/couponService';
import { getBackendUrl } from '../utils/apiConfig';
import AuthModal from '../components/auth/AuthModal';
import PhoneOtpModal from '../components/checkout/PhoneOtpModal';
import './CheckoutPage.css';


export default function CheckoutPage() {
  const { cartItems, cartSubtotal, clearCart, appliedCoupon, applyCoupon, removeCoupon } = useCart();
  const { currentUser, userProfile, updateFirestoreProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [delhiveryStatus, setDelhiveryStatus] = useState(null);
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [phoneOtpModalOpen, setPhoneOtpModalOpen] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState(null);

  const [couponInput, setCouponInput] = useState('');
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState(null);

  const [shippingAddress, setShippingAddress] = useState({
    fullName: userProfile?.fullName || '',
    phone: userProfile?.phone || '',
    email: currentUser?.email || userProfile?.email || '',
    addressLine: userProfile?.address?.line1 || '',
    city: userProfile?.address?.city || '',
    state: userProfile?.address?.state || '',
    pincode: userProfile?.address?.pincode || '',
  });

  useEffect(() => {
    if (userProfile) {
      setShippingAddress(prev => ({
        ...prev,
        fullName: prev.fullName || userProfile.fullName || '',
        phone: prev.phone || userProfile.phone || '',
        email: prev.email || currentUser?.email || userProfile.email || '',
        addressLine: prev.addressLine || userProfile.address?.line1 || '',
        city: prev.city || userProfile.address?.city || '',
        state: prev.state || userProfile.address?.state || '',
        pincode: prev.pincode || userProfile.address?.pincode || '',
      }));
    }
  }, [userProfile, currentUser]);

  useEffect(() => {
    if (userProfile?.phoneVerified && userProfile?.phone) {
      const clean = String(userProfile.phone).replace(/\D/g, '').slice(-10);
      if (clean.length === 10) setVerifiedPhone(clean);
    }
  }, [userProfile]);

  const currentPhoneDigits = String(shippingAddress.phone || '').replace(/\D/g, '').slice(-10);
  const isPhoneVerified = Boolean(
    verifiedPhone && currentPhoneDigits && verifiedPhone === currentPhoneDigits
  );

  const [paymentMethod, setPaymentMethod] = useState('razorpay'); // 'razorpay' or 'cod'

  // Pricing math: Free delivery for orders >= ₹1000, else ₹70
  const discount = cartSubtotal >= 2500 ? 250 : 0;
  const couponDiscount = appliedCoupon ? Number(appliedCoupon.discountAmount || 0) : 0;
  const shippingCost = cartSubtotal >= 1000 ? 0 : 70;
  const finalTotal = Math.max(0, cartSubtotal - discount - couponDiscount + shippingCost);

  const handleCheckoutApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponChecking(true);
    setCouponFeedback(null);

    const res = await validateCoupon(couponInput, cartSubtotal);
    setCouponChecking(false);

    if (res.valid) {
      applyCoupon(res);
      setCouponFeedback({ type: 'success', text: res.message });
      setCouponInput('');
    } else {
      setCouponFeedback({ type: 'error', text: res.error });
    }
  };

  const handleCheckoutRemoveCoupon = () => {
    removeCoupon();
    setCouponFeedback(null);
  };


  // Ensure Razorpay SDK is loaded safely with fallback and timeout
  const ensureRazorpayLoaded = () => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      let script = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
      }
      if (window.Razorpay) return resolve(true);
      script.addEventListener('load', () => resolve(true), { once: true });
      script.addEventListener('error', () => resolve(false), { once: true });
      setTimeout(() => resolve(Boolean(window.Razorpay)), 5000);
    });
  };

  useEffect(() => {
    ensureRazorpayLoaded();
  }, []);

  const [placeSuggestions, setPlaceSuggestions] = useState([]);


  // Auto-verify Delhivery pincode serviceability & auto-fill city/state
  useEffect(() => {
    let isMounted = true;
    if (shippingAddress.pincode && shippingAddress.pincode.trim().length === 6) {
      const pin = shippingAddress.pincode.trim();
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setCheckingPincode(true);
        checkPincodeServiceability(pin)
          .then(res => {
            if (!isMounted) return;
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
            if (!isMounted) return;
            setDelhiveryStatus({ serviceable: false, error: 'Pincode check failed.' });
            setCheckingPincode(false);
          });
      });
    } else {
      setDelhiveryStatus(null);
    }
    return () => {
      isMounted = false;
    };
  }, [shippingAddress.pincode]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setShippingAddress(prev => ({ ...prev, [name]: value }));

    if (name === 'phone') {
      const digits = String(value).replace(/\D/g, '').slice(-10);
      if (verifiedPhone && digits !== verifiedPhone) {
        setVerifiedPhone(null);
      }
    }

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
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.addressLine || !shippingAddress.city || !shippingAddress.pincode) {
      return setError('Please fill in all required shipping address fields.');
    }

    const cleanInputPhone = String(shippingAddress.phone).replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanInputPhone)) {
      return setError('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
    }

    if (delhiveryStatus && !delhiveryStatus.serviceable) {
      return setError('Cannot place order: Please enter a valid and serviceable PIN code.');
    }

    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    // Check if phone number needs verification with OTP
    if (!isPhoneVerified) {
      setError(null);
      setPhoneOtpModalOpen(true);
      return;
    }

    await executeOrderPlacement(shippingAddress.phone);
  };

  const handlePhoneVerified = async (confirmedPhone) => {
    setVerifiedPhone(confirmedPhone);
    setPhoneOtpModalOpen(false);

    // Save verified phone to Firestore user profile in background
    if (currentUser && updateFirestoreProfile) {
      updateFirestoreProfile(currentUser.uid, {
        phone: confirmedPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date().toISOString()
      }).catch(() => {});
    }

    // Immediately execute order placement with verified phone
    await executeOrderPlacement(confirmedPhone);
  };

  const executeOrderPlacement = async (activePhone = null) => {
    const finalPhone = activePhone || shippingAddress.phone;
    setLoading(true);
    setError(null);

    const backendUrl = getBackendUrl();

    if (paymentMethod === 'cod') {
      // Cash on Delivery
      try {
        const newOrderId = `ORD-${Date.now()}`;
        const emailToSave = (shippingAddress.email || currentUser?.email || '').toLowerCase().trim();
        const orderPayload = {
          userId: currentUser?.uid || 'guest',
          userEmail: emailToSave,
          userPhone: finalPhone,
          phoneVerified: true,
          shippingAddress: {
            ...shippingAddress,
            phone: finalPhone,
            email: emailToSave
          },
          items: cartItems,
          subtotal: cartSubtotal,
          discount,
          couponCode: appliedCoupon?.coupon?.code || null,
          couponDiscount,
          shippingCost,
          totalAmount: finalTotal,
          paymentMethod: 'Cash on Delivery',
          paymentStatus: 'Pending (COD)',
          status: 'Processing',
          createdAt: new Date(),
        };

        await createOrder(newOrderId, orderPayload);

        // Save delivery info to user profile
        if (currentUser && updateFirestoreProfile) {
          updateFirestoreProfile(currentUser.uid, {
            fullName: shippingAddress.fullName,
            phone: finalPhone,
            phoneVerified: true,
            address: {
              line1: shippingAddress.addressLine,
              city: shippingAddress.city,
              state: shippingAddress.state,
              pincode: shippingAddress.pincode
            }
          }).catch(() => {});
        }

        try {
          localStorage.setItem('last_placed_order', newOrderId);
        } catch { }
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
      const isGatewayLoaded = await ensureRazorpayLoaded();
      if (!isGatewayLoaded || !window.Razorpay) {
        throw new Error('Payment gateway is initializing. Please check your internet connection and try again.');
      }

      // 1. Create order on backend
      const res = await fetch(`${backendUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalTotal }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to initiate Razorpay payment. Ensure backend server is running.');
      }

      const orderData = await res.json();

      // 2. Configure Razorpay modal options
      const options = {
        key: orderData.key || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TYFhwSwlmko7Oj',
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Brothers Outfit Gallery',
        description: `Order Payment (${cartItems.length} items)`,
        order_id: orderData.orderId,
        prefill: {
          name: shippingAddress.fullName || '',
          email: (shippingAddress.email || currentUser?.email || '').toLowerCase().trim(),
          contact: finalPhone
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay with UPI (Google Pay, PhonePe, Paytm, QR)',
                instruments: [{ method: 'upi' }]
              },
              other: {
                name: 'Cards & Net Banking',
                instruments: [{ method: 'card' }, { method: 'netbanking' }, { method: 'wallet' }]
              }
            },
            sequence: ['block.upi', 'block.other'],
            preferences: { show_default_blocks: true }
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
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
              const emailToSave = (shippingAddress.email || currentUser?.email || '').toLowerCase().trim();
              const orderPayload = {
                userId: currentUser?.uid || 'guest',
                userEmail: emailToSave,
                userPhone: finalPhone,
                phoneVerified: true,
                shippingAddress: {
                  ...shippingAddress,
                  phone: finalPhone,
                  email: emailToSave
                },
                items: cartItems,
                subtotal: cartSubtotal,
                discount,
                couponCode: appliedCoupon?.coupon?.code || null,
                couponDiscount,
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

              // Save delivery info to user profile
              if (currentUser && updateFirestoreProfile) {
                updateFirestoreProfile(currentUser.uid, {
                  fullName: shippingAddress.fullName,
                  phone: finalPhone,
                  phoneVerified: true,
                  address: {
                    line1: shippingAddress.addressLine,
                    city: shippingAddress.city,
                    state: shippingAddress.state,
                    pincode: shippingAddress.pincode
                  }
                }).catch(() => {});
              }

              try {
                localStorage.setItem('last_placed_order', newOrderId);
              } catch { }
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
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Phone Number *</span>
                {isPhoneVerified ? (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    color: '#15803d',
                    background: '#dcfce7',
                    border: '1px solid #86efac',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}>
                    ✓ Verified
                  </span>
                ) : (
                  <span style={{
                    fontSize: '0.72rem',
                    color: '#b45309',
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    OTP Verification Required
                  </span>
                )}
              </label>
              <input
                type="tel"
                name="phone"
                value={shippingAddress.phone}
                onChange={handleInputChange}
                required
                placeholder="10-digit mobile number (e.g. 9876543210)"
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
                  <span>Size: {typeof item.size === 'object' && item.size !== null ? (item.size.name || item.size.size || 'One Size') : (item.size || 'One Size')} | Qty: {item.quantity}</span>
                  <span className="checkout-item-price">₹{item.price * item.quantity}</span>
                </div>

              </div>
            ))}
          </div>

          {/* Coupon Code Section */}
          <div className="checkout-coupon-card" style={{ margin: '18px 0', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
              Have a Discount Coupon?
            </div>
            {!appliedCoupon ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Enter code (e.g. BROTHERS10)"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    if (couponFeedback) setCouponFeedback(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    textTransform: 'uppercase',
                    fontWeight: 600
                  }}
                />
                <button
                  type="button"
                  onClick={handleCheckoutApplyCoupon}
                  disabled={couponChecking || !couponInput.trim()}
                  style={{
                    padding: '10px 18px',
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    cursor: couponChecking ? 'not-allowed' : 'pointer'
                  }}
                >
                  {couponChecking ? '...' : 'APPLY'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', padding: '10px 14px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#15803d', fontWeight: 700 }}>
                    ✓ Coupon "{appliedCoupon.coupon?.code}" Active
                  </div>
                  <div style={{ fontSize: '12px', color: '#166534' }}>
                    Saving ₹{couponDiscount.toLocaleString('en-IN')} on this order
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={handleCheckoutRemoveCoupon} 
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Remove
                </button>
              </div>
            )}

            {couponFeedback && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                fontWeight: 600,
                color: couponFeedback.type === 'success' ? '#15803d' : '#dc2626'
              }}>
                {couponFeedback.text}
              </div>
            )}
          </div>

          <div className="checkout-totals">
            <div className="summary-row"><span>Subtotal</span><span>₹{cartSubtotal.toLocaleString('en-IN')}</span></div>
            {discount > 0 && <div className="summary-row discount"><span>Auto Tier Discount</span><span>-₹{discount.toLocaleString('en-IN')}</span></div>}
            {appliedCoupon && (
              <div className="summary-row discount" style={{ color: '#16a34a' }}>
                <span>Coupon ({appliedCoupon.coupon?.code})</span>
                <span>-₹{couponDiscount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="summary-row"><span>Shipping</span><span>{shippingCost === 0 ? 'FREE' : `₹${shippingCost}`}</span></div>
            <div className="summary-divider"></div>
            <div className="summary-row total"><span>TOTAL AMOUNT</span><span>₹{finalTotal.toLocaleString('en-IN')}</span></div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-pay-now"
          >
            {loading ? 'PROCESSING...' : (paymentMethod === 'razorpay' ? `PAY ₹${finalTotal.toLocaleString('en-IN')} VIA RAZORPAY` : 'PLACE ORDER (COD)')}
          </button>
        </div>
      </form>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => handlePlaceOrder()}
        message="Sign in or create an account to place your order."
      />

      <PhoneOtpModal
        isOpen={phoneOtpModalOpen}
        phone={shippingAddress.phone}
        onClose={() => setPhoneOtpModalOpen(false)}
        onSuccess={handlePhoneVerified}
        onChangePhone={() => {
          setPhoneOtpModalOpen(false);
          const phoneInput = document.querySelector('input[name="phone"]');
          if (phoneInput) {
            phoneInput.focus();
            phoneInput.select();
          }
        }}
      />
    </div>
  );
}
