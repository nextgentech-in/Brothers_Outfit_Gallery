import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useShop } from '../context/ShopContext';
import { useCart } from '../context/CartContext';
import { getShopProducts } from '../services/productService';
import ProductCard from '../components/ProductCard';
import { getProductSizes, getProductColors } from '../utils/productUtils';
import './ShopPage.css';

const CATEGORIES = ['All', 'T-Shirts', 'Shirts', 'Jeans', 'Trousers', 'Shorts', 'Jackets', 'Hoodies', 'Ethnic Wear', 'Slippers', 'Perfumes', 'Accessories', 'Watches', 'Wallets', 'Belts'];

const SUB_CATEGORIES = {
  'T-Shirts': ['All', 'Oversized', 'Regular Fit', 'Slim Fit', 'Polo', 'Graphic', 'Drop Shoulder', 'Acid Wash', 'Henley'],
  'Shirts': ['All', 'Casual', 'Formal', 'Printed', 'Linen', 'Denim', 'Oxford', 'Mandarin Collar', 'Half Sleeve'],
  'Jeans': ['All', 'Skinny', 'Slim Fit', 'Regular', 'Baggy', 'Wide Leg', 'Ripped', 'Bootcut', 'Tapered'],
  'Trousers': ['All', 'Cargo', 'Chino', 'Jogger', 'Formal', 'Pleated', 'Straight Fit', 'Slim Fit'],
  'Shorts': ['All', 'Cargo', 'Chino', 'Denim', 'Sports', 'Casual', 'Bermuda', 'Running'],
  'Jackets': ['All', 'Bomber', 'Denim', 'Puffer', 'Windbreaker', 'Varsity', 'Leather', 'Quilted'],
  'Hoodies': ['All', 'Pullover', 'Zip-Up', 'Cropped', 'Oversized', 'Sleeveless', 'Graphic'],
  'Ethnic Wear': ['All', 'Kurta', 'Sherwani', 'Pathani Suit', 'Nehru Jacket', 'Dhoti Set'],
  'Slippers': ['All', 'Slides', 'Flip Flops', 'Sports', 'Casual', 'Platform', 'Memory Foam'],
  'Perfumes': ['All', 'Eau de Parfum', 'Eau de Toilette', 'Body Spray', 'Attar', 'Air Freshener', 'Room Freshener'],
  'Accessories': ['All', 'Cap', 'Belt', 'Sunglasses', 'Bracelet', 'Ring', 'Chain', 'Keychain'],
  'Watches': ['All', 'Analog', 'Digital', 'Smart Watch', 'Chronograph'],
  'Wallets': ['All', 'Bifold', 'Trifold', 'Card Holder', 'Money Clip'],
  'Belts': ['All', 'Leather', 'Canvas', 'Reversible', 'Auto-Lock'],
};

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
  const [searchParams] = useSearchParams();
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
  const [subCategory, setSubCategory] = useState('All');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [displayLimit, setDisplayLimit] = useState(12);

  // Sync URL search parameters if arriving from links
  useEffect(() => {
    const urlCategory = searchParams.get('category');
    const urlSearch = searchParams.get('search');
    const urlSort = searchParams.get('sort');

    if (urlCategory) {
      setCategory(prev => prev !== urlCategory ? urlCategory : prev);
    }
    if (urlSearch) {
      setSearch(prev => prev !== urlSearch ? urlSearch : prev);
    }
    if (urlSort) {
      setSortBy(prev => prev !== urlSort ? urlSort : prev);
    }
  }, [searchParams, setCategory, setSearch, setSortBy]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset displayLimit on filter change
  useEffect(() => {
    setDisplayLimit(12);
  }, [category, subCategory, debouncedSearch, priceRange, selectedSizes, selectedColors, sortBy]);

  // Fetch complete active catalog from Firestore/cache once
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const result = await getShopProducts(
        'All',
        'newest',
        null,
        500
      );

      setProducts(result.products || []);
      setHasMore(false);
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
      fetchProducts();
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
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [setScrollPosition]); 

  // Reset sub-category when category changes
  useEffect(() => {
    setSubCategory('All');
  }, [category]);

  // Comprehensive catalog filtering for category, search, price ranges, sizes, colors, and sorting
  const filtered = useMemo(() => {
    let result = [...products];

    // Category Filter
    if (category && category !== 'All') {
      const catLower = category.toLowerCase().trim();
      result = result.filter(p => {
        const pCat = String(p.category || '').toLowerCase().trim();
        const pCatId = String(p.categoryId || '').toLowerCase().trim();
        return pCat === catLower || pCatId === catLower;
      });
    }

    // Sub-Category Filter
    if (subCategory && subCategory !== 'All') {
      result = result.filter(p => {
        const pSub = (p.subCategory || '').toLowerCase();
        return pSub === subCategory.toLowerCase();
      });
    }

    // Search (debounced across title, category, subCategory, and SKU)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      result = result.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.subCategory && p.subCategory.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    // Price
    const range = PRICE_RANGES[priceRange];
    if (range) {
      result = result.filter(p => {
        const itemPrice = p.salePrice || p.price || 0;
        return itemPrice >= range.min && itemPrice <= range.max;
      });
    }

    // Multi-Size Filter
    if (selectedSizes && selectedSizes.length > 0) {
      result = result.filter(p => {
        const pSizes = getProductSizes(p).map(s => s.toLowerCase());
        return selectedSizes.some(sz => pSizes.includes(sz.toLowerCase()));
      });
    }

    // Multi-Color Filter (checks objects, strings, variants)
    if (selectedColors && selectedColors.length > 0) {
      result = result.filter(p => {
        const pColors = getProductColors(p).map(c => c.toLowerCase());
        return selectedColors.some(clr => {
          const target = clr.toLowerCase();
          return pColors.some(pc => pc === target || pc.includes(target) || target.includes(pc));
        });
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'price-asc') {
        const pA = a.salePrice || a.price || 0;
        const pB = b.salePrice || b.price || 0;
        return pA - pB;
      }
      if (sortBy === 'price-desc') {
        const pA = a.salePrice || a.price || 0;
        const pB = b.salePrice || b.price || 0;
        return pB - pA;
      }
      if (sortBy === 'best-selling') {
        return (b.rating || 0) - (a.rating || 0);
      }
      // Default newest
      const timeA = a.createdAt?.seconds || (typeof a.createdAt === 'number' ? a.createdAt : 0);
      const timeB = b.createdAt?.seconds || (typeof b.createdAt === 'number' ? b.createdAt : 0);
      return timeB - timeA;
    });

    return result;
  }, [products, category, subCategory, debouncedSearch, priceRange, selectedSizes, selectedColors, sortBy]);

  const clearFilters = () => {
    setSearch('');
    setCategory('All');
    setPriceRange(0);
    if (setSelectedSizes) setSelectedSizes([]);
    if (setSelectedColors) setSelectedColors([]);
    setSortBy('featured');
    setSubCategory('All');
  };

  const hasActiveFilters = Boolean(
    search ||
    category !== 'All' ||
    priceRange !== 0 ||
    (selectedSizes && selectedSizes.length > 0) ||
    (selectedColors && selectedColors.length > 0) ||
    sortBy !== 'featured' ||
    (subCategory && subCategory !== 'All')
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
        <h1 className="shop-header__title">Shop All</h1>
        <p className="shop-header__subtitle">Discover our latest menswear collection.</p>
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
          <button 
            type="button"
            className="shop-filter-toggle" 
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            aria-controls="shop-filters-panel"
            aria-label={filtersOpen ? "Hide product filters" : "Show product filters"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
              aria-label="Sort products by"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <span className="shop-count" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? 'Product' : 'Products'}{hasActiveFilters ? ' Found' : ''}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div 
        id="shop-filters-panel"
        className={`shop-filters ${filtersOpen ? 'shop-filters--open' : ''}`}
        role="region"
        aria-label="Product catalog filters"
      >
        {/* Category */}
        <div className="shop-filters__group">
          <h4 className="shop-filters__heading">Category</h4>
          <div className="shop-filters__options" role="group" aria-label="Filter by category">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                className={`shop-filters__chip ${category === cat ? 'shop-filters__chip--active' : ''}`}
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                aria-label={`Category ${cat}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-Category (shown when a category with sub-types is selected) */}
        {category !== 'All' && SUB_CATEGORIES[category] && (
          <div className="shop-filters__group">
            <h4 className="shop-filters__heading">Type / Fit</h4>
            <div className="shop-filters__options" role="group" aria-label="Filter by type or fit">
              {SUB_CATEGORIES[category].map(sub => (
                <button
                  key={sub}
                  type="button"
                  className={`shop-filters__chip ${subCategory === sub ? 'shop-filters__chip--active' : ''}`}
                  onClick={() => setSubCategory(sub)}
                  aria-pressed={subCategory === sub}
                  aria-label={`Type ${sub}`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price */}
        <div className="shop-filters__group">
          <h4 className="shop-filters__heading">Price</h4>
          <div className="shop-filters__options" role="group" aria-label="Filter by price range">
            {PRICE_RANGES.map((range, i) => (
              <button
                key={range.label}
                type="button"
                className={`shop-filters__chip ${priceRange === i ? 'shop-filters__chip--active' : ''}`}
                onClick={() => setPriceRange(i)}
                aria-pressed={priceRange === i}
                aria-label={`Price range ${range.label}`}
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
                aria-label="Clear selected sizes"
              >
                Clear ({selectedSizes.length})
              </button>
            )}
          </div>
          <div className="shop-filters__options" role="group" aria-label="Filter by size">
            {SIZES.map(size => {
              const isActive = selectedSizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  className={`shop-filters__chip shop-filters__chip--size ${isActive ? 'shop-filters__chip--active' : ''}`}
                  onClick={() => toggleSize(size)}
                  aria-pressed={isActive}
                  aria-label={`Size ${size}`}
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
                aria-label="Clear selected colors"
              >
                Clear ({selectedColors.length})
              </button>
            )}
          </div>
          <div className="shop-filters__options" role="group" aria-label="Filter by color">
            {COLORS.map(color => {
              const isActive = selectedColors.includes(color);
              return (
                <button
                  key={color}
                  type="button"
                  className={`shop-filters__chip ${isActive ? 'shop-filters__chip--active' : ''}`}
                  onClick={() => toggleColor(color)}
                  aria-pressed={isActive}
                  aria-label={`Color ${color}`}
                >
                  {color} {isActive ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {hasActiveFilters && (
          <button 
            type="button" 
            className="shop-filters__clear" 
            onClick={clearFilters}
            aria-label="Clear all applied filters"
          >
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
        <div className="shop-grid">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="product-skeleton" />
          ))}
        </div>
      ) : (
        <>
          {/* Product Grid or Empty */}
          {filtered.length > 0 ? (
            <div className="shop-grid">
              {filtered.slice(0, displayLimit).map(product => (
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
              <h3 className="shop-empty__title">No Products Found</h3>
              <p className="shop-empty__text">
                {debouncedSearch.trim() && category !== 'All' 
                  ? `No matching items found in "${category}".` 
                  : 'Try changing your filters or searching for a different item.'}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
                {debouncedSearch.trim() && category !== 'All' && (
                  <button 
                    type="button" 
                    className="shop-empty__clear" 
                    onClick={() => setCategory('All')}
                    style={{ background: 'var(--color-charcoal, #111111)', color: 'var(--color-ivory, #F7F4EE)' }}
                  >
                    Search All Categories for "{debouncedSearch}"
                  </button>
                )}
                <button type="button" className="shop-empty__clear" onClick={clearFilters}>
                  Clear All Filters
                </button>
              </div>
            </div>
          )}

          {/* Load More Button */}
          {filtered.length > displayLimit && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
              <button 
                className="shop-load-more" 
                onClick={() => setDisplayLimit(prev => prev + 12)}
                style={{ 
                  padding: '12px 30px', 
                  background: 'var(--color-charcoal, #111111)', 
                  color: 'var(--color-ivory, #F7F4EE)', 
                  border: 'none', 
                  borderRadius: 'var(--radius-sm, 4px)',
                  cursor: 'pointer',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  fontSize: '12px'
                }}
              >
                Load More ({filtered.length - displayLimit} Remaining)
              </button>
            </div>
          )}
          
          {filtered.length > 0 && filtered.length <= displayLimit && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem', color: '#666', fontSize: '0.9rem' }}>
              Showing all {filtered.length} products
            </div>
          )}
        </>
      )}
    </div>
  );
}
