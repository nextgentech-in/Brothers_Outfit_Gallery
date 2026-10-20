import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function credentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  return {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };
}

const normalize = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const apply = process.argv.includes('--apply');

if (!getApps().length) initializeApp({ credential: cert(credentials()) });
const db = getFirestore();
const snapshot = await db.collection('products').get();
const skuOwners = new Map();
const slugOwners = new Map();
const conflicts = [];

for (const doc of snapshot.docs) {
  const product = doc.data();
  const normalizedSlug = normalize(product.slug);
  if (normalizedSlug) {
    const priorSlug = slugOwners.get(normalizedSlug);
    if (priorSlug && priorSlug.productId !== doc.id) conflicts.push({ slug: product.slug, productIds: [priorSlug.productId, doc.id] });
    else slugOwners.set(normalizedSlug, { slug: product.slug, productId: doc.id, webProductId: product.webProductId || doc.id });
  }
  for (const sku of [product.sku, ...(Array.isArray(product.variants) ? product.variants.map(variant => variant.sku) : [])].filter(Boolean)) {
    const key = normalize(sku);
    const prior = skuOwners.get(key);
    if (prior && prior.productId !== doc.id) conflicts.push({ sku, productIds: [prior.productId, doc.id] });
    else skuOwners.set(key, { sku, productId: doc.id, webProductId: product.webProductId || doc.id });
  }
}

const slugEntries = [...slugOwners.entries()];
for (let offset = 0; offset < slugEntries.length; offset += 200) {
  const chunk = slugEntries.slice(offset, offset + 200);
  const refs = chunk.map(([normalizedSlug]) => db.collection('productSlugMappings').doc(hash(normalizedSlug)));
  const reservations = await db.getAll(...refs);
  reservations.forEach((reservation, index) => {
    if (reservation.exists && reservation.data().productId !== chunk[index][1].productId) {
      conflicts.push({ slug: chunk[index][1].slug, productIds: [reservation.data().productId, chunk[index][1].productId], source: 'existing_mapping' });
    }
  });
}

const skuEntries = [...skuOwners.entries()];
for (let offset = 0; offset < skuEntries.length; offset += 200) {
  const chunk = skuEntries.slice(offset, offset + 200);
  const refs = chunk.map(([normalizedSku]) => db.collection('productSkuMappings').doc(hash(normalizedSku)));
  const reservations = await db.getAll(...refs);
  reservations.forEach((reservation, index) => {
    if (reservation.exists && reservation.data().productId !== chunk[index][1].productId) {
      conflicts.push({ sku: chunk[index][1].sku, productIds: [reservation.data().productId, chunk[index][1].productId], source: 'existing_mapping' });
    }
  });
}

if (conflicts.length) {
  console.error(JSON.stringify({ success: false, message: 'Duplicate legacy SKUs must be resolved before backfill.', conflicts }, null, 2));
  process.exitCode = 1;
} else if (!apply) {
  console.log(JSON.stringify({ success: true, dryRun: true, products: snapshot.size, uniqueSkus: skuOwners.size, uniqueSlugs: slugOwners.size, message: 'Validation passed. Re-run with --apply to write the backfill.' }, null, 2));
} else {
  let batch = db.batch();
  let operationCount = 0;
  let committedOperations = 0;
  async function queue(ref, data, options) {
    batch.set(ref, data, options);
    operationCount += 1;
    if (operationCount >= 400) {
      await batch.commit();
      committedOperations += operationCount;
      batch = db.batch();
      operationCount = 0;
    }
  }

  for (const doc of snapshot.docs) {
    const product = doc.data();
    await queue(doc.ref, {
      webProductId: product.webProductId || doc.id,
      integrationOrigin: product.integrationOrigin || 'website',
      integrationCreatedAt: product.integrationCreatedAt || product.createdAt || FieldValue.serverTimestamp()
    }, { merge: true });
  }
  for (const [normalizedSku, owner] of skuOwners) {
    await queue(db.collection('productSkuMappings').doc(hash(normalizedSku)), {
      normalizedSku,
      sku: owner.sku,
      productId: owner.productId,
      webProductId: owner.webProductId,
      backfilledAt: FieldValue.serverTimestamp()
    }, { merge: false });
  }
  for (const [normalizedSlug, owner] of slugOwners) {
    await queue(db.collection('productSlugMappings').doc(hash(normalizedSlug)), {
      normalizedSlug,
      slug: owner.slug,
      productId: owner.productId,
      webProductId: owner.webProductId,
      backfilledAt: FieldValue.serverTimestamp()
    }, { merge: false });
  }
  if (operationCount) {
    await batch.commit();
    committedOperations += operationCount;
  }
  console.log(JSON.stringify({ success: true, dryRun: false, products: snapshot.size, uniqueSkus: skuOwners.size, uniqueSlugs: slugOwners.size, committedOperations }, null, 2));
}
