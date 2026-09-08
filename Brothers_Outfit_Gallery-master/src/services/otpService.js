import { auth } from '../firebase/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

let confirmationResultStore = null;

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
 * Send an OTP to a 10-digit Indian phone number strictly via Firebase Phone Authentication (Google SMS).
 * @param {string} phone 
 * @returns {Promise<{success: boolean, message: string, provider: string}>}
 */
export async function sendPhoneOtp(phone) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number.');
  }

  const formattedPhone = `+91${cleanPhone}`;

  try {
    const verifier = getRecaptchaVerifier();
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    confirmationResultStore = confirmationResult;

    console.log('[OTP] Firebase SMS OTP dispatched successfully to', formattedPhone);
    return {
      success: true,
      provider: 'firebase',
      message: `OTP sent via SMS to ${formattedPhone}`
    };
  } catch (firebaseErr) {
    console.error('[OTP] Firebase Phone Auth error:', firebaseErr.code, firebaseErr.message);

    // Clean up verifier on error
    try {
      if (window.__firebaseRecaptchaVerifier) {
        window.__firebaseRecaptchaVerifier.clear();
        window.__firebaseRecaptchaVerifier = null;
      }
    } catch (_) {}

    if (firebaseErr.code === 'auth/operation-not-allowed') {
      throw new Error('Please enable India (+91) in Firebase Console under Authentication > Settings > SMS region policy.');
    }
    if (firebaseErr.code === 'auth/too-many-requests') {
      throw new Error('Too many attempts from this device. Please wait 1-2 minutes before retrying.');
    }
    if (firebaseErr.code === 'auth/invalid-phone-number') {
      throw new Error('Invalid phone number. Please enter a valid 10-digit mobile number.');
    }
    if (firebaseErr.message && firebaseErr.message.includes('reCAPTCHA')) {
      throw new Error('Security verification initializing. Please tap Resend OTP in 5 seconds.');
    }

    throw new Error(firebaseErr.message || 'Failed to send SMS OTP via Firebase. Please try again.');
  }
}

/**
 * Verify the OTP entered by the user via Firebase.
 * @param {string} phone 
 * @param {string} otp 
 * @returns {Promise<{success: boolean, verified: boolean, provider: string, user: any}>}
 */
export async function verifyPhoneOtp(phone, otp) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const cleanOtp = String(otp).trim();

  if (!confirmationResultStore) {
    throw new Error('No active verification session found. Please tap Resend OTP.');
  }

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
