import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

export const WishlistProvider = ({ children }) => {
  const { currentUser } = useAuth() || {};
  const [wishlistItems, setWishlistItems] = useState(() => {
    try {
      const persisted = localStorage.getItem('brothers_wishlist');
      return persisted ? JSON.parse(persisted) : [];
    } catch {
      return [];
    }
  });

  // Sync with Firestore when currentUser changes
  useEffect(() => {
    let isMounted = true;
    if (currentUser?.uid) {
      import('../services/userService')
        .then(({ getWishlist }) => getWishlist(currentUser.uid))
        .then(remoteItems => {
          if (!isMounted || !remoteItems) return;
          setWishlistItems(prev => {
            // Merge remote items with local items
            const map = new Map();
            prev.forEach(item => map.set(item.id || item.productId, item));
            remoteItems.forEach(item => map.set(item.id || item.productId, item));
            const merged = Array.from(map.values());
            localStorage.setItem('brothers_wishlist', JSON.stringify(merged));
            return merged;
          });
        })
        .catch(err => console.warn('Could not fetch remote wishlist:', err));
    }
    return () => { isMounted = false; };
  }, [currentUser]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('brothers_wishlist', JSON.stringify(wishlistItems));
    } catch {
      // Ignore quota errors
    }
  }, [wishlistItems]);

  const isInWishlist = useCallback((productId) => {
    if (!productId) return false;
    return wishlistItems.some(item => (item.id === productId || item.productId === productId));
  }, [wishlistItems]);

  const toggleWishlist = useCallback(async (product) => {
    if (!product || !product.id) return;

    const exists = isInWishlist(product.id);

    if (exists) {
      setWishlistItems(prev => prev.filter(item => (item.id !== product.id && item.productId !== product.id)));
      if (currentUser?.uid) {
        try {
          const { removeFromWishlist } = await import('../services/userService');
          await removeFromWishlist(currentUser.uid, product.id);
        } catch (err) {
          console.warn('Failed to remove from remote wishlist:', err);
        }
      }
    } else {
      const itemToSave = {
        id: product.id,
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price || product.salePrice || 0,
        mrp: product.mrp || product.compareAtPrice || 0,
        image: product.image || product.thumbnailUrl || (product.images?.[0]?.url || product.images?.[0]) || '',
        category: product.category || '',
        sizes: product.sizes || (product.variants ? [...new Set(product.variants.map(v => v.size))] : []),
        stock: product.stock !== undefined ? product.stock : 10
      };

      setWishlistItems(prev => [itemToSave, ...prev.filter(item => item.id !== product.id)]);

      if (currentUser?.uid) {
        try {
          const { addToWishlist } = await import('../services/userService');
          await addToWishlist(currentUser.uid, itemToSave);
        } catch (err) {
          console.warn('Failed to add to remote wishlist:', err);
        }
      }
    }
  }, [currentUser, isInWishlist]);

  const removeWishlist = useCallback(async (productId) => {
    if (!productId) return;
    setWishlistItems(prev => prev.filter(item => (item.id !== productId && item.productId !== productId)));
    if (currentUser?.uid) {
      try {
        const { removeFromWishlist } = await import('../services/userService');
        await removeFromWishlist(currentUser.uid, productId);
      } catch (err) {
        console.warn('Failed to remove from remote wishlist:', err);
      }
    }
  }, [currentUser]);

  const clearWishlist = useCallback(() => {
    setWishlistItems([]);
    try {
      localStorage.removeItem('brothers_wishlist');
    } catch {}
  }, []);

  return (
    <WishlistContext.Provider value={{
      wishlistItems,
      wishlistCount: wishlistItems.length,
      isInWishlist,
      toggleWishlist,
      removeFromWishlist: removeWishlist,
      clearWishlist
    }}>
      {children}
    </WishlistContext.Provider>
  );
};
