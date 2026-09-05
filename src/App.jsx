import React, { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useParams, Link, useLocation, Outlet } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ShopProvider } from './context/ShopContext';
import WhatsAppFloat from './components/WhatsAppFloat';

// Critical First-Paint Pages
import HomePage from './pages/HomePage';

// Resilient Lazy Loader with auto-recovery on new deployment chunk updates
function lazyWithRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.warn('Lazy chunk import failed, checking deployment state:', error);
      const isChunkOrCssError = 
        error?.message?.includes('Unable to preload CSS') ||
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.name === 'ChunkLoadError';

      const lastReload = sessionStorage.getItem('chunk_retry_reload');
      const now = Date.now();
      if (isChunkOrCssError && (!lastReload || now - Number(lastReload) > 8000)) {
        sessionStorage.setItem('chunk_retry_reload', String(now));
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });
}

// Lazy Loaded Non-Critical & Heavy Routes for Ultra-Fast Initial Load Time
const ShopPage = lazyWithRetry(() => import('./pages/ShopPage'));
const NewArrivalsPage = lazyWithRetry(() => import('./pages/NewArrivalsPage'));
const SalePage = lazyWithRetry(() => import('./pages/SalePage'));
const AboutPage = lazyWithRetry(() => import('./pages/AboutPage'));
const AccessoriesPage = lazyWithRetry(() => import('./pages/AccessoriesPage'));
const ProductPage = lazyWithRetry(() => import('./pages/ProductPage'));
const CartPage = lazyWithRetry(() => import('./pages/CartPage'));
const CheckoutPage = lazyWithRetry(() => import('./pages/CheckoutPage'));
const OrderConfirmationPage = lazyWithRetry(() => import('./pages/OrderConfirmationPage'));

// Auth Pages (Lazy)
const Login = lazyWithRetry(() => import('./pages/Login'));
const Signup = lazyWithRetry(() => import('./pages/Signup'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const CompleteProfile = lazyWithRetry(() => import('./pages/CompleteProfile'));
import ProtectedRoute from './components/auth/ProtectedRoute';

// Admin Dashboards (Heaviest chunks - Isolated via Lazy Loading)
const AdminRoute = lazyWithRetry(() => import('./components/auth/AdminRoute'));
const AdminLayout = lazyWithRetry(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazyWithRetry(() => import('./pages/admin/AdminProducts'));
const AdminProductForm = lazyWithRetry(() => import('./pages/admin/AdminProductForm'));
const AdminOrders = lazyWithRetry(() => import('./pages/admin/AdminOrders'));
const AdminCustomers = lazyWithRetry(() => import('./pages/admin/AdminCustomers'));
const AdminInventory = lazyWithRetry(() => import('./pages/admin/AdminInventory'));
const AdminCoupons = lazyWithRetry(() => import('./pages/admin/AdminCoupons'));
const AdminSettings = lazyWithRetry(() => import('./pages/admin/AdminSettings'));
const AdminReviews = lazyWithRetry(() => import('./pages/admin/AdminReviews'));
const AdminHomepage = lazyWithRetry(() => import('./pages/admin/AdminHomepage'));

// Elegant Minimalist Route Fallback Loader
function PageLoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      color: '#0f172a',
      fontSize: '14px',
      fontWeight: 600,
      letterSpacing: '1px'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid #e2e8f0',
        borderTopColor: '#0f172a',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite'
      }} />
    </div>
  );
}

// Resilient ErrorBoundary with automatic cache recovery
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }
  static getDerivedStateFromError(error) {
    const msg = error?.message || (typeof error === 'string' ? error : '');
    const isChunkError = 
      msg.includes('Unable to preload CSS') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      error?.name === 'ChunkLoadError';

    return { hasError: true, error, isChunkError };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Global Error Caught:", error, errorInfo);
    const msg = error?.message || '';
    if (
      msg.includes('Unable to preload CSS') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      error?.name === 'ChunkLoadError'
    ) {
      const lastReload = sessionStorage.getItem('eb_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 8000) {
        sessionStorage.setItem('eb_chunk_reload', String(now));
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70vh',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'var(--font-body, system-ui, sans-serif)'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#0f172a',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
              marginBottom: '20px'
            }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Updating to latest version...
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '380px', marginBottom: '20px' }}>
              A newer version of Brothers Outfit was just deployed. Refreshing automatically.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem('eb_chunk_reload');
                window.location.reload();
              }}
              style={{
                background: '#0f172a',
                color: '#fff',
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Refresh Now
            </button>
          </div>
        );
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'var(--font-body, system-ui, sans-serif)'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '400px', marginBottom: '20px' }}>
            Please try refreshing the page. If the issue persists, our support team is available.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#0f172a',
              color: '#fff',
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteLayout() {
  const location = useLocation();
  return (
    <>
      <ScrollToTop />
      <div key={location.pathname} className="page-transition">
        <Suspense fallback={<PageLoadingFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </>
  );
}


function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <>
      {!isAdmin && <Navbar />}
      <main>
        <Routes>
          <Route element={<RouteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/new-arrivals" element={<NewArrivalsPage />} />
            <Route path="/accessories" element={<AccessoriesPage />} />
            <Route path="/sale" element={<SalePage />} />

            <Route path="/about" element={<AboutPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
            
            {/* Standard Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Protected Logged-in specific routes */}
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/complete-profile" element={
              <ProtectedRoute>
                <CompleteProfile />
              </ProtectedRoute>
            } />
            
            <Route path="/product/:slug" element={<ProductPage />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminRoute><AdminLayout /></AdminRoute>
            </Suspense>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/:id/edit" element={<AdminProductForm />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="homepage" element={<AdminHomepage />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="reviews" element={<AdminReviews />} />
          </Route>

        </Routes>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <WhatsAppFloat />}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <ShopProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </ShopProvider>
        </CartProvider>
      </AuthProvider>
      <Analytics />
    </ErrorBoundary>
  );
}

export default App;
