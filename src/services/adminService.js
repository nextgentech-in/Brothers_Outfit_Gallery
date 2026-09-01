import { collection, doc, setDoc, deleteDoc, getDocs, getDoc, query, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/firebaseConfig';

const PRODUCTS = 'products';

// Delete a single image from Storage
export const deleteProductImage = async (path) => {
  if (!path) return;
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (err) {
    console.error("Firebase Storage delete error:", err);
    // Ignore not-found errors in case it's already deleted
  }
};

// Returns a new valid document ID before actually saving document
export const generateProductId = () => {
  return doc(collection(db, PRODUCTS)).id;
};

// Upload a single image
// Notice we accept a custom path/filename logic if provided
export const uploadProductImage = async (file, path = null) => {
  const fileName = path || `products/temp/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
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

    return { total, active, activeSales, outOfStock, lowStock, totalOrders: 0 }; 
}

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
