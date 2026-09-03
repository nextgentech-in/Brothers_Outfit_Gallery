import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">

        {/* Newsletter Section - Integrated per prompt */}
        <div className="footer-newsletter">
          <div className="newsletter-text">
            <h2 className="newsletter-title">STAY IN STYLE</h2>
            <p className="newsletter-subtitle">Get first access to new arrivals, limited-time offers and exclusive updates.</p>
          </div>
          <form className="newsletter-form" onSubmit={(e) => { e.preventDefault(); alert('Subscribed! We\'ll send updates to your mobile number.'); }}>
            <input type="tel" placeholder="Enter your mobile number" required pattern="[0-9]{10}" maxLength="10" className="newsletter-input" />
            <button type="submit" className="newsletter-btn">SUBSCRIBE</button>
          </form>
        </div>

        {/* Main Footer Links */}
        <div className="footer-main">
          <div className="footer-col brand-col">
            <h3 className="footer-brand-title">BROTHERS OUTFIT GALLERY</h3>
            <p className="footer-brand-desc">
              Modern men's fashion for everyday confidence, comfort and style.
            </p>
            <div className="footer-socials">
              <a href="https://www.instagram.com/brothersoutfitgallery/" target="_blank" rel="noreferrer" aria-label="Instagram" className="footer-social-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a href="https://www.facebook.com/share/1Hz6w71LC8/" target="_blank" rel="noreferrer" aria-label="Facebook" className="footer-social-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              <a href="https://wa.me/918460233020?text=Hi%20Brothers%20Outfit!%20I%27m%20interested%20in%20your%20collection." target="_blank" rel="noreferrer" aria-label="WhatsApp" className="footer-social-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                </svg>
              </a>
            </div>

            <a href="https://maps.app.goo.gl/LdPv9pHvtFU8cj4E8" target="_blank" rel="noreferrer" className="btn-visit-store">
              VISIT OUR STORE →
            </a>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">SHOP</h4>
            <ul className="footer-links">
              <li><Link to="/shop">Shop All</Link></li>
              <li><Link to="/new-arrivals">New Arrivals</Link></li>
              <li><Link to="/sale">Sale</Link></li>
              <li><Link to="/shop?category=Shirts">Shirts</Link></li>
              <li><Link to="/shop?category=T-Shirts">T-Shirts</Link></li>
              <li><Link to="/shop?category=Jeans">Jeans</Link></li>

            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">HELP</h4>
            <ul className="footer-links">
              <li><Link to="/about">Contact Us</Link></li>
              <li><Link to="/about">FAQ</Link></li>
              <li><Link to="/profile">Track Order</Link></li>
              <li><Link to="/about">Returns & Exchanges</Link></li>

            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">COMPANY</h4>
            <ul className="footer-links">
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/about">Our Story</Link></li>
              <li><a href="https://maps.app.goo.gl/LdPv9pHvtFU8cj4E8" target="_blank" rel="noreferrer">Store Location</a></li>
              <li><Link to="/about">Contact</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">LEGAL</h4>
            <ul className="footer-links">
              <li><Link to="/about#privacy">Privacy Policy</Link></li>
              <li><Link to="/about#terms">Terms & Conditions</Link></li>
              <li><Link to="/about#shipping">Shipping Policy</Link></li>
              <li><Link to="/about#exchange">Exchange Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 Brothers Outfit Gallery. All Rights Reserved.</p>
          <div className="footer-secure-payments">
            <span>SECURE CHECKOUT</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
