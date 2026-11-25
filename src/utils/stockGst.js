// Mirrors pos/shared/stockGst.ts exactly so the website inventory shows the same
// stock value as the POS: available stock valued at the purchase rate (costPrice),
// with GST applied when the product has GST enabled. Keep the two files in sync.
const nonnegative = value => Math.max(0, Number(value || 0));

export function stockValue(quantity, unitCostPrice, gstPercent) {
  const basePaise = Math.round(nonnegative(quantity) * nonnegative(unitCostPrice) * 100);
  const gstPaise = Math.round(basePaise * nonnegative(gstPercent) / 100);
  return { baseValue: basePaise / 100, gstValue: gstPaise / 100, totalValue: (basePaise + gstPaise) / 100 };
}

// Mirrors the POS /products endpoint (pos/server/commerce.ts publicProduct + filter):
// the POS values stock from these normalized records, not raw Firestore documents.
function posProductView(data) {
  const productCost = data.costPrice ?? data.cost_price ?? data.purchasePrice ?? data.purchase_price ?? 0;
  return {
    id: data.id, name: data.name || '', sku: data.sku || '', costPrice: productCost,
    gstEnabled: data.gstEnabled === true, gstPercent: data.gstEnabled === true ? Number(data.gstPercent || 0) : 0,
    stock: Number(data.stock ?? 0) - Number(data.reserved ?? 0), reserved: 0,
    price: data.salePrice ?? data.price ?? 0,
    variants: (Array.isArray(data.variants) ? data.variants : []).map(v => ({
      sku: v.sku, size: v.size, color: v.color, reserved: 0,
      stock: Number(v.stock ?? v.quantity ?? 0) - Number(v.reserved ?? 0),
      price: Number(v.price ?? v.salePrice ?? data.salePrice ?? data.price ?? 0),
      costPrice: Number(v.costPrice ?? v.cost_price ?? v.purchasePrice ?? v.purchase_price ?? productCost)
    }))
  };
}

// Use this for the website inventory so totals equal the POS "Total stock value".
export function posStockValueRows(rawProducts) {
  const included = rawProducts.filter(data => {
    if (data.isDeleted === true) return false;
    if (data.demoOnly === true) return true;
    return !(data.isDemo === true || data.preview === true || data.isPreview === true || data.isSample === true);
  });
  return stockValueRows(included.map(posProductView));
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
