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
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

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
    setSelectedSize(null);
    setSelectedColor(null);
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
    selectedSize, setSelectedSize,
    selectedColor, setSelectedColor,
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
