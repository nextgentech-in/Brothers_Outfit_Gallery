import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

test('Live POS inventory snapshots replace cached shop stock and stop on unsubscribe', async () => {
  let deliverSnapshot;
  let deliverError;
  let cancelled = false;
  let subscribedQuery;
  const fixtureKey = Symbol.for('brothers.productStockSubscription.fixture');
  globalThis[fixtureKey] = {
    collection: (_db, name) => ({ name }),
    query: (collection, ...constraints) => ({ collection, constraints }),
    orderBy: (field, direction) => ({ field, direction }),
    limit: count => ({ count }),
    onSnapshot: (query, onData, onError) => {
      subscribedQuery = query;
      deliverSnapshot = onData;
      deliverError = onError;
      return () => { cancelled = true; };
    },
    getDocs: () => { throw new Error('The live catalog should be reused without another fetch.'); },
    where: () => {}, doc: () => {}, getDoc: () => {}
  };
  // Exercise the actual service with local Firestore dependency fixtures. Node
  // hooks also resolve the extensionless Firebase config import used by Vite.
  const serviceUrl = new URL('../src/services/productService.js', import.meta.url).href;
  const firestoreUrl = `data:text/javascript,${encodeURIComponent(`
    export const { collection, query, where, orderBy, limit, getDocs, doc, getDoc, onSnapshot }
      = globalThis[Symbol.for('brothers.productStockSubscription.fixture')];
  `)}`;
  const configUrl = 'data:text/javascript,export const db = {};';
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL === serviceUrl && specifier === 'firebase/firestore') {
        return { url: firestoreUrl, shortCircuit: true };
      }
      if (context.parentURL === serviceUrl && specifier === '../firebase/firebaseConfig') {
        return { url: configUrl, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  });
  let service;
  try {
    service = await import(serviceUrl);
  } finally {
    hooks.deregister();
    delete globalThis[fixtureKey];
  }

  const updates = [];
  let observedError;
  const unsubscribe = service.subscribeToCatalog(products => updates.push(products), error => { observedError = error; });
  assert.equal(subscribedQuery.collection.name, 'products');
  assert.deepEqual(subscribedQuery.constraints, [{ field: 'createdAt', direction: 'desc' }, { count: 500 }]);
  const snapshot = stock => ({ docs: [{ id: 'shirt', data: () => ({
    active: true, stock, inStock: stock > 0,
    variants: [{ sku: 'SHIRT-M', size: 'M', stock }]
  }) }] });

  deliverSnapshot(snapshot(2));
  assert.equal((await service.getShopProducts()).products[0].stock, 2);
  deliverSnapshot(snapshot(1));
  assert.equal((await service.getShopProducts()).products[0].stock, 1);
  deliverSnapshot(snapshot(0));
  assert.equal((await service.getShopProducts()).products.length, 0, 'Sold-out stock must disappear from the shop.');
  assert.equal(updates.length, 3);
  const error = new Error('Firestore permission denied');
  deliverError(error);
  assert.equal(observedError, error);
  unsubscribe();
  assert.equal(cancelled, true);
});
