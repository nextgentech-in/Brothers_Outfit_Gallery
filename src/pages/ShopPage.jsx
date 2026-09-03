import { useState, useMemo, useEffect, useRef } from 'react';
import { useShop } from '../context/ShopContext';
import { useCart } from '../context/CartContext';
import { getShopProducts } from '../services/productService';
import ProductCard from '../components/ProductCard';
import { getProductSizes, getProductColors } from '../utils/productUtils';
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
    selectedSizes = [], setSelectedSizes, toggleSize,
    selectedColors = [], setSelectedColors, toggleColor,
    sortBy, setSortBy,
    scrollPosition, setScrollPosition
  } = useShop();

  const { addToCart } = useCart();

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

    // Multi-Size Filter
    if (selectedSizes && selectedSizes.length > 0) {
      result = result.filter(p => {
        const pSizes = getProductSizes(p).map(s => s.toLowerCase());
        return selectedSizes.some(sz => pSizes.includes(sz.toLowerCase()));
      });
    }

    // Multi-Color Filter (Fixed! Checks objects, strings, variants)
    if (selectedColors && selectedColors.length > 0) {
      result = result.filter(p => {
        const pColors = getProductColors(p).map(c => c.toLowerCase());
        return selectedColors.some(clr => {
          const target = clr.toLowerCase();
          return pColors.some(pc => pc === target || pc.includes(target) || target.includes(pc));
        });
      });
    }

    return result;
  }, [products, search, priceRange, selectedSizes, selectedColors]);

  const clearFilters = () => {
    setSearch('');
    setCategory('All');
    setPriceRange(0);
    if (setSelectedSizes) setSelectedSizes([]);
    if (setSelectedColors) setSelectedColors([]);
    setSortBy('featured');
  };

  const hasActiveFilters = Boolean(
    search ||
    category !== 'All' ||
    priceRange !== 0 ||
    (selectedSizes && selectedSizes.length > 0) ||
    (selectedColors && selectedColors.length > 0) ||
    sortBy !== 'featured'
  );

  const handleAddToCart = (productData) => {
    const size = productData.selectedSize || (productData.sizes && productData.sizes[0]) || 'Default';
    const color = productData.colors?.[0]?.name || productData.variants?.[0]?.color || 'Default';
    addToCart(productData, size, color);
    
    // Optional: could implement a toast notification here later
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 className="shop-filters__heading" style={{ margin: 0 }}>Size</h4>
            {selectedSizes.length > 0 && (
              <button 
                type="button"
                onClick={() => setSelectedSizes([])} 
                style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                Clear ({selectedSizes.length})
              </button>
            )}
          </div>
          <div className="shop-filters__options">
            {SIZES.map(size => {
              const isActive = selectedSizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  className={`shop-filters__chip shop-filters__chip--size ${isActive ? 'shop-filters__chip--active' : ''}`}
                  onClick={() => toggleSize(size)}
                >
                  {size} {isActive ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color */}
        <div className="shop-filters__group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 className="shop-filters__heading" style={{ margin: 0 }}>Color</h4>
            {selectedColors.length > 0 && (
              <button 
                type="button"
                onClick={() => setSelectedColors([])} 
                style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                Clear ({selectedColors.length})
              </button>
            )}
          </div>
          <div className="shop-filters__options">
            {COLORS.map(color => {
              const isActive = selectedColors.includes(color);
              return (
                <button
                  key={color}
                  type="button"
                  className={`shop-filters__chip ${isActive ? 'shop-filters__chip--active' : ''}`}
                  onClick={() => toggleColor(color)}
                >
                  {color} {isActive ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {hasActiveFilters && (
          <button type="button" className="shop-filters__clear" onClick={clearFilters}>
            Clear All Filters
          </button>
        )}
      </div>

      {/* Active Filter Tags Bar */}
      {hasActiveFilters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '0 24px 16px', maxWidth: '1440px', margin: '0 auto' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b' }}>
            Active Filters:
          </span>
          {category !== 'All' && (
            <span style={{ fontSize: '12px', background: '#0f172a', color: '#ffffff', padding: '3px 10px', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Category: {category}
              <button type="button" onClick={() => setCategory('All')} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', padding: 0 }}>✕</button>
            </span>
          )}
          {priceRange !== 0 && PRICE_RANGES[priceRange] && (
            <span style={{ fontSize: '12px', background: '#0f172a', color: '#ffffff', padding: '3px 10px', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Price: {PRICE_RANGES[priceRange].label}
              <button type="button" onClick={() => setPriceRange(0)} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', padding: 0 }}>✕</button>
            </span>
          )}
          {selectedSizes.map(size => (
            <span key={size} style={{ fontSize: '12px', background: '#0f172a', color: '#ffffff', padding: '3px 10px', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Size: {size}
              <button type="button" onClick={() => toggleSize(size)} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', padding: 0 }}>✕</button>
            </span>
          ))}
          {selectedColors.map(color => (
            <span key={color} style={{ fontSize: '12px', background: '#0f172a', color: '#ffffff', padding: '3px 10px', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Color: {color}
              <button type="button" onClick={() => toggleColor(color)} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', padding: 0 }}>✕</button>
            </span>
          ))}
          <button 
            type="button" 
            onClick={clearFilters}
            style={{ fontSize: '11.5px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '3px 10px', borderRadius: '14px', cursor: 'pointer', fontWeight: '700' }}
          >
            Reset All
          </button>
        </div>
      )}

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
