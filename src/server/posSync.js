import crypto from 'crypto';

const MAX_PRODUCT_BATCH = 25;
const MAX_STOCK_BATCH = 100;
const PAGE_SIZE_MAX = 100;
const POS_RATE_LIMIT_PER_MINUTE = 60;
const posRateBuckets = new Map();

export class PosSyncError extends Error {
  constructor(status, message, code = 'pos_sync_error', details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const normalizeKey = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
export const stableHash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
export const stableJsonHash = (value) => stableHash(JSON.stringify(value, Object.keys(value).sort()));

function canonicalText(value, field, { required = true, max = 200 } = {}) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (required && !text) throw new PosSyncError(422, `${field} is required.`, 'validation_error');
  if (text.length > max) throw new PosSyncError(422, `${field} must be at most ${max} characters.`, 'validation_error');
  return text;
}

function identifier(value, field) {
  const text = canonicalText(value, field, { max: 128 });
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(text)) {
    throw new PosSyncError(422, `${field} may contain only letters, numbers, dot, underscore, colon, and hyphen.`, 'validation_error');
  }
  return text;
}

function money(value, field, { allowZero = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (allowZero ? 0 : 0.01)) {
    throw new PosSyncError(422, `${field} must be a valid ${allowZero ? 'non-negative' : 'positive'} number.`, 'validation_error');
  }
  return Math.round(value * 100) / 100;
}

function integer(value, field, { min = Number.MIN_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new PosSyncError(422, `${field} must be an integer${min > Number.MIN_SAFE_INTEGER ? ` greater than or equal to ${min}` : ''}.`, 'validation_error');
  }
  return value;
}

function parseIsoTimestamp(value, { optional = true, field = 'since' } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new PosSyncError(422, `${field} must be a UTC ISO-8601 timestamp ending in Z.`, 'invalid_timestamp');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new PosSyncError(422, `${field} is not a valid timestamp.`, 'invalid_timestamp');
  return date;
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value._seconds === 'number') return value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6);
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function safeSlug(value, fallback) {
  const slug = String(value || fallback || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
  if (!slug) throw new PosSyncError(422, 'slug cannot be empty after normalization.', 'validation_error');
  return slug;
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(raw, feed) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
    if (parsed.v !== 1 || parsed.feed !== feed || !Number.isFinite(parsed.upperMs) || !Number.isFinite(parsed.afterMs) || typeof parsed.afterId !== 'string') {
      throw new Error('shape');
    }
    return parsed;
  } catch {
    throw new PosSyncError(422, 'cursor is invalid or belongs to a different feed.', 'invalid_cursor');
  }
}

function validateProduct(raw, productIndex) {
  const prefix = `products[${productIndex}]`;
  const webProductId = identifier(raw?.web_product_id, `${prefix}.web_product_id`);
  const name = canonicalText(raw?.product_name, `${prefix}.product_name`, { max: 200 });
  const category = canonicalText(raw?.category, `${prefix}.category`, { max: 100 });
  const subCategory = canonicalText(raw?.sub_category, `${prefix}.sub_category`, { required: false, max: 100 });
  const sku = canonicalText(raw?.sku, `${prefix}.sku`, { max: 100 });
  const color = canonicalText(raw?.color, `${prefix}.color`, { required: false, max: 80 }) || 'Standard';
  const mrp = money(raw?.mrp, `${prefix}.mrp`);
  const salePrice = money(raw?.sale_price, `${prefix}.sale_price`);
  if (salePrice > mrp) throw new PosSyncError(422, `${prefix}.sale_price cannot exceed mrp.`, 'validation_error');
  if (!Array.isArray(raw?.sizes) || raw.sizes.length < 1 || raw.sizes.length > 50) {
    throw new PosSyncError(422, `${prefix}.sizes must contain between 1 and 50 variants.`, 'validation_error');
  }
  const seenSkus = new Set();
  const seenVariants = new Set();
  const variants = raw.sizes.map((variant, variantIndex) => {
    const vp = `${prefix}.sizes[${variantIndex}]`;
    const size = canonicalText(variant?.size, `${vp}.size`, { max: 40 });
    const variantSku = canonicalText(variant?.sku, `${vp}.sku`, { max: 100 });
    const normalizedSku = normalizeKey(variantSku);
    const variantKey = `${normalizeKey(size)}|${normalizeKey(color)}`;
    if (seenSkus.has(normalizedSku)) throw new PosSyncError(422, `${vp}.sku is duplicated in this product.`, 'validation_error');
    if (seenVariants.has(variantKey)) throw new PosSyncError(422, `${vp} duplicates a size/color variant.`, 'validation_error');
    seenSkus.add(normalizedSku);
    seenVariants.add(variantKey);
    return {
      id: stableHash(`${webProductId}|${variantSku}`).slice(0, 24),
      size,
      color,
      sku: variantSku,
      stock: integer(variant?.stock, `${vp}.stock`, { min: 0 }),
      quantity: integer(variant?.stock, `${vp}.stock`, { min: 0 }),
      price: money(variant?.price, `${vp}.price`),
      salePrice: money(variant?.price, `${vp}.price`),
      isDefaultPrice: variantIndex === 0
    };
  });
  return {
    webProductId,
    name,
    category,
    subCategory,
    sku,
    slug: safeSlug(raw?.slug, name),
    gslSpec: canonicalText(raw?.gsl_spec, `${prefix}.gsl_spec`, { required: false, max: 500 }),
    color,
    description: canonicalText(raw?.description, `${prefix}.description`, { required: false, max: 5000 }),
    mrp,
    salePrice,
    variants
  };
}

function validateProductsPayload(body) {
  if (!body || !Array.isArray(body.products) || body.products.length < 1 || body.products.length > MAX_PRODUCT_BATCH) {
    throw new PosSyncError(422, `products must contain between 1 and ${MAX_PRODUCT_BATCH} items.`, 'validation_error');
  }
  const products = body.products.map(validateProduct);
  const ids = new Set();
  const skus = new Set();
  for (const product of products) {
    const idKey = normalizeKey(product.webProductId);
    if (ids.has(idKey)) throw new PosSyncError(422, `Duplicate web_product_id in batch: ${product.webProductId}`, 'validation_error');
    ids.add(idKey);
    for (const sku of [product.sku, ...product.variants.map(v => v.sku)]) {
      const skuKey = normalizeKey(sku);
      if (skus.has(skuKey)) throw new PosSyncError(422, `Duplicate SKU in batch: ${sku}`, 'validation_error');
      skus.add(skuKey);
    }
  }
  const estimatedTransactionWrites = products.reduce((total, product) => total + 5 + product.variants.length, 0);
  if (estimatedTransactionWrites > 450) {
    throw new PosSyncError(422, 'Product batch is too complex for one atomic transaction. Split it into smaller batches.', 'batch_too_large');
  }
  return products;
}

function validateStockPayload(body) {
  const syncId = identifier(body?.sync_id, 'sync_id');
  const syncTimestamp = parseIsoTimestamp(body?.sync_timestamp, { optional: false, field: 'sync_timestamp' });
  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > MAX_STOCK_BATCH) {
    throw new PosSyncError(422, `items must contain between 1 and ${MAX_STOCK_BATCH} items.`, 'validation_error');
  }
  const eventIds = new Set();
  const items = body.items.map((raw, index) => {
    const prefix = `items[${index}]`;
    const item = {
      eventId: identifier(raw?.event_id, `${prefix}.event_id`),
      webProductId: identifier(raw?.web_product_id, `${prefix}.web_product_id`),
      sku: canonicalText(raw?.sku, `${prefix}.sku`, { max: 100 }),
      size: canonicalText(raw?.size, `${prefix}.size`, { max: 40 }),
      color: canonicalText(raw?.color, `${prefix}.color`, { max: 80 }),
      deltaChange: integer(raw?.delta_change, `${prefix}.delta_change`),
      finalStock: integer(raw?.final_stock, `${prefix}.final_stock`, { min: 0 })
    };
    if (item.deltaChange === 0) throw new PosSyncError(422, `${prefix}.delta_change cannot be zero.`, 'validation_error');
    if (eventIds.has(item.eventId)) throw new PosSyncError(422, `Duplicate event_id in batch: ${item.eventId}`, 'validation_error');
    eventIds.add(item.eventId);
    return item;
  });
  return { syncId, syncTimestamp, items };
}

function isValidPosToken(configuredValue, authorizationHeader) {
  const configured = String(configuredValue || '');
  const header = String(authorizationHeader || '');
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const configuredBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  return Boolean(configured && configuredBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(configuredBuffer, suppliedBuffer));
}

function requirePosToken(req, res, next) {
  if (!isValidPosToken(process.env.POS_SYNC_API_TOKEN, req.headers.authorization)) {
    return res.status(401).json({ success: false, error: 'Unauthorized.', code: 'unauthorized' });
  }
  next();
}

function posRateLimit(req, res, next) {
  const now = Date.now();
  const tokenFingerprint = stableHash(String(req.headers.authorization || '')).slice(0, 12);
  const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${tokenFingerprint}`;
  let bucket = posRateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + 60_000 };
  bucket.count += 1;
  posRateBuckets.set(key, bucket);
  res.setHeader('X-RateLimit-Limit', String(POS_RATE_LIMIT_PER_MINUTE));
  if (bucket.count > POS_RATE_LIMIT_PER_MINUTE) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return res.status(429).json({ success: false, error: 'POS sync rate limit exceeded.', code: 'rate_limited' });
  }
  next();
}

function productToWire(id, product) {
  return {
    web_product_id: product.webProductId || id,
    product_name: product.name || '',
    category: product.category || product.categoryId || 'Uncategorized',
    sub_category: product.subCategory || '',
    sku: product.sku || '',
    slug: product.slug || id,
    gsl_spec: product.gslSpec || product.gsl || '',
    color: product.primaryColor || product.colors?.[0]?.name || product.colors?.[0] || product.variants?.[0]?.color || 'Standard',
    description: product.description || product.shortDescription || '',
    mrp: Number(product.mrp ?? product.compareAtPrice ?? product.price ?? 0),
    sale_price: Number(product.salePrice ?? product.price ?? 0),
    sizes: (Array.isArray(product.variants) ? product.variants : []).map(variant => ({
      size: variant.size || 'One Size',
      stock: Number(variant.stock ?? variant.quantity ?? 0),
      price: Number(variant.salePrice ?? variant.price ?? product.salePrice ?? product.price ?? 0),
      sku: variant.sku || product.sku || ''
    }))
  };
}

function compareTuple(record, cursor) {
  return record.timeMs > cursor.afterMs || (record.timeMs === cursor.afterMs && record.id > cursor.afterId);
}

function productIdentityHash(product) {
  return stableHash(JSON.stringify({
    webProductId: product.webProductId,
    skus: [product.sku, ...product.variants.map(variant => variant.sku)].map(normalizeKey).sort()
  }));
}

function isWebsiteProductFeedEligible(product) {
  return product.integrationOrigin !== 'pos' && product.active !== false;
}

function stockEventFingerprint(item) {
  return stableHash(JSON.stringify({
    webProductId: item.webProductId,
    sku: normalizeKey(item.sku),
    size: normalizeKey(item.size),
    color: normalizeKey(item.color),
    deltaChange: item.deltaChange,
    finalStock: item.finalStock
  }));
}

function applyPosStockDelta(product, productId, item) {
  if ((product.webProductId || productId) !== item.webProductId) {
    throw new PosSyncError(409, `web_product_id ${item.webProductId} does not match the resolved product.`, 'identity_conflict');
  }
  const variants = Array.isArray(product.variants) ? product.variants.map(variant => ({ ...variant })) : [];
  const variantIndex = variants.findIndex(variant => normalizeKey(variant.sku) === normalizeKey(item.sku));
  if (variantIndex < 0) throw new PosSyncError(409, `Unknown variant SKU ${item.sku}.`, 'unknown_variant');
  const variant = variants[variantIndex];
  if (normalizeKey(variant.size) !== normalizeKey(item.size) || normalizeKey(variant.color || product.primaryColor || 'Standard') !== normalizeKey(item.color)) {
    throw new PosSyncError(409, `SKU ${item.sku} does not match the supplied size/color.`, 'variant_mismatch');
  }
  const before = Number(variant.stock ?? variant.quantity ?? 0);
  const after = before + item.deltaChange;
  if (!Number.isSafeInteger(before) || after < 0) {
    throw new PosSyncError(409, `Stock event ${item.eventId} would make ${item.sku} negative. Manual reconciliation is required.`, 'insufficient_stock');
  }
  variants[variantIndex] = { ...variant, stock: after, quantity: after };
  const totalStock = variants.reduce((sum, candidate) => sum + Number(candidate.stock ?? candidate.quantity ?? 0), 0);
  return {
    stockAfter: after,
    discrepancy: item.finalStock - after,
    updatedProduct: {
      ...product,
      variants,
      stock: totalStock,
      quantity: totalStock,
      inStock: totalStock > 0,
      active: totalStock > 0 ? true : product.active,
      sizes: [...new Set(variants.filter(candidate => Number(candidate.stock ?? candidate.quantity ?? 0) > 0).map(candidate => candidate.size))]
    }
  };
}

function apiHandler(handler) {
  return async (req, res) => {
    const correlationId = String(req.headers['x-correlation-id'] || crypto.randomUUID()).slice(0, 100);
    res.setHeader('X-Correlation-ID', correlationId);
    try {
      await handler(req, res, correlationId);
    } catch (error) {
      const status = error instanceof PosSyncError ? error.status : 500;
      const safeMessage = status === 500 ? 'Unexpected POS synchronization failure.' : error.message;
      console.error('[POS Sync]', { correlationId, endpoint: req.path, status, code: error.code || 'unexpected_error', message: error.message });
      res.status(status).json({ success: false, error: safeMessage, code: error.code || 'unexpected_error', correlation_id: correlationId, ...(error.details ? { details: error.details } : {}) });
    }
  };
}

async function findProductRef(db, webProductId) {
  const mappingRef = db.collection('posProductMappings').doc(stableHash(normalizeKey(webProductId)));
  const mapping = await mappingRef.get();
  if (mapping.exists) return db.collection('products').doc(mapping.data().productId);
  const direct = db.collection('products').doc(webProductId);
  const directSnap = await direct.get();
  if (directSnap.exists && (directSnap.data().webProductId || directSnap.id) === webProductId) return direct;
  const match = await db.collection('products').where('webProductId', '==', webProductId).limit(2).get();
  if (match.size > 1) throw new PosSyncError(409, `Multiple website products map to ${webProductId}.`, 'identity_conflict');
  return match.empty ? null : match.docs[0].ref;
}

export function registerPosSyncRoutes(app, { getDb, FieldValue, invalidateProductCache = () => {} }) {
  app.use('/api/pos', requirePosToken, posRateLimit);

  app.post('/api/pos/products', apiHandler(async (req, res, correlationId) => {
    const products = validateProductsPayload(req.body);
    const db = getDb();
    const catalog = await db.collection('products').get();
    const slugReservations = await db.collection('productSlugMappings').get();
    const legacySkuOwners = new Map();
    const occupiedSlugs = new Set();
    for (const doc of catalog.docs) {
      const data = doc.data();
      if (data.slug) occupiedSlugs.add(normalizeKey(data.slug));
      for (const sku of [data.sku, ...(Array.isArray(data.variants) ? data.variants.map(v => v.sku) : [])].filter(Boolean)) {
        const key = normalizeKey(sku);
        if (legacySkuOwners.has(key) && legacySkuOwners.get(key) !== doc.id) {
          throw new PosSyncError(409, `Legacy catalog has duplicate SKU ${sku}; run mapping reconciliation first.`, 'legacy_sku_conflict');
        }
        legacySkuOwners.set(key, doc.id);
      }
    }
    for (const doc of slugReservations.docs) {
      const reserved = doc.data();
      if (reserved.normalizedSlug || reserved.slug) occupiedSlugs.add(normalizeKey(reserved.normalizedSlug || reserved.slug));
    }

    const assignedSlugs = new Set();
    for (const product of products) {
      const base = product.slug;
      let candidate = base;
      let suffix = 2;
      while (occupiedSlugs.has(normalizeKey(candidate)) || assignedSlugs.has(normalizeKey(candidate))) candidate = `${base}-${suffix++}`;
      product.resolvedSlug = candidate;
      assignedSlugs.add(normalizeKey(candidate));
    }

    const createdCount = await db.runTransaction(async transaction => {
      const contexts = [];
      let localCreatedCount = 0;
      for (const product of products) {
        const mappingRef = db.collection('posProductMappings').doc(stableHash(normalizeKey(product.webProductId)));
        const productId = `pos_${stableHash(product.webProductId).slice(0, 24)}`;
        const productRef = db.collection('products').doc(productId);
        const slugRef = db.collection('productSlugMappings').doc(stableHash(normalizeKey(product.resolvedSlug)));
        const allSkus = [product.sku, ...product.variants.map(v => v.sku)];
        const skuRefs = allSkus.map(sku => db.collection('productSkuMappings').doc(stableHash(normalizeKey(sku))));
        const mappingSnap = await transaction.get(mappingRef);
        const productSnap = await transaction.get(productRef);
        const slugSnap = await transaction.get(slugRef);
        const skuSnaps = [];
        for (const ref of skuRefs) skuSnaps.push(await transaction.get(ref));
        contexts.push({ product, mappingRef, mappingSnap, productRef, productSnap, slugRef, slugSnap, skuRefs, skuSnaps, productId, allSkus });
      }

      for (const context of contexts) {
        const { product, mappingRef, mappingSnap, productRef, productSnap, slugRef, slugSnap, skuRefs, skuSnaps, productId, allSkus } = context;
        const immutableIdentity = productIdentityHash(product);
        if (mappingSnap.exists) {
          const existing = mappingSnap.data();
          if (existing.productId !== productId || existing.identityHash !== immutableIdentity) {
            throw new PosSyncError(409, `web_product_id ${product.webProductId} conflicts with its existing SKU mapping.`, 'identity_conflict');
          }
          continue; // Duplicate create is intentionally a no-op; never reset live stock or website edits.
        }
        if (productSnap.exists) throw new PosSyncError(409, `Generated product mapping for ${product.webProductId} is already occupied.`, 'identity_conflict');
        if (slugSnap.exists && slugSnap.data().productId !== productId) throw new PosSyncError(409, `Slug ${product.resolvedSlug} was concurrently reserved by another product. Retry the batch to select another suffix.`, 'slug_conflict');
        for (let index = 0; index < skuSnaps.length; index += 1) {
          const normalizedSku = normalizeKey(allSkus[index]);
          const legacyOwner = legacySkuOwners.get(normalizedSku);
          if (legacyOwner && legacyOwner !== productId) throw new PosSyncError(409, `SKU ${allSkus[index]} is already assigned to another product.`, 'sku_conflict');
          if (skuSnaps[index].exists && skuSnaps[index].data().productId !== productId) {
            throw new PosSyncError(409, `SKU ${allSkus[index]} is already assigned to another product.`, 'sku_conflict');
          }
        }

        const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
        const availableSizes = [...new Set(product.variants.filter(v => v.stock > 0).map(v => v.size))];
        transaction.create(productRef, {
          webProductId: product.webProductId,
          integrationOrigin: 'pos',
          name: product.name,
          category: product.category,
          categoryId: product.category,
          categoryKey: normalizeKey(product.category),
          subCategory: product.subCategory,
          subCategoryKey: normalizeKey(product.subCategory),
          sku: product.sku,
          slug: product.resolvedSlug,
          gslSpec: product.gslSpec,
          gsl: product.gslSpec,
          primaryColor: product.color,
          colors: [{ name: product.color }],
          description: product.description,
          shortDescription: product.description.slice(0, 240),
          mrp: product.mrp,
          compareAtPrice: product.mrp,
          salePrice: product.salePrice,
          price: product.salePrice,
          variants: product.variants,
          stock: totalStock,
          quantity: totalStock,
          sizes: availableSizes,
          allSizes: [...new Set(product.variants.map(v => v.size))],
          active: true,
          inStock: totalStock > 0,
          images: [],
          image: '/images/hero.png',
          thumbnailUrl: '/images/hero.png',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          integrationCreatedAt: FieldValue.serverTimestamp()
        });
        transaction.create(mappingRef, { webProductId: product.webProductId, productId, origin: 'pos', identityHash: immutableIdentity, createdAt: FieldValue.serverTimestamp() });
        transaction.set(slugRef, { normalizedSlug: normalizeKey(product.resolvedSlug), slug: product.resolvedSlug, productId, webProductId: product.webProductId, createdAt: FieldValue.serverTimestamp() });
        skuRefs.forEach((ref, index) => transaction.create(ref, { normalizedSku: normalizeKey(allSkus[index]), sku: allSkus[index], productId, webProductId: product.webProductId, createdAt: FieldValue.serverTimestamp() }));
        const taxonomyRef = db.collection('posTaxonomy').doc(stableHash(`${normalizeKey(product.category)}|${normalizeKey(product.subCategory)}`));
        transaction.set(taxonomyRef, { category: product.category, categoryKey: normalizeKey(product.category), subCategory: product.subCategory, subCategoryKey: normalizeKey(product.subCategory), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        localCreatedCount += 1;
      }
      return localCreatedCount;
    });

    invalidateProductCache();
    console.info('[POS Sync] products accepted', { correlationId, received: products.length, created: createdCount, duplicates: products.length - createdCount });
    res.json({ success: true, message: 'Products published successfully', created_count: createdCount });
  }));

  app.get('/api/pos/products-sync', apiHandler(async (req, res) => {
    const since = parseIsoTimestamp(req.query.since, { optional: true });
    const cursor = decodeCursor(req.query.cursor, 'products');
    const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(req.query.limit || '100', 10) || 100));
    const upperMs = cursor?.upperMs ?? Date.now();
    const afterMs = cursor?.afterMs ?? (since?.getTime() ?? 0);
    const afterId = cursor?.afterId ?? '';
    const snapshot = await getDb().collection('products').get();
    const eligible = snapshot.docs.map(doc => {
      const product = doc.data();
      return { id: doc.id, product, timeMs: timestampMillis(product.integrationCreatedAt || product.createdAt) };
    }).filter(record => isWebsiteProductFeedEligible(record.product) && record.timeMs <= upperMs && compareTuple(record, { afterMs, afterId }))
      .sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id));
    const page = eligible.slice(0, limit);
    const hasMore = eligible.length > page.length;
    const last = page.at(-1);
    const nextCursor = hasMore && last ? encodeCursor({ v: 1, feed: 'products', upperMs, afterMs: last.timeMs, afterId: last.id }) : null;
    res.json({ success: true, server_time: new Date(upperMs).toISOString(), new_products: page.map(record => productToWire(record.id, record.product)), has_more: hasMore, next_cursor: nextCursor });
  }));

  app.post('/api/pos/stock-sync', apiHandler(async (req, res, correlationId) => {
    const payload = validateStockPayload(req.body);
    const db = getDb();
    const resolved = [];
    for (const item of payload.items) {
      const productRef = await findProductRef(db, item.webProductId);
      if (!productRef) throw new PosSyncError(409, `Unknown web_product_id ${item.webProductId}.`, 'unknown_product');
      resolved.push({ item, productRef, eventRef: db.collection('posStockEvents').doc(stableHash(item.eventId)), movementRef: db.collection('stockMovements').doc(`pos_${stableHash(item.eventId)}`) });
    }

    const { updatedCount, duplicateCount, reconciliation } = await db.runTransaction(async transaction => {
      let localUpdatedCount = 0;
      let localDuplicateCount = 0;
      const localReconciliation = [];
      const eventSnaps = [];
      const productSnaps = new Map();
      for (const entry of resolved) eventSnaps.push(await transaction.get(entry.eventRef));
      for (const entry of resolved) {
        if (!productSnaps.has(entry.productRef.path)) productSnaps.set(entry.productRef.path, await transaction.get(entry.productRef));
      }
      const workingProducts = new Map([...productSnaps.entries()].map(([path, snap]) => [path, { snap, data: snap.data() }]));

      for (let index = 0; index < resolved.length; index += 1) {
        const entry = resolved[index];
        const item = entry.item;
        // event_id is the durable item identity. sync_id groups an upload attempt,
        // but is intentionally excluded so an event can be retried in a later batch.
        const fingerprint = stockEventFingerprint(item);
        const existingEvent = eventSnaps[index];
        if (existingEvent.exists) {
          if (existingEvent.data().fingerprint !== fingerprint) throw new PosSyncError(409, `event_id ${item.eventId} was already used with different data.`, 'inconsistent_replay');
          localDuplicateCount += 1;
          continue;
        }
        const working = workingProducts.get(entry.productRef.path);
        if (!working?.snap.exists) throw new PosSyncError(409, `Product ${item.webProductId} no longer exists.`, 'unknown_product');
        const { updatedProduct, stockAfter: after, discrepancy } = applyPosStockDelta(working.data, working.snap.id, item);
        working.data = updatedProduct;
        transaction.create(entry.eventRef, { eventId: item.eventId, syncId: payload.syncId, fingerprint, webProductId: item.webProductId, sku: item.sku, deltaChange: item.deltaChange, finalStock: item.finalStock, websiteStockAfter: after, discrepancy, syncTimestamp: payload.syncTimestamp, acceptedAt: FieldValue.serverTimestamp() });
        transaction.create(entry.movementRef, { movementId: entry.movementRef.id, productId: working.snap.id, webProductId: item.webProductId, sku: item.sku, size: item.size, color: item.color, deltaChange: item.deltaChange, source: 'pos', reason: item.deltaChange < 0 ? 'offline_sale' : 'pos_stock_inward', externalReference: item.eventId, syncId: payload.syncId, stockAfter: after, createdAt: FieldValue.serverTimestamp() });
        if (discrepancy !== 0) {
          const discrepancyRef = db.collection('posReconciliationDiscrepancies').doc(stableHash(item.eventId));
          transaction.set(discrepancyRef, { eventId: item.eventId, syncId: payload.syncId, webProductId: item.webProductId, sku: item.sku, posFinalStock: item.finalStock, websiteStockAfterDelta: after, discrepancy, status: 'open', createdAt: FieldValue.serverTimestamp() });
          localReconciliation.push({ event_id: item.eventId, sku: item.sku, pos_final_stock: item.finalStock, website_stock_after_delta: after, discrepancy });
        }
        localUpdatedCount += 1;
      }
      for (const entry of resolved) {
        const working = workingProducts.get(entry.productRef.path);
        if (working) transaction.update(entry.productRef, { ...working.data, updatedAt: FieldValue.serverTimestamp() });
      }
      return { updatedCount: localUpdatedCount, duplicateCount: localDuplicateCount, reconciliation: localReconciliation };
    });

    invalidateProductCache();
    console.info('[POS Sync] stock accepted', { correlationId, syncId: payload.syncId, updated: updatedCount, duplicates: duplicateCount, discrepancies: reconciliation.length });
    res.json({ success: true, message: 'Stock updated successfully', updated_count: updatedCount, duplicate_count: duplicateCount, reconciliation });
  }));

  app.get('/api/pos/stock-changes', apiHandler(async (req, res) => {
    const since = parseIsoTimestamp(req.query.since, { optional: true });
    const cursor = decodeCursor(req.query.cursor, 'stock');
    const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(req.query.limit || '100', 10) || 100));
    const upperMs = cursor?.upperMs ?? Date.now();
    const afterMs = cursor?.afterMs ?? (since?.getTime() ?? 0);
    const afterId = cursor?.afterId ?? '';
    const snapshot = await getDb().collection('stockMovements').where('source', '==', 'website').get();
    const eligible = snapshot.docs.map(doc => ({ id: doc.id, movement: doc.data(), timeMs: timestampMillis(doc.data().createdAt) }))
      .filter(record => record.timeMs <= upperMs && compareTuple(record, { afterMs, afterId }))
      .sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id));
    const page = eligible.slice(0, limit);
    const hasMore = eligible.length > page.length;
    const last = page.at(-1);
    const nextCursor = hasMore && last ? encodeCursor({ v: 1, feed: 'stock', upperMs, afterMs: last.timeMs, afterId: last.id }) : null;
    const stockChanges = page.map(({ id, movement, timeMs }) => ({
      movement_id: movement.movementId || id,
      web_product_id: movement.webProductId,
      sku: movement.sku,
      size: movement.size,
      color: movement.color,
      current_website_stock: Number(movement.stockAfter),
      deducted_qty: movement.deltaChange < 0 ? Math.abs(movement.deltaChange) : 0,
      delta_change: Number(movement.deltaChange),
      reason: movement.reason,
      order_id: movement.orderId || movement.externalReference || null,
      created_at: new Date(timeMs).toISOString()
    }));
    res.json({ success: true, server_time: new Date(upperMs).toISOString(), stock_changes: stockChanges, has_more: hasMore, next_cursor: nextCursor });
  }));
}

export const posSyncInternals = {
  validateProductsPayload,
  validateStockPayload,
  parseIsoTimestamp,
  encodeCursor,
  decodeCursor,
  productToWire,
  timestampMillis,
  isValidPosToken,
  stockEventFingerprint,
  applyPosStockDelta,
  productIdentityHash,
  isWebsiteProductFeedEligible
};
