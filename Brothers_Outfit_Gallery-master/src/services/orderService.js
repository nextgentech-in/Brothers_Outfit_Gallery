import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { cancelDelhiveryShipment } from './delhiveryService';

export const createOrder = async (orderId, orderData) => {
  const orderRef = doc(db, 'orders', orderId);
  await setDoc(orderRef, {
    ...orderData,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Track order ID locally in browser so customer can always find it
  try {
    const existing = JSON.parse(localStorage.getItem('user_order_ids') || '[]');
    if (!existing.includes(orderId)) {
      existing.unshift(orderId);
      localStorage.setItem('user_order_ids', JSON.stringify(existing.slice(0, 50)));
    }
  } catch (e) {
    console.warn('Could not store orderId in localStorage:', e);
  }

  return orderId;
};

/**
 * Fetch all orders for a user safely without requiring composite Firestore index
 * Matches by userId, userEmail, shippingAddress.email, and locally stored order IDs
 */
export const getUserOrders = async (uid, email = null) => {
  try {
    const ordersMap = new Map();

    // 1. Query by userId (WITHOUT composite orderBy to prevent unindexed query errors)
    if (uid) {
      try {
        const qUid = query(collection(db, 'orders'), where('userId', '==', uid));
        const snapUid = await getDocs(qUid);
        snapUid.docs.forEach(d => ordersMap.set(d.id, { id: d.id, ...d.data() }));
      } catch (errUid) {
        console.warn('Error querying orders by uid:', errUid);
      }
    }

    // 2. Query by userEmail (case-insensitive checks)
    const targetEmail = email ? email.toLowerCase().trim() : null;
    if (targetEmail) {
      try {
        const qEmail = query(collection(db, 'orders'), where('userEmail', '==', targetEmail));
        const snapEmail = await getDocs(qEmail);
        snapEmail.docs.forEach(d => ordersMap.set(d.id, { id: d.id, ...d.data() }));
      } catch (errEmail) {
        console.warn('Error querying orders by userEmail:', errEmail);
      }

      try {
        const qShippingEmail = query(collection(db, 'orders'), where('shippingAddress.email', '==', targetEmail));
        const snapShippingEmail = await getDocs(qShippingEmail);
        snapShippingEmail.docs.forEach(d => ordersMap.set(d.id, { id: d.id, ...d.data() }));
      } catch (errShippingEmail) {
        console.warn('Error querying orders by shippingAddress.email:', errShippingEmail);
      }
    }

    // 3. Fallback: Also check orders stored in localStorage for guest/recent checkouts
    try {
      const stored = JSON.parse(localStorage.getItem('user_order_ids') || '[]');
      if (Array.isArray(stored) && stored.length > 0) {
        for (const orderId of stored) {
          if (!ordersMap.has(orderId)) {
            const singleSnap = await getDoc(doc(db, 'orders', orderId));
            if (singleSnap.exists()) {
              ordersMap.set(singleSnap.id, { id: singleSnap.id, ...singleSnap.data() });
            }
          }
        }
      }
    } catch (localErr) {
      console.warn('Error reading local orders:', localErr);
    }

    const orders = Array.from(ordersMap.values());

    // 4. Client-side sort by createdAt descending (Fast & zero index errors!)
    orders.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return orders;
  } catch (err) {
    console.error('Error fetching user orders:', err);
    return [];
  }
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
