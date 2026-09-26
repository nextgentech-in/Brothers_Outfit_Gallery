import { useState, useEffect } from 'react';
import { fetchAllActiveProducts, isProductInStock } from '../services/productService';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import './AccessoriesPage.css';

const ACCESSORY_CATEGORIES = [
  { id: 'ALL', label: 'All Accessories' },
  { id: 'Watches', label: 'Watches' },
  { id: 'Belts', label: 'Belts' },
  { id: 'Sunglasses', label: 'Sunglasses' },
  { id: 'Wallets', label: 'Wallets & Bags' },
  { id: 'Caps', label: 'Caps & Hats' },
  { id: 'Perfumes', label: 'Perfumes' },
];

export default function AccessoriesPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const { addToCart } = useCart();

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchAccessoryProducts = async () => {
      setLoading(true);
      try {
        const rawItems = await fetchAllActiveProducts();
        const firestoreItems = rawItems.filter(p => p.active !== false && isProductInStock(p));

        // Filter only items whose category belongs to Accessories
        const accessoryKeywords = ['accessori', 'watch', 'belt', 'sunglass', 'wallet', 'cap', 'hat', 'perfume', 'bag', 'fragrance', 'apparel spray'];
        const filteredAccessories = firestoreItems.filter(p => {
          const cat = (p.categoryId || p.category || '').toLowerCase();
          const name = (p.name || '').toLowerCase();
          return accessoryKeywords.some(k => cat.includes(k) || name.includes(k));
        });

        setProducts(filteredAccessories);
      } catch (err) {
        console.warn('Firestore fetch error in AccessoriesPage:', err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAccessoryProducts();
  }, []);

  const handleAddToCart = (item) => {
    addToCart(item, item.selectedSize || 'One Size', item.colors?.[0] || 'Default');
  };

  // Filter products by selected subcategory tab
  const displayedProducts = activeTab === 'ALL'
    ? products
    : products.filter(p => {
        const cat = (p.categoryId || p.category || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        const tabKey = activeTab.toLowerCase();
        return cat.includes(tabKey) || name.includes(tabKey);
      });

  return (
    <div className="accessories-page-wrapper">
      {/* Hero Banner */}
      <div className="accessories-hero">
        <div className="accessories-hero-content">
          <span className="accessories-subtitle">FINEST DETAILS & ESSENTIALS</span>
          <h1>PREMIUM ACCESSORIES</h1>
          <p>Elevate your everyday wardrobe with our curated selection of luxury watches, genuine leather belts, sunglasses, and fragrances.</p>
        </div>
      </div>

      {/* Subcategory Navigation Tabs */}
      <div className="accessories-tabs-container">
        <div className="accessories-tabs">
          {ACCESSORY_CATEGORIES.map(tab => (
            <button
              key={tab.id}
              className={`accessory-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="accessories-content-container">
        {loading ? (
          <div className="accessories-loading">
            <p>Loading Accessories...</p>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="accessories-empty">
            <h3>No products found in this category</h3>
            <p>Check back soon or explore all accessories.</p>
            <button onClick={() => setActiveTab('ALL')} className="btn-reset-tab">
              VIEW ALL ACCESSORIES
            </button>
          </div>
        ) : (
          <div className="accessories-grid">
            {displayedProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                showOffer={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
