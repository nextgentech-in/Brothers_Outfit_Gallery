/**
 * Security utilities: input sanitization, XSS defense, safe external linking
 */

/**
 * Strips HTML tags, script injections, and dangerous character sequences
 * @param {string} input 
 * @returns {string} sanitized plain text
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/[<>'"]/g, (char) => {
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case "'": return '&#39;';
        case '"': return '&quot;';
        default: return char;
      }
    })
    .trim();
}

/**
 * Validates standard email address
 * @param {string} email 
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
}

/**
 * Validates 10-digit Indian phone number
 * @param {string} phone 
 * @returns {boolean}
 */
export function isValidIndianPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  return /^[6-9]\d{9}$/.test(cleaned.slice(-10));
}

/**
 * Common safe external link props preventing tabnabbing and referrer leakage
 */
export const SAFE_LINK_PROPS = {
  target: '_blank',
  rel: 'noopener noreferrer'
};
