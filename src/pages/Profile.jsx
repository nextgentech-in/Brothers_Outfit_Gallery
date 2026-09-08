import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserOrders, cancelUserOrder } from '../services/orderService';
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

  const initialTab = searchParams.get('tab') === 'orders' ? 'orders' : 'profile';
  const [activeTab, setActiveTab] = useState(initialTab); // 'profile' or 'orders'
  const [userOrders, setUserOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

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

  const [cancellingId, setCancellingId] = useState(null);
  const [cancelModal, setCancelModal] = useState({ open: false, order: null });
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCustomReason, setCancelCustomReason] = useState('');

  const openCancelModal = (order) => {
    setCancelModal({ open: true, order });
    setCancelReason('');
    setCancelCustomReason('');
  };

  const closeCancelModal = () => {
    setCancelModal({ open: false, order: null });
    setCancelReason('');
    setCancelCustomReason('');
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
      alert('Your order has been cancelled successfully.');
      loadUserOrders();
    } catch (err) {
      alert(`Failed to cancel order: ${err.message}`);
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

  async function handleSave(e) {
    e.preventDefault();
    try {
      setMessage('');
      setLoading(true);
      const addressData = {
        line1: formData.addressLine,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode
      };

      await updateFirestoreProfile(currentUser.uid, {
        fullName: formData.fullName,
        phone: formData.phone,
        birthdate: formData.birthdate || '',
        age: formData.age ? Number(formData.age) : null,
        address: addressData
      });

      setMessage('PROFILE UPDATED SUCCESSFULLY');
      setIsEditing(false);
    } catch {
      setMessage('Failed to update profile.');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  }

  const avatarImage = currentUser.photoURL || `https://ui-avatars.com/api/?name=${userProfile.fullName}&background=2E3A59&color=fff&size=100`;

  return (
    <div className="profile-page">
      <div className="profile-container">

        <div className="profile-sidebar">
          <div className="profile-avatar-block">
            <img src={avatarImage} alt={userProfile.fullName} className="profile-avatar" />
            <h2 className="profile-name">{userProfile.fullName}</h2>
            <p className="profile-email">{userProfile.email}</p>
          </div>
          <nav className="profile-nav">
            <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => handleTabChange('profile')}>My Profile</button>
            <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => handleTabChange('orders')}>My Orders</button>
            <button onClick={handleLogout} style={{ color: '#c0392b' }}>Logout</button>
          </nav>
        </div>

        <div className="profile-content">
          {/* Mobile Profile Navigation Tabs (Always Visible at Top on Mobile) */}
          <div className="profile-mobile-tabs">
            <button 
              className={`profile-mobile-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => handleTabChange('profile')}
            >
              👤 My Profile
            </button>
            <button 
              className={`profile-mobile-tab ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => handleTabChange('orders')}
            >
              📦 My Orders ({userOrders.length})
            </button>
            <button 
              className="profile-mobile-tab profile-mobile-tab--logout"
              onClick={handleLogout}
            >
              🚪 Logout
            </button>
          </div>

          {activeTab === 'orders' ? (
            <div className="profile-orders-view">
              <div className="profile-header">
                <h1>MY ORDERS ({userOrders.length})</h1>
              </div>

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
                    const isProcessing = (order.status || 'Processing') === 'Processing';
                    const isCancelled = (order.status || '').toLowerCase() === 'cancelled';
                    const isShipped = (order.status || '').toLowerCase() === 'shipped';
                    const isDelivered = (order.status || '').toLowerCase() === 'delivered';
                    const statusClass = isCancelled ? 'status-cancelled' : isDelivered ? 'status-delivered' : isShipped ? 'status-shipped' : 'status-processing';

                    const formattedDate = order.createdAt?.toDate 
                      ? order.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : (order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent');

                    return (
                      <div key={order.id} className="order-card">
                        {/* Order Header */}
                        <div className="order-card-header">
                          <div className="order-header-left">
                            <div className="order-id-line">
                              <span className="order-id-label">Order</span>
                              <span className="order-id-badge" title={order.id}>#{order.id}</span>
                            </div>
                            <span className="order-date-text">Placed on {formattedDate}</span>
                          </div>

                          <div className="order-header-right">
                            <span className={`order-status-pill ${statusClass}`}>
                              {order.status || 'Processing'}
                            </span>
                            <div className="order-total-price">
                              ₹{order.totalAmount || order.finalTotal || 0}
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
                                ₹{(item.price || 0) * (item.quantity || 1)}
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
                            Payment: <strong>{order.paymentMethod === 'cod' || order.paymentMethod?.toLowerCase().includes('cash') ? 'Cash on Delivery' : (order.paymentMethod || 'Online')}</strong>
                            {order.paymentStatus && <span className="status-tag">({order.paymentStatus})</span>}
                          </div>

                          <div className="order-actions-wrap">
                            {order.waybill && (
                              <a
                                href={order.trackingUrl || `https://www.delhivery.com/track/package/${order.waybill}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-order-track"
                              >
                                📦 Track Delhivery
                              </a>
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

                            {isCancelled && (
                              <div className="order-cancelled-tag">
                                <div>Order Cancelled</div>
                                {order.cancellationReason && (
                                  <div className="order-cancel-reason-text">
                                    Reason: {order.cancellationReason}
                                  </div>
                                )}
                                {order.cancelledBy && (
                                  <div className="order-cancel-by-text">
                                    By: {order.cancelledBy === 'Admin' ? 'Store' : 'You'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
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

              {message && <div className="profile-message">{message}</div>}

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
                    <p>{userProfile.address?.line1}</p>
                    <p>{userProfile.address?.city}, {userProfile.address?.state}</p>
                    <p>{userProfile.address?.pincode}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Customer Cancel Reason Modal */}
      {cancelModal.open && (
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
                  rows={3}
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
        </div>
      )}
    </div>
  );
}
