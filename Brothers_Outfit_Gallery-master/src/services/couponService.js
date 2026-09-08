import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

/**
 * Validates a coupon code against Firestore 'coupons' collection
 * @param {string} rawCode - User input coupon code
 * @param {number} subtotal - Current cart subtotal
 * @returns {Promise<{ valid: boolean, error?: string, message?: string, coupon?: object, discountAmount?: number }>}
 */
export async function validateCoupon(rawCode, subtotal) {
  if (!rawCode || !rawCode.trim()) {
    return { valid: false, error: 'Please enter a coupon code.' };
  }

  const code = rawCode.trim().toUpperCase();

  try {
    // 1. Query Firestore for matching code
    const couponsRef = collection(db, 'coupons');
    const q = query(couponsRef, where('code', '==', code));
    let snapshot = await getDocs(q);

    // If not found with exact uppercase, try getting all coupons and matching case-insensitively
    let couponDoc = null;
    if (!snapshot.empty) {
      couponDoc = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } else {
      const allSnap = await getDocs(couponsRef);
      const match = allSnap.docs.find(d => {
        const dCode = (d.data().code || '').toUpperCase().trim();
        return dCode === code;
      });
      if (match) {
        couponDoc = { id: match.id, ...match.data() };
      }
    }

    if (!couponDoc) {
      return {
        valid: false,
        error: `Coupon code "${code}" is invalid or does not exist.`
      };
    }

    // 2. Check Expiry
    if (couponDoc.expiryDate) {
      const today = new Date().toISOString().split('T')[0];
      if (couponDoc.expiryDate < today) {
        return {
          valid: false,
          error: `Coupon "${code}" has expired on ${couponDoc.expiryDate}.`
        };
      }
    }

    // 3. Check Minimum Order Amount
    const minAmount = Number(couponDoc.minOrderAmount) || 0;
    if (minAmount > 0 && subtotal < minAmount) {
      return {
        valid: false,
        error: `Coupon "${code}" requires a minimum order value of ₹${minAmount.toLocaleString('en-IN')}. (Your subtotal: ₹${subtotal.toLocaleString('en-IN')})`
      };
    }

    // 4. Calculate Discount
    let discountAmount = 0;
    const discountVal = Number(couponDoc.discountValue) || 0;

    if (couponDoc.discountType === 'percentage') {
      discountAmount = Math.round((subtotal * discountVal) / 100);
    } else {
      // flat discount
      discountAmount = Math.min(discountVal, subtotal);
    }

    if (discountAmount <= 0) {
      return {
        valid: false,
        error: `Coupon "${code}" provides ₹0 discount for this order.`
      };
    }

    return {
      valid: true,
      coupon: couponDoc,
      discountAmount,
      message: `Coupon "${code}" applied successfully! You saved ₹${discountAmount.toLocaleString('en-IN')}.`
    };
  } catch (err) {
    console.error('Error validating coupon:', err);
    return {
      valid: false,
      error: 'Failed to validate coupon. Please check your internet connection and try again.'
    };
  }
}
