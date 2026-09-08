import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAdminProducts, getAdminStats, getAdminOrders, seedDemoProducts } from '../../services/adminService';
import { useAdminUI } from '../../context/AdminUIContext';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days'); // 'today' | '7days' | '30days' | 'all'
  const { showToast, showConfirm } = useAdminUI();

  const isDevelopment = Boolean(import.meta.env.DEV);

  const loadData = async () => {
    try {
      setLoading(true);
      const [products, ordersData] = await Promise.all([
        getAdminProducts(),
        getAdminOrders()
      ]);
      const computedStats = await getAdminStats(products);
      setStats(computedStats);
      setOrders(ordersData || []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeed = async () => {
    const confirmed = await showConfirm({
      title: 'Seed Demo Products',
      message: 'This will add sample catalog items to your database. Are you sure you want to proceed?',
      confirmText: 'Seed Catalog',
      cancelText: 'Cancel',
      isDestructive: false
    });

    if (!confirmed) return;

    try {
      setLoading(true);
      await seedDemoProducts();
      await loadData();
      showToast('Dummy products added successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to seed products', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sales Date-Range Analytics
  const salesReport = useMemo(() => {
    if (!orders || orders.length === 0) {
      return { revenue: 0, count: 0, aov: 0, delivered: 0, processing: 0, cancelled: 0 };
    }

    const now = new Date();
    let startTime = new Date(0);

    if (dateRange === 'today') {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateRange === '7days') {
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30days') {
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const filteredOrders = orders.filter(o => {
      let orderDate = null;
      if (o.createdAt?.toDate) orderDate = o.createdAt.toDate();
      else if (o.createdAt) orderDate = new Date(o.createdAt);
      if (!orderDate || isNaN(orderDate.getTime())) return true;
      return orderDate >= startTime;
    });

    let revenue = 0;
    let delivered = 0;
    let processing = 0;
    let cancelled = 0;

    filteredOrders.forEach(o => {
      const status = (o.status || '').toLowerCase();
      const orderTotal = Number(o.total || o.pricing?.total || 0);

      if (status === 'cancelled' || status === 'refunded') {
        cancelled++;
      } else {
        revenue += orderTotal;
        if (status === 'delivered') delivered++;
        else processing++;
      }
    });

    const nonCancelledCount = filteredOrders.length - cancelled;
    const aov = nonCancelledCount > 0 ? Math.round(revenue / nonCancelledCount) : 0;

    return {
      revenue,
      count: filteredOrders.length,
      aov,
      delivered,
      processing,
      cancelled
    };
  }, [orders, dateRange]);

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1 className="admin-title">Overview Dashboard</h1>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Strictly protect Dummy Products - visible ONLY in DEV mode */}
          {isDevelopment && (
            <button 
              type="button" 
              onClick={handleSeed} 
              className="admin-btn-secondary"
              title="Only available in local development"
            >
              + SEED DEMO PRODUCTS (DEV)
            </button>
          )}
          <Link to="/admin/products/new" className="admin-btn-primary">
            + ADD PRODUCT
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-spinner" />
          <p>Loading dashboard statistics...</p>
        </div>
      ) : (
        <>
          {/* Catalog & Operations Stats */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <h3>TOTAL PRODUCTS</h3>
              <p>{stats?.total || 0}</p>
            </div>
            <div className="admin-stat-card">
              <h3>ACTIVE PRODUCTS</h3>
              <p className="success">{stats?.active || 0}</p>
            </div>
            <div className="admin-stat-card">
              <h3>LOW STOCK</h3>
              <p className="warn">{stats?.lowStock || 0}</p>
            </div>
            <div className="admin-stat-card">
              <h3>OUT OF STOCK</h3>
              <p className="danger">{stats?.outOfStock || 0}</p>
            </div>
            <div className="admin-stat-card">
              <h3>ACTIVE SALE PRODUCTS</h3>
              <p className="highlight">{stats?.activeSales || 0}</p>
            </div>
            <div className="admin-stat-card">
              <h3>TOTAL ORDERS</h3>
              <p>{stats?.totalOrders || orders.length || 0}</p>
            </div>
          </div>

          {/* Sales & Date-Range Report Section */}
          <div className="admin-sales-report-card">
            <div className="admin-sales-report-header">
              <div>
                <h2 className="admin-sales-report-title">Sales & Revenue Report</h2>
                <p className="admin-sales-report-subtitle">Real-time breakdown of store income and order fulfillment</p>
              </div>
              <div className="admin-sales-tabs" role="tablist">
                <button
                  type="button"
                  className={`admin-sales-tab ${dateRange === 'today' ? 'active' : ''}`}
                  onClick={() => setDateRange('today')}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`admin-sales-tab ${dateRange === '7days' ? 'active' : ''}`}
                  onClick={() => setDateRange('7days')}
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  className={`admin-sales-tab ${dateRange === '30days' ? 'active' : ''}`}
                  onClick={() => setDateRange('30days')}
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  className={`admin-sales-tab ${dateRange === 'all' ? 'active' : ''}`}
                  onClick={() => setDateRange('all')}
                >
                  All Time
                </button>
              </div>
            </div>

            <div className="admin-sales-report-grid">
              <div className="admin-sales-metric admin-sales-metric--revenue">
                <span className="metric-label">TOTAL REVENUE</span>
                <span className="metric-value">₹{salesReport.revenue.toLocaleString('en-IN')}</span>
                <span className="metric-sub">Excludes cancelled orders</span>
              </div>
              <div className="admin-sales-metric">
                <span className="metric-label">ORDERS PLACED</span>
                <span className="metric-value">{salesReport.count}</span>
                <span className="metric-sub">{salesReport.cancelled} cancelled / refunded</span>
              </div>
              <div className="admin-sales-metric">
                <span className="metric-label">AVG. ORDER VALUE</span>
                <span className="metric-value">₹{salesReport.aov.toLocaleString('en-IN')}</span>
                <span className="metric-sub">Per completed order</span>
              </div>
              <div className="admin-sales-metric">
                <span className="metric-label">FULFILLMENT STATUS</span>
                <div className="metric-fulfillment">
                  <span className="fulfillment-tag delivered">✓ {salesReport.delivered} Delivered</span>
                  <span className="fulfillment-tag pending">⏳ {salesReport.processing} In Progress</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
