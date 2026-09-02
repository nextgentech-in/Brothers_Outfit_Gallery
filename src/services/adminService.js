import { collection, doc, setDoc, deleteDoc, getDocs, getDoc, query, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const PRODUCTS = 'products';

// Delete a single image from ImageKit
export const deleteProductImage = async (fileId) => {
  if (!fileId) return;
  try {
    // Calling our new backend safely
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    await fetch(`${backendUrl}/api/imagekit/delete/${fileId}`, {
       method: 'DELETE',
       headers: { 'x-admin-request': 'true' }
    });
  } catch (err) {
    console.error("ImageKit delete error:", err);
    // Ignore not-found errors
  }
};

// Returns a new valid document ID before actually saving document
export const generateProductId = () => {
  return doc(collection(db, PRODUCTS)).id;
};





// Admin fetching all products without active filters
export const getAdminProducts = async () => {
    // Pagination or complex queries can be added here
  const q = query(collection(db, PRODUCTS), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getAdminProductById = async (id) => {
    const docRef = doc(db, PRODUCTS, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() };
}

// Create new product 
export const createProduct = async (productData, preGeneratedId = null) => {
  const newRef = preGeneratedId ? doc(db, PRODUCTS, preGeneratedId) : doc(collection(db, PRODUCTS));
  const payload = {
    ...productData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(newRef, payload);
  return newRef.id;
};

// Update product
export const updateProduct = async (id, productData) => {
  const docRef = doc(db, PRODUCTS, id);
  const payload = {
    ...productData,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(docRef, payload);
};

// Deactivate product
export const deactivateProduct = async (id) => {
  const docRef = doc(db, PRODUCTS, id);
  await updateDoc(docRef, { active: false, updatedAt: serverTimestamp() });
};

// Hard Delete
export const deleteProduct = async (id) => {
  const docRef = doc(db, PRODUCTS, id);
  await deleteDoc(docRef);
};

// Simple Stats Method
export const getAdminStats = async (products) => {
    const total = products.length;
    let active = 0;
    let activeSales = 0;
    let outOfStock = 0;
    let lowStock = 0;

    const now = new Date();

    products.forEach(p => {
        if(p.active) active++;
        if(p.offerEnabled) {
            const start = p.offerStartAt ? new Date(p.offerStartAt) : null;
            const end = p.offerEndAt ? new Date(p.offerEndAt) : null;
            if((!start || start <= now) && (!end || end > now)) {
                activeSales++;
            }
        }
        if(p.stock === 0) outOfStock++;
        else if (p.stock > 0 && p.stock <= 5) lowStock++;
    });

    let totalOrders = 0;
    try {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      totalOrders = ordersSnap.size;
    } catch (e) {
      console.log('No orders yet or security rule restriction:', e.message);
    }

    return { total, active, activeSales, outOfStock, lowStock, totalOrders }; 
}

// ─── ADMIN: ORDERS ────────────────────────────────────────────────────────────
export const getAdminOrders = async () => {
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    return [];
  }
};

export const updateOrderStatus = async (orderId, status) => {
  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, { status, updatedAt: serverTimestamp() });
};

// ─── ADMIN: CUSTOMERS ─────────────────────────────────────────────────────────
export const getAdminCustomers = async () => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching customers:', err);
    return [];
  }
};

// ─── ADMIN: INVENTORY ─────────────────────────────────────────────────────────
export const updateProductVariantStock = async (productId, variants, totalStock) => {
  const docRef = doc(db, PRODUCTS, productId);
  await updateDoc(docRef, {
    variants: variants,
    stock: totalStock,
    updatedAt: serverTimestamp()
  });
};

// ─── ADMIN: COUPONS ───────────────────────────────────────────────────────────
export const getAdminCoupons = async () => {
  try {
    const snap = await getDocs(collection(db, 'coupons'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return [];
  }
};

export const createCoupon = async (couponData) => {
  const docRef = doc(collection(db, 'coupons'));
  await setDoc(docRef, {
    ...couponData,
    code: couponData.code.toUpperCase().trim(),
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const deleteCoupon = async (id) => {
  await deleteDoc(doc(db, 'coupons', id));
};

// ─── ADMIN: SETTINGS ──────────────────────────────────────────────────────────
export const getStoreSettings = async () => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'store'));
    return snap.exists() ? snap.data() : {
      storeName: "Brothers Outfit Gallery",
      phone: "+91 98765 43210",
      email: "contact@brothersoutfit.com",
      address: "Main Market, India",
      whatsappNumber: "919876543210",
      freeShippingMin: 1500,
      autoDiscountThreshold: 2000,
      autoDiscountAmount: 250
    };
  } catch (err) {
    return {};
  }
};

export const saveStoreSettings = async (settingsData) => {
  await setDoc(doc(db, 'settings', 'store'), {
    ...settingsData,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

// ─── ADMIN: REVIEWS ───────────────────────────────────────────────────────────
export const getAdminReviews = async () => {
  try {
    const snap = await getDocs(collection(db, 'reviews'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return [];
  }
};

export const deleteReview = async (id) => {
  await deleteDoc(doc(db, 'reviews', id));
};

// ─── ADMIN: HOMEPAGE SECTIONS ──────────────────────────────────────────────────
export const getHomepageConfig = async () => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'homepage'));
    return snap.exists() ? snap.data() : {
      showHero: true,
      showTrending: true,
      showSaleSection: true,
      showNewArrivals: true,
      showShopCollection: true,
      showAboutPreview: true,
      showTrustBadges: true,
      showReviews: true
    };
  } catch (err) {
    return {};
  }
};

export const saveHomepageConfig = async (config) => {
  await setDoc(doc(db, 'settings', 'homepage'), config, { merge: true });
};

// Temporary Seeder
export const seedDemoProducts = async () => {
  const dummyProduct1 = {
    name: 'Premium Oversized Cotton Shirt',
    slug: 'premium-oversized-cotton-shirt-' + Date.now(),
    sku: 'SH-OVR-01',
    categoryId: 'Shirts',
    shortDescription: 'Drop-shoulder relaxed fit premium cotton.',
    description: 'Constructed from heavy-weight 100% pure cotton for a structured drop-shoulder fit.',
    mrp: 2999,
    salePrice: 1499,
    price: 1499,
    compareAtPrice: 2999,
    discountPercentage: 50,
    images: ['https://placehold.co/600x800/18181b/ffffff/png?text=Oversized+Shirt'],
    colors: [{ name: 'Black', hex: '#000000' }, { name: 'White', hex: '#FFFFFF' }],
    variants: [
      { id: 'Black-M-1', color: 'Black', size: 'M', sku: 'SH-OVR-01-B-M', stock: 15 },
      { id: 'Black-L-1', color: 'Black', size: 'L', sku: 'SH-OVR-01-B-L', stock: 10 },
      { id: 'White-M-1', color: 'White', size: 'M', sku: 'SH-OVR-01-W-M', stock: 5 },
    ],
    offerEnabled: false,
    stock: 30,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const dummyProduct2 = {
    name: 'Limited Edition Graphic Tee',
    slug: 'limited-edition-graphic-tee-' + Date.now(),
    sku: 'TE-GR-05',
    categoryId: 'T-Shirts',
    shortDescription: 'Exclusive graphic print.',
    description: 'High-density graphic print on premium cotton-blend fabric.',
    mrp: 1499,
    salePrice: 999,
    price: 999,
    compareAtPrice: 1499,
    discountPercentage: 33,
    images: ['https://placehold.co/600x800/18181b/facc15/png?text=Graphic+Tee'],
    colors: [{ name: 'Navy', hex: '#1e3a8a' }],
    variants: [
      { id: 'Navy-L-2', color: 'Navy', size: 'L', sku: 'TE-GR-05-N-L', stock: 3 },
      { id: 'Navy-XL-2', color: 'Navy', size: 'XL', sku: 'TE-GR-05-N-XL', stock: 0 },
    ],
    offerEnabled: true,
    offerStartAt: new Date(Date.now() - 100000).toISOString(),
    offerEndAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    stock: 3,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const newRef1 = doc(collection(db, PRODUCTS));
  await setDoc(newRef1, dummyProduct1);

  const newRef2 = doc(collection(db, PRODUCTS));
  await setDoc(newRef2, dummyProduct2);
};
