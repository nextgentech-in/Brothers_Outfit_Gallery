import { auth } from '../firebase/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getBackendUrl } from '../utils/apiConfig';

let confirmationResultStore = null;
let activeOtpProvider = 'firebase'; // 'firebase' | 'backend'

function ensureRecaptchaContainer() {
  let container = document.getElementById('recaptcha-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'recaptcha-container';
    container.style.position = 'fixed';
    container.style.bottom = '0';
    container.style.right = '0';
    container.style.zIndex = '9999999';
    document.body.appendChild(container);
  }
  return container;
}

function getRecaptchaVerifier() {
  ensureRecaptchaContainer();
  if (window.__firebaseRecaptchaVerifier) {
    try {
      window.__firebaseRecaptchaVerifier.clear();
    } catch (_) {}
    window.__firebaseRecaptchaVerifier = null;
  }

  window.__firebaseRecaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {
      try {
        if (window.__firebaseRecaptchaVerifier) {
          window.__firebaseRecaptchaVerifier.clear();
          window.__firebaseRecaptchaVerifier = null;
        }
      } catch (_) {}
    }
  });

  return window.__firebaseRecaptchaVerifier;
}

/**
 * Send an OTP to a 10-digit Indian phone number via Firebase Phone Authentication (Google SMS).
 * @param {string} phone 
 * @returns {Promise<{success: boolean, message?: string, provider?: string}>}
 */
export async function sendPhoneOtp(phone) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const formattedPhone = `+91${cleanPhone}`;

  // 1. Primary: Firebase Phone Authentication (Google SMS)
  try {
    const verifier = getRecaptchaVerifier();
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    confirmationResultStore = confirmationResult;
    activeOtpProvider = 'firebase';
    console.log('[OTP] Firebase SMS sent successfully to', formattedPhone);
    return {
      success: true,
      provider: 'firebase',
      message: `OTP sent via SMS to ${formattedPhone}`
    };
  } catch (firebaseErr) {
    console.warn('[OTP] Firebase Phone Auth error:', firebaseErr.code, firebaseErr.message);

    try {
      if (window.__firebaseRecaptchaVerifier) {
        window.__firebaseRecaptchaVerifier.clear();
        window.__firebaseRecaptchaVerifier = null;
      }
    } catch (_) {}

    // 2. Secondary fallback: Backend SMS gateway (if configured)
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/otp/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        activeOtpProvider = 'backend';
        confirmationResultStore = null;
        return {
          success: true,
          provider: 'backend',
          message: data.message || `OTP sent to +91 ${cleanPhone} via SMS.`
        };
      }
    } catch (_) {}

    if (firebaseErr.code === 'auth/operation-not-allowed') {
      throw new Error('Please enable India (+91) in Firebase Console under Authentication > Settings > SMS region policy.');
    }
    if (firebaseErr.code === 'auth/too-many-requests') {
      throw new Error('Too many requests. Please wait a moment before requesting another OTP.');
    }

    throw new Error(firebaseErr.message || 'Failed to send SMS OTP. Please check your phone number.');
  }
}

/**
 * Verify the OTP entered by the user
 * @param {string} phone 
 * @param {string} otp 
 * @returns {Promise<{success: boolean, verified: boolean, provider?: string}>}
 */
export async function verifyPhoneOtp(phone, otp) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const cleanOtp = String(otp).trim();

  // 1. If Firebase was used
  if (activeOtpProvider === 'firebase' && confirmationResultStore) {
    try {
      const userCred = await confirmationResultStore.confirm(cleanOtp);
      confirmationResultStore = null;
      return {
        success: true,
        verified: true,
        provider: 'firebase',
        user: userCred.user
      };
    } catch (err) {
      console.error('[OTP] Firebase code mismatch:', err);
      throw new Error('Incorrect or expired verification code. Please check the SMS.');
    }
  }

  // 2. Otherwise verify via backend
  const backendUrl = getBackendUrl();
  const res = await fetch(`${backendUrl}/api/otp/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: cleanPhone, otp: cleanOtp }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Invalid OTP code.');
  }

  return data;
}
