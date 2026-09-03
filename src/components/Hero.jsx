import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Hero.css';

export default function Hero() {
  const heroRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    /* Trigger entrance animations after mount */
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <section className={`hero ${visible ? 'hero--visible' : ''}`} ref={heroRef}>
      {/* Background Image */}
      <div className="hero__image-wrap">
        <img
          src="/images/hero.png"
          alt="Premium men's fashion"
          className="hero__image"
          loading="eager"
        />
        <div className="hero__overlay" />
      </div>

      {/* Content */}
      <div className="hero__content">
        <div className="hero__text">
          <span className="hero__eyebrow">NEW SEASON 2026</span>
          <h1 className="hero__heading">
            DEFINE YOUR<br />EVERYDAY STYLE
          </h1>
          <p className="hero__description">
            Premium men's clothing designed for confidence, comfort and effortless style.
          </p>
            <div className="hero__actions">
              <Link to="/sale" className="hero__btn hero__btn--sale">
                <span className="hero__sale-pulse" />
                🔥 SALE — UP TO 50% OFF
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
              <Link to="/shop" className="hero__btn hero__btn--primary">
                EXPLORE CATALOG
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
            </div>

            {/* Quick Explore Chips */}
            <div className="hero__quick-chips">
              <span className="quick-chips__label">POPULAR:</span>
              <Link to="/shop?category=Shirts" className="quick-chip">Casual Shirts</Link>
              <Link to="/shop?category=T-Shirts" className="quick-chip">Oversized Tees</Link>
              <Link to="/shop?category=Jeans" className="quick-chip">Premium Denim</Link>
              <Link to="/new-arrivals" className="quick-chip highlight">✨ New Drops</Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="hero__scroll-indicator">
          <div className="hero__scroll-line" />
        </div>
      </section>

      {/* Luxury Customer Trust Strip */}
      <div className="hero-trust-bar">
        <div className="hero-trust-container">
          <div className="trust-pill">
            <span className="trust-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </span>
            <div>
              <strong>Free Express Shipping</strong>
              <span>On prepaid & orders above ₹999</span>
            </div>
          </div>
          <div className="trust-pill">
            <span className="trust-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <polyline points="23 20 23 14 17 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
            </span>
            <div>
              <strong>Exchange on Damage</strong>
              <span>Replacement for defective/damaged items</span>
            </div>
          </div>
          <div className="trust-pill">
            <span className="trust-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
            </span>
            <div>
              <strong>WhatsApp Sizing Concierge</strong>
              <span>One-on-one personal stylist advice</span>
            </div>
          </div>
          <div className="trust-pill">
            <span className="trust-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
            </span>
            <div>
              <strong>100% Quality Fabric</strong>
              <span>Checked for durability, fit & finish</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
