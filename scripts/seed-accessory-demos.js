// Add visible, non-purchasable accessory samples to the shared website/POS catalog.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const env = Object.fromEntries(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
if (env.FIREBASE_ADMIN_PROJECT_ID !== 'brothersoutfitgallary') throw new Error('Unexpected Firebase project.');
initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
const db = getFirestore();
const hash = text => crypto.createHash('sha256').update(text.toLowerCase()).digest('hex');
const samples = [
  ['wallet', 'Bifold Wallet', 'Wallets', 'Bifold', 699, 999, '/images/category-rail/accessories-cutout.jpg'],
  ['belt', 'Classic Belt', 'Belts', 'Leather', 599, 899, '/images/category-rail/accessories-cutout.jpg'],
  ['cap', 'Everyday Cap', 'Caps', 'Baseball Cap', 449, 699, '/images/category-rail/accessories-cutout.jpg']
];
const batch = db.batch();
let count = 0;
for (const [key, label, category, subCategory, price, mrp, image] of samples) {
  const id = `demo_accessory_${key}_20261113`;
  const ref = db.collection('products').doc(id);
  if ((await ref.get()).exists) continue;
  const sku = `DEMO-BOG-ACCESSORY-${key.toUpperCase()}`;
  const variantSku = `${sku}-ONE-SIZE`;
  batch.create(ref, {
    name: `DEMO — ${label}`, slug: `demo-accessory-${key}-20261113`, sku,
    category, categoryId: category, subCategory,
    shortDescription: 'Sample accessory for checking the website and POS. Not for sale.',
    description: 'Demo listing. No stock is available for purchase.',
    price, salePrice: price, mrp, compareAtPrice: mrp,
    gstEnabled: true, gstPercent: 5,
    variants: [{ id: `${id}-one-size`, sku: variantSku, size: 'One Size', color: 'Standard', stock: 0, quantity: 0, reserved: 0, price, salePrice: price }],
    sizes: [], allSizes: ['One Size'], stock: 0, quantity: 0, reserved: 0,
    inStock: false, active: true, isDeleted: false,
    images: [{ url: image, isPrimary: true, sortOrder: 0, alt: `Demo ${label}` }], image, thumbnailUrl: image,
    webProductId: id, integrationOrigin: 'website', demoOnly: true,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), integrationCreatedAt: FieldValue.serverTimestamp()
  });
  const slug = `demo-accessory-${key}-20261113`;
  batch.create(db.collection('productSlugMappings').doc(hash(slug)), { normalizedSlug: slug, slug, productId: id, webProductId: id, createdAt: FieldValue.serverTimestamp() });
  for (const value of [sku, variantSku]) batch.create(db.collection('productSkuMappings').doc(hash(value)), { normalizedSku: value.toLowerCase(), sku: value, productId: id, webProductId: id, createdAt: FieldValue.serverTimestamp() });
  count += 1;
}
console.log(`Accessory samples to create: ${count}`);
if (process.argv.includes('--apply') && count) { await batch.commit(); console.log(`Created ${count} accessory samples.`); }
