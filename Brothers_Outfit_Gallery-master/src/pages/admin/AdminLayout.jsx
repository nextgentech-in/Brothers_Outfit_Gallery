import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { subscribeAdminNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../../services/notificationService';
import './AdminLayout.css';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [toastAlert, setToastAlert] = useState(null);

  // Close sidebar on navigation on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  const playAlertSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Audio Context unsupported or blocked
    }
  };

  // Subscribe to real-time order notifications
  useEffect(() => {
    let previousCount = null;
    const unsubscribe = subscribeAdminNotifications((notifs) => {
      setNotifications(notifs);

      const unread = notifs.filter(n => !n.read);
      // Trigger toast alert and audio chime if new unread notification arrives
      if (previousCount !== null && unread.length > previousCount && notifs.length > 0) {
        const latest = notifs[0];
        setToastAlert(latest);
        playAlertSound();
        setTimeout(() => setToastAlert(null), 7000);
      }
      previousCount = unread.length;
    });

    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleOpenDropdown = () => {
    setShowNotifDropdown(!showNotifDropdown);
  };

  const handleClearAll = () => {
    markAllNotificationsAsRead(notifications);
  };

  const handleNotificationClick = (n) => {
    markNotificationAsRead(n.id);
    setShowNotifDropdown(false);
    navigate('/admin/orders');
  };

  const links = [
    { label: '← BACK TO HOME PAGE', to: '/', isHome: true },
    { label: 'Dashboard', to: '/admin' },
    { label: 'Products', to: '/admin/products' },
    { label: 'Orders', to: '/admin/orders' },
    { label: 'Customers', to: '/admin/customers' },
    { label: 'Inventory', to: '/admin/inventory' },
    { label: 'Reviews', to: '/admin/reviews' },
    { label: 'Coupons', to: '/admin/coupons' },
    { label: 'Homepage', to: '/admin/homepage' },
    { label: 'Settings', to: '/admin/settings' },
  ];

  return (
    <div className="admin-layout">
      {/* Toast Alert popup for New Orders */}
      {toastAlert && (
        <div className="admin-toast-alert" onClick={() => { navigate('/admin/orders'); setToastAlert(null); }}>
          <div className="toast-icon">🔔</div>
          <div className="toast-content">
            <strong>🚨 NEW ORDER RECEIVED!</strong>
            <p>{toastAlert.message}</p>
          </div>
          <button className="toast-close" onClick={(e) => { e.stopPropagation(); setToastAlert(null); }}>✕</button>
        </div>
      )}

      {/* Mobile Header Toggle */}
      <div className="admin-mobile-header">
        <h2 className="admin-mobile-title">ADMIN PANEL</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="admin-notif-bell" onClick={handleOpenDropdown}>
            🔔 {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <button className="admin-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar__header">
          <h2 className="admin-sidebar__title">ADMIN PANEL</h2>
        </div>
        
        <nav className="admin-sidebar__nav">
          {links.map(link => {
            if (link.isHome) {
              return (
                <Link key={link.label} to={link.to} className="admin-sidebar__link admin-sidebar__home">
                  {link.label}
                </Link>
              );
            }

            const isActive = link.to === '/admin' 
              ? location.pathname === '/admin' // exact match for dashboard
              : location.pathname.startsWith(link.to); // partial match for sub-routes
            
            return (
              <Link 
                key={link.label}
                to={link.to} 
                className={`admin-sidebar__link ${isActive ? 'active' : ''}`}
              >
                {link.label}
                {link.label === 'Orders' && unreadCount > 0 && (
                  <span className="sidebar-orders-badge">{unreadCount}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">
        {/* Inline Header Bar with Order Alert Bell */}
        <div className="admin-inline-header">
          <div className="admin-inline-notif-container">
            <button className="admin-notif-bell-btn" onClick={handleOpenDropdown}>
              🔔 Order Alerts
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>

            {showNotifDropdown && (
              <div className="admin-notif-dropdown">
                <div className="notif-header">
                  <strong>Notifications ({unreadCount} Unread)</strong>
                  {unreadCount > 0 && (
                    <button onClick={handleClearAll} className="btn-clear-notifs">
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No order alerts yet.</div>
                  ) : (
                    notifications.slice(0, 10).map(n => (
                      <div 
                        key={n.id} 
                        className={`notif-item ${n.read ? 'read' : 'unread'}`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="notif-item-title">{n.title}</div>
                        <div className="notif-item-msg">{n.message}</div>
                        <div className="notif-item-time">
                          {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}


