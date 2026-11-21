import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { registerCatalogUpsert } from '../src/server/catalogUpsert.js';

const records = new Map([['erp_sequences/productNumber', { lastNumber: 40 }]]);
const ref = path => ({ path, id: path.split('/').at(-1), get: async () => ({ id: path.split('/').at(-1), exists: records.has(path), data: () => records.get(path) }) });
let queue = Promise.resolve();
const db = {
  collection(name) { return { doc: id => ref(`${name}/${id}`), get: async () => ({ docs: [...records].filter(([path]) => path.startsWith(name + '/') && path.split('/').length === 2).map(([path]) => ({ id: path.split('/')[1], data: () => records.get(path) })) }) }; },
  runTransaction(callback) {
    const run = queue.catch(() => {}).then(async () => {
      const writes = [];
      const result = await callback({
        get: async target => { assert.equal(writes.length, 0, 'All transaction reads must precede writes'); return target.get(); },
        set: (target, value, options) => writes.push(() => records.set(target.path, { ...(options?.merge ? records.get(target.path) : {}), ...value })),
        create: (target, value) => writes.push(() => { assert.equal(records.has(target.path), false); records.set(target.path, value); }),
        delete: target => writes.push(() => records.delete(target.path))
      });
      writes.forEach(write => write()); return result;
    }); queue = run; return run;
  }
};
const app = express(); app.use(express.json());
registerCatalogUpsert(app, { getDb: () => db, requireAdminAuth: (req, res, next) => req.get('authorization') === 'Bearer admin-fixture' ? next() : res.status(401).end() });
const server = app.listen(0, '127.0.0.1'); let base;
before(async () => { if (!server.listening) await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(() => new Promise(resolve => server.close(resolve)));
const product = slug => ({ name: slug, slug, salePrice: 800, mrp: 1000, variants: [{ size: 'M', color: 'Black', stock: 2, price: 800 }] });
async function save(id, data, create = true) {
  const response = await fetch(base + '/api/admin/products/upsert', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer admin-fixture' }, body: JSON.stringify({ productId: id, requestId: `request-${id}`, create, productData: data }) });
  return { status: response.status, body: await response.json() };
}
test('concurrent website creates assign consecutive shared SKUs, variant barcodes and mappings atomically', async () => {
  const responses = await Promise.all([save('product-001', product('shirt-one')), save('product-002', product('shirt-two'))]);
  for (const response of responses) assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(records.get('products/product-001').sku, 'BOG-000041');
  assert.equal(records.get('products/product-002').sku, 'BOG-000042');
  const row = records.get('products/product-001');
  assert.equal(row.productNumber, 41); assert.equal(row.barcode, 'BOG-000041-001');
  assert.equal(row.variants[0].sku, 'BOG-000041-V001'); assert.equal(row.variants[0].barcode, 'BOG-000041-001');
  assert.equal(records.get('erp_sequences/productNumber').lastNumber, 42);
  assert.equal([...records.keys()].filter(key => key.startsWith('productSkuMappings/')).length, 4);
});
test('existing product edits preserve generated identities, and duplicate creates never advance the counter', async () => {
  const row = records.get('products/product-001');
  const result = await save('product-001', { ...row, productNumber: 999, barcode: 'CHANGED', name: 'Edited shirt', variants: row.variants.map(v => ({ ...v, barcode: 'CHANGED' })) }, false);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  const saved = records.get('products/product-001');
  assert.equal(saved.productNumber, 41); assert.equal(saved.barcode, 'BOG-000041-001'); assert.equal(saved.variants[0].barcode, 'BOG-000041-001');
  assert.equal((await save('product-001', product('another-shirt'))).status, 409);
  assert.equal(records.get('erp_sequences/productNumber').lastNumber, 42);
});
test('legacy barcode collisions are skipped and website numbering continues after a POS allocation', async () => {
  records.set('products/legacy-product', { sku: 'LEGACY', barcode: 'BOG-000043-001' });
  assert.equal((await save('product-003', product('shirt-three'))).status, 201);
  assert.equal(records.get('products/product-003').productNumber, 44);
  records.set('erp_sequences/productNumber', { lastNumber: 80 });
  assert.equal((await save('product-004', product('shirt-four'))).status, 201);
  assert.equal(records.get('products/product-004').sku, 'BOG-000081');
  assert.equal((await save('product-005', product('shirt-four'))).status, 409);
  assert.equal(records.has('products/product-005'), false); assert.equal(records.get('erp_sequences/productNumber').lastNumber, 81);
});
