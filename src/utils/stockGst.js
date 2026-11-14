// Matches the POS stock valuation: GST applies to available stock at selling price.
const nonnegative = value => Math.max(0, Number(value || 0));

export function stockValueRows(products) {
  return products.flatMap(product => {
    if (product.isDeleted === true || product.demoOnly === true || product.isDemo === true) return [];
    const gstPercent = product.gstEnabled === true ? nonnegative(product.gstPercent) : 0;
    const variants = Array.isArray(product.variants) && product.variants.length ? product.variants : [product];
    return variants.map(variant => {
      const quantity = Math.max(0, Math.trunc(nonnegative(variant.stock ?? variant.onHand ?? variant.quantity ?? product.stock) - nonnegative(variant.reserved ?? product.reserved)));
      const unitPrice = nonnegative(variant.salePrice ?? variant.price ?? product.salePrice ?? product.price);
      const basePaise = Math.round(quantity * unitPrice * 100);
      const gstPaise = Math.round(basePaise * gstPercent / 100);
      return { quantity, baseValue: basePaise / 100, gstValue: gstPaise / 100, totalValue: (basePaise + gstPaise) / 100 };
    });
  });
}
