import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderById } from '../services/orderService';
import './OrderConfirmationPage.css';

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!orderId) return;
      const data = await getOrderById(orderId);
      setOrder(data);
      setLoading(false);
    }
    load();
  }, [orderId]);

  if (loading) {
    return <div style={{ padding: '80px', textAlign: 'center' }}>Loading Order Confirmation...</div>;
  }

  return (
    <div className="order-confirm-container">
      <div className="order-confirm-card">
        <div className="success-icon">✓</div>
        <h1>ORDER CONFIRMED!</h1>
        <p className="order-id-badge">Order ID: #{orderId}</p>

        <p className="thank-you-msg">
          Thank you for shopping with Brothers Outfit Gallery! We have received your order and are preparing it for shipment.
        </p>

        {order && (
          <div className="order-details-box">
            <h3>Order Summary</h3>
            <div className="order-info-row">
              <span>Payment Status:</span>
              <strong style={{ color: '#22c55e' }}>{order.paymentStatus || 'Paid'}</strong>
            </div>
            <div className="order-info-row">
              <span>Payment Method:</span>
              <strong>{order.paymentMethod || 'Online Payment'}</strong>
            </div>
            <div className="order-info-row">
              <span>Total Amount Paid:</span>
              <strong>₹{order.totalAmount || order.finalTotal}</strong>
            </div>
            <div className="order-info-row">
              <span>Delivery Address:</span>
              <span>{order.shippingAddress?.fullName}, {order.shippingAddress?.addressLine}, {order.shippingAddress?.city} - {order.shippingAddress?.pincode}</span>
            </div>
          </div>
        )}

        <div className="confirm-actions">
          <Link to="/shop" className="btn-auth-primary" style={{ width: 'auto' }}>
            CONTINUE SHOPPING →
          </Link>
          <Link to="/profile" className="btn-secondary" style={{ width: 'auto' }}>
            VIEW MY PROFILE & ORDERS
          </Link>
        </div>
      </div>
    </div>
  );
}
