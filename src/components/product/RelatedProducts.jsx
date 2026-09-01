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
      if (!category) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getRelatedProducts(category, currentProductId, 4);
        setRelated(data);
      } catch (err) {
        console.error("Error fetching related products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRelated();
  }, [category, currentProductId]);

  if (loading || !related || related.length === 0) return null;

  return (
    <div style={{ marginTop: '80px', padding: '0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <h2 style={{ 
          fontFamily: 'var(--font-heading)',
          fontSize: '24px',
          fontWeight: 800,
          color: 'var(--color-heading)',
          margin: 0,
          letterSpacing: '1px'
        }}>
          YOU MAY ALSO LIKE
        </h2>
        <Link to={`/shop?category=${category}`} style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textDecoration: 'none',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          VIEW ALL {category}
        </Link>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '24px'
      }}>
        {related.map(product => (
          <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
        ))}
      </div>
    </div>
  );
}
