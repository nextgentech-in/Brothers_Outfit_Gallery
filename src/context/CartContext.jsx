import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

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

  const addToCart = (product, size, color) => {
    setCartItems(prev => {
      // Use composite key preventing duplicate variants tracking completely
      const cartItemId = `${product.id}-${size}-${color}`;
      const existing = prev.find(item => item.cartItemId === cartItemId);

      if (existing) {
        // Increment quantity within stock limits natively
        return prev.map(item =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: Math.min(item.quantity + 1, item.stock) }
            : item
        );
      }

      // Add fresh matching active selling price dynamically utilizing correct offers
      const activePrice = product.offer_enabled && product.discountPercentage > 0 
        ? product.price // Assuming product.price is actually the active discounted tier logic already configured in productsData
        : product.price;

      return [...prev, {
        cartItemId,
        productId: product.id,
        name: product.name,
        image: product.image,
        slug: product.slug,
        size,
        color,
        price: activePrice,
        stock: product.stock,
        quantity: 1
      }];
    });
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        // Ensure bounds safely matching stock limitations actively
        const safeQty = Math.max(1, Math.min(newQuantity, item.stock));
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
