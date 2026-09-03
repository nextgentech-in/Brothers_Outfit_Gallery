import { useState, useEffect } from 'react';
import { getAdminOrders, updateOrderStatus, updateOrderShipment } from '../../services/adminService';
import { createDelhiveryShipment, trackDelhiveryShipment, cancelDelhiveryShipment } from '../../services/delhiveryService';
import './AdminOrders.css';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shippingOrderId, setShippingOrderId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTracking, setActiveTracking] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(prev => ({ ...prev, status: newStatus }));
    }
  };

  const handleApproveAndShip = async (order) => {
    if (!order.shippingAddress) {
      alert('Cannot create shipment: Missing delivery address.');
      return;
    }

    const confirmApprove = window.confirm(
      `APPROVE FOR DELIVERY PICKUP:\n\nSchedule Delhivery courier pickup and dispatch notification to delivery agent for Order #${order.id}?`
    );
    if (!confirmApprove) return;

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
        const shipmentData = {
          ...res,
          status: 'Shipped',
          pickupAgentStatus: 'Notified - Assigned for Courier Pickup',
          pickupAgentNotified: true,
          pickupDispatchedAt: new Date().toISOString()
        };
        await updateOrderShipment(order.id, shipmentData);
        alert(
          `✓ ORDER APPROVED FOR PICKUP!\n\n` +
          `• Delhivery AWB: ${res.waybill}\n` +
          `• Courier: Delhivery Express\n` +
          `• Notification: Delhivery delivery agent notified for store pickup.\n` +
          `• Order Status: Shipped`
        );
        fetchOrders();
        if (selectedOrder && selectedOrder.id === order.id) {
          setSelectedOrder(prev => ({
            ...prev,
            status: 'Shipped',
            waybill: res.waybill,
            pickupAgentStatus: 'Notified - Assigned for Courier Pickup',
            pickupAgentNotified: true
          }));
        }
      }
    } catch (err) {
      alert(`Failed to approve pickup: ${err.message}`);
    } finally {
      setShippingOrderId(null);
    }
  };

  const handleCancelOrder = async (order) => {
    const confirmCancel = window.confirm(`Are you sure you want to cancel Order #${order.id}? This will also cancel the delivery pickup if scheduled.`);
    if (!confirmCancel) return;

    setActionLoadingId(order.id);
    try {
      if (order.waybill) {
        await cancelDelhiveryShipment(order.waybill, 'Cancelled by Admin');
      }

      await updateOrderStatus(order.id, 'Cancelled', {
        cancellationReason: 'Cancelled by Store Admin',
        cancelledAt: new Date()
      });

      alert(`Order #${order.id} has been cancelled successfully.`);
      fetchOrders();
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder(prev => ({ ...prev, status: 'Cancelled' }));
      }
    } catch (err) {
      alert(`Failed to cancel order: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenTracking = async (waybill) => {
    const trackingData = await trackDelhiveryShipment(waybill);
    setActiveTracking(trackingData);
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
              <th>ITEMS & SIZES</th>
              <th>TOTAL</th>
              <th>PAYMENT</th>
              <th>STATUS</th>
              <th>DATE</th>
              <th style={{ minWidth: '190px' }}>ADMIN CONTROLS (2 OPTIONS)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{textAlign: 'center', padding: '40px'}}>Loading orders...</td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr><td colSpan="8" style={{textAlign: 'center', padding: '40px'}}>No orders match the current criteria.</td></tr>
            ) : filteredOrders.map(o => (
              <tr key={o.id}>
                <td>
                  <strong>#{o.id}</strong>
                </td>
                <td>
                  <div style={{ fontWeight: '600' }}>{o.shippingAddress?.fullName || 'Guest Customer'}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>{o.userEmail || o.shippingAddress?.phone}</div>
                </td>
                <td>
                  <div className="admin-items-preview-cell">
                    {o.items?.map((item, idx) => (
                      <div key={idx} className="admin-items-preview-item">
                        <span style={{ fontWeight: '600', color: '#0f172a' }}>{item.name}</span>
                        {item.size && <span className="admin-item-size-badge">Size: {item.size}</span>}
                        <span style={{ color: '#64748b', fontSize: '11px' }}> (×{item.quantity})</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td><strong>₹{o.totalAmount || o.finalTotal || 0}</strong></td>
                <td>
                  <span className={`admin-badge admin-badge--${o.paymentStatus === 'Paid' ? 'active' : 'neutral'}`}>
                    {o.paymentStatus || 'Paid'}
                  </span>
                </td>
                <td>
                  <select 
                    value={o.status || 'Processing'} 
                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    className="admin-status-dropdown"
                    style={{
                      borderColor: o.status === 'Cancelled' ? '#f87171' : (o.status === 'Delivered' ? '#4ade80' : '#cbd5e1')
                    }}
                  >
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </td>
                <td style={{fontSize: '12px', whiteSpace: 'nowrap'}}>
                  {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('en-IN') : new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN')}
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Option 1: Cancel Order */}
                    {o.status !== 'Cancelled' ? (
                      <button
                        onClick={() => handleCancelOrder(o)}
                        disabled={actionLoadingId === o.id}
                        className="btn-cancel-admin"
                        style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fca5a5',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        {actionLoadingId === o.id ? 'Cancelling...' : '✕ Option 1: Cancel Order'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700' }}>❌ Cancelled</span>
                    )}

                    {/* Option 2: Approve for Pickup */}
                    {o.status === 'Cancelled' ? null : o.waybill ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: '#f0fdf4', padding: '6px 8px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                        <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '800' }}>
                          ✓ Pickup Scheduled
                        </span>
                        <span style={{ fontSize: '10.5px', color: '#166534' }}>
                          AWB: {o.waybill}
                        </span>
                        <span style={{ fontSize: '10px', color: '#16a34a' }}>
                          📢 Delivery Agent Notified
                        </span>
                        <button 
                          onClick={() => handleOpenTracking(o.waybill)}
                          style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10.5px', cursor: 'pointer', fontWeight: '700', marginTop: '2px' }}
                        >
                          Track Courier ↗
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleApproveAndShip(o)}
                        disabled={shippingOrderId === o.id}
                        className="btn-approve-ship"
                        style={{
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                        }}
                      >
                        {shippingOrderId === o.id ? 'Manifesting...' : '🚚 Option 2: Approve for Pickup'}
                      </button>
                    )}

                    <button 
                      onClick={() => setSelectedOrder(o)}
                      className="admin-action-btn edit"
                      style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '600', textAlign: 'center' }}
                    >
                      View Details
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detailed Order Modal with Line Items and Sizes */}
      {selectedOrder && (
        <div className="tracking-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="order-details-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Order Details #{selectedOrder.id}</h3>
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>

            <div className="order-details-modal-body">
              {/* Status and Summary Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Order Status</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: selectedOrder.status === 'Cancelled' ? '#dc2626' : (selectedOrder.status === 'Delivered' ? '#16a34a' : '#0f172a') }}>
                    {selectedOrder.status || 'Processing'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Total Amount</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    ₹{selectedOrder.totalAmount || selectedOrder.finalTotal || 0}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Payment Method</div>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>
                    {selectedOrder.paymentMethod || 'Online'} ({selectedOrder.paymentStatus || 'Paid'})
                  </div>
                </div>
              </div>

              {/* Customer & Delivery Address */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Customer & Shipping Address
                </h4>
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                  <strong>{selectedOrder.shippingAddress?.fullName}</strong> ({selectedOrder.userEmail})<br />
                  📞 Phone: <strong>{selectedOrder.shippingAddress?.phone}</strong><br />
                  📍 {selectedOrder.shippingAddress?.addressLine}, {selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.state} - <strong>{selectedOrder.shippingAddress?.pincode}</strong>
                </div>
              </div>

              {/* Items Breakdown with Image & SIZES */}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Ordered Items ({selectedOrder.items?.length || 0})
                </h4>
                <table className="order-items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Size</th>
                      <th>Color</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img
                              src={item.thumbnailUrl || item.image || (item.images && item.images[0]?.url) || (item.images && item.images[0]) || '/images/hero.png'}
                              alt={item.name}
                              style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', background: '#f1f5f9' }}
                            />
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>{item.name}</span>
                          </div>
                        </td>
                        <td>
                          {item.size ? (
                            <span style={{ background: '#0f172a', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '11px' }}>
                              {item.size}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>One Size</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#475569' }}>
                            {item.color || 'Standard'}
                          </span>
                        </td>
                        <td><strong>{item.quantity}</strong></td>
                        <td>₹{item.price}</td>
                        <td><strong>₹{(item.price || 0) * (item.quantity || 1)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Delhivery AWB & Pickup Section */}
              <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    DELHIVERY COURIER PICKUP & DISPATCH
                  </div>
                  {selectedOrder.waybill ? (
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#14532d', marginTop: '2px' }}>
                        AWB / Waybill: {selectedOrder.waybill}
                      </div>
                      <div style={{ fontSize: '11px', color: '#15803d', marginTop: '3px' }}>
                        📢 Delhivery agent has been scheduled and notified for store pickup.
                      </div>
                    </div>
                  ) : selectedOrder.status === 'Cancelled' ? (
                    <div style={{ fontSize: '13px', color: '#b91c1c', fontWeight: '700', marginTop: '2px' }}>
                      Order is Cancelled. No pickup will be scheduled.
                    </div>
                  ) : (
                    <div style={{ fontSize: '12.5px', color: '#4d7c0f', marginTop: '2px' }}>
                      Ready for courier pickup. Click <strong>"Option 2: Approve for Pickup"</strong> to dispatch.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {selectedOrder.waybill ? (
                    <button
                      onClick={() => handleOpenTracking(selectedOrder.waybill)}
                      style={{ padding: '8px 14px', background: '#15803d', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Track Shipment Live ↗
                    </button>
                  ) : selectedOrder.status !== 'Cancelled' && (
                    <button
                      onClick={() => handleApproveAndShip(selectedOrder)}
                      disabled={shippingOrderId === selectedOrder.id}
                      style={{ padding: '9px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)' }}
                    >
                      {shippingOrderId === selectedOrder.id ? 'MANIFESTING...' : '🚚 Option 2: Approve for Pickup'}
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                <div>
                  {selectedOrder.status !== 'Cancelled' && (
                    <button
                      onClick={() => handleCancelOrder(selectedOrder)}
                      disabled={actionLoadingId === selectedOrder.id}
                      style={{ padding: '8px 16px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      {actionLoadingId === selectedOrder.id ? 'Cancelling...' : '✕ Option 1: Cancel Order'}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedOrder(null)}
                  style={{ padding: '8px 20px', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
