import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import Hero from '../components/Hero';
import TrendingCarousel from '../components/TrendingCarousel';
import SaleProductCard from '../components/SaleProductCard';
import ProductCard from '../components/ProductCard';
import { getSaleProducts, getNewArrivals, getShopProducts } from '../services/productService';
import './HomePage.css';

export default function HomePage() {
  const [saleProducts, setSaleProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [shopProducts, setShopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
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
        const [saleRes, newRes, shopRes] = await Promise.all([
          getSaleProducts(4),
          getNewArrivals(4),
          getShopProducts('All', 'featured', null, 8)
        ]);

        setSaleProducts(saleRes);
        setNewArrivals(newRes);

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

  if (loading) {
    return <div className="home-page"><Hero /><div style={{padding: '5rem', textAlign: 'center'}}>Loading Collection...</div></div>;
  }

  return (
    <div className="home-page">
      {/* 1. Hero */}
      <Hero />

      {/* 2. Trending Now */}
      <TrendingCarousel />

      {/* 3. Sale Products */}
      {saleProducts.length > 0 && (
        <section className="home-section sale-section">
          <div className="home-container">
            <div className="section-header">
              <h2>SALE — LIMITED TIME</h2>
              <p className="subtitle">Great styles. Better prices. Only for a limited time.</p>
              <p className="urgency">Hurry — these offers won't last forever.</p>
            </div>
            
            <div className="product-grid">
              {saleProducts.map(product => (
                <SaleProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
              ))}
            </div>
            
            <div className="section-footer">
              <Link to="/sale" className="btn-view-all">VIEW ALL SALE →</Link>
            </div>
          </div>
        </section>
      )}

      {/* 4. New Arrivals */}
      {newArrivals.length > 0 && (
        <section className="home-section new-arrivals-section">
          <div className="home-container">
            <div className="section-header">
              <h2>NEW ARRIVALS</h2>
              <p className="subtitle">Fresh styles added in the last 10 days.</p>
            </div>
            
            <div className="product-grid">
              {newArrivals.map(product => (
                <ProductCard key={product.id} product={product} showNewBadge={true} onAddToCart={handleAddToCart} />
              ))}
            </div>
            
            <div className="section-footer">
              <Link to="/new-arrivals" className="btn-view-all">VIEW ALL NEW ARRIVALS →</Link>
            </div>
          </div>
        </section>
      )}

      {/* 5. Shop Our Collection */}
      <section className="home-section shop-section">
        <div className="home-container">
          <div className="section-header">
            <h2>SHOP OUR COLLECTION</h2>
            <p className="subtitle">Find your everyday essentials, statement pieces and timeless men's styles.</p>
          </div>
          
          <div className="product-grid">
            {shopProducts.map(product => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
            ))}
          </div>
          
          <div className="section-footer">
            <Link to="/shop" className="btn-view-all">VIEW ALL PRODUCTS →</Link>
          </div>
        </div>
      </section>

      {/* 6. About Us Preview */}
      <section className="home-section about-preview-section">
        <div className="home-container">
          <div className="about-grid">
            <div className="about-img-wrap">
              <img src="/images/brothers-shop-real.png" alt="Brothers Outfit - Our Real Store" className="about-img" />
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

      {/* 7. Why Shop With Us */}
      <section className="home-section trust-section">
        <div className="home-container">
          <div className="section-header">
            <h2>WHY SHOP WITH US</h2>
          </div>
          
          <div className="trust-grid">
            <div className="trust-item">
              <div className="trust-icon">★</div>
              <h3>PREMIUM QUALITY</h3>
              <p>Quality-focused men's fashion for everyday wear.</p>
            </div>
            <div className="trust-item">
              <div className="trust-icon">❖</div>
              <h3>MODERN STYLES</h3>
              <p>Contemporary styles for different occasions.</p>
            </div>
            <div className="trust-item">
              <div className="trust-icon">🔒</div>
              <h3>SECURE SHOPPING</h3>
              <p>A secure and convenient online shopping experience.</p>
            </div>
            <div className="trust-item">
              <div className="trust-icon">💬</div>
              <h3>EASY SUPPORT</h3>
              <p>Customer support when you need help.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Customer Reviews */}
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

    </div>
  );
}
