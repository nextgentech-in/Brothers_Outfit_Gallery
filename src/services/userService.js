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
  const wishlistRef = collection(db, 'users', uid, 'wishlist');
  const snap = await getDocs(wishlistRef);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Address methods
export const getAddresses = async (uid) => {
  const addressRef = collection(db, 'users', uid, 'addresses');
  const snap = await getDocs(addressRef);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
