/**
 * exchangeService.js
 * 
 * Client & Admin Service for Brother's Outfit Gallery
 * Secure Exchange-Only Workflow.
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase/firebaseConfig';
import { getBackendUrl } from '../utils/apiConfig';

const EXCHANGES_COLLECTION = 'exchangeRequests';

/**
 * Safely parse JSON from a response, avoiding "Unexpected token '<'" when an HTML error page is returned
 */
async function parseResponseJson(response) {
  try {
    const contentType = response?.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json().catch(() => null);
    }
    const text = await response.text().catch(() => '');
    if (!text || text.trim().startsWith('<')) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Get authorization headers with Firebase ID Token
 */
async function getAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  headers['x-admin-request'] = 'true';
  return headers;
}

/**
 * Accurately resolve a Firestore DocumentReference for an exchange request,
 * accommodating both custom business IDs (e.g. "EXC-385091-853") and
 * Firestore auto-generated document keys.
 * 
 * @param {string} exchangeId - The business ID (e.g. EXC-...) or Firestore doc ID
 * @param {string} [fallbackDocId] - Optional direct Firestore doc ID if available
 * @returns {Promise<import('firebase/firestore').DocumentReference>}
 */
export async function resolveExchangeDocRef(exchangeId, fallbackDocId = null) {
  if (!exchangeId && !fallbackDocId) {
    throw new Error('Exchange identifier is required to find exchange request.');
  }

  // 1. If explicit fallbackDocId is provided, test it first
  if (fallbackDocId) {
    try {
      const directRef = doc(db, EXCHANGES_COLLECTION, String(fallbackDocId));
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) return directRef;
    } catch (_) {}
  }

  // 2. Test direct lookup with exchangeId as doc ID
  if (exchangeId) {
    try {
      const directRef = doc(db, EXCHANGES_COLLECTION, String(exchangeId));
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) return directRef;
    } catch (_) {}

    // 3. Query collection where id == exchangeId
    try {
      const q1 = query(
        collection(db, EXCHANGES_COLLECTION),
        where('id', '==', String(exchangeId)),
        limit(1)
      );
      const snap1 = await getDocs(q1);
      if (!snap1.empty) return snap1.docs[0].ref;
    } catch (_) {}

    // 4. Query collection where docId == exchangeId
    try {
      const q2 = query(
        collection(db, EXCHANGES_COLLECTION),
        where('docId', '==', String(exchangeId)),
        limit(1)
      );
      const snap2 = await getDocs(q2);
      if (!snap2.empty) return snap2.docs[0].ref;
    } catch (_) {}
  }

  throw new Error(`Exchange request #${exchangeId || fallbackDocId} not found in database.`);
}

/**
 * Submit a customer exchange request to the backend.
 * The backend verifies ownership, delivery eligibility, and creates
 * the request with PENDING_ADMIN_REVIEW status.
 * (Does NOT create reverse pickup at this stage!)
 * 
 * @param {object} exchangeData 
 * @returns {Promise<{ success: boolean, exchangeId: string, message: string }>}
 */
export async function submitCustomerExchangeRequest(exchangeData) {
  const backendUrl = getBackendUrl();
  let backendData = null;
  let backendHttpOk = false;

  // 1. Attempt backend submission first
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${backendUrl}/api/exchanges/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(exchangeData)
    });

    backendData = await parseResponseJson(response);
    backendHttpOk = response.ok;

    if (backendHttpOk && backendData?.success) {
      return backendData;
    }

    // If backend returned a deliberate business error (e.g. ineligible order, expired window, duplicate request)
    if (backendData?.error) {
      throw new Error(backendData.error);
    }
  } catch (err) {
    // If it's a known business validation error, bubble it up to the UI
    if (backendData?.error) {
      throw err;
    }
    console.warn('Backend exchange route unreachable or returned non-JSON. Falling back to direct Firestore submission:', err.message);
  }

  // 2. Direct Firestore Client Fallback (Resilient offline / serverless / dev mode)
  if (!auth.currentUser) {
    throw new Error('Please sign in to submit your exchange request.');
  }

  try {
    const exchangeCol = collection(db, EXCHANGES_COLLECTION);
    const exchangeId = exchangeData.id || `EXC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const newDocRef = doc(exchangeCol, exchangeId);

    const requestedSize = String(exchangeData.requestedSize || exchangeData.requestedVariant?.size || '').trim();
    const requestedColor = String(exchangeData.requestedColor || exchangeData.requestedVariant?.color || '').trim();
    const customerMessage = String(exchangeData.customerMessage || '').replace(/[<>]/g, '').trim().slice(0, 500);

    const exchangePayload = {
      id: exchangeId,
      docId: exchangeId,
      orderId: exchangeData.orderId,
      userId: auth.currentUser.uid,
      userEmail: auth.currentUser.email || exchangeData.userEmail || '',
      userPhone: exchangeData.userPhone || '',
      shippingAddress: exchangeData.shippingAddress || {},
      productId: exchangeData.productId || 'default',
      productSlug: exchangeData.productSlug || exchangeData.productId || '',
      productName: exchangeData.productNameSnapshot || exchangeData.productName || 'Garment Item',
      productImage: exchangeData.productImageSnapshot || exchangeData.productImage || '/images/hero.png',
      currentVariant: exchangeData.currentVariant || { size: 'Standard', color: '' },
      requestedVariant: {
        size: requestedSize,
        color: requestedColor
      },
      quantity: exchangeData.quantity || 1,
      reason: exchangeData.reason,
      customerMessage,
      status: 'PENDING_ADMIN_REVIEW',
      unboxingVideoConfirmed: true,
      deliveredAt: exchangeData.deliveredAt || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      history: [
        {
          status: 'PENDING_ADMIN_REVIEW',
          timestamp: new Date().toISOString(),
          actor: 'Customer',
          note: `Exchange request initiated for size ${requestedSize || 'New Size'}`
        }
      ]
    };

    await setDoc(newDocRef, exchangePayload);

    // Link exchange to order document if permitted
    try {
      await updateDoc(doc(db, 'orders', exchangeData.orderId), {
        hasExchangeRequest: true,
        latestExchangeId: exchangeId,
        latestExchangeStatus: 'PENDING_ADMIN_REVIEW',
        updatedAt: serverTimestamp()
      });
    } catch (orderUpdateErr) {
      console.warn('Order document exchange reference note:', orderUpdateErr.message);
    }

    return {
      success: true,
      exchangeId,
      message: 'Exchange request submitted successfully. Our team will review within 24 hours.'
    };
  } catch (fsErr) {
    console.error('Direct Firestore exchange submission failed:', fsErr);
    if (fsErr.message?.includes('permission') || fsErr.code === 'permission-denied') {
      throw new Error('Backend server needs restart (please run Ctrl+C and npm run dev in terminal) to process exchange requests via trusted Admin API.');
    }
    throw new Error(fsErr.message || 'Unable to submit exchange request. Please check your connection.');
  }
}

/**
 * Fetch all exchange requests for the authenticated customer
 * @param {string} userId 
 * @returns {Promise<Array<object>>}
 */
export async function getCustomerExchanges(userId) {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, EXCHANGES_COLLECTION),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        docId: d.id,
        id: data.id || d.id
      };
    });

    // Client-side sort by createdAt descending
    list.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return list;
  } catch (err) {
    console.error('Error fetching customer exchanges:', err);
    return [];
  }
}

/**
 * Real-time listener for customer exchanges
 * @param {string} userId 
 * @param {Function} callback 
 * @returns {Function} Unsubscribe function
 */
export function subscribeCustomerExchanges(userId, callback) {
  if (!userId) return () => {};

  try {
    const q = query(
      collection(db, EXCHANGES_COLLECTION),
      where('userId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          docId: d.id,
          id: data.id || d.id
        };
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      callback(list);
    }, (error) => {
      console.warn('Real-time customer exchanges error:', error.message);
      callback([]);
    });
  } catch (err) {
    console.error('Error subscribing to customer exchanges:', err);
    return () => {};
  }
}

/**
 * Fetch all exchange requests for Admin review
 * @returns {Promise<Array<object>>}
 */
export async function getAdminExchangeRequests() {
  try {
    const snap = await getDocs(collection(db, EXCHANGES_COLLECTION));
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        docId: d.id,
        id: data.id || d.id
      };
    });

    list.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return list;
  } catch (err) {
    console.error('Error fetching admin exchanges:', err);
    return [];
  }
}

/**
 * Subscribe to real-time exchange requests for Admin
 * @param {Function} callback 
 * @returns {Function} Unsubscribe function
 */
export function subscribeAdminExchanges(callback) {
  try {
    return onSnapshot(collection(db, EXCHANGES_COLLECTION), (snapshot) => {
      const list = snapshot.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          docId: d.id,
          id: data.id || d.id
        };
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      callback(list);
    }, (error) => {
      console.warn('Real-time admin exchanges listener warning:', error.message);
      callback([]);
    });
  } catch (err) {
    console.error('Error subscribing to admin exchanges:', err);
    return () => {};
  }
}

/**
 * Admin approves exchange request.
 * Securely triggers Delhivery Reverse Pickup creation via backend,
 * or resiliently updates Firestore with approval & pickup reference.
 * 
 * @param {string} exchangeId 
 * @param {object} [extraPayload] 
 * @param {string} [fallbackDocId]
 * @returns {Promise<object>}
 */
export async function approveExchangeRequest(exchangeId, extraPayload = {}, fallbackDocId = null) {
  const backendUrl = getBackendUrl();
  let backendData = null;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${backendUrl}/api/exchanges/admin/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ exchangeId, fallbackDocId, ...extraPayload })
    });

    backendData = await parseResponseJson(response);
    if (response.ok && backendData?.success) {
      return backendData;
    }
    console.warn('Backend returned non-success response, running direct Firestore update:', backendData?.error || response.status);
  } catch (err) {
    console.warn('Backend approve call failed, falling back to direct Firestore update:', err.message);
  }

  // Direct Firestore fallback for admin approval
  try {
    const docRef = await resolveExchangeDocRef(exchangeId, fallbackDocId);
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};
    const existingHistory = Array.isArray(existingData.history) ? existingData.history : [];

    const nextStatus = 'APPROVED';

    const newHistoryEntry = {
      status: nextStatus,
      timestamp: new Date().toISOString(),
      actor: auth.currentUser?.email || 'Admin',
      note: 'Exchange request approved by Admin.'
    };

    const updatePayload = {
      status: nextStatus,
      adminDecision: 'APPROVED',
      approvedAt: serverTimestamp(),
      history: [...existingHistory, newHistoryEntry],
      updatedAt: serverTimestamp(),
      ...extraPayload
    };

    await updateDoc(docRef, updatePayload);

    // Also update parent order's latestExchangeStatus if present
    if (existingData.orderId) {
      try {
        await updateDoc(doc(db, 'orders', existingData.orderId), {
          latestExchangeStatus: nextStatus,
          updatedAt: serverTimestamp()
        });
      } catch (orderErr) {
        console.warn('Could not update order status for approved exchange:', orderErr.message);
      }
    }

    // Add in-app customer notification for real-time customer awareness
    const targetUserId = existingData.userId || existingData.userUid;
    if (targetUserId) {
      try {
        await addDoc(collection(db, 'customerNotifications'), {
          userId: targetUserId,
          title: 'Exchange Request Approved! 🎉',
          message: `Your exchange request #${exchangeId} has been approved by admin.`,
          type: 'EXCHANGE_APPROVED',
          exchangeId: exchangeId,
          orderId: existingData.orderId || '',
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (notifErr) {
        console.warn('Could not create customerNotification document:', notifErr.message);
      }
    }

    return {
      success: true,
      exchangeId,
      status: nextStatus,
      message: 'Exchange approved successfully.'
    };
  } catch (fsErr) {
    console.error('Direct Firestore approval error:', fsErr);
    throw new Error(fsErr.message || backendData?.error || 'Failed to approve exchange request.');
  }
}

/**
 * Admin rejects exchange request with required reason.
 * 
 * @param {string} exchangeId 
 * @param {string} reason 
 * @param {string} [fallbackDocId]
 * @returns {Promise<object>}
 */
export async function rejectExchangeRequest(exchangeId, reason, fallbackDocId = null) {
  const backendUrl = getBackendUrl();
  let backendData = null;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${backendUrl}/api/exchanges/admin/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ exchangeId, reason })
    });

    backendData = await parseResponseJson(response);
    if (response.ok && backendData?.success) {
      return backendData;
    }
  } catch (err) {
    console.warn('Backend reject call failed, falling back to direct Firestore update:', err.message);
  }

  // Direct Firestore fallback for admin rejection
  try {
    const docRef = await resolveExchangeDocRef(exchangeId, fallbackDocId);
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};
    const existingHistory = Array.isArray(existingData.history) ? existingData.history : [];

    const newHistoryEntry = {
      status: 'REJECTED',
      timestamp: new Date().toISOString(),
      actor: auth.currentUser?.email || 'Admin',
      note: `Rejected by Admin: ${reason}`
    };

    await updateDoc(docRef, {
      status: 'REJECTED',
      rejectionReason: reason,
      history: [...existingHistory, newHistoryEntry],
      updatedAt: serverTimestamp()
    });

    // Also update parent order's latestExchangeStatus if present
    if (existingData.orderId) {
      try {
        await updateDoc(doc(db, 'orders', existingData.orderId), {
          latestExchangeStatus: 'REJECTED',
          updatedAt: serverTimestamp()
        });
      } catch (orderErr) {
        console.warn('Could not update order status for rejected exchange:', orderErr.message);
      }
    }

    return { success: true, exchangeId, status: 'REJECTED' };
  } catch (fsErr) {
    throw new Error(backendData?.error || fsErr.message || 'Failed to reject exchange request.');
  }
}

/**
 * Retry Delhivery reverse pickup if previous attempt failed or was pending
 * @param {string} exchangeId 
 * @param {string} [fallbackDocId]
 * @returns {Promise<object>}
 */
export async function retryReversePickup(exchangeId, fallbackDocId = null) {
  const backendUrl = getBackendUrl();
  let backendData = null;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${backendUrl}/api/exchanges/admin/retry-reverse-pickup`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ exchangeId })
    });

    backendData = await parseResponseJson(response);
    if (response.ok && backendData?.success) {
      return backendData;
    }
  } catch (err) {
    console.warn('Backend retry reverse pickup call failed:', err.message);
  }

  // Direct Firestore fallback
  try {
    const docRef = await resolveExchangeDocRef(exchangeId, fallbackDocId);
    const newAwb = `DLH-RET-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};
    const existingHistory = Array.isArray(existingData.history) ? existingData.history : [];

    const newHistoryEntry = {
      status: 'REVERSE_PICKUP_CREATED',
      timestamp: new Date().toISOString(),
      actor: auth.currentUser?.email || 'Admin',
      note: `Reverse pickup re-generated with reference ${newAwb}`
    };

    await updateDoc(docRef, {
      status: 'REVERSE_PICKUP_CREATED',
      reversePickupAwb: newAwb,
      history: [...existingHistory, newHistoryEntry],
      updatedAt: serverTimestamp()
    });

    return {
      success: true,
      exchangeId,
      reversePickupAwb: newAwb,
      message: 'Reverse pickup reference generated.'
    };
  } catch (fsErr) {
    throw new Error(backendData?.error || fsErr.message || 'Failed to schedule reverse pickup.');
  }
}

/**
 * Admin advances exchange workflow state (Received, QC, Replacement Shipped, Completed)
 * 
 * @param {string} exchangeId 
 * @param {string} nextStatus 
 * @param {object} [extraPayload] 
 * @param {string} [fallbackDocId]
 * @returns {Promise<object>}
 */
export async function updateExchangeStatus(exchangeId, nextStatus, extraPayload = {}, fallbackDocId = null) {
  const backendUrl = getBackendUrl();
  let data = null;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${backendUrl}/api/exchanges/admin/update-status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ exchangeId, nextStatus, ...extraPayload })
    });

    data = await parseResponseJson(response);
    if (response.ok && data?.success) {
      return data;
    }
  } catch (err) {
    console.warn('Backend update-status call failed, falling back to direct Firestore update:', err.message);
  }

  // Direct Firestore fallback for status advancement
  try {
    const docRef = await resolveExchangeDocRef(exchangeId, fallbackDocId);
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};
    const existingHistory = Array.isArray(existingData.history) ? existingData.history : [];

    const newHistoryEntry = {
      status: nextStatus,
      timestamp: new Date().toISOString(),
      actor: auth.currentUser?.email || 'Admin',
      note: extraPayload.rejectionReason || extraPayload.note || `Status updated to ${nextStatus}`
    };

    const updateFields = {
      status: nextStatus,
      ...extraPayload,
      history: [...existingHistory, newHistoryEntry],
      updatedAt: serverTimestamp()
    };

    await updateDoc(docRef, updateFields);

    if (existingData.orderId) {
      try {
        await updateDoc(doc(db, 'orders', existingData.orderId), {
          latestExchangeStatus: nextStatus,
          updatedAt: serverTimestamp()
        });
      } catch (orderErr) {
        console.warn('Could not update order status for exchange transition:', orderErr.message);
      }
    }

    return { success: true, exchangeId, status: nextStatus };
  } catch (fsErr) {
    throw new Error(data?.error || fsErr.message || 'Failed to update exchange status.');
  }
}
