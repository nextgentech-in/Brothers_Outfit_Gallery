import { collection, query, where, orderBy, limit, startAfter, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const PRODUCTS = 'products';
const CATEGORIES = 'categories';

export const getShopProducts = async (category = 'All', sortBy = 'newest', lastDocSnap = null, pageSize = 12) => {
  // To avoid Firebase Composite Index requirement errors blocking the UI, 
  // we fetch recent active products and sort/filter them client-side.
  const q = query(collection(db, PRODUCTS), orderBy('createdAt', 'desc'), limit(100));
  const snapshot = await getDocs(q);

  let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // 1. Filter active
  products = products.filter(p => p.active === true);

  // 2. Filter Category
  if (category !== 'All') {
    products = products.filter(p => p.category === category || p.categoryId === category);
  }

  // 3. Sort
  products.sort((a, b) => {
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
    const timeA = a.createdAt?.seconds || 0;
    const timeB = b.createdAt?.seconds || 0;
    return timeB - timeA;
  });

  // Client-side pagination mock
  return {
    products,
    lastVisible: null,
    hasMore: false
  };
};

export const getNewArrivals = async (qty = 4) => {
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  // Single query avoid composite index
  const q = query(collection(db, PRODUCTS), orderBy('createdAt', 'desc'), limit(100));
  const snapshot = await getDocs(q);

  let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  products = products.filter(p => p.active === true);

  // Filter by date dynamically 
  products = products.filter(p => {
    if (!p.createdAt) return true;
    const created = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
    return created >= tenDaysAgo;
  });

  products.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  return products.slice(0, qty);
};

export const getSaleProducts = async (qty = 4) => {
  const now = new Date();
  const q = query(collection(db, PRODUCTS), orderBy('createdAt', 'desc'), limit(100));
  const snapshot = await getDocs(q);

  let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter locally
  products = products.filter(p => {
    if (!p.active || !p.offerEnabled) return false;

    const end = p.offerEndAt ? (p.offerEndAt.toDate ? p.offerEndAt.toDate() : new Date(p.offerEndAt)) : null;
    const start = p.offerStartAt ? (p.offerStartAt.toDate ? p.offerStartAt.toDate() : new Date(p.offerStartAt)) : null;

    if (end && end <= now) return false;
    if (start && start > now) return false;

    return true;
  });

  return products.slice(0, qty);
};

export const getProductBySlug = async (slug) => {
  const q = query(collection(db, PRODUCTS), where('slug', '==', slug), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

export const getRelatedProducts = async (categoryOrId, excludeProductId, qty = 4) => {
  try {
    const q = query(collection(db, PRODUCTS), orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    let all = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => p.active !== false && p.id !== excludeProductId);

    if (!categoryOrId) return all.slice(0, qty);

    const target = String(categoryOrId).toLowerCase().trim();
    let matches = all.filter(p => {
      const pCat = String(p.category || '').toLowerCase().trim();
      const pCatId = String(p.categoryId || '').toLowerCase().trim();
      return pCat === target || pCatId === target;
    });

    if (matches.length < qty) {
      const matchIds = new Set(matches.map(m => m.id));
      const backfill = all.filter(p => !matchIds.has(p.id));
      matches = [...matches, ...backfill];
    }

    return matches.slice(0, qty);
  } catch (err) {
    console.error('Error in getRelatedProducts:', err);
    return [];
  }
};

export const getCategories = async () => {
  const q = query(
    collection(db, CATEGORIES),
    where('active', '==', true),
    orderBy('displayOrder', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
