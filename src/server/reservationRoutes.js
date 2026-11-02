import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { applyStockAction, canonicalLines, linesFingerprint, reservationIdFor } from './stockReservation.js';

const HOLD_MS = 20 * 60_000;
const checkoutPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const enabled = () => process.env.ERP_RESERVATIONS_ENABLED === 'enabled';
const statusError = (status, message) => Object.assign(new Error(message), { status });

export async function releaseReservation(db, reservationId, userId = null) {
  const ref = db.collection('erp_reservations').doc(reservationId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { released: false };
    const hold = snap.data();
    if (userId && hold.userId !== userId) throw statusError(403, 'Reservation belongs to another customer.');
    if (hold.state !== 'active') return { released: false, state: hold.state };
    const refs = [...new Set(hold.lines.map(line => line.productId))].sort().map(id => db.collection('products').doc(id));
    const snapshots = await Promise.all(refs.map(productRef => tx.get(productRef)));
    const working = new Map();
    snapshots.forEach((product, index) => {
      if (!product.exists) throw statusError(409, 'Reserved product is missing; manual review required.');
      working.set(refs[index].id, product.data());
    });
    for (const line of hold.lines) {
      const changed = applyStockAction(working.get(line.productId), line, 'release');
      working.set(line.productId, changed.product);
    }
    for (const productRef of refs) tx.update(productRef, { ...working.get(productRef.id), updatedAt: FieldValue.serverTimestamp() });
    tx.update(ref, { state: 'released', releasedAt: FieldValue.serverTimestamp() });
    tx.create(db.collection('erp_reservationEvents').doc(`${reservationId}_release`), {
      reservationId, event: 'release', source: userId ? 'customer' : 'expiry_worker', createdAt: FieldValue.serverTimestamp()
    });
    return { released: true, state: 'released' };
  });
}

export function registerReservationRoutes(app, { getDb, requireAuth, calculateTotal, rateLimit }) {
  app.get('/api/checkout/reservations/capability', (_req, res) => res.json({ enabled: enabled(), holdMinutes: 20 }));
  let lastSweepAt = 0;
  const sweep = async () => {
    if (Date.now() - lastSweepAt < 10_000) return { inspected: 0, released: 0, throttled: true };
    lastSweepAt = Date.now();
    const db = getDb();
    const docs = await db.collection('erp_reservations').where('state', '==', 'active')
      .where('expiresAt', '<=', new Date()).limit(100).get();
    const results = await Promise.allSettled(docs.docs.map(doc => releaseReservation(db, doc.id)));
    return { inspected: docs.size, released: results.filter(result => result.status === 'fulfilled' && result.value.released).length,
      failed: results.filter(result => result.status === 'rejected').length };
  };
  app.get('/api/checkout/reservations/sweep', async (req, res) => {
    if (!enabled()) return res.json({ enabled: false });
    if (rateLimit && !rateLimit(req, res, 30)) return;
    try { res.json(await sweep()); } catch { res.status(503).json({ error: 'Expiry sweep unavailable.' }); }
  });

  app.post('/api/checkout/reservations', requireAuth, async (req, res) => {
    if (!enabled()) return res.status(423).json({ error: 'Checkout reservations are not enabled.' });
    if (rateLimit && !rateLimit(req, res, 15)) return;
    try {
      await sweep();
      const checkoutId = String(req.body?.checkout_id || '').trim();
      if (!checkoutPattern.test(checkoutId)) return res.status(422).json({ error: 'A stable checkout ID is required.' });
      const calculation = await calculateTotal(req.body?.items, req.body?.couponCode);
      const lines = canonicalLines(calculation.items);
      const fingerprint = linesFingerprint(calculation.items);
      const db = getDb();
      const reservationId = reservationIdFor(req.user.uid, checkoutId);
      const ref = db.collection('erp_reservations').doc(reservationId);
      const result = await db.runTransaction(async tx => {
        const prior = await tx.get(ref);
        if (prior.exists) {
          const hold = prior.data();
          if (hold.userId !== req.user.uid || hold.fingerprint !== fingerprint) throw statusError(409, 'Cart changed; start a new checkout.');
          if (hold.state !== 'active' || hold.expiresAt.toMillis() <= Date.now()) throw statusError(409, 'Reservation expired; start a new checkout.');
          return { reservationId, expiresAt: hold.expiresAt.toDate().toISOString(), duplicate: true };
        }
        const refs = [...new Set(lines.map(line => line.productId))].sort().map(id => db.collection('products').doc(id));
        const snapshots = await Promise.all(refs.map(productRef => tx.get(productRef)));
        const working = new Map();
        snapshots.forEach((product, index) => {
          if (!product.exists || product.data().active === false) throw statusError(409, 'Product is unavailable.');
          working.set(refs[index].id, product.data());
        });
        const heldLines = [];
        for (const line of lines) {
          try {
            const changed = applyStockAction(working.get(line.productId), line, 'reserve');
            working.set(line.productId, changed.product);
            heldLines.push({ ...line, sku: changed.sku, size: changed.size, color: changed.color });
          } catch { throw statusError(409, 'An item sold out during checkout. Refresh your cart.'); }
        }
        for (const productRef of refs) tx.update(productRef, { ...working.get(productRef.id), updatedAt: FieldValue.serverTimestamp() });
        const expiresAt = new Date(Date.now() + HOLD_MS);
        tx.create(ref, { userId: req.user.uid, checkoutId, fingerprint, lines: heldLines,
          state: 'active', expiresAt, createdAt: FieldValue.serverTimestamp() });
        tx.create(db.collection('erp_reservationEvents').doc(`${reservationId}_reserve`), {
          reservationId, event: 'reserve', lines: heldLines, createdAt: FieldValue.serverTimestamp()
        });
        return { reservationId, expiresAt: expiresAt.toISOString(), duplicate: false };
      });
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      res.status(error.status || 409).json({ error: error.status ? error.message : 'Reservation unavailable. Refresh your cart.' });
    }
  });

  app.post('/api/checkout/reservations/release', requireAuth, async (req, res) => {
    try {
      const checkoutId = String(req.body?.checkout_id || '').trim();
      if (!checkoutPattern.test(checkoutId)) return res.status(422).json({ error: 'Invalid checkout ID.' });
      const result = await releaseReservation(getDb(), reservationIdFor(req.user.uid, checkoutId), req.user.uid);
      res.json(result);
    } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'Reservation release unavailable.' }); }
  });

  app.get('/api/jobs/release-reservations', async (req, res) => {
    const secret = String(process.env.CRON_SECRET || '');
    const supplied = String(req.get('authorization') || '').replace(/^Bearer /, '');
    if (!secret || secret.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(supplied)))
      return res.status(401).json({ error: 'Unauthorized.' });
    try {
      res.json(await sweep());
    } catch { res.status(503).json({ error: 'Expiry worker unavailable.' }); }
  });
  app.get('/api/jobs/drain-reservations', async (req, res) => {
    const secret = String(process.env.CRON_SECRET || '');
    const supplied = String(req.get('authorization') || '').replace(/^Bearer /, '');
    if (!secret || secret.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(supplied)))
      return res.status(401).json({ error: 'Unauthorized.' });
    if (enabled()) return res.status(409).json({ error: 'Disable ERP_RESERVATIONS_ENABLED before draining holds.' });
    try {
      const db = getDb();
      const docs = await db.collection('erp_reservations').where('state', '==', 'active').limit(20).get();
      const results = await Promise.allSettled(docs.docs.map(doc => releaseReservation(db, doc.id)));
      res.json({ inspected: docs.size, released: results.filter(result => result.status === 'fulfilled' && result.value.released).length,
        failed: results.filter(result => result.status === 'rejected').length });
    } catch { res.status(503).json({ error: 'Reservation drain unavailable.' }); }
  });
}
