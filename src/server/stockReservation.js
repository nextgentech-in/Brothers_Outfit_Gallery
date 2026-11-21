import crypto from 'crypto';

export const reservationIdFor = (uid, checkoutId) => `hold_${crypto.createHash('sha256').update(`${uid}|${checkoutId}`).digest('hex')}`;
const integer = value => Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
const qty = value => { const n = integer(value); if (n < 1 || !Number.isFinite(n)) throw new Error('Invalid stock quantity.'); return n; };
const token = value => String(value || '').trim().toLowerCase();

export function variantIndex(product, item) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (!variants.length) return -1;
  if (item.sku) {
    const bySku = variants.findIndex(v => token(v.sku) === token(item.sku));
    if (bySku >= 0) return bySku;
  }
  const size = token(item.size || item.selectedSize);
  const color = token(item.color || item.selectedColor);
  const candidates = variants.map((variant, index) => ({ variant, index })).filter(({ variant }) =>
    token(variant.size) === size && (!color || token(variant.color) === color || ['standard', 'default'].includes(token(variant.color))));
  if (candidates.length === 1) return candidates[0].index;
  const bySize = variants.map((variant, index) => ({ variant, index })).filter(({ variant }) => token(variant.size) === size);
  if (bySize.length === 1) return bySize[0].index;
  throw new Error('Selected variant is missing or ambiguous. Refresh the cart.');
}

// Product stock is on-hand; reserved is a nullable additive field on the
// product and each variant. The storefront displays on-hand minus reserved.
export function applyStockAction(product, item, action) {
  const quantity = qty(item.quantity);
  const index = variantIndex(product, item);
  const variants = Array.isArray(product.variants) ? product.variants.map(v => ({ ...v })) : [];
  const target = index >= 0 ? variants[index] : { ...product };
  const onHand = integer(target.stock ?? target.quantity ?? 0);
  const reserved = integer(target.reserved ?? 0);
  if (!Number.isSafeInteger(onHand) || !Number.isSafeInteger(reserved) || onHand < 0 || reserved < 0 || reserved > onHand)
    throw new Error('Stock balance needs manual review.');
  let nextStock = onHand, nextReserved = reserved;
  if (action === 'reserve') {
    if (onHand - reserved < quantity) throw new Error('Insufficient available stock.');
    nextReserved += quantity;
  } else if (action === 'release') {
    if (reserved < quantity) throw new Error('Reservation balance needs review.');
    nextReserved -= quantity;
  } else if (action === 'finalize') {
    if (reserved < quantity) throw new Error('Reservation balance needs review.');
    nextStock -= quantity; nextReserved -= quantity;
  } else if (action === 'sale') {
    if (onHand - reserved < quantity) throw new Error('Insufficient available stock.');
    nextStock -= quantity;
  } else throw new Error('Unknown stock action.');
  if (nextStock < nextReserved || nextStock < 0) throw new Error('Stock would become negative.');
  const nextTarget = { ...target, stock: nextStock, quantity: nextStock, reserved: nextReserved };
  let updated;
  if (index >= 0) {
    variants[index] = nextTarget;
    const totalStock = variants.reduce((sum, v) => sum + integer(v.stock ?? v.quantity ?? 0), 0);
    const totalReserved = variants.reduce((sum, v) => sum + integer(v.reserved ?? 0), 0);
    updated = { ...product, variants, stock: totalStock, quantity: totalStock, reserved: totalReserved,
      inStock: totalStock > 0, sizes: [...new Set(variants.filter(v => integer(v.stock ?? v.quantity ?? 0) - integer(v.reserved ?? 0) > 0).map(v => v.size).filter(Boolean))] };
  } else updated = { ...product, ...nextTarget, inStock: nextStock > 0 };
  return { product: updated, sku: index >= 0 ? variants[index].sku || product.sku || '' : product.sku || '',
    size: index >= 0 ? variants[index].size || item.size || '' : item.size || '',
    color: index >= 0 ? variants[index].color || item.color || '' : item.color || '',
    stockAfter: nextStock, availableAfter: nextStock - nextReserved };
}

export function canonicalLines(items) {
  return items.map(item => ({ productId: String(item.productId || item.id || ''),
    size: token(item.size || item.selectedSize), color: token(item.color || item.selectedColor), quantity: qty(item.quantity) }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export const linesFingerprint = items => crypto.createHash('sha256').update(JSON.stringify(canonicalLines(items))).digest('hex');
