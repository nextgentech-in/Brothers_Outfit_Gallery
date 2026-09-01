import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSaleProducts } from '../services/productService';
import SaleProductCard from '../components/SaleProductCard';
import './SalePage.css';

export default function SalePage() {
  const [saleProducts, setSaleProducts] = useState([]);

  const [loading, setLoading] = useState(true);

  const fetchActiveSales = async () => {
    try {
      const activeProducts = await getSaleProducts(12);
      setSaleProducts(activeProducts);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchActiveSales();
      setLoading(false);
    };
    init();
    
    // Optional: Auto-refresh the entire grid every 1 minute to prune any products that naturally expired
    const interval = setInterval(fetchActiveSales, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="sale-page" style={{padding: '5rem', textAlign: 'center'}}>Loading Sales...</div>;
  }

  const handleOfferExpire = (productId) => {
    // When a specific product signals it expired right now, instantly filter it out
    setSaleProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleAddToCart = (product) => {
    console.log('Added to cart from sale:', product);
  };

  const scrollToSales = () => {
    const el = document.getElementById("sale-grid");
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="sale-page">
      {/* Promotional Hero */}
      <section className="sale-hero">
        <div className="sale-hero__content">
          <span className="sale-hero__label">SALE</span>
          <h1 className="sale-hero__title">LIMITED TIME.<br />EXTRA STYLE.</h1>
          <p className="sale-hero__desc">
            Your favorite men's styles, now at prices worth grabbing before they're gone.
          </p>
          <button className="sale-hero__cta" onClick={scrollToSales}>
            SHOP SALE →
          </button>
        </div>
      </section>

      {/* Sale Grid / Layout structure */}
      <section className="sale-content" id="sale-grid">
        {saleProducts.length > 0 ? (
          <>
            <div className="sale-urgency-banner">
              <h2>ENDING SOON 🔥</h2>
              <p>These offers won't last forever. Lowest times shown first.</p>
            </div>
            
            <div className="sale-grid-container">
              {saleProducts.map(product => (
                <SaleProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onOfferExpire={handleOfferExpire}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="sale-empty">
            <h3 className="sale-empty__title">SALE IS TAKING A BREAK</h3>
            <p className="sale-empty__text">
              Our next offers are coming soon. Explore the latest collection while you wait.
            </p>
            <Link to="/shop" className="sale-empty__btn">SHOP ALL PRODUCTS</Link>
          </div>
        )}
      </section>
    </div>
  );
}
