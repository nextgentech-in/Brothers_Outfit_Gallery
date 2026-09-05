import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { optimizeImage } from '../utils/imageUtils';
import './Hero.css';

export default function Hero({ heroConfig: propConfig }) {
  const heroRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // Read local cache immediately to guarantee 0ms first-paint render
  const [heroConfig, setHeroConfig] = useState(() => {
    if (propConfig) return propConfig;
    try {
      const raw = localStorage.getItem('bo_homepage_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data?.hero) return parsed.data.hero;
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    if (propConfig) {
      setHeroConfig(propConfig);
    }
  }, [propConfig]);

  useEffect(() => {
    /* Trigger entrance animations after mount */
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  // Bulletproof fallbacks ensuring 0 errors & zero broken UI
  const bannerImage = heroConfig?.bannerImage || '/images/hero.png';
  const mobileBanner = heroConfig?.mobileBannerImage || bannerImage;
  const eyebrow = heroConfig?.eyebrow || 'NEW SEASON 2026';
  const heading = heroConfig?.heading || 'DEFINE YOUR\nEVERYDAY STYLE';
  const description = heroConfig?.description || "Premium men's clothing designed for confidence, comfort and effortless style.";
  const saleBtnText = heroConfig?.saleButtonText || '🔥 SALE — UP TO 50% OFF';
  const saleBtnLink = heroConfig?.saleButtonLink || '/sale';
  const primaryBtnText = heroConfig?.primaryButtonText || 'EXPLORE CATALOG';
  const primaryBtnLink = heroConfig?.primaryButtonLink || '/shop';
  const overlayOpacity = typeof heroConfig?.overlayOpacity === 'number' ? heroConfig.overlayOpacity : 0.55;

  return (
    <>
      <section className={`hero ${visible ? 'hero--visible' : ''}`} ref={heroRef}>
        {/* Background Image with Auto Optimization & Robust Error Fallback */}
        <div className="hero__image-wrap">
          <picture>
            {mobileBanner && mobileBanner !== bannerImage && (
              <source media="(max-width: 640px)" srcSet={optimizeImage(mobileBanner, 800)} />
            )}
            <img
              src={optimizeImage(bannerImage, 1920)}
              alt="Brothers Outfit - Premium Fashion"
              className="hero__image"
              loading="eager"
              fetchpriority="high"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/images/hero.png';
              }}
            />
          </picture>
          <div 
            className="hero__overlay" 
            style={{
              background: `linear-gradient(to right, rgba(0, 0, 0, ${Math.min(overlayOpacity + 0.2, 0.9)}) 0%, rgba(0, 0, 0, ${overlayOpacity}) 45%, rgba(0, 0, 0, ${Math.max(overlayOpacity - 0.25, 0.1)}) 100%)`
            }} 
          />
        </div>

        {/* Content */}
        <div className="hero__content">
          <div className="hero__text">
            <span className="hero__eyebrow">{eyebrow}</span>
            <h1 className="hero__heading">
              {heading.split('\n').map((line, idx) => (
                <span key={idx} style={{ display: 'block' }}>{line}</span>
              ))}
            </h1>
            <p className="hero__description">
              {description}
            </p>
            <div className="hero__actions">
              {saleBtnText && (
                <Link to={saleBtnLink} className="hero__btn hero__btn--sale">
                  <span className="hero__sale-pulse" />
                  {saleBtnText}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </Link>
              )}
              {primaryBtnText && (
                <Link to={primaryBtnLink} className="hero__btn hero__btn--primary">
                  {primaryBtnText}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </Link>
              )}
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
                <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
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
