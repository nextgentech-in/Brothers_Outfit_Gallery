import { getBackendUrl } from '../utils/apiConfig';

/**
 * Send an OTP to a 10-digit Indian phone number via backend SMS Gateway (Fast2SMS)
 * @param {string} phone 
 * @returns {Promise<{success: boolean, message?: string, realSmsSent?: boolean, error?: string}>}
 */
export async function sendPhoneOtp(phone) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

  const backendUrl = getBackendUrl();
  const res = await fetch(`${backendUrl}/api/otp/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: cleanPhone }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send SMS OTP. Please check your phone number.');
  }

  return data;
}

/**
 * Verify the OTP entered by the user
 * @param {string} phone 
 * @param {string} otp 
 * @returns {Promise<{success: boolean, verified: boolean, error?: string}>}
 */
export async function verifyPhoneOtp(phone, otp) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const cleanOtp = String(otp).trim();

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
