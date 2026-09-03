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
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch product from Firebase
  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const prod = await getProductBySlug(slug);
        setProduct(prod);
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [slug]);

  if (loading) {
    return <div className="product-page-container"><div style={{padding: '4rem', textAlign: 'center'}}>Loading Product...</div></div>;
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

      <ReviewsModule product={product} />
      
      <RelatedProducts currentProductId={product.id} category={product.category || product.categoryId} />
      
    </div>
  );
}
