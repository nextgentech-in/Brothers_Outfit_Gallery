import { createContext, useContext, useState } from 'react';

const ShopContext = createContext();

export function useShop() {
  return useContext(ShopContext);
}

export function ShopProvider({ children }) {
  // Products and Pagination State
  const [products, setProducts] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [priceRange, setPriceRange] = useState(0);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [sortBy, setSortBy] = useState('newest');

  // Toggle helper for multi-selection
  const toggleSize = (size) => {
    setSelectedSizes(prev => 
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const toggleColor = (color) => {
    setSelectedColors(prev => 
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    );
  };

  // Scroll Preservation
  const [scrollPosition, setScrollPosition] = useState(0);

  // Reset function to clear state on fresh entry
  const resetShopState = () => {
    setProducts([]);
    setLastVisible(null);
    setHasMore(true);
    setLoading(true);
    setLoadingMore(false);

    setSearch('');
    setCategory('All');
    setPriceRange(0);
    setSelectedSizes([]);
    setSelectedColors([]);
    setSortBy('newest');
    
    setScrollPosition(0);
  };

  const value = {
    products, setProducts,
    lastVisible, setLastVisible,
    hasMore, setHasMore,
    loading, setLoading,
    loadingMore, setLoadingMore,
    search, setSearch,
    category, setCategory,
    priceRange, setPriceRange,
    selectedSizes, setSelectedSizes, toggleSize,
    selectedColors, setSelectedColors, toggleColor,
    // Backwards-compatible aliases
    selectedSize: selectedSizes[0] || null,
    setSelectedSize: (s) => setSelectedSizes(s ? [s] : []),
    selectedColor: selectedColors[0] || null,
    setSelectedColor: (c) => setSelectedColors(c ? [c] : []),
    sortBy, setSortBy,
    scrollPosition, setScrollPosition,
    resetShopState
  };

  return (
    <ShopContext.Provider value={value}>
      {children}
    </ShopContext.Provider>
  );
}
