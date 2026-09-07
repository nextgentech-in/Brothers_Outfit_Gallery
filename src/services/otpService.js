import { auth } from '../firebase/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getBackendUrl } from '../utils/apiConfig';

let confirmationResultStore = null;
let activeOtpProvider = 'backend'; // 'backend' | 'firebase'

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
  }
  return window.__firebaseRecaptchaVerifier;
}

/**
 * Send an OTP to a 10-digit Indian phone number.
 * Tries Fast2SMS backend gateway first. If blocked by KYC, automatically falls back to Firebase SMS.
 * @param {string} phone 
 * @returns {Promise<{success: boolean, message?: string, provider?: string}>}
 */
export async function sendPhoneOtp(phone) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const formattedPhone = `+91${cleanPhone}`;
  let backendError = null;

  // 1. Try Fast2SMS via backend
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
        provider: 'fast2sms',
        message: data.message || `OTP sent to +91 ${cleanPhone} via Fast2SMS.`
      };
    } else {
      backendError = data.error || 'Fast2SMS dispatch failed.';
    }
  } catch (err) {
    backendError = err.message;
  }

  // 2. If Fast2SMS failed, try Firebase Phone Auth
  try {
    const verifier = getRecaptchaVerifier();
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    confirmationResultStore = confirmationResult;
    activeOtpProvider = 'firebase';
    console.log('[OTP] Firebase SMS sent successfully to', formattedPhone);
    return {
      success: true,
      provider: 'firebase',
      message: `OTP sent to ${formattedPhone} via Firebase SMS.`
    };
  } catch (firebaseErr) {
    console.warn('[OTP] Firebase fallback error:', firebaseErr.code || firebaseErr.message);

    try {
      if (window.__firebaseRecaptchaVerifier) {
        window.__firebaseRecaptchaVerifier.clear();
        window.__firebaseRecaptchaVerifier = null;
      }
    } catch (_) {}

    // Both failed: report the clearest actionable message
    if (firebaseErr.code === 'auth/operation-not-allowed') {
      throw new Error(
        backendError ||
        'SMS blocked: Please complete Fast2SMS KYC or enable India (+91) in Firebase SMS Region Policy.'
      );
    }

    throw new Error(backendError || firebaseErr.message || 'Failed to deliver SMS OTP.');
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
