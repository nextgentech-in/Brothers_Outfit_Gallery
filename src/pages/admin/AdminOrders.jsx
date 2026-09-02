import { useState, useEffect } from 'react';
import { getAdminOrders, updateOrderStatus } from '../../services/adminService';
import './AdminOrders.css';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.shippingAddress?.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
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
          placeholder="Search by Order ID, Customer Email or Name..." 
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
              <th>STATUS</th>
              <th>DATE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{textAlign: 'center', padding: '40px'}}>Loading orders...</td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr><td colSpan="8" style={{textAlign: 'center', padding: '40px'}}>No orders found.</td></tr>
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
    </div>
  );
}
