import { useState, useEffect } from 'react';
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
    age: userProfile?.age || '',
    addressLine: userProfile?.address?.line1 || '',
    city: userProfile?.address?.city || '',
    state: userProfile?.address?.state || '',
    pincode: userProfile?.address?.pincode || ''
  });

  const loadUserOrders = async () => {
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
  };

  useEffect(() => {
    loadUserOrders();
  }, [currentUser]);

  const [cancellingId, setCancellingId] = useState(null);

  const handleCancelOrder = async (order) => {
    const confirmCancel = window.confirm(`Are you sure you want to cancel Order #${order.id}?`);
    if (!confirmCancel) return;

    setCancellingId(order.id);
    try {
      await cancelUserOrder(order.id, 'Cancelled by customer', order.waybill);
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
        age: Number(formData.age),
        address: addressData
      });

      setMessage('PROFILE UPDATED SUCCESSFULLY');
      setIsEditing(false);
    } catch (err) {
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
                      : new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

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
                                onClick={() => handleCancelOrder(order)}
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
                  <div className="form-group">
                    <label>Age</label>
                    <input type="number" name="age" className="form-input" value={formData.age} onChange={handleChange} required />
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
                      <span className="info-value">{userProfile.fullName}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Email</span>
                      <span className="info-value">{userProfile.email}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Mobile Number</span>
                      <span className="info-value">{userProfile.phone}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Age</span>
                      <span className="info-value">{userProfile.age}</span>
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
    </div>
  );
}
