import { collection, doc, setDoc, getDocs, query, orderBy, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const NOTIFICATIONS_COLLECTION = 'notifications';

/**
 * Trigger an admin notification when an order is created
 * @param {string} orderId 
 * @param {Object} orderPayload 
 */
export const createAdminOrderNotification = async (orderId, orderPayload) => {
  try {
    const notifRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
    await setDoc(notifRef, {
      id: notifRef.id,
      type: 'NEW_ORDER',
      title: '📦 New Order Received!',
      message: `Order #${orderId.substring(0, 10)} placed by ${orderPayload.shippingAddress?.fullName || 'Customer'} (₹${orderPayload.totalAmount || orderPayload.finalTotal})`,
      orderId,
      customerName: orderPayload.shippingAddress?.fullName || 'Customer',
      totalAmount: orderPayload.totalAmount || orderPayload.finalTotal || 0,
      paymentMethod: orderPayload.paymentMethod || 'Razorpay',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Error creating order notification:', err);
  }
};

/**
 * Subscribe to real-time admin notifications
 * @param {Function} callback 
 * @returns {Function} Unsubscribe function
 */
export const subscribeAdminNotifications = (callback) => {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(notifs);
    }, (error) => {
      console.warn('Notifications real-time listener error:', error.message);
      callback([]);
    });
  } catch (err) {
    console.error('Error subscribing to notifications:', err);
    return () => {};
  }
};

/**
 * Mark a single notification as read
 * @param {string} notifId 
 */
export const markNotificationAsRead = async (notifId) => {
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notifId);
    await updateDoc(docRef, { read: true });
  } catch (err) {
    console.error('Error marking notification read:', err);
  }
};

/**
 * Mark all admin notifications as read
 */
export const markAllNotificationsAsRead = async (notifications) => {
  try {
    const unread = notifications.filter(n => !n.read);
    const promises = unread.map(n => updateDoc(doc(db, NOTIFICATIONS_COLLECTION, n.id), { read: true }));
    await Promise.all(promises);
  } catch (err) {
    console.error('Error marking all notifications read:', err);
  }
};
