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

  // Subscribe to real-time order notifications
  useEffect(() => {
    let previousCount = null;
    const unsubscribe = subscribeAdminNotifications((notifs) => {
      setNotifications(notifs);

      const unread = notifs.filter(n => !n.read);
      // Trigger toast alert if new unread notification arrives
      if (previousCount !== null && unread.length > previousCount && notifs.length > 0) {
        const latest = notifs[0];
        setToastAlert(latest);
        setTimeout(() => setToastAlert(null), 6000);
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
            <strong>NEW ORDER PLACED!</strong>
            <p>{toastAlert.message}</p>
          </div>
          <button className="toast-close" onClick={(e) => { e.stopPropagation(); setToastAlert(null); }}>✕</button>
        </div>
      )}

      {/* Mobile Header Toggle & Topbar */}
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

      {/* Desktop Header Notification Bar */}
      <header className="admin-topbar">
        <div className="admin-topbar-right">
          <div className="admin-notif-container">
            <button className="admin-notif-bell-btn" onClick={handleOpenDropdown}>
              🔔 Orders Alert
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>

            {showNotifDropdown && (
              <div className="admin-notif-dropdown">
                <div className="notif-header">
                  <strong>Notifications ({unreadCount} New)</strong>
                  {unreadCount > 0 && (
                    <button onClick={handleClearAll} className="btn-clear-notifs">
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No notifications yet.</div>
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
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h2 className="admin-sidebar__title">ADMIN PANEL</h2>
        <nav className="admin-sidebar__nav">
          {links.map(link => {
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
          <Link to="/" className="admin-sidebar__link admin-sidebar__exit">
            STOREFRONT
          </Link>
        </nav>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

