import { useState } from 'react';
import { createRazorpayOrder, verifyRazorpayPayment, openRazorpayCheckout } from '../../services/razorpayService';

/**
 * Reusable Razorpay Standard Checkout Button.
 * Handles the complete 3-step Razorpay Web flow:
 * 1. POST /api/create-order
 * 2. Razorpay Modal checkout with checkout.js
 * 3. POST /api/verify-payment (HMAC-SHA256 verification)
 */
export default function RazorpayButton({
  amount, // in paise (e.g. 50000 = ₹500.00)
  currency = 'INR',
  receipt = null,
  prefill = {},
  buttonText = 'Pay with Razorpay',
  className = '',
  style = {},
  disabled = false,
  onSuccess = null,
  onError = null,
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePayment = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      // Step 1: Create order on backend
      const orderData = await createRazorpayOrder({
        amount: Math.round(Number(amount)),
        currency,
        receipt: receipt || `rcpt_${Date.now().toString().slice(-8)}`,
      });

      // Step 2: Open Razorpay checkout modal
      const paymentResponse = await openRazorpayCheckout({
        orderId: orderData.order_id || orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency,
        key: orderData.key || import.meta.env.VITE_RAZORPAY_KEY_ID,
        prefill,
        onDismiss: () => {
          setLoading(false);
        },
      });

      // Step 3: Verify payment signature on backend
      const verifyResult = await verifyRazorpayPayment({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      });

      if (onSuccess) {
        onSuccess({
          ...paymentResponse,
          verification: verifyResult,
        });
      }
    } catch (err) {
      console.error('Razorpay Checkout failed:', err);
      const msg = err.message || 'Payment could not be completed.';
      setErrorMessage(msg);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="razorpay-btn-wrapper">
      <button
        type="button"
        onClick={handlePayment}
        disabled={disabled || loading}
        className={`razorpay-checkout-button ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px 24px',
          backgroundColor: '#0c2340',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || loading ? 0.7 : 1,
          transition: 'all 0.2s ease',
          ...style,
        }}
      >
        {loading ? (
          <>
            <span
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            Processing...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.884.807-1.482 2.224-1.482 1.613 0 3.012.744 3.792 1.545l1.668-2.172C17.062 3.393 15.112 2.5 12.844 2.5 9.774 2.5 7.42 4.296 7.42 7.02c0 2.82 2.51 3.996 5.02 4.896 2.388.855 3.513 1.545 3.513 2.636 0 1.054-.992 1.704-2.54 1.704-1.954 0-3.69-1.023-4.62-2.172l-1.859 2.11C8.288 18.04 10.55 19.5 13.41 19.5c3.388 0 5.86-1.828 5.86-4.743 0-3.036-2.73-4.183-5.294-5.607z" />
            </svg>
            {buttonText}
          </>
        )}
      </button>

      {errorMessage && (
        <div
          style={{
            marginTop: '8px',
            color: '#dc2626',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}
    </div>
  );
}
