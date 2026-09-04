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

// Lazy Loaded Non-Critical & Heavy Routes for Ultra-Fast Initial Load Time
const ShopPage = lazy(() => import('./pages/ShopPage'));
const NewArrivalsPage = lazy(() => import('./pages/NewArrivalsPage'));
const SalePage = lazy(() => import('./pages/SalePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const AccessoriesPage = lazy(() => import('./pages/AccessoriesPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage'));

// Auth Pages (Lazy)
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Profile = lazy(() => import('./pages/Profile'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'));
import ProtectedRoute from './components/auth/ProtectedRoute';

// Admin Dashboards (Heaviest chunks - Isolated via Lazy Loading)
const AdminRoute = lazy(() => import('./components/auth/AdminRoute'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminProductForm = lazy(() => import('./pages/admin/AdminProductForm'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'));
const AdminHomepage = lazy(() => import('./pages/admin/AdminHomepage'));

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


// ErrorBoundary component remains intact



class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("Global Error Caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px', background: '#fef2f2', color: '#991b1b', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>FATAL REACT ERROR ENCOUNTERED:</h2>
          <pre style={{whiteSpace: 'pre-wrap', background: '#fee2e2', padding: '20px', borderRadius: '8px'}}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <p>Please copy/paste the above error to the AI!</p>
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
