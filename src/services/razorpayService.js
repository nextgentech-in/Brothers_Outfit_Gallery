import { getBackendUrl } from '../utils/apiConfig';

/**
 * Ensures that the Razorpay checkout.js script is loaded.
 * @returns {Promise<boolean>}
 */
export function loadRazorpayScript() {
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
}

/**
 * Step 1: Request backend to create a Razorpay order.
 * @param {{ amount?: number, currency?: string, receipt?: string, items?: Array, couponCode?: string }} params
 * @param {string} [idToken]
 * @returns {Promise<{ order_id: string, orderId: string, amount: number, currency: string, key: string }>}
 */
export async function createRazorpayOrder(params, idToken = null) {
  const backendUrl = getBackendUrl();
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const res = await fetch(`${backendUrl}/api/create-order`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create Razorpay payment order.');
  }

  return data;
}

/**
 * Step 3: Verify the HMAC-SHA256 signature on backend.
 * @param {{ razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }} verificationData
 * @returns {Promise<{ success: boolean, message: string, paymentId?: string }>}
 */
export async function verifyRazorpayPayment(verificationData) {
  const backendUrl = getBackendUrl();
  const res = await fetch(`${backendUrl}/api/verify-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(verificationData),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Payment verification failed.');
  }

  return data;
}

/**
 * Step 2: Open Razorpay Standard Checkout modal with complete lifecycle handling.
 * @param {Object} config
 * @param {string} config.orderId
 * @param {number} config.amount (in paise)
 * @param {string} [config.currency='INR']
 * @param {string} [config.name="Brothers Outfit Gallery"]
 * @param {string} [config.description="Order Payment"]
 * @param {{ name?: string, email?: string, contact?: string }} [config.prefill]
 * @param {string} [config.key]
 * @param {Function} [config.onSuccess]
 * @param {Function} [config.onError]
 * @param {Function} [config.onDismiss]
 * @returns {Promise<{ razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string }>}
 */
export async function openRazorpayCheckout({
  orderId,
  amount,
  currency = 'INR',
  name = "Brothers Outfit Gallery",
  description = "Order Payment",
  prefill = {},
  key = null,
  themeColor = '#111827',
  onDismiss = null,
  onPaymentFailed = null,
}) {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !window.Razorpay) {
    throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
  }

  const razorpayKey = key || import.meta.env.VITE_RAZORPAY_KEY_ID;

  return new Promise((resolve, reject) => {
    const options = {
      key: razorpayKey,
      amount,
      currency,
      name,
      description,
      order_id: orderId,
      prefill: {
        name: prefill.name || '',
        email: prefill.email || '',
        contact: prefill.contact || '',
      },
      theme: {
        color: themeColor,
      },
      modal: {
        ondismiss: function () {
          if (onDismiss) onDismiss();
          reject(new Error('Payment window was closed before completion.'));
        },
      },
      handler: function (response) {
        resolve(response);
      },
    };

    const rzp = new window.Razorpay(options);

    rzp.on('payment.failed', function (response) {
      const errorMsg = response.error?.description || response.error?.reason || 'Payment failed.';
      if (onPaymentFailed) {
        onPaymentFailed(response);
      }
      reject(new Error(errorMsg));
    });

    rzp.open();
  });
}
