import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import Hero from '../components/Hero';
import TrendingCarousel from '../components/TrendingCarousel';
import SaleProductCard from '../components/SaleProductCard';
import ProductCard from '../components/ProductCard';
import { getSaleProducts, getNewArrivals, getShopProducts } from '../services/productService';
import { getHomepageConfig } from '../services/adminService';
import './HomePage.css';

export default function HomePage() {
  const [saleProducts, setSaleProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [shopProducts, setShopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [homepageConfig, setHomepageConfig] = useState({
    showHero: true,
    showTrending: true,
    showSaleSection: true,
    showNewArrivals: true,
    showShopCollection: true,
    showAboutPreview: true,
    showTrustBadges: true,
    showReviews: true,
    hero: {
      bannerImage: '/images/hero.png',
      mobileBannerImage: '',
      eyebrow: 'NEW SEASON 2026',
      heading: 'DEFINE YOUR\nEVERYDAY STYLE',
      description: "Premium men's clothing designed for confidence, comfort and effortless style.",
      saleButtonText: '🔥 SALE — UP TO 50% OFF',
      saleButtonLink: '/sale',
      primaryButtonText: 'EXPLORE CATALOG',
      primaryButtonLink: '/shop',
      overlayOpacity: 0.55
    }
  });
  const { addToCart } = useCart();

  const handleAddToCart = (productData) => {
    const size = productData.selectedSize || (productData.sizes && productData.sizes[0]) || 'Default';
    const color = productData.colors?.[0]?.name || productData.variants?.[0]?.color || 'Default';
    addToCart(productData, size, color);
  };

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setLoading(true);
        // Fetch concurrently
        const [saleRes, newRes, shopRes, configRes] = await Promise.all([
          getSaleProducts(4),
          getNewArrivals(4),
          getShopProducts('All', 'featured', null, 8),
          getHomepageConfig()
        ]);

        setSaleProducts(saleRes);
        setNewArrivals(newRes);
        if (configRes && Object.keys(configRes).length > 0) {
          setHomepageConfig(prev => ({ ...prev, ...configRes }));
        }

        const excludeIds = new Set([...saleRes, ...newRes].map(p => p.id));
        const filteredShop = shopRes.products.filter(p => !excludeIds.has(p.id)).slice(0, 4);
        
        if (filteredShop.length < 4) {
          const additional = shopRes.products.filter(p => excludeIds.has(p.id)).slice(0, 4 - filteredShop.length);
          filteredShop.push(...additional);
        }

        setShopProducts(filteredShop);
      } catch (err) {
        console.error("Error fetching homepage data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  return (
    <div className="home-page">
      {/* 1. Hero */}
      {homepageConfig.showHero !== false && <Hero heroConfig={homepageConfig?.hero} />}

      {/* 2. Trending Now */}
      {homepageConfig.showTrending !== false && <TrendingCarousel />}

      {/* 3. Sale Products */}
      {homepageConfig.showSaleSection !== false && (saleProducts.length > 0 || loading) && (
        <section className="home-section sale-section">
          <div className="home-container">
            <div className="section-header">
              <h2>SALE — LIMITED TIME</h2>
              <p className="subtitle">Great styles. Better prices. Only for a limited time.</p>
              <p className="urgency">Hurry — these offers won't last forever.</p>
            </div>
            
            <div className="product-grid">
              {loading && saleProducts.length === 0
                ? [1, 2, 3, 4].map(n => <div key={n} className="product-skeleton" />)
                : saleProducts.map(product => (
                    <SaleProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
                  ))
              }
            </div>
            
            <div className="section-footer">
              <Link to="/sale" className="btn-view-all">VIEW ALL SALE →</Link>
            </div>
          </div>
        </section>
      )}

      {/* 4. New Arrivals */}
      {homepageConfig.showNewArrivals !== false && (newArrivals.length > 0 || loading) && (
        <section className="home-section new-arrivals-section">
          <div className="home-container">
            <div className="section-header">
              <h2>NEW ARRIVALS</h2>
              <p className="subtitle">Fresh styles added in the last 10 days.</p>
            </div>
            
            <div className="product-grid">
              {loading && newArrivals.length === 0
                ? [1, 2, 3, 4].map(n => <div key={n} className="product-skeleton" />)
                : newArrivals.map(product => (
                    <ProductCard key={product.id} product={product} showNewBadge={true} onAddToCart={handleAddToCart} />
                  ))
              }
            </div>
            
            <div className="section-footer">
              <Link to="/new-arrivals" className="btn-view-all">VIEW ALL NEW ARRIVALS →</Link>
            </div>
          </div>
        </section>
      )}

      {/* 5. Shop Our Collection */}
      {homepageConfig.showShopCollection !== false && (
        <section className="home-section shop-section">
          <div className="home-container">
            <div className="section-header">
              <h2>SHOP OUR COLLECTION</h2>
              <p className="subtitle">Find your everyday essentials, statement pieces and timeless men's styles.</p>
            </div>
            
            <div className="product-grid">
              {loading && shopProducts.length === 0
                ? [1, 2, 3, 4].map(n => <div key={n} className="product-skeleton" />)
                : shopProducts.map(product => (
                    <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
                  ))
              }
            </div>
            
            <div className="section-footer">
              <Link to="/shop" className="btn-view-all">VIEW ALL PRODUCTS →</Link>
            </div>
          </div>
        </section>
      )}

      {/* 6. About Us Preview */}
      {homepageConfig.showAboutPreview !== false && (
        <section className="home-section about-preview-section">
          <div className="home-container">
            <div className="about-grid">
              <div className="about-img-wrap">
                <img src="/images/store-real-1.jpeg" alt="Brothers Outfit - Our Real Store" className="about-img" />
              </div>
              <div className="about-content">
                <h2>ABOUT BROTHERS OUTFIT GALLERY</h2>
                <p>At Brothers Outfit Gallery, we bring together modern men's fashion, quality clothing and a shopping experience built around confidence, comfort and personal style.</p>
                <p>For years, we've focused on delivering the highest quality pieces—from everyday essentials to statement looks. Whether you visit our physical location or shop online, our commitment to excellent customer service remains our cornerstone.</p>
                <Link to="/about" className="btn-secondary">DISCOVER OUR STORY →</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 7. Why Shop With Us */}
      {homepageConfig.showTrustBadges !== false && (
        <section className="home-section trust-section">
          <div className="home-container">
            <div className="section-header">
              <h2>WHY SHOP WITH US</h2>
            </div>
            
            <div className="trust-grid">
              <div className="trust-item">
                <div className="trust-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                </div>
                <h3>PREMIUM QUALITY</h3>
                <p>Quality-focused men's fashion for everyday wear.</p>
              </div>
              <div className="trust-item">
                <div className="trust-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path>
                  </svg>
                </div>
                <h3>MODERN STYLES</h3>
                <p>Contemporary styles for different occasions.</p>
              </div>
              <div className="trust-item">
                <div className="trust-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <h3>SECURE SHOPPING</h3>
                <p>A secure and convenient online shopping experience.</p>
              </div>
              <div className="trust-item">
                <div className="trust-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                </div>
                <h3>EASY SUPPORT</h3>
                <p>Customer support when you need help.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 8. Customer Reviews */}
      {homepageConfig.showReviews !== false && (
        <section className="home-section reviews-section">
          <div className="home-container">
            <div className="section-header">
              <h2>WHAT OUR CUSTOMERS SAY</h2>
              <p className="subtitle">Real experiences from our customers.</p>
            </div>
            
            <div className="reviews-grid">
              <div className="review-card">
                <div className="review-stars">★★★★★</div>
                <p className="review-text">"Great quality and the fit was exactly what I wanted. Prompt delivery as well!"</p>
                <p className="review-author">Rahul Verma <span className="verified">✓ Verified</span></p>
              </div>
              <div className="review-card">
                <div className="review-stars">★★★★★</div>
                <p className="review-text">"The oversized tees are absolute perfection. Fabric feels super premium and comfortable."</p>
                <p className="review-author">Sumit Sharma <span className="verified">✓ Verified</span></p>
              </div>
              <div className="review-card">
                <div className="review-stars">★★★★★</div>
                <p className="review-text">"My go-to store for casual and ethnic wear. Support team is always responsive."</p>
                <p className="review-author">Aryan Mehta <span className="verified">✓ Verified</span></p>
              </div>
            </div>
            
            <div className="section-footer">
              <Link to="/about" className="btn-view-all">READ CUSTOMER REVIEWS →</Link>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
