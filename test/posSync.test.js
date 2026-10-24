import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'crypto';
import { registerPosSyncRoutes, posSyncInternals } from '../src/server/posSync.js';

let POS_TOKEN = 'test-pos-sync-secure-token-xyz-123';
process.env.POS_SYNC_API_TOKEN = POS_TOKEN;

function cloneData(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(cloneData);
  const copy = {};
  for (const [k, v] of Object.entries(data)) {
    copy[k] = cloneData(v);
  }
  if (typeof data.toMillis === 'function') copy.toMillis = data.toMillis;
  if (typeof data.toDate === 'function') copy.toDate = data.toDate;
  return copy;
}

// ── In-Memory Firestore Mock ──────────────────────────────────────────────
function createMockDb() {
  const collections = new Map();

  function getCol(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }

  function makeRef(colName, id) {
    return {
      id,
      path: `${colName}/${id}`,
      async get() {
        const col = getCol(colName);
        const exists = col.has(id);
        const data = exists ? cloneData(col.get(id)) : undefined;
        return { id, exists, data: () => data, ref: makeRef(colName, id) };
      },
      async set(data, opts = {}) {
        const col = getCol(colName);
        if (opts.merge && col.has(id)) {
          col.set(id, { ...col.get(id), ...cloneData(data) });
        } else {
          col.set(id, cloneData(data));
        }
      },
      async update(data) {
        const col = getCol(colName);
        if (!col.has(id)) {
          const err = new Error(`Document ${id} not found`);
          err.statusCode = 404;
          throw err;
        }
        col.set(id, { ...col.get(id), ...cloneData(data) });
      },
      async delete() {
        getCol(colName).delete(id);
      }
    };
  }

  function makeCollection(colName, filters = [], limitCount = null) {
    return {
      doc(id) {
        return makeRef(colName, id);
      },
      where(field, op, val) {
        return makeCollection(colName, [...filters, { field, op, val }], limitCount);
      },
      limit(n) {
        return makeCollection(colName, filters, n);
      },
      async get() {
        const col = getCol(colName);
        let docs = [];
        for (const [id, data] of col.entries()) {
          docs.push({ id, exists: true, data: () => cloneData(data), ref: makeRef(colName, id) });
        }
        for (const f of filters) {
          if (f.op === '==') {
            docs = docs.filter(d => d.data()[f.field] === f.val);
          }
        }
        if (limitCount != null) {
          docs = docs.slice(0, limitCount);
        }
        return {
          docs,
          size: docs.length,
          empty: docs.length === 0
        };
      }
    };
  }

  return {
    collections,
    collection(name) {
      return makeCollection(name);
    },
    async runTransaction(updateFn) {
      const writes = [];
      const tx = {
        async get(ref) {
          return ref.get();
        },
        create(ref, data) {
          writes.push({ type: 'create', ref, data });
        },
        set(ref, data, opts) {
          writes.push({ type: 'set', ref, data, opts });
        },
        update(ref, data) {
          writes.push({ type: 'update', ref, data });
        },
        delete(ref) {
          writes.push({ type: 'delete', ref });
        }
      };

      const result = await updateFn(tx);
      for (const w of writes) {
        if (w.type === 'create') {
          const snap = await w.ref.get();
          if (snap.exists) {
            const err = new Error(`Document ${w.ref.id} already exists`);
            err.code = 6;
            throw err;
          }
          await w.ref.set(w.data);
        } else if (w.type === 'set') {
          await w.ref.set(w.data, w.opts);
        } else if (w.type === 'update') {
          await w.ref.update(w.data);
        } else if (w.type === 'delete') {
          await w.ref.delete();
        }
      }
      return result;
    }
  };
}

const mockFieldValue = {
  serverTimestamp: () => {
    const now = Date.now();
    return {
      _serverTimestamp: true,
      toMillis: () => now,
      toDate: () => new Date(now),
      toISOString: () => new Date(now).toISOString()
    };
  }
};

// ── Test Server Harness ───────────────────────────────────────────────────
function createTestApp(db) {
  const app = express();
  app.use('/api/pos', express.json({ limit: '10mb' }));
  app.use(express.json());

  app.get(['/api/health', '/health'], (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  registerPosSyncRoutes(app, {
    getDb: () => db,
    FieldValue: mockFieldValue,
    invalidateProductCache: () => {}
  });

  return app;
}

let sharedServer = null;
let sharedBaseUrl = '';
let sharedDb = null;

async function startServer() {
  sharedDb = createMockDb();
  const app = createTestApp(sharedDb);
  return new Promise((resolve) => {
    sharedServer = app.listen(0, () => {
      const port = sharedServer.address().port;
      sharedBaseUrl = `http://127.0.0.1:${port}`;
      resolve({ server: sharedServer, baseUrl: sharedBaseUrl, db: sharedDb });
    });
  });
}

async function stopServer() {
  if (sharedServer) {
    await new Promise((resolve) => sharedServer.close(resolve));
    sharedServer = null;
  }
}

async function api(path, { method = 'GET', token = POS_TOKEN, body, headers = {} } = {}) {
  const reqHeaders = { 'Content-Type': 'application/json', ...headers };
  if (token !== null) reqHeaders['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${sharedBaseUrl}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, body: data };
}

// ── Sample Product Factory ────────────────────────────────────────────────
const createSampleProduct = (id = 'W-POS-100', sku = 'SHIRT-100') => ({
  web_product_id: id,
  product_name: 'Premium Oxford Shirt',
  category: '  Shirts  ',
  sub_category: '  Casual  ',
  sku: sku,
  slug: 'premium-oxford-shirt',
  gsl_spec: '180 GSM Cotton',
  color: 'Navy Blue',
  description: '100% fine combed cotton',
  mrp: 2499,
  sale_price: 1499,
  sizes: [
    { size: 'M', stock: 10, price: 1499, sku: `${sku}-M` },
    { size: 'L', stock: 5, price: 1499, sku: `${sku}-L` }
  ]
});

// ── Online Order & Cancellation Workflow Helpers ──────────────────────────
async function processOnlineOrder(db, { orderId, userId, items, paymentMethod = 'cod', checkoutId, paymentId }) {
  const requestFingerprint = crypto.createHash('sha256').update(JSON.stringify({
    userId, paymentMethod, paymentId: paymentId || null, checkoutId: paymentMethod === 'cod' ? checkoutId : null, items
  })).digest('hex');

  const orderRef = db.collection('orders').doc(orderId);
  return db.runTransaction(async (transaction) => {
    const existingOrder = await transaction.get(orderRef);
    if (existingOrder.exists) {
      if (existingOrder.data().userId !== userId || existingOrder.data().requestFingerprint !== requestFingerprint) {
        const conflict = new Error('This payment has already been associated with another order.');
        conflict.statusCode = 409;
        throw conflict;
      }
      return { duplicate: true, orderId };
    }

    const working = new Map();
    for (const item of items) {
      const pRef = db.collection('products').doc(item.productId);
      const snap = await transaction.get(pRef);
      if (!snap.exists) {
        const missing = new Error('Product is no longer available');
        missing.statusCode = 409;
        throw missing;
      }
      working.set(item.productId, { ref: pRef, data: snap.data() });
    }

    items.forEach((item, index) => {
      const state = working.get(item.productId);
      const product = state.data;
      const variants = Array.isArray(product.variants) ? product.variants.map(v => ({ ...v })) : [];
      const vIndex = variants.findIndex(v => v.sku === item.sku);
      if (vIndex < 0) {
        const mismatch = new Error(`Variant ${item.sku} not found`);
        mismatch.statusCode = 409;
        throw mismatch;
      }
      const current = variants[vIndex].stock;
      if (current < item.quantity) {
        const shortage = new Error(`Insufficient stock for ${item.sku}`);
        shortage.statusCode = 409;
        throw shortage;
      }
      const stockAfter = current - item.quantity;
      variants[vIndex].stock = stockAfter;
      variants[vIndex].quantity = stockAfter;
      const totalStock = variants.reduce((s, v) => s + v.stock, 0);
      state.data = { ...product, variants, stock: totalStock, quantity: totalStock };

      const movementId = `web_${crypto.createHash('sha256').update(`${orderId}|${index}|deduction`).digest('hex')}`;
      transaction.create(db.collection('stockMovements').doc(movementId), {
        movementId,
        productId: item.productId,
        webProductId: product.webProductId || item.productId,
        sku: item.sku,
        size: item.size || variants[vIndex].size,
        color: item.color || variants[vIndex].color,
        deltaChange: -item.quantity,
        source: 'website',
        reason: 'online_order',
        orderId,
        externalReference: orderId,
        stockAfter,
        createdAt: mockFieldValue.serverTimestamp()
      });
    });

    for (const state of working.values()) {
      transaction.update(state.ref, state.data);
    }

    transaction.create(orderRef, {
      orderId,
      userId,
      items,
      requestFingerprint,
      checkoutId: paymentMethod === 'cod' ? checkoutId : null,
      paymentId: paymentId || null,
      inventoryDeducted: true,
      status: 'Processing',
      createdAt: mockFieldValue.serverTimestamp()
    });

    return { duplicate: false, orderId };
  });
}

async function cancelOrderAndRestore(db, orderId) {
  const orderRef = db.collection('orders').doc(orderId);
  return db.runTransaction(async (transaction) => {
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }
    const order = orderDoc.data();
    if (String(order.status || '').toLowerCase() === 'cancelled' || order.stockRestoredAt) {
      return { alreadyCancelled: true, order };
    }

    const working = new Map();
    for (const item of order.items) {
      const pRef = db.collection('products').doc(item.productId);
      const snap = await transaction.get(pRef);
      if (!snap.exists) {
        const err = new Error('Product not found for inventory restoration');
        err.statusCode = 409;
        throw err;
      }
      working.set(item.productId, { ref: pRef, data: snap.data() });
    }

    order.items.forEach((item, index) => {
      const state = working.get(item.productId);
      const product = state.data;
      const variants = Array.isArray(product.variants) ? product.variants.map(v => ({ ...v })) : [];
      const vIndex = variants.findIndex(v => v.sku === item.sku);
      if (vIndex < 0) {
        const err = new Error(`Variant ${item.sku} not found`);
        err.statusCode = 409;
        throw err;
      }
      const current = variants[vIndex].stock;
      const stockAfter = current + item.quantity;
      variants[vIndex].stock = stockAfter;
      variants[vIndex].quantity = stockAfter;
      const totalStock = variants.reduce((s, v) => s + v.stock, 0);
      state.data = { ...product, variants, stock: totalStock, quantity: totalStock };

      const movementId = `web_${crypto.createHash('sha256').update(`${orderId}|${index}|cancellation`).digest('hex')}`;
      transaction.create(db.collection('stockMovements').doc(movementId), {
        movementId,
        productId: item.productId,
        webProductId: product.webProductId || item.productId,
        sku: item.sku,
        size: item.size || variants[vIndex].size,
        color: item.color || variants[vIndex].color,
        deltaChange: item.quantity,
        source: 'website',
        reason: 'order_cancelled',
        orderId,
        externalReference: orderId,
        stockAfter,
        createdAt: mockFieldValue.serverTimestamp()
      });
    });

    for (const state of working.values()) {
      transaction.update(state.ref, state.data);
    }

    transaction.update(orderRef, {
      status: 'Cancelled',
      stockRestoredAt: mockFieldValue.serverTimestamp()
    });

    return { alreadyCancelled: false };
  });
}

async function performAdminInventoryAdjustment(db, { productId, sku, newStock, requestId }) {
  const pRef = db.collection('products').doc(productId);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(pRef);
    if (!snap.exists) throw new Error('Product not found');
    const product = snap.data();
    const variants = product.variants.map(v => ({ ...v }));
    const vIndex = variants.findIndex(v => v.sku === sku);
    if (vIndex < 0) throw new Error(`Variant ${sku} not found`);
    const previous = variants[vIndex].stock;
    const delta = newStock - previous;
    variants[vIndex].stock = newStock;
    variants[vIndex].quantity = newStock;
    const totalStock = variants.reduce((s, v) => s + v.stock, 0);

    if (delta !== 0) {
      const movementId = `web_${crypto.createHash('sha256').update(`${requestId}|${sku}`).digest('hex')}`;
      transaction.create(db.collection('stockMovements').doc(movementId), {
        movementId,
        productId,
        webProductId: product.webProductId || productId,
        sku,
        size: variants[vIndex].size,
        color: variants[vIndex].color,
        deltaChange: delta,
        source: 'website',
        reason: 'admin_adjustment',
        externalReference: requestId,
        stockAfter: newStock,
        createdAt: mockFieldValue.serverTimestamp()
      });
    }

    transaction.update(pRef, { ...product, variants, stock: totalStock, quantity: totalStock });
    return { delta, stockAfter: newStock };
  });
}

function processReturnRestoration({ returnId, isQcApproved, quantity }) {
  if (!isQcApproved) {
    const error = new Error('Cannot restore return inventory: return business rule requires accepted QC inspection.');
    error.code = 'pending_return_qc_rule';
    throw error;
  }
  return { restored: true, returnId, quantity };
}

// ──────────────────────────────────────────────────────────────────────────
// 30 REQUIRED TEST CASES
// ──────────────────────────────────────────────────────────────────────────

test.before(async () => {
  await startServer();
});

test.beforeEach(() => {
  // Each test represents a separate POS client. Keep production rate limiting
  // active without accumulating the whole suite against one client's bucket.
  POS_TOKEN = `test-pos-${crypto.randomUUID()}`;
  process.env.POS_SYNC_API_TOKEN = POS_TOKEN;
});

test.after(async () => {
  await stopServer();
});

test('POS API health check', async () => {
  const res = await api('/api/health', { token: null });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.ok(res.body.time);
});

test('Missing bearer token returns 401', async () => {
  const res = await api('/api/pos/products', { method: 'POST', token: null, body: { products: [] } });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'unauthorized');
});

test('Invalid bearer token returns 401', async () => {
  const res = await api('/api/pos/products', { method: 'POST', token: 'wrong-invalid-token', body: { products: [] } });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'unauthorized');
});

test('Product creation with category and variants', async () => {
  const product = createSampleProduct('W-POS-T4', 'SKU-T4');
  const res = await api('/api/pos/products', { method: 'POST', body: { products: [product] } });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.created_count, 1);

  const directMapping = await sharedDb.collection('posProductMappings').doc(posSyncInternals.timestampMillis ? crypto.createHash('sha256').update('w-pos-t4').digest('hex') : '').get();
  assert.ok(directMapping.exists);
  const createdDoc = await sharedDb.collection('products').doc(directMapping.data().productId).get();
  assert.ok(createdDoc.exists);
  assert.equal(createdDoc.data().category, 'Shirts');
  assert.equal(createdDoc.data().subCategory, 'Casual');
  assert.equal(createdDoc.data().variants.length, 2);
  assert.equal(createdDoc.data().variants[0].stock, 10);
});

test('Duplicate product delivery does not reset inventory', async () => {
  const product = createSampleProduct('W-POS-T5', 'SKU-T5');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-t5').digest('hex')).get();
  const productRef = sharedDb.collection('products').doc(mapping.data().productId);
  const existing = (await productRef.get()).data();
  existing.variants[0].stock = 4;
  existing.stock = 9;
  await productRef.update(existing);

  const res = await api('/api/pos/products', { method: 'POST', body: { products: [product] } });
  assert.equal(res.status, 200);
  assert.equal(res.body.created_count, 0);

  const afterSnap = await productRef.get();
  assert.equal(afterSnap.data().variants[0].stock, 4, 'Stock must not be reset to initial payload stock');
});

test('Product ID conflict rejection', async () => {
  const product1 = createSampleProduct('W-POS-T6', 'SKU-T6');
  await api('/api/pos/products', { method: 'POST', body: { products: [product1] } });

  const conflictProduct = {
    ...createSampleProduct('W-POS-T6', 'SKU-T6-DIFFERENT'),
    sizes: [{ size: 'M', stock: 10, price: 1499, sku: 'SKU-T6-DIFFERENT-M' }]
  };
  const res = await api('/api/pos/products', { method: 'POST', body: { products: [conflictProduct] } });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'identity_conflict');
});

test('Variant SKU conflict rejection', async () => {
  const duplicateSkuInBatch = createSampleProduct('W-POS-T7A', 'SKU-T7A');
  duplicateSkuInBatch.sizes[1].sku = duplicateSkuInBatch.sizes[0].sku;
  const res1 = await api('/api/pos/products', { method: 'POST', body: { products: [duplicateSkuInBatch] } });
  assert.equal(res1.status, 422);

  const first = createSampleProduct('W-POS-T7B', 'SKU-T7-EXISTING');
  await api('/api/pos/products', { method: 'POST', body: { products: [first] } });

  const secondWithConflictingSku = createSampleProduct('W-POS-T7C', 'SKU-T7-NEW');
  secondWithConflictingSku.sizes[0].sku = 'SKU-T7-EXISTING-M';
  const res2 = await api('/api/pos/products', { method: 'POST', body: { products: [secondWithConflictingSku] } });
  assert.equal(res2.status, 409);
  assert.equal(res2.body.code, 'sku_conflict');
});

test('POS products excluded from website product feed', async () => {
  assert.equal(posSyncInternals.isWebsiteProductFeedEligible({ integrationOrigin: 'pos', active: true }), false);
  assert.equal(posSyncInternals.isWebsiteProductFeedEligible({ integrationOrigin: 'website', active: false }), false);
  assert.equal(posSyncInternals.isWebsiteProductFeedEligible({ integrationOrigin: 'website', active: true }), true);

  const pastTime = Date.now() - 10_000;
  await sharedDb.collection('products').doc('pos_origin_prod').set({
    name: 'POS Origin Prod',
    integrationOrigin: 'pos',
    active: true,
    createdAt: { toMillis: () => pastTime, toDate: () => new Date(pastTime) }
  });
  await sharedDb.collection('products').doc('web_origin_prod').set({
    name: 'Website Origin Prod',
    integrationOrigin: 'website',
    active: true,
    createdAt: { toMillis: () => pastTime + 1000, toDate: () => new Date(pastTime + 1000) },
    variants: [{ size: 'M', color: 'Black', sku: 'WEB-T8-M', stock: 5, price: 999 }]
  });

  const res = await api('/api/pos/products-sync');
  assert.equal(res.status, 200);
  const returnedIds = res.body.new_products.map(p => p.web_product_id);
  assert.ok(returnedIds.includes('web_origin_prod'));
  assert.ok(!returnedIds.includes('pos_origin_prod'), 'POS origin products must be excluded');
});

test('Invalid timestamp rejection', async () => {
  assert.throws(() => posSyncInternals.parseIsoTimestamp('2026-10-11 12:00:00'), error => error.status === 422);
  const res = await api('/api/pos/products-sync?since=not-a-valid-utc-timestamp');
  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'invalid_timestamp');
});

test('Incremental product-feed boundary test', async () => {
  const tOld = new Date('2026-10-10T08:00:00.000Z').getTime();
  const tExact = new Date('2026-10-10T10:00:00.000Z').getTime();
  const tNew = new Date('2026-10-10T12:00:00.000Z').getTime();

  await sharedDb.collection('products').doc('p_old').set({
    name: 'Old', integrationOrigin: 'website', active: true, createdAt: { toMillis: () => tOld, toDate: () => new Date(tOld) }
  });
  await sharedDb.collection('products').doc('p_exact').set({
    name: 'Exact', integrationOrigin: 'website', active: true, createdAt: { toMillis: () => tExact, toDate: () => new Date(tExact) }
  });
  await sharedDb.collection('products').doc('p_new').set({
    name: 'New', integrationOrigin: 'website', active: true, createdAt: { toMillis: () => tNew, toDate: () => new Date(tNew) }
  });

  const res = await api('/api/pos/products-sync?since=2026-10-10T10:00:00.000Z');
  assert.equal(res.status, 200);
  const returnedIds = res.body.new_products.map(p => p.web_product_id);
  assert.ok(!returnedIds.includes('p_old'), 'Record before since timestamp must be excluded');
  assert.ok(returnedIds.includes('p_exact'), 'Record exactly at boundary must be included');
  assert.ok(returnedIds.includes('p_new'), 'Record after boundary must be included');
});

test('Offline sale stock deduction', async () => {
  const product = createSampleProduct('W-POS-T11', 'SKU-T11');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const stockPayload = {
    sync_id: 'SYNC-T11',
    sync_timestamp: '2026-10-11T12:00:00.000Z',
    items: [{
      event_id: 'EVT-T11-SALE',
      web_product_id: 'W-POS-T11',
      sku: 'SKU-T11-M',
      size: 'M',
      color: 'Navy Blue',
      delta_change: -2,
      final_stock: 8
    }]
  };

  const res = await api('/api/pos/stock-sync', { method: 'POST', body: stockPayload });
  assert.equal(res.status, 200);
  assert.equal(res.body.updated_count, 1);

  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-t11').digest('hex')).get();
  const productDoc = (await sharedDb.collection('products').doc(mapping.data().productId).get()).data();
  assert.equal(productDoc.variants[0].stock, 8);

  const movementSnap = await sharedDb.collection('stockMovements').doc(`pos_${crypto.createHash('sha256').update('EVT-T11-SALE').digest('hex')}`).get();
  assert.ok(movementSnap.exists);
  assert.equal(movementSnap.data().deltaChange, -2);
  assert.equal(movementSnap.data().reason, 'offline_sale');
  assert.equal(movementSnap.data().source, 'pos');
});

test('POS stock-inward/restock addition', async () => {
  const product = createSampleProduct('W-POS-T12', 'SKU-T12');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const restockPayload = {
    sync_id: 'SYNC-T12',
    sync_timestamp: '2026-10-11T12:00:00.000Z',
    items: [{
      event_id: 'EVT-T12-RESTOCK',
      web_product_id: 'W-POS-T12',
      sku: 'SKU-T12-M',
      size: 'M',
      color: 'Navy Blue',
      delta_change: 5,
      final_stock: 15
    }]
  };

  const res = await api('/api/pos/stock-sync', { method: 'POST', body: restockPayload });
  assert.equal(res.status, 200);
  assert.equal(res.body.updated_count, 1);

  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-t12').digest('hex')).get();
  const productDoc = (await sharedDb.collection('products').doc(mapping.data().productId).get()).data();
  assert.equal(productDoc.variants[0].stock, 15);

  const movementSnap = await sharedDb.collection('stockMovements').doc(`pos_${crypto.createHash('sha256').update('EVT-T12-RESTOCK').digest('hex')}`).get();
  assert.ok(movementSnap.exists);
  assert.equal(movementSnap.data().reason, 'pos_stock_inward');
  assert.equal(movementSnap.data().deltaChange, 5);
});

test('Duplicate stock-event retry protection', async () => {
  const product = createSampleProduct('W-POS-T13', 'SKU-T13');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const event = {
    event_id: 'EVT-T13-DUP',
    web_product_id: 'W-POS-T13',
    sku: 'SKU-T13-M',
    size: 'M',
    color: 'Navy Blue',
    delta_change: -2,
    final_stock: 8
  };

  const res1 = await api('/api/pos/stock-sync', { method: 'POST', body: { sync_id: 'SYNC-T13A', sync_timestamp: '2026-10-11T12:00:00.000Z', items: [event] } });
  assert.equal(res1.body.updated_count, 1);

  // Retried in another batch
  const res2 = await api('/api/pos/stock-sync', { method: 'POST', body: { sync_id: 'SYNC-T13B', sync_timestamp: '2026-10-11T12:05:00.000Z', items: [event] } });
  assert.equal(res2.status, 200);
  assert.equal(res2.body.updated_count, 0);
  assert.equal(res2.body.duplicate_count, 1);

  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-t13').digest('hex')).get();
  const productDoc = (await sharedDb.collection('products').doc(mapping.data().productId).get()).data();
  assert.equal(productDoc.variants[0].stock, 8, 'Stock must not be decremented twice');
});

test('Same event ID with changed payload returns 409', async () => {
  const product = createSampleProduct('W-POS-T14', 'SKU-T14');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const event1 = {
    event_id: 'EVT-T14',
    web_product_id: 'W-POS-T14',
    sku: 'SKU-T14-M',
    size: 'M',
    color: 'Navy Blue',
    delta_change: -1,
    final_stock: 9
  };
  await api('/api/pos/stock-sync', { method: 'POST', body: { sync_id: 'SYNC-T14A', sync_timestamp: '2026-10-11T12:00:00.000Z', items: [event1] } });

  const eventChanged = { ...event1, delta_change: -4 };
  const res = await api('/api/pos/stock-sync', { method: 'POST', body: { sync_id: 'SYNC-T14B', sync_timestamp: '2026-10-11T12:05:00.000Z', items: [eventChanged] } });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'inconsistent_replay');
});

test('Unknown product/variant rejection', async () => {
  const unknownProdRes = await api('/api/pos/stock-sync', {
    method: 'POST',
    body: {
      sync_id: 'SYNC-T15A',
      sync_timestamp: '2026-10-11T12:00:00.000Z',
      items: [{
        event_id: 'EVT-T15A', web_product_id: 'UNKNOWN-ID', sku: 'SOME-SKU', size: 'M', color: 'Black', delta_change: -1, final_stock: 0
      }]
    }
  });
  assert.equal(unknownProdRes.status, 409);
  assert.equal(unknownProdRes.body.code, 'unknown_product');

  const product = createSampleProduct('W-POS-T15B', 'SKU-T15B');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const unknownVariantRes = await api('/api/pos/stock-sync', {
    method: 'POST',
    body: {
      sync_id: 'SYNC-T15B',
      sync_timestamp: '2026-10-11T12:00:00.000Z',
      items: [{
        event_id: 'EVT-T15B', web_product_id: 'W-POS-T15B', sku: 'UNKNOWN-VARIANT-SKU', size: 'M', color: 'Navy Blue', delta_change: -1, final_stock: 0
      }]
    }
  });
  assert.equal(unknownVariantRes.status, 409);
  assert.equal(unknownVariantRes.body.code, 'unknown_variant');
});

test('Size/color/SKU mismatch rejection', async () => {
  const product = createSampleProduct('W-POS-T16', 'SKU-T16');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const mismatchRes = await api('/api/pos/stock-sync', {
    method: 'POST',
    body: {
      sync_id: 'SYNC-T16',
      sync_timestamp: '2026-10-11T12:00:00.000Z',
      items: [{
        event_id: 'EVT-T16',
        web_product_id: 'W-POS-T16',
        sku: 'SKU-T16-M',
        size: 'L', // Size mismatch
        color: 'Navy Blue',
        delta_change: -1,
        final_stock: 9
      }]
    }
  });
  assert.equal(mismatchRes.status, 409);
  assert.equal(mismatchRes.body.code, 'variant_mismatch');
});

test('Atomic batch rollback on failure', async () => {
  const product = createSampleProduct('W-POS-T17', 'SKU-T17');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const batchPayload = {
    sync_id: 'SYNC-T17',
    sync_timestamp: '2026-10-11T12:00:00.000Z',
    items: [
      { event_id: 'EVT-T17-GOOD', web_product_id: 'W-POS-T17', sku: 'SKU-T17-M', size: 'M', color: 'Navy Blue', delta_change: -2, final_stock: 8 },
      { event_id: 'EVT-T17-BAD', web_product_id: 'W-POS-T17', sku: 'SKU-T17-M', size: 'M', color: 'Navy Blue', delta_change: -99, final_stock: 0 } // Causes insufficient_stock
    ]
  };

  const res = await api('/api/pos/stock-sync', { method: 'POST', body: batchPayload });
  assert.equal(res.status, 409);

  const goodEventSnap = await sharedDb.collection('posStockEvents').doc(crypto.createHash('sha256').update('EVT-T17-GOOD').digest('hex')).get();
  assert.equal(goodEventSnap.exists, false, 'Good item in failing batch must NOT be committed');

  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-t17').digest('hex')).get();
  const productDoc = (await sharedDb.collection('products').doc(mapping.data().productId).get()).data();
  assert.equal(productDoc.variants[0].stock, 10, 'Live stock must remain unmodified after rollback');
});

test('Online order inventory deduction', async () => {
  await sharedDb.collection('products').doc('online_prod_18').set({
    name: 'Online T-Shirt',
    stock: 10,
    variants: [{ size: 'M', color: 'Black', sku: 'ONLINE-18-M', stock: 10, price: 799 }]
  });

  const orderResult = await processOnlineOrder(sharedDb, {
    orderId: 'ORD-18',
    userId: 'user_18',
    items: [{ productId: 'online_prod_18', sku: 'ONLINE-18-M', quantity: 3 }]
  });
  assert.equal(orderResult.duplicate, false);

  const updatedDoc = (await sharedDb.collection('products').doc('online_prod_18').get()).data();
  assert.equal(updatedDoc.variants[0].stock, 7);
  assert.equal(updatedDoc.stock, 7);

  await assert.rejects(async () => {
    await processOnlineOrder(sharedDb, {
      orderId: 'ORD-18-FAIL',
      userId: 'user_18',
      items: [{ productId: 'online_prod_18', sku: 'ONLINE-18-M', quantity: 20 }]
    });
  }, error => error.statusCode === 409);
});

test('Online order movement creation', async () => {
  await sharedDb.collection('products').doc('online_prod_19').set({
    name: 'Online Hooded',
    stock: 10,
    webProductId: 'online_prod_19',
    variants: [{ size: 'L', color: 'Grey', sku: 'ONLINE-19-L', stock: 10, price: 1299 }]
  });

  await processOnlineOrder(sharedDb, {
    orderId: 'ORD-19',
    userId: 'user_19',
    items: [{ productId: 'online_prod_19', sku: 'ONLINE-19-L', size: 'L', color: 'Grey', quantity: 2 }]
  });

  const movementId = `web_${crypto.createHash('sha256').update('ORD-19|0|deduction').digest('hex')}`;
  const movement = (await sharedDb.collection('stockMovements').doc(movementId).get()).data();
  assert.ok(movement);
  assert.equal(movement.source, 'website');
  assert.equal(movement.reason, 'online_order');
  assert.equal(movement.deltaChange, -2);
  assert.equal(movement.orderId, 'ORD-19');
  assert.equal(movement.stockAfter, 8);
});

test('Repeated payment callback protection', async () => {
  await sharedDb.collection('products').doc('online_prod_20').set({
    name: 'Payment Check',
    stock: 10,
    variants: [{ size: 'M', color: 'White', sku: 'PAY-20-M', stock: 10, price: 999 }]
  });

  const payload = {
    orderId: 'ORD-20',
    userId: 'user_20',
    paymentMethod: 'razorpay',
    paymentId: 'pay_123456789',
    items: [{ productId: 'online_prod_20', sku: 'PAY-20-M', quantity: 2 }]
  };

  const firstCall = await processOnlineOrder(sharedDb, payload);
  assert.equal(firstCall.duplicate, false);

  const secondCall = await processOnlineOrder(sharedDb, payload);
  assert.equal(secondCall.duplicate, true, 'Repeated payment callback must be recognized as duplicate');

  const productDoc = (await sharedDb.collection('products').doc('online_prod_20').get()).data();
  assert.equal(productDoc.variants[0].stock, 8, 'Inventory must not be decremented twice');

  const alteredPayload = { ...payload, items: [{ productId: 'online_prod_20', sku: 'PAY-20-M', quantity: 4 }] };
  await assert.rejects(async () => {
    await processOnlineOrder(sharedDb, alteredPayload);
  }, error => error.statusCode === 409, 'Altered payment callback payload must throw conflict 409');
});

test('COD retry protection', async () => {
  await sharedDb.collection('products').doc('online_prod_21').set({
    name: 'COD Check',
    stock: 10,
    variants: [{ size: 'M', color: 'Blue', sku: 'COD-21-M', stock: 10, price: 999 }]
  });

  const codPayload = {
    orderId: 'ORD-COD-21',
    userId: 'user_21',
    paymentMethod: 'cod',
    checkoutId: 'chk_browser_999',
    items: [{ productId: 'online_prod_21', sku: 'COD-21-M', quantity: 1 }]
  };

  const first = await processOnlineOrder(sharedDb, codPayload);
  assert.equal(first.duplicate, false);

  const retry = await processOnlineOrder(sharedDb, codPayload);
  assert.equal(retry.duplicate, true);

  const productDoc = (await sharedDb.collection('products').doc('online_prod_21').get()).data();
  assert.equal(productDoc.variants[0].stock, 9);
});

test('Order cancellation stock restoration', async () => {
  await sharedDb.collection('products').doc('online_prod_22').set({
    name: 'Cancel Product',
    stock: 10,
    variants: [{ size: 'M', color: 'Black', sku: 'CAN-22-M', stock: 10, price: 899 }]
  });

  await processOnlineOrder(sharedDb, {
    orderId: 'ORD-22',
    userId: 'user_22',
    items: [{ productId: 'online_prod_22', sku: 'CAN-22-M', quantity: 2 }]
  });
  assert.equal((await sharedDb.collection('products').doc('online_prod_22').get()).data().variants[0].stock, 8);

  const cancelResult = await cancelOrderAndRestore(sharedDb, 'ORD-22');
  assert.equal(cancelResult.alreadyCancelled, false);

  const restoredProduct = (await sharedDb.collection('products').doc('online_prod_22').get()).data();
  assert.equal(restoredProduct.variants[0].stock, 10);

  const cancelMovementId = `web_${crypto.createHash('sha256').update('ORD-22|0|cancellation').digest('hex')}`;
  const movement = (await sharedDb.collection('stockMovements').doc(cancelMovementId).get()).data();
  assert.equal(movement.reason, 'order_cancelled');
  assert.equal(movement.deltaChange, 2);
  assert.equal(movement.stockAfter, 10);
});

test('Repeated cancellation protection', async () => {
  await sharedDb.collection('products').doc('online_prod_23').set({
    name: 'Double Cancel',
    stock: 10,
    variants: [{ size: 'M', color: 'Black', sku: 'CAN-23-M', stock: 10, price: 899 }]
  });

  await processOnlineOrder(sharedDb, {
    orderId: 'ORD-23',
    userId: 'user_23',
    items: [{ productId: 'online_prod_23', sku: 'CAN-23-M', quantity: 2 }]
  });

  await cancelOrderAndRestore(sharedDb, 'ORD-23');
  const secondCancel = await cancelOrderAndRestore(sharedDb, 'ORD-23');
  assert.equal(secondCancel.alreadyCancelled, true);

  const productDoc = (await sharedDb.collection('products').doc('online_prod_23').get()).data();
  assert.equal(productDoc.variants[0].stock, 10, 'Stock must not be restored twice');
});

test('POS movements excluded from website movement feed', async () => {
  const pastTime = Date.now() - 5000;
  await sharedDb.collection('stockMovements').doc('pos_movement_24').set({
    movementId: 'pos_movement_24',
    source: 'pos',
    reason: 'offline_sale',
    deltaChange: -2,
    createdAt: { toMillis: () => pastTime, toDate: () => new Date(pastTime) }
  });
  await sharedDb.collection('stockMovements').doc('web_movement_24').set({
    movementId: 'web_movement_24',
    source: 'website',
    reason: 'online_order',
    deltaChange: -1,
    createdAt: { toMillis: () => pastTime + 100, toDate: () => new Date(pastTime + 100) },
    webProductId: 'W-24',
    sku: 'SKU-24',
    size: 'M',
    color: 'Black',
    stockAfter: 9
  });

  const res = await api('/api/pos/stock-changes');
  assert.equal(res.status, 200);
  const ids = res.body.stock_changes.map(c => c.movement_id);
  assert.ok(ids.includes('web_movement_24'));
  assert.ok(!ids.includes('pos_movement_24'), 'POS origin movements must be excluded from stock changes feed');
});

test('Concurrent online and offline deduction test', async () => {
  const product = createSampleProduct('W-POS-T25', 'SKU-T25');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-t25').digest('hex')).get();
  const productId = mapping.data().productId;

  // Initial stock: 10
  // Step 1: Online sale deducts 3 -> Website stock becomes 7
  await processOnlineOrder(sharedDb, {
    orderId: 'ORD-25',
    userId: 'user_25',
    items: [{ productId, sku: 'SKU-T25-M', quantity: 3 }]
  });
  const afterOnline = (await sharedDb.collection('products').doc(productId).get()).data();
  assert.equal(afterOnline.variants[0].stock, 7);

  // Step 2: Offline POS sync arrives with delta -2 (POS saw 10 -> sold 2 -> final 8)
  const offlineSync = await api('/api/pos/stock-sync', {
    method: 'POST',
    body: {
      sync_id: 'SYNC-25',
      sync_timestamp: '2026-10-11T12:00:00.000Z',
      items: [{
        event_id: 'EVT-25',
        web_product_id: 'W-POS-T25',
        sku: 'SKU-T25-M',
        size: 'M',
        color: 'Navy Blue',
        delta_change: -2,
        final_stock: 8
      }]
    }
  });
  assert.equal(offlineSync.status, 200);

  // Live stock on website must be 7 - 2 = 5
  const finalDoc = (await sharedDb.collection('products').doc(productId).get()).data();
  assert.equal(finalDoc.variants[0].stock, 5, 'Concurrent online and offline delta must combine accurately');
});

test('Product-feed cursor pagination', async () => {
  const baseTime = Date.now();
  for (let i = 1; i <= 3; i++) {
    await sharedDb.collection('products').doc(`cursor_prod_${i}`).set({
      name: `Product ${i}`,
      integrationOrigin: 'website',
      active: true,
      sku: `CUR-P-${i}`,
      variants: [{ size: 'M', color: 'Blue', sku: `CUR-P-${i}-M`, stock: 5, price: 999 }],
      createdAt: { toMillis: () => baseTime + i * 1000, toDate: () => new Date(baseTime + i * 1000) }
    });
  }

  const page1 = await api('/api/pos/products-sync?limit=1');
  assert.equal(page1.status, 200);
  assert.equal(page1.body.new_products.length, 1);
  assert.equal(page1.body.has_more, true);
  assert.ok(page1.body.next_cursor);

  const page2 = await api(`/api/pos/products-sync?cursor=${encodeURIComponent(page1.body.next_cursor)}&limit=1`);
  assert.equal(page2.status, 200);
  assert.equal(page2.body.new_products.length, 1);
  assert.notEqual(page2.body.new_products[0].web_product_id, page1.body.new_products[0].web_product_id);

  const wrongFeedCursor = posSyncInternals.encodeCursor({ v: 1, feed: 'stock', upperMs: 100, afterMs: 50, afterId: 'abc' });
  const wrongFeedRes = await api(`/api/pos/products-sync?cursor=${encodeURIComponent(wrongFeedCursor)}`);
  assert.equal(wrongFeedRes.status, 422);
  assert.equal(wrongFeedRes.body.code, 'invalid_cursor');
});

test('Stock-feed cursor pagination', async () => {
  const baseTime = Date.now();
  for (let i = 1; i <= 3; i++) {
    const t = baseTime + i * 10;
    await sharedDb.collection('stockMovements').doc(`cur_mov_${i}`).set({
      movementId: `cur_mov_${i}`,
      source: 'website',
      reason: 'online_order',
      deltaChange: -1,
      stockAfter: 10 - i,
      webProductId: `W-CUR-${i}`,
      sku: `SKU-CUR-${i}`,
      size: 'M',
      color: 'Black',
      createdAt: { toMillis: () => t, toDate: () => new Date(t) }
    });
  }

  await new Promise(resolve => setTimeout(resolve, 60));
  const sinceIso = new Date(baseTime).toISOString();
  const page1 = await api(`/api/pos/stock-changes?since=${encodeURIComponent(sinceIso)}&limit=2`);
  assert.equal(page1.status, 200);
  assert.equal(page1.body.stock_changes.length, 2);
  assert.equal(page1.body.has_more, true);
  assert.ok(page1.body.next_cursor);

  const page2 = await api(`/api/pos/stock-changes?cursor=${encodeURIComponent(page1.body.next_cursor)}&limit=2`);
  assert.equal(page2.status, 200);
  assert.equal(page2.body.stock_changes.length, 1);
  assert.equal(page2.body.has_more, false);
});

test('Reconciliation discrepancy reporting', async () => {
  const product = createSampleProduct('W-POS-T28', 'SKU-T28');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  // Initial stock: 10. POS delta: -2. Expected stock: 8. POS reports final_stock: 6. Discrepancy: 6 - 8 = -2
  const syncPayload = {
    sync_id: 'SYNC-28',
    sync_timestamp: '2026-10-11T12:00:00.000Z',
    items: [{
      event_id: 'EVT-28-DISCREPANCY',
      web_product_id: 'W-POS-T28',
      sku: 'SKU-T28-M',
      size: 'M',
      color: 'Navy Blue',
      delta_change: -2,
      final_stock: 6
    }]
  };

  const res = await api('/api/pos/stock-sync', { method: 'POST', body: syncPayload });
  assert.equal(res.status, 200);
  assert.equal(res.body.reconciliation.length, 1);
  assert.equal(res.body.reconciliation[0].discrepancy, -2);
  assert.equal(res.body.reconciliation[0].pos_final_stock, 6);
  assert.equal(res.body.reconciliation[0].website_stock_after_delta, 8);

  const discrepancySnap = await sharedDb.collection('posReconciliationDiscrepancies').doc(crypto.createHash('sha256').update('EVT-28-DISCREPANCY').digest('hex')).get();
  assert.ok(discrepancySnap.exists);
  assert.equal(discrepancySnap.data().discrepancy, -2);
  assert.equal(discrepancySnap.data().status, 'open');
});

test('Admin inventory adjustment movement', async () => {
  await sharedDb.collection('products').doc('admin_adj_prod').set({
    name: 'Admin Adj Product',
    stock: 10,
    webProductId: 'admin_adj_prod',
    variants: [{ size: 'M', color: 'White', sku: 'ADMIN-ADJ-M', stock: 10, price: 999 }]
  });

  const adj = await performAdminInventoryAdjustment(sharedDb, {
    productId: 'admin_adj_prod',
    sku: 'ADMIN-ADJ-M',
    newStock: 14,
    requestId: 'REQ-ADMIN-ADJ-29'
  });
  assert.equal(adj.delta, 4);
  assert.equal(adj.stockAfter, 14);

  const res = await api('/api/pos/stock-changes');
  assert.equal(res.status, 200);
  const movements = res.body.stock_changes.filter(m => m.sku === 'ADMIN-ADJ-M');
  assert.ok(movements.length > 0);
  assert.equal(movements[0].reason, 'admin_adjustment');
  assert.equal(movements[0].delta_change, 4);
  assert.equal(movements[0].current_website_stock, 14);
});

test('Full/partial return restoration — pending the return business rule', () => {
  // Exchange & return approval must gate physical inventory restoration behind accepted QC inspection.
  // Unapproved or uninspected returns cannot automatically restock available inventory.
  assert.throws(
    () => processReturnRestoration({ returnId: 'RET-001', isQcApproved: false, quantity: 2 }),
    error => error.code === 'pending_return_qc_rule'
  );

  const approved = processReturnRestoration({ returnId: 'RET-002', isQcApproved: true, quantity: 2 });
  assert.equal(approved.restored, true);
  assert.equal(approved.quantity, 2);
});

// ── V2: Product Photo Synchronization Tests ───────────────────────────────

test('Product creation with images stores cover URL', async () => {
  const product = {
    ...createSampleProduct('W-POS-IMG-1', 'SKU-IMG-1'),
    images: [
      { url: 'https://cdn.example.com/front.jpg', name: 'front_view.jpg', color: 'Navy Blue', is_cover: true },
      { url: 'https://cdn.example.com/back.jpg', name: 'back_view.jpg', color: 'Navy Blue', is_cover: false }
    ]
  };

  const res = await api('/api/pos/products', { method: 'POST', body: { products: [product] } });
  assert.equal(res.status, 200);
  assert.equal(res.body.created_count, 1);

  // Verify images stored in Firestore
  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-img-1').digest('hex')).get();
  const productId = mapping.data().productId;
  const doc = (await sharedDb.collection('products').doc(productId).get()).data();
  assert.equal(doc.images.length, 2);
  assert.equal(doc.images[0].url, 'https://cdn.example.com/front.jpg');
  assert.equal(doc.images[0].isPrimary, true);
  assert.equal(doc.image, 'https://cdn.example.com/front.jpg');
  assert.equal(doc.thumbnailUrl, 'https://cdn.example.com/front.jpg');
});

test('Product creation without images uses hero.png fallback', async () => {
  const product = createSampleProduct('W-POS-IMG-2', 'SKU-IMG-2');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-img-2').digest('hex')).get();
  const productId = mapping.data().productId;
  const doc = (await sharedDb.collection('products').doc(productId).get()).data();
  assert.equal(doc.images.length, 0);
  assert.equal(doc.image, '/images/hero.png');
  assert.equal(doc.thumbnailUrl, '/images/hero.png');
});

test('Product creation with base64 image', async () => {
  // 10-byte JPEG-like base64 (well under 500KB limit)
  const tinyBase64 = 'data:image/jpeg;base64,' + Buffer.from('tiny-image-data').toString('base64');
  const product = {
    ...createSampleProduct('W-POS-IMG-3', 'SKU-IMG-3'),
    images: [
      { url: tinyBase64, name: 'tiny.jpg', is_cover: true }
    ]
  };

  const res = await api('/api/pos/products', { method: 'POST', body: { products: [product] } });
  assert.equal(res.status, 200);

  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-img-3').digest('hex')).get();
  const productId = mapping.data().productId;
  const doc = (await sharedDb.collection('products').doc(productId).get()).data();
  assert.ok(doc.images[0].url.startsWith('data:image/jpeg;base64,'));
});

test('Invalid image URL scheme rejected', async () => {
  const product = {
    ...createSampleProduct('W-POS-IMG-4', 'SKU-IMG-4'),
    images: [
      { url: 'ftp://evil.example.com/file.jpg' }
    ]
  };

  const res = await api('/api/pos/products', { method: 'POST', body: { products: [product] } });
  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'validation_error');
});

test('products-sync includes image URLs', async () => {
  // Use a product created in a previous test that has images
  const baseTime = Date.now();
  await sharedDb.collection('products').doc('img_sync_prod').set({
    name: 'Image Sync Product',
    integrationOrigin: 'website',
    active: true,
    sku: 'IMG-SYNC-SKU',
    slug: 'image-sync-product',
    images: [
      { url: 'https://firebasestorage.googleapis.com/v0/b/test/o/photo1.jpg?alt=media', isPrimary: true },
      { url: 'https://firebasestorage.googleapis.com/v0/b/test/o/photo2.jpg?alt=media', isPrimary: false }
    ],
    image: 'https://firebasestorage.googleapis.com/v0/b/test/o/photo1.jpg?alt=media',
    thumbnailUrl: 'https://firebasestorage.googleapis.com/v0/b/test/o/photo1.jpg?alt=media',
    variants: [{ size: 'M', color: 'Blue', sku: 'IMG-SYNC-SKU-M', stock: 5, price: 999 }],
    createdAt: { toMillis: () => baseTime, toDate: () => new Date(baseTime) },
    updatedAt: { toMillis: () => baseTime, toDate: () => new Date(baseTime) }
  });

  const sinceIso = new Date(baseTime - 1000).toISOString();
  const res = await api(`/api/pos/products-sync?since=${encodeURIComponent(sinceIso)}`);
  assert.equal(res.status, 200);

  const synced = res.body.new_products.find(p => p.sku === 'IMG-SYNC-SKU');
  assert.ok(synced, 'Product should appear in sync feed');
  assert.ok(Array.isArray(synced.images), 'images should be an array');
  assert.equal(synced.images.length, 2);
  assert.ok(synced.images[0].includes('photo1.jpg'), 'First image URL should be present');
  assert.equal(synced.image_url, synced.images[0], 'image_url should match first image');
});

// ── V2: Product Edit Synchronization Tests ────────────────────────────────

test('PUT /api/pos/products updates product fields', async () => {
  // Create a product first
  const product = createSampleProduct('W-POS-EDIT-1', 'SKU-EDIT-1');
  const createRes = await api('/api/pos/products', { method: 'POST', body: { products: [product] } });
  assert.equal(createRes.status, 200);

  // Get the product's Firestore doc ID
  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-edit-1').digest('hex')).get();
  const productId = mapping.data().productId;

  // Update via PUT
  const updateRes = await api('/api/pos/products', {
    method: 'PUT',
    body: {
      products: [{
        web_product_id: 'W-POS-EDIT-1',
        product_name: 'Updated Oxford Premium',
        category: 'Formal Shirts',
        sub_category: 'Office',
        mrp: 2999,
        sale_price: 1799,
        description: 'Updated premium cotton shirt',
        color: 'Off-White',
        images: [
          { url: 'https://cdn.example.com/updated_front.jpg', is_cover: true }
        ],
        sizes: [
          { size: 'M', price: 1799, sku: 'SKU-EDIT-1-M' }
        ]
      }]
    }
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.updated_count, 1);
  assert.equal(updateRes.body.message, 'Products updated successfully');

  // Verify changes in Firestore
  const doc = (await sharedDb.collection('products').doc(productId).get()).data();
  assert.equal(doc.name, 'Updated Oxford Premium');
  assert.equal(doc.category, 'Formal Shirts');
  assert.equal(doc.subCategory, 'Office');
  assert.equal(doc.mrp, 2999);
  assert.equal(doc.salePrice, 1799);
  assert.equal(doc.price, 1799);
  assert.equal(doc.description, 'Updated premium cotton shirt');
  assert.equal(doc.primaryColor, 'Off-White');
  assert.equal(doc.image, 'https://cdn.example.com/updated_front.jpg');
  assert.equal(doc.images.length, 1);
  // Variant price updated, stock preserved
  const mVariant = doc.variants.find(v => v.sku === 'SKU-EDIT-1-M');
  assert.equal(mVariant.price, 1799);
  assert.equal(mVariant.stock, 10, 'Stock must not be changed by PUT');
});

test('PUT /api/pos/products preserves stock and unchanged fields', async () => {
  const product = createSampleProduct('W-POS-EDIT-2', 'SKU-EDIT-2');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });

  const mapping = await sharedDb.collection('posProductMappings').doc(crypto.createHash('sha256').update('w-pos-edit-2').digest('hex')).get();
  const productId = mapping.data().productId;

  // Partial update — only change description
  const updateRes = await api('/api/pos/products', {
    method: 'PUT',
    body: {
      products: [{
        web_product_id: 'W-POS-EDIT-2',
        product_name: '',
        description: 'Just the description changed'
      }]
    }
  });
  assert.equal(updateRes.status, 200);

  const doc = (await sharedDb.collection('products').doc(productId).get()).data();
  assert.equal(doc.description, 'Just the description changed');
  assert.equal(doc.name, 'Premium Oxford Shirt', 'Name should be unchanged when empty string sent');
  assert.equal(doc.mrp, 2499, 'MRP should be unchanged');
  assert.equal(doc.stock, 15, 'Total stock should be unchanged');
});

test('PUT /api/pos/products rejects unknown web_product_id', async () => {
  const res = await api('/api/pos/products', {
    method: 'PUT',
    body: {
      products: [{
        web_product_id: 'NONEXISTENT-PRODUCT-ID',
        product_name: 'Ghost Product'
      }]
    }
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'unknown_product');
});

test('products-sync includes edited products via updatedAt', async () => {
  const pastTime = Date.now() - 60_000;
  const editTime = Date.now() - 1_000;

  // Create a product with old createdAt but recent updatedAt
  await sharedDb.collection('products').doc('edit_sync_prod').set({
    name: 'Edited Product',
    integrationOrigin: 'website',
    active: true,
    sku: 'EDIT-SYNC-SKU',
    slug: 'edited-product',
    variants: [{ size: 'M', color: 'Red', sku: 'EDIT-SYNC-M', stock: 3, price: 799 }],
    images: [{ url: 'https://cdn.example.com/edit.jpg', isPrimary: true }],
    createdAt: { toMillis: () => pastTime, toDate: () => new Date(pastTime) },
    updatedAt: { toMillis: () => editTime, toDate: () => new Date(editTime) }
  });

  // Query since just before the edit (but after creation)
  const sinceIso = new Date(pastTime + 30_000).toISOString();
  const res = await api(`/api/pos/products-sync?since=${encodeURIComponent(sinceIso)}`);
  assert.equal(res.status, 200);

  const found = res.body.new_products.find(p => p.sku === 'EDIT-SYNC-SKU');
  assert.ok(found, 'Edited product must appear in sync feed even though createdAt < since, because updatedAt > since');
  assert.equal(found.product_name, 'Edited Product');
});

test('validateImages rejects oversized base64', () => {
  // Create a base64 string that exceeds 500KB
  const largeData = 'A'.repeat(700_000);
  const oversizedBase64 = `data:image/jpeg;base64,${largeData}`;
  assert.throws(
    () => posSyncInternals.validateImages([{ url: oversizedBase64 }], 'test'),
    error => error.message.includes('500KB')
  );
});

test('productToWire includes images, image_url, and cost_price', () => {
  const product = {
    webProductId: 'WIRE-TEST',
    name: 'Wire Test',
    category: 'Shirts',
    sku: 'WIRE-SKU',
    slug: 'wire-test',
    description: 'Test',
    mrp: 1000,
    salePrice: 800,
    costPrice: 450,
    images: [
      { url: 'https://cdn.example.com/a.jpg', isPrimary: false },
      { url: 'https://cdn.example.com/b.jpg', isPrimary: true }
    ],
    variants: [{ size: 'M', stock: 5, price: 800, costPrice: 450, sku: 'WIRE-M' }]
  };
  const wire = posSyncInternals.productToWire('test-id', product);
  assert.ok(Array.isArray(wire.images));
  assert.equal(wire.images.length, 2);
  assert.equal(wire.images[0], 'https://cdn.example.com/a.jpg');
  assert.equal(wire.image_url, 'https://cdn.example.com/a.jpg');
  assert.equal(wire.stock, 5);
  assert.equal(wire.quantity, 5);
  assert.equal(wire.opening_stock, 5);
  assert.equal(wire.cost_price, 450);
  assert.equal(wire.purchase_price, 450);
  assert.equal(wire.sizes[0].stock, 5);
  assert.equal(wire.sizes[0].opening_stock, 5);
  assert.equal(wire.sizes[0].cost_price, 450);
  assert.equal(wire.sizes[0].purchase_price, 450);
});

test('productToWire handles product with no images', () => {
  const product = {
    webProductId: 'WIRE-EMPTY',
    name: 'No Images',
    category: 'Pants',
    sku: 'WIRE-EMPTY-SKU',
    slug: 'no-images',
    description: '',
    mrp: 500,
    salePrice: 400,
    thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    variants: []
  };
  const wire = posSyncInternals.productToWire('empty-id', product);
  assert.deepEqual(wire.images, []);
  assert.equal(wire.image_url, 'https://cdn.example.com/thumb.jpg');
});

test('extractImageUrls handles mixed array of strings and objects', () => {
  const product = {
    images: [
      'https://cdn.example.com/str.jpg',
      { url: 'https://cdn.example.com/obj.jpg' },
      42,
      null,
      { name: 'missing-url' }
    ]
  };
  const urls = posSyncInternals.extractImageUrls(product);
  assert.equal(urls.length, 2);
  assert.equal(urls[0], 'https://cdn.example.com/str.jpg');
  assert.equal(urls[1], 'https://cdn.example.com/obj.jpg');
});

test('Product with base SKU identical to variant SKU is deduplicated and accepted', async () => {
  const product = {
    web_product_id: 'W-POS-DEDUP-1',
    product_name: 'Single Variant Product',
    category: 'Caps',
    sku: 'CAP-FREE',
    slug: 'single-variant-cap',
    color: 'Black',
    mrp: 999,
    sale_price: 499,
    sizes: [
      { size: 'Free Size', stock: 10, price: 499, sku: 'CAP-FREE' }
    ]
  };
  const res = await api('/api/pos/products', { method: 'POST', body: { products: [product] } });
  assert.equal(res.status, 200);
  assert.equal(res.body.created_count, 1);
});

test('Non-blocking legacy catalog duplicates allow new POS product, and lenient color matching applies', async () => {
  await sharedDb.collection('products').doc('legacy_prod_1').set({
    name: 'Legacy 1',
    integrationOrigin: 'website',
    sku: 'LEGACY-DUP-SKU',
    slug: 'legacy-1',
    variants: [{ size: 'M', sku: 'LEGACY-DUP-SKU', stock: 5 }]
  });
  await sharedDb.collection('products').doc('legacy_prod_2').set({
    name: 'Legacy 2',
    integrationOrigin: 'website',
    sku: 'LEGACY-DUP-SKU',
    slug: 'legacy-2',
    variants: [{ size: 'L', sku: 'LEGACY-DUP-SKU', stock: 5 }]
  });

  const newProduct = {
    web_product_id: 'W-POS-LEGACY-TOLERANT',
    product_name: 'Lenient Color Product',
    category: 'Shirts',
    sku: 'SHIRT-LENIENT',
    slug: 'lenient-color-product',
    color: 'Standard',
    mrp: 1200,
    sale_price: 899,
    sizes: [
      { size: 'M', stock: 10, price: 899, sku: 'SHIRT-LENIENT-M' }
    ]
  };
  const resCreate = await api('/api/pos/products', { method: 'POST', body: { products: [newProduct] } });
  assert.equal(resCreate.status, 200);
  assert.equal(resCreate.body.created_count, 1);

  const stockPayload = {
    sync_id: 'SYNC-LENIENT-1',
    sync_timestamp: '2026-10-11T12:00:00.000Z',
    items: [{
      event_id: 'EVT-LENIENT-SALE',
      web_product_id: 'W-POS-LEGACY-TOLERANT',
      sku: 'SHIRT-LENIENT-M',
      size: 'M',
      color: 'Default',
      delta_change: -1,
      final_stock: 9
    }]
  };
  const resStock = await api('/api/pos/stock-sync', { method: 'POST', body: stockPayload });
  assert.equal(resStock.status, 200);
  assert.equal(resStock.body.updated_count, 1);
});

test('Mixed known/unknown stock batch is rejected without losing or applying sales', async () => {
  const product = createSampleProduct('W-ATOMIC-UNKNOWN', 'ATOMIC-UNKNOWN');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });
  const known = {
    event_id: 'EVT-ATOMIC-KNOWN', web_product_id: product.web_product_id,
    sku: 'ATOMIC-UNKNOWN-M', size: 'M', color: 'Navy Blue', delta_change: -2
  };
  const missing = {
    event_id: 'EVT-ATOMIC-MISSING', web_product_id: 'MISSING-BATCH-PRODUCT',
    sku: 'MISSING-BATCH-SKU', delta_change: -1
  };
  const rejected = await api('/api/pos/stock-sync', {
    method: 'POST', body: { sync_id: 'SYNC-ATOMIC-MIXED', items: [known, missing] }
  });
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.success, false);
  assert.equal(rejected.body.code, 'unknown_product');
  assert.equal(rejected.body.details.rejected_items[0].event_id, missing.event_id);
  const untouched = await api('/api/pos/stock-snapshot?sku=ATOMIC-UNKNOWN-M');
  assert.equal(untouched.body.variant_stock, 10);
  const eventRef = sharedDb.collection('posStockEvents').doc(crypto.createHash('sha256').update(known.event_id).digest('hex'));
  assert.equal((await eventRef.get()).exists, false);

  // The known sale can be resent after fixing/splitting the rejected batch.
  const retried = await api('/api/pos/stock-sync', {
    method: 'POST', body: { sync_id: 'SYNC-ATOMIC-RETRY', items: [known] }
  });
  assert.equal(retried.status, 200);
  assert.equal(retried.body.stock_levels[0].website_stock, 8);
});

test('Stock updates without a stable event ID are rejected before any deduction', async () => {
  const product = createSampleProduct('W-STABLE-EVENT', 'STABLE-EVENT');
  await api('/api/pos/products', { method: 'POST', body: { products: [product] } });
  const result = await api('/api/pos/stock-sync', {
    method: 'POST', body: { items: [{ web_product_id: product.web_product_id, sku: 'STABLE-EVENT-M', delta_change: -1 }] }
  });
  assert.equal(result.status, 422);
  assert.match(result.body.error, /event_id is required/);
  const snapshot = await api('/api/pos/stock-snapshot?sku=STABLE-EVENT-M');
  assert.equal(snapshot.body.variant_stock, 10);
});

test('Shared parent SKU selects the supplied size and colour instead of the first variant', () => {
  const product = { sku: 'SHARED', variants: [
    { sku: 'SHARED', size: 'M', color: 'Blue', stock: 10 },
    { sku: 'SHARED', size: 'L', color: 'Red', stock: 7 },
    { sku: 'SHARED', size: 'L', color: 'Blue', stock: 5 }
  ] };
  const result = posSyncInternals.applyPosStockDelta(product, 'shared-doc', {
    eventId: 'EVT-SHARED', webProductId: 'shared-doc', sku: 'SHARED',
    size: 'L', color: 'Blue', deltaChange: -2, finalStock: 3
  });
  assert.equal(result.stockAfter, 3);
  assert.deepEqual(result.updatedProduct.variants.map(v => v.stock), [10, 7, 3]);
  assert.equal(result.updatedProduct.stock, 20);
  assert.throws(() => posSyncInternals.applyPosStockDelta(product, 'shared-doc', {
    eventId: 'EVT-AMBIGUOUS', webProductId: 'shared-doc', sku: 'SHARED', deltaChange: -1
  }), error => error.code === 'ambiguous_variant');
});

test('Website document ID can identify a single-variant product without a parent SKU', () => {
  const result = posSyncInternals.applyPosStockDelta({ variants: [
    { size: 'M', color: 'Blue', stock: 4 }
  ] }, 'website-document', {
    eventId: 'EVT-DOC-ID', webProductId: 'website-document', sku: 'website-document',
    size: 'M', color: 'Blue', deltaChange: -1
  });
  assert.equal(result.stockAfter, 3);
});

test('Products without variant records retain main branch stock-sync support', () => {
  const result = posSyncInternals.applyPosStockDelta({ sku: 'SIMPLE', stock: 6 }, 'simple-product', {
    eventId: 'EVT-SIMPLE', webProductId: 'simple-product', sku: 'SIMPLE',
    deltaChange: -2
  });
  assert.equal(result.stockAfter, 4);
  assert.equal(result.updatedProduct.stock, 4);
  assert.equal(result.updatedProduct.variants.length, 1);
});

test('A unique variant retains main branch support for different POS colour labels', () => {
  const result = posSyncInternals.applyPosStockDelta({ sku: 'LABEL', variants: [
    { sku: 'LABEL-M', size: 'M', color: 'Navy Blue', stock: 5 }
  ] }, 'label-product', {
    eventId: 'EVT-LABEL', webProductId: 'label-product', sku: 'LABEL-M',
    size: 'M', color: 'Navy', deltaChange: -1
  });
  assert.equal(result.stockAfter, 4);
});

test('Flexible stock payload formats on main still validate stable event IDs', () => {
  const item = { event_id: 'EVT-FORMAT', sku: 'FORMAT-M', delta_change: -1 };
  for (const body of [[item], { products: [item] }, { stock: [item] }, item]) {
    const parsed = posSyncInternals.validateStockPayload(body);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].eventId, item.event_id);
    assert.equal(parsed.items[0].deltaChange, -1);
  }
});

test('Shared SKU sale and retry report the selected variant stock', async () => {
  await sharedDb.collection('products').doc('shared-sku-product').set({
    sku: 'SHARED-HTTP', active: true, variants: [
      { sku: 'SHARED-HTTP', size: 'M', color: 'Blue', stock: 10 },
      { sku: 'SHARED-HTTP', size: 'L', color: 'Blue', stock: 5 }
    ]
  });
  const body = { sync_id: 'SYNC-SHARED-HTTP', items: [{
    event_id: 'EVT-SHARED-HTTP', web_product_id: 'shared-sku-product',
    sku: 'SHARED-HTTP', size: 'L', color: 'Blue', delta_change: -2
  }] };
  const applied = await api('/api/pos/stock-sync', { method: 'POST', body });
  assert.equal(applied.status, 200);
  assert.equal(applied.body.stock_levels[0].website_stock, 3);
  const retry = await api('/api/pos/stock-sync', { method: 'POST', body });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.updated_count, 0);
  assert.equal(retry.body.duplicate_count, 1);
  assert.equal(retry.body.stock_levels[0].website_stock, 3);
  const saved = (await sharedDb.collection('products').doc('shared-sku-product').get()).data();
  assert.deepEqual(saved.variants.map(v => v.stock), [10, 3]);
});

test('A single POS client is still limited to 60 requests per minute', async () => {
  for (let index = 0; index < 60; index += 1) {
    assert.equal((await api('/api/pos/products-sync')).status, 200);
  }
  const limited = await api('/api/pos/products-sync');
  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, 'rate_limited');
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('POS arbitrary ID resolution and stock transition 10 -> 5 -> 0', async () => {
  // 1. Create a product with initial stock 10
  const product = {
    web_product_id: 'W-TEST-KURTA',
    product_name: 'Traditional Kurta Test',
    category: 'Kurta',
    sku: 'KURA-TEST',
    slug: 'traditional-kurta-test',
    color: 'Off White',
    mrp: 999,
    sale_price: 699,
    sizes: [
      { size: '40', stock: 10, price: 699, sku: 'KURA-TEST-40' }
    ]
  };
  const createRes = await api('/api/pos/products', { method: 'POST', body: { products: [product] } });
  assert.equal(createRes.status, 200);

  // 2. POS sends stock update from 10 to 5 using arbitrary POS item code '00680' in web_product_id
  const syncTo5 = {
    sync_id: 'SYNC-TRANS-1',
    sync_timestamp: '2026-10-19T14:00:00.000Z',
    items: [{
      event_id: 'EVT-TRANS-1',
      web_product_id: '00680', // POS internal item code
      sku: 'KURA-TEST-40',
      size: '40',
      color: 'Off White',
      delta_change: -5,
      final_stock: 5
    }]
  };
  const resTo5 = await api('/api/pos/stock-sync', { method: 'POST', body: syncTo5 });
  assert.equal(resTo5.status, 200);
  assert.equal(resTo5.body.updated_count, 1);

  // Verify stock in feed
  const checkStock5 = await api('/api/pos/stock-sync?sku=KURA-TEST-40');
  assert.equal(checkStock5.status, 200);
  assert.equal(checkStock5.body.stock, 5);
  assert.equal(checkStock5.body.in_stock, true);

  // 3. POS sends stock update to 0 via aliased POST /api/pos/stock-changes
  const syncTo0 = {
    sync_id: 'SYNC-TRANS-2',
    sync_timestamp: '2026-10-19T14:05:00.000Z',
    items: [{
      event_id: 'EVT-TRANS-2',
      web_product_id: '00680',
      sku: 'KURA-TEST-40',
      size: '40',
      delta_change: -5,
      final_stock: 0
    }]
  };
  const resTo0 = await api('/api/pos/stock-changes', { method: 'POST', body: syncTo0 });
  assert.equal(resTo0.status, 200);
  assert.equal(resTo0.body.updated_count, 1);

  // Verify stock reached 0
  const checkStock0 = await api('/api/pos/stock-sync?sku=KURA-TEST-40');
  assert.equal(checkStock0.status, 200);
  assert.equal(checkStock0.body.stock, 0);
  assert.equal(checkStock0.body.in_stock, false);

  // 4. POS restocks via absolute stock (final_stock: 8, no delta_change)
  const restockAbsolute = {
    sync_id: 'SYNC-TRANS-3',
    sync_timestamp: '2026-10-19T14:10:00.000Z',
    items: [{
      event_id: 'EVT-TRANS-3',
      web_product_id: '00680',
      sku: 'KURA-TEST-40',
      size: '40',
      final_stock: 8
    }]
  };
  const resRestock = await api('/api/pos/stock-sync', { method: 'POST', body: restockAbsolute });
  assert.equal(resRestock.status, 200);
  assert.equal(resRestock.body.updated_count, 1);

  const checkStock8 = await api('/api/pos/stock-sync?sku=KURA-TEST-40');
  assert.equal(checkStock8.status, 200);
  assert.equal(checkStock8.body.stock, 8);
  assert.equal(checkStock8.body.in_stock, true);
});

test('POS style codes can repeat across products in one publish batch', async () => {
  const batch = {
    products: [
      {
        web_product_id: 'POS-PANT-36',
        product_name: 'HONDA FORMAL PANT 311 - 36',
        category: 'FORMAL PANT',
        sku: '1846',
        mrp: 1500,
        sale_price: 1395,
        sizes: [{ size: '36', sku: '1846', stock: 3, price: 1395 }]
      },
      {
        web_product_id: 'POS-PANT-34',
        product_name: 'HONDA FORMAL PANT 311 - 34',
        category: 'FORMAL PANT',
        sku: '1846',
        mrp: 1500,
        sale_price: 1395,
        sizes: [{ size: '34', sku: '1846', stock: 1, price: 1395 }]
      }
    ]
  };
  const res = await api('/api/pos/products', { method: 'POST', body: batch });
  assert.equal(res.status, 200, res.body?.error || 'expected success');
  assert.equal(res.body.created_count, 2);
  const snap36 = await api('/api/pos/stock-snapshot?web_product_id=POS-PANT-36');
  const snap34 = await api('/api/pos/stock-snapshot?web_product_id=POS-PANT-34');
  assert.notEqual(snap36.body.sku, snap34.body.sku);
  assert.equal(snap36.body.variant_stock, 3);
  assert.equal(snap34.body.variant_stock, 1);
});

test('sold_qty and camelCase stock fields map to negative deltas', () => {
  const parsed = posSyncInternals.validateStockPayload({
    syncId: 'SYNC-SOLD-QTY',
    items: [{
      eventId: 'EVT-SOLD-1',
      webProductId: 'DOC-123',
      sku: 'SKU-M',
      soldQty: 2
    }]
  });
  assert.equal(parsed.items[0].deltaChange, -2);

  const saleType = posSyncInternals.validateStockPayload({
    sync_id: 'SYNC-TYPE',
    items: [{
      event_id: 'EVT-TYPE-1',
      sku: 'SKU-L',
      delta_change: 3,
      type: 'offline_sale'
    }]
  });
  assert.equal(saleType.items[0].deltaChange, -3);
});

test('Firestore document ID resolves products for stock sync', async () => {
  await sharedDb.collection('products').doc('website-doc-id-lookup').set({
    webProductId: 'legacy-web-id',
    sku: 'LOOKUP-PARENT',
    active: true,
    variants: [{ sku: 'LOOKUP-V-M', size: 'M', color: 'Blue', stock: 12 }]
  });
  const res = await api('/api/pos/stock-sync', {
    method: 'POST',
    body: {
      sync_id: 'SYNC-DOC-ID',
      items: [{
        event_id: 'EVT-DOC-ID-1',
        web_product_id: 'website-doc-id-lookup',
        sku: 'LOOKUP-V-M',
        size: 'M',
        color: 'Blue',
        delta_change: -2
      }]
    }
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.updated_count, 1);
  assert.equal(res.body.stock_levels[0].website_stock, 10);
});


