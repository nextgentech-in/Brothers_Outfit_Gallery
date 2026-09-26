import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getAdminOrders, updateOrderStatus, updateOrderShipment, restoreOrderStock } from '../../services/adminService';
import { createDelhiveryShipment, trackDelhiveryShipment, cancelDelhiveryShipment } from '../../services/delhiveryService';
import { fetchAllActiveProducts } from '../../services/productService';
import { useAdminUI } from '../../context/AdminUIContext';
import './AdminOrders.css';

const ADMIN_CANCEL_REASONS = [
  'Out of stock',
  'Customer request',
  'Payment issue / Failed verification',
  'Incorrect order details',
  'Delivery not serviceable to this area',
  'Duplicate order',
  'Pricing error',
  'Fraudulent / Suspicious order',
  'Other'
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [productsMap, setProductsMap] = useState(new Map());
  const [previewImageModal, setPreviewImageModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shippingOrderId, setShippingOrderId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTracking, setActiveTracking] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth <= 768 ? 'cards' : 'table';
  });
  const { showToast, showConfirm } = useAdminUI();

  // Cancellation reason modal state
  const [cancelModal, setCancelModal] = useState({ open: false, order: null });
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCustomReason, setCancelCustomReason] = useState('');

  // Fetch product catalog to guarantee 100% image resolution for every order item
  useEffect(() => {
    let isMounted = true;
    fetchAllActiveProducts().then(prods => {
      if (!isMounted || !Array.isArray(prods)) return;
      const map = new Map();
      prods.forEach(p => {
        if (p.id) map.set(p.id, p);
        if (p.slug) map.set(p.slug.toLowerCase().trim(), p);
        if (p.name) map.set(p.name.toLowerCase().trim(), p);
      });
      setProductsMap(map);
    }).catch(err => {
      console.warn('Could not preload product catalog in admin orders:', err);
    });
    return () => { isMounted = false; };
  }, []);

  const getItemImage = useCallback((item) => {
    if (item.image && typeof item.image === 'string' && item.image.trim()) return item.image;
    if (item.thumbnailUrl && typeof item.thumbnailUrl === 'string' && item.thumbnailUrl.trim()) return item.thumbnailUrl;
    if (Array.isArray(item.images) && item.images.length > 0) {
      const first = item.images[0];
      const url = typeof first === 'string' ? first : first?.url;
      if (url) return url;
    }
    // Catalog lookup fallback by product ID, slug, or name
    const lookupKey = item.productId || item.id || (item.slug && item.slug.toLowerCase().trim()) || (item.name && item.name.toLowerCase().trim());
    if (lookupKey && productsMap.has(lookupKey)) {
      const p = productsMap.get(lookupKey);
      return p.thumbnailUrl || p.image || (p.images && p.images[0]?.url) || (p.images && p.images[0]) || '/images/hero.png';
    }
    return '/images/hero.png';
  }, [productsMap]);

  const formatDisplayOrderId = (id) => {
    if (!id) return '';
    if (id.startsWith('ORD-')) {
      const parts = id.split('-');
      if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
      return id.slice(0, 14);
    }
    return id.length > 12 ? `${id.slice(0, 10)}…` : id;
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const data = await getAdminOrders();
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = async (orderId, newStatus) => {
    await updateOrderStatus(orderId, newStatus);
    fetchOrders();
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(prev => ({ ...prev, status: newStatus }));
    }
  };

  const handleApproveAndShip = async (order) => {
    if (!order.shippingAddress) {
      showToast('Cannot create shipment: Missing delivery address.', 'error');
      return;
    }

    const confirmApprove = await showConfirm({
      title: 'Approve For Delhivery Pickup',
      message: `Schedule courier pickup and notify delivery agent for Order #${order.id}?`,
      confirmText: 'Approve & Schedule',
      cancelText: 'Cancel'
    });
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
        showToast(`Order approved! Delhivery AWB: ${res.waybill}`, 'success', 5000);
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
      showToast(`Failed to approve pickup: ${err.message}`, 'error');
    } finally {
      setShippingOrderId(null);
    }
  };

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
      ? (cancelCustomReason.trim() || 'Other (no details provided)')
      : cancelReason;

    if (!finalReason) {
      showToast('Please select a cancellation reason.', 'warning');
      return;
    }

    setActionLoadingId(order.id);
    closeCancelModal();

    try {
      if (order.waybill) {
        await cancelDelhiveryShipment(order.waybill, finalReason);
      }

      if (order.items && order.items.length > 0) {
        await restoreOrderStock(order.items);
      }

      await updateOrderStatus(order.id, 'Cancelled', {
        cancellationReason: finalReason,
        cancelledBy: 'Admin',
        cancelledAt: new Date()
      });

      showToast(`Order #${order.id} cancelled. Reason: ${finalReason}`, 'info');
      fetchOrders();
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder(prev => ({ ...prev, status: 'Cancelled', cancellationReason: finalReason }));
      }
    } catch (err) {
      showToast(`Failed to cancel order: ${err.message}`, 'error');
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
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <h1 className="admin-title" style={{ margin: 0 }}>Orders Management</h1>
        <a 
          href="https://one.delhivery.com/home" 
          target="_blank" 
          rel="noopener noreferrer"
          className="admin-delhivery-portal-btn"
          title="Open Official Delhivery One Logistics Portal"
        >
          <span style={{ fontSize: '15px' }}>🚚</span> Open Official Delhivery Portal ↗
        </a>
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
        <div className="admin-view-toggle">
          <button 
            type="button" 
            className={`admin-view-tab ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
            title="Card View (best for mobile screens)"
          >
            📱 Cards
          </button>
          <button 
            type="button" 
            className={`admin-view-tab ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Table View"
          >
            📋 Table
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        /* Mobile-Optimized Order Cards View */
        <div className="admin-orders-card-list">
          {loading ? (
            <div className="admin-orders-loading">Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="admin-orders-empty">No orders match the current criteria.</div>
          ) : (
            filteredOrders.map(o => (
              <div key={o.id} className="admin-order-card">
                {/* Header: ID, Date, Amount, Payment Badge */}
                <div className="admin-order-card-header">
                  <div className="admin-order-card-id-block">
                    <span 
                      className="admin-order-card-id"
                      title={`Full Order ID: ${o.id} (Click to copy)`}
                      onClick={() => {
                        navigator.clipboard?.writeText(o.id);
                        showToast(`Copied Order ID #${formatDisplayOrderId(o.id)}`, 'info');
                      }}
                    >
                      #{formatDisplayOrderId(o.id)}
                    </span>
                    <button
                      type="button"
                      className="admin-card-copy-btn"
                      title="Copy full Order ID"
                      onClick={() => {
                        navigator.clipboard?.writeText(o.id);
                        showToast(`Copied Order ID #${formatDisplayOrderId(o.id)}`, 'info');
                      }}
                    >
                      📋
                    </button>
                    <span className="admin-order-card-date">
                      {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('en-IN') : (o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : 'Recent')}
                    </span>
                  </div>
                  <div className="admin-order-card-price-badge">
                    <strong className="admin-order-card-price">₹{o.totalAmount || o.finalTotal || 0}</strong>
                    <span className={`admin-badge admin-badge--${o.paymentStatus === 'Paid' ? 'active' : 'neutral'}`}>
                      {o.paymentStatus || 'Paid'}
                    </span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="admin-order-card-customer">
                  <div className="admin-order-customer-name">
                    👤 {o.shippingAddress?.fullName || 'Guest Customer'}
                  </div>
                  <div className="admin-order-customer-contact">
                    {o.shippingAddress?.phone && (
                      <a href={`tel:${o.shippingAddress.phone}`} className="admin-order-customer-link">
                        📞 {o.shippingAddress.phone}
                      </a>
                    )}
                    {o.userEmail && (
                      <span className="admin-order-customer-email" title={o.userEmail}>
                        ✉️ {o.userEmail}
                      </span>
                    )}
                  </div>
                  {o.shippingAddress?.city && (
                    <div className="admin-order-customer-location">
                      📍 {o.shippingAddress.city}, {o.shippingAddress.state || ''} {o.shippingAddress.pincode ? `(${o.shippingAddress.pincode})` : ''}
                    </div>
                  )}
                </div>

                {/* Items Preview */}
                <div className="admin-order-card-items">
                  {o.items?.map((item, idx) => {
                    const itemImg = getItemImage(item);
                    return (
                      <div key={idx} className="admin-card-item-row">
                        <div 
                          className="admin-item-thumb-box"
                          title="Click to zoom image"
                          onClick={() => setPreviewImageModal({ url: itemImg, name: item.name })}
                        >
                          <img 
                            src={itemImg} 
                            alt={item.name} 
                            className="admin-item-thumbnail" 
                            onError={(e) => { e.target.src = '/images/hero.png'; }}
                          />
                          <span className="admin-item-zoom-hint">🔍</span>
                        </div>
                        <div className="admin-card-item-info">
                          <div className="admin-card-item-title" title={item.name}>{item.name}</div>
                          <div className="admin-item-tags">
                            {item.size && (
                              <span className="admin-item-size-badge">
                                Size: <strong>{item.size}</strong>
                              </span>
                            )}
                            {item.color && item.color !== 'Default' && item.color !== 'Standard' && (
                              <span className="admin-item-color-badge">{item.color}</span>
                            )}
                            <span className="admin-item-qty-tag">×{item.quantity}</span>
                            {item.price && (
                              <span className="admin-item-price-tag">₹{item.price}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Order Status Selector */}
                <div className="admin-order-card-status-row">
                  <label className="admin-order-card-status-label">Order Status:</label>
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
                </div>

                {/* Admin Actions */}
                <div className="admin-order-card-actions">
                  {/* Option 1: Cancel Order */}
                  {o.status !== 'Cancelled' ? (
                    <button
                      onClick={() => openCancelModal(o)}
                      disabled={actionLoadingId === o.id}
                      className="btn-cancel-admin"
                    >
                      {actionLoadingId === o.id ? 'Cancelling...' : '✕ Option 1: Cancel'}
                    </button>
                  ) : (
                    <div className="admin-order-cancelled-indicator">
                      <div className="admin-order-cancelled-title">✕ Cancelled</div>
                      {o.cancellationReason && (
                        <div className="admin-order-cancelled-reason" title={o.cancellationReason}>
                          Reason: {o.cancellationReason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Option 2: Approve for Pickup */}
                  {o.status === 'Cancelled' ? null : o.waybill ? (
                    <div className="admin-order-pickup-scheduled">
                      <span className="pickup-scheduled-title">✓ Pickup Scheduled</span>
                      <span className="pickup-scheduled-awb">AWB: {o.waybill}</span>
                      <button 
                        onClick={() => handleOpenTracking(o.waybill)}
                        className="btn-track-courier-mini"
                      >
                        Track Courier ↗
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleApproveAndShip(o)}
                      disabled={shippingOrderId === o.id}
                      className="btn-approve-ship"
                    >
                      {shippingOrderId === o.id ? 'Manifesting...' : '🚚 Option 2: Approve'}
                    </button>
                  )}

                  <button 
                    onClick={() => setSelectedOrder(o)}
                    className="admin-action-btn edit btn-view-order-details"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Full Table View with smooth horizontal scroll and static controls on mobile */
        <>
          <div className="admin-table-scroll-hint">
            ↔ Swipe sideways to view all columns & admin options
          </div>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '150px', minWidth: '140px' }}>ORDER ID</th>
                  <th style={{ minWidth: '130px', maxWidth: '160px' }}>CUSTOMER</th>
                  <th style={{ minWidth: '175px', maxWidth: '220px' }}>ITEMS & SIZES</th>
                  <th style={{ width: '75px', minWidth: '70px' }}>TOTAL</th>
                  <th style={{ width: '85px', minWidth: '80px' }}>PAYMENT</th>
                  <th style={{ width: '120px', minWidth: '115px' }}>STATUS</th>
                  <th style={{ width: '90px', minWidth: '85px' }}>DATE</th>
                  <th className="admin-controls-th">ADMIN CONTROLS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" style={{textAlign: 'center', padding: '40px'}}>Loading orders...</td></tr>
                ) : filteredOrders.length === 0 ? (
                  <tr><td colSpan="8" style={{textAlign: 'center', padding: '40px'}}>No orders match the current criteria.</td></tr>
                ) : filteredOrders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontSize: '11.5px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span 
                          title={`Full Order ID: ${o.id} (Click to copy)`}
                          onClick={() => {
                            navigator.clipboard?.writeText(o.id);
                            showToast(`Copied Order ID #${formatDisplayOrderId(o.id)}`, 'info');
                          }}
                          style={{ 
                            background: '#f1f5f9', 
                            padding: '4px 8px', 
                            borderRadius: '6px', 
                            fontWeight: '700', 
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer',
                            letterSpacing: '0.3px',
                            display: 'inline-block'
                          }}
                        >
                          #{formatDisplayOrderId(o.id)}
                        </span>
                        <button
                          type="button"
                          title="Copy full Order ID"
                          onClick={() => {
                            navigator.clipboard?.writeText(o.id);
                            showToast(`Copied Order ID #${formatDisplayOrderId(o.id)}`, 'info');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px',
                            fontSize: '11px',
                            lineHeight: 1,
                            opacity: 0.65
                          }}
                        >
                          📋
                        </button>
                      </div>
                    </td>
                    <td style={{ maxWidth: '160px' }}>
                      <div style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.shippingAddress?.fullName}>
                        {o.shippingAddress?.fullName || 'Guest Customer'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.userEmail || o.shippingAddress?.phone}>
                        {o.userEmail || o.shippingAddress?.phone}
                      </div>
                    </td>
                    <td>
                      <div className="admin-items-preview-cell">
                        {o.items?.map((item, idx) => {
                          const itemImg = getItemImage(item);
                          return (
                            <div key={idx} className="admin-items-preview-item">
                              <div 
                                className="admin-item-thumb-box" 
                                title="Click to view full image"
                                onClick={() => setPreviewImageModal({ url: itemImg, name: item.name })}
                              >
                                <img 
                                  src={itemImg} 
                                  alt={item.name} 
                                  className="admin-item-thumbnail" 
                                  onError={(e) => { e.target.src = '/images/hero.png'; }}
                                />
                                <span className="admin-item-zoom-hint" title="Zoom image">🔍</span>
                              </div>
                              <div className="admin-item-details-box">
                                <div className="admin-item-name-text" title={item.name}>
                                  {item.name}
                                </div>
                                <div className="admin-item-tags">
                                  {item.size && (
                                    <span className="admin-item-size-badge">
                                      Size: <strong>{item.size}</strong>
                                    </span>
                                  )}
                                  {item.color && item.color !== 'Default' && item.color !== 'Standard' && (
                                    <span className="admin-item-color-badge">
                                      {item.color}
                                    </span>
                                  )}
                                  <span className="admin-item-qty-tag">
                                    ×{item.quantity}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
                    <td style={{fontSize: '11.5px', whiteSpace: 'nowrap', color: '#475569'}}>
                      {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('en-IN') : (o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : 'Recent')}
                    </td>
                    <td className="admin-controls-td">
                      <div className="admin-controls-box">
                        {/* Option 1: Cancel Order */}
                        {o.status !== 'Cancelled' ? (
                          <button
                            onClick={() => openCancelModal(o)}
                            disabled={actionLoadingId === o.id}
                            className="btn-cancel-admin"
                          >
                            {actionLoadingId === o.id ? 'Cancelling...' : '✕ Option 1: Cancel'}
                          </button>
                        ) : (
                          <div className="admin-order-cancelled-indicator">
                            <div className="admin-order-cancelled-title">✕ Cancelled</div>
                            {o.cancellationReason && (
                              <div className="admin-order-cancelled-reason" title={o.cancellationReason}>
                                Reason: {o.cancellationReason}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Option 2: Approve for Pickup */}
                        {o.status === 'Cancelled' ? null : o.waybill ? (
                          <div className="admin-order-pickup-scheduled">
                            <span className="pickup-scheduled-title">✓ Pickup Scheduled</span>
                            <span className="pickup-scheduled-awb">AWB: {o.waybill}</span>
                            <button 
                              onClick={() => handleOpenTracking(o.waybill)}
                              className="btn-track-courier-mini"
                            >
                              Track Courier ↗
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleApproveAndShip(o)}
                            disabled={shippingOrderId === o.id}
                            className="btn-approve-ship"
                          >
                            {shippingOrderId === o.id ? 'Manifesting...' : '🚚 Option 2: Approve'}
                          </button>
                        )}

                        <button 
                          onClick={() => setSelectedOrder(o)}
                          className="admin-action-btn edit btn-view-order-details"
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
        </>
      )}

      {/* Detailed Order Modal with Line Items and Sizes */}
      {selectedOrder && (
        <div className="tracking-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="order-details-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: '#ffffff', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                📋 Order Details #{selectedOrder.id}
              </h3>
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
                              src={getItemImage(item)}
                              alt={item.name}
                              style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', background: '#f1f5f9', cursor: 'pointer', border: '1px solid #e2e8f0' }}
                              onClick={() => setPreviewImageModal({ url: getItemImage(item), name: item.name })}
                              title="Click to view full image"
                              onError={(e) => { e.target.src = '/images/hero.png'; }}
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
                  {selectedOrder.status === 'Cancelled' && selectedOrder.cancellationReason && (
                    <div style={{ padding: '8px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cancellation Reason</div>
                      <div style={{ fontSize: '13px', color: '#dc2626', fontWeight: '600', marginTop: '2px' }}>{selectedOrder.cancellationReason}</div>
                      {selectedOrder.cancelledBy && <div style={{ fontSize: '10px', color: '#9b1c1c', marginTop: '2px' }}>Cancelled by: {selectedOrder.cancelledBy}</div>}
                    </div>
                  )}
                  {selectedOrder.status !== 'Cancelled' && (
                    <button
                      onClick={() => openCancelModal(selectedOrder)}
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
                  href="https://one.delhivery.com/home" 
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

      {/* Admin Cancel Reason Modal */}
      {cancelModal.open && typeof document !== 'undefined' && createPortal(
        <div className="tracking-modal-overlay" onClick={closeCancelModal}>
          <div className="cancel-reason-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#b91c1c' }}>
              <h3>✕ Cancel Order #{cancelModal.order?.id}</h3>
              <button className="close-btn" onClick={closeCancelModal}>✕</button>
            </div>
            <div className="cancel-reason-body">
              <p className="cancel-reason-desc">Select a reason for cancelling this order. This reason will be visible to the customer.</p>
              <div className="cancel-reason-options">
                {ADMIN_CANCEL_REASONS.map(reason => (
                  <label key={reason} className={`cancel-reason-option ${cancelReason === reason ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="cancelReason"
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
                  className="cancel-reason-textarea"
                  placeholder="Type your specific reason here..."
                  value={cancelCustomReason}
                  onChange={(e) => setCancelCustomReason(e.target.value)}
                  rows={2}
                />
              )}
              <div className="cancel-reason-actions">
                <button className="cancel-reason-btn-secondary" onClick={closeCancelModal}>Go Back</button>
                <button
                  className="cancel-reason-btn-danger"
                  onClick={handleConfirmCancel}
                  disabled={!cancelReason || (cancelReason === 'Other' && !cancelCustomReason.trim())}
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Image Preview Lightbox */}
      {previewImageModal && typeof document !== 'undefined' && createPortal(
        <div className="tracking-modal-overlay" onClick={() => setPreviewImageModal(null)}>
          <div className="admin-image-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🖼️ {previewImageModal.name || 'Product Image Preview'}</h3>
              <button className="close-btn" onClick={() => setPreviewImageModal(null)}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#0f172a' }}>
              <img
                src={previewImageModal.url}
                alt={previewImageModal.name}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                onError={(e) => { e.target.src = '/images/hero.png'; }}
              />
              <p style={{ marginTop: '12px', color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>
                {previewImageModal.name}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
