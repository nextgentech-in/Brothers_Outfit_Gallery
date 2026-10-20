import crypto from 'crypto';

const MAX_PRODUCT_BATCH = 25;
const MAX_STOCK_BATCH = 100;
const PAGE_SIZE_MAX = 100;
const MAX_IMAGES_PER_PRODUCT = 20;
const MAX_BASE64_IMAGE_BYTES = 512_000;
const MAX_IMAGE_URL_LENGTH = 2048;
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

function integer(value, field, { min = Number.MIN_SAFE_INTEGER, clampMin = false } = {}) {
  // Coerce strings and floats from MySQL/POS clients (e.g. "10", 10.0, "0", "-1")
  const str = typeof value === 'string' ? value.trim() : value;
  const parsed = typeof str === 'string' && str !== '' ? Number(str) : (typeof str === 'number' ? str : NaN);
  let coerced = Number.isFinite(parsed) ? Math.trunc(parsed) : parsed;
  if (!Number.isSafeInteger(coerced)) {
    throw new PosSyncError(422, `${field} must be an integer${min > Number.MIN_SAFE_INTEGER ? ` greater than or equal to ${min}` : ''}.`, 'validation_error');
  }
  if (clampMin && coerced < min) {
    coerced = min;
  } else if (coerced < min) {
    throw new PosSyncError(422, `${field} must be an integer${min > Number.MIN_SAFE_INTEGER ? ` greater than or equal to ${min}` : ''}.`, 'validation_error');
  }
  return coerced;
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

function validateImages(rawImages, prefix) {
  if (!rawImages || !Array.isArray(rawImages)) return [];
  if (rawImages.length > MAX_IMAGES_PER_PRODUCT) {
    throw new PosSyncError(422, `${prefix}.images must contain at most ${MAX_IMAGES_PER_PRODUCT} items.`, 'validation_error');
  }
  return rawImages.map((img, index) => {
    const ip = `${prefix}.images[${index}]`;
    const entry = typeof img === 'string' ? { url: img } : img;
    if (!entry || typeof entry !== 'object' || typeof entry.url !== 'string' || !entry.url.trim()) {
      throw new PosSyncError(422, `${ip}.url is required and must be a non-empty string.`, 'validation_error');
    }
    const url = entry.url.trim();
    const isBase64 = url.startsWith('data:image/');
    const isUrl = /^https?:\/\//i.test(url);
    if (!isBase64 && !isUrl) {
      throw new PosSyncError(422, `${ip}.url must be an https:// URL or a data:image/ base64 string.`, 'validation_error');
    }
    if (isBase64) {
      const commaIndex = url.indexOf(',');
      if (commaIndex < 0) throw new PosSyncError(422, `${ip}.url is not a valid base64 data URL.`, 'validation_error');
      const rawBase64 = url.slice(commaIndex + 1);
      const byteLength = Math.ceil(rawBase64.length * 3 / 4);
      if (byteLength > MAX_BASE64_IMAGE_BYTES) {
        throw new PosSyncError(422, `${ip}.url base64 image exceeds ${Math.round(MAX_BASE64_IMAGE_BYTES / 1024)}KB limit.`, 'validation_error');
      }
    } else if (url.length > MAX_IMAGE_URL_LENGTH) {
      throw new PosSyncError(422, `${ip}.url exceeds ${MAX_IMAGE_URL_LENGTH} character limit.`, 'validation_error');
    }
    const imageObj = {
      url,
      isPrimary: Boolean(entry.is_cover || entry.isPrimary)
    };
    const imgName = String(entry.name || '').trim().slice(0, 200);
    if (imgName) imageObj.name = imgName;
    const imgColor = String(entry.color || '').trim().slice(0, 80);
    if (imgColor) imageObj.color = imgColor;
    return imageObj;
  });
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
  const images = validateImages(raw?.images, prefix);
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
    images,
    variants
  };
}

function validateProductForUpdate(raw, productIndex) {
  const prefix = `products[${productIndex}]`;
  const webProductId = identifier(raw?.web_product_id, `${prefix}.web_product_id`);
  const name = canonicalText(raw?.product_name, `${prefix}.product_name`, { required: false, max: 200 });
  const category = canonicalText(raw?.category, `${prefix}.category`, { required: false, max: 100 });
  const subCategory = canonicalText(raw?.sub_category, `${prefix}.sub_category`, { required: false, max: 100 });
  const color = canonicalText(raw?.color, `${prefix}.color`, { required: false, max: 80 });
  const mrp = raw?.mrp != null ? money(raw.mrp, `${prefix}.mrp`) : undefined;
  const salePrice = raw?.sale_price != null ? money(raw.sale_price, `${prefix}.sale_price`) : undefined;
  if (mrp != null && salePrice != null && salePrice > mrp) {
    throw new PosSyncError(422, `${prefix}.sale_price cannot exceed mrp.`, 'validation_error');
  }
  const images = validateImages(raw?.images, prefix);
  const description = canonicalText(raw?.description, `${prefix}.description`, { required: false, max: 5000 });
  let variants = undefined;
  if (Array.isArray(raw?.sizes) && raw.sizes.length > 0) {
    if (raw.sizes.length > 50) {
      throw new PosSyncError(422, `${prefix}.sizes must contain at most 50 variants.`, 'validation_error');
    }
    variants = raw.sizes.map((variant, variantIndex) => {
      const vp = `${prefix}.sizes[${variantIndex}]`;
      return {
        size: canonicalText(variant?.size, `${vp}.size`, { required: false, max: 40 }),
        sku: canonicalText(variant?.sku, `${vp}.sku`, { max: 100 }),
        price: variant?.price != null ? money(variant.price, `${vp}.price`) : undefined
      };
    });
  }
  return { webProductId, name, category, subCategory, color, mrp, salePrice, description, images, variants };
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
    const productSkus = new Set([product.sku, ...product.variants.map(v => v.sku)].filter(Boolean));
    for (const sku of productSkus) {
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
  const syncId = body?.sync_id ? identifier(body.sync_id, 'sync_id') : `SYNC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const syncTimestamp = parseIsoTimestamp(body?.sync_timestamp, { optional: true, field: 'sync_timestamp' }) || new Date();
  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > MAX_STOCK_BATCH) {
    throw new PosSyncError(422, `items must contain between 1 and ${MAX_STOCK_BATCH} items.`, 'validation_error');
  }
  const eventIds = new Set();
  const items = body.items.map((raw, index) => {
    const prefix = `items[${index}]`;
    const eventId = raw?.event_id ? identifier(raw.event_id, `${prefix}.event_id`) : `EVT-${Date.now()}-${index}-${crypto.randomBytes(3).toString('hex')}`;
    const webProductId = String(raw?.web_product_id || raw?.productId || raw?.product_id || raw?.id || raw?.sku || '').trim();
    const sku = canonicalText(raw?.sku || raw?.variant_sku || webProductId, `${prefix}.sku`, { max: 100 });
    const size = canonicalText(raw?.size || '', `${prefix}.size`, { required: false, max: 40 });
    const color = canonicalText(raw?.color || '', `${prefix}.color`, { required: false, max: 80 });
    let deltaChange = raw?.delta_change != null && raw?.delta_change !== '' ? integer(raw.delta_change, `${prefix}.delta_change`) : null;
    let finalStock = raw?.final_stock != null && raw?.final_stock !== ''
      ? integer(raw.final_stock, `${prefix}.final_stock`, { min: 0, clampMin: true })
      : (raw?.stock != null && raw?.stock !== '' ? integer(raw.stock, `${prefix}.stock`, { min: 0, clampMin: true }) : null);

    if (deltaChange == null && finalStock == null) {
      throw new PosSyncError(422, `${prefix} must provide either delta_change or final_stock/stock.`, 'validation_error');
    }

    if (eventIds.has(eventId)) throw new PosSyncError(422, `Duplicate event_id in batch: ${eventId}`, 'validation_error');
    eventIds.add(eventId);
    return {
      eventId,
      webProductId: webProductId || sku,
      sku,
      size,
      color,
      deltaChange,
      finalStock
    };
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

function extractImageUrls(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  return images.map(img => {
    if (typeof img === 'string') return img;
    if (typeof img === 'object' && img !== null && typeof img.url === 'string') return img.url;
    return null;
  }).filter(Boolean);
}

function productToWire(id, product) {
  const imageUrls = extractImageUrls(product);
  const coverImage = imageUrls[0] || product.thumbnailUrl || product.image || null;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const calculatedStock = variants.length > 0
    ? variants.reduce((sum, v) => sum + Number(v.stock ?? v.quantity ?? 0), 0)
    : Number(product.stock ?? product.quantity ?? 0);

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
    stock: calculatedStock,
    quantity: calculatedStock,
    opening_stock: calculatedStock,
    images: imageUrls,
    image_url: coverImage,
    sizes: variants.map(variant => ({
      size: variant.size || 'One Size',
      color: variant.color || product.primaryColor || product.colors?.[0]?.name || product.colors?.[0] || 'Standard',
      stock: Number(variant.stock ?? variant.quantity ?? 0),
      quantity: Number(variant.stock ?? variant.quantity ?? 0),
      opening_stock: Number(variant.stock ?? variant.quantity ?? 0),
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
    skus: [...new Set([product.sku, ...product.variants.map(variant => variant.sku)].filter(Boolean))].map(normalizeKey).sort()
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
  const variants = Array.isArray(product.variants) ? product.variants.map(variant => ({ ...variant })) : [];

  // Verify product association:
  // If item.webProductId is supplied, it can be the product's webProductId, productId, parent SKU,
  // or one of the variant SKUs belonging to this product.
  const normItemWebId = normalizeKey(item.webProductId);
  const normProdWebId = normalizeKey(product.webProductId);
  const normProdId = normalizeKey(productId);
  const normProdSku = normalizeKey(product.sku);
  const normItemSku = normalizeKey(item.sku);

  const isAssociated = !normItemWebId ||
    normItemWebId === normProdWebId ||
    normItemWebId === normProdId ||
    normItemWebId === normProdSku ||
    variants.some(v => normalizeKey(v.sku) === normItemWebId || normalizeKey(v.sku) === normItemSku);

  if (!isAssociated) {
    throw new PosSyncError(409, `web_product_id ${item.webProductId} does not match the resolved product.`, 'identity_conflict');
  }

  // Find matching variant
  let variantIndex = variants.findIndex(v => normalizeKey(v.sku) === normItemSku);
  if (variantIndex < 0 && normItemWebId) {
    variantIndex = variants.findIndex(v => normalizeKey(v.sku) === normItemWebId);
  }
  // Only fall back to size if item.sku matches the parent product SKU, webProductId, or is empty
  if (variantIndex < 0 && (normItemSku === normProdSku || normItemSku === normProdWebId || !normItemSku)) {
    if (item.size) {
      const normSize = normalizeKey(item.size);
      variantIndex = variants.findIndex(v => normalizeKey(v.size) === normSize);
    }
    if (variantIndex < 0 && variants.length === 1) {
      variantIndex = 0;
    }
  }
  if (variantIndex < 0) {
    throw new PosSyncError(409, `Unknown variant SKU ${item.sku}.`, 'unknown_variant');
  }

  const variant = variants[variantIndex];
  const varSize = normalizeKey(variant.size);
  const itemSize = normalizeKey(item.size);
  const sizeMatches = !varSize || !itemSize || varSize === itemSize;

  const varColor = normalizeKey(variant.color || product.primaryColor || '');
  const itemColor = normalizeKey(item.color || '');
  const isDefaultColor = (c) => !c || c === 'standard' || c === 'default' || c === 'all colors';
  const colorMatches = isDefaultColor(varColor) || isDefaultColor(itemColor) || varColor === itemColor;

  if (!sizeMatches || !colorMatches) {
    throw new PosSyncError(409, `SKU ${item.sku} does not match the supplied size/color.`, 'variant_mismatch');
  }

  const before = Number(variant.stock ?? variant.quantity ?? 0);

  // Compute delta and final stock flexibly
  let delta = item.deltaChange;
  let targetFinal = item.finalStock;

  if (delta == null && targetFinal != null) {
    delta = targetFinal - before;
  } else if (targetFinal == null && delta != null) {
    targetFinal = before + delta;
  }
  if (delta == null) {
    delta = 0;
  }
  if (targetFinal == null) {
    targetFinal = before + delta;
  }

  const after = before + delta;
  if (!Number.isSafeInteger(before) || after < 0) {
    throw new PosSyncError(409, `Stock event ${item.eventId} would make ${item.sku} negative. Manual reconciliation is required.`, 'insufficient_stock');
  }

  variants[variantIndex] = { ...variant, stock: after, quantity: after };
  const totalStock = variants.reduce((sum, candidate) => sum + Number(candidate.stock ?? candidate.quantity ?? 0), 0);
  return {
    stockAfter: after,
    discrepancy: targetFinal - after,
    deltaChange: delta,
    finalStock: targetFinal,
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
      const safeMessage = status === 500 ? (error.message ? `POS synchronization error: ${error.message}` : 'Unexpected POS synchronization failure.') : error.message;
      console.error('[POS Sync]', { correlationId, endpoint: req.path, status, code: error.code || 'unexpected_error', message: error.message, stack: error.stack });
      res.status(status).json({ success: false, error: safeMessage, code: error.code || 'unexpected_error', correlation_id: correlationId, ...(error.details ? { details: error.details } : {}) });
    }
  };
}

async function findProductRef(db, webProductId, itemSku = '') {
  const normId = normalizeKey(webProductId);
  const normSku = normalizeKey(itemSku);

  // 1. Direct posProductMappings doc
  if (normId) {
    const mappingRef = db.collection('posProductMappings').doc(stableHash(normId));
    const mapping = await mappingRef.get();
    if (mapping.exists) return db.collection('products').doc(mapping.data().productId);

    // 2. Direct products doc by ID
    const direct = db.collection('products').doc(webProductId);
    const directSnap = await direct.get();
    if (directSnap.exists && (directSnap.data().webProductId || directSnap.id) === webProductId) return direct;

    // 3. Query products by webProductId field
    const match = await db.collection('products').where('webProductId', '==', webProductId).limit(2).get();
    if (match.size === 1) return match.docs[0].ref;
    if (match.size > 1) throw new PosSyncError(409, `Multiple website products map to ${webProductId}.`, 'identity_conflict');
  }

  // 4. Query productSkuMappings by SKU or webProductId
  for (const candidate of [normSku, normId].filter(Boolean)) {
    const skuRef = db.collection('productSkuMappings').doc(stableHash(candidate));
    const skuSnap = await skuRef.get();
    if (skuSnap.exists && skuSnap.data().productId) {
      return db.collection('products').doc(skuSnap.data().productId);
    }
  }

  // 5. Query products by parent sku field
  for (const candidate of [webProductId, itemSku].filter(Boolean)) {
    const skuMatch = await db.collection('products').where('sku', '==', candidate).limit(2).get();
    if (skuMatch.size >= 1) return skuMatch.docs[0].ref;
  }

  // 6. Deep scan catalog as fallback (for products with un-indexed variant SKUs or item codes)
  const allProds = await db.collection('products').get();
  for (const doc of allProds.docs) {
    const data = doc.data();
    if (normId && normalizeKey(data.webProductId) === normId) return doc.ref;
    if (normId && normalizeKey(data.sku) === normId) return doc.ref;
    if (normSku && normalizeKey(data.sku) === normSku) return doc.ref;
    if (Array.isArray(data.variants)) {
      const hasVariant = data.variants.some(v => {
        const vSku = normalizeKey(v.sku);
        return (normSku && vSku === normSku) || (normId && vSku === normId);
      });
      if (hasVariant) return doc.ref;
    }
  }

  return null;
}

export async function uploadBase64ToImageKit(base64Data, filenamePrefix = 'pos') {
  if (!base64Data || typeof base64Data !== 'string' || !base64Data.startsWith('data:image/')) return null;
  const privateKey = (process.env.IMAGEKIT_PRIVATE_KEY || '').trim();
  if (!privateKey) return null;
  try {
    const formData = new FormData();
    formData.append('file', base64Data);
    formData.append('fileName', `${filenamePrefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`);
    formData.append('folder', '/products');

    const authHeader = 'Basic ' + Buffer.from(privateKey + ':').toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: { Authorization: authHeader },
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn('[POS Sync] ImageKit upload returned', res.status);
      return null;
    }
    const data = await res.json();
    return data.url || null;
  } catch (err) {
    console.warn('[POS Sync] ImageKit upload failed:', err.message);
    return null;
  }
}

async function sanitizeProductBase64Images(images, prefix) {
  if (!Array.isArray(images)) return;
  for (const img of images) {
    if (img && typeof img.url === 'string' && img.url.startsWith('data:image/')) {
      const uploadedUrl = await uploadBase64ToImageKit(img.url, prefix);
      if (uploadedUrl) {
        img.url = uploadedUrl;
      } else if (img.url.length > 50_000) {
        // Fallback for oversized base64 to avoid Firestore 1MB document limit
        img.url = '/images/hero.png';
      }
    }
  }
}

export function registerPosSyncRoutes(app, { getDb, FieldValue, invalidateProductCache = () => {} }) {
  app.use('/api/pos', requirePosToken, posRateLimit);

  app.post('/api/pos/products', apiHandler(async (req, res, correlationId) => {
    const products = validateProductsPayload(req.body);
    for (const product of products) {
      await sanitizeProductBase64Images(product.images, product.slug || 'pos');
    }
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
        if (!legacySkuOwners.has(key)) {
          legacySkuOwners.set(key, doc.id);
        } else if (legacySkuOwners.get(key) !== doc.id) {
          legacySkuOwners.set(key, '__MULTIPLE_LEGACY__');
        }
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
        const allSkus = [...new Set([product.sku, ...product.variants.map(v => v.sku)].filter(Boolean))];
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
          continue;
        }
        if (productSnap.exists) throw new PosSyncError(409, `Generated product mapping for ${product.webProductId} is already occupied.`, 'identity_conflict');
        if (slugSnap.exists && slugSnap.data().productId !== productId) throw new PosSyncError(409, `Slug ${product.resolvedSlug} was concurrently reserved by another product. Retry the batch to avoid collisions.`, 'slug_conflict');
        for (let index = 0; index < skuSnaps.length; index += 1) {
          const normalizedSku = normalizeKey(allSkus[index]);
          const legacyOwner = legacySkuOwners.get(normalizedSku);
          if (legacyOwner && legacyOwner !== productId && legacyOwner !== '__MULTIPLE_LEGACY__') throw new PosSyncError(409, `SKU ${allSkus[index]} is already assigned to another product.`, 'sku_conflict');
          if (skuSnaps[index].exists && skuSnaps[index].data().productId !== productId) {
            throw new PosSyncError(409, `SKU ${allSkus[index]} is already assigned to another product.`, 'sku_conflict');
          }
        }

        const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
        const availableSizes = [...new Set(product.variants.filter(v => v.stock > 0).map(v => v.size))];
        const coverImg = product.images.find(img => img.isPrimary) || product.images[0];
        const coverUrl = coverImg?.url || '/images/hero.png';
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
          images: product.images,
          image: coverUrl,
          thumbnailUrl: coverUrl,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          integrationCreatedAt: FieldValue.serverTimestamp()
        });
        transaction.create(mappingRef, { webProductId: product.webProductId, productId, origin: 'pos', identityHash: immutableIdentity, createdAt: FieldValue.serverTimestamp() });
        transaction.set(slugRef, { normalizedSlug: normalizeKey(product.resolvedSlug), slug: product.resolvedSlug, productId, webProductId: product.webProductId, createdAt: FieldValue.serverTimestamp() });
        skuRefs.forEach((ref, index) => transaction.create(ref, { normalizedSku: normalizeKey(allSkus[index]), sku: allSkus[index], productId, webProductId: product.webProductId, createdAt: FieldValue.serverTimestamp() }));
        const taxonomyRef = db.collection('posTaxonomy').doc(stableHash(`${normalizeKey(product.category)}|${normalizeKey(product.subCategory)}`));
        transaction.set(taxonomyRef, { category: product.category, categoryKey: normalizeKey(product.category), subCategory: product.subCategory, subCategoryKey: normalizeKey(product.subCategory), createdAt: FieldValue.serverTimestamp() });
        localCreatedCount += 1;
      }
      return localCreatedCount;
    });

    invalidateProductCache();
    console.info('[POS Sync] products accepted', { correlationId, received: products.length, created: createdCount, duplicates: products.length - createdCount });
    res.json({ success: true, message: 'Products published successfully', created_count: createdCount });
  }));

  app.put('/api/pos/products', apiHandler(async (req, res, correlationId) => {
    if (!req.body || !Array.isArray(req.body.products) || req.body.products.length < 1 || req.body.products.length > MAX_PRODUCT_BATCH) {
      throw new PosSyncError(422, `products must contain between 1 and ${MAX_PRODUCT_BATCH} items.`, 'validation_error');
    }
    const updates = req.body.products.map(validateProductForUpdate);
    for (const update of updates) {
      await sanitizeProductBase64Images(update.images, `update-${update.webProductId || 'pos'}`);
    }
    const db = getDb();
    let updatedCount = 0;

    for (const update of updates) {
      const productRef = await findProductRef(db, update.webProductId);
      if (!productRef) throw new PosSyncError(409, `Unknown web_product_id ${update.webProductId}.`, 'unknown_product');

      await db.runTransaction(async transaction => {
        const snap = await transaction.get(productRef);
        if (!snap.exists) throw new PosSyncError(409, `Product ${update.webProductId} no longer exists.`, 'unknown_product');
        const existing = snap.data();
        const patch = {};
        if (update.name) { patch.name = update.name; }
        if (update.category) { patch.category = update.category; patch.categoryId = update.category; patch.categoryKey = normalizeKey(update.category); }
        if (update.subCategory) { patch.subCategory = update.subCategory; patch.subCategoryKey = normalizeKey(update.subCategory); }
        if (update.color) { patch.primaryColor = update.color; patch.colors = [{ name: update.color }]; }
        if (update.mrp != null) { patch.mrp = update.mrp; patch.compareAtPrice = update.mrp; }
        if (update.salePrice != null) { patch.salePrice = update.salePrice; patch.price = update.salePrice; }
        if (update.description) { patch.description = update.description; patch.shortDescription = update.description.slice(0, 240); }
        if (update.images.length > 0) {
          patch.images = update.images;
          const cover = update.images.find(img => img.isPrimary) || update.images[0];
          patch.image = cover?.url || existing.image;
          patch.thumbnailUrl = cover?.url || existing.thumbnailUrl;
        }
        if (update.variants) {
          const existingVariants = Array.isArray(existing.variants) ? existing.variants : [];
          const updatedVariants = existingVariants.map(ev => {
            const match = update.variants.find(uv => normalizeKey(uv.sku) === normalizeKey(ev.sku));
            if (!match) return ev;
            const patched = { ...ev };
            if (match.price != null) { patched.price = match.price; patched.salePrice = match.price; }
            if (match.size) patched.size = match.size;
            return patched;
          });
          patch.variants = updatedVariants;
        }
        if (patch.mrp != null && patch.salePrice == null && existing.salePrice > patch.mrp) {
          throw new PosSyncError(422, `Updated mrp would be below existing sale_price for ${update.webProductId}.`, 'validation_error');
        }
        patch.updatedAt = FieldValue.serverTimestamp();
        transaction.update(productRef, patch);
      });
      updatedCount += 1;
    }

    invalidateProductCache();
    console.info('[POS Sync] products updated', { correlationId, received: updates.length, updated: updatedCount });
    res.json({ success: true, message: 'Products updated successfully', updated_count: updatedCount });
  }));

  app.delete('/api/pos/products', apiHandler(async (req, res, correlationId) => {
    const rawIds = Array.isArray(req.body?.web_product_ids)
      ? req.body.web_product_ids
      : (req.body?.web_product_id ? [req.body.web_product_id] : (req.query?.id ? [req.query.id] : []));

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      throw new PosSyncError(422, 'web_product_ids must be a non-empty array of product IDs.', 'validation_error');
    }

    const db = getDb();
    let deletedCount = 0;
    for (const rawId of rawIds) {
      const productRef = await findProductRef(db, String(rawId).trim());
      if (productRef) {
        await productRef.update({
          active: false,
          isDeleted: true,
          deletedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        deletedCount += 1;
      }
    }
    invalidateProductCache();
    console.info('[POS Sync] products deleted', { correlationId, requested: rawIds.length, deleted: deletedCount });
    res.json({ success: true, message: 'Products deactivated/deleted successfully', deleted_count: deletedCount });
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
      const createdMs = timestampMillis(product.integrationCreatedAt || product.createdAt);
      const updatedMs = timestampMillis(product.updatedAt);
      return { id: doc.id, product, timeMs: Math.max(createdMs, updatedMs) };
    }).filter(record => isWebsiteProductFeedEligible(record.product) && record.timeMs <= upperMs && compareTuple(record, { afterMs, afterId }))
      .sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id));

    const deletedProductIds = snapshot.docs.map(doc => {
      const product = doc.data();
      const updatedMs = timestampMillis(product.updatedAt || product.deletedAt);
      const isDel = product.isDeleted === true || product.active === false;
      return { webProductId: product.webProductId || doc.id, isDel, timeMs: updatedMs };
    }).filter(record => record.isDel && record.timeMs > afterMs && record.timeMs <= upperMs)
      .map(record => record.webProductId);

    const page = eligible.slice(0, limit);
    const hasMore = eligible.length > page.length;
    const last = page.at(-1);
    const nextCursor = hasMore && last ? encodeCursor({ v: 1, feed: 'products', upperMs, afterMs: last.timeMs, afterId: last.id }) : null;
    res.json({
      success: true,
      server_time: new Date(upperMs).toISOString(),
      new_products: page.map(record => productToWire(record.id, record.product)),
      deleted_product_ids: deletedProductIds,
      has_more: hasMore,
      next_cursor: nextCursor
    });
  }));

  const handleStockSyncPost = apiHandler(async (req, res, correlationId) => {
    const payload = validateStockPayload(req.body);
    const db = getDb();
    const resolved = [];
    for (const item of payload.items) {
      const productRef = await findProductRef(db, item.webProductId, item.sku);
      if (!productRef) throw new PosSyncError(409, `Unknown web_product_id ${item.webProductId}.`, 'unknown_product');
      resolved.push({
        item,
        productRef,
        eventRef: db.collection('posStockEvents').doc(stableHash(item.eventId)),
        movementRef: db.collection('stockMovements').doc(`pos_${stableHash(item.eventId)}`)
      });
    }

    const { updatedCount, duplicateCount, reconciliation, stockLevels } = await db.runTransaction(async transaction => {
      let localUpdatedCount = 0;
      let localDuplicateCount = 0;
      const localReconciliation = [];
      const localStockLevels = [];
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
        const fingerprint = stockEventFingerprint(item);
        const existingEvent = eventSnaps[index];
        if (existingEvent.exists) {
          if (existingEvent.data().fingerprint !== fingerprint) throw new PosSyncError(409, `event_id ${item.eventId} was already used with different data.`, 'inconsistent_replay');
          localDuplicateCount += 1;
          // Still report current stock for duplicates so POS can re-confirm
          const working = workingProducts.get(entry.productRef.path);
          if (working?.snap.exists) {
            const variants = Array.isArray(working.data.variants) ? working.data.variants : [];
            const matchedVariant = variants.find(v => normalizeKey(v.sku) === normalizeKey(item.sku));
            localStockLevels.push({
              event_id: item.eventId,
              sku: item.sku,
              web_product_id: item.webProductId,
              website_stock: Number(matchedVariant?.stock ?? matchedVariant?.quantity ?? working.data.stock ?? 0),
              total_product_stock: Number(working.data.stock ?? 0),
              is_duplicate: true
            });
          }
          continue;
        }
        const working = workingProducts.get(entry.productRef.path);
        if (!working?.snap.exists) throw new PosSyncError(409, `Product ${item.webProductId} no longer exists.`, 'unknown_product');
        const { updatedProduct, stockAfter: after, discrepancy, deltaChange: effectiveDelta, finalStock: effectiveFinal } = applyPosStockDelta(working.data, working.snap.id, item);
        working.data = updatedProduct;
        transaction.create(entry.eventRef, { eventId: item.eventId, syncId: payload.syncId, fingerprint, webProductId: item.webProductId, sku: item.sku, deltaChange: effectiveDelta, finalStock: effectiveFinal, websiteStockAfter: after, discrepancy, syncTimestamp: payload.syncTimestamp, acceptedAt: FieldValue.serverTimestamp() });
        transaction.create(entry.movementRef, { movementId: entry.movementRef.id, productId: working.snap.id, webProductId: item.webProductId, sku: item.sku, size: item.size, color: item.color, deltaChange: effectiveDelta, source: 'pos', reason: effectiveDelta < 0 ? 'offline_sale' : 'pos_stock_inward', externalReference: item.eventId, syncId: payload.syncId, stockAfter: after, createdAt: FieldValue.serverTimestamp() });
        if (discrepancy !== 0) {
          const discrepancyRef = db.collection('posReconciliationDiscrepancies').doc(stableHash(item.eventId));
          transaction.set(discrepancyRef, { eventId: item.eventId, syncId: payload.syncId, webProductId: item.webProductId, sku: item.sku, posFinalStock: effectiveFinal, websiteStockAfterDelta: after, discrepancy, status: 'open', createdAt: FieldValue.serverTimestamp() });
          localReconciliation.push({ event_id: item.eventId, sku: item.sku, pos_final_stock: effectiveFinal, website_stock_after_delta: after, discrepancy });
        }
        // Compute total product stock from the mutated working copy
        const totalStockAfter = (Array.isArray(updatedProduct.variants) ? updatedProduct.variants : [])
          .reduce((sum, v) => sum + Number(v.stock ?? v.quantity ?? 0), 0);
        localStockLevels.push({
          event_id: item.eventId,
          sku: item.sku,
          web_product_id: item.webProductId,
          website_stock: after,
          total_product_stock: totalStockAfter,
          is_duplicate: false
        });
        localUpdatedCount += 1;
      }
      for (const entry of resolved) {
        const working = workingProducts.get(entry.productRef.path);
        if (working) transaction.update(entry.productRef, { ...working.data, updatedAt: FieldValue.serverTimestamp() });
      }
      return { updatedCount: localUpdatedCount, duplicateCount: localDuplicateCount, reconciliation: localReconciliation, stockLevels: localStockLevels };
    });

    invalidateProductCache();
    console.info('[POS Sync] stock accepted', { correlationId, syncId: payload.syncId, updated: updatedCount, duplicates: duplicateCount, discrepancies: reconciliation.length });
    res.json({ success: true, message: 'Stock updated successfully', updated_count: updatedCount, duplicate_count: duplicateCount, reconciliation, stock_levels: stockLevels });
  });

  app.post('/api/pos/stock-sync', handleStockSyncPost);
  app.post('/api/pos/stock-changes', handleStockSyncPost);

  // ── GET /api/pos/stock-snapshot ──────────────────────────────────────────────
  // Returns the current live Firestore stock for every POS-linked product.
  // POS can call this after any sync to confirm the authoritative website stock
  // and detect any divergence from its local SQLite records.
  app.get('/api/pos/stock-snapshot', apiHandler(async (req, res) => {
    const db = getDb();
    const targetSku = req.query.sku || req.query.variant_sku || '';
    const targetWebId = req.query.web_product_id || req.query.product_id || '';

    // Single-product lookup
    if (targetSku || targetWebId) {
      const productRef = await findProductRef(db, targetWebId, targetSku);
      if (!productRef) {
        return res.status(404).json({ success: false, error: 'Product not found', code: 'not_found' });
      }
      const snap = await productRef.get();
      if (!snap.exists) {
        return res.status(404).json({ success: false, error: 'Product not found', code: 'not_found' });
      }
      const p = snap.data();
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const matched = targetSku
        ? (variants.find(v => normalizeKey(v.sku) === normalizeKey(targetSku)) || variants[0])
        : variants[0];
      return res.json({
        success: true,
        server_time: new Date().toISOString(),
        web_product_id: p.webProductId || snap.id,
        product_name: p.name || '',
        sku: matched?.sku || p.sku || '',
        size: matched?.size || null,
        color: matched?.color || p.primaryColor || 'Standard',
        variant_stock: Number(matched?.stock ?? matched?.quantity ?? p.stock ?? 0),
        total_product_stock: Number(p.stock ?? p.quantity ?? 0),
        in_stock: Boolean(p.inStock ?? ((p.stock ?? 0) > 0)),
        updated_at: p.updatedAt?.toDate ? p.updatedAt.toDate().toISOString() : null,
        all_variants: variants.map(v => ({
          sku: v.sku || '',
          size: v.size || '',
          color: v.color || p.primaryColor || 'Standard',
          stock: Number(v.stock ?? v.quantity ?? 0)
        }))
      });
    }

    // Full catalog snapshot — all POS-originated products
    const posProductsSnap = await db.collection('products')
      .where('integrationOrigin', '==', 'pos')
      .get();

    const serverTime = new Date();
    const snapshot = posProductsSnap.docs.map(doc => {
      const p = doc.data();
      const variants = Array.isArray(p.variants) ? p.variants : [];
      return {
        web_product_id: p.webProductId || doc.id,
        product_name: p.name || '',
        sku: p.sku || '',
        category: p.category || '',
        total_product_stock: Number(p.stock ?? p.quantity ?? 0),
        in_stock: Boolean(p.inStock ?? ((p.stock ?? 0) > 0)),
        updated_at: p.updatedAt?.toDate ? p.updatedAt.toDate().toISOString() : null,
        variants: variants.map(v => ({
          sku: v.sku || '',
          size: v.size || '',
          color: v.color || p.primaryColor || 'Standard',
          stock: Number(v.stock ?? v.quantity ?? 0)
        }))
      };
    });

    res.json({
      success: true,
      server_time: serverTime.toISOString(),
      total_products: snapshot.length,
      products: snapshot
    });
  }));

  // ── GET /api/pos/stock-changes ───────────────────────────────────────────────
  // Returns website-initiated stock movements (online orders, admin adjustments)
  // that the POS should apply to its local database.
  // Supports:
  //   ?since=<ISO timestamp>  — only movements after this time
  //   ?cursor=<opaque>        — continuation cursor for paginated polling
  //   ?sku=<sku>              — single-variant live stock lookup
  //   ?web_product_id=<id>   — single-product live stock lookup
  //   ?mark_consumed=true     — mark returned movement IDs as POS-consumed
  const handleStockChangesGet = apiHandler(async (req, res) => {
    const db = getDb();
    const targetSku = req.query.sku || req.query.variant_sku;
    const targetWebId = req.query.web_product_id || req.query.product_id;
    if (targetSku || targetWebId) {
      const productRef = await findProductRef(db, targetWebId, targetSku);
      if (!productRef) {
        return res.status(404).json({ success: false, error: 'Product not found', code: 'not_found' });
      }
      const snap = await productRef.get();
      if (!snap.exists) {
        return res.status(404).json({ success: false, error: 'Product not found', code: 'not_found' });
      }
      const p = snap.data();
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const matched = variants.find(v => normalizeKey(v.sku) === normalizeKey(targetSku)) || variants[0];
      return res.json({
        success: true,
        server_time: new Date().toISOString(),
        web_product_id: p.webProductId || snap.id,
        sku: matched?.sku || p.sku,
        size: matched?.size || null,
        stock: Number(matched?.stock ?? p.stock ?? 0),
        total_product_stock: Number(p.stock ?? 0),
        in_stock: Boolean(p.inStock ?? (p.stock > 0))
      });
    }

    const since = parseIsoTimestamp(req.query.since, { optional: true });
    const cursor = decodeCursor(req.query.cursor, 'stock');
    const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(req.query.limit || '100', 10) || 100));
    const markConsumed = String(req.query.mark_consumed || '').toLowerCase() === 'true';
    const upperMs = cursor?.upperMs ?? Date.now();
    const afterMs = cursor?.afterMs ?? (since?.getTime() ?? 0);
    const afterId = cursor?.afterId ?? '';

    // Fetch website-source movements and already-consumed movement IDs in parallel
    const [movementsSnap, consumedSnap] = await Promise.all([
      db.collection('stockMovements').where('source', '==', 'website').get(),
      db.collection('posConsumedMovements').get()
    ]);
    const consumedIds = new Set(consumedSnap.docs.map(d => d.id));

    const eligible = movementsSnap.docs
      .map(doc => ({ id: doc.id, movement: doc.data(), timeMs: timestampMillis(doc.data().createdAt) }))
      .filter(record =>
        !consumedIds.has(record.id) &&
        record.timeMs <= upperMs &&
        compareTuple(record, { afterMs, afterId })
      )
      .sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id));

    const page = eligible.slice(0, limit);
    const hasMore = eligible.length > page.length;
    const last = page.at(-1);
    const nextCursor = hasMore && last
      ? encodeCursor({ v: 1, feed: 'stock', upperMs, afterMs: last.timeMs, afterId: last.id })
      : null;

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

    // If mark_consumed=true, write consumed markers so POS won't re-process them
    if (markConsumed && page.length > 0) {
      const batch = db.batch();
      for (const { id, movement, timeMs } of page) {
        const ref = db.collection('posConsumedMovements').doc(id);
        batch.set(ref, {
          movementId: movement.movementId || id,
          webProductId: movement.webProductId,
          sku: movement.sku,
          consumedAt: FieldValue.serverTimestamp(),
          movementCreatedAt: new Date(timeMs).toISOString()
        });
      }
      try {
        await batch.commit();
      } catch (err) {
        // Non-fatal: POS will re-consume next time with the same checkpoint
        console.warn('[POS Sync] Failed to mark movements as consumed:', err.message);
      }
    }

    res.json({
      success: true,
      server_time: new Date(upperMs).toISOString(),
      stock_changes: stockChanges,
      has_more: hasMore,
      next_cursor: nextCursor
    });
  });

  app.get('/api/pos/stock-changes', handleStockChangesGet);
  app.get('/api/pos/stock-sync', handleStockChangesGet);
}

export const posSyncInternals = {
  validateProductsPayload,
  validateProductForUpdate,
  validateImages,
  validateStockPayload,
  parseIsoTimestamp,
  encodeCursor,
  decodeCursor,
  productToWire,
  extractImageUrls,
  timestampMillis,
  isValidPosToken,
  stockEventFingerprint,
  applyPosStockDelta,
  productIdentityHash,
  isWebsiteProductFeedEligible,
  uploadBase64ToImageKit,
  sanitizeProductBase64Images
};
