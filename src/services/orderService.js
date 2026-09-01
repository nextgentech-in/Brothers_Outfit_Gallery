import { collection, query, where, orderBy, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export const createOrder = async (orderId, orderData) => {
  const orderRef = doc(db, 'orders', orderId);
  await setDoc(orderRef, {
    ...orderData,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return orderId;
};

export const getUserOrders = async (uid) => {
  const q = query(
    collection(db, 'orders'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getOrderById = async (orderId) => {
  const docRef = doc(db, 'orders', orderId);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
