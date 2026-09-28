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

  // Decrement product & variant stock in Firestore
  if (Array.isArray(orderData.items)) {
    try {
      for (const item of orderData.items) {
        const prodId = item.id || item.productId;
        if (!prodId) continue;
        const pRef = doc(db, 'products', String(prodId));
        const pSnap = await getDoc(pRef);
        if (!pSnap.exists()) continue;
        const pData = pSnap.data();
        const orderedQty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const orderedSize = item.size || item.selectedSize || null;
        const orderedColor = item.color || item.selectedColor || null;

        if (Array.isArray(pData.variants) && pData.variants.length > 0) {
          const variants = [...pData.variants];
          const cleanSize = orderedSize ? String(orderedSize).trim().toLowerCase() : null;
          const cleanColor = orderedColor ? String(orderedColor).trim().toLowerCase() : null;

          let matchIdx = -1;
          if (cleanSize) {
            matchIdx = variants.findIndex(v => {
              const vSize = String(v.size || '').trim().toLowerCase();
              if (vSize !== cleanSize) return false;
              if (!cleanColor) return true;
              const vCol = String(v.color || '').trim().toLowerCase();
              return vCol === cleanColor || vCol === 'standard' || vCol === 'default';
            });
            if (matchIdx < 0) {
              matchIdx = variants.findIndex(v => String(v.size || '').trim().toLowerCase() === cleanSize);
            }
          }
          if (matchIdx < 0) matchIdx = 0;

          if (matchIdx >= 0 && matchIdx < variants.length) {
            const currentStock = parseInt(variants[matchIdx].stock ?? variants[matchIdx].quantity, 10) || 0;
            const updatedVarStock = Math.max(0, currentStock - orderedQty);
            variants[matchIdx] = {
              ...variants[matchIdx],
              stock: updatedVarStock,
              quantity: updatedVarStock
            };
          }

          const newTotalStock = variants.reduce((sum, v) => sum + (parseInt(v.stock ?? v.quantity, 10) || 0), 0);
          const hasRemainingStock = newTotalStock > 0;
          const availableSizes = [...new Set(variants.filter(v => (parseInt(v.stock ?? v.quantity, 10) || 0) > 0).map(v => v.size))].filter(Boolean);

          await updateDoc(pRef, {
            variants,
            stock: Math.max(0, newTotalStock),
            quantity: Math.max(0, newTotalStock),
            inStock: hasRemainingStock,
            active: hasRemainingStock, // If quantity 0, not visible on store
            sizes: availableSizes,     // Only available sizes displayed
            updatedAt: new Date()
          });
        } else {
          const currentStock = parseInt(pData.stock ?? pData.quantity, 10) || 0;
          const newStock = Math.max(0, currentStock - orderedQty);
          const hasRemainingStock = newStock > 0;

          await updateDoc(pRef, {
            stock: newStock,
            quantity: newStock,
            inStock: hasRemainingStock,
            active: hasRemainingStock, // If quantity 0, not visible on store
            updatedAt: new Date()
          });
        }
      }
    } catch (stockErr) {
      console.warn('Client order stock decrement warning:', stockErr);
    }
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

export const requestUserOrderExchange = async (orderId, { reason, itemNames, replacementSize, notes }) => {
  const docRef = doc(db, 'orders', orderId);
  const exchangePayload = {
    reason,
    itemNames: itemNames || 'Items',
    replacementSize: replacementSize || 'N/A',
    notes: notes || '',
    requestedAt: new Date()
  };

  await updateDoc(docRef, {
    status: 'Exchange Requested',
    exchangeDetails: exchangePayload,
    updatedAt: new Date()
  });

  return true;
};

