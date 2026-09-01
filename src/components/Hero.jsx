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
              SHOP NOW
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>

          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="hero__scroll-indicator">
        <div className="hero__scroll-line" />
      </div>
    </section>
  );
}
