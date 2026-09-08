import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { getNewArrivals } from '../services/productService';
import ProductCard from '../components/ProductCard';
import './NewArrivalsPage.css';

export default function NewArrivalsPage() {
  const [newArrivals, setNewArrivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getNewArrivals(12);
        setNewArrivals(data);
      } catch (err) {
        console.error("Error loading new arrivals:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);
  
  if (loading) {
    return <div className="new-arrivals-page" style={{padding: '5rem', textAlign: 'center'}}>Loading New Arrivals...</div>;
  }

  const handleAddToCart = (productData) => {
    const size = productData.selectedSize || (productData.sizes && productData.sizes[0]) || 'Default';
    const color = productData.colors?.[0]?.name || productData.variants?.[0]?.color || 'Default';
    addToCart(productData, size, color);
  };

  return (
    <div className="new-arrivals-page">
      {/* Header */}
      <div className="na-header">
        <span className="na-header__label">JUST DROPPED</span>
        <h1 className="na-header__title">NEW ARRIVALS</h1>
        <p className="na-header__subtitle">Fresh styles stock added at BROTHERS OUTFIT GALLARY.</p>

      </div>

      {/* Product Grid or Empty State */}
      {newArrivals.length > 0 ? (
        <>
          <div className="na-count">
            <span>{newArrivals.length} New {newArrivals.length === 1 ? 'Product' : 'Products'}</span>
          </div>
          <div className="na-grid">
            {newArrivals.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                showNewBadge
                showOffer
              />
            ))}
          </div>
        </>
      ) : (
        <div className="na-empty">
          <svg className="na-empty__icon" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <h3 className="na-empty__title">NO NEW ARRIVALS YET</h3>
          <p className="na-empty__text">
            New styles are coming soon. Check back shortly for our latest collection.
          </p>
          <Link to="/shop" className="na-empty__btn">SHOP ALL PRODUCTS</Link>
        </div>
      )}
    </div>
  );
}
