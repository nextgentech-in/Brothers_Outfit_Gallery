import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { websiteProductIdentity } from './productNumbering.js';

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
      const productData = create ? websiteProductIdentity(req.body.productData, counter?.data()?.lastNumber, catalog.docs.map(doc => doc.data())) : req.body.productData;
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
        const oldSet = [...new Set(oldSkus.map(value => value.toLowerCase()))].sort();
        const newSet = [...new Set(normalizedSkus)].sort();
        if (JSON.stringify(oldSet) !== JSON.stringify(newSet)) {
          const identityConflict = new Error('Changing product or variant SKUs is not supported after creation because the POS contract has no product-update feed. Create a new product or perform a coordinated migration.');
          identityConflict.statusCode = 409;
          throw identityConflict;
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
        delete editableData.productNumber; delete editableData.nextVariantSequence;
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
