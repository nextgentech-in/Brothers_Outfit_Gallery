import { collection, query, where, orderBy, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { cancelDelhiveryShipment } from './delhiveryService';

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

export const cancelUserOrder = async (orderId, reason = 'Cancelled by Customer', waybill = null) => {
  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, {
    status: 'Cancelled',
    cancelledAt: new Date(),
    cancellationReason: reason,
    updatedAt: new Date()
  });

  if (waybill) {
    try {
      await cancelDelhiveryShipment(waybill, reason);
    } catch (err) {
      console.warn('Delhivery cancellation warning:', err);
    }
  }

  return true;
};
