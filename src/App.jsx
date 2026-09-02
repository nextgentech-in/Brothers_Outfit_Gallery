import React, { Component } from 'react';
import { BrowserRouter, Routes, Route, useParams, Link, useLocation, Outlet } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import Footer from './components/Footer';
import ShopPage from './pages/ShopPage';
import NewArrivalsPage from './pages/NewArrivalsPage';
import SalePage from './pages/SalePage';
import AboutPage from './pages/AboutPage';
import AccessoriesPage from './pages/AccessoriesPage';
import { AuthProvider } from './context/AuthContext';

import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import CompleteProfile from './pages/CompleteProfile';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import { CartProvider } from './context/CartContext';
import { ShopProvider } from './context/ShopContext';
import WhatsAppFloat from './components/WhatsAppFloat';

import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';

import AdminRoute from './components/auth/AdminRoute';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductForm from './pages/admin/AdminProductForm';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminInventory from './pages/admin/AdminInventory';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminSettings from './pages/admin/AdminSettings';
import AdminReviews from './pages/admin/AdminReviews';
import AdminHomepage from './pages/admin/AdminHomepage';

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
        <Outlet />
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
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
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
    </ErrorBoundary>
  );
}

export default App;
