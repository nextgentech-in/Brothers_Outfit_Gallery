import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStockAction, linesFingerprint, reservationIdFor } from '../src/server/stockReservation.js';

test('the last unit in an online hold cannot also be sold at POS', () => {
  const product = { sku: 'SHIRT-M', stock: 1, quantity: 1, active: true };
  const line = { productId: 'shirt', sku: 'SHIRT-M', quantity: 1 };
  const held = applyStockAction(product, line, 'reserve');
  assert.equal(held.product.stock, 1);
  assert.equal(held.product.reserved, 1);
  assert.equal(held.availableAfter, 0);
  assert.throws(() => applyStockAction(held.product, line, 'sale'), /Insufficient available stock/);
  const completed = applyStockAction(held.product, line, 'finalize');
  assert.equal(completed.product.stock, 0);
  assert.equal(completed.product.reserved, 0);
});

test('cancelled hold releases availability and never changes on-hand', () => {
  const line = { productId: 'shirt', sku: 'SHIRT-M', quantity: 1 };
  const held = applyStockAction({ sku: 'SHIRT-M', stock: 2 }, line, 'reserve');
  const released = applyStockAction(held.product, line, 'release');
  assert.equal(released.product.stock, 2);
  assert.equal(released.product.reserved, 0);
  assert.throws(() => applyStockAction(released.product, line, 'release'), /needs review/);
});

test('reservation identifiers and item fingerprints are deterministic', () => {
  assert.equal(reservationIdFor('user-1', 'checkout-1'), reservationIdFor('user-1', 'checkout-1'));
  const first = [{ productId: 'a', size: 'M', color: 'Blue', quantity: 1 }, { productId: 'b', size: 'L', color: 'Red', quantity: 2 }];
  assert.equal(linesFingerprint(first), linesFingerprint([...first].reverse()));
  assert.notEqual(linesFingerprint(first), linesFingerprint([{ ...first[0], quantity: 2 }, first[1]]));
});
