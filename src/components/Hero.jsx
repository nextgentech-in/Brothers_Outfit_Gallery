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
            <span className="trust-icon">🚚</span>
            <div>
              <strong>Free Express Shipping</strong>
              <span>On prepaid & orders above ₹999</span>
            </div>
          </div>
          <div className="trust-pill">
            <span className="trust-icon">🔄</span>
            <div>
              <strong>Easy 7-Day Exchange</strong>
              <span>Doorstep size exchange available</span>
            </div>
          </div>
          <div className="trust-pill">
            <span className="trust-icon">💬</span>
            <div>
              <strong>WhatsApp Sizing Concierge</strong>
              <span>One-on-one personal stylist advice</span>
            </div>
          </div>
          <div className="trust-pill">
            <span className="trust-icon">🛡️</span>
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
