import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import './AdminLayout.css';

export default function AdminLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on navigation on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

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
      {/* Mobile Header Toggle */}
      <div className="admin-mobile-header">
        <h2 className="admin-mobile-title">ADMIN PANEL</h2>
        <button className="admin-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          ☰
        </button>
      </div>

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
