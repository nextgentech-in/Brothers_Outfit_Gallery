import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import ProductCard from '../ProductCard';
import { getRelatedProducts } from '../../services/productService';

export default function RelatedProducts({ currentProductId, category }) {
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  const handleAddToCart = (productData) => {
    const size = productData.selectedSize || (productData.sizes && productData.sizes[0]) || 'Default';
    const color = productData.colors?.[0]?.name || productData.variants?.[0]?.color || 'Default';
    addToCart(productData, size, color);
  };

  useEffect(() => {
    const fetchRelated = async () => {
      setLoading(true);
      try {
        const data = await getRelatedProducts(category, currentProductId, 4);
        setRelated(data);
      } catch (err) {
        console.error("Error fetching recommended products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRelated();
  }, [category, currentProductId]);

  if (loading || !related || related.length === 0) return null;

  return (
    <section className="related-products-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '2px', color: 'var(--color-accent-gold, #B88A2E)', textTransform: 'uppercase' }}>
            Curated For You
          </span>
          <h2 style={{ 
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(20px, 3vw, 26px)',
            fontWeight: 700,
            color: 'var(--color-charcoal, #111111)',
            margin: '4px 0 0',
            letterSpacing: '-0.3px'
          }}>
            Recommended Products
          </h2>
        </div>
        {category && (
          <Link to={`/shop?category=${encodeURIComponent(category)}`} style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--color-charcoal, #111111)',
            textDecoration: 'none',
            letterSpacing: '0.5px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm, 4px)',
            border: '1px solid var(--color-stone, #D9D3C7)',
            background: '#ffffff',
            transition: 'all 0.2s ease'
          }}>
            View All {category} →
          </Link>
        )}
      </div>

      <div className="related-products-grid">
        {related.map(product => (
          <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
        ))}
      </div>
    </section>
  );
}
