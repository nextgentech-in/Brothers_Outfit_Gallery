import { createContext, useContext, useState, useEffect } from 'react';

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

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const persisted = localStorage.getItem('brothers_cart');
      return persisted ? JSON.parse(persisted) : [];
    } catch (e) {
      return [];
    }
  });

  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [cartToast, setCartToast] = useState(null);

  const openCartDrawer = () => setIsCartDrawerOpen(true);
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
      hideToast
    }}>
      {children}
    </CartContext.Provider>
  );
};

