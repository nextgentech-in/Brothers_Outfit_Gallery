import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { getUserOrders } from '../services/orderService';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/apiConfig';
import {
  INTERNAL_STATUS,
  TIMELINE_MILESTONES,
  normalizeShipmentStatus,
  calculateTimelineStep,
  formatDeliveryTimestamp
} from '../utils/shipmentStatus';
import SEO from '../components/common/SEO';
import './TrackOrderPage.css';

function formatClientOrder(order) {
  const normStatus = normalizeShipmentStatus(order.shipmentStatus || order.status, order.rawProviderStatusCode);
  const isDelivered = normStatus === INTERNAL_STATUS.DELIVERED || String(order.status || '').toLowerCase() === 'delivered';
  const isOutOfDelivery = normStatus === INTERNAL_STATUS.OUT_FOR_DELIVERY || String(order.status || '').toLowerCase().includes('out for delivery');
  const effectiveStatus = isDelivered ? 'Delivered' : (isOutOfDelivery ? 'Out for Delivery' : (order.status || 'Processing'));
  const deliveredAt = order.deliveredAt?.toDate 
    ? order.deliveredAt.toDate().toISOString() 
    : (typeof order.deliveredAt === 'string' ? order.deliveredAt : null);

  return {
    id: order.id,
    status: effectiveStatus,
    shipmentStatus: normStatus,
    rawProviderStatus: order.rawProviderStatus || effectiveStatus,
    rawProviderStatusCode: order.rawProviderStatusCode || null,
    deliveredAt: deliveredAt,
    latestScan: order.latestScan || null,
    timelineStep: isDelivered ? 5 : (isOutOfDelivery ? 4 : calculateTimelineStep(normStatus)),
    isDelivered: isDelivered,
    isOutOfDelivery: isOutOfDelivery,
    waybill: order.waybill || null,
    courier: order.courier || 'Delhivery Express',
    trackingUrl: order.trackingUrl || (order.waybill ? `https://www.delhivery.com/track/package/${order.waybill}` : null),
    statusLocation: order.statusLocation || order.latestScan?.location || null,
    expectedDeliveryDate: order.expectedDeliveryDate || null,
    scans: order.scans || (order.latestScan ? [order.latestScan] : []),
    createdAt: order.createdAt?.toDate ? order.createdAt.toDate().toISOString() : (typeof order.createdAt === 'string' ? order.createdAt : new Date().toISOString()),
    shippedAt: order.shippedAt?.toDate ? order.shippedAt.toDate().toISOString() : (typeof order.shippedAt === 'string' ? order.shippedAt : null),
    totalAmount: order.totalAmount || order.finalTotal || 0,
    paymentMethod: order.paymentMethod || 'Online',
    paymentStatus: order.paymentStatus || 'Paid',
    pickupAgentStatus: order.pickupAgentStatus || null,
    shippingAddress: {
      fullName: order.shippingAddress?.fullName || 'Valued Customer',
      city: order.shippingAddress?.city || '',
      state: order.shippingAddress?.state || '',
      pincode: order.shippingAddress?.pincode || '',
      phone: order.shippingAddress?.phone ? `${order.shippingAddress.phone.slice(0, 3)}****${order.shippingAddress.phone.slice(-3)}` : ''
    },
    items: (order.items || []).map(item => ({
      name: item.name || 'Outfit Item',
      size: item.size || item.selectedSize || 'One Size',
      color: item.color || item.selectedColor || 'Default',
      quantity: item.quantity || 1,
      price: item.price || 0,
      image: item.image || item.thumbnailUrl || (item.images && item.images[0]?.url) || (item.images && item.images[0]) || '/images/hero.png'
    }))
  };
}

export default function TrackOrderPage() {
  const { orderId: paramOrderId } = useParams();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || paramOrderId || '';

  const [query, setQuery] = useState(queryParam);
  const [loading, setLoading] = useState(false);
  const [refreshingOrderId, setRefreshingOrderId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const { currentUser } = useAuth() || {};

  const performTrack = useCallback(async (searchQuery, isManualRefresh = false) => {
    const clean = String(searchQuery || '').trim();
    if (!clean) {
      setError('Please enter your Order ID, Mobile Number, or Delhivery Waybill number.');
      return;
    }

    if (!isManualRefresh) {
      setLoading(true);
      setError(null);
      setSearched(true);
    }

    let foundOrders = null;
    let serverErrorMessage = null;

    // 1. Try Backend API first
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: clean })
      });

      let data = null;
      try {
        const text = await res.text();
        if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
          data = JSON.parse(text);
        }
      } catch (_) {
        // Safe catch: non-JSON response body will not crash with SyntaxError
      }

      if (res.ok && data?.orders && data.orders.length > 0) {
        foundOrders = data.orders;
      } else if (res.status === 404 && data?.error) {
        serverErrorMessage = data.error;
      }
    } catch (apiErr) {
      console.warn('Backend tracking API call warning:', apiErr.message);
    }

    // 2. Client-side fallback if backend API was unavailable or returned an error
    if (!foundOrders || foundOrders.length === 0) {
      try {
        const fallbackList = [];

        // Check direct Order ID in Firestore
        try {
          const docRef = doc(db, 'orders', clean);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            fallbackList.push(formatClientOrder({ id: snap.id, ...snap.data() }));
          }
        } catch (_) {}

        // Check logged-in user's orders
        if (fallbackList.length === 0 && currentUser?.uid) {
          try {
            const userOrders = await getUserOrders(currentUser.uid, currentUser.email);
            const cleanPhone = clean.replace(/\D/g, '').slice(-10);
            const matched = userOrders.filter(o => 
              o.id?.toLowerCase().includes(clean.toLowerCase()) ||
              o.waybill === clean ||
              (cleanPhone.length === 10 && (
                String(o.shippingAddress?.phone || '').includes(cleanPhone) ||
                String(o.userPhone || '').includes(cleanPhone)
              ))
            );
            matched.forEach(o => fallbackList.push(formatClientOrder(o)));
          } catch (_) {}
        }

        // Check locally saved orders in browser localStorage
        if (fallbackList.length === 0) {
          try {
            const stored = JSON.parse(localStorage.getItem('user_order_ids') || '[]');
            for (const orderId of stored) {
              if (orderId.toLowerCase().includes(clean.toLowerCase()) || clean.toLowerCase().includes(orderId.toLowerCase())) {
                const s = await getDoc(doc(db, 'orders', orderId));
                if (s.exists()) {
                  fallbackList.push(formatClientOrder({ id: s.id, ...s.data() }));
                  break;
                }
              }
            }
          } catch (_) {}
        }

        if (fallbackList.length > 0) {
          foundOrders = fallbackList;
        }
      } catch (fallbackErr) {
        console.warn('Client fallback tracking note:', fallbackErr.message);
      }
    }

    if (foundOrders && foundOrders.length > 0) {
      setOrders(foundOrders);
      setError(null);
    } else {
      if (!isManualRefresh) {
        setOrders([]);
        setError(serverErrorMessage || `No order found matching "${clean}". Please verify your Order ID, Mobile Number, or Delhivery Waybill number.`);
      }
    }

    setLoading(false);
    setRefreshingOrderId(null);
  }, [currentUser]);

  // Auto-track if query param exists or if last_placed_order is in localStorage
  useEffect(() => {
    const initialQuery = queryParam || localStorage.getItem('last_placed_order') || '';
    if (initialQuery) {
      setQuery(initialQuery);
      performTrack(initialQuery);
    }
  }, [queryParam, performTrack]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    performTrack(query);
  };

  const handleManualRefresh = async (order) => {
    if (!order) return;
    setRefreshingOrderId(order.id);
    await performTrack(order.waybill || order.id, true);
  };

  return (
    <div className="track-page-container">
      <SEO title="Track Your Order | Brother’s Outfit Gallery" noindex={true} />
      {/* Hero Header */}
      <div className="track-header-section">
        <span className="track-badge-pill">🚚 LIVE LOGISTICS TRACKING</span>
        <h1 className="track-main-title">Track Your Shipment</h1>
        <p className="track-subtitle">
          Real-time order status and Delhivery Express delivery tracking across India.
        </p>

        {/* Search Bar Form */}
        <form onSubmit={handleSearchSubmit} className="track-search-box">
          <div className="track-input-wrapper">
            <span className="track-search-icon">🔍</span>
            <input
              type="text"
              className="track-search-input"
              placeholder="Enter Order ID (ORD-...), 10-Digit Mobile, or Delhivery AWB..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="track-clear-btn"
                onClick={() => { setQuery(''); setOrders([]); setSearched(false); }}
                title="Clear input"
              >
                ✕
              </button>
            )}
          </div>
          <button type="submit" className="track-submit-btn" disabled={loading}>
            {loading ? 'Tracking...' : 'Track Order →'}
          </button>
        </form>

        <div className="track-hint-row">
          <span>💡 Tip: You can search using your <strong>10-digit mobile number</strong> used during checkout.</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="track-results-wrapper">
        {loading && (
          <div className="track-loading-card">
            <div className="track-spinner" />
            <p>Fetching live tracking data from Brothers Outfit & Delhivery...</p>
          </div>
        )}

        {error && !loading && (
          <div className="track-error-card">
            <div className="track-error-icon">⚠️</div>
            <h3>Shipment Not Found</h3>
            <p>{error}</p>
            <div className="track-error-help">
              Need assistance? WhatsApp our support at <strong>+91 8460233020</strong> with your name and details.
            </div>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="track-orders-list">
            {orders.map((order) => {
              // Normalize status from centralized model
              const normalizedStatus = normalizeShipmentStatus(order.shipmentStatus || order.status, order.rawProviderStatusCode);
              const isDelivered = normalizedStatus === INTERNAL_STATUS.DELIVERED || String(order.status || '').toLowerCase() === 'delivered';
              const isCancelled = normalizedStatus === INTERNAL_STATUS.CANCELLED || String(order.status || '').toLowerCase().includes('cancel');
              const isRTO = normalizedStatus === INTERNAL_STATUS.RTO || String(order.status || '').toLowerCase().includes('rto');
              const isOutOfDelivery = Boolean(
                order.isOutOfDelivery ||
                normalizedStatus === INTERNAL_STATUS.OUT_FOR_DELIVERY ||
                String(order.status || '').toLowerCase().includes('out for delivery') ||
                String(order.shipmentStatus || '').toLowerCase().includes('out_for_delivery') ||
                String(order.status || '').toLowerCase().includes('out_for_delivery')
              );
              
              // Active step: 1 (Placed), 2 (Confirmed), 3 (Shipped), 4 (Out for Delivery), 5 (Delivered)
              const activeStep = isDelivered ? 5 : (isOutOfDelivery ? 4 : calculateTimelineStep(normalizedStatus));
              const formattedDeliveredAt = formatDeliveryTimestamp(order.deliveredAt);
              const isRefreshing = refreshingOrderId === order.id;

              return (
                <div key={order.id} className="track-order-card">
                  {/* Card Top Banner */}
                  <div className="track-card-header">
                    <div className="track-order-meta">
                      <span className="track-order-id-label">ORDER ID</span>
                      <h2 className="track-order-id-val">#{order.id}</h2>
                      <span className="track-order-date">
                        Placed on {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
                      </span>
                    </div>

                    <div className="track-order-status-wrap">
                      <span className={`track-status-pill ${
                        isDelivered 
                          ? 'status-delivered' 
                          : isCancelled 
                          ? 'status-cancelled' 
                          : isRTO 
                          ? 'status-cancelled' 
                          : isOutOfDelivery
                          ? 'status-out-for-delivery'
                          : (activeStep >= 3 ? 'status-shipped' : 'status-processing')
                      }`}>
                        {isCancelled 
                          ? '✕ Cancelled' 
                          : isRTO
                          ? '↩ Returned to Origin'
                          : isDelivered 
                          ? '✓ Delivered' 
                          : isOutOfDelivery
                          ? '⚡ Out for Delivery' 
                          : (order.status === 'Shipped' || normalizedStatus === INTERNAL_STATUS.IN_TRANSIT 
                              ? '🚚 In Transit with Courier' 
                              : (order.status || 'Processing'))}
                      </span>
                      <span className="track-payment-info">
                        ₹{order.totalAmount} • {order.paymentMethod}
                      </span>
                    </div>
                  </div>

                  {/* Live Out for Delivery Alert Banner */}
                  {isOutOfDelivery && !isDelivered && (
                    <div className="track-ofd-banner">
                      <div className="track-ofd-banner-header">
                        <div className="track-ofd-live-tag">
                          <span className="track-ofd-beacon" />
                          LIVE FROM DELHIVERY
                        </div>
                        <span className="track-ofd-eta-chip">⚡ Arriving at Your Doorstep Today</span>
                      </div>
                      <div className="track-ofd-banner-body">
                        <div className="track-ofd-icon-bubble">🛵</div>
                        <div className="track-ofd-details">
                          <h3 className="track-ofd-heading">Aapka Order Aaj Deliver Hone Wala Hai!</h3>
                          <p className="track-ofd-subtext">
                            Delhivery courier delivery agent is out to deliver your package to your doorstep today.
                            {order.statusLocation ? ` Current hub: ${order.statusLocation}.` : ''}
                          </p>
                          <div className="track-ofd-guidelines">
                            <div className="ofd-guide-pill">
                              <span className="guide-icon">📞</span> Keep your phone active for delivery rider call
                            </div>
                            <div className="ofd-guide-pill">
                              <span className="guide-icon">🛡️</span> Share OTP with delivery rider only after receiving parcel
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stepper Timeline (if not cancelled / RTO) */}
                  {!isCancelled && !isRTO && (
                    <div className="track-stepper-box">
                      <div className="track-stepper">
                        {TIMELINE_MILESTONES.map((step, idx) => {
                          const stepNumber = step.step; // 1 to 5
                          const isDone = isDelivered || stepNumber <= activeStep;
                          const isCurrent = !isDelivered && stepNumber === activeStep;
                          const isFinalDelivered = isDelivered && stepNumber === 5;

                          // Show checkmark for ALL completed steps. If Delivered, step 5 also gets ✓!
                          let circleContent;
                          if (isDelivered || (isDone && !isCurrent)) {
                            circleContent = '✓';
                          } else {
                            circleContent = stepNumber;
                          }

                          return (
                            <div 
                              key={step.key} 
                              className={`track-step-item ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''} ${isFinalDelivered ? 'is-delivered-step' : ''}`}
                            >
                              <div className="track-step-circle">
                                {circleContent}
                              </div>
                              <div className="track-step-label">{step.label}</div>
                              <div className="track-step-desc">
                                {stepNumber === 5 && isDelivered && formattedDeliveredAt ? (
                                  <span className="track-delivered-time">{formattedDeliveredAt}</span>
                                ) : (
                                  step.desc
                                )}
                              </div>
                              {idx < TIMELINE_MILESTONES.length - 1 && (
                                <div className={`track-step-line ${(isDelivered || stepNumber < activeStep) ? 'line-done' : ''}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Delhivery Express Shipping Info Bar */}
                  {order.waybill ? (
                    <>
                      <div className="track-delhivery-box">
                        <div className="delhivery-logo-info">
                          <span className="delhivery-badge">DELHIVERY EXPRESS</span>
                          <div className="delhivery-awb-wrap">
                            <span>Tracking AWB: <strong>{order.waybill}</strong></span>
                            {isDelivered && formattedDeliveredAt && (
                              <span className="delhivery-delivered-tag">
                                ✓ Delivered on {formattedDeliveredAt}
                              </span>
                            )}
                            {isOutOfDelivery && !isDelivered && (
                              <span className="delhivery-ofd-tag">
                                ⚡ Out for Delivery Today
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="delhivery-actions-group">
                          <button
                            type="button"
                            className="btn-refresh-tracking"
                            onClick={() => handleManualRefresh(order)}
                            disabled={isRefreshing || isDelivered}
                            title={isDelivered ? 'Delivery confirmed' : 'Refresh live status from Delhivery'}
                          >
                            {isDelivered ? '✓ Confirmed' : (isRefreshing ? '↻ Refreshing...' : '↻ Live Delhivery Refresh')}
                          </button>
                          <a
                            href={order.trackingUrl || `https://www.delhivery.com/track/package/${order.waybill}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-delhivery-live"
                          >
                            Live Delhivery.com ↗
                          </a>
                        </div>
                      </div>

                      {/* Live Scans History from Delhivery */}
                      {Array.isArray(order.scans) && order.scans.length > 0 && (
                        <div className="track-scans-summary">
                          <div className="track-scans-header">
                            <span className="scans-title">📍 Live Delhivery Tracking Activity</span>
                            <span className="scans-count">{order.scans.length} scan events logged</span>
                          </div>
                          <div className="track-scans-feed">
                            {order.scans.slice(0, 3).map((scan, sIdx) => (
                              <div key={sIdx} className={`scan-feed-item ${sIdx === 0 ? 'is-latest' : ''}`}>
                                <div className="scan-bullet" />
                                <div className="scan-content">
                                  <div className="scan-name">
                                    <strong>{scan.title || scan.Instructions || scan.Scan || 'In Transit'}</strong>
                                    {sIdx === 0 && <span className="scan-latest-chip">Latest Scan</span>}
                                  </div>
                                  <div className="scan-location-time">
                                    {scan.location || scan.ScannedLocation ? <span>📍 {scan.location || scan.ScannedLocation}</span> : null}
                                    {scan.time ? <span>🕒 {new Date(scan.time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> : null}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="track-delhivery-pending">
                      <span className="box-icon">📦</span>
                      <div className="box-content">
                        <strong>Preparing for Courier Pickup</strong>
                        <p>Your items are being inspected, packed, and labelled at our Himmatnagar warehouse. Tracking number will be active as soon as Delhivery scans the package.</p>
                      </div>
                    </div>
                  )}

                  {/* Items Summary with Product Photos */}
                  <div className="track-items-section">
                    <h3 className="section-title">Order Items ({order.items?.length || 0})</h3>
                    <div className="track-items-grid">
                      {order.items?.map((item, i) => (
                        <div key={i} className="track-item-card">
                          <img
                            src={item.image || '/images/hero.png'}
                            alt={item.name}
                            className="track-item-img"
                            onError={(e) => { e.target.src = '/images/hero.png'; }}
                          />
                          <div className="track-item-details">
                            <h4 className="track-item-name">{item.name}</h4>
                            <div className="track-item-chips">
                              {item.size && <span className="chip-size">Size: {item.size}</span>}
                              {item.color && item.color !== 'Default' && item.color !== 'Standard' && (
                                <span className="chip-color">{item.color}</span>
                              )}
                              <span className="chip-qty">Qty: {item.quantity}</span>
                            </div>
                            <div className="track-item-price">₹{item.price * item.quantity}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping Address & Help */}
                  <div className="track-card-footer">
                    <div className="track-dest-info">
                      <span className="dest-label">Delivery Destination:</span>
                      <strong>{order.shippingAddress?.fullName}</strong>
                      <span>{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</span>
                    </div>

                    <div className="track-actions-row">
                      <a
                        href={`https://wa.me/918460233020?text=Hello%20Brothers%20Outfit,%20I%20have%20a%20question%20regarding%20my%20Order%20%23${order.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-whatsapp-track"
                      >
                        💬 WhatsApp Support
                      </a>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {!loading && !searched && (
          <div className="track-empty-state">
            <div className="track-empty-icon">📦</div>
            <h3>Enter Your Details Above to Track</h3>
            <p>You can track any order placed on Brothers Outfit by providing your Order ID, registered mobile number, or Delhivery waybill number.</p>
            {currentUser && (
              <Link to="/profile" className="btn-view-profile-orders">
                View All My Orders in Profile →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
