import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { optimizeImage } from '../utils/imageUtils';
import TrustBar from './TrustBar';
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
  const saleBtnText = heroConfig?.saleButtonText ? heroConfig.saleButtonText.replace(/^[🔥⚡\s]+/, '') : 'Season Sale — Up to 50% Off';
  const saleBtnLink = heroConfig?.saleButtonLink || '/sale';
  const primaryBtnText = heroConfig?.primaryButtonText || 'Explore Catalog';
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
              fetchPriority="high"
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

      <TrustBar placement="top" />
    </>
  );
}
