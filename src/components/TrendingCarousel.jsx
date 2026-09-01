import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import trendingItems from '../data/trendingData';
import './TrendingCarousel.css';

export default function TrendingCarousel() {
  const trackRef = useRef(null);
  const [paused, setPaused] = useState(false);

  return (
    <section className="trending">
      {/* Section Header */}
      <div className="trending__header">
        <span className="trending__label">CURATED FOR YOU</span>
        <h2 className="trending__title">TRENDING NOW</h2>
        <p className="trending__subtitle">
          Discover the styles defining men's fashion right now.
        </p>
      </div>

      {/* Carousel */}
      <div
        className="trending__carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className={`trending__track ${paused ? 'trending__track--paused' : ''}`}
          ref={trackRef}
        >
          {/* Render items twice for seamless infinite loop */}
          {[...trendingItems, ...trendingItems].map((item, index) => (
            <Link
              to={item.link}
              className="trending__card"
              key={`${item.title}-${index}`}
            >
              <div className="trending__card-image-wrap">
                <img
                  src={item.image}
                  alt={item.title}
                  className="trending__card-image"
                  loading="lazy"
                />
                <div className="trending__card-overlay" />
              </div>
              <div className="trending__card-info">
                <div>
                  <h3 className="trending__card-title">{item.title}</h3>
                  {item.subtitle && (
                    <p className="trending__card-subtitle">{item.subtitle}</p>
                  )}
                </div>
                <span className="trending__card-arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
