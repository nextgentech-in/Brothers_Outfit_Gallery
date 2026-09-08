import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useShop } from '../context/ShopContext';
import { searchProducts } from '../services/productService';
import { optimizeImage } from '../utils/imageUtils';
import './Navbar.css';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'New Arrivals', to: '/new-arrivals' },
  { label: 'Accessories', to: '/accessories' },
  { label: 'About Us', to: '/about' },
  { label: 'Sale', to: '/sale' },
];



const announcements = [
  { text: "FREE EXPRESS SHIPPING ON ALL ORDERS ABOVE ₹999", link: "/shop" },
  { text: "USE CODE BROTHERS10 FOR 10% OFF YOUR ORDER", link: "/shop" },
  { text: "VISIT OUR STORE IN HIMATNAGAR • TRY BEFORE YOU BUY", link: "/about" }
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth() || {};
  const { totalItems, openCartDrawer } = useCart() || { totalItems: 0 };
  const { wishlistCount } = useWishlist() || { wishlistCount: 0 };
  const { resetShopState, setSearch } = useShop() || {};

  // Live search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Debounced search querying active catalog
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchProducts(searchQuery, 6);
        setSearchResults(results);
      } catch (err) {
        console.warn('Live search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setSearchOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        const target = searchResults[selectedIndex];
        setSearchOpen(false);
        navigate(`/product/${target.slug}`);
      } else {
        const val = searchQuery.trim();
        if (val) {
          setSearchOpen(false);
          if (setSearch) setSearch(val);
          navigate('/shop');
        }
      }
    }
  };

  const handleLogout = async () => {
    try {
      if (logout) await logout();
      setMobileOpen(false);
      navigate('/');
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Rotate announcement ticker every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setAnnouncementIdx((prev) => (prev + 1) % announcements.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const authAccountLink = currentUser ? '/profile' : '/login';

  const desktopLinks = [...navLinks];
  if (userProfile?.isAdmin) {
    desktopLinks.push({ label: 'ADMIN', to: '/admin' });
  }

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 40);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Global Escape key dismiss for search overlay and mobile menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
        if (mobileOpen) setMobileOpen(false);
      }
    };
    if (searchOpen || mobileOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [searchOpen, mobileOpen]);

  return (
    <>
      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        {/* Luxury Top Announcement Bar */}
        <div className="top-announcement-bar">
          <Link to={announcements[announcementIdx].link} className="top-announcement-bar__link">
            <span className="announcement-pill">OFFER</span>
            <span className="announcement-text">{announcements[announcementIdx].text}</span>
            <span className="announcement-arrow">SHOP NOW →</span>
          </Link>
        </div>

        <div className="navbar__inner">
          {/* Mobile hamburger */}
          <button
            className="navbar__hamburger"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span className={`navbar__hamburger-line ${mobileOpen ? 'open' : ''}`} />
            <span className={`navbar__hamburger-line ${mobileOpen ? 'open' : ''}`} />
            <span className={`navbar__hamburger-line ${mobileOpen ? 'open' : ''}`} />
          </button>

          {/* Exact Brand Logo SVG */}
          <Link to="/" className="navbar__logo">
            <svg className="navbar__logo-svg" viewBox="0 0 250 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* B Icon */}
              <path d="M 14 10 h 14 a 9 9 0 0 1 0 18 h -14 z" stroke="#B88A2E" strokeWidth="2.5" />
              <path d="M 14 32 h 14 a 9 9 0 0 1 0 18 h -14 z" stroke="#B88A2E" strokeWidth="2.5" />
              {/* Vertical Separator */}
              <line x1="42" y1="10" x2="42" y2="50" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.8" />
              {/* Text */}
              <text x="56" y="33" fill="currentColor" fontFamily="inherit" fontSize="23.5" fontWeight="400" letterSpacing="3">BROTHER'S</text>
              <text x="60" y="49" fill="currentColor" fillOpacity="0.8" fontFamily="inherit" fontSize="9.5" fontWeight="500" letterSpacing="4.5">OUTFIT GALLERY</text>
            </svg>
          </Link>

          {/* Desktop Nav Links */}
          <ul className="navbar__links">
            {desktopLinks.map((link) => (
              <li key={link.label}>
                <Link 
                  to={link.to} 
                  className={`navbar__link ${link.label === 'ADMIN' ? 'navbar__link--admin' : ''} ${link.label.toLowerCase() === 'sale' ? 'navbar__link--sale' : ''}`}
                  onClick={() => {
                    if (link.to === '/shop' && resetShopState) resetShopState();
                  }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right Icons */}
          <div className="navbar__icons">
            {/* Search */}
            <button
              className="navbar__icon-btn"
              onClick={() => {
                setSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              aria-label="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Wishlist */}
            <Link to="/wishlist" className="navbar__icon-btn" aria-label="Wishlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {wishlistCount > 0 && <span className="navbar__badge" style={{ background: 'var(--color-accent-gold)', color: '#111111' }}>{wishlistCount}</span>}
            </Link>

            {/* Cart - opens MiniCartDrawer */}
            <button
              type="button"
              className="navbar__icon-btn"
              onClick={openCartDrawer}
              aria-label="Shopping Cart"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {totalItems > 0 && <span className="navbar__badge" style={{ background: 'var(--color-accent-gold)', color: '#111111' }}>{totalItems}</span>}
            </button>

            {/* Account - desktop & mobile */}
            <Link to={authAccountLink} className="navbar__icon-btn navbar__icon-btn--account" aria-label="Account">
              {currentUser ? (
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-heading)', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : currentUser.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </Link>
          </div>
        </div>
      </nav>

      {/* Search Overlay */}
      <div className={`search-overlay ${searchOpen ? 'search-overlay--open' : ''}`}>
        <div className="search-overlay__inner">
          <div className="search-overlay__bar">
            <svg className="search-overlay__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-overlay__input"
              placeholder="Search products by title, category, tag..."
              onKeyDown={handleSearchKeyDown}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
            <button
              className="search-overlay__close"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Live Search Suggestions Dropdown */}
          {searchOpen && (searchQuery.trim().length > 0 || searchResults.length > 0) && (
            <div className="search-results-dropdown" role="listbox">
              {isSearching && (
                <div className="search-dropdown-loading">
                  <span className="search-spinner"></span> Searching catalog...
                </div>
              )}

              {!isSearching && searchResults.length === 0 && searchQuery.trim().length > 1 && (
                <div className="search-dropdown-empty">
                  No products found for "{searchQuery}".
                  <button
                    type="button"
                    className="search-see-all-btn"
                    onClick={() => {
                      setSearchOpen(false);
                      if (setSearch) setSearch(searchQuery.trim());
                      navigate('/shop');
                    }}
                  >
                    Search in Shop →
                  </button>
                </div>
              )}

              {searchResults.length > 0 && (
                <>
                  <div className="search-results-list">
                    {searchResults.map((product, idx) => (
                      <div
                        key={product.id || product.slug || idx}
                        className={`search-result-item ${selectedIndex === idx ? 'search-result-item--selected' : ''}`}
                        role="option"
                        aria-selected={selectedIndex === idx}
                        onClick={() => {
                          setSearchOpen(false);
                          navigate(`/product/${product.slug}`);
                        }}
                      >
                        <div className="search-result-thumb">
                          {product.images && product.images[0] ? (
                            <img
                              src={optimizeImage(product.images[0], { width: 90, quality: 75 })}
                              alt={product.name}
                              loading="lazy"
                            />
                          ) : (
                            <div className="search-result-placeholder">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="search-result-info">
                          <span className="search-result-name">{product.name}</span>
                          <span className="search-result-category">{product.category || 'Apparel'}</span>
                        </div>
                        <div className="search-result-pricing">
                          <span className="search-result-price">₹{product.price}</span>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="search-result-mrp">₹{product.originalPrice}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="search-view-all-results"
                    onClick={() => {
                      setSearchOpen(false);
                      if (setSearch) setSearch(searchQuery.trim());
                      navigate('/shop');
                    }}
                  >
                    View all matching products in Shop →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`mobile-menu-backdrop ${mobileOpen ? 'mobile-menu-backdrop--open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <div className={`mobile-menu ${mobileOpen ? 'mobile-menu--open' : ''}`}>
        <div className="mobile-menu__inner">
          {/* User Profile Info Card in Mobile Menu */}
          {currentUser ? (
            <div className="mobile-menu__user-card">
              <div className="mobile-menu__user-avatar">
                {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : currentUser.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="mobile-menu__user-details">
                <span className="mobile-menu__user-greeting">Logged in as</span>
                <span className="mobile-menu__user-name">{userProfile?.fullName || currentUser.email}</span>
              </div>
            </div>
          ) : (
            <div className="mobile-menu__guest-card">
              <Link 
                to="/login" 
                className="mobile-menu__login-btn"
                onClick={() => setMobileOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Login / Sign Up
              </Link>
            </div>
          )}

          {/* Nav Links */}
          <div className="mobile-menu__section">
            <span className="mobile-menu__section-title">EXPLORE</span>
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className={`mobile-menu__link ${link.label.toLowerCase() === 'sale' ? 'mobile-menu__link--sale' : ''}`}
                onClick={() => {
                  setMobileOpen(false);
                  if ((link.to === '/shop' || link.label === 'Shop') && resetShopState) resetShopState();
                }}
              >
                {link.label}
              </Link>
            ))}
            {/* Wishlist Link in Mobile Menu */}
            <Link
              to="/wishlist"
              className="mobile-menu__link"
              onClick={() => setMobileOpen(false)}
            >
              <svg className="mobile-menu__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
              Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
            </Link>
            {/* Bag link */}
            <button
              type="button"
              className="mobile-menu__link"
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center' }}
              onClick={() => {
                setMobileOpen(false);
                openCartDrawer();
              }}
            >
              <svg className="mobile-menu__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              Shopping Bag {totalItems > 0 && `(${totalItems})`}
            </button>
          </div>

          {/* Account & Orders Section */}
          {currentUser && (
            <div className="mobile-menu__section mobile-menu__section--account">
              <span className="mobile-menu__section-title">MY ACCOUNT</span>
              <Link
                to="/profile?tab=profile"
                className="mobile-menu__link mobile-menu__link--sub"
                onClick={() => setMobileOpen(false)}
              >
                <svg className="mobile-menu__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                My Profile
              </Link>
              <Link
                to="/profile?tab=orders"
                className="mobile-menu__link mobile-menu__link--sub"
                onClick={() => setMobileOpen(false)}
              >
                <svg className="mobile-menu__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8"/>
                  <rect x="1" y="3" width="22" height="5"/>
                  <line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
                My Orders
              </Link>
              {userProfile?.isAdmin && (
                <Link
                  to="/admin"
                  className="mobile-menu__link mobile-menu__link--admin"
                  onClick={() => setMobileOpen(false)}
                >
                  <svg className="mobile-menu__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Admin Dashboard
                </Link>
              )}
              <button
                type="button"
                className="mobile-menu__link mobile-menu__link--logout"
                onClick={handleLogout}
              >
                <svg className="mobile-menu__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
