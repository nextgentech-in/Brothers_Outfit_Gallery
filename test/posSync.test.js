import test from 'node:test';
import assert from 'node:assert/strict';
import { posSyncInternals } from '../src/server/posSync.js';

const validProduct = () => ({
  web_product_id: 'W-POS-1',
  product_name: 'Premium Shirt',
  category: ' Shirts ',
  sub_category: ' Casual ',
  sku: 'SHIRT-1',
  slug: 'premium-shirt',
  gsl_spec: '180 GSM',
  color: 'Black',
  description: 'Cotton shirt',
  mrp: 2499,
  sale_price: 1499,
  sizes: [
    { size: 'M', stock: 10, price: 1499, sku: 'SHIRT-1-M' },
    { size: 'L', stock: 5, price: 1499, sku: 'SHIRT-1-L' }
  ]
});

test('product batch normalizes taxonomy and preserves variant identity', () => {
  const [product] = posSyncInternals.validateProductsPayload({ products: [validProduct()] });
  assert.equal(product.category, 'Shirts');
  assert.equal(product.subCategory, 'Casual');
  assert.equal(product.variants[0].sku, 'SHIRT-1-M');
  assert.equal(product.variants[0].stock, 10);
});

test('product batch rejects duplicated variant SKUs atomically before a write', () => {
  const product = validProduct();
  product.sizes[1].sku = product.sizes[0].sku;
  assert.throws(() => posSyncInternals.validateProductsPayload({ products: [product] }), error => error.status === 422);
});

test('product batch rejects negative initial inventory', () => {
  const product = validProduct();
  product.sizes[0].stock = -1;
  assert.throws(() => posSyncInternals.validateProductsPayload({ products: [product] }), error => error.status === 422);
});

test('stock sync requires stable sync and event IDs', () => {
  const payload = {
    sync_timestamp: '2026-10-11T12:45:00.000Z',
    items: [{ web_product_id: 'W-POS-1', sku: 'SHIRT-1-M', size: 'M', color: 'Black', delta_change: -1, final_stock: 9 }]
  };
  assert.throws(() => posSyncInternals.validateStockPayload(payload), error => error.status === 422);
});

test('stock sync accepts sales and restocks but rejects zero deltas', () => {
  const base = {
    sync_id: 'SYNC-100',
    sync_timestamp: '2026-10-11T12:45:00.000Z',
    items: [
      { event_id: 'EVENT-1', web_product_id: 'W-POS-1', sku: 'SHIRT-1-M', size: 'M', color: 'Black', delta_change: -2, final_stock: 8 },
      { event_id: 'EVENT-2', web_product_id: 'W-POS-1', sku: 'SHIRT-1-L', size: 'L', color: 'Black', delta_change: 5, final_stock: 10 }
    ]
  };
  const result = posSyncInternals.validateStockPayload(base);
  assert.deepEqual(result.items.map(item => item.deltaChange), [-2, 5]);
  base.items[0].delta_change = 0;
  assert.throws(() => posSyncInternals.validateStockPayload(base), error => error.status === 422);
});

test('incremental feeds require strict UTC timestamps', () => {
  assert.equal(posSyncInternals.parseIsoTimestamp(undefined), null);
  assert.equal(posSyncInternals.parseIsoTimestamp('2026-10-11T10:00:00.000Z').toISOString(), '2026-10-11T10:00:00.000Z');
  assert.throws(() => posSyncInternals.parseIsoTimestamp('2026-10-11 10:00:00'), error => error.status === 422);
});

test('opaque cursors are feed-specific and retain stable window boundary', () => {
  const cursor = posSyncInternals.encodeCursor({ v: 1, feed: 'products', upperMs: 100, afterMs: 50, afterId: 'abc' });
  assert.deepEqual(posSyncInternals.decodeCursor(cursor, 'products'), { v: 1, feed: 'products', upperMs: 100, afterMs: 50, afterId: 'abc' });
  assert.throws(() => posSyncInternals.decodeCursor(cursor, 'stock'), error => error.status === 422);
});

test('website product wire format uses stable document ID fallback', () => {
  const wire = posSyncInternals.productToWire('firestore-id', {
    name: 'Website Shirt', categoryId: 'Shirts', active: true, sku: 'WEB-1', salePrice: 999, mrp: 1299,
    variants: [{ size: 'M', color: 'Blue', sku: 'WEB-1-M', stock: 3, price: 999 }]
  });
  assert.equal(wire.web_product_id, 'firestore-id');
  assert.equal(wire.sizes[0].stock, 3);
});

test('POS bearer authentication rejects missing/invalid values and accepts only an exact token', () => {
  const secret = 'test-pos-token-that-is-not-a-real-secret';
  assert.equal(posSyncInternals.isValidPosToken(secret, undefined), false);
  assert.equal(posSyncInternals.isValidPosToken(secret, 'Bearer wrong-token'), false);
  assert.equal(posSyncInternals.isValidPosToken(secret, `Basic ${secret}`), false);
  assert.equal(posSyncInternals.isValidPosToken(secret, `Bearer ${secret}`), true);
});

test('offline sale applies as a delta after a recent online sale and reports snapshot drift', () => {
  const product = {
    webProductId: 'W-POS-1',
    active: true,
    variants: [{ size: 'M', color: 'Black', sku: 'SHIRT-1-M', stock: 9, quantity: 9 }]
  };
  const item = { eventId: 'EVENT-1', webProductId: 'W-POS-1', sku: 'SHIRT-1-M', size: 'M', color: 'Black', deltaChange: -2, finalStock: 8 };
  const result = posSyncInternals.applyPosStockDelta(product, 'internal-1', item);
  assert.equal(result.stockAfter, 7);
  assert.equal(result.updatedProduct.stock, 7);
  assert.equal(result.discrepancy, 1);
});

test('restock delta is additive and stock cannot be clamped below zero', () => {
  const product = { webProductId: 'W-POS-1', variants: [{ size: 'L', color: 'Black', sku: 'SHIRT-1-L', stock: 3 }] };
  const restock = { eventId: 'EVENT-2', webProductId: 'W-POS-1', sku: 'SHIRT-1-L', size: 'L', color: 'Black', deltaChange: 5, finalStock: 8 };
  assert.equal(posSyncInternals.applyPosStockDelta(product, 'internal-1', restock).stockAfter, 8);
  assert.throws(() => posSyncInternals.applyPosStockDelta(product, 'internal-1', { ...restock, eventId: 'EVENT-3', deltaChange: -4, finalStock: 0 }), error => error.code === 'insufficient_stock');
});

test('unknown and mismatched variants are conflicts', () => {
  const product = { webProductId: 'W-POS-1', variants: [{ size: 'M', color: 'Black', sku: 'SHIRT-1-M', stock: 3 }] };
  const item = { eventId: 'EVENT-4', webProductId: 'W-POS-1', sku: 'UNKNOWN', size: 'M', color: 'Black', deltaChange: -1, finalStock: 2 };
  assert.throws(() => posSyncInternals.applyPosStockDelta(product, 'internal-1', item), error => error.code === 'unknown_variant');
  assert.throws(() => posSyncInternals.applyPosStockDelta(product, 'internal-1', { ...item, sku: 'SHIRT-1-M', size: 'L' }), error => error.code === 'variant_mismatch');
});

test('event fingerprint permits a retry in another sync batch but detects changed data', () => {
  const item = { eventId: 'EVENT-5', webProductId: 'W-POS-1', sku: 'SHIRT-1-M', size: 'M', color: 'Black', deltaChange: -1, finalStock: 2 };
  const first = posSyncInternals.stockEventFingerprint(item);
  assert.equal(first, posSyncInternals.stockEventFingerprint({ ...item, syncId: 'ANOTHER-BATCH' }));
  assert.notEqual(first, posSyncInternals.stockEventFingerprint({ ...item, deltaChange: -2 }));
});

test('duplicate product identity is stable but changed SKU mappings conflict', () => {
  const [product] = posSyncInternals.validateProductsPayload({ products: [validProduct()] });
  const first = posSyncInternals.productIdentityHash(product);
  assert.equal(first, posSyncInternals.productIdentityHash({ ...product, description: 'Website-managed edit' }));
  assert.notEqual(first, posSyncInternals.productIdentityHash({ ...product, variants: product.variants.map((variant, index) => index === 0 ? { ...variant, sku: 'CHANGED-M' } : variant) }));
});

test('website product feed excludes POS-origin and inactive products', () => {
  assert.equal(posSyncInternals.isWebsiteProductFeedEligible({ integrationOrigin: 'website', active: true }), true);
  assert.equal(posSyncInternals.isWebsiteProductFeedEligible({ active: true }), true);
  assert.equal(posSyncInternals.isWebsiteProductFeedEligible({ integrationOrigin: 'pos', active: true }), false);
  assert.equal(posSyncInternals.isWebsiteProductFeedEligible({ integrationOrigin: 'website', active: false }), false);
});
