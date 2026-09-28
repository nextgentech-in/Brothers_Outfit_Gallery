import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchAllActiveProducts } from '../services/productService';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

// Format variant objects like { name: "Black", hex: "#0000" } to pure strings
function formatVariantValue(val, fallback = 'Standard') {
  if (!val) return fallback;
  if (typeof val === 'object' && val !== null) {
    return val.name || val.color || val.label || fallback;
  }
  return String(val);
}

// Helper to detect and prune legacy/dummy items from old development sessions
function isLegacyDummyItem(item) {
  if (!item || !item.id) return true;
  if (typeof item.id === 'number' || (typeof item.id === 'string' && /^\d+$/.test(item.id))) return true;
  if (item.name === 'Shirt' && (!item.slug || item.slug === 'shirt' || item.image?.includes('placehold'))) return true;
  return false;
}

export const CartProvider = ({ children }) => {
  const { currentUser } = useAuth() || {};
  const [cartItems, setCartItems] = useState(() => {
    try {
      const persisted = localStorage.getItem('brothers_cart');
      if (persisted) {
        const parsed = JSON.parse(persisted);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => !isLegacyDummyItem(item));
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  // Sold-Out notification modal state
  const [soldOutModalData, setSoldOutModalData] = useState(null);
  const dismissSoldOutModal = () => setSoldOutModalData(null);

  // Validate cart items against latest inventory in Firestore
  const validateCartStock = useCallback(async () => {
    const rawCart = cartItems.filter(item => !isLegacyDummyItem(item));
    if (rawCart.length === 0) return;

    try {
      const allProducts = await fetchAllActiveProducts(true);
      if (!allProducts || allProducts.length === 0) return;

      const productMap = new Map();
      allProducts.forEach(p => {
        if (p.id) productMap.set(String(p.id).trim(), p);
        if (p.slug) productMap.set(String(p.slug).trim().toLowerCase(), p);
      });

      const soldOutList = [];
      const updatedCart = [];

      for (const item of rawCart) {
        const itemKey = item.productId || item.id;
        const itemSlug = item.slug ? String(item.slug).trim().toLowerCase() : null;
        const product = productMap.get(String(itemKey).trim()) || (itemSlug ? productMap.get(itemSlug) : null);

        let isSoldOut = false;

        if (!product) {
          isSoldOut = true;
        } else if (product.active === false || product.inStock === false) {
          isSoldOut = true;
        } else if (Array.isArray(product.variants) && product.variants.length > 0 && item.size) {
          const cleanSize = String(item.size).trim().toLowerCase();
          const cleanColor = item.color ? String(item.color).trim().toLowerCase() : null;

          let v = product.variants.find(variant => {
            const vSize = String(variant.size || '').trim().toLowerCase();
            if (vSize !== cleanSize) return false;
            if (!cleanColor) return true;
            const vCol = String(variant.color || '').trim().toLowerCase();
            return vCol === cleanColor || vCol === 'standard' || vCol === 'default';
          }) || product.variants.find(variant => String(variant.size || '').trim().toLowerCase() === cleanSize);

          const variantStock = v ? (parseInt(v.stock ?? v.quantity, 10) || 0) : 0;
          if (!v || variantStock <= 0) {
            isSoldOut = true;
          }
        } else {
          const totalStock = parseInt(product.stock ?? product.quantity, 10) || 0;
          if (totalStock <= 0) {
            isSoldOut = true;
          }
        }

        if (isSoldOut) {
          soldOutList.push({
            ...item,
            name: product?.name || item.name || 'Item',
            image: item.image || product?.thumbnailUrl || product?.image
          });
        } else {
          updatedCart.push(item);
        }
      }

      if (soldOutList.length > 0) {
        setCartItems(updatedCart);
        try {
          localStorage.setItem('brothers_cart', JSON.stringify(updatedCart));
        } catch {}
        setSoldOutModalData({
          message: "Your added product sold out explore other products",
          items: soldOutList
        });
      }
    } catch (err) {
      console.warn('Error validating cart stock:', err);
    }
  }, [cartItems]);

  // Track user login events to validate cart immediately when logging in
  const prevUserRef = useRef(null);
  useEffect(() => {
    if (currentUser?.uid) {
      if (prevUserRef.current !== currentUser.uid) {
        prevUserRef.current = currentUser.uid;
        // User logged in — validate their cart items!
        validateCartStock();
      }
    } else {
      prevUserRef.current = null;
    }
  }, [currentUser, validateCartStock]);

  // Also validate on initial page load if cart has items
  const initialValidatedRef = useRef(false);
  useEffect(() => {
    if (!initialValidatedRef.current && cartItems.length > 0) {
      initialValidatedRef.current = true;
      validateCartStock();
    }
  }, [cartItems.length, validateCartStock]);

  // Ensure cart changes (add, remove, update qty, clear) are continuously synced to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('brothers_cart', JSON.stringify(cartItems));
    } catch (e) {
      console.warn('Failed to sync cart to localStorage:', e);
    }
  }, [cartItems]);

  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [cartToast, setCartToast] = useState(null);

  const openCartDrawer = () => {
    setIsCartDrawerOpen(true);
    validateCartStock();
  };
  const closeCartDrawer = () => setIsCartDrawerOpen(false);

  const showToast = (item) => {
    setCartToast(item);
  };

  const hideToast = () => setCartToast(null);

  useEffect(() => {
    if (cartToast) {
      const timer = setTimeout(() => setCartToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [cartToast]);

  const resolveItemPrice = (product, safeSize, safeColor, explicitPrice = null) => {
    if (explicitPrice !== null && explicitPrice !== undefined && !isNaN(Number(explicitPrice))) {
      return Number(explicitPrice);
    }
    const matched = product.variants?.find(v =>
      v.size === safeSize && (!v.color || v.color === safeColor || v.color === 'Standard' || v.color === 'Default')
    ) || product.variants?.find(v => v.size === safeSize);

    if (matched && matched.price !== undefined && matched.price !== '' && !isNaN(Number(matched.price))) {
      return Number(matched.price);
    }
    if (matched && matched.salePrice !== undefined && matched.salePrice !== '' && !isNaN(Number(matched.salePrice))) {
      return Number(matched.salePrice);
    }

    return product.offer_enabled && product.discountPercentage > 0 
      ? (product.price || 0)
      : (product.salePrice || product.price || 0);
  };

  const resolveItemStock = (product, safeSize, safeColor) => {
    const matched = product.variants?.find(v =>
      v.size === safeSize && (!v.color || v.color === safeColor || v.color === 'Standard' || v.color === 'Default')
    ) || product.variants?.find(v => v.size === safeSize);

    if (matched && matched.stock !== undefined && !isNaN(Number(matched.stock))) {
      return Number(matched.stock);
    }
    return product.stock || 50;
  };

  const addToCart = (product, size, color, quantity = 1, explicitPrice = null) => {
    const safeColor = formatVariantValue(color, 'Standard');
    const safeSize = formatVariantValue(size, 'One Size');
    const activePrice = resolveItemPrice(product, safeSize, safeColor, explicitPrice);
    const itemStock = resolveItemStock(product, safeSize, safeColor);

    setCartItems(prev => {
      // Use composite key preventing duplicate variants tracking completely
      const cartItemId = `${product.id}-${safeSize}-${safeColor}`;
      const existing = prev.find(item => item.cartItemId === cartItemId);

      if (existing) {
        // Increment quantity within stock limits natively
        return prev.map(item =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: Math.min(item.quantity + quantity, item.stock || 99), price: activePrice }
            : item
        );
      }

      return [...prev, {
        cartItemId,
        id: product.id,
        productId: product.id,
        name: product.name,
        image: product.image || product.thumbnailUrl,
        slug: product.slug,
        size: safeSize,
        color: safeColor,
        price: activePrice,
        stock: itemStock,
        quantity: Math.max(1, quantity)
      }];
    });

    showToast({
      id: product.id,
      name: product.name,
      image: product.image || product.thumbnailUrl || (product.images?.[0]?.url || product.images?.[0]),
      size: safeSize,
      color: safeColor,
      price: activePrice,
      quantity
    });
  };

  // Direct Buy Now: Replaces cart with ONLY this single product
  const buyNowDirect = (product, size, color, quantity = 1, explicitPrice = null) => {
    const safeColor = formatVariantValue(color, 'Standard');
    const safeSize = formatVariantValue(size, 'One Size');
    const activePrice = resolveItemPrice(product, safeSize, safeColor, explicitPrice);
    const itemStock = resolveItemStock(product, safeSize, safeColor);

    const singleItem = {
      cartItemId: `${product.id}-${safeSize}-${safeColor}`,
      id: product.id,
      productId: product.id,
      name: product.name,
      image: product.image || product.thumbnailUrl,
      slug: product.slug,
      size: safeSize,
      color: safeColor,
      price: activePrice,
      stock: itemStock,
      quantity: Math.max(1, quantity)
    };

    setCartItems([singleItem]);
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const safeQty = Math.max(1, Math.min(newQuantity, item.stock || 99));
        return { ...item, quantity: safeQty };
      }
      return item;
    }));
  };

  const removeFromCart = (cartItemId) => {
    setCartItems(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const [appliedCoupon, setAppliedCoupon] = useState(() => {
    try {
      const persisted = sessionStorage.getItem('brothers_applied_coupon');
      return persisted ? JSON.parse(persisted) : null;
    } catch (e) {
      return null;
    }
  });

  const applyCoupon = (couponResult) => {
    setAppliedCoupon(couponResult);
    try {
      sessionStorage.setItem('brothers_applied_coupon', JSON.stringify(couponResult));
    } catch (e) {}
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    try {
      sessionStorage.removeItem('brothers_applied_coupon');
    } catch (e) {}
  };

  const clearCart = () => {
    setCartItems([]);
    removeCoupon();
  };

  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      buyNowDirect,
      updateQuantity,
      removeFromCart,
      clearCart,
      totalItems,
      cartSubtotal,
      appliedCoupon,
      applyCoupon,
      removeCoupon,
      isCartDrawerOpen,
      openCartDrawer,
      closeCartDrawer,
      cartToast,
      hideToast,
      soldOutModalData,
      dismissSoldOutModal,
      validateCartStock
    }}>
      {children}
    </CartContext.Provider>
  );
};

