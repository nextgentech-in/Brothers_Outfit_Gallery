import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export const getUserProfile = async (uid) => {
  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateUserProfile = async (uid, data) => {
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, { ...data, updatedAt: new Date() }, { merge: true });
};

// Wishlist methods
export const getWishlist = async (uid) => {
  if (!uid) return [];
  const wishlistRef = collection(db, 'users', uid, 'wishlist');
  const snap = await getDocs(wishlistRef);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addToWishlist = async (uid, product) => {
  if (!uid || !product?.id) return;
  const docRef = doc(db, 'users', uid, 'wishlist', product.id);
  await setDoc(docRef, {
    id: product.id,
    productId: product.id,
    name: product.name,
    slug: product.slug || '',
    price: product.price || product.salePrice || 0,
    mrp: product.mrp || product.compareAtPrice || 0,
    image: product.image || product.thumbnailUrl || (product.images?.[0]?.url || product.images?.[0]) || '',
    category: product.category || '',
    stock: product.stock !== undefined ? product.stock : 10,
    addedAt: new Date()
  }, { merge: true });
};

export const removeFromWishlist = async (uid, productId) => {
  if (!uid || !productId) return;
  const { deleteDoc } = await import('firebase/firestore');
  const docRef = doc(db, 'users', uid, 'wishlist', productId);
  await deleteDoc(docRef);
};

// Address methods
export const getAddresses = async (uid) => {
  const addressRef = collection(db, 'users', uid, 'addresses');
  const snap = await getDocs(addressRef);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
