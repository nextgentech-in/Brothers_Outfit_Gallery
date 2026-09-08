import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminProducts, getAdminStats, seedDemoProducts } from '../../services/adminService';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const products = await getAdminProducts();
        const computedStats = await getAdminStats(products);
        setStats(computedStats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const handleSeed = async () => {
    setLoading(true);
    await seedDemoProducts();
    const products = await getAdminProducts();
    const computedStats = await getAdminStats(products);
    setStats(computedStats);
    setLoading(false);
    alert('Dummy Products Added Successfully!');
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1 className="admin-title">Overview Dashboard</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleSeed} className="admin-btn-secondary">
            + SEED DEMO PRODUCTS
          </button>
          <Link to="/admin/products/new" className="admin-btn-primary">
            + ADD PRODUCT
          </Link>
        </div>
      </div>

      {loading ? (
        <p>Loading statistics...</p>
      ) : (
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <h3>TOTAL PRODUCTS</h3>
            <p>{stats?.total}</p>
          </div>
          <div className="admin-stat-card">
            <h3>ACTIVE PRODUCTS</h3>
            <p className="success">{stats?.active}</p>
          </div>
          <div className="admin-stat-card">
            <h3>LOW STOCK</h3>
            <p className="warn">{stats?.lowStock}</p>
          </div>
          <div className="admin-stat-card">
            <h3>OUT OF STOCK</h3>
            <p className="danger">{stats?.outOfStock}</p>
          </div>
          <div className="admin-stat-card">
            <h3>ACTIVE SALE PRODUCTS</h3>
            <p className="highlight">{stats?.activeSales}</p>
          </div>
          <div className="admin-stat-card">
            <h3>TOTAL ORDERS</h3>
            <p>{stats?.totalOrders}</p>
          </div>
        </div>
      )}
    </div>
  );
}
