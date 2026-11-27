import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { websiteProductIdentity } from './productNumbering.js';

const skuPart = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Edits keep every existing variant SKU/barcode. New variants on a sequentially
// numbered product continue its sequence (BOG-000123-V004 / BOG-000123-004);
// legacy products keep the SKU the admin form generated for them.
export function editedProductIdentity(data, oldData, otherProducts) {
  const variants = Array.isArray(data.variants) ? data.variants : [];
  const previous = Array.isArray(oldData.variants) ? oldData.variants : [];
  const previousSkus = new Set(previous.map(variant => String(variant?.sku || '').trim().toLowerCase()).filter(Boolean));
  const productSku = String(oldData.sku || data.sku || '').trim();
  const sequential = Number.isSafeInteger(Number(oldData.productNumber)) && Number(oldData.productNumber) > 0 && /^BOG-\d{6}$/i.test(productSku);
  const used = new Set([...otherProducts.flatMap(product => [product.sku, product.barcode,
    ...(Array.isArray(product.variants) ? product.variants : []).flatMap(variant => [variant.sku, variant.barcode])]),
    ...previous.flatMap(variant => [variant.sku, variant.barcode])].filter(Boolean).map(code => String(code).toLowerCase()));
  let next = Math.max(Number(oldData.nextVariantSequence) || 0, previous.length + 1,
    ...previous.map(variant => (Number(variant.variantSequence) || 0) + 1));
  let added = false;
  const nextVariants = variants.map(variant => {
    const sku = String(variant?.sku || '').trim();
    if (sku && previousSkus.has(sku.toLowerCase())) return variant;
    added = true;
    if (sequential) {
      while (used.has(`${productSku}-V${String(next).padStart(3, '0')}`.toLowerCase()) || used.has(`${productSku}-${String(next).padStart(3, '0')}`.toLowerCase())) next++;
      if (next > 999) throw Object.assign(new Error('A product supports at most 999 variant barcodes.'), { statusCode: 422 });
      const seq = String(next).padStart(3, '0');
      const identity = { sku: `${productSku}-V${seq}`, barcode: `${productSku}-${seq}`, variantSequence: next };
      used.add(identity.sku.toLowerCase()); used.add(identity.barcode.toLowerCase());
      next++;
      return { ...variant, ...identity };
    }
    const fallback = sku || [skuPart(productSku) || 'PRD', skuPart(variant?.color) || 'STANDARD', skuPart(variant?.size) || 'ONE-SIZE'].join('-');
    return { ...variant, sku: fallback };
  });
  // Never trust a client-sent sequence; only the server advances it.
  const { nextVariantSequence: _clientSequence, ...rest } = data;
  return { ...rest, sku: data.sku || oldData.sku, variants: nextVariants, ...(sequential && added ? { nextVariantSequence: next } : {}) };
}

export function registerCatalogUpsert(app, { getDb, requireAdminAuth, invalidateCatalog = () => {} }) {
app.post(['/api/admin/products/upsert', '/admin/products/upsert'], requireAdminAuth, async (req, res) => {
  try {
    const productId = String(req.body?.productId || '').trim();
    const requestId = String(req.body?.requestId || '').trim();
    const productData = req.body?.productData;
    const create = req.body?.create === true;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/.test(productId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(requestId) || !productData || typeof productData !== 'object' || Array.isArray(productData)) {
      return res.status(422).json({ error: 'Valid productId, requestId, and productData values are required.' });
    }
    if (productData.gstEnabled === true && (!Number.isFinite(Number(productData.gstPercent)) || Number(productData.gstPercent) <= 0 || Number(productData.gstPercent) > 100)) {
      return res.status(422).json({ error: 'GST percentage must be between 0.01 and 100.' });
    }
    const db = getDb();
    const productRef = db.collection('products').doc(productId);
    await db.runTransaction(async transaction => {
      const existingProduct = await transaction.get(productRef);
      if (create && existingProduct.exists) {
        const conflict = new Error('Product ID is already in use.');
        conflict.statusCode = 409;
        throw conflict;
      }
      if (!create && !existingProduct.exists) {
        const missing = new Error('Product not found.');
        missing.statusCode = 404;
        throw missing;
      }
      const oldData = existingProduct.exists ? existingProduct.data() : {};
      const sequenceRef = db.collection('erp_sequences').doc('productNumber');
      const counter = create ? await transaction.get(sequenceRef) : null;
      const catalog = await transaction.get(db.collection('products'));
      const productData = create
        ? websiteProductIdentity(req.body.productData, counter?.data()?.lastNumber, catalog.docs.map(doc => doc.data()))
        : editedProductIdentity(req.body.productData, oldData, catalog.docs.filter(doc => doc.id !== productId).map(doc => doc.data()));
    const variants = Array.isArray(productData.variants) ? productData.variants : [];
    const rawSkus = [productData.sku, ...variants.map(variant => variant?.sku)].map(value => String(value || '').trim()).filter(Boolean);
    if (!String(productData.sku || '').trim() || variants.some(variant => !String(variant?.sku || '').trim())) {
      throw Object.assign(new Error('The product and every sellable variant must have a SKU.'), { statusCode: 422 });
    }
    const normalizedSkus = rawSkus.map(value => value.toLowerCase());
    if (new Set(normalizedSkus).size !== normalizedSkus.length) {
      throw Object.assign(new Error('Product and variant SKUs must be unique.'), { statusCode: 409 });
    }

    const requestedSlug = String(productData.slug || '').trim().toLowerCase();
    for (const doc of catalog.docs) {
      if (doc.id === productId) continue;
      const existing = doc.data();
      if (requestedSlug && String(existing.slug || '').trim().toLowerCase() === requestedSlug) {
        throw Object.assign(new Error('Product slug is already assigned to another product.'), { statusCode: 409 });
      }
      const existingSkus = [existing.sku, ...(Array.isArray(existing.variants) ? existing.variants.map(variant => variant?.sku) : [])]
        .map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
      const conflict = normalizedSkus.find(sku => existingSkus.includes(sku));
      if (conflict) throw Object.assign(new Error('SKU is already assigned to another product.'), { statusCode: 409 });
    }



      const oldSkus = [oldData.sku, ...(Array.isArray(oldData.variants) ? oldData.variants.map(variant => variant?.sku) : [])]
        .map(value => String(value || '').trim()).filter(Boolean);
      if (!create) {
        // The parent SKU is the product's identity in the POS and on printed tags.
        const oldParent = String(oldData.sku || '').trim().toLowerCase();
        if (oldParent && oldParent !== String(productData.sku || '').trim().toLowerCase()) {
          throw Object.assign(new Error(`The product SKU (${oldData.sku}) cannot be changed after creation. Create a new product instead.`), { statusCode: 409 });
        }
        // Variants may be added (they get new SKUs; the store POS reads this same
        // Firestore catalog, so it sees them immediately). A variant can only be removed once it holds no
        // stock, so no physical item is left with a SKU the website no longer knows.
        const keptSkus = new Set(normalizedSkus);
        const removedWithStock = (Array.isArray(oldData.variants) ? oldData.variants : []).filter(variant => {
          const sku = String(variant?.sku || '').trim().toLowerCase();
          if (!sku || keptSkus.has(sku)) return false;
          return Number(variant.stock ?? variant.quantity ?? 0) > 0 || Number(variant.reserved ?? 0) > 0;
        });
        if (removedWithStock.length > 0) {
          const names = removedWithStock.map(variant => [variant.color, variant.size].filter(Boolean).join(' / ') || variant.sku).join(', ');
          throw Object.assign(new Error(`Set stock to 0 before removing ${names}. Variants that still hold stock cannot be deleted.`), { statusCode: 409 });
        }
      }
      const allNormalized = [...new Set([...oldSkus, ...rawSkus].map(value => value.toLowerCase()))];
      const mappingRefs = allNormalized.map(sku => db.collection('productSkuMappings').doc(crypto.createHash('sha256').update(sku).digest('hex')));
      const mappingSnaps = [];
      for (const ref of mappingRefs) mappingSnaps.push(await transaction.get(ref));
      const oldSlug = String(oldData.slug || '').trim().toLowerCase();
      const newSlug = String(productData.slug || '').trim().toLowerCase();
      if (!newSlug) {
        const invalidSlug = new Error('Product slug is required.');
        invalidSlug.statusCode = 422;
        throw invalidSlug;
      }
      const newSlugRef = db.collection('productSlugMappings').doc(crypto.createHash('sha256').update(newSlug).digest('hex'));
      const oldSlugRef = oldSlug ? db.collection('productSlugMappings').doc(crypto.createHash('sha256').update(oldSlug).digest('hex')) : null;
      const newSlugSnap = await transaction.get(newSlugRef);
      const oldSlugSnap = oldSlugRef && oldSlugRef.path !== newSlugRef.path ? await transaction.get(oldSlugRef) : newSlugSnap;
      if (newSlugSnap.exists && newSlugSnap.data().productId !== productId) {
        const slugConflict = new Error(`Slug ${productData.slug} is already reserved by another product.`);
        slugConflict.statusCode = 409;
        throw slugConflict;
      }
      mappingSnaps.forEach((snapshot, index) => {
        if (snapshot.exists && snapshot.data().productId !== productId && normalizedSkus.includes(allNormalized[index])) {
          const conflict = new Error(`SKU ${allNormalized[index]} is already reserved by another product.`);
          conflict.statusCode = 409;
          throw conflict;
        }
      });

      const { webProductId: _ignoredWebId, integrationOrigin: _ignoredOrigin, integrationCreatedAt: _ignoredIntegrationCreatedAt, createdAt: _ignoredCreatedAt, updatedAt: _ignoredUpdatedAt, ...editableData } = productData;
      const previousBySkuForHolds = new Map((Array.isArray(oldData.variants) ? oldData.variants : [])
        .map(variant => [String(variant.sku || '').trim().toLowerCase(), variant]));
      if (Array.isArray(editableData.variants) && editableData.variants.length > 0) {
        editableData.variants = editableData.variants.map(variant => {
          const reserved = create ? 0 : Number(previousBySkuForHolds.get(String(variant.sku || '').trim().toLowerCase())?.reserved ?? 0);
          const onHand = Number(variant.stock ?? variant.quantity ?? 0);
          if (!Number.isSafeInteger(reserved) || !Number.isSafeInteger(onHand) || onHand < reserved)
            throw Object.assign(new Error('Cannot set stock below reserved checkout quantity.'), { statusCode: 409 });
          return { ...variant, reserved };
        });
        editableData.reserved = editableData.variants.reduce((sum, variant) => sum + variant.reserved, 0);
        editableData.sizes = [...new Set(editableData.variants.filter(variant => Number(variant.stock ?? variant.quantity ?? 0) > variant.reserved)
          .map(variant => variant.size).filter(Boolean))];
      } else {
        const reserved = create ? 0 : Number(oldData.reserved ?? 0);
        const onHand = Number(editableData.stock ?? editableData.quantity ?? oldData.stock ?? 0);
        if (!Number.isSafeInteger(reserved) || !Number.isSafeInteger(onHand) || onHand < reserved)
          throw Object.assign(new Error('Cannot set stock below reserved checkout quantity.'), { statusCode: 409 });
        editableData.reserved = reserved;
      }
      if (!create) {
        delete editableData.productNumber;
        if (!Number.isSafeInteger(editableData.nextVariantSequence)) delete editableData.nextVariantSequence;
        if (oldData.barcode) editableData.barcode = oldData.barcode;
        editableData.variants = (editableData.variants || []).map(variant => {
          const saved = (oldData.variants || []).find(item => item.sku === variant.sku);
          return { ...variant, ...(saved?.barcode ? { barcode: saved.barcode } : {}), ...(saved?.variantSequence ? { variantSequence: saved.variantSequence } : {}) };
        });
      }
      const identity = existingProduct.exists ? {
        webProductId: oldData.webProductId || productId,
        integrationOrigin: oldData.integrationOrigin || 'website',
        integrationCreatedAt: oldData.integrationCreatedAt || oldData.createdAt || FieldValue.serverTimestamp(),
        createdAt: oldData.createdAt || FieldValue.serverTimestamp()
      } : {
        webProductId: productId,
        integrationOrigin: 'website',
        integrationCreatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      };
      if (existingProduct.exists) {
        const previousVariants = Array.isArray(oldData.variants) ? oldData.variants : [];
        const nextVariants = Array.isArray(editableData.variants) ? editableData.variants : [];
        if (previousVariants.length > 0) {
          const previousBySku = new Map(previousVariants.map(variant => [String(variant.sku || '').trim().toLowerCase(), variant]));
          nextVariants.forEach((variant, index) => {
            const previous = previousBySku.get(String(variant.sku || '').trim().toLowerCase());
            const before = Number(previous?.stock ?? previous?.quantity ?? 0);
            const after = Number(variant.stock ?? variant.quantity ?? 0);
            if (!Number.isSafeInteger(after) || after < 0) {
              const invalid = new Error(`Variant ${variant.sku} has invalid stock.`);
              invalid.statusCode = 422;
              throw invalid;
            }
            const delta = after - before;
            if (delta !== 0) {
              const movementId = `web_${crypto.createHash('sha256').update(`${requestId}|product-edit|${index}|${variant.sku}`).digest('hex')}`;
              transaction.create(db.collection('stockMovements').doc(movementId), {
                movementId, productId, webProductId: identity.webProductId, sku: variant.sku,
                size: variant.size || 'One Size', color: variant.color || editableData.primaryColor || 'Standard',
                deltaChange: delta, source: 'website', reason: 'admin_adjustment', externalReference: requestId,
                stockAfter: after, createdAt: FieldValue.serverTimestamp()
              });
            }
          });
        } else {
          const before = Number(oldData.stock ?? oldData.quantity ?? 0);
          const after = Number(editableData.stock ?? editableData.quantity ?? before);
          const delta = after - before;
          if (delta !== 0) {
            const movementId = `web_${crypto.createHash('sha256').update(`${requestId}|product-edit`).digest('hex')}`;
            transaction.create(db.collection('stockMovements').doc(movementId), {
              movementId, productId, webProductId: identity.webProductId, sku: editableData.sku || oldData.sku || '',
              size: 'One Size', color: editableData.primaryColor || oldData.primaryColor || 'Standard',
              deltaChange: delta, source: 'website', reason: 'admin_adjustment', externalReference: requestId,
              stockAfter: after, createdAt: FieldValue.serverTimestamp()
            });
          }
        }
      } else {
        const nextVariants = Array.isArray(editableData.variants) ? editableData.variants : [];
        if (nextVariants.length > 0) {
          nextVariants.forEach((variant, index) => {
            const initialQty = Number(variant.stock ?? variant.quantity ?? 0);
            if (initialQty > 0) {
              const movementId = `web_${crypto.createHash('sha256').update(`${requestId}|product-create|${index}|${variant.sku}`).digest('hex')}`;
              transaction.create(db.collection('stockMovements').doc(movementId), {
                movementId, productId, webProductId: identity.webProductId, sku: variant.sku,
                size: variant.size || 'One Size', color: variant.color || editableData.primaryColor || 'Standard',
                deltaChange: initialQty, source: 'website', reason: 'product_created', externalReference: requestId,
                stockAfter: initialQty, createdAt: FieldValue.serverTimestamp()
              });
            }
          });
        } else {
          const initialQty = Number(editableData.stock ?? editableData.quantity ?? 0);
          if (initialQty > 0) {
            const movementId = `web_${crypto.createHash('sha256').update(`${requestId}|product-create`).digest('hex')}`;
            transaction.create(db.collection('stockMovements').doc(movementId), {
              movementId, productId, webProductId: identity.webProductId, sku: editableData.sku || '',
              size: 'One Size', color: editableData.primaryColor || 'Standard',
              deltaChange: initialQty, source: 'website', reason: 'product_created', externalReference: requestId,
              stockAfter: initialQty, createdAt: FieldValue.serverTimestamp()
            });
          }
        }
      }
      if (create) transaction.set(sequenceRef, { lastNumber: productData.productNumber, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(productRef, { ...editableData, ...identity, updatedAt: FieldValue.serverTimestamp() }, { merge: !create });
      transaction.set(newSlugRef, { normalizedSlug: newSlug, slug: productData.slug, productId, webProductId: identity.webProductId, updatedAt: FieldValue.serverTimestamp() });
      if (oldSlugRef && oldSlugRef.path !== newSlugRef.path && oldSlugSnap.exists && oldSlugSnap.data().productId === productId) transaction.delete(oldSlugRef);

      for (let index = 0; index < mappingRefs.length; index += 1) {
        const sku = allNormalized[index];
        if (normalizedSkus.includes(sku)) {
          const displaySku = rawSkus[normalizedSkus.indexOf(sku)];
          transaction.set(mappingRefs[index], { normalizedSku: sku, sku: displaySku, productId, webProductId: identity.webProductId, updatedAt: FieldValue.serverTimestamp() });
        } else if (mappingSnaps[index].exists && mappingSnaps[index].data().productId === productId) {
          transaction.delete(mappingRefs[index]);
        }
      }
    });
    invalidateCatalog();
    return res.status(create ? 201 : 200).json({ success: true, id: productId });
  } catch (error) {
    console.error('Admin product upsert failed:', error);
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    const message = String(error?.message || '');
    const code = error?.code;
    if (/maximum allowed size|exceeds the maximum|too large/i.test(message)) {
      return res.status(413).json({ error: 'Product is too large to save (over 1 MB). This usually means one or more images did not upload to ImageKit and were embedded directly. Remove those images and upload them again.' });
    }
    if (code === 3) {
      return res.status(422).json({ error: `Invalid product data: ${message.slice(0, 200)}` });
    }
    if (code === 10 || /aborted|contention/i.test(message)) {
      return res.status(409).json({ error: 'Another save happened at the same moment. Please click Publish again.' });
    }
    if (code === 7 || code === 16 || /credential|permission|unauthenticated/i.test(message)) {
      return res.status(500).json({ error: 'Server database credentials are missing or invalid. Check the Firebase Admin environment variables.' });
    }
    if (code === 4 || code === 14 || /deadline|unavailable|timeout/i.test(message)) {
      return res.status(503).json({ error: 'Database is temporarily unreachable. Please try again in a moment.' });
    }
    return res.status(500).json({ error: `Unable to save product (${code || 'server error'}). Check the server logs for details.` });
  }
});

}
