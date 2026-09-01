import { useState, useMemo, useEffect, useRef } from 'react';
import { useShop } from '../context/ShopContext';
import { getShopProducts } from '../services/productService';
import ProductCard from '../components/ProductCard';
import './ShopPage.css';

const CATEGORIES = ['All', 'T-Shirts', 'Shirts', 'Jeans', 'Trousers', 'Jackets', 'Hoodies', 'Ethnic Wear', 'Accessories'];
const PRICE_RANGES = [
  { label: 'All Prices', min: 0, max: Infinity },
  { label: 'Under ₹500', min: 0, max: 499 },
  { label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { label: '₹1,000 – ₹2,000', min: 1000, max: 2000 },
  { label: '₹2,000+', min: 2000, max: Infinity },
];
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const COLORS = ['Black', 'White', 'Blue', 'Grey', 'Beige', 'Brown'];
const SORT_OPTIONS = [
  { label: 'Featured', value: 'featured' },
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Best Selling', value: 'best-selling' },
];

export default function ShopPage() {
  const {
    products, setProducts,
    lastVisible, setLastVisible,
    hasMore, setHasMore,
    loading, setLoading,
    loadingMore, setLoadingMore,
    search, setSearch,
    category, setCategory,
    priceRange, setPriceRange,
    selectedSize, setSelectedSize,
    selectedColor, setSelectedColor,
    sortBy, setSortBy,
    scrollPosition, setScrollPosition
  } = useShop();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const mounted = useRef(false);

  // Fetch from Firestore
  const fetchProducts = async (isLoadMore = false) => {
    if (isLoadMore) {
      if (loadingMore || !hasMore) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getShopProducts(
        category,
        sortBy,
        isLoadMore ? lastVisible : null,
        12
      );

      if (result.products.length === 0 && !isLoadMore) {
        setHasMore(false);
        setProducts([]);
      } else if (result.products.length === 0 && isLoadMore) {
        setHasMore(false);
      } else {
        if (isLoadMore) {
          setProducts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newUnique = result.products.filter(p => !existingIds.has(p.id));
            return [...prev, ...newUnique];
          });
        } else {
          setProducts(result.products);
        }
        setLastVisible(result.lastVisible);
        setHasMore(result.hasMore);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial load or restore position
  useEffect(() => {
    if (products.length === 0) {
      fetchProducts(false);
    } else {
      // Products already exist in context, restore scroll position smoothly
      const position = scrollPosition || 0;
      requestAnimationFrame(() => {
        window.scrollTo({
          top: position,
          behavior: 'instant'
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save scroll position repeatedly before unmounting/navigating via a scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };
    // Debounce or just passive listener to keep track constantly
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [setScrollPosition]);

  // When filters that map to Firebase queries change, refetch!
  useEffect(() => {
    if (mounted.current) {
      // Only refetch if we are sorting or category-filtering, because these map to Firestore query.
      // Other filters are handled purely client-side on the fetched `products` array.
      setProducts([]);
      setLastVisible(null);
      setHasMore(true);
      fetchProducts(false);
    } else {
      mounted.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sortBy]); 

  // Client-side filtering for search, price ranges, sizes, colors
  const filtered = useMemo(() => {
    let result = [...products];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    // Price
    const range = PRICE_RANGES[priceRange];
    if (range) {
      result = result.filter(p => p.price >= range.min && p.price <= range.max);
    }

    // Size
    if (selectedSize) {
      result = result.filter(p => p.sizes && p.sizes.includes(selectedSize));
    }

    // Color
    if (selectedColor) {
      result = result.filter(p => p.colors && p.colors.includes(selectedColor));
    }

    return result;
  }, [products, search, priceRange, selectedSize, selectedColor]);

  const clearFilters = () => {
    setSearch('');
    setCategory('All');
    setPriceRange(0);
    setSelectedSize(null);
    setSelectedColor(null);
    setSortBy('featured');
  };

  const hasActiveFilters = search || category !== 'All' || priceRange !== 0 || selectedSize || selectedColor || sortBy !== 'featured';

  const handleAddToCart = (product) => {
    console.log('Added to cart:', product);
    // Cart integration point
  };

  return (
    <div className="shop-page">
      {/* Header */}
      <div className="shop-header">
        <span className="shop-header__label">COLLECTION</span>
        <h1 className="shop-header__title">SHOP ALL</h1>
        <p className="shop-header__subtitle">Discover our latest men's collection.</p>
      </div>

      {/* Controls */}
      <div className="shop-controls">
        {/* Search */}
        <div className="shop-search">
          <svg className="shop-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="shop-search__input"
            placeholder="Search men's clothing..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="shop-search__clear" onClick={() => setSearch('')} aria-label="Clear search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Filter Toggle (mobile) + Sort */}
        <div className="shop-controls__row">
          <button className="shop-filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"/>
              <line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/>
              <line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/>
              <line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
            Filters
          </button>

          <div className="shop-sort">
            <label className="shop-sort__label" htmlFor="sort-select">Sort:</label>
            <select
              id="sort-select"
              className="shop-sort__select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <span className="shop-count">
            {filtered.length} {filtered.length === 1 ? 'Product' : 'Products'}{hasActiveFilters ? ' Found' : ''}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className={`shop-filters ${filtersOpen ? 'shop-filters--open' : ''}`}>
        {/* Category */}
        <div className="shop-filters__group">
          <h4 className="shop-filters__heading">Category</h4>
          <div className="shop-filters__options">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`shop-filters__chip ${category === cat ? 'shop-filters__chip--active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Price */}
        <div className="shop-filters__group">
          <h4 className="shop-filters__heading">Price</h4>
          <div className="shop-filters__options">
            {PRICE_RANGES.map((range, i) => (
              <button
                key={range.label}
                className={`shop-filters__chip ${priceRange === i ? 'shop-filters__chip--active' : ''}`}
                onClick={() => setPriceRange(i)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div className="shop-filters__group">
          <h4 className="shop-filters__heading">Size</h4>
          <div className="shop-filters__options">
            {SIZES.map(size => (
              <button
                key={size}
                className={`shop-filters__chip shop-filters__chip--size ${selectedSize === size ? 'shop-filters__chip--active' : ''}`}
                onClick={() => setSelectedSize(selectedSize === size ? null : size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="shop-filters__group">
          <h4 className="shop-filters__heading">Color</h4>
          <div className="shop-filters__options">
            {COLORS.map(color => (
              <button
                key={color}
                className={`shop-filters__chip ${selectedColor === color ? 'shop-filters__chip--active' : ''}`}
                onClick={() => setSelectedColor(selectedColor === color ? null : color)}
              >
                {color}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <button className="shop-filters__clear" onClick={clearFilters}>
            Clear All Filters
          </button>
        )}
      </div>

      {/* Loading Initial Data */}
      {loading && products.length === 0 ? (
        <div className="shop-empty">
          <h3 className="shop-empty__title">Loading Products...</h3>
        </div>
      ) : (
        <>
          {/* Product Grid or Empty */}
          {filtered.length > 0 ? (
            <div className="shop-grid">
              {filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          ) : (
            <div className="shop-empty">
              <svg className="shop-empty__icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
              <h3 className="shop-empty__title">NO PRODUCTS FOUND</h3>
              <p className="shop-empty__text">Try changing your filters or search for another product.</p>
              <button className="shop-empty__clear" onClick={clearFilters}>CLEAR FILTERS</button>
            </div>
          )}

          {/* Load More Button */}
          {filtered.length > 0 && hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
              <button 
                className="shop-load-more" 
                onClick={() => fetchProducts(true)}
                disabled={loadingMore}
                style={{ 
                  padding: '12px 30px', 
                  background: 'var(--color-heading)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: loadingMore ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                {loadingMore ? 'LOADING MORE...' : 'LOAD MORE'}
              </button>
            </div>
          )}
          
          {filtered.length > 0 && !hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem', color: '#666', fontSize: '0.9rem' }}>
              No more products
            </div>
          )}
        </>
      )}
    </div>
  );
}
