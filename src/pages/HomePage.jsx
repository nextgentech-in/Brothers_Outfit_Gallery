import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import Hero from '../components/Hero';
import TrendingCarousel from '../components/TrendingCarousel';
import SaleProductCard from '../components/SaleProductCard';
import ProductCard from '../components/ProductCard';
import TrustBar from '../components/TrustBar';
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
    trending: {
      label: 'CURATED FOR YOU',
      title: 'Trending Now',
      subtitle: "Discover the styles defining men's fashion right now."
    },
    hero: {
      bannerImage: '/images/hero.png',
      mobileBannerImage: '',
      eyebrow: 'NEW SEASON 2026',
      heading: 'Define Your\nEveryday Style',
      description: "Premium men's clothing designed for confidence, comfort and effortless style.",
      saleButtonText: 'Season Sale — Up to 50% Off',
      saleButtonLink: '/sale',
      primaryButtonText: 'Explore Catalog',
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
        // Dynamically load catalog and config modules so initial bundle doesn't block on Firestore
        const [
          { getSaleProducts, getNewArrivals, getShopProducts },
          { getHomepageConfig }
        ] = await Promise.all([
          import('../services/productService'),
          import('../services/configService')
        ]);

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
      {homepageConfig.showTrending !== false && <TrendingCarousel trendingConfig={homepageConfig?.trending} />}

      {/* 3. Sale Products */}
      {homepageConfig.showSaleSection !== false && (saleProducts.length > 0 || loading) && (
        <section className="home-section sale-section">
          <div className="home-container">
            <div className="section-header">
              <h2>Sale & Special Offers</h2>
              <p className="subtitle">Explore curated seasonal reductions and wardrobe investments.</p>
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
              <Link to="/sale" className="btn-view-all">View All Sale →</Link>
            </div>
          </div>
        </section>
      )}

      {/* 4. New Arrivals */}
      {homepageConfig.showNewArrivals !== false && (newArrivals.length > 0 || loading) && (
        <section className="home-section new-arrivals-section">
          <div className="home-container">
            <div className="section-header">
              <h2>New Arrivals</h2>
              <p className="subtitle">Fresh silhouettes and fabrics added to the collection.</p>
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
              <Link to="/new-arrivals" className="btn-view-all">View All New Arrivals →</Link>
            </div>
          </div>
        </section>
      )}

      {/* 5. Shop Our Collection */}
      {homepageConfig.showShopCollection !== false && (
        <section className="home-section shop-section">
          <div className="home-container">
            <div className="section-header">
              <h2>Shop the Collection</h2>
              <p className="subtitle">Everyday essentials, tailoring, and contemporary menswear.</p>
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
              <Link to="/shop" className="btn-view-all">View All Products →</Link>
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
                <img
                  src="/images/store-real-1.jpeg"
                  alt="Brothers Outfit - Himatnagar Flagship Store"
                  className="about-img"
                  width="1280"
                  height="741"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="about-content">
                <h2>About Brother's Outfit Gallery</h2>
                <p>At Brother's Outfit Gallery, we curate modern men's fashion built around impeccable tailoring, fabric integrity, and effortless everyday style.</p>
                <p>From essential shirts and premium denim to contemporary occasion wear, our store in Himatnagar and online gallery stand for quality, honest pricing, and dedicated customer care.</p>
                <Link to="/about" className="btn-secondary">Discover Our Story →</Link>
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
              <h2>Why Choose Brother's</h2>
            </div>
            
            <div className="trust-grid">
              <div className="trust-item">
                <div className="trust-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                </div>
                <h3>Premium Fabrics</h3>
                <p>Durable cottons, breathable knits and refined textures made for comfort.</p>
              </div>
              <div className="trust-item">
                <div className="trust-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path>
                  </svg>
                </div>
                <h3>Modern Silhouettes</h3>
                <p>Flattering fits tailored for both daily versatility and evening wear.</p>
              </div>
              <div className="trust-item">
                <div className="trust-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <h3>Secure Checkout</h3>
                <p>Verified UPI, cards, net banking, and cash on delivery options.</p>
              </div>
              <div className="trust-item">
                <div className="trust-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                </div>
                <h3>Direct Support</h3>
                <p>Direct WhatsApp & phone assistance for sizing, delivery, and returns.</p>
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
              <h2>What Our Customers Say</h2>
              <p className="subtitle">Real feedback from verified menswear shoppers.</p>
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
              <Link to="/about" className="btn-view-all">Read Customer Reviews →</Link>
            </div>
          </div>
        </section>
      )}
 
      {/* 9. Customer Trust Bar (Mobile-specific placement at the bottom of the page) */}
      <TrustBar placement="bottom" />

    </div>
  );
}
