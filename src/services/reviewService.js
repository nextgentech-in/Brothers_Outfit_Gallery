import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

/**
 * Fetch reviews for a specific product
 * @param {string} productId 
 * @returns {Promise<Array>}
 */
export async function getProductReviews(productId) {
  if (!productId) return [];

  try {
    const reviewsRef = collection(db, 'reviews');
    // Try query with order
    try {
      const q = query(
        reviewsRef,
        where('productId', '==', productId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (idxErr) {
      // Fallback without orderBy in case Firestore composite index is building
      const qFallback = query(reviewsRef, where('productId', '==', productId));
      const snap = await getDocs(qFallback);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return list.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.dateFormatted || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.dateFormatted || 0).getTime();
        return timeB - timeA;
      });
    }
  } catch (err) {
    console.error('Error fetching product reviews:', err);
    return [];
  }
}

/**
 * Compress an image file to an optimized base64 Data URL
 * @param {File} file 
 * @param {number} maxWidth 
 * @param {number} quality 
 * @returns {Promise<string>}
 */
export function compressReviewImage(file, maxWidth = 1000, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to web-friendly JPEG data url
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Submit a customer review
 * @param {Object} reviewData 
 * @returns {Promise<Object>}
 */
export async function submitReview(reviewData) {
  if (!reviewData.productId) throw new Error('Missing productId for review');
  if (!reviewData.comment || !reviewData.comment.trim()) throw new Error('Please enter a review comment');

  const docRef = doc(collection(db, 'reviews'));
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const payload = {
    productId: reviewData.productId,
    productName: reviewData.productName || 'Product',
    productSlug: reviewData.productSlug || '',
    userId: reviewData.userId || 'guest',
    userName: (reviewData.userName || '').trim() || 'Verified Customer',
    userEmail: reviewData.userEmail || '',
    rating: Number(reviewData.rating) || 5,
    comment: reviewData.comment.trim(),
    recommend: reviewData.recommend !== false, // User suggestions: true = recommends product
    images: Array.isArray(reviewData.images) ? reviewData.images : [],
    verifiedPurchase: Boolean(reviewData.verifiedPurchase ?? true),
    status: 'approved',
    dateFormatted,
    createdAt: serverTimestamp()
  };

  await setDoc(docRef, payload);
  return { id: docRef.id, ...payload };
}
