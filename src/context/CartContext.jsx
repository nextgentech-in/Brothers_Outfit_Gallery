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

  useEffect(() => {
    localStorage.setItem('brothers_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product, size, color, quantity = 1) => {
    const safeColor = formatVariantValue(color, 'Standard');
    const safeSize = formatVariantValue(size, 'One Size');

    setCartItems(prev => {
      // Use composite key preventing duplicate variants tracking completely
      const cartItemId = `${product.id}-${safeSize}-${safeColor}`;
      const existing = prev.find(item => item.cartItemId === cartItemId);

      if (existing) {
        // Increment quantity within stock limits natively
        return prev.map(item =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: Math.min(item.quantity + quantity, item.stock || 99) }
            : item
        );
      }

      const activePrice = product.offer_enabled && product.discountPercentage > 0 
        ? product.price 
        : (product.salePrice || product.price || 0);

      return [...prev, {
        cartItemId,
        productId: product.id,
        name: product.name,
        image: product.image || product.thumbnailUrl,
        slug: product.slug,
        size: safeSize,
        color: safeColor,
        price: activePrice,
        stock: product.stock || 50,
        quantity: Math.max(1, quantity)
      }];
    });
  };

  // Direct Buy Now: Replaces cart with ONLY this single product
  const buyNowDirect = (product, size, color, quantity = 1) => {
    const safeColor = formatVariantValue(color, 'Standard');
    const safeSize = formatVariantValue(size, 'One Size');

    const activePrice = product.offer_enabled && product.discountPercentage > 0 
      ? product.price 
      : (product.salePrice || product.price || 0);

    const singleItem = {
      cartItemId: `${product.id}-${safeSize}-${safeColor}`,
      productId: product.id,
      name: product.name,
      image: product.image || product.thumbnailUrl,
      slug: product.slug,
      size: safeSize,
      color: safeColor,
      price: activePrice,
      stock: product.stock || 50,
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

  const clearCart = () => setCartItems([]);

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
      cartSubtotal
    }}>
      {children}
    </CartContext.Provider>
  );
};

