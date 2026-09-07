import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTrendingProducts } from '../services/productService';
import trendingItems from '../data/trendingData';
import './TrendingCarousel.css';

export default function TrendingCarousel({ trendingConfig }) {
  const trackRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fallback to config props if available
  const sectionLabel = trendingConfig?.label || 'CURATED FOR YOU';
  const sectionTitle = trendingConfig?.title || 'TRENDING NOW';
  const sectionSubtitle = trendingConfig?.subtitle || "Discover the styles defining men's fashion right now.";

  useEffect(() => {
    let isMounted = true;
    getTrendingProducts(16)
      .then(items => {
        if (isMounted) {
          setProducts(items || []);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to load trending products:', err);
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  // Determine items to display: dynamic products if any are marked trending, otherwise fallback curated categories
  let displayItems = [];
  if (products.length > 0) {
    displayItems = products.map(p => {
      const img = p.images?.[0]?.url || (typeof p.images?.[0] === 'string' ? p.images[0] : null) || p.thumbnailUrl || p.image || '/images/hero.png';
      const price = p.salePrice || p.price || 0;
      const mrp = p.mrp || p.compareAtPrice || 0;
      const hasDiscount = mrp > price;
      const discount = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
      const link = p.slug ? `/product/${p.slug}` : `/product/${p.id}`;

      return {
        id: p.id,
        title: p.name || p.title || 'Trending Item',
        subtitle: p.category || p.categoryId || "Men's Collection",
        image: img,
        link,
        price,
        mrp,
        hasDiscount,
        discount,
        isProduct: true
      };
    });
  } else {
    displayItems = trendingItems.map(item => ({
      ...item,
      isProduct: false
    }));
  }

  // Ensure minimum 8 items for seamless 50% infinite scroll animation
  let baseList = displayItems;
  while (baseList.length > 0 && baseList.length < 8) {
    baseList = [...baseList, ...displayItems];
  }
  const loopItems = [...baseList, ...baseList];

  return (
    <section className="trending">
      {/* Section Header */}
      <div className="trending__header">
        <span className="trending__label">{sectionLabel}</span>
        <h2 className="trending__title">{sectionTitle}</h2>
        <p className="trending__subtitle">{sectionSubtitle}</p>
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
          {loopItems.map((item, index) => (
            <Link
              to={item.link}
              className="trending__card"
              key={`${item.id || item.title}-${index}`}
            >
              {item.isProduct && (
                <div className="trending__card-badge">
                  {item.hasDiscount ? `${item.discount}% OFF` : '🔥 TRENDING'}
                </div>
              )}
              <div className="trending__card-image-wrap">
                <img
                  src={item.image}
                  alt={item.title}
                  className="trending__card-image"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/images/hero.png';
                  }}
                />
                <div className="trending__card-overlay" />
              </div>
              <div className="trending__card-info">
                <div className="trending__card-details">
                  <h3 className="trending__card-title">{item.title}</h3>
                  {item.subtitle && (
                    <p className="trending__card-subtitle">{item.subtitle}</p>
                  )}
                  {item.isProduct && item.price > 0 && (
                    <div className="trending__card-pricing">
                      <span className="trending__card-price">
                        ₹{item.price.toLocaleString('en-IN')}
                      </span>
                      {item.hasDiscount && (
                        <span className="trending__card-mrp">
                          ₹{item.mrp.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="trending__card-arrow" aria-hidden="true">
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
