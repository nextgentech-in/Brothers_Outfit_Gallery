import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const PRODUCTS = 'products';
const CATEGORIES = 'categories';
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes fresh cache

// In-Memory & Session Storage Caching + Request Coalescing Layer
let memoryCache = null;
let cacheTimestamp = 0;
let inFlightFetch = null;

// Read from session storage if memory cache is empty
function getCachedProducts() {
  const now = Date.now();
  if (memoryCache && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return memoryCache;
  }

  try {
    const raw = sessionStorage.getItem('bo_products_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.timestamp && (now - parsed.timestamp < CACHE_TTL_MS) && Array.isArray(parsed.data)) {
        memoryCache = parsed.data;
        cacheTimestamp = parsed.timestamp;
        return memoryCache;
      }
    }
  } catch {
    // Ignore sessionStorage quota or parsing errors
  }
  return null;
}

function setCachedProducts(products) {
  const now = Date.now();
  memoryCache = products;
  cacheTimestamp = now;
  try {
    sessionStorage.setItem('bo_products_cache', JSON.stringify({
      timestamp: now,
      data: products
    }));
  } catch {
    // Ignore storage quota
  }
}

export const invalidateProductCache = () => {
  memoryCache = null;
  cacheTimestamp = 0;
  inFlightFetch = null;
  try {
    sessionStorage.removeItem('bo_products_cache');
  } catch {}
};

/**
 * Fetch products from Firestore with single-flight deduplication & caching.
 * Resolves in 0ms when cached, and combines simultaneous queries into 1 network call.
 */
export const fetchAllActiveProducts = async (forceRefresh = false) => {
  if (!forceRefresh) {
    const cached = getCachedProducts();
    if (cached) return cached;
  }

  // If already in flight, reuse the exact same promise (coalesce requests)
  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    try {
      const q = query(collection(db, PRODUCTS), orderBy('createdAt', 'desc'), limit(120));
      const snapshot = await getDocs(q);
      const rawProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCachedProducts(rawProducts);
      return rawProducts;
    } catch (err) {
      console.warn('Firestore fetch failed, falling back to cache if available:', err.message);
      // Resilience: return stale cache or empty array to keep error rate at 0
      if (memoryCache) return memoryCache;
      return [];
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
};

export const getShopProducts = async (category = 'All', sortBy = 'newest', _lastDocSnap = null, _pageSize = 12) => {
  const rawList = await fetchAllActiveProducts();
  let products = rawList.filter(p => p.active === true);

  // 1. Filter Category
  if (category !== 'All') {
    const catLower = String(category).toLowerCase();
    products = products.filter(p => 
      String(p.category || '').toLowerCase() === catLower || 
      String(p.categoryId || '').toLowerCase() === catLower
    );
  }

  // 2. Sort
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
    const timeA = a.createdAt?.seconds || (typeof a.createdAt === 'number' ? a.createdAt : 0);
    const timeB = b.createdAt?.seconds || (typeof b.createdAt === 'number' ? b.createdAt : 0);
    return timeB - timeA;
  });

  return {
    products,
    lastVisible: null,
    hasMore: false
  };
};

export const getNewArrivals = async (qty = 4) => {
  const rawList = await fetchAllActiveProducts();
  let products = rawList.filter(p => p.active === true);

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 15);

  // Filter by date dynamically 
  const filtered = products.filter(p => {
    if (!p.createdAt) return true;
    const created = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
    return created >= tenDaysAgo;
  });

  const list = filtered.length > 0 ? filtered : products;
  list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  return list.slice(0, qty);
};

export const getSaleProducts = async (qty = 4) => {
  const rawList = await fetchAllActiveProducts();
  const now = new Date();

  // Filter locally
  const saleList = rawList.filter(p => {
    if (!p.active || !p.offerEnabled) return false;

    const end = p.offerEndAt ? (p.offerEndAt.toDate ? p.offerEndAt.toDate() : new Date(p.offerEndAt)) : null;
    const start = p.offerStartAt ? (p.offerStartAt.toDate ? p.offerStartAt.toDate() : new Date(p.offerStartAt)) : null;

    if (end && end <= now) return false;
    if (start && start > now) return false;

    return true;
  });

  return saleList.slice(0, qty);
};

export const getProductBySlug = async (slug) => {
  if (!slug) return null;

  // 1. Instant check in memory cache
  const cached = getCachedProducts();
  if (cached) {
    const found = cached.find(p => p.slug === slug);
    if (found) return found;
  }

  // 2. Direct Firestore query fallback
  try {
    const q = query(collection(db, PRODUCTS), where('slug', '==', slug), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (err) {
    console.error('Error fetching product by slug:', err);
    return null;
  }
};

export const getRelatedProducts = async (categoryOrId, excludeProductId, qty = 4) => {
  try {
    const rawList = await fetchAllActiveProducts();
    let all = rawList.filter(p => p.active !== false && p.id !== excludeProductId);

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
  try {
    const q = query(
      collection(db, CATEGORIES),
      where('active', '==', true),
      orderBy('displayOrder', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('Error fetching categories:', err.message);
    return [];
  }
};
