import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserOrders, cancelUserOrder } from '../services/orderService';
import './Profile.css';

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
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReasonText, setCancelReasonText] = useState('');
  
  // State for Customer Order Details Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  const handleCancelOrderClick = (order, e) => {
    e.stopPropagation(); // prevent opening order modal
    setCancelModalOrder(order);
    setCancelReasonText('');
  };

  const handleTrackClick = (e, orderRecord) => {
    e.stopPropagation();
    const url = orderRecord.trackingUrl || `https://www.delhivery.com/track/package/${orderRecord.waybill || ''}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const executeCustomerCancel = async () => {
    if (!cancelModalOrder) return;
    if (!cancelReasonText.trim()) {
      alert('Please briefly explain why you are cancelling.');
      return;
    }
    const order = cancelModalOrder;
    setCancellingId(order.id);
    try {
      await cancelUserOrder(order.id, `Cancelled by customer: ${cancelReasonText}`, order.waybill);
      alert('Your order has been cancelled successfully.');
      loadUserOrders();
      setCancelModalOrder(null);
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
                      <div 
                        key={order.id} 
                        className="order-card" 
                        onClick={() => setSelectedOrder(order)}
                        style={{ cursor: 'pointer' }}
                      >
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
                            {((order.status || '').toLowerCase() === 'shipped' || order.waybill || order.trackingUrl) && (
                              <button
                                onClick={(e) => handleTrackClick(e, order)}
                                className="btn-order-track"
                              >
                                📦 Track Delhivery
                              </button>
                            )}

                            {isProcessing && (
                              <button
                                onClick={(e) => handleCancelOrderClick(order, e)}
                                disabled={cancellingId === order.id}
                                className="btn-order-cancel"
                              >
                                {cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}
                              </button>
                            )}

                            {isCancelled && (
                              <span className="order-cancelled-tag">
                                Order Cancelled {order.cancellationReason ? `(${order.cancellationReason})` : ''}
                              </span>
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
                  <h3 className="section-title">PERSONAL INFORMATION</h3>
                  <div className="form-group">
                    <label>Email (Cannot be changed)</label>
                    <input type="email" className="form-input" value={userProfile.email} readOnly style={{ background: '#f5f5f5' }} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input type="text" name="fullName" className="form-input" value={formData.fullName} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                      <label>Mobile Number</label>
                      <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleChange} required />
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

                  <h3 className="section-title" style={{ marginTop: '32px' }}>DELIVERY ADDRESS</h3>
                  <div className="form-group">
                    <label>Address Line 1</label>
                    <input type="text" name="addressLine" className="form-input" value={formData.addressLine} onChange={handleChange} required />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>City</label>
                      <input type="text" name="city" className="form-input" value={formData.city} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <input type="text" name="state" className="form-input" value={formData.state} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                      <label>Pincode</label>
                      <input type="text" name="pincode" className="form-input" value={formData.pincode} onChange={handleChange} required />
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

      {/* Customer Cancel Modal */}
      {cancelModalOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCancelModalOrder(null)}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '90%', maxWidth: '420px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#0f172a' }}>Cancel Order #{cancelModalOrder.id}</h3>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
              We're sorry to see you cancel. Please let us know why you're cancelling this order so we can improve.
            </p>
            <textarea
              autoFocus
              rows="3"
              value={cancelReasonText}
              onChange={e => setCancelReasonText(e.target.value)}
              placeholder="E.g., Ordered by mistake, wrong size, found better price elsewhere..."
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setCancelModalOrder(null)}
                style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
              >
                Go Back
              </button>
              <button
                onClick={executeCustomerCancel}
                disabled={cancellingId === cancelModalOrder.id}
                style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
              >
                {cancellingId === cancelModalOrder.id ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Order Details & Tracking Modal */}
      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedOrder(null)}>
          {/* Backdrop with blur */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }} />
          
          <div style={{ 
            background: '#fff', borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '85vh', 
            overflowY: 'auto', position: 'relative', zIndex: 2, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '16px 16px 0 0' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Order Details</h2>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>#{selectedOrder.id}</div>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                style={{ background: '#e2e8f0', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '24px' }}>
              
              {/* Order Status & Tracking Section */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', margin: '0 0 24px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Status</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      {selectedOrder.status || 'Processing'}
                      {((selectedOrder.status || '').toLowerCase() === 'shipped') && <span style={{ fontSize: '20px' }}>🚚</span>}
                      {((selectedOrder.status || '').toLowerCase() === 'delivered') && <span style={{ fontSize: '20px' }}>📦</span>}
                      {((selectedOrder.status || '').toLowerCase() === 'cancelled') && <span style={{ fontSize: '20px' }}>❌</span>}
                    </div>
                  </div>
                  {/* Tracking Button */}
                  {((selectedOrder.status || '').toLowerCase() === 'shipped' || selectedOrder.waybill || selectedOrder.trackingUrl) && (
                    <button
                      onClick={(e) => handleTrackClick(e, selectedOrder)}
                      className="btn-auth-primary"
                      style={{ padding: '8px 16px', fontSize: '13px', margin: 0, width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer' }}
                    >
                      <span>📍</span> Track Parcel
                    </button>
                  )}
                </div>

                {((selectedOrder.status || '').toLowerCase() === 'shipped' || selectedOrder.waybill || selectedOrder.trackingUrl) && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginTop: '16px', fontSize: '14px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                     <div><span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>Courier</span><strong>{selectedOrder.courier || 'Delhivery Express'}</strong></div>
                     <div><span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>Tracking ID (Waybill)</span><strong>{selectedOrder.waybill}</strong></div>
                  </div>
                )}
                {selectedOrder.cancellationReason && (
                   <div style={{ marginTop: '16px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
                     <strong>Cancellation Reason:</strong> {selectedOrder.cancellationReason}
                   </div>
                )}
              </div>

              {/* Items List */}
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', textTransform: 'uppercase' }}>Items in this order</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '12px', gap: '16px', alignItems: 'center' }}>
                    <img
                      src={item.thumbnailUrl || item.image || (item.images && item.images[0]?.url) || (item.images && item.images[0]) || '/images/hero.png'}
                      alt={item.name}
                      style={{ width: '60px', height: '70px', objectFit: 'cover', borderRadius: '6px', background: '#f1f5f9' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '10px' }}>
                        {item.size && <span>Size: {item.size}</span>}
                        {item.color && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Color: <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: item.colorHex || item.color, border: '1px solid #cbd5e1' }}></span> {item.color}
                        </span>}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '6px' }}>
                        Qty: {item.quantity} × ₹{item.price}
                      </div>
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '15px' }}>
                      ₹{(item.price || 0) * (item.quantity || 1)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Address and Financials */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                
                {/* Shipping Address */}
                {selectedOrder.shippingAddress && (
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>Delivery Address</h4>
                    <div style={{ fontSize: '13.5px', color: '#0f172a', lineHeight: '1.5' }}>
                      <strong>{selectedOrder.shippingAddress.fullName}</strong><br/>
                      {selectedOrder.shippingAddress.line1}<br/>
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.pincode}<br/>
                      📞 {selectedOrder.shippingAddress.phone}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>Payment Summary</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                      <span>Payment Method</span>
                      <strong style={{ color: '#0f172a' }}>{selectedOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}</strong>
                    </div>
                    <div style={{ width: '100%', height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: '#000' }}>
                      <span>Total Amount</span>
                      <span>₹{selectedOrder.totalAmount || selectedOrder.finalTotal || 0}</span>
                    </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
