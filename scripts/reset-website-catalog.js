// One-time catalog reset after retiring the external POS connection.
// Usage: node scripts/reset-website-catalog.js       (preview)
//        node scripts/reset-website-catalog.js --apply
// Existing products are archived in place to preserve open-order stock restoration.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const batchId = '2026-11-13-pos-disconnect';
const projectId = 'brothersoutfitgallary';
const siteUrl = 'https://www.brothersoutfitgallery.com';
const apply = process.argv.includes('--apply');

function readLocalEnv() {
  const envPath = path.join(repoDir, '.env');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    .filter(line => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map(line => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')];
    }));
}

function mappingId(value) {
  return crypto.createHash('sha256').update(value.toLowerCase()).digest('hex');
}

function demoProduct(id, name, category, subCategory, image, price, mrp, color, sizes) {
  const sku = `DEMO-BOG-${id.toUpperCase()}`;
  const variants = sizes.map(size => ({
    id: `${id}-${size}`,
    sku: `${sku}-${size}`,
    size,
    color,
    stock: 0,
    quantity: 0,
    reserved: 0,
    price,
    salePrice: price
  }));
  const imageUrl = `/images/${image}`;
  return {
    id: `demo_${id}_20261113`,
    name: `DEMO — ${name}`,
    slug: `demo-${id}-20261113`,
    sku,
    category,
    categoryId: category,
    subCategory,
    shortDescription: 'Sample product for checking the website catalog. Not for sale.',
    description: 'This is a demo listing for checking the website after the Mr. Munim connection was removed. No stock is available for purchase.',
    price,
    salePrice: price,
    mrp,
    compareAtPrice: mrp,
    discountPercentage: Math.round((1 - price / mrp) * 100),
    colors: [{ name: color }],
    primaryColor: color,
    variants,
    sizes: [],
    allSizes: sizes,
    stock: 0,
    quantity: 0,
    reserved: 0,
    inStock: false,
    active: true,
    isDeleted: false,
    offerEnabled: false,
    isTrending: false,
    images: [{ url: imageUrl, isPrimary: true, sortOrder: 0, alt: `Demo ${name}` }],
    image: imageUrl,
    thumbnailUrl: imageUrl,
    integrationOrigin: 'website',
    demoOnly: true,
    demoBatch: batchId
  };
}

const demos = [
  demoProduct('blue_shirt', 'Blue Shirt', 'Shirts', 'Casual', 'product-shirt-blue.png', 899, 1299, 'Blue', ['M', 'L']),
  demoProduct('black_tshirt', 'Black T-Shirt', 'T-Shirts', 'Regular Fit', 'product-tshirt-black.png', 599, 899, 'Black', ['M', 'L']),
  demoProduct('dark_jeans', 'Dark Jeans', 'Jeans', 'Regular', 'product-jeans-dark.png', 1199, 1699, 'Dark Blue', ['30', '32'])
];

async function main() {
  const env = { ...readLocalEnv(), ...process.env };
  if ((env.FIREBASE_ADMIN_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID) !== projectId) {
    throw new Error(`Expected Firebase project ${projectId}.`);
  }
  const serviceAccount = env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : {
        projectId,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      };
  if (!serviceAccount.clientEmail || !serviceAccount.privateKey) throw new Error('Firebase Admin credentials are missing.');
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const products = await db.collection('products').get();
  const toArchive = products.docs.filter(doc => doc.data().isDeleted !== true && doc.data().demoBatch !== batchId);
  const existingDemos = await Promise.all(demos.map(demo => db.collection('products').doc(demo.id).get()));
  if (existingDemos.some(snap => snap.exists && snap.data().demoBatch !== batchId)) {
    throw new Error('A demo document ID is already used by another product.');
  }
  console.log(`Project: ${projectId}; current products: ${products.size}; products to archive: ${toArchive.length}; demos to create: ${existingDemos.filter(snap => !snap.exists).length}`);
  if (!apply) return;
  if (existingDemos.some(snap => snap.exists) && toArchive.length > 0) {
    throw new Error('Reset already completed; refusing to archive products added afterward.');
  }

  const response = await fetch(`${siteUrl}/api/pos/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(10000)
  });
  const status = await response.json().catch(() => ({}));
  if (response.status !== 410 || status.code !== 'pos_disconnected') {
    throw new Error('The production POS endpoint is not confirmed disconnected. Catalog unchanged.');
  }

  // Keep a local recovery snapshot outside the Git repository before any write.
  const backupDir = path.resolve(repoDir, '..', '.codex', 'catalog-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `products-before-reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ projectId, batchId, capturedAt: new Date().toISOString(), products: products.docs.map(doc => ({ id: doc.id, data: doc.data() })) }, null, 2));

  const batch = db.batch();
  for (const doc of toArchive) {
    batch.update(doc.ref, {
      active: false,
      isDeleted: true,
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  for (let i = 0; i < demos.length; i += 1) {
    if (existingDemos[i].exists) continue;
    const { id, ...data } = demos[i];
    const ref = db.collection('products').doc(id);
    batch.create(ref, {
      ...data,
      webProductId: id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      integrationCreatedAt: FieldValue.serverTimestamp()
    });
    batch.create(db.collection('productSlugMappings').doc(mappingId(data.slug)), {
      normalizedSlug: data.slug,
      slug: data.slug,
      productId: id,
      webProductId: id,
      createdAt: FieldValue.serverTimestamp()
    });
    for (const sku of [data.sku, ...data.variants.map(variant => variant.sku)]) {
      batch.create(db.collection('productSkuMappings').doc(mappingId(sku)), {
        normalizedSku: sku.toLowerCase(),
        sku,
        productId: id,
        webProductId: id,
        createdAt: FieldValue.serverTimestamp()
      });
    }
  }
  await batch.commit();
  const current = await db.collection('products').get();
  const visible = current.docs.filter(doc => doc.data().active !== false && doc.data().isDeleted !== true);
  console.log(`Archived ${toArchive.length} website products; visible catalog: ${visible.length} demo products; backup: ${backupPath}`);
  if (visible.length !== demos.length || visible.some(doc => doc.data().demoBatch !== batchId)) {
    throw new Error('Post-reset catalog verification failed. Inspect Firestore before continuing.');
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
