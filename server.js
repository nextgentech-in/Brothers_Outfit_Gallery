import express from 'express';
import cors from 'cors';
import ImageKit from 'imagekit';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Basic .env parsing for local dev without requiring dotenv package
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, ...valueParts] = line.split('=');
      acc[key.trim()] = valueParts.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      return acc;
    }, {});
  Object.assign(process.env, envConfig);
}

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const imagekit = new ImageKit({
  publicKey: process.env.VITE_IMAGEKIT_PUBLIC_KEY || "dummy_public_key",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "dummy_private_key",
  urlEndpoint: process.env.VITE_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/dummy",
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

app.get('/api/imagekit/auth', (req, res) => {
  try {
    const result = imagekit.getAuthenticationParameters();
    res.json(result);
  } catch (error) {
    console.error("ImageKit Auth Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Mock authentication check middleware to ensure only admins can delete
// Since Firebase Auth token verification in backend requires Firebase Admin SDK,
// and we want to keep it simple, we expect a header `x-admin-request: true` or similar.
// In a full production app, you'd use Firebase Admin SDK to decode the Bearer token.
app.delete('/api/imagekit/delete/:fileId', async (req, res) => {
  // Simple check for now
  const adminHeader = req.headers['x-admin-request'];
  if (adminHeader !== 'true') {
     return res.status(403).json({ error: "Unauthorized" });
  }

  const { fileId } = req.params;
  if (!fileId) return res.status(400).json({ error: "Missing fileId" });

  try {
    const result = await imagekit.deleteFile(fileId);
    res.json(result);
  } catch (error) {
    console.error("ImageKit Delete Error:", error);
    // Ignore NOT_FOUND errors as the intent is to delete anyway
    if (error.message && error.message.includes('No file found')) {
        return res.json({ success: true, message: "File already deleted." });
    }
    res.status(500).json({ error: error.message });
  }
});

// ─── Razorpay: Create Order ────────────────────────────────────────────────
app.post('/api/razorpay/create-order', async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // rupees → paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Razorpay create-order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Razorpay: Verify Payment Signature ─────────────────────────────────────
app.post('/api/razorpay/verify', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  if (expected === razorpay_signature) {
    res.json({ success: true, paymentId: razorpay_payment_id });
  } else {
    res.status(400).json({ success: false, error: 'Signature mismatch — possible fraud attempt.' });
  }
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Brothers Outfit Backend listening on port ${port}`);
  });
}

export default app;

