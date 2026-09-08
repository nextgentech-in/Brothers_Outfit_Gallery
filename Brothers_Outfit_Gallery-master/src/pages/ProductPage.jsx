import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductBySlug } from '../services/productService';
import ProductGallery from '../components/product/ProductGallery';
import ProductInfo from '../components/product/ProductInfo';
import ReviewsModule from '../components/product/ReviewsModule';
import RelatedProducts from '../components/product/RelatedProducts';
import './ProductPage.css';

export default function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(() => {
    try {
      const raw = sessionStorage.getItem('bo_products_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.data)) {
          return parsed.data.find(p => p.slug === slug) || null;
        }
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(() => !product);

  // Fetch product from Firebase (SWR background refresh)
  useEffect(() => {
    window.scrollTo(0, 0);
    let isCurrent = true;

    const fetchProduct = async () => {
      if (!product) setLoading(true);
      try {
        const prod = await getProductBySlug(slug);
        if (isCurrent && prod) {
          setProduct(prod);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    fetchProduct();

    return () => {
      isCurrent = false;
    };
  }, [slug]);

  if (loading && !product) {
    return (
      <div className="product-page-container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', padding: '40px 0' }}>
          <div className="product-skeleton" style={{ minHeight: '500px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="product-skeleton" style={{ minHeight: '40px', width: '70%' }} />
            <div className="product-skeleton" style={{ minHeight: '30px', width: '40%' }} />
            <div className="product-skeleton" style={{ minHeight: '120px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-not-found">
        <h1>PRODUCT NOT FOUND</h1>
        <p>The product you're looking for may have been removed or is no longer available.</p>
        <Link to="/shop" className="btn-back-shop">BACK TO SHOP</Link>
      </div>
    );
  }

  // Pre-bake images array ensuring a main image is pushed if images doesn't exist logically
  const allImages = product.images && product.images.length > 0 
    ? product.images 
    : [product.thumbnailUrl || product.image];

  return (
    <div className="product-page-container">
      
      <div className="product-main-grid">
        <div className="product-gallery-section">
          <ProductGallery images={allImages} />
        </div>
        
        <div className="product-info-section">
          <ProductInfo product={product} />
        </div>
      </div>

      <RelatedProducts currentProductId={product.id} category={product.category || product.categoryId} />

      <ReviewsModule product={product} />
    </div>
  );
}
