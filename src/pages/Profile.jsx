import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserOrders, cancelUserOrder } from '../services/orderService';
import ExchangeRequestModal from '../components/exchange/ExchangeRequestModal';
import ExchangeApprovalModal from '../components/exchange/ExchangeApprovalModal';
import { subscribeCustomerExchanges } from '../services/exchangeService';
import { normalizeShipmentStatus, INTERNAL_STATUS } from '../utils/shipmentStatus';
import { EXCHANGE_STATUS_METADATA, CUSTOMER_EXCHANGE_STEPS, EXCHANGE_STATUS } from '../utils/exchangeConstants';
import { getBackendUrl } from '../utils/apiConfig';
import SEO from '../components/common/SEO';
import './Profile.css';

const CUSTOMER_CANCEL_REASONS = [
  'Changed my mind',
  'Found better price elsewhere',
  'Ordered by mistake',
  'Delivery too slow',
  'Want to change size/color',
  'Financial reasons',
  'Other'
];

export default function Profile() {
  const { currentUser, userProfile, logout, updateFirestoreProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'orders' ? 'orders' : tabParam === 'exchanges' ? 'exchanges' : 'profile';
  const [activeTab, setActiveTab] = useState(initialTab); // 'profile', 'orders', or 'exchanges'
  const [userOrders, setUserOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [customerExchanges, setCustomerExchanges] = useState([]);
  const [customerNotifications, setCustomerNotifications] = useState([]);

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Initialize with null safety 
  const [formData, setFormData] = useState({
    fullName: userProfile?.fullName || '',
    phone: userProfile?.phone || '',
    birthdate: userProfile?.birthdate || '',
    age: userProfile?.age || '',
    addressLine: userProfile?.address?.line1 || '',
    city: userProfile?.address?.city || '',
    state: userProfile?.address?.state || '',
    pincode: userProfile?.address?.pincode || ''
  });

  useEffect(() => {
    if (userProfile) {
      setFormData(prev => ({
        ...prev,
        fullName: userProfile.fullName || '',
        phone: userProfile.phone || '',
        birthdate: userProfile.birthdate || '',
        age: userProfile.age || '',
        addressLine: userProfile.address?.line1 || '',
        city: userProfile.address?.city || '',
        state: userProfile.address?.state || '',
        pincode: userProfile.address?.pincode || ''
      }));
    }
  }, [userProfile]);

  const loadUserOrders = useCallback(async () => {
    if (!currentUser) return;
    setOrdersLoading(true);
    try {
      const emailToUse = currentUser.email || userProfile?.email || '';
      const orders = await getUserOrders(currentUser.uid, emailToUse);
      setUserOrders(orders);
    } catch (e) {
      console.error("Error loading user orders:", e);
    } finally {
      setOrdersLoading(false);
    }
  }, [currentUser, userProfile?.email]);

  useEffect(() => {
    loadUserOrders();
  }, [loadUserOrders]);

  // Real-time subscription to customer's exchange requests
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubscribe = subscribeCustomerExchanges(currentUser.uid, (exchanges) => {
      setCustomerExchanges(exchanges);
    });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Load customer notifications
  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${getBackendUrl()}/api/notifications/customer`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomerNotifications(data.notifications || []);
      }
    } catch (err) {
      console.warn('Could not load notifications:', err.message);
    }
  }, [currentUser]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const [notificationFeedback, setNotificationFeedback] = useState(null);

  const handleDismissNotification = async (notificationId) => {
    const prevNotifications = [...customerNotifications];
    // Optimistic removal: remove immediately from UI
    setCustomerNotifications(prev => prev.filter(n => n.id !== notificationId));
    setNotificationFeedback(null);

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${getBackendUrl()}/api/notifications/customer/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notificationId })
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
    } catch (err) {
      console.warn('Dismiss notification warning:', err);
      // Rollback on network failure
      setCustomerNotifications(prevNotifications);
      setNotificationFeedback({
        type: 'error',
        text: 'Failed to dismiss notification. Connection issue.',
        onRetry: () => handleDismissNotification(notificationId)
      });
    }
  };

  const [cancellingId, setCancellingId] = useState(null);
  const [cancelModal, setCancelModal] = useState({ open: false, order: null });
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCustomReason, setCancelCustomReason] = useState('');
  const [orderFeedback, setOrderFeedback] = useState(null);
  const [copiedOrderId, setCopiedOrderId] = useState(null);

  // Exchange Modal State (Driven by new ExchangeRequestModal)
  const [selectedExchangeOrder, setSelectedExchangeOrder] = useState(null);

  // Exchange Approval Notice Popup Modal State
  const [approvalModalExchange, setApprovalModalExchange] = useState(null);

  // Extract all approved / pickup-ready exchanges for this customer
  const approvedExchanges = useMemo(() => {
    return customerExchanges.filter(ex =>
      [EXCHANGE_STATUS.APPROVED, EXCHANGE_STATUS.REVERSE_PICKUP_PENDING, EXCHANGE_STATUS.REVERSE_PICKUP_CREATED].includes(ex.status) ||
      String(ex.status || '').toUpperCase() === 'APPROVED' ||
      String(ex.adminDecision || '').toUpperCase() === 'APPROVED'
    );
  }, [customerExchanges]);

  // Auto-show Exchange Approval Popup if an approved exchange hasn't been acknowledged yet
  useEffect(() => {
    if (approvedExchanges.length > 0 && !approvalModalExchange) {
      const unviewed = approvedExchanges.find(ex => {
        try {
          const id = ex.id || ex.docId;
          return localStorage.getItem(`dismissed_exchange_approval_${id}`) !== 'true';
        } catch {
          return false;
        }
      });
      if (unviewed) {
        setApprovalModalExchange(unviewed);
      }
    }
  }, [approvedExchanges, approvalModalExchange]);

  const handleCloseApprovalModal = () => {
    if (approvalModalExchange) {
      try {
        const id = approvalModalExchange.id || approvalModalExchange.docId;
        localStorage.setItem(`dismissed_exchange_approval_${id}`, 'true');
      } catch (err) {
        console.warn('LocalStorage error:', err);
      }
    }
    setApprovalModalExchange(null);
  };

  // Delivery status verification helper
  const isOrderDelivered = useCallback((order) => {
    if (!order) return false;
    const normalized = normalizeShipmentStatus(order.shipmentStatus || order.status, order.rawProviderStatusCode);
    if (normalized === INTERNAL_STATUS.DELIVERED) return true;
    const st = String(order.status || '').toLowerCase().trim();
    const sst = String(order.shipmentStatus || '').toLowerCase().trim();
    return st === 'delivered' || sst === 'delivered';
  }, []);

  // Filter delivered orders eligible for exchange (no active/in-progress exchange already submitted)
  const eligibleDeliveredOrders = useMemo(() => {
    return userOrders.filter(order => {
      const isDelivered = isOrderDelivered(order);
      const hasActiveExchange = customerExchanges.some(ex =>
        ex.orderId === order.id &&
        ex.status !== EXCHANGE_STATUS.REJECTED &&
        ex.status !== EXCHANGE_STATUS.CANCELLED &&
        ex.status !== EXCHANGE_STATUS.QC_REJECTED
      );
      const isCancelled = String(order.status || '').toLowerCase().includes('cancel');
      const isExchanged = String(order.status || '').toLowerCase() === 'exchanged';
      return isDelivered && !hasActiveExchange && !isCancelled && !isExchanged;
    });
  }, [userOrders, customerExchanges, isOrderDelivered]);

  // Auto-launch exchange modal if query param is set (e.g. ?tab=exchanges&exchangeOrderId=...)
  useEffect(() => {
    const exchangeOrderId = searchParams.get('exchangeOrderId') || 
      (searchParams.get('action') === 'exchange' ? searchParams.get('orderId') : null);
    if (exchangeOrderId && userOrders.length > 0 && !selectedExchangeOrder) {
      const match = userOrders.find(o => o.id === exchangeOrderId);
      if (match) {
        setSelectedExchangeOrder(match);
      }
    }
  }, [searchParams, userOrders, selectedExchangeOrder]);

  const openCancelModal = (order) => {
    setCancelModal({ open: true, order });
    setCancelReason('');
    setCancelCustomReason('');
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  };

  const closeCancelModal = () => {
    setCancelModal({ open: false, order: null });
    setCancelReason('');
    setCancelCustomReason('');
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  };

  const handleConfirmCancel = async () => {
    const order = cancelModal.order;
    if (!order) return;

    const finalReason = cancelReason === 'Other'
      ? (cancelCustomReason.trim() || 'Other')
      : cancelReason;

    if (!finalReason) return;

    setCancellingId(order.id);
    closeCancelModal();

    try {
      await cancelUserOrder(order.id, finalReason, order.waybill);
      setOrderFeedback({ type: 'success', text: `Order #${order.id} has been cancelled successfully.` });
      loadUserOrders();
      setTimeout(() => setOrderFeedback(null), 6000);
    } catch (err) {
      setOrderFeedback({ type: 'error', text: `Failed to cancel order: ${err.message}` });
      setTimeout(() => setOrderFeedback(null), 6000);
    } finally {
      setCancellingId(null);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'orders') {
      loadUserOrders();
    }
  };

  if (!userProfile) return null; // Avoid rendering if protected route block is still calculating

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'birthdate' && value) {
      const birthDate = new Date(value);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        if (calculatedAge >= 0 && calculatedAge < 120) {
          setFormData(prev => ({ ...prev, birthdate: value, age: calculatedAge }));
          return;
        }
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  async function handleSave(e, customData = null) {
    if (e && e.preventDefault) e.preventDefault();
    const dataToSave = customData || formData;
    const prevFormData = { ...formData };

    try {
      // 1. Optimistic UI update: immediately exit edit mode and show success
      setMessage({ type: 'success', text: 'PROFILE UPDATED SUCCESSFULLY' });
      setIsEditing(false);

      const addressData = {
        line1: dataToSave.addressLine,
        city: dataToSave.city,
        state: dataToSave.state,
        pincode: dataToSave.pincode
      };

      // 2. Background Firestore update
      await updateFirestoreProfile(currentUser.uid, {
        fullName: dataToSave.fullName,
        phone: dataToSave.phone,
        birthdate: dataToSave.birthdate || '',
        age: dataToSave.age ? Number(dataToSave.age) : null,
        address: addressData
      });

      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      // 3. Rollback on failure: restore previous data, reopen edit mode, and provide retry
      setFormData(prevFormData);
      setIsEditing(true);
      setMessage({
        type: 'error',
        text: 'Failed to update profile. Your changes were reverted.',
        onRetry: () => handleSave(null, dataToSave)
      });
    }
  }

  const avatarImage = currentUser.photoURL || `https://ui-avatars.com/api/?name=${userProfile.fullName}&background=2E3A59&color=fff&size=100`;

  return (
    <div className="profile-page">
      <SEO title="My Account | Brother’s Outfit Gallery" noindex={true} />
      <div className="profile-container">

        <div className="profile-sidebar">
          <div className="profile-avatar-block">
            <img src={avatarImage} alt={userProfile.fullName} className="profile-avatar" />
            <h2 className="profile-name">{userProfile.fullName}</h2>
            <p className="profile-email">{userProfile.email}</p>
          </div>
          <nav className="profile-nav">
            <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => handleTabChange('profile')}>My Profile</button>
            <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => handleTabChange('orders')}>My Orders ({userOrders.length})</button>
            <button className={activeTab === 'exchanges' ? 'active' : ''} onClick={() => handleTabChange('exchanges')}>
              🔄 My Exchanges ({customerExchanges.length})
            </button>
          </nav>
        </div>

        <div className="profile-content">
          {/* Unread Customer In-App Notifications Banner */}
          {customerNotifications.filter(n => !n.read).length > 0 && (
            <div className="profile-notifications-stack">
              {customerNotifications.filter(n => !n.read).map(n => (
                <div key={n.id} className="profile-notif-banner">
                  <span className="notif-bell-icon">🔔</span>
                  <div className="notif-body">
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                  </div>
                  <button
                    type="button"
                    className="notif-close-btn"
                    onClick={() => handleDismissNotification(n.id)}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {notificationFeedback && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '16px'
            }}>
              <span>{notificationFeedback.text}</span>
              {notificationFeedback.onRetry && (
                <button
                  type="button"
                  onClick={notificationFeedback.onRetry}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Prominent Approved Exchange Notification Banner */}
          {approvedExchanges.length > 0 && (
            <div className="profile-approved-exchange-alert">
              <div className="approved-alert-left">
                <span className="approved-alert-icon">🎉</span>
                <div className="approved-alert-text">
                  <strong>Exchange Request #{approvedExchanges[0].id || approvedExchanges[0].docId} Approved!</strong>
                  <span>Your exchange request has been approved by admin. Submit proof of exchange on WhatsApp to coordinate replacement.</span>
                </div>
              </div>
              <div className="approved-alert-actions">
                <button
                  type="button"
                  className="btn-alert-view-notice"
                  onClick={() => setApprovalModalExchange(approvedExchanges[0])}
                >
                  View Notice
                </button>
                <a
                  href={`https://wa.me/918460233020?text=${encodeURIComponent(
                    `Hi Brother's Outfit Gallery Team,\n\nMy Exchange Request #${approvedExchanges[0].id || approvedExchanges[0].docId} for Order #${approvedExchanges[0].orderId} is APPROVED!\n• Item: ${approvedExchanges[0].productName || 'Garment Item'}\n• Replacement: ${approvedExchanges[0].requestedVariant?.size || 'New Size'}\n\nI am submitting the required photo/video proof with tags attached.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-alert-whatsapp"
                >
                  📲 Submit Proof
                </a>
              </div>
            </div>
          )}

          {/* Mobile Profile Navigation Tabs (Always Visible at Top on Mobile) */}
          <div className="profile-mobile-tabs">
            <button 
              className={`profile-mobile-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => handleTabChange('profile')}
            >
              👤 Profile
            </button>
            <button 
              className={`profile-mobile-tab ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => handleTabChange('orders')}
            >
              📦 Orders ({userOrders.length})
            </button>
            <button 
              className={`profile-mobile-tab ${activeTab === 'exchanges' ? 'active' : ''}`}
              onClick={() => handleTabChange('exchanges')}
            >
              🔄 Exchanges ({customerExchanges.length})
            </button>
          </div>

          {activeTab === 'orders' ? (
            <div className="profile-orders-view">
              <div className="profile-header">
                <h1>MY ORDERS ({userOrders.length})</h1>
              </div>

              {orderFeedback && (
                <div 
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    background: orderFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: orderFeedback.type === 'success' ? '#166534' : '#991b1b',
                    border: `1px solid ${orderFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                  }}
                >
                  {orderFeedback.type === 'success' ? '✓ ' : '✕ '}
                  {orderFeedback.text}
                </div>
              )}

              {ordersLoading ? (
                <p>Loading your orders...</p>
              ) : userOrders.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
                  <h3>No orders placed yet.</h3>
                  <button onClick={() => navigate('/shop')} className="btn-auth-primary" style={{ width: 'auto', marginTop: '16px' }}>
                    START SHOPPING →
                  </button>
                </div>
              ) : (
                <div className="orders-list">
                  {userOrders.map(order => {
                    const normalizedShipment = normalizeShipmentStatus(order.shipmentStatus || order.status, order.rawProviderStatusCode);
                    const isDelivered = isOrderDelivered(order);
                    const isProcessing = (order.status || 'Processing') === 'Processing';
                    const isCancelled = (order.status || '').toLowerCase() === 'cancelled';
                    const isShipped = (order.status || '').toLowerCase() === 'shipped';
                    
                    // Authoritative exchange lookup for this order
                    const orderExchange = customerExchanges.find(ex => ex.orderId === order.id);
                    const isOrderExchangeApproved = orderExchange && (
                      [EXCHANGE_STATUS.APPROVED, EXCHANGE_STATUS.REVERSE_PICKUP_PENDING, EXCHANGE_STATUS.REVERSE_PICKUP_CREATED].includes(orderExchange.status) ||
                      String(orderExchange.status || '').toUpperCase() === 'APPROVED' ||
                      String(orderExchange.adminDecision || '').toUpperCase() === 'APPROVED'
                    );

                    const statusClass = isCancelled 
                      ? 'status-cancelled' 
                      : isOrderExchangeApproved
                      ? 'status-exchange'
                      : orderExchange
                      ? (orderExchange.status === EXCHANGE_STATUS.REJECTED ? 'status-cancelled' : 'status-exchange')
                      : isDelivered 
                      ? 'status-delivered' 
                      : isShipped 
                      ? 'status-shipped' 
                      : 'status-processing';

                    const formattedDate = order.createdAt?.toDate 
                      ? order.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : (order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent');

                    return (
                      <div key={order.id} className="order-card">
                        {/* Order Header: 2 Structured Rows */}
                        <div className="order-card-header">
                          <div className="order-card-header-top">
                            <div className="order-id-line">
                              <span className="order-id-label">Order</span>
                              <button 
                                type="button"
                                className="order-id-badge" 
                                title={`Full Order ID: ${order.id} (Click to copy)`}
                                onClick={() => {
                                  if (navigator.clipboard?.writeText) {
                                    navigator.clipboard.writeText(order.id);
                                    setCopiedOrderId(order.id);
                                    setTimeout(() => setCopiedOrderId(null), 2000);
                                  }
                                }}
                              >
                                <span className="order-id-text">
                                  #{order.id.length > 18 ? `${order.id.substring(0, 14)}...` : order.id}
                                </span>
                                <span className="order-copy-icon" aria-label="Copy order id">
                                  {copiedOrderId === order.id ? '✓ Copied' : '📋'}
                                </span>
                              </button>
                            </div>

                            <span className={`order-status-pill ${statusClass}`}>
                              {isOrderExchangeApproved
                                ? 'Exchange Approved'
                                : orderExchange 
                                ? (EXCHANGE_STATUS_METADATA[orderExchange.status]?.label || orderExchange.status)
                                : (order.status || 'Processing')}
                            </span>
                          </div>

                          <div className="order-card-header-sub">
                            <span className="order-date-text">Placed on {formattedDate}</span>
                            <div className="order-total-price">
                              ₹{(order.totalAmount || order.finalTotal || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        {/* Order Items Breakdown */}
                        <div className="order-items-list">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="order-item-row">
                              <img
                                src={item.thumbnailUrl || item.image || (item.images && item.images[0]?.url) || (item.images && item.images[0]) || '/images/hero.png'}
                                alt={item.name}
                                className="order-item-img"
                              />
                              <div className="order-item-content">
                                <div className="order-item-title" title={item.name}>
                                  {item.name}
                                </div>
                                <div className="order-item-meta-row">
                                  {item.size && (
                                    <span className="order-pill pill-size">
                                      Size: {item.size}
                                    </span>
                                  )}
                                  {item.color && (
                                    <span className="order-pill pill-color">
                                      {item.color}
                                    </span>
                                  )}
                                  <span className="order-item-qty">
                                    Qty: {item.quantity} × ₹{item.price}
                                  </span>
                                </div>
                              </div>
                              <div className="order-item-amount">
                                ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Delivery Address Compact Summary */}
                        {order.shippingAddress && (
                          <div className="order-shipping-summary">
                            <span className="shipping-icon">📍</span>
                            <span className="shipping-text">
                              <strong>Deliver to: </strong>
                              {order.shippingAddress.fullName ? `${order.shippingAddress.fullName}, ` : ''}
                              {order.shippingAddress.city ? `${order.shippingAddress.city} ` : ''}
                              {order.shippingAddress.pincode ? `(${order.shippingAddress.pincode})` : ''}
                              {order.shippingAddress.phone ? ` • 📞 ${order.shippingAddress.phone}` : ''}
                            </span>
                          </div>
                        )}

                        {/* Order Actions Footer */}
                        <div className="order-card-footer">
                          <div className="order-payment-desc">
                            <span className="payment-label">Payment:</span>
                            <strong className="payment-method-val">
                              {order.paymentMethod === 'cod' || order.paymentMethod?.toLowerCase().includes('cash') ? 'Cash on Delivery' : (order.paymentMethod || 'Online')}
                            </strong>
                            {order.paymentStatus && <span className="status-tag">({order.paymentStatus})</span>}
                          </div>

                          {isCancelled && (
                            <div className="order-cancelled-banner">
                              <div className="cancelled-banner-header">
                                <span className="cancelled-banner-badge">✕ Order Cancelled</span>
                                {order.cancelledBy && (
                                  <span className="cancelled-by-text">
                                    By: {order.cancelledBy === 'Admin' ? 'Store' : 'You'}
                                  </span>
                                )}
                              </div>
                              {order.cancellationReason && (
                                <div className="order-cancel-reason-text">
                                  Reason: {order.cancellationReason}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Authoritative Exchange Banner */}
                          {orderExchange && (
                            <div className="order-exchange-banner">
                              <div className="exchange-banner-header">
                                <span className="exchange-banner-badge">
                                  🔄 Exchange: {EXCHANGE_STATUS_METADATA[orderExchange.status]?.label || orderExchange.status}
                                </span>
                                <span className="exchange-policy-badge">
                                  Req: Size {orderExchange.requestedVariant?.size || 'N/A'}
                                </span>
                              </div>
                              <div className="exchange-banner-body">
                                <div><strong>Item:</strong> {orderExchange.productName || 'Garment Item'}</div>
                                <div><strong>Reason:</strong> {orderExchange.reason}</div>
                                {orderExchange.status === EXCHANGE_STATUS.REJECTED && orderExchange.rejectionReason && (
                                  <div className="exchange-rejection-msg">
                                    <strong>Admin Reason:</strong> {orderExchange.rejectionReason}
                                  </div>
                                )}
                                {orderExchange.reversePickupAwb && (
                                  <div className="exchange-awb-line">
                                    <strong>Delhivery Reverse AWB:</strong> {orderExchange.reversePickupAwb} ({orderExchange.reversePickupStatus || 'Scheduled'})
                                  </div>
                                )}
                                {orderExchange.replacementAwb && (
                                  <div className="exchange-awb-line">
                                    <strong>Replacement AWB:</strong> {orderExchange.replacementAwb}
                                  </div>
                                )}
                              </div>
                              <div className="exchange-banner-footer">
                                <button
                                  type="button"
                                  className="btn-order-view-exchange"
                                  onClick={() => setActiveTab('exchanges')}
                                >
                                  View Full Exchange Timeline →
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="order-actions-wrap">
                            <Link
                              to={`/track-order/${order.id}`}
                              className="btn-order-track"
                              title="Track this order live"
                            >
                              🚚 Track Order
                            </Link>

                            {order.waybill && (
                              <a
                                href={order.trackingUrl || `https://www.delhivery.com/track/package/${order.waybill}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-order-delhivery"
                                title="Official Delhivery Tracking"
                              >
                                📦 Delhivery AWB
                              </a>
                            )}

                            {/* BUSINESS RULE: Show Exchange button ONLY if order is DELIVERED and no active exchange */}
                            {isDelivered && !orderExchange && (order.status || '').toLowerCase() !== 'exchanged' && (
                              <button
                                type="button"
                                onClick={() => setSelectedExchangeOrder(order)}
                                className="btn-order-exchange"
                                title="Request 48-Hour Size or Quality Exchange"
                              >
                                🔄 Request Exchange
                              </button>
                            )}

                            {isProcessing && (
                              <button
                                onClick={() => openCancelModal(order)}
                                disabled={cancellingId === order.id}
                                className="btn-order-cancel"
                              >
                                {cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'exchanges' ? (
            <div className="profile-exchanges-view">
              <div className="profile-header">
                <h1>MY EXCHANGES ({customerExchanges.length})</h1>
                {eligibleDeliveredOrders.length > 0 && (
                  <button
                    type="button"
                    className="btn-header-exchange"
                    onClick={() => setSelectedExchangeOrder(eligibleDeliveredOrders[0])}
                    title="Request exchange for your recent delivered order"
                  >
                    🔄 Request New Exchange
                  </button>
                )}
              </div>

              <div className="exchange-policy-card">
                <span className="policy-icon" aria-hidden="true">🛡️</span>
                <div>
                  <strong>Brother’s Outfit Gallery Exchange-Only Policy</strong>
                  <p>
                    We offer hassle-free size and quality exchanges within 48 hours of parcel delivery.
                    Garments must remain unused and unwashed with original brand tags intact.
                    Reverse pickup is scheduled via Delhivery upon admin approval.
                  </p>
                </div>
              </div>

              {/* Delivered Orders Eligible for Exchange - Open Modal Right Here */}
              {eligibleDeliveredOrders.length > 0 && (
                <div className="eligible-exchange-section">
                  <div className="eligible-section-title">
                    <span>📦 DELIVERED ORDERS READY FOR EXCHANGE ({eligibleDeliveredOrders.length})</span>
                  </div>
                  <div className="eligible-orders-grid">
                    {eligibleDeliveredOrders.map(order => {
                      const formattedDate = order.createdAt?.toDate 
                        ? order.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : (order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent');

                      return (
                        <div key={order.id} className="eligible-order-card">
                          <div className="eligible-card-top">
                            <div>
                              <span className="eligible-order-id">Order #{order.id}</span>
                              <span className="eligible-order-date">Placed on {formattedDate}</span>
                            </div>
                            <span className="eligible-status-badge">✓ Delivered (Eligible)</span>
                          </div>

                          <div className="eligible-items-preview">
                            {order.items?.map((item, idx) => (
                              <div key={idx} className="eligible-item-chip">
                                <img 
                                  src={item.thumbnailUrl || item.image || (item.images && item.images[0]?.url) || (item.images && item.images[0]) || '/images/hero.png'} 
                                  alt={item.name} 
                                  className="eligible-item-thumb" 
                                />
                                <div className="eligible-item-info">
                                  <div className="eligible-item-name">{item.name}</div>
                                  <div className="eligible-item-sub">
                                    {item.size && <span>Size: {item.size}</span>}
                                    {item.color && <span> • {item.color}</span>}
                                    <span> • Qty: {item.quantity || 1}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="eligible-card-actions">
                            <button
                              type="button"
                              className="btn-start-exchange-now"
                              onClick={() => setSelectedExchangeOrder(order)}
                            >
                              🔄 Request Exchange for Order #{order.id.length > 12 ? `${order.id.slice(0, 10)}...` : order.id}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {customerExchanges.length === 0 ? (
                <div className="profile-empty-exchanges">
                  <span className="empty-icon" aria-hidden="true">🔄</span>
                  <h3>{eligibleDeliveredOrders.length > 0 ? 'No In-Progress Exchanges' : 'No exchange requests yet'}</h3>
                  <p>
                    {eligibleDeliveredOrders.length > 0
                      ? 'You can request a size exchange for your delivered orders using the button above.'
                      : 'Delivered orders are eligible for exchange within 48 hours. You can request an exchange from your "My Orders" tab.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="btn-auth-primary"
                    style={{ width: 'auto', marginTop: '16px' }}
                  >
                    GO TO MY ORDERS →
                  </button>
                </div>
              ) : (
                <div className="customer-exchanges-list">
                  {customerExchanges.map((ex) => {
                    const isApproved = [EXCHANGE_STATUS.APPROVED, EXCHANGE_STATUS.REVERSE_PICKUP_PENDING, EXCHANGE_STATUS.REVERSE_PICKUP_CREATED].includes(ex.status) ||
                      String(ex.status || '').toUpperCase() === 'APPROVED' ||
                      String(ex.adminDecision || '').toUpperCase() === 'APPROVED';

                    const meta = EXCHANGE_STATUS_METADATA[ex.status] || {
                      label: isApproved ? 'Exchange Approved' : ex.status,
                      description: isApproved ? 'Approved by admin' : '',
                      badgeClass: isApproved ? 'badge-approved' : 'badge-pending',
                      step: isApproved ? 2 : 1
                    };
                    const isRejected = ex.status === EXCHANGE_STATUS.REJECTED || ex.status === EXCHANGE_STATUS.QC_REJECTED;
                    const currentStep = isApproved ? 2 : (meta.step || 1);

                    return (
                      <div key={ex.id || ex.docId} className="customer-exchange-card">
                        <div className="exchange-card-header">
                          <div>
                            <span className="exchange-id-badge">#{ex.id}</span>
                            <span className="exchange-order-ref">
                              Order #{ex.orderId}
                            </span>
                          </div>
                          <span className={`exchange-status-pill ${isApproved ? 'badge-approved' : meta.badgeClass}`}>
                            {isApproved ? 'Exchange Approved' : meta.label}
                          </span>
                        </div>

                        {/* Product Detail */}
                        <div className="exchange-card-product-row">
                          {ex.productSlug || ex.productId ? (
                            <Link
                              to={`/product/${ex.productSlug || ex.productId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="exchange-card-img-link"
                              title="Open Product Page"
                            >
                              <img
                                src={ex.productImage || ex.productImageSnapshot || '/images/hero.png'}
                                alt={ex.productName || 'Product'}
                                className="exchange-card-img"
                              />
                            </Link>
                          ) : (
                            <img
                              src={ex.productImage || ex.productImageSnapshot || '/images/hero.png'}
                              alt={ex.productName || 'Product'}
                              className="exchange-card-img"
                            />
                          )}
                          <div className="exchange-card-product-details">
                            {ex.productSlug || ex.productId ? (
                              <Link
                                to={`/product/${ex.productSlug || ex.productId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="exchange-product-title-link"
                                title="Open Product Page"
                              >
                                <h4 className="exchange-product-title">
                                  <span>{ex.productName || ex.productNameSnapshot || 'Garment Item'}</span>
                                  <span className="open-ext-arrow" aria-hidden="true">↗</span>
                                </h4>
                              </Link>
                            ) : (
                              <h4 className="exchange-product-title">{ex.productName || ex.productNameSnapshot || 'Garment Item'}</h4>
                            )}
                            <div className="exchange-variant-transition">
                              <span className="variant-pill current-variant">
                                Current: {ex.currentVariant?.size || 'Standard'}
                              </span>
                              <span className="variant-arrow">→</span>
                              <span className="variant-pill requested-variant">
                                Requested: {ex.requestedVariant?.size || 'N/A'}
                              </span>
                            </div>
                            <div className="exchange-reason-text">
                              <strong>Reason:</strong> {ex.reason}
                            </div>
                            {ex.customerMessage && (
                              <div className="exchange-customer-msg">
                                <strong>Your Note:</strong> "{ex.customerMessage}"
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Rejection Alert Banner */}
                        {isRejected && (
                          <div className="exchange-rejection-card">
                            <div className="rejection-card-title">✕ Exchange Request Not Approved</div>
                            <p className="rejection-card-desc">Your exchange request was reviewed and rejected.</p>
                            {ex.rejectionReason && (
                              <div className="rejection-reason-box">
                                <strong>Admin Reason:</strong> {ex.rejectionReason}
                              </div>
                            )}
                            <p className="rejection-subtext">No reverse pickup was created. Please contact our support if you have questions.</p>
                          </div>
                        )}

                        {/* Approval Notice Card with WhatsApp proof submission button */}
                        {isApproved && (
                          <div className="exchange-approved-card">
                            <div className="exchange-approved-badge">
                              <span className="approved-icon" aria-hidden="true">🎉</span>
                              <div>
                                <div className="approved-title">Exchange Request Approved!</div>
                                <div className="approved-subtitle">Your exchange request has been approved by admin</div>
                              </div>
                            </div>
                            <p className="approved-desc">
                              Your exchange request is approved! Please submit photo/video proof showing original brand tags attached via WhatsApp to coordinate replacement.
                            </p>
                            <div className="approved-card-actions">
                              <a
                                href={`https://wa.me/918460233020?text=${encodeURIComponent(
                                  `Hi Brother's Outfit Gallery Team,\n\nMy Exchange Request #${ex.id || ex.docId} for Order #${ex.orderId} is APPROVED!\n• Item: ${ex.productName || 'Garment Item'}\n• Replacement Size: ${ex.requestedVariant?.size || 'New Size'}\n\nI am submitting the required proof of the garment with brand tags attached.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-submit-proof-wa"
                              >
                                <span>📲 Submit Proof of Exchange on WhatsApp</span>
                              </a>
                              <button
                                type="button"
                                className="btn-view-approval-notice"
                                onClick={() => setApprovalModalExchange(ex)}
                              >
                                View Full Notice
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Delhivery Reverse Pickup Card */}
                        {ex.reversePickupAwb && (
                          <div className="exchange-courier-card">
                            <span className="courier-icon" aria-hidden="true">📦</span>
                            <div className="courier-details">
                              <div className="courier-title">Delhivery Reverse Pickup Scheduled</div>
                              <div className="courier-meta">
                                <span><strong>AWB:</strong> {ex.reversePickupAwb}</span>
                                <span><strong>Status:</strong> {ex.reversePickupStatus || 'Scheduled'}</span>
                              </div>
                              <p className="courier-hint">
                                A Delhivery courier representative will visit your address to collect the garment.
                                Please keep the unwashed garment packed with brand tags attached.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Replacement Shipped Card */}
                        {ex.replacementAwb && (
                          <div className="exchange-courier-card replacement-card">
                            <span className="courier-icon" aria-hidden="true">🚚</span>
                            <div className="courier-details">
                              <div className="courier-title">Replacement Garment Dispatched</div>
                              <div className="courier-meta">
                                <span><strong>Delhivery Express AWB:</strong> {ex.replacementAwb}</span>
                              </div>
                              <p className="courier-hint">Your replacement size has been packed and handed over to Delhivery.</p>
                            </div>
                          </div>
                        )}

                        {/* Visual 6-Step Status Timeline */}
                        {!isRejected && (
                          <div className="exchange-timeline-wrap">
                            <div className="exchange-timeline-header">Exchange Status Timeline</div>
                            <div className="exchange-timeline-steps">
                              {CUSTOMER_EXCHANGE_STEPS.map((s) => {
                                const isComplete = currentStep > s.step;
                                const isCurrent = currentStep === s.step;
                                return (
                                  <div
                                    key={s.step}
                                    className={`exchange-step-item ${isComplete ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}
                                  >
                                    <div className="exchange-step-circle">
                                      {isComplete ? '✓' : s.step}
                                    </div>
                                    <span className="exchange-step-label">{s.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Card Footer WhatsApp Action */}
                        <div className="exchange-card-footer">
                          <a
                            href={`https://wa.me/918460233020?text=${encodeURIComponent(`Hi Brother's Outfit Gallery team, I have a query regarding Exchange #${ex.id} for Order #${ex.orderId}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-exchange-support"
                          >
                            💬 Contact WhatsApp Concierge
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="profile-header">
                <h1>MY ACCOUNT</h1>
                {!isEditing && (
                  <button onClick={() => setIsEditing(true)} className="btn-edit">
                    EDIT PROFILE
                  </button>
                )}
              </div>

              {message && (
                <div
                  className={`profile-message ${message.type === 'error' ? 'profile-message--error' : ''}`}
                  style={
                    message.type === 'error'
                      ? {
                          background: '#fef2f2',
                          color: '#dc2626',
                          borderColor: '#fecaca',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }
                      : {}
                  }
                >
                  <span>{typeof message === 'string' ? message : message.text}</span>
                  {message.onRetry && (
                    <button
                      type="button"
                      onClick={message.onRetry}
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {isEditing ? (
                <form onSubmit={handleSave} className="profile-form">
                  <div className="profile-form-card">
                    <div className="profile-form-card-header">
                      <span className="profile-form-icon">👤</span>
                      <div>
                        <h3 className="profile-form-title">PERSONAL INFORMATION</h3>
                        <p className="profile-form-subtitle">Update your identity and contact details</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Email Address</label>
                      <input type="email" className="form-input" value={userProfile.email} readOnly style={{ background: '#f8fafc' }} />
                      <span className="form-field-hint">Account email cannot be modified</span>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Full Name</label>
                        <input type="text" name="fullName" className="form-input" value={formData.fullName} onChange={handleChange} required placeholder="Enter your full name" />
                      </div>
                      <div className="form-group">
                        <label>Mobile Number</label>
                        <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleChange} required placeholder="10-digit mobile number" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Date of Birth (Birthdate)</label>
                        <input 
                          type="date" 
                          name="birthdate" 
                          className="form-input" 
                          value={formData.birthdate} 
                          max={new Date().toISOString().split('T')[0]}
                          onChange={handleChange} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Age</label>
                        <input 
                          type="number" 
                          name="age" 
                          className="form-input" 
                          value={formData.age} 
                          onChange={handleChange} 
                          min="1" 
                          max="120"
                          placeholder="Auto-calculated from DOB"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="profile-form-card" style={{ marginTop: '24px' }}>
                    <div className="profile-form-card-header">
                      <span className="profile-form-icon">📍</span>
                      <div>
                        <h3 className="profile-form-title">DELIVERY ADDRESS</h3>
                        <p className="profile-form-subtitle">Default address used for shipping your orders</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Address Line 1 (House/Flat, Street)</label>
                      <input type="text" name="addressLine" className="form-input" value={formData.addressLine} onChange={handleChange} required placeholder="Street address, apartment, suite" />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>City</label>
                        <input type="text" name="city" className="form-input" value={formData.city} onChange={handleChange} required placeholder="e.g. Himatnagar" />
                      </div>
                      <div className="form-group">
                        <label>State</label>
                        <input type="text" name="state" className="form-input" value={formData.state} onChange={handleChange} required placeholder="e.g. Gujarat" />
                      </div>
                      <div className="form-group">
                        <label>Pincode</label>
                        <input type="text" name="pincode" className="form-input" value={formData.pincode} onChange={handleChange} required placeholder="6-digit pincode" />
                      </div>
                    </div>
                  </div>

                  <div className="profile-actions">
                    <button type="button" onClick={() => setIsEditing(false)} className="btn-ghost">CANCEL</button>
                    <button type="submit" disabled={loading} className="btn-auth-primary" style={{ width: 'auto', marginTop: 0 }}>
                      {loading ? 'SAVING...' : 'SAVE CHANGES'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="profile-view">
                  <h3 className="section-title">PERSONAL INFORMATION</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Full Name</span>
                      <span className="info-value">{userProfile.fullName || '-'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Email</span>
                      <span className="info-value">{userProfile.email || '-'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Mobile Number</span>
                      <span className="info-value">{userProfile.phone || '-'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Date of Birth</span>
                      <span className="info-value">
                        {userProfile.birthdate 
                          ? new Date(userProfile.birthdate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Not provided'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Age</span>
                      <span className="info-value">{userProfile.age ? `${userProfile.age} yrs` : 'Not provided'}</span>
                    </div>
                  </div>

                  <h3 className="section-title" style={{ marginTop: '40px' }}>DELIVERY ADDRESS</h3>
                  <div className="address-card">
                    <div className="info-item">
                      <span className="info-label">Address Line</span>
                      <span className="info-value">{userProfile.address?.line1 || '-'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">City & State</span>
                      <span className="info-value">{userProfile.address?.city ? `${userProfile.address?.city}, ${userProfile.address?.state || ''}` : '-'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Pincode</span>
                      <span className="info-value">{userProfile.address?.pincode || '-'}</span>
                    </div>
                  </div>

                  {/* Eligible Delivered Order Quick Exchange Callout in Profile View */}
                  {eligibleDeliveredOrders.length > 0 && (
                    <div className="profile-exchange-callout">
                      <div className="callout-icon">🔄</div>
                      <div className="callout-content">
                        <strong>Order #{eligibleDeliveredOrders[0].id} is Eligible for Exchange</strong>
                        <p>Need a size exchange (38, 40, 42, 44, or custom fit)? Exchanges are active for 48 hours.</p>
                      </div>
                      <button
                        type="button"
                        className="btn-callout-exchange"
                        onClick={() => setSelectedExchangeOrder(eligibleDeliveredOrders[0])}
                      >
                        Request Exchange →
                      </button>
                    </div>
                  )}

                  {/* Account Actions Section with Logout */}
                  <div className="profile-account-footer">
                    <div className="account-footer-info">
                      <span className="account-footer-label">Logged In As</span>
                      <span className="account-footer-val">{userProfile.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="btn-account-logout"
                    >
                      🚪 Log Out from Account
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Customer Cancel Reason Modal */}
      {cancelModal.open && typeof document !== 'undefined' && createPortal(
        <div className="cancel-overlay" onClick={closeCancelModal}>
          <div className="cancel-modal" onClick={e => e.stopPropagation()}>
            <div className="cancel-modal-header">
              <h3>Cancel Order #{cancelModal.order?.id}</h3>
              <button className="cancel-modal-close" onClick={closeCancelModal}>✕</button>
            </div>
            <div className="cancel-modal-body">
              <p className="cancel-modal-desc">Please tell us why you'd like to cancel this order:</p>
              <div className="cancel-modal-options">
                {CUSTOMER_CANCEL_REASONS.map(reason => (
                  <label key={reason} className={`cancel-modal-option ${cancelReason === reason ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="customerCancelReason"
                      value={reason}
                      checked={cancelReason === reason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
              {cancelReason === 'Other' && (
                <textarea
                  className="cancel-modal-textarea"
                  placeholder="Please describe your reason..."
                  value={cancelCustomReason}
                  onChange={(e) => setCancelCustomReason(e.target.value)}
                  rows={2}
                />
              )}
              <div className="cancel-modal-actions">
                <button className="cancel-modal-btn-ghost" onClick={closeCancelModal}>Keep Order</button>
                <button
                  className="cancel-modal-btn-danger"
                  onClick={handleConfirmCancel}
                  disabled={!cancelReason || (cancelReason === 'Other' && !cancelCustomReason.trim())}
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Customer Exchange Modal (Strict Exchange-Only Policy) */}
      <ExchangeRequestModal
        isOpen={!!selectedExchangeOrder}
        order={selectedExchangeOrder}
        existingExchanges={customerExchanges}
        onClose={() => setSelectedExchangeOrder(null)}
        onSuccess={() => {
          setSelectedExchangeOrder(null);
          setActiveTab('exchanges');
          loadUserOrders();
          setOrderFeedback({
            type: 'success',
            text: 'Exchange request submitted successfully! Our team will review and approve reverse pickup shortly.'
          });
          setTimeout(() => setOrderFeedback(null), 8000);
        }}
      />

      {/* Customer Exchange Approval Popup Modal */}
      <ExchangeApprovalModal
        isOpen={!!approvalModalExchange}
        onClose={handleCloseApprovalModal}
        exchange={approvalModalExchange}
      />
    </div>
  );
}
