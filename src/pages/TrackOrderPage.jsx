import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/apiConfig';
import './TrackOrderPage.css';

const STATUS_STEPS = [
  { key: 'placed', label: 'Order Placed', desc: 'Received & Verified' },
  { key: 'packing', label: 'Packing', desc: 'At Himmatnagar Hub' },
  { key: 'dispatched', label: 'Dispatched', desc: 'Handed to Delhivery' },
  { key: 'transit', label: 'In Transit', desc: 'On Route' },
  { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'Arriving Today' },
  { key: 'delivered', label: 'Delivered', desc: 'Package Received' }
];

function getActiveStepIndex(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('cancel')) return -1;
  if (s.includes('deliver')) return 5;
  if (s.includes('out')) return 4;
  if (s.includes('transit')) return 3;
  if (s.includes('ship') || s.includes('manifest')) return 2;
  return 1; // Default processing/packing
}

export default function TrackOrderPage() {
  const { orderId: paramOrderId } = useParams();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || paramOrderId || '';

  const [query, setQuery] = useState(queryParam);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const { currentUser } = useAuth() || {};

  // Auto-track if query param exists or if last_placed_order is in localStorage
  useEffect(() => {
    const initialQuery = queryParam || localStorage.getItem('last_placed_order') || '';
    if (initialQuery) {
      setQuery(initialQuery);
      performTrack(initialQuery);
    }
  }, [queryParam]);

  const performTrack = async (searchQuery) => {
    const clean = String(searchQuery || '').trim();
    if (!clean) {
      setError('Please enter your Order ID, Mobile Number, or Delhivery Waybill number.');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: clean })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No matching order found.');
      }

      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message || 'Unable to track order. Please verify your details.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    performTrack(query);
  };

  return (
    <div className="track-page-container">
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
              const activeStep = getActiveStepIndex(order.status);
              const isCancelled = String(order.status || '').toLowerCase().includes('cancel');

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
                      <span className={`track-status-pill status-${order.status?.toLowerCase()}`}>
                        {isCancelled ? '✕ Cancelled' : (order.status === 'Shipped' ? '🚚 In Transit with Courier' : (order.status || 'Processing'))}
                      </span>
                      <span className="track-payment-info">
                        ₹{order.totalAmount} • {order.paymentMethod}
                      </span>
                    </div>
                  </div>

                  {/* Stepper Timeline (if not cancelled) */}
                  {!isCancelled && (
                    <div className="track-stepper-box">
                      <div className="track-stepper">
                        {STATUS_STEPS.map((step, idx) => {
                          const isDone = idx <= activeStep;
                          const isCurrent = idx === activeStep;
                          return (
                            <div key={step.key} className={`track-step-item ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}>
                              <div className="track-step-circle">
                                {isDone && !isCurrent ? '✓' : idx + 1}
                              </div>
                              <div className="track-step-label">{step.label}</div>
                              <div className="track-step-desc">{step.desc}</div>
                              {idx < STATUS_STEPS.length - 1 && (
                                <div className={`track-step-line ${idx < activeStep ? 'line-done' : ''}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Delhivery Express Shipping Info Bar */}
                  {order.waybill ? (
                    <div className="track-delhivery-box">
                      <div className="delhivery-logo-info">
                        <span className="delhivery-badge">DELHIVERY EXPRESS</span>
                        <div className="delhivery-awb-wrap">
                          <span>Tracking AWB: <strong>{order.waybill}</strong></span>
                        </div>
                      </div>
                      <a
                        href={order.trackingUrl || `https://www.delhivery.com/track/package/${order.waybill}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-delhivery-live"
                      >
                        Live Tracking on Delhivery.com ↗
                      </a>
                    </div>
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
