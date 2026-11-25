// Mirrors pos/shared/stockGst.ts exactly so the website inventory shows the same
// stock value as the POS: available stock valued at the purchase rate (costPrice),
// with GST applied when the product has GST enabled. Keep the two files in sync.
const nonnegative = value => Math.max(0, Number(value || 0));

export function stockValue(quantity, unitCostPrice, gstPercent) {
  const basePaise = Math.round(nonnegative(quantity) * nonnegative(unitCostPrice) * 100);
  const gstPaise = Math.round(basePaise * nonnegative(gstPercent) / 100);
  return { baseValue: basePaise / 100, gstValue: gstPaise / 100, totalValue: (basePaise + gstPaise) / 100 };
}

export function stockValueRows(products) {
  return products.flatMap(product => {
    if (product.isDeleted === true || product.isDemo === true || product.preview === true || product.isPreview === true || product.isSample === true) return [];
    const name = String(product.name || 'Unnamed product');
    const sku = String(product.sku || product.id);
    const searchable = `${product.id} ${name} ${sku}`.toLowerCase();
    if (searchable.includes('demo') || searchable.includes('preview') || searchable.includes('sample')) return [];
    const gstPercent = product.gstEnabled === true ? nonnegative(product.gstPercent) : 0;
    const variants = Array.isArray(product.variants) && product.variants.length ? product.variants : [product];
    return variants.map(variant => {
      const reserved = variant === product ? product.reserved : variant.reserved;
      const quantity = Math.max(0, Math.trunc(nonnegative(variant.stock ?? variant.onHand ?? variant.quantity ?? product.stock ?? product.onHand ?? product.quantity) - nonnegative(reserved)));
      const unitSellingPrice = nonnegative(variant.salePrice ?? variant.price ?? product.salePrice ?? product.price);
      const unitCostPrice = nonnegative(variant.costPrice ?? product.costPrice);
      return { productId: product.id, product: name, sku: String(variant.sku || sku), size: String(variant.size || ''), color: String(variant.color || ''), quantity,
        unitSellingPrice, unitCostPrice, gstPercent, ...stockValue(quantity, unitCostPrice, gstPercent) };
    });
  });
}
