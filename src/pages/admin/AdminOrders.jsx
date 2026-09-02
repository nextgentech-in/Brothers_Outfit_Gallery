import { useState, useEffect } from 'react';
import { getAdminOrders, updateOrderStatus, updateOrderShipment } from '../../services/adminService';
import { createDelhiveryShipment, trackDelhiveryShipment } from '../../services/delhiveryService';
import './AdminOrders.css';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shippingOrderId, setShippingOrderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTracking, setActiveTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const data = await getAdminOrders();
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    await updateOrderStatus(orderId, newStatus);
    fetchOrders();
  };

  const handleCreateShipment = async (order) => {
    if (!order.shippingAddress) {
      alert('Cannot create shipment: Missing delivery address.');
      return;
    }

    setShippingOrderId(order.id);
    try {
      const res = await createDelhiveryShipment({
        orderId: order.id,
        shippingAddress: order.shippingAddress,
        items: order.items || [],
        totalAmount: order.totalAmount || order.finalTotal || 0,
        paymentMethod: order.paymentMethod || 'Prepaid'
      });

      if (res && res.waybill) {
        await updateOrderShipment(order.id, res);
        alert(`Success! Delhivery AWB Created: ${res.waybill}`);
        fetchOrders();
      }
    } catch (err) {
      alert(`Failed to create Delhivery shipment: ${err.message}`);
    } finally {
      setShippingOrderId(null);
    }
  };

  const handleOpenTracking = async (waybill) => {
    setTrackingLoading(true);
    const trackingData = await trackDelhiveryShipment(waybill);
    setActiveTracking(trackingData);
    setTrackingLoading(false);
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.shippingAddress?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.waybill?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-orders-page">
      <div className="admin-header">
        <h1 className="admin-title">Orders Management</h1>
      </div>

      <div className="admin-orders-controls">
        <input 
          type="text" 
          placeholder="Search by Order ID, Email, Name or Waybill..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="admin-search-input"
        />
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-filter-select"
        >
          <option value="ALL">All Statuses</option>
          <option value="Processing">Processing</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ORDER ID</th>
              <th>CUSTOMER</th>
              <th>ITEMS</th>
              <th>TOTAL</th>
              <th>PAYMENT</th>
              <th>DELHIVERY LOGISTICS</th>
              <th>STATUS</th>
              <th>DATE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{textAlign: 'center', padding: '40px'}}>Loading orders...</td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr><td colSpan="9" style={{textAlign: 'center', padding: '40px'}}>No orders found.</td></tr>
            ) : filteredOrders.map(o => (
              <tr key={o.id}>
                <td>
                  <strong>#{o.id.substring(0, 10)}</strong>
                </td>
                <td>
                  <div>{o.shippingAddress?.fullName || 'N/A'}</div>
                  <div style={{fontSize: '12px', color: '#666'}}>{o.userEmail || o.shippingAddress?.phone}</div>
                </td>
                <td>{o.items?.length || 0} items</td>
                <td><strong>₹{o.totalAmount || o.finalTotal || 0}</strong></td>
                <td>
                  <span className={`admin-badge admin-badge--${o.paymentStatus === 'Paid' ? 'active' : 'neutral'}`}>
                    {o.paymentStatus || 'Paid (Razorpay)'}
                  </span>
                </td>
                <td>
                  {o.waybill ? (
                    <div className="delhivery-admin-cell">
                      <span className="waybill-tag">📦 AWB: {o.waybill}</span>
                      <button 
                        onClick={() => handleOpenTracking(o.waybill)}
                        className="btn-track-mini"
                      >
                        Track Status
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCreateShipment(o)}
                      disabled={shippingOrderId === o.id}
                      className="btn-ship-delhivery"
                    >
                      {shippingOrderId === o.id ? 'MANIFESTING...' : '✈ Ship via Delhivery'}
                    </button>
                  )}
                </td>
                <td>
                  <select 
                    value={o.status || 'Processing'} 
                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    className="admin-status-dropdown"
                  >
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </td>
                <td style={{fontSize: '12px'}}>
                  {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : new Date(o.createdAt || Date.now()).toLocaleDateString()}
                </td>
                <td>
                  <button 
                    onClick={() => alert(`Address: ${o.shippingAddress?.addressLine}, ${o.shippingAddress?.city}, ${o.shippingAddress?.pincode}\nPhone: ${o.shippingAddress?.phone}`)}
                    className="admin-action-btn edit"
                  >
                    DETAILS
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tracking Modal */}
      {activeTracking && (
        <div className="tracking-modal-overlay" onClick={() => setActiveTracking(null)}>
          <div className="tracking-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📦 Delhivery Express Tracking</h3>
              <button className="close-btn" onClick={() => setActiveTracking(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="tracking-meta-grid">
                <div>
                  <span className="meta-label">Waybill / AWB:</span>
                  <strong>{activeTracking.waybill}</strong>
                </div>
                <div>
                  <span className="meta-label">Status:</span>
                  <strong style={{ color: '#16a34a' }}>{activeTracking.status}</strong>
                </div>
                <div>
                  <span className="meta-label">Location:</span>
                  <span>{activeTracking.statusLocation || 'Central Hub'}</span>
                </div>
                <div>
                  <span className="meta-label">Courier:</span>
                  <span>Delhivery Express</span>
                </div>
              </div>

              {activeTracking.events && activeTracking.events.length > 0 && (
                <div className="tracking-timeline">
                  <h4>Shipment Trajectory</h4>
                  {activeTracking.events.map((evt, idx) => (
                    <div key={idx} className="timeline-item">
                      <div className="timeline-dot"></div>
                      <div className="timeline-content">
                        <strong>{evt.title}</strong>
                        <span>{evt.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-footer-actions">
                <a 
                  href={activeTracking.trackingUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-external-track"
                >
                  Open Official Delhivery Portal ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

