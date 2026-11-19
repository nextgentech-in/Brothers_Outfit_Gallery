const invalid = message => Object.assign(new Error(message), { statusCode: 422 });

// Shared with the POS: erp_sequences/productNumber. Allocate only inside the save transaction.
export function websiteProductIdentity(data, currentNumber, catalog) {
  const variants = Array.isArray(data.variants) ? data.variants : [];
  const codes = new Set(catalog.flatMap(product => [product.sku, product.barcode,
    ...(Array.isArray(product.variants) ? product.variants : []).flatMap(variant => [variant.sku, variant.barcode])]).filter(Boolean).map(code => String(code).toLowerCase()));
  let number = Math.max(Number(currentNumber) || 0, ...catalog.map(product => Number(product.productNumber) || 0));
  let sku;
  do {
    number++;
    if (!Number.isSafeInteger(number) || number > 999999) throw invalid('Product number sequence is exhausted.');
    sku = `BOG-${String(number).padStart(6, '0')}`;
  } while (codes.has(sku.toLowerCase()) || codes.has(`${sku}-001`.toLowerCase()) || variants.some((_, index) =>
    codes.has(`${sku}-V${String(index + 1).padStart(3, '0')}`.toLowerCase()) || codes.has(`${sku}-${String(index + 1).padStart(3, '0')}`.toLowerCase())));
  if (variants.length > 999) throw invalid('A product supports at most 999 variant barcodes.');
  return { ...data, productNumber: number, sku, barcode: `${sku}-001`, nextVariantSequence: variants.length + 1,
    variants: variants.map((variant, index) => ({ ...variant,
      sku: `${sku}-V${String(index + 1).padStart(3, '0')}`, barcode: `${sku}-${String(index + 1).padStart(3, '0')}`, variantSequence: index + 1 })) };
}
