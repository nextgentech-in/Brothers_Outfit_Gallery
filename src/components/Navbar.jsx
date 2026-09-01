import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useShop } from '../context/ShopContext';
import './Navbar.css';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'New Arrivals', to: '/new-arrivals' },
  { label: 'About Us', to: '/about' },
  { label: 'Sale', to: '/sale' },
];

const mobileMenuLinks = [
  ...navLinks,
  { label: 'Account', to: '/shop' },
  { label: 'Wishlist', to: '/shop' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { currentUser, userProfile } = useAuth() || {};
  const { totalItems } = useCart() || { totalItems: 0 };
  const { resetShopState } = useShop() || {};

  const authAccountLink = currentUser ? '/profile' : '/login';

  const desktopLinks = [...navLinks];
  if (userProfile?.isAdmin) {
    desktopLinks.push({ label: 'ADMIN', to: '/admin' });
  }

  const mobileMenuLinksD = [
    ...navLinks,
    { label: 'Account', to: authAccountLink }
  ];
  if (userProfile?.isAdmin) {
    mobileMenuLinksD.push({ label: 'ADMIN', to: '/admin' });
  }

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
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

  return (
    <>
      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
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
              <path d="M 14 10 h 14 a 9 9 0 0 1 0 18 h -14 z" stroke="#FACC15" strokeWidth="2.5" />
              <path d="M 14 32 h 14 a 9 9 0 0 1 0 18 h -14 z" stroke="#FACC15" strokeWidth="2.5" />
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
                  className={`navbar__link ${link.label === 'ADMIN' ? 'navbar__link--admin' : ''}`}
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
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>


            {/* Cart */}
            <Link to="/cart" className="navbar__icon-btn" aria-label="Cart">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {totalItems > 0 && <span className="navbar__badge" style={{ background: '#16a34a' }}>{totalItems}</span>}
            </Link>

            {/* Account - desktop only */}
            <Link to={authAccountLink} className="navbar__icon-btn navbar__icon-btn--desktop" aria-label="Account">
              {currentUser ? (
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-heading)', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
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
              className="search-overlay__input"
              placeholder="Search products..."
            />
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
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`mobile-menu-backdrop ${mobileOpen ? 'mobile-menu-backdrop--open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <div className={`mobile-menu ${mobileOpen ? 'mobile-menu--open' : ''}`}>
        <div className="mobile-menu__inner">
          {mobileMenuLinksD.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="mobile-menu__link"
              onClick={() => {
                setMobileOpen(false);
                if ((link.to === '/shop' || link.label === 'Shop') && resetShopState) resetShopState();
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
