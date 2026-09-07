import { auth } from '../firebase/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getBackendUrl } from '../utils/apiConfig';

let confirmationResultStore = null;

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
  if (!window.__firebaseRecaptchaVerifier) {
    window.__firebaseRecaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        try {
          if (window.__firebaseRecaptchaVerifier) {
            window.__firebaseRecaptchaVerifier.clear();
            window.__firebaseRecaptchaVerifier = null;
          }
        } catch (_) {}
      }
    });
  }
  return window.__firebaseRecaptchaVerifier;
}

/**
 * Send an OTP to a 10-digit Indian phone number
 * Tries Firebase Phone Auth first (if enabled in Firebase Console), then falls back to backend SMS API
 * @param {string} phone 
 * @returns {Promise<{success: boolean, message?: string, devOtp?: string, provider?: string, error?: string}>}
 */
export async function sendPhoneOtp(phone) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const formattedPhone = `+91${cleanPhone}`;

  // 1. Try Firebase Phone Auth first
  try {
    const verifier = getRecaptchaVerifier();
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    confirmationResultStore = confirmationResult;
    console.log('[OTP] Firebase SMS sent successfully to', formattedPhone);
    return {
      success: true,
      provider: 'firebase',
      message: `Firebase SMS OTP sent to ${formattedPhone}`
    };
  } catch (firebaseErr) {
    console.warn('[OTP] Firebase Phone Auth skipped/failed:', firebaseErr.code || firebaseErr.message);

    // Clear verifier on error so subsequent attempts start fresh
    try {
      if (window.__firebaseRecaptchaVerifier) {
        window.__firebaseRecaptchaVerifier.clear();
        window.__firebaseRecaptchaVerifier = null;
      }
    } catch (_) {}

    // 2. Fall back to backend /api/otp/send-otp (Fast2SMS / 2Factor / Test Sandbox)
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/api/otp/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send OTP. Please check the phone number.');
    }

    if (firebaseErr.code === 'auth/operation-not-allowed') {
      data.firebaseNotEnabled = true;
    }

    confirmationResultStore = null;
    return data;
  }
}

/**
 * Verify the OTP entered by the user
 * @param {string} phone 
 * @param {string} otp 
 * @returns {Promise<{success: boolean, verified: boolean, provider?: string, error?: string}>}
 */
export async function verifyPhoneOtp(phone, otp) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const cleanOtp = String(otp).trim();

  // 1. If Firebase confirmation was used
  if (confirmationResultStore) {
    try {
      const userCred = await confirmationResultStore.confirm(cleanOtp);
      confirmationResultStore = null;
      return {
        success: true,
        verified: true,
        provider: 'firebase',
        user: userCred.user
      };
    } catch (firebaseErr) {
      console.error('[OTP] Firebase OTP verify failed:', firebaseErr);
      throw new Error('Incorrect or expired Firebase OTP. Please check the SMS code.');
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
