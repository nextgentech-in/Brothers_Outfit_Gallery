import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserOrders, cancelUserOrder } from '../services/orderService';
import './Profile.css';

export default function Profile() {
  const { currentUser, userProfile, logout, updateFirestoreProfile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'orders'
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
      const orders = await getUserOrders(currentUser.uid);
      setUserOrders(orders);
    } catch (e) {
      console.error("Error loading user orders:", e);
    } finally {
      setOrdersLoading(false);
    }
  };

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
                <div className="orders-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                  {userOrders.map(order => {
                    const isProcessing = (order.status || 'Processing') === 'Processing';
                    const isCancelled = order.status === 'Cancelled';
                    const isShipped = order.status === 'Shipped';
                    const isDelivered = order.status === 'Delivered';

                    return (
                      <div key={order.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        {/* Order Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                              Order #{order.id}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              Placed on {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN')}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '800',
                              letterSpacing: '0.5px',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              textTransform: 'uppercase',
                              background: isCancelled ? '#fee2e2' : (isDelivered ? '#dcfce7' : (isShipped ? '#dbeafe' : '#fef3c7')),
                              color: isCancelled ? '#b91c1c' : (isDelivered ? '#15803d' : (isShipped ? '#1d4ed8' : '#b45309')),
                              border: `1px solid ${isCancelled ? '#fca5a5' : (isDelivered ? '#86efac' : (isShipped ? '#93c5fd' : '#fde68a'))}`
                            }}>
                              {order.status || 'Processing'}
                            </span>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                              ₹{order.totalAmount || order.finalTotal || 0}
                            </div>
                          </div>
                        </div>

                        {/* Order Items Breakdown with SIZES */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                          {order.items?.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #edf2f7' }}>
                              <img
                                src={item.thumbnailUrl || item.image || (item.images && item.images[0]?.url) || (item.images && item.images[0]) || '/images/hero.png'}
                                alt={item.name}
                                style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '6px', background: '#e2e8f0', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.name}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                  {item.size && (
                                    <span style={{ fontSize: '11px', fontWeight: '800', background: '#0f172a', color: '#ffffff', padding: '2px 8px', borderRadius: '4px' }}>
                                      Size: {item.size}
                                    </span>
                                  )}
                                  {item.color && (
                                    <span style={{ fontSize: '11px', fontWeight: '600', background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px' }}>
                                      Color: {item.color}
                                    </span>
                                  )}
                                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                                    Qty: {item.quantity} × ₹{item.price}
                                  </span>
                                </div>
                              </div>
                              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', flexShrink: 0 }}>
                                ₹{(item.price || 0) * (item.quantity || 1)}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Delivery Address & Tracking Info */}
                        {order.shippingAddress && (
                          <div style={{ fontSize: '12px', color: '#64748b', background: '#fafafa', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', border: '1px dashed #e2e8f0' }}>
                            <strong style={{ color: '#334155' }}>Deliver to: </strong>
                            {order.shippingAddress.fullName}, {order.shippingAddress.addressLine}, {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode} (📞 {order.shippingAddress.phone})
                          </div>
                        )}

                        {/* Order Actions Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Payment: <strong>{order.paymentMethod || 'Online Payment'}</strong>
                            {order.paymentStatus && <span style={{ marginLeft: '8px', color: '#16a34a', fontWeight: '700' }}>({order.paymentStatus})</span>}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {order.waybill && (
                              <a
                                href={order.trackingUrl || `https://www.delhivery.com/track/package/${order.waybill}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  padding: '7px 14px',
                                  background: '#0f172a',
                                  color: '#ffffff',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                📦 Track Delhivery AWB: {order.waybill}
                              </a>
                            )}

                            {isProcessing && (
                              <button
                                onClick={() => handleCancelOrder(order)}
                                disabled={cancellingId === order.id}
                                style={{
                                  padding: '7px 14px',
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  border: '1px solid #fca5a5',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: cancellingId === order.id ? 'not-allowed' : 'pointer',
                                  transition: 'background 0.2s'
                                }}
                              >
                                {cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}
                              </button>
                            )}

                            {isCancelled && (
                              <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
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
