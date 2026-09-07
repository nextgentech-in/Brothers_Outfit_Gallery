import { getBackendUrl } from '../utils/apiConfig';

/**
 * Send an OTP to a 10-digit Indian phone number
 * @param {string} phone 
 * @returns {Promise<{success: boolean, message?: string, devOtp?: string, error?: string}>}
 */
export async function sendPhoneOtp(phone) {
  try {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/api/otp/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send OTP. Please check the phone number.');
    }
    return data;
  } catch (err) {
    console.error('Send OTP Error:', err);
    throw err;
  }
}

/**
 * Verify the OTP entered by the user
 * @param {string} phone 
 * @param {string} otp 
 * @returns {Promise<{success: boolean, verified: boolean, error?: string}>}
 */
export async function verifyPhoneOtp(phone, otp) {
  try {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/api/otp/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Invalid OTP code.');
    }
    return data;
  } catch (err) {
    console.error('Verify OTP Error:', err);
    throw err;
  }
}
