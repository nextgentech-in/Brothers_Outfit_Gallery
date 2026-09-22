import { auth } from '../firebase/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getBackendUrl } from '../utils/apiConfig';

let confirmationResultStore = null;
let activeOtpProvider = 'firebase'; // 'firebase' | 'backend'

/**
 * Creates or refreshes a fresh invisible reCAPTCHA verifier.
 * Always recreates the DOM container node to prevent 'reCAPTCHA has already been rendered' errors.
 */
function getRecaptchaVerifier() {
  // Clear any existing verifier instance
  if (window.__firebaseRecaptchaVerifier) {
    try {
      window.__firebaseRecaptchaVerifier.clear();
    } catch (_) {}
    window.__firebaseRecaptchaVerifier = null;
  }

  // Remove old container completely to guarantee a brand new DOM node
  const oldContainer = document.getElementById('recaptcha-container');
  if (oldContainer) {
    try {
      oldContainer.remove();
    } catch (_) {}
  }

  // Create a brand new clean container element
  const newContainer = document.createElement('div');
  newContainer.id = 'recaptcha-container';
  newContainer.style.position = 'fixed';
  newContainer.style.bottom = '0';
  newContainer.style.right = '0';
  newContainer.style.zIndex = '9999999';
  document.body.appendChild(newContainer);

  window.__firebaseRecaptchaVerifier = new RecaptchaVerifier(auth, newContainer, {
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

  return window.__firebaseRecaptchaVerifier;
}

/**
 * Send an OTP to a 10-digit Indian phone number.
 * Tries Firebase Phone Authentication first. If Firebase fails (e.g. billing not enabled on Spark plan),
 * automatically falls back to backend SMS endpoint.
 * @param {string} phone 
 * @returns {Promise<{success: boolean, message: string, provider: string, devOtp?: string}>}
 */
export async function sendPhoneOtp(phone) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number.');
  }

  const formattedPhone = `+91${cleanPhone}`;
  let firebaseFailureReason = null;

  // 1. Try Firebase Phone Authentication first
  try {
    const verifier = getRecaptchaVerifier();
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    confirmationResultStore = confirmationResult;
    activeOtpProvider = 'firebase';

    console.log('[OTP] Firebase SMS OTP dispatched successfully to', formattedPhone);
    return {
      success: true,
      provider: 'firebase',
      message: `OTP sent via SMS to ${formattedPhone}`
    };
  } catch (firebaseErr) {
    console.warn('[OTP] Firebase Phone Auth error:', firebaseErr.code, firebaseErr.message);

    // Clean up verifier on error
    try {
      if (window.__firebaseRecaptchaVerifier) {
        window.__firebaseRecaptchaVerifier.clear();
        window.__firebaseRecaptchaVerifier = null;
      }
    } catch (_) {}

    if (firebaseErr.code === 'auth/internal-error' || (firebaseErr.message && firebaseErr.message.includes('internal-error'))) {
      firebaseFailureReason = 'Firebase Phone Auth requires the Blaze Plan (Pay-as-you-go) enabled in Firebase Console, or this number added under "Phone numbers for testing".';
    } else if (firebaseErr.code === 'auth/operation-not-allowed') {
      firebaseFailureReason = 'Phone Auth is not enabled in Firebase Console (Authentication > Sign-in method > Phone) or India (+91) is not allowed in SMS region policy.';
    } else if (firebaseErr.code === 'auth/too-many-requests') {
      firebaseFailureReason = 'Too many attempts from this device. Please wait 1-2 minutes before retrying.';
    } else if (firebaseErr.code === 'auth/invalid-phone-number') {
      firebaseFailureReason = 'Invalid phone number format. Please enter a valid 10-digit Indian mobile number.';
    } else {
      firebaseFailureReason = firebaseErr.message || 'Firebase Phone Auth dispatch failed.';
    }
  }

  // 2. Fallback: Backend SMS Gateway
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
        message: data.message || `OTP sent to ${formattedPhone} via SMS.`,
        devOtp: data.devOtp
      };
    } else if (data.error) {
      console.warn('[OTP] Backend SMS fallback failed:', data.error);
    }
  } catch (backendErr) {
    console.warn('[OTP] Backend SMS fallback network error:', backendErr.message);
  }

  // Both failed: report the clearest actionable message
  throw new Error(firebaseFailureReason || 'Failed to send SMS OTP. Please check your phone number.');
}

/**
 * Verify the OTP entered by the user via Firebase or Backend.
 * @param {string} phone 
 * @param {string} otp 
 * @returns {Promise<{success: boolean, verified: boolean, provider: string, user?: any}>}
 */
export async function verifyPhoneOtp(phone, otp) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const cleanOtp = String(otp).trim();

  // 1. If Firebase session is active
  if (activeOtpProvider === 'firebase' && confirmationResultStore) {
    try {
      const userCredential = await confirmationResultStore.confirm(cleanOtp);
      confirmationResultStore = null; // Consume session

      return {
        success: true,
        verified: true,
        provider: 'firebase',
        user: userCredential.user
      };
    } catch (err) {
      console.error('[OTP] Firebase code mismatch:', err.code, err.message);

      if (err.code === 'auth/invalid-verification-code') {
        throw new Error('Incorrect OTP code. Please check the SMS and enter the 6 digits.');
      }
      if (err.code === 'auth/code-expired') {
        throw new Error('OTP has expired. Please tap Resend OTP to get a new code.');
      }

      throw new Error(err.message || 'Incorrect verification code.');
    }
  }

  // 2. Verify via Backend API
  const backendUrl = getBackendUrl();
  const res = await fetch(`${backendUrl}/api/otp/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: cleanPhone, otp: cleanOtp }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Incorrect or expired verification code.');
  }

  return {
    success: true,
    verified: true,
    provider: 'backend'
  };
}

