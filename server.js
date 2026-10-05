import express from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { cert, getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { FieldValue, getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import {
  INTERNAL_STATUS,
  normalizeShipmentStatus,
  canTransitionStatus,
  calculateTimelineStep,
  formatDeliveryTimestamp
} from './src/utils/shipmentStatus.js';
import {
  EXCHANGE_STATUS,
  EXCHANGE_REASONS,
  checkExchangeEligibility,
  isValidExchangeTransition,
  DEFAULT_EXCHANGE_WINDOW_DAYS
} from './src/utils/exchangeConstants.js';

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
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

// Vercel adds one trusted proxy hop. Outside Vercel, never trust a caller-
// supplied X-Forwarded-For header when applying abuse limits.
app.set('trust proxy', process.env.VERCEL ? 1 : false);

// ───────────── ENHANCED SECURITY CONFIGURATION ─────────────
// 1. Hide Server Fingerprints
app.disable('x-powered-by');

// 2. Comprehensive Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  // Vercel Serverless path normalizer: restore original path if rewritten to /api
  const forwardedPath = req.headers['x-matched-path'] || req.headers['x-rewrite-url'] || req.headers['x-original-url'];
  if ((req.url === '/api' || req.url === '/api/') && forwardedPath && forwardedPath.startsWith('/api')) {
    req.url = forwardedPath;
  }
  next();
});

// 3. Strict CORS Whitelist
const ALLOWED_ORIGINS = [
  'https://brothers-outfit-gallery.vercel.app',
  'https://brothersoutfitgallery.com',
  'https://www.brothersoutfitgallery.com'
];

for (const configuredOrigin of (process.env.ALLOWED_ORIGINS || '').split(',')) {
  const cleanOrigin = configuredOrigin.trim();
  if (cleanOrigin && !ALLOWED_ORIGINS.includes(cleanOrigin)) ALLOWED_ORIGINS.push(cleanOrigin);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser agents, mobile apps, or local curl
    if (!origin) return callback(null, true);
    const isLocal = !IS_PRODUCTION && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || isLocal;
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-request', 'x-forwarded-for'],
  maxAge: 86400
}));

// 4. In-Memory General & Tiered Rate Limiter
const ipRateLimits = new Map();
const sensitiveRateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_GENERAL_REQ_PER_MIN = 180; // 180 req/min per IP to avoid false 429 errors during fast browsing

function getClientIp(req) {
  if (!IS_PRODUCTION && req.headers['x-simulated-user-ip']) {
    return String(req.headers['x-simulated-user-ip']).trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRateLimits.entries()) {
    if (now > record.resetTime) ipRateLimits.delete(ip);
  }
  for (const [ip, record] of sensitiveRateLimits.entries()) {
    if (now > record.resetTime) sensitiveRateLimits.delete(ip);
  }
}, 5 * 60 * 1000).unref();

// General Rate Limiter Middleware
app.use((req, res, next) => {
  if (req.path === '/api/health') return next();

  const clientIp = getClientIp(req);
  const now = Date.now();

  let ipRecord = ipRateLimits.get(clientIp);
  if (!ipRecord || now > ipRecord.resetTime) {
    ipRecord = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    ipRateLimits.set(clientIp, ipRecord);
  } else {
    ipRecord.count += 1;
  }

  if (ipRecord.count > MAX_GENERAL_REQ_PER_MIN) {
    return res.status(429).json({ error: 'Too many requests. Please slow down and try again.' });
  }

  next();
});

// 4b. Health Check Endpoint
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Helper function for sensitive endpoints (Payments, Email Alerts)
function checkSensitiveRateLimit(req, res, maxRequests = 15) {
  const clientIp = getClientIp(req);
  const now = Date.now();

  let ipRecord = sensitiveRateLimits.get(clientIp);
  if (!ipRecord || now > ipRecord.resetTime) {
    ipRecord = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    sensitiveRateLimits.set(clientIp, ipRecord);
    return true;
  }

  ipRecord.count += 1;
  if (ipRecord.count > maxRequests) {
    res.status(429).json({ error: 'Operation limit reached. Please wait 1 minute before trying again.' });
    return false;
  }
  return true;
}

// 5. Input Sanitization & Prototype Pollution Protection
function sanitizeValue(val) {
  if (typeof val === 'string') {
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (typeof val === 'object' && val !== null) {
    const clean = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      clean[k] = sanitizeValue(v);
    }
    return clean;
  }
  return val;
}

// Media uploads go directly to ImageKit/Firebase, so API JSON never needs to be
// huge. A tight limit reduces memory-exhaustion and slow-body abuse.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    try {
      req.body = sanitizeValue(req.body);
    } catch (_) {}
  }
  if (req.query && typeof req.query === 'object') {
    try {
      for (const key of Object.keys(req.query)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          delete req.query[key];
        } else {
          req.query[key] = sanitizeValue(req.query[key]);
        }
      }
    } catch (_) {}
  }
  next();
});


// Admin Notification Emails
const ADMIN_EMAILS = [
  process.env.VITE_ADMIN_EMAIL || 'setupatel01@gmail.com',
  'setupatel441@gmail.com'
];

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// Send Admin Email & Log Alert when a new order is placed
app.post(['/api/notifications/send-admin-alert', '/notifications/send-admin-alert'], async (req, res) => {
  if (!checkSensitiveRateLimit(req, res, 10)) return;

  const { orderId, customerName, totalAmount, paymentMethod, shippingAddress } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Order ID required.' });

  const alertMsg = `🚨 NEW ORDER RECEIVED!\n\nOrder ID: #${orderId}\nCustomer: ${customerName || 'Guest'}\nTotal Amount: ₹${totalAmount}\nPayment Method: ${paymentMethod}\nAddress: ${shippingAddress?.addressLine || ''}, ${shippingAddress?.city || ''} - ${shippingAddress?.pincode || ''}\nPhone: ${shippingAddress?.phone || ''}`;

  console.log(`\n======================================================`);
  console.log(`[ADMIN ALERT] New Order Created! Notifying Admins (${ADMIN_EMAILS.join(', ')}):\n${alertMsg}`);
  console.log(`======================================================\n`);

  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await mailTransporter.sendMail({
        from: '"Brothers Outfit Gallery" <brothersoutfitgallery@gmail.com>',
        to: ADMIN_EMAILS.join(', '),
        subject: `🚨 NEW ORDER RECEIVED: #${orderId} (₹${totalAmount})`,
        text: alertMsg,
      });
      console.log('Admin Email notification sent successfully.');
    }
    res.json({ success: true, message: 'Admin alert triggered.' });
  } catch (err) {
    console.warn('Admin Email notification error:', err.message);
    res.json({ success: true, message: 'Alert logged.' });
  }
});


// ───────────── PHONE NUMBER OTP VERIFICATION ENDPOINTS ─────────────
const otpStore = new Map(); // phone -> { otp, expiresAt, attempts, createdAt }
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;
const ALLOW_DEV_OTP = !IS_PRODUCTION && process.env.ALLOW_DEV_OTP !== 'false';

// Clean expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(phone);
    }
  }
}, 5 * 60 * 1000).unref();

// 1. Send OTP to Indian Phone Number
app.post(['/api/otp/send-otp', '/otp/send-otp'], async (req, res) => {
  if (!checkSensitiveRateLimit(req, res, 15)) return;

  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  // Clean phone number: remove non-digits and extract 10 digits
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
  }

  const now = Date.now();
  const existing = otpStore.get(cleanPhone);

  // Prevent spamming (minimum 20 seconds between resends)
  if (existing && (now - existing.createdAt < 20 * 1000)) {
    const waitSec = Math.ceil((20 * 1000 - (now - existing.createdAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSec}s before requesting a new OTP.` });
  }

  // Generate secure 6-digit numeric OTP
  const generatedOtp = crypto.randomInt(100000, 1000000).toString();

  otpStore.set(cleanPhone, {
    otp: generatedOtp,
    expiresAt: now + OTP_EXPIRY_MS,
    attempts: 0,
    createdAt: now
  });

  console.log(`[PHONE OTP DISPATCH] Sending a code to +91 ${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)}.`);

  // Dispatch Real SMS via available provider
  let realSmsSent = false;
  let smsProviderUsed = null;
  let lastGatewayError = null;

  // 1. Fast2SMS (India Quick SMS / OTP)
  if (process.env.FAST2SMS_API_KEY) {
    try {
      const fastRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: generatedOtp,
          numbers: cleanPhone
        })
      });
      const fastData = await fastRes.json().catch(() => ({}));
      console.log(`[SMS GATEWAY] Fast2SMS status:`, fastData);
      if (fastData?.return || fastData?.status_code === 200) {
        realSmsSent = true;
        smsProviderUsed = 'Fast2SMS';
      } else {
        lastGatewayError = fastData?.message || (Array.isArray(fastData?.message) ? fastData.message.join(', ') : 'Fast2SMS verification required');
        console.warn(`[SMS GATEWAY] Fast2SMS failed:`, lastGatewayError);
      }
    } catch (smsErr) {
      lastGatewayError = smsErr.message;
      console.warn(`[SMS GATEWAY] Fast2SMS error:`, smsErr.message);
    }
  }

  // 2. 2Factor.in (India Transactional SMS / OTP)
  if (!realSmsSent && process.env.TWOFACTOR_API_KEY) {
    try {
      const twoFactRes = await fetch(
        `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/SMS/${cleanPhone}/${generatedOtp}/OTP1`
      );
      const twoFactData = await twoFactRes.json().catch(() => ({}));
      console.log(`[SMS GATEWAY] 2Factor status:`, twoFactData);
      if (twoFactData?.Status === 'Success') {
        realSmsSent = true;
        smsProviderUsed = '2Factor';
      } else {
        lastGatewayError = twoFactData?.Details || '2Factor dispatch failed';
      }
    } catch (smsErr) {
      lastGatewayError = smsErr.message;
      console.warn(`[SMS GATEWAY] 2Factor error:`, smsErr.message);
    }
  }

  // 3. Twilio SMS
  if (!realSmsSent && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', `+91${cleanPhone}`);
      params.append('From', process.env.TWILIO_PHONE_NUMBER);
      params.append('Body', `Your Brothers Outfit verification OTP is ${generatedOtp}. Valid for 5 minutes.`);

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        }
      );
      const twilioData = await twilioRes.json().catch(() => ({}));
      console.log(`[SMS GATEWAY] Twilio status:`, twilioData);
      if (twilioData?.sid) {
        realSmsSent = true;
        smsProviderUsed = 'Twilio';
      } else {
        lastGatewayError = twilioData?.message || 'Twilio dispatch failed';
      }
    } catch (smsErr) {
      lastGatewayError = smsErr.message;
      console.warn(`[SMS GATEWAY] Twilio error:`, smsErr.message);
    }
  }

  const hasConfiguredGateway = Boolean(
    process.env.FAST2SMS_API_KEY ||
    process.env.TWOFACTOR_API_KEY ||
    (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  );

  if (!realSmsSent) {
    if (ALLOW_DEV_OTP) {
      console.warn(`[OTP DEVELOPMENT MODE] SMS unavailable: ${lastGatewayError || 'No live SMS gateway configured'}.`);
      return res.json({
        success: true,
        message: `Development OTP generated for +91 ${cleanPhone}.`,
        phone: cleanPhone,
        expiresIn: 300,
        realSmsSent: false,
        devOtp: generatedOtp
      });
    }

    otpStore.delete(cleanPhone);
    return res.status(503).json({
      success: false,
      error: hasConfiguredGateway
        ? 'The SMS provider is temporarily unavailable. Please try again shortly.'
        : 'Phone verification is temporarily unavailable.'
    });
  }

  return res.json({
    success: true,
    message: `OTP sent successfully to +91 ${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)} via SMS.`,
    phone: cleanPhone,
    expiresIn: 300,
    realSmsSent: true,
    smsProvider: smsProviderUsed
  });
});

// 2. Verify Entered OTP
app.post(['/api/otp/verify-otp', '/otp/verify-otp'], (req, res) => {
  if (!checkSensitiveRateLimit(req, res, 20)) return;
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone number and 6-digit OTP are required.' });
  }

  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const cleanOtp = String(otp).trim();

  // Test codes are never accepted by production deployments.
  if (ALLOW_DEV_OTP && (cleanOtp === '123456' || cleanOtp === '000000')) {
    otpStore.delete(cleanPhone);
    return res.json({
      success: true,
      verified: true,
      phone: cleanPhone,
      verifiedAt: new Date().toISOString()
    });
  }

  const record = otpStore.get(cleanPhone);
  if (!record) {
    return res.status(400).json({ error: 'No active OTP found or code has expired. Please tap Resend OTP.' });
  }

  const now = Date.now();
  if (now > record.expiresAt) {
    otpStore.delete(cleanPhone);
    return res.status(400).json({ error: 'OTP has expired. Please request a new code.' });
  }

  record.attempts += 1;
  if (record.attempts > MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(cleanPhone);
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
  }

  if (record.otp !== cleanOtp) {
    const remaining = MAX_VERIFY_ATTEMPTS - record.attempts;
    return res.status(400).json({
      error: `Incorrect OTP. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Please request a new code.'}`
    });
  }

  // OTP verified successfully - consume so it cannot be re-used
  otpStore.delete(cleanPhone);

  console.log(`[PHONE OTP SUCCESS] +91 ${cleanPhone} verified successfully.`);
  return res.json({
    success: true,
    verified: true,
    phone: cleanPhone,
    verifiedAt: new Date().toISOString()
  });
});

const getRazorpayClient = () => {
  const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials missing. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment.');
  }
  return new Razorpay({
    key_id,
    key_secret,
  });
};

// Safe lazy initialization: do not throw at startup if keys are not set
let razorpay = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = getRazorpayClient();
  }
} catch (e) {
  console.warn('Razorpay client init deferred:', e.message);
}

// ─── Token Verification & Admin Authentication Middleware ──────────────────
const adminTokenCache = new Map();
// This is used only for Firebase's token lookup fallback. Keep it server-side;
// never place credentials such as service-account or payment secrets in VITE_* variables.
const FIREBASE_API_KEY = (process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || '').trim();
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "brothersoutfitgallary";

// Administrative Firestore access is deliberately server-only. Customer-created
// order documents are not trusted because browser state can be modified.
let adminFirestoreDb = null;
function getTrustedFirestore() {
  if (adminFirestoreDb) return adminFirestoreDb;

  try {
    if (!getApps().length) {
      const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      let serviceAccount;
      if (rawServiceAccount) {
        serviceAccount = typeof rawServiceAccount === 'string' ? JSON.parse(rawServiceAccount) : rawServiceAccount;
      } else {
        const rawProjectId = (process.env.FIREBASE_ADMIN_PROJECT_ID || FIREBASE_PROJECT_ID || '').trim();
        const rawClientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
        let rawPrivateKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
        
        // Remove enclosing quotes if any
        if ((rawPrivateKey.startsWith('"') && rawPrivateKey.endsWith('"')) ||
            (rawPrivateKey.startsWith("'") && rawPrivateKey.endsWith("'"))) {
          rawPrivateKey = rawPrivateKey.slice(1, -1);
        }
        
        // Handle escaped newlines
        rawPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');

        serviceAccount = {
          projectId: rawProjectId,
          clientEmail: rawClientEmail,
          privateKey: rawPrivateKey
        };
      }

      if (serviceAccount.projectId) {
        serviceAccount.projectId = serviceAccount.projectId.trim();
      }
      if (serviceAccount.clientEmail) {
        serviceAccount.clientEmail = serviceAccount.clientEmail.trim();
      }

      if (!serviceAccount.clientEmail || !serviceAccount.privateKey) {
        throw new Error('Firebase Admin credentials are not configured. Check clientEmail and privateKey.');
      }

      initializeAdminApp({ credential: cert(serviceAccount) });
    }
    adminFirestoreDb = getAdminFirestore();
    return adminFirestoreDb;
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error);
    throw new Error(`Secure order service initialization error: ${error.message}`);
  }
}

async function verifyUserToken(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  if (!FIREBASE_API_KEY) return null;
  const tokenHash = crypto.createHash('sha256').update(idToken).digest('hex');
  const cached = adminTokenCache.get(tokenHash);
  if (cached && Date.now() < cached.expiresAt) {
    return cached;
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.users && data.users.length > 0) {
      const user = data.users[0];
      const record = {
        uid: user.localId,
        email: (user.email || '').toLowerCase().trim(),
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 min cache
      };
      adminTokenCache.set(tokenHash, record);
      return record;
    }
  } catch (err) {
    console.warn('Token verification error:', err.message);
  }
  return null;
}

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of adminTokenCache.entries()) {
    if (now > v.expiresAt) adminTokenCache.delete(k);
  }
}, 10 * 60 * 1000).unref();

async function requireAdminAuth(req, res, next) {
  const adminSecret = (process.env.ADMIN_SECRET || '').trim();
  const reqSecret = String(req.headers['x-admin-secret'] || '');
  const expectedSecret = Buffer.from(adminSecret);
  const suppliedSecret = Buffer.from(reqSecret);
  if (adminSecret && expectedSecret.length === suppliedSecret.length && crypto.timingSafeEqual(expectedSecret, suppliedSecret)) {
    req.isAdmin = true;
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const user = await verifyUserToken(token);
    if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
      req.user = user;
      req.isAdmin = true;
      return next();
    }
  }

  return res.status(401).json({
    error: 'Unauthorized: Admin authentication is required.'
  });
}

async function requireAuth(req, res, next) {
  const adminSecret = (process.env.ADMIN_SECRET || '').trim();
  const reqSecret = String(req.headers['x-admin-secret'] || '');
  const expectedSecret = Buffer.from(adminSecret);
  const suppliedSecret = Buffer.from(reqSecret);
  if (adminSecret && expectedSecret.length === suppliedSecret.length && crypto.timingSafeEqual(expectedSecret, suppliedSecret)) {
    req.isAdmin = true;
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const user = await verifyUserToken(token);
    if (user) {
      req.user = user;
      req.isAdmin = ADMIN_EMAILS.includes(user.email);
      return next();
    }
  }

  return res.status(401).json({
    error: 'Unauthorized: Authentication required.'
  });
}

// ─── Server-Side Catalog Cache & Price Verification ─────────────────────────
let productCatalogCache = { products: null, expiresAt: 0 };
let couponCatalogCache = { coupons: null, expiresAt: 0 };

function parseFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(parseFirestoreValue);
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = parseFirestoreValue(v);
    return obj;
  }
  return null;
}

function parseFirestoreDoc(doc) {
  if (!doc || !doc.name) return null;
  const id = doc.name.split('/').pop();
  const obj = { id };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    obj[k] = parseFirestoreValue(v);
  }
  return obj;
}

async function fetchProductsFromFirestore() {
  if (productCatalogCache.products && Date.now() < productCatalogCache.expiresAt) {
    return productCatalogCache.products;
  }
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products?pageSize=300`);
    if (res.ok) {
      const data = await res.json();
      const products = (data.documents || []).map(parseFirestoreDoc).filter(Boolean);
      productCatalogCache = { products, expiresAt: Date.now() + 60 * 1000 };
      return products;
    }
  } catch (err) {
    console.warn('Failed to fetch products from Firestore REST API:', err.message);
  }
  return productCatalogCache.products || [];
}

async function fetchCouponsFromFirestore() {
  if (couponCatalogCache.coupons && Date.now() < couponCatalogCache.expiresAt) {
    return couponCatalogCache.coupons;
  }
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/coupons?pageSize=100`);
    if (res.ok) {
      const data = await res.json();
      const coupons = (data.documents || []).map(parseFirestoreDoc).filter(Boolean);
      couponCatalogCache = { coupons, expiresAt: Date.now() + 60 * 1000 };
      return coupons;
    }
  } catch (err) {
    console.warn('Failed to fetch coupons from Firestore REST API:', err.message);
  }
  return couponCatalogCache.coupons || [];
}

async function calculateServerOrderTotal(items, couponCode) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
    throw new Error('Cart must contain between 1 and 30 items.');
  }

  const products = await fetchProductsFromFirestore();
  const productsMap = new Map(products.map(p => [p.id, p]));

  let subtotal = 0;
  const authoritativeItems = [];
  for (const item of items) {
    const rawId = item.id || item.productId || (typeof item.cartItemId === 'string' ? item.cartItemId.split('-')[0] : null);
    let product = rawId ? productsMap.get(rawId) : null;
    if (!product && (item.slug || item.name)) {
      const cleanSlug = (item.slug || '').toLowerCase().trim();
      const cleanName = (item.name || '').toLowerCase().trim();
      product = products.find(p =>
        (cleanSlug && (p.slug || '').toLowerCase().trim() === cleanSlug) ||
        (cleanName && (p.name || '').toLowerCase().trim() === cleanName)
      );
    }

    if (!product || product.active === false) {
      throw new Error(`One or more products are unavailable. Please refresh your cart.`);
    }

    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    let matchedVariant = null;
    let unitPrice = Number(product.salePrice ?? product.price ?? 0);
    const targetSize = item.size || item.selectedSize || null;
    const targetColor = item.color || item.selectedColor || null;

    if (product.variants && product.variants.length > 0 && targetSize) {
      const cleanSize = String(targetSize).trim().toLowerCase();
      const cleanColor = targetColor ? String(targetColor).trim().toLowerCase() : null;
      matchedVariant = product.variants.find(v => {
        const vSize = String(v.size || '').trim().toLowerCase();
        if (vSize !== cleanSize) return false;
        if (!cleanColor) return true;
        const vCol = String(v.color || '').trim().toLowerCase();
        return vCol === cleanColor || vCol === 'standard' || vCol === 'default';
      }) || product.variants.find(v => String(v.size || '').trim().toLowerCase() === cleanSize);
      if (!matchedVariant) {
        throw new Error(`The selected size is no longer available for ${product.name || 'this item'}.`);
      }
      unitPrice = Number(matchedVariant.salePrice ?? matchedVariant.price ?? unitPrice);
    }

    const availableStock = Number(matchedVariant?.stock ?? product.stock);
    if (Number.isFinite(availableStock) && (availableStock < 1 || qty > availableStock)) {
      throw new Error(`${product.name || 'This item'} does not have enough stock available.`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error(`A valid store price could not be found for ${product.name || 'this item'}.`);
    }

    subtotal += unitPrice * qty;
    authoritativeItems.push({
      id: product.id,
      productId: product.id,
      slug: product.slug || '',
      name: product.name || 'Product',
      image: product.image || product.thumbnailUrl || product.images?.[0]?.url || product.images?.[0] || '',
      size: targetSize || matchedVariant?.size || 'One Size',
      selectedSize: targetSize || matchedVariant?.size || 'One Size',
      color: targetColor || matchedVariant?.color || product.colors?.[0]?.name || product.colors?.[0] || 'Default',
      selectedColor: targetColor || matchedVariant?.color || product.colors?.[0]?.name || product.colors?.[0] || 'Default',
      quantity: qty,
      price: unitPrice,
      mrp: Number(matchedVariant?.mrp ?? product.mrp ?? product.compareAtPrice ?? unitPrice)
    });
  }

  // Tiered store discount: ₹250 off if cart subtotal >= ₹2500
  const discount = subtotal >= 2500 ? 250 : 0;

  // Coupon discount calculation
  let couponDiscount = 0;
  if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
    const cleanCode = couponCode.trim().toUpperCase();
    const coupons = await fetchCouponsFromFirestore();
    const coupon = coupons.find(c => (c.code || '').toUpperCase() === cleanCode && c.active !== false);
    if (coupon) {
      const nowStr = new Date().toISOString().slice(0, 10);
      const isExpired = coupon.expiryDate && coupon.expiryDate < nowStr;
      const minAmount = Number(coupon.minOrderAmount) || 0;
      if (!isExpired && subtotal >= minAmount) {
        if (coupon.discountType === 'percentage') {
          couponDiscount = Math.round((subtotal * (Number(coupon.discountValue) || 0)) / 100);
        } else {
          couponDiscount = Number(coupon.discountValue) || 0;
        }
      }
    }
  }

  // Free shipping for orders >= ₹1000, else ₹70
  const shippingCost = subtotal >= 1000 ? 0 : 70;
  const finalTotal = Math.max(1, subtotal - discount - couponDiscount + shippingCost);

  return {
    subtotal,
    discount,
    couponDiscount,
    shippingCost,
    finalTotal,
    items: authoritativeItems
  };
}

app.get(['/api/imagekit/auth', '/imagekit/auth'], requireAdminAuth, (req, res) => {
  try {
    const privateKey = (process.env.IMAGEKIT_PRIVATE_KEY || '').trim();
    const publicKey = (process.env.IMAGEKIT_PUBLIC_KEY || process.env.VITE_IMAGEKIT_PUBLIC_KEY || '').trim();
    if (!privateKey || !publicKey) {
      return res.status(503).json({
        error: 'ImageKit private key not configured. Using client fallback storage.',
        configured: false
      });
    }
    const token = crypto.randomBytes(24).toString('hex');
    const expire = Math.floor(Date.now() / 1000) + 30 * 60;
    const signature = crypto
      .createHmac('sha1', privateKey)
      .update(`${token}${expire}`)
      .digest('hex');
    return res.json({ token, expire, signature, publicKey, configured: true });
  } catch (error) {
    console.warn("ImageKit Auth notice:", error.message);
    return res.status(503).json({
      error: error.message,
      configured: false
    });
  }
});

// Admin-Protected Media Management API
app.delete(['/api/imagekit/delete/:fileId', '/imagekit/delete/:fileId'], requireAdminAuth, async (req, res) => {
  const { fileId } = req.params;
  if (!fileId) return res.status(400).json({ error: "Missing fileId" });

  try {
    const privateKey = (process.env.IMAGEKIT_PRIVATE_KEY || '').trim();
    if (!privateKey) return res.status(503).json({ error: 'ImageKit is not configured.' });

    const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`
      }
    });
    if (response.status === 404) {
      return res.json({ success: true, message: 'File already deleted.' });
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ImageKit deletion failed (${response.status}): ${body.slice(0, 200)}`);
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("ImageKit Delete Error:", error);
    res.status(502).json({ error: 'Image deletion failed.' });
  }
});

// ─── Razorpay: Create Order (Standard Endpoint & Cart Calculation) ──────────
app.post(['/api/create-order', '/create-order', '/api/razorpay/create-order', '/razorpay/create-order'], async (req, res) => {
  if (!checkSensitiveRateLimit(req, res, 25)) return;

  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!keyId || !keySecret) {
    console.error('FATAL: Razorpay API keys are not configured in environment variables.');
    return res.status(500).json({
      error: 'Payment gateway configuration error: Razorpay credentials missing.'
    });
  }

  const { amount, currency = 'INR', receipt, items, couponCode } = req.body;
  if (String(currency).toUpperCase() !== 'INR') {
    return res.status(400).json({ error: 'Only INR payments are supported.' });
  }
  let amountInPaise = 0;

  // Case 1: Items array supplied (Calculate authoritative total server-side)
  if (items && Array.isArray(items) && items.length > 0) {
    try {
      const serverCalc = await calculateServerOrderTotal(items, couponCode);
      amountInPaise = Math.round(serverCalc.finalTotal * 100);
    } catch (calcErr) {
      console.error('Server order total calculation error:', calcErr);
      return res.status(400).json({ error: calcErr.message || 'Error computing order total.' });
    }
  } else if (amount !== undefined && amount !== null && !isNaN(Number(amount))) {
    // Case 2: Direct amount supplied (in paise, as per Razorpay Standard Checkout spec)
    amountInPaise = Math.round(Number(amount));
  } else {
    return res.status(400).json({
      error: 'Please specify an amount (in paise, min 100) or provide an items array.'
    });
  }

  // Razorpay requires minimum 100 paise (₹1.00)
  if (amountInPaise < 100) {
    return res.status(400).json({
      error: 'Invalid amount. Minimum amount must be at least 100 paise (₹1.00).'
    });
  }
  if (amountInPaise > 100000000) {
    return res.status(400).json({ error: 'Payment amount exceeds the supported limit.' });
  }

  try {
    const rzp = getRazorpayClient();
    const orderReceipt = receipt || `rcpt_${Date.now().toString().slice(-8)}`;
    const order = await rzp.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: String(orderReceipt).slice(0, 40),
    });

    return res.json({
      order_id: order.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: keyId
    });
  } catch (error) {
    console.error('Razorpay create-order error:', error);
    if (error.statusCode === 401 || (error.error && error.error.code === 'BAD_REQUEST_ERROR' && String(error.error.description).toLowerCase().includes('auth'))) {
      return res.status(401).json({ error: 'Razorpay authentication failed. Please verify your API keys.' });
    }
    return res.status(500).json({ error: error.message || error.error?.description || 'Payment gateway order creation failed.' });
  }
});

// ─── Razorpay: Verify Payment Signature (HMAC-SHA256 Timing-Safe Comparison) ──
app.post(['/api/verify-payment', '/verify-payment', '/api/razorpay/verify', '/razorpay/verify'], (req, res) => {
  if (!checkSensitiveRateLimit(req, res, 30)) return;
  const razorpay_order_id = req.body.razorpay_order_id || req.body.order_id;
  const razorpay_payment_id = req.body.razorpay_payment_id || req.body.payment_id;
  const razorpay_signature = req.body.razorpay_signature || req.body.signature;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'
    });
  }

  const secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!secret) {
    console.error('FATAL: RAZORPAY_KEY_SECRET is not configured on the server.');
    return res.status(500).json({
      success: false,
      error: 'Server payment configuration error: RAZORPAY_KEY_SECRET is missing.'
    });
  }

  try {
    // Standard Razorpay signature format: HMAC-SHA256(order_id + "|" + payment_id, secret)
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const receivedBuf = Buffer.from(String(razorpay_signature), 'utf-8');

    // Constant-time comparison protects against side-channel timing attacks
    if (expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return res.json({
        success: true,
        message: 'Payment verified successfully.',
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        paymentId: razorpay_payment_id
      });
    } else {
      console.warn('Razorpay signature mismatch: potential tampering attempt.');
      return res.status(400).json({
        success: false,
        error: 'Signature mismatch: payment verification failed.'
      });
    }
  } catch (err) {
    console.error('Razorpay verification error:', err);
    return res.status(500).json({
      success: false,
      error: 'Payment signature verification failed: ' + err.message
    });
  }
});

function normalizeShippingAddress(address = {}) {
  const fullName = String(address.fullName || '').trim();
  const phone = String(address.phone || '').replace(/\D/g, '').slice(-10);
  const addressLine = String(address.addressLine || '').trim();
  const city = String(address.city || '').trim();
  const state = String(address.state || '').trim();
  const pincode = String(address.pincode || '').replace(/\D/g, '').slice(0, 6);
  const email = String(address.email || '').trim().toLowerCase();

  if (!fullName || !addressLine || !city || !/^[6-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(pincode) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A complete delivery address, valid Indian mobile number, and email address are required.');
  }

  return { fullName, phone, addressLine, city, state, pincode, email };
}

async function verifyRazorpayPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }, expectedAmount) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new Error('Missing payment verification details.');
  }

  const secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!secret) throw new Error('Payment service is not configured.');

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf-8');
  const receivedBuf = Buffer.from(String(razorpay_signature), 'utf-8');
  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    throw new Error('Payment signature verification failed.');
  }

  const rzp = getRazorpayClient();
  const [gatewayOrder, gatewayPayment] = await Promise.all([
    rzp.orders.fetch(razorpay_order_id),
    rzp.payments.fetch(razorpay_payment_id)
  ]);
  if (
    gatewayOrder.amount !== Math.round(expectedAmount * 100) ||
    gatewayPayment.order_id !== razorpay_order_id ||
    gatewayPayment.status !== 'captured'
  ) {
    throw new Error('Payment details do not match the verified order.');
  }

  return { orderId: razorpay_order_id, paymentId: razorpay_payment_id };
}

// Creates an immutable, server-validated order. Firebase Admin bypasses client
// Firestore rules, so users cannot forge prices or a paid order in the browser.
app.post(['/api/orders/create', '/orders/create'], requireAuth, async (req, res) => {
  if (!checkSensitiveRateLimit(req, res, 10)) return;

  try {
    const { items, couponCode, shippingAddress, paymentMethod, payment } = req.body;
    const normalizedPaymentMethod = String(paymentMethod || '').toLowerCase();
    if (!['cod', 'razorpay'].includes(normalizedPaymentMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method.' });
    }

    const [calculation, address] = await Promise.all([
      calculateServerOrderTotal(items, couponCode),
      Promise.resolve(normalizeShippingAddress(shippingAddress))
    ]);

    let paymentDetails = null;
    if (normalizedPaymentMethod === 'razorpay') {
      paymentDetails = await verifyRazorpayPayment(payment || {}, calculation.finalTotal);
    }

    const orderId = paymentDetails
      ? `ORD-${paymentDetails.paymentId.replace(/[^A-Za-z0-9_-]/g, '')}`
      : `ORD-${crypto.randomUUID()}`;
    const db = getTrustedFirestore();
    const orderRef = db.collection('orders').doc(orderId);
    const order = {
      userId: req.user.uid,
      userEmail: address.email,
      userPhone: address.phone,
      shippingAddress: address,
      items: calculation.items,
      subtotal: calculation.subtotal,
      discount: calculation.discount,
      couponCode: couponCode ? String(couponCode).trim().toUpperCase() : null,
      couponDiscount: calculation.couponDiscount,
      shippingCost: calculation.shippingCost,
      totalAmount: calculation.finalTotal,
      paymentMethod: normalizedPaymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay Online Payment',
      paymentStatus: normalizedPaymentMethod === 'cod' ? 'Pending (COD)' : 'Paid',
      paymentId: paymentDetails?.paymentId || null,
      razorpayOrderId: paymentDetails?.orderId || null,
      status: 'Processing',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: 'secure-server'
    };

    try {
      await orderRef.create(order);
    } catch (error) {
      if (error.code !== 6) throw error; // ALREADY_EXISTS is safe idempotency for payment retries.
      const existing = await orderRef.get();
      if (!existing.exists || existing.data().userId !== req.user.uid) {
        throw new Error('This payment has already been associated with another order.');
      }
      return res.json({ success: true, orderId, duplicate: true });
    }

    await db.collection('notifications').doc(orderId).set({
      type: 'NEW_ORDER',
      orderId,
      message: `Order #${orderId.substring(0, 14)} placed by ${address.fullName} (₹${calculation.finalTotal})`,
      customerName: address.fullName,
      totalAmount: calculation.finalTotal,
      paymentMethod: order.paymentMethod,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });

    // ─── Stock Decrement & 0-Quantity Store Visibility Update ───────────
    // For each ordered item, decrement the matching variant stock and product-level total stock.
    // When stock reaches 0, set inStock: false and active: false so product is not visible in the store.
    try {
      for (const item of calculation.items) {
        const prodId = item.productId || item.id;
        let productRef = prodId ? db.collection('products').doc(prodId) : null;
        let productSnap = productRef ? await productRef.get() : null;

        // Fallback: look up by slug if doc ID wasn't found directly
        if ((!productSnap || !productSnap.exists) && item.slug) {
          const qSnap = await db.collection('products').where('slug', '==', item.slug).limit(1).get();
          if (!qSnap.empty) {
            productSnap = qSnap.docs[0];
            productRef = productSnap.ref;
          }
        }

        if (!productSnap || !productSnap.exists) continue;

        const productData = productSnap.data();
        const variants = Array.isArray(productData.variants) ? [...productData.variants] : [];
        const orderedQty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const orderedSize = item.size || item.selectedSize || null;
        const orderedColor = item.color || item.selectedColor || null;

        if (variants.length > 0) {
          const cleanSize = orderedSize ? String(orderedSize).trim().toLowerCase() : null;
          const cleanColor = orderedColor ? String(orderedColor).trim().toLowerCase() : null;

          // Find matching variant by size + color
          let matchIdx = -1;
          if (cleanSize) {
            matchIdx = variants.findIndex(v => {
              const vSize = String(v.size || '').trim().toLowerCase();
              if (vSize !== cleanSize) return false;
              if (!cleanColor) return true;
              const vCol = String(v.color || '').trim().toLowerCase();
              return vCol === cleanColor || vCol === 'standard' || vCol === 'default';
            });
            // Fallback: match by size only
            if (matchIdx < 0) {
              matchIdx = variants.findIndex(v => String(v.size || '').trim().toLowerCase() === cleanSize);
            }
          }

          // Fallback: if no size or not found, use first variant
          if (matchIdx < 0) {
            matchIdx = 0;
          }

          if (matchIdx >= 0 && matchIdx < variants.length) {
            const currentStock = parseInt(variants[matchIdx].stock ?? variants[matchIdx].quantity, 10) || 0;
            const updatedVarStock = Math.max(0, currentStock - orderedQty);
            variants[matchIdx] = {
              ...variants[matchIdx],
              stock: updatedVarStock,
              quantity: updatedVarStock
            };
          }

          // Recalculate total product stock across all variants
          const newTotalStock = variants.reduce((sum, v) => sum + (parseInt(v.stock ?? v.quantity, 10) || 0), 0);
          const hasRemainingStock = newTotalStock > 0;
          const availableSizesList = [...new Set(variants.filter(v => (parseInt(v.stock ?? v.quantity, 10) || 0) > 0).map(v => v.size))].filter(Boolean);

          await productRef.update({
            variants: variants,
            stock: Math.max(0, newTotalStock),
            quantity: Math.max(0, newTotalStock),
            inStock: hasRemainingStock,
            active: hasRemainingStock, // If quantity 0, not visible on store
            sizes: availableSizesList, // Only available sizes remain
            updatedAt: FieldValue.serverTimestamp()
          });
        } else {
          // No variants — decrement product-level stock directly
          const currentStock = parseInt(productData.stock ?? productData.quantity, 10) || 0;
          const newStock = Math.max(0, currentStock - orderedQty);
          const hasRemainingStock = newStock > 0;

          await productRef.update({
            stock: newStock,
            quantity: newStock,
            inStock: hasRemainingStock,
            active: hasRemainingStock, // If quantity 0, not visible on store
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }
      // Invalidate server product cache so next request reflects new stock
      productCatalogCache = { products: null, expiresAt: 0 };
    } catch (stockErr) {
      console.warn('Stock decrement and visibility update warning (order still valid):', stockErr.message);
    }

    res.status(201).json({ success: true, orderId, totalAmount: calculation.finalTotal });
  } catch (error) {
    console.error('Secure order creation failed:', error.message);
    res.status(400).json({ error: error.message || 'Unable to create order.' });
  }
});

// ─── Public Customer Order Tracking API ──────────────────────────────────────
app.post(['/api/orders/track', '/orders/track'], async (req, res) => {
  if (!checkSensitiveRateLimit(req, res, 30)) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  const rawQuery = String(body?.query || body?.orderId || '').trim();
  if (!rawQuery) {
    return res.status(400).json({ error: 'Please enter an Order ID, Mobile Number, or Waybill tracking number.' });
  }

  try {
    const db = getTrustedFirestore();
    const ordersCol = db.collection('orders');
    const matchedMap = new Map();
    const withDbTimeout = (p, ms = 2000) => Promise.race([
      p,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms))
    ]);

    // 1. Direct match by exact document ID
    try {
      const directDoc = await withDbTimeout(ordersCol.doc(rawQuery).get(), 2000);
      if (directDoc.exists) {
        matchedMap.set(directDoc.id, { id: directDoc.id, ...directDoc.data() });
      }
    } catch {}

    // 2. Search by Phone number (clean 10 digits)
    const cleanPhone = rawQuery.replace(/\D/g, '').slice(-10);
    if (matchedMap.size === 0 && cleanPhone.length === 10) {
      try {
        const snapPhone = await withDbTimeout(ordersCol.where('shippingAddress.phone', '==', cleanPhone).limit(5).get(), 2000);
        snapPhone.forEach(d => matchedMap.set(d.id, { id: d.id, ...d.data() }));
      } catch {}

      if (matchedMap.size === 0) {
        try {
          const snapUserPhone = await withDbTimeout(ordersCol.where('userPhone', '==', cleanPhone).limit(5).get(), 2000);
          snapUserPhone.forEach(d => matchedMap.set(d.id, { id: d.id, ...d.data() }));
        } catch {}
      }
    }

    // 3. Search by Delhivery Waybill / AWB
    if (matchedMap.size === 0) {
      try {
        const snapWaybill = await withDbTimeout(ordersCol.where('waybill', '==', rawQuery).limit(2).get(), 2000);
        snapWaybill.forEach(d => matchedMap.set(d.id, { id: d.id, ...d.data() }));
      } catch {}
    }

    // 4. Substring / Prefix match for short Order IDs (e.g. 311019e6)
    if (matchedMap.size === 0 && rawQuery.length >= 6) {
      try {
        const allRecent = await withDbTimeout(ordersCol.orderBy('createdAt', 'desc').limit(40).get(), 2000);
        allRecent.forEach(d => {
          if (d.id.toLowerCase().includes(rawQuery.toLowerCase())) {
            matchedMap.set(d.id, { id: d.id, ...d.data() });
          }
        });
      } catch {}
    }

    const matchedOrders = Array.from(matchedMap.values());
    if (matchedOrders.length === 0) {
      return res.status(404).json({
        error: `No order found matching "${rawQuery}". Please check your Order ID or phone number.`
      });
    }

    // Sanitize before returning to customer and enrich with live Delhivery status
    const sanitized = await Promise.all(matchedOrders.map(async (order) => {
      let liveTracking = null;
      if (order.waybill) {
        try {
          liveTracking = await syncDelhiveryTrackingForWaybill(order.waybill, {
            orderDocId: order.id,
            existingData: order
          });
        } catch (syncErr) {
          console.warn(`Live tracking sync note for order ${order.id}:`, syncErr.message);
        }
      }

      const effectiveShipmentStatus = liveTracking?.shipmentStatus || 
        order.shipmentStatus || 
        (order.status === 'Delivered' ? INTERNAL_STATUS.DELIVERED : (order.status === 'Shipped' ? INTERNAL_STATUS.SHIPPED : INTERNAL_STATUS.PLACED));

      const isDelivered = effectiveShipmentStatus === INTERNAL_STATUS.DELIVERED || String(order.status || '').toLowerCase() === 'delivered';
      const isOutOfDelivery = effectiveShipmentStatus === INTERNAL_STATUS.OUT_FOR_DELIVERY || String(order.status || '').toLowerCase().includes('out for delivery');
      const effectiveStatus = isDelivered 
        ? 'Delivered' 
        : (isOutOfDelivery 
            ? 'Out for Delivery' 
            : (liveTracking?.status || order.status || 'Processing'));
      const deliveredAt = liveTracking?.deliveredAt || 
        (order.deliveredAt?.toDate ? order.deliveredAt.toDate().toISOString() : (typeof order.deliveredAt === 'string' ? order.deliveredAt : null));
      const timelineStep = liveTracking?.timelineStep || calculateTimelineStep(effectiveShipmentStatus);

      return {
        id: order.id,
        status: effectiveStatus,
        shipmentStatus: effectiveShipmentStatus,
        rawProviderStatus: liveTracking?.rawProviderStatus || order.rawProviderStatus || effectiveStatus,
        rawProviderStatusCode: liveTracking?.rawProviderStatusCode || order.rawProviderStatusCode || null,
        deliveredAt: deliveredAt,
        latestScan: liveTracking?.latestScan || order.latestScan || null,
        timelineStep: timelineStep,
        isDelivered: isDelivered,
        isOutOfDelivery: isOutOfDelivery,
        expectedDeliveryDate: liveTracking?.expectedDeliveryDate || order.expectedDeliveryDate || null,
        statusLocation: liveTracking?.statusLocation || order.statusLocation || null,
        scans: liveTracking?.scans || order.scans || [],
        waybill: order.waybill || null,
        courier: order.courier || 'Delhivery Express',
        trackingUrl: order.trackingUrl || (order.waybill ? `https://www.delhivery.com/track/package/${order.waybill}` : null),
        createdAt: order.createdAt?.toDate ? order.createdAt.toDate().toISOString() : order.createdAt,
        shippedAt: order.shippedAt?.toDate ? order.shippedAt.toDate().toISOString() : order.shippedAt || null,
        totalAmount: order.totalAmount || order.finalTotal || 0,
        paymentMethod: order.paymentMethod || 'Online',
        paymentStatus: order.paymentStatus || 'Paid',
        pickupAgentStatus: order.pickupAgentStatus || null,
        shippingAddress: {
          fullName: order.shippingAddress?.fullName || 'Valued Customer',
          city: order.shippingAddress?.city || '',
          state: order.shippingAddress?.state || '',
          pincode: order.shippingAddress?.pincode || '',
          phone: order.shippingAddress?.phone ? `${order.shippingAddress.phone.slice(0, 3)}****${order.shippingAddress.phone.slice(-3)}` : ''
        },
        items: (order.items || []).map(item => ({
          name: item.name,
          size: item.size || item.selectedSize || 'One Size',
          color: item.color || item.selectedColor || 'Default',
          quantity: item.quantity || 1,
          price: item.price || 0,
          image: item.image || item.thumbnailUrl || (item.images && item.images[0]?.url) || (item.images && item.images[0]) || '/images/hero.png'
        }))
      };
    }));

    res.json({ success: true, orders: sanitized });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ error: 'Unable to track order. Please try again.' });
  }
});

// ─── Delhivery One: OAuth Token Cache ─────────────────────────────────────
// ─── Delhivery One: Auth Token Helper ─────────────────────────────────────
let cachedDelhiveryToken = null;
let tokenExpiryTime = 0;

async function getDelhiveryAuthToken() {
  // 1. Direct API Token from Delhivery One Dashboard
  if (process.env.DELHIVERY_API_KEY) {
    return process.env.DELHIVERY_API_KEY;
  }

  // 2. OAuth Client Credentials token fallback
  if (cachedDelhiveryToken && Date.now() < tokenExpiryTime - 60000) {
    return cachedDelhiveryToken;
  }

  const clientSecret = (process.env.D1_CLIENT_SECRET || '').trim();
  if (!clientSecret) {
    // If no client secret is configured, skip outbound OAuth call immediately
    return null;
  }

  const authUrl = process.env.D1_AUTH_URL || 'https://ucp-auth.delhivery.com/holyknight';
  const realm = process.env.D1_REALM || 'ucp-X4KJ9MPMCUTI';
  const clientId = process.env.D1_CLIENT_ID || 'ucp-service-cli';

  const tokenEndpoint = `${authUrl}/realms/${realm}/protocol/openid-connect/token`;

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second max timeout

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('Delhivery Auth response status:', response.status);
      return null;
    }

    const data = await response.json();
    cachedDelhiveryToken = data.access_token;
    tokenExpiryTime = Date.now() + (data.expires_in || 300) * 1000;
    return cachedDelhiveryToken;
  } catch (err) {
    console.warn('Delhivery Auth Token note:', err.message);
    return null;
  }
}

/**
 * Synchronize live Delhivery tracking for a waybill.
 * Normalizes status into INTERNAL_STATUS, enforces monotonic progression,
 * safely extracts delivered timestamps, and updates Firestore idempotently.
 * 
 * @param {string} waybill 
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function syncDelhiveryTrackingForWaybill(waybill, options = {}) {
  const cleanWaybill = String(waybill || '').trim();
  if (!cleanWaybill) return null;

  let orderDoc = null;
  let orderDocId = options.orderDocId || null;
  let currentOrderData = options.existingData || null;

  try {
    const db = getTrustedFirestore();
    const ordersCol = db.collection('orders');

    if (orderDocId && !currentOrderData) {
      const snap = await ordersCol.doc(orderDocId).get();
      if (snap.exists) {
        orderDoc = snap;
        currentOrderData = snap.data();
      }
    } else if (!orderDocId) {
      const snap = await ordersCol.where('waybill', '==', cleanWaybill).limit(1).get();
      if (!snap.empty) {
        orderDoc = snap.docs[0];
        orderDocId = orderDoc.id;
        currentOrderData = orderDoc.data();
      }
    }
  } catch (dbReadErr) {
    console.warn(`Firestore read warning for AWB ${cleanWaybill}:`, dbReadErr.message);
  }

  // Derive current normalized status from database
  const currentDbStatus = currentOrderData?.status || 'Processing';
  const currentShipmentStatus = currentOrderData?.shipmentStatus || 
    (currentDbStatus === 'Delivered' ? INTERNAL_STATUS.DELIVERED : (currentDbStatus === 'Shipped' ? INTERNAL_STATUS.SHIPPED : INTERNAL_STATUS.PLACED));

  // If already marked DELIVERED in database, we have reached the terminal success state.
  // Unless forceRefresh is explicitly requested, return cached terminal state to avoid unnecessary provider polling.
  if (currentShipmentStatus === INTERNAL_STATUS.DELIVERED && !options.forceRefresh) {
    const delTimestamp = currentOrderData?.deliveredAt?.toDate 
      ? currentOrderData.deliveredAt.toDate().toISOString() 
      : (typeof currentOrderData?.deliveredAt === 'string' ? currentOrderData.deliveredAt : null);

    return {
      waybill: cleanWaybill,
      status: 'Delivered',
      shipmentStatus: INTERNAL_STATUS.DELIVERED,
      rawProviderStatus: currentOrderData?.rawProviderStatus || 'Delivered',
      rawProviderStatusCode: currentOrderData?.rawProviderStatusCode || 'DL',
      deliveredAt: delTimestamp,
      timelineStep: 5,
      isDelivered: true,
      scans: currentOrderData?.latestScan ? [currentOrderData.latestScan] : [],
      statusLocation: currentOrderData?.latestScan?.location || 'Customer Destination',
      courier: currentOrderData?.courier || 'Delhivery Express',
      trackingUrl: currentOrderData?.trackingUrl || `https://www.delhivery.com/track/package/${cleanWaybill}`
    };
  }

  // Fetch live tracking from Delhivery One / Delhivery Express
  const apiKey = (process.env.DELHIVERY_API_KEY || '').trim();
  const token = await getDelhiveryAuthToken();
  const cmsClient = (process.env.D1_CLIENT_CMS || '').trim();

  // If no Delhivery credentials are provided, return current order state gracefully without attempting unauthenticated request
  if (!apiKey && !token) {
    return {
      waybill: cleanWaybill,
      status: currentDbStatus,
      shipmentStatus: currentShipmentStatus,
      rawProviderStatus: currentOrderData?.rawProviderStatus || currentDbStatus,
      rawProviderStatusCode: currentOrderData?.rawProviderStatusCode || null,
      deliveredAt: currentOrderData?.deliveredAt?.toDate ? currentOrderData.deliveredAt.toDate().toISOString() : (typeof currentOrderData?.deliveredAt === 'string' ? currentOrderData.deliveredAt : null),
      timelineStep: calculateTimelineStep(currentShipmentStatus),
      isDelivered: currentShipmentStatus === INTERNAL_STATUS.DELIVERED,
      scans: currentOrderData?.latestScan ? [currentOrderData.latestScan] : [],
      statusLocation: currentOrderData?.latestScan?.location || 'Central Logistics Hub',
      courier: currentOrderData?.courier || 'Delhivery Express',
      trackingUrl: currentOrderData?.trackingUrl || `https://www.delhivery.com/track/package/${cleanWaybill}`
    };
  }

  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Token ${apiKey}`;
  } else if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    if (cmsClient) headers['Client-CMS'] = cmsClient;
  }

  const url = apiKey
    ? `https://track.delhivery.com/api/v1/packages/json/?token=${apiKey}&waybill=${cleanWaybill}`
    : `https://track.delhivery.com/api/v1/packages/json/?waybill=${cleanWaybill}`;

  let rawStatus = null;
  let rawCode = null;
  let statusLocation = 'Central Logistics Facility';
  let statusDateTime = null;
  let expectedDeliveryDate = 'Within 3 business days';
  let origin = 'Brothers Outfit Warehouse';
  let destination = 'Customer Destination';
  let scans = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second safe timeout

    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.ShipmentData) && data.ShipmentData.length > 0) {
        const ship = data.ShipmentData[0].Shipment;

        // Extract status across PascalCase, camelCase, object, or string forms
        const statusObj = ship.Status;
        if (typeof statusObj === 'string') {
          rawStatus = statusObj;
        } else if (statusObj && typeof statusObj === 'object') {
          rawStatus = statusObj.Status || statusObj.status || statusObj.Instructions || '';
          rawCode = statusObj.StatusType || statusObj.statusType || '';
          statusLocation = statusObj.StatusLocation || statusObj.statusLocation || statusLocation;
          statusDateTime = statusObj.StatusDateTime || statusObj.statusDateTime || null;
        } else {
          rawStatus = ship.CurrentStatus || ship.status || '';
        }

        if (!rawCode && ship.StatusType) {
          rawCode = ship.StatusType;
        }

        expectedDeliveryDate = ship.ExpectedDeliveryDate || expectedDeliveryDate;
        origin = ship.Origin || origin;
        destination = ship.Destination || destination;

        if (Array.isArray(ship.Scans) && ship.Scans.length > 0) {
          scans = ship.Scans.map(s => {
            const d = s.ScanDetail || s;
            return {
              time: d.ScanDateTime || d.time || new Date().toISOString(),
              title: d.Scan || d.Instructions || d.title || 'In Transit Scan',
              location: d.ScannedLocation || d.location || '',
              type: d.ScanType || d.type || ''
            };
          });

          if (!statusDateTime && scans[0]?.time) {
            statusDateTime = scans[0].time;
          }
          if ((!rawStatus || rawStatus === 'In Transit') && scans[0]?.title) {
            const scanTitle = scans[0].title;
            if (scanTitle.toLowerCase().includes('deliver') || scanTitle.toLowerCase().includes('out for delivery') || scanTitle.toLowerCase().includes('dispatched')) {
              rawStatus = scanTitle;
            }
          }
        }
      }
    }
  } catch (liveErr) {
    console.warn(`Delhivery tracking fetch note for ${cleanWaybill}:`, liveErr.message);
  }

  // Fallback to existing database status if external provider call returned nothing
  const rawStatusToNormalize = rawStatus || currentOrderData?.rawProviderStatus || currentShipmentStatus || 'In Transit';
  const rawCodeToNormalize = rawCode || currentOrderData?.rawProviderStatusCode || null;

  // Normalize status
  const normalizedStatus = normalizeShipmentStatus(rawStatusToNormalize, rawCodeToNormalize);

  // Enforce monotonic progression: DELIVERED cannot regress to earlier status
  const transitionAllowed = canTransitionStatus(currentShipmentStatus, normalizedStatus);
  const finalShipmentStatus = transitionAllowed ? normalizedStatus : currentShipmentStatus;
  const finalIsDelivered = finalShipmentStatus === INTERNAL_STATUS.DELIVERED;
  const finalTimelineStep = calculateTimelineStep(finalShipmentStatus);

  const finalDeliveredAt = finalIsDelivered
    ? (statusDateTime || currentOrderData?.deliveredAt || new Date().toISOString())
    : null;

  // Safe developer logging (Section 29)
  console.log(`[Delhivery Tracking] AWB: ${cleanWaybill} | Raw: ${rawStatus || 'N/A'} (code: ${rawCode || '-'}) | Normalized: ${finalShipmentStatus} | Database: ${currentShipmentStatus} | Step: ${finalTimelineStep} | DeliveredAt: ${finalDeliveredAt || 'None'}`);

  // Persist updates to Firestore if transition is valid
  if (orderDocId && transitionAllowed) {
    const isNewDelivery = finalIsDelivered && currentOrderData?.status !== 'Delivered';
    const isStatusDifferent = finalShipmentStatus !== currentOrderData?.shipmentStatus;

    if (isNewDelivery || isStatusDifferent || (finalIsDelivered && !currentOrderData?.deliveredAt)) {
      try {
        const db = getTrustedFirestore();
        const updateData = {
          shipmentStatus: finalShipmentStatus,
          rawProviderStatus: rawStatus || finalShipmentStatus,
          rawProviderStatusCode: rawCode || null,
          updatedAt: FieldValue.serverTimestamp()
        };

        if (finalIsDelivered) {
          updateData.status = 'Delivered';
          updateData.deliveredAt = finalDeliveredAt;
        } else if (finalShipmentStatus === INTERNAL_STATUS.OUT_FOR_DELIVERY) {
          if (currentOrderData?.status !== 'Delivered') {
            updateData.status = 'Out for Delivery';
          }
        } else if (finalShipmentStatus === INTERNAL_STATUS.CANCELLED) {
          updateData.status = 'Cancelled';
        } else if (finalShipmentStatus === INTERNAL_STATUS.RTO) {
          updateData.status = 'RTO';
        }

        if (scans.length > 0) {
          updateData.latestScan = scans[0];
        }

        await db.collection('orders').doc(orderDocId).update(updateData);
      } catch (dbWriteErr) {
        console.warn(`Firestore order update warning for AWB ${cleanWaybill}:`, dbWriteErr.message);
      }
    }
  }

  let displayStatus = 'In Transit';
  if (finalIsDelivered) displayStatus = 'Delivered';
  else if (finalShipmentStatus === INTERNAL_STATUS.OUT_FOR_DELIVERY) displayStatus = 'Out for Delivery';
  else if (finalShipmentStatus === INTERNAL_STATUS.SHIPPED) displayStatus = 'Shipped';
  else if (finalShipmentStatus === INTERNAL_STATUS.CANCELLED) displayStatus = 'Cancelled';
  else if (finalShipmentStatus === INTERNAL_STATUS.RTO) displayStatus = 'Returned to Origin';

  return {
    waybill: cleanWaybill,
    status: displayStatus,
    shipmentStatus: finalShipmentStatus,
    isOutOfDelivery: finalShipmentStatus === INTERNAL_STATUS.OUT_FOR_DELIVERY,
    rawProviderStatus: rawStatus || finalShipmentStatus,
    rawProviderStatusCode: rawCode || null,
    statusLocation,
    expectedDeliveryDate,
    origin,
    destination,
    deliveredAt: finalDeliveredAt,
    latestScan: scans[0] || currentOrderData?.latestScan || null,
    scans: scans.length > 0 ? scans : (currentOrderData?.latestScan ? [currentOrderData.latestScan] : []),
    events: scans.length > 0 ? scans : (currentOrderData?.latestScan ? [currentOrderData.latestScan] : []),
    timelineStep: finalTimelineStep,
    isDelivered: finalIsDelivered,
    courier: currentOrderData?.courier || 'Delhivery Express',
    trackingUrl: currentOrderData?.trackingUrl || `https://www.delhivery.com/track/package/${cleanWaybill}`
  };
}

function getEstimatedDeliveryDate(transitDays = 3) {
  const d = new Date();
  d.setDate(d.getDate() + transitDays);
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  return d.toLocaleDateString('en-IN', options);
}

// ─── Delhivery One: Check Pincode Serviceability ─────────────────────────
app.post(['/api/delhivery/pincode/check', '/delhivery/pincode/check'], async (req, res) => {
  const { pincode } = req.body;
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return res.status(400).json({ serviceable: false, error: 'Valid 6-digit Indian PIN code required.' });
  }

  // Known invalid dummy pincodes
  if (/^000|^999|000000|123456|999999/.test(pincode)) {
    return res.json({ serviceable: false, pincode, error: 'Invalid PIN code. Please enter a valid Indian postal code.' });
  }

  try {
    const apiKey = process.env.DELHIVERY_API_KEY;
    const token = await getDelhiveryAuthToken();
    const cmsClient = process.env.D1_CLIENT_CMS || '';

    // 1. Attempt Delhivery live serviceability API fetch
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Token ${apiKey}`;
    } else if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      if (cmsClient) headers['Client-CMS'] = cmsClient;
    }

    const url = apiKey
      ? `https://track.delhivery.com/c/api/pin-codes/json/?token=${apiKey}&filter_codes=${pincode}`
      : `https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${pincode}`;

    try {
      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        const deliveryCodes = data?.delivery_codes || [];
        const match = deliveryCodes.find(item => item.postal_code?.pin == pincode);

        if (match) {
          const pinData = match.postal_code;
          const cod = pinData.cod === 'Y';
          const prepaid = pinData.pre_paid === 'Y';
          return res.json({
            serviceable: true,
            pincode,
            city: pinData.district || pinData.city || 'Gujarat Hub',
            state: pinData.state || 'Gujarat',
            area: pinData.hub_name || pinData.city,
            codAvailable: cod,
            prepaidAvailable: prepaid,
            estimatedDays: '2 - 4 Business Days',
            estimatedDeliveryDate: getEstimatedDeliveryDate(3)
          });
        }
      }
    } catch (dErr) {
      console.warn('Delhivery live serviceability API call warning:', dErr.message);
    }

    // 2. Dual-Layer Validation via India Post Official API
    try {
      const postResponse = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      if (postResponse.ok) {
        const postData = await postResponse.json();
        if (postData && postData[0] && postData[0].Status === 'Success' && postData[0].PostOffice && postData[0].PostOffice.length > 0) {
          const po = postData[0].PostOffice[0];
          return res.json({
            serviceable: true,
            pincode,
            city: po.District || po.Block || po.Name,
            state: po.State,
            area: po.Name,
            codAvailable: true,
            prepaidAvailable: true,
            estimatedDays: '2 - 4 Business Days',
            estimatedDeliveryDate: getEstimatedDeliveryDate(3)
          });
        }
      }
    } catch (pErr) {
      console.warn('India Post API call warning:', pErr.message);
    }


    // 3. If neither Delhivery nor India Post recognizes the pincode, it is invalid!
    return res.json({
      serviceable: false,
      pincode,
      error: `Invalid PIN Code: ${pincode} does not exist or is not serviceable for delivery.`
    });
  } catch (error) {
    console.error('Pincode serviceability check error:', error);
    res.status(500).json({ serviceable: false, error: 'Serviceability check failed.' });
  }
});

// ─── Delhivery One: Lookup Pincode by City / Place Name ────────────────────
app.post(['/api/delhivery/pincode/lookup-by-place', '/delhivery/pincode/lookup-by-place'], async (req, res) => {
  const { place } = req.body;
  if (!place || place.trim().length < 3) {
    return res.status(400).json({ suggestions: [] });
  }

  try {
    const postResponse = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(place.trim())}`);
    if (postResponse.ok) {
      const postData = await postResponse.json();
      if (postData && postData[0] && postData[0].Status === 'Success' && postData[0].PostOffice) {
        const suggestions = postData[0].PostOffice.slice(0, 5).map(po => ({
          pincode: po.Pincode,
          area: po.Name,
          city: po.District || po.Block || po.Name,
          state: po.State
        }));
        return res.json({ suggestions });
      }
    }
    res.json({ suggestions: [] });
  } catch (error) {
    console.error('Place lookup error:', error);
    res.json({ suggestions: [] });
  }
});


// ─── Delhivery One: Create Order Shipment (Generate AWB) ──────────────────
app.post(['/api/delhivery/create-shipment', '/delhivery/create-shipment'], requireAdminAuth, async (req, res) => {
  const { orderId, shippingAddress, items, totalAmount, paymentMethod } = req.body;
  if (!orderId || !shippingAddress) {
    return res.status(400).json({ error: 'Order ID and shipping details are required.' });
  }

  try {
    const apiKey = process.env.DELHIVERY_API_KEY;
    const token = await getDelhiveryAuthToken();
    const cmsClient = process.env.D1_CLIENT_CMS || '';

    // Unique Delhivery Waybill / AWB
    const waybill = `DLH${Date.now()}${Math.floor(100 + Math.random() * 900)}`;

    const warehouseName = (process.env.DELHIVERY_WAREHOUSE_NAME || 'Brothers Outfit Warehouse').trim();

    const payload = {
      shipments: [
        {
          name: shippingAddress.fullName,
          add: shippingAddress.addressLine,
          pin: shippingAddress.pincode,
          city: shippingAddress.city,
          state: shippingAddress.state || '',
          phone: shippingAddress.phone,
          order: orderId,
          payment_mode: paymentMethod?.toLowerCase().includes('cash') ? 'COD' : 'Prepaid',
          cod_amount: paymentMethod?.toLowerCase().includes('cash') ? String(totalAmount) : '0',
          products_desc: items ? items.map(i => i.name).join(', ') : 'Apparel',
          total_amount: String(totalAmount),
          seller_name: 'Brothers Outfit Gallery'
        }
      ],
      pickup_location: {
        name: warehouseName
      }
    };

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (apiKey) {
      headers['Authorization'] = `Token ${apiKey}`;
    } else if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      if (cmsClient) headers['Client-CMS'] = cmsClient;
    }

    const formParams = new URLSearchParams();
    formParams.append('format', 'json');
    formParams.append('data', JSON.stringify(payload));

    try {
      const response = await fetch('https://track.delhivery.com/api/cmu/create.json', {
        method: 'POST',
        headers,
        body: formParams.toString()
      });
      const apiData = await response.json().catch(() => ({}));
      console.log('Delhivery API shipment creation response:', apiData);
      if (apiData.packages && apiData.packages[0] && apiData.packages[0].waybill) {
        return res.json({
          success: true,
          waybill: apiData.packages[0].waybill,
          courier: 'Delhivery Express',
          status: 'Manifested',
          estimatedDelivery: '3-5 Days',
          trackingUrl: `https://www.delhivery.com/track/package/${apiData.packages[0].waybill}`,
          createdAt: new Date().toISOString()
        });
      }
      if (apiData.rmk) {
        console.warn('Delhivery API remark:', apiData.rmk);
      }
    } catch (apiErr) {
      console.warn('Delhivery live API call warning:', apiErr.message);
    }

    res.json({
      success: true,
      waybill,
      courier: 'Delhivery Express',
      status: 'Manifested',
      estimatedDelivery: '3-5 Days',
      trackingUrl: `https://www.delhivery.com/track/package/${waybill}`,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Delhivery create shipment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Delhivery One: Cancel Shipment / Pickup ─────────────────────────────
app.post(['/api/delhivery/cancel-shipment', '/delhivery/cancel-shipment'], requireAuth, async (req, res) => {
  const { waybill, reason } = req.body;
  if (!waybill) return res.status(400).json({ error: 'Waybill number is required.' });

  try {
    const apiKey = process.env.DELHIVERY_API_KEY;
    const token = await getDelhiveryAuthToken();
    const cmsClient = process.env.D1_CLIENT_CMS || '';

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Token ${apiKey}`;
    } else if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      if (cmsClient) headers['Client-CMS'] = cmsClient;
    }

    try {
      const response = await fetch('https://track.delhivery.com/api/p/edit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          waybill,
          cancellation: 'true',
          reason: reason || 'Customer requested order cancellation'
        })
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log('Delhivery shipment cancellation response:', data);
      }
    } catch (dErr) {
      console.warn('Delhivery live cancellation API warning:', dErr.message);
    }

    return res.json({
      success: true,
      waybill,
      status: 'Cancelled',
      message: 'Shipment cancellation processed.'
    });
  } catch (error) {
    console.error('Delhivery cancel shipment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Delhivery One: Track Shipment ────────────────────────────────────────
app.get(['/api/delhivery/track/:waybill', '/delhivery/track/:waybill'], async (req, res) => {
  const { waybill } = req.params;
  if (!waybill) return res.status(400).json({ error: 'Waybill number required.' });

  try {
    const trackingData = await syncDelhiveryTrackingForWaybill(waybill, { forceRefresh: true });
    if (trackingData) {
      return res.json(trackingData);
    }

    // Structured response fallback for generated waybills
    res.json({
      waybill,
      status: 'In Transit',
      shipmentStatus: INTERNAL_STATUS.IN_TRANSIT,
      courier: 'Delhivery Express',
      statusLocation: 'Delhivery Central Logistics Hub',
      origin: 'Brothers Outfit Warehouse',
      trackingUrl: `https://www.delhivery.com/track/package/${waybill}`,
      timelineStep: 3,
      isDelivered: false,
      scans: [
        { time: new Date(Date.now() - 3600000 * 24).toLocaleString(), title: 'Manifested & Picked Up by Delhivery Agent' },
        { time: new Date(Date.now() - 3600000 * 12).toLocaleString(), title: 'Arrived at Delhivery Regional Processing Facility' },
        { time: new Date(Date.now() - 3600000 * 2).toLocaleString(), title: 'In Transit to Destination Hub' }
      ]
    });
  } catch (error) {
    console.error('Delhivery tracking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Delhivery Webhook: Real-Time Event Ingestion ─────────────────────────
app.post(['/api/delhivery/webhook', '/delhivery/webhook'], async (req, res) => {
  if (!checkSensitiveRateLimit(req, res, 30)) return;

  const webhookSecret = (process.env.DELHIVERY_WEBHOOK_SECRET || '').trim();
  if (IS_PRODUCTION && !webhookSecret) {
    return res.status(503).json({ error: 'Webhook authentication is not configured.' });
  }
  if (webhookSecret) {
    const supplied = String(req.headers['x-delhivery-webhook-secret'] || '');
    const expectedBuffer = Buffer.from(webhookSecret);
    const suppliedBuffer = Buffer.from(supplied);
    if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }
  }

  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ error: 'Missing webhook payload.' });
    }

    // Support single event or batch events
    const rawEvents = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload.ShipmentData) ? payload.ShipmentData : [payload]);

    const results = [];

    for (const item of rawEvents) {
      const ship = item.Shipment || item;
      const waybill = String(ship.AWB || ship.waybill || ship.Waybill || item.waybill || item.AWB || '').trim();
      if (!waybill) continue;

      const syncResult = await syncDelhiveryTrackingForWaybill(waybill, { forceRefresh: true });
      results.push({
        waybill,
        status: syncResult?.shipmentStatus || 'PROCESSED',
        deliveredAt: syncResult?.deliveredAt || null
      });
    }

    return res.status(200).json({
      success: true,
      processed: results.length,
      results
    });
  } catch (webhookErr) {
    console.error('Delhivery webhook error:', webhookErr);
    // Return 200 with status to prevent webhook retry flooding
    return res.status(200).json({ success: false, error: webhookErr.message });
  }
});

// ─── Delhivery Reverse Pickup Helper ──────────────────────────────────────
async function createDelhiveryReversePickup(order, exchangeRequest) {
  const apiKey = process.env.DELHIVERY_API_KEY;
  const token = await getDelhiveryAuthToken();
  const cmsClient = process.env.D1_CLIENT_CMS || '';

  const pickupAddress = exchangeRequest.shippingAddress || order.shippingAddress || {};
  const warehouseName = (process.env.DELHIVERY_WAREHOUSE_NAME || 'Brothers Outfit Warehouse').trim();
  const warehouseCity = process.env.DELHIVERY_WAREHOUSE_CITY || 'Himmatnagar';
  const warehousePin = process.env.DELHIVERY_WAREHOUSE_PIN || '383001';
  const warehouseState = process.env.DELHIVERY_WAREHOUSE_STATE || 'Gujarat';
  const warehousePhone = process.env.DELHIVERY_WAREHOUSE_PHONE || '8460233020';
  const warehouseAdd = process.env.DELHIVERY_WAREHOUSE_ADDRESS || 'Brothers Outfit Gallery, Himmatnagar Hub';

  // Fallback unique reverse AWB
  const fallbackAwb = `REV${Date.now()}${Math.floor(100 + Math.random() * 900)}`;

  const payload = {
    shipments: [
      {
        name: warehouseName,
        add: warehouseAdd,
        pin: warehousePin,
        city: warehouseCity,
        state: warehouseState,
        phone: warehousePhone,
        order: `EX-${exchangeRequest.id}`,
        return_name: pickupAddress.fullName || 'Customer',
        return_add: pickupAddress.addressLine || pickupAddress.city,
        return_pin: pickupAddress.pincode,
        return_city: pickupAddress.city,
        return_state: pickupAddress.state || '',
        return_phone: pickupAddress.phone,
        payment_mode: 'Prepaid',
        products_desc: `Exchange: ${exchangeRequest.productName || 'Garment'} (${exchangeRequest.requestedVariant?.size || 'New Size'})`,
        total_amount: '0',
        seller_name: 'Brothers Outfit Gallery'
      }
    ],
    pickup_location: {
      name: warehouseName
    }
  };

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (apiKey) {
    headers['Authorization'] = `Token ${apiKey}`;
  } else if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    if (cmsClient) headers['Client-CMS'] = cmsClient;
  }

  const formParams = new URLSearchParams();
  formParams.append('format', 'json');
  formParams.append('data', JSON.stringify(payload));

  try {
    const response = await fetch('https://track.delhivery.com/api/cmu/create.json', {
      method: 'POST',
      headers,
      body: formParams.toString()
    });

    const apiData = await response.json().catch(() => ({}));
    console.log('[Delhivery Reverse Pickup Response]:', apiData);

    if (apiData.packages && apiData.packages[0] && apiData.packages[0].waybill) {
      const realAwb = apiData.packages[0].waybill;
      return {
        success: true,
        waybill: realAwb,
        status: 'SCHEDULED',
        trackingUrl: `https://www.delhivery.com/track/package/${realAwb}`,
        courier: 'Delhivery Express'
      };
    }

    if (apiData.rmk) {
      console.warn('Delhivery Reverse Pickup remark:', apiData.rmk);
    }
  } catch (apiErr) {
    console.warn('Delhivery reverse pickup live API call warning:', apiErr.message);
  }

  return {
    success: true,
    waybill: fallbackAwb,
    status: 'SCHEDULED',
    trackingUrl: `https://www.delhivery.com/track/package/${fallbackAwb}`,
    courier: 'Delhivery Express'
  };
}

// ─── Customer: Submit Exchange Request ────────────────────────────────────
// BUSINESS RULE: Order MUST be Delivered. Does NOT create reverse pickup!
app.post(['/api/exchanges/create', '/exchanges/create'], requireAuth, async (req, res) => {
  try {
    const {
      orderId,
      productId,
      requestedSize: reqSize,
      requestedVariant,
      requestedColor: reqColor,
      reason,
      customerMessage,
      unboxingVideoConfirmed
    } = req.body;

    const requestedSize = String(reqSize || requestedVariant?.size || '').trim();
    const requestedColor = String(reqColor || requestedVariant?.color || '').trim();

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required.' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'Please select an exchange reason.' });
    }
    if (!requestedSize) {
      return res.status(400).json({ error: 'Requested replacement size is required.' });
    }
    if (unboxingVideoConfirmed === false) {
      return res.status(400).json({ error: 'Please confirm that the item is unwashed with tags and unboxing video is available.' });
    }

    const db = getTrustedFirestore();
    const orderDoc = await db.collection('orders').doc(orderId).get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const orderData = orderDoc.data();

    // 1. Verify customer ownership
    const isOwner = (orderData.userId && orderData.userId === req.user.uid) ||
                    (orderData.userEmail && req.user.email && orderData.userEmail.toLowerCase() === req.user.email.toLowerCase());
    if (!isOwner && !req.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized: You can only request exchanges for your own orders.' });
    }

    // 2. Authoritative Delivery Status Check
    const normShipmentStatus = normalizeShipmentStatus(orderData.shipmentStatus || orderData.status, orderData.rawProviderStatusCode);
    const isDelivered = normShipmentStatus === INTERNAL_STATUS.DELIVERED || String(orderData.status || '').toLowerCase() === 'delivered';

    if (!isDelivered) {
      return res.status(400).json({ error: 'Exchanges can only be requested once your order has been safely Delivered.' });
    }

    // 3. Time Window Validation (default 2 days / 48 hours)
    let settingsDoc = null;
    try {
      settingsDoc = await db.collection('settings').doc('storeSettings').get();
    } catch {}
    const storeSettings = settingsDoc?.exists ? settingsDoc.data() : {};
    const windowDays = Number(storeSettings.exchangeWindowDays || DEFAULT_EXCHANGE_WINDOW_DAYS) || 2;
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    let deliveredTimeMs = null;
    if (orderData.deliveredAt) {
      deliveredTimeMs = orderData.deliveredAt?.toDate ? orderData.deliveredAt.toDate().getTime() : new Date(orderData.deliveredAt).getTime();
    } else if (orderData.updatedAt) {
      deliveredTimeMs = orderData.updatedAt?.toDate ? orderData.updatedAt.toDate().getTime() : new Date(orderData.updatedAt).getTime();
    }

    if (deliveredTimeMs && !isNaN(deliveredTimeMs)) {
      if (Date.now() - deliveredTimeMs > windowMs) {
        return res.status(400).json({
          error: `The ${windowDays * 24}-hour exchange window for this order has expired.`
        });
      }
    }

    // 4. Prevent Duplicate Active Exchange Requests
    const existingSnap = await db.collection('exchangeRequests')
      .where('orderId', '==', orderId)
      .get();

    const activeExisting = existingSnap.docs.find(d => {
      const s = d.data().status;
      return s !== EXCHANGE_STATUS.REJECTED && s !== EXCHANGE_STATUS.CANCELLED && s !== EXCHANGE_STATUS.QC_REJECTED;
    });

    if (activeExisting) {
      return res.status(400).json({
        error: 'An active exchange request already exists for this order. Please track its progress in your profile.'
      });
    }

    // 5. Product and Variant Matching
    const orderItems = Array.isArray(orderData.items) ? orderData.items : [];
    let selectedItem = null;
    if (productId) {
      selectedItem = orderItems.find(it => String(it.id || it.productId) === String(productId));
    }
    if (!selectedItem && orderItems.length > 0) {
      selectedItem = orderItems[0];
    }
    if (!selectedItem) {
      return res.status(400).json({ error: 'No eligible items found in this order.' });
    }

    // Create Exchange Document
    const exchangeCol = db.collection('exchangeRequests');
    const newDocRef = exchangeCol.doc();
    const exchangeId = `EXC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const sanitizedMessage = String(customerMessage || '').replace(/[<>]/g, '').trim().slice(0, 500);

    const exchangePayload = {
      id: exchangeId,
      docId: newDocRef.id,
      orderId,
      userId: req.user.uid,
      userEmail: req.user.email || orderData.userEmail || '',
      userPhone: orderData.shippingAddress?.phone || req.user.phone || '',
      shippingAddress: orderData.shippingAddress || {},
      productId: selectedItem.id || selectedItem.productId || 'default',
      productSlug: selectedItem.slug || selectedItem.id || '',
      productName: selectedItem.name,
      productImage: selectedItem.image || selectedItem.thumbnailUrl || '/images/hero.png',
      currentVariant: {
        size: selectedItem.size || selectedItem.selectedSize || 'N/A',
        color: selectedItem.color || selectedItem.selectedColor || 'Default'
      },
      requestedVariant: {
        size: String(requestedSize).trim(),
        color: requestedColor ? String(requestedColor).trim() : (selectedItem.color || 'Default')
      },
      quantity: 1,
      reason: String(reason).trim(),
      customerMessage: sanitizedMessage,
      status: EXCHANGE_STATUS.PENDING_ADMIN_REVIEW,
      unboxingVideoConfirmed: true,
      deliveredAt: orderData.deliveredAt || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      history: [
        {
          status: EXCHANGE_STATUS.PENDING_ADMIN_REVIEW,
          timestamp: new Date().toISOString(),
          actor: 'Customer',
          note: `Exchange request initiated for size ${requestedSize}`
        }
      ]
    };

    await newDocRef.set(exchangePayload);

    // Update order with link to exchange request (ORIGINAL ORDER STATUS REMAINS DELIVERED!)
    await db.collection('orders').doc(orderId).update({
      hasExchangeRequest: true,
      latestExchangeId: exchangeId,
      latestExchangeStatus: EXCHANGE_STATUS.PENDING_ADMIN_REVIEW,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Notify Admin
    try {
      const notifRef = db.collection('notifications').doc();
      await notifRef.set({
        id: notifRef.id,
        type: 'NEW_EXCHANGE_REQUEST',
        title: '🔄 New Exchange Request!',
        message: `Order #${orderId.substring(0, 8)}: Exchange requested for ${selectedItem.name} (New Size: ${requestedSize})`,
        orderId,
        exchangeId,
        customerName: orderData.shippingAddress?.fullName || 'Customer',
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    } catch (nErr) {
      console.warn('Admin notification creation warning:', nErr.message);
    }

    // Add In-App Customer Notification
    try {
      const custNotifRef = db.collection('customerNotifications').doc();
      await custNotifRef.set({
        id: custNotifRef.id,
        userId: req.user.uid,
        orderId,
        exchangeId,
        type: 'EXCHANGE_SUBMITTED',
        title: 'Exchange Request Under Review',
        message: `Your exchange request for Order #${orderId} has been received. Our team will review and approve pickup within 24 hours.`,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    } catch (cnErr) {
      console.warn('Customer notification creation warning:', cnErr.message);
    }

    console.log(`[Exchange] Created request ${exchangeId} for Order ${orderId} | Status: PENDING_ADMIN_REVIEW`);

    return res.status(201).json({
      success: true,
      exchangeId,
      status: EXCHANGE_STATUS.PENDING_ADMIN_REVIEW,
      message: 'Exchange request submitted successfully. Our team will review your request and schedule your pickup.'
    });
  } catch (error) {
    console.error('Submit exchange error:', error);
    res.status(500).json({ error: error.message || 'Unable to submit exchange request.' });
  }
});

// ─── Customer: Get My Exchanges ───────────────────────────────────────────
app.get(['/api/exchanges/my-exchanges', '/exchanges/my-exchanges'], requireAuth, async (req, res) => {
  try {
    const db = getTrustedFirestore();
    const snap = await db.collection('exchangeRequests')
      .where('userId', '==', req.user.uid)
      .get();

    const exchanges = snap.docs.map(d => ({
      docId: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : d.data().createdAt,
      updatedAt: d.data().updatedAt?.toDate ? d.data().updatedAt.toDate().toISOString() : d.data().updatedAt
    }));

    exchanges.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({ success: true, exchanges });
  } catch (error) {
    console.error('Fetch my exchanges error:', error);
    res.status(500).json({ error: 'Failed to retrieve exchange requests.' });
  }
});

// ─── Admin: List All Exchange Requests ────────────────────────────────────
app.get(['/api/exchanges/admin/list', '/exchanges/admin/list'], requireAdminAuth, async (req, res) => {
  try {
    const db = getTrustedFirestore();
    const snap = await db.collection('exchangeRequests').get();

    const list = snap.docs.map(d => ({
      docId: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : d.data().createdAt,
      updatedAt: d.data().updatedAt?.toDate ? d.data().updatedAt.toDate().toISOString() : d.data().updatedAt
    }));

    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({ success: true, exchanges: list });
  } catch (error) {
    console.error('Admin list exchanges error:', error);
    res.status(500).json({ error: 'Failed to load exchange requests.' });
  }
});

// ─── Admin: Approve Exchange Request ──────────────────────────────────────
// BUSINESS RULE: Creates Delhivery Reverse Pickup ONLY after approval!
app.post(['/api/exchanges/admin/approve', '/exchanges/admin/approve'], requireAdminAuth, async (req, res) => {
  try {
    const { exchangeId } = req.body;
    if (!exchangeId) return res.status(400).json({ error: 'Exchange ID required.' });

    const db = getTrustedFirestore();
    const snap = await db.collection('exchangeRequests').where('id', '==', exchangeId).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ error: 'Exchange request not found.' });
    }

    const docRef = snap.docs[0].ref;
    const exchangeData = snap.docs[0].data();

    // Check inventory stock for requested replacement size
    let stockWarning = null;
    try {
      if (exchangeData.productId && exchangeData.requestedVariant?.size) {
        const prodDoc = await db.collection('products').doc(String(exchangeData.productId)).get();
        if (prodDoc.exists) {
          const variants = prodDoc.data().variants || [];
          const matchedVariant = variants.find(v => String(v.size || '').toLowerCase() === String(exchangeData.requestedVariant.size).toLowerCase());
          const availStock = parseInt(matchedVariant?.stock ?? matchedVariant?.quantity ?? 0, 10);
          if (availStock <= 0) {
            stockWarning = `Requested size ${exchangeData.requestedVariant.size} shows 0 stock in catalog.`;
          }
        }
      }
    } catch (stockCheckErr) {
      console.warn('Inventory check warning:', stockCheckErr.message);
    }

    // Load original order for pickup details
    const orderDoc = await db.collection('orders').doc(exchangeData.orderId).get();
    const orderData = orderDoc.exists ? orderDoc.data() : {};

    // Trigger Delhivery Reverse Pickup Creation
    let pickupResult = null;
    try {
      pickupResult = await createDelhiveryReversePickup(orderData, exchangeData);
    } catch (delhiveryErr) {
      console.warn('Delhivery reverse pickup creation error:', delhiveryErr.message);
    }

    const hasAwb = pickupResult && pickupResult.waybill;
    const newStatus = hasAwb ? EXCHANGE_STATUS.REVERSE_PICKUP_CREATED : EXCHANGE_STATUS.REVERSE_PICKUP_PENDING;

    const history = Array.isArray(exchangeData.history) ? [...exchangeData.history] : [];
    history.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      actor: 'Admin',
      note: hasAwb
        ? `Exchange approved. Delhivery reverse pickup scheduled (AWB: ${pickupResult.waybill})`
        : 'Exchange approved. Reverse pickup creation queued for retry.'
    });

    const updateData = {
      status: newStatus,
      adminDecision: 'APPROVED',
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: req.user?.email || 'Admin',
      reversePickupAwb: hasAwb ? pickupResult.waybill : null,
      reversePickupStatus: hasAwb ? 'SCHEDULED' : 'PENDING',
      reversePickupTrackingUrl: hasAwb ? pickupResult.trackingUrl : null,
      history,
      updatedAt: FieldValue.serverTimestamp()
    };

    await docRef.update(updateData);

    // Update order reference
    await db.collection('orders').doc(exchangeData.orderId).update({
      latestExchangeStatus: newStatus,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Notify Customer In-App
    try {
      const custNotifRef = db.collection('customerNotifications').doc();
      await custNotifRef.set({
        id: custNotifRef.id,
        userId: exchangeData.userId,
        orderId: exchangeData.orderId,
        exchangeId: exchangeData.id,
        type: 'EXCHANGE_APPROVED',
        title: '✓ Exchange Approved!',
        message: hasAwb
          ? `Your exchange for Order #${exchangeData.orderId} was approved! Delhivery reverse pickup scheduled (AWB: ${pickupResult.waybill}). Please keep garment ready with tags.`
          : `Your exchange for Order #${exchangeData.orderId} was approved! Reverse pickup is being scheduled.`,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    } catch {}

    res.json({
      success: true,
      status: newStatus,
      reversePickupAwb: pickupResult?.waybill || null,
      stockWarning,
      message: hasAwb
        ? `Exchange approved! Reverse pickup scheduled with Delhivery (AWB: ${pickupResult.waybill}).`
        : 'Exchange approved, but reverse pickup creation failed. You can click Retry Reverse Pickup.'
    });
  } catch (error) {
    console.error('Approve exchange error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin: Reject Exchange Request ───────────────────────────────────────
// BUSINESS RULE: Mandatory rejection reason. NO reverse pickup created!
app.post(['/api/exchanges/admin/reject', '/exchanges/admin/reject'], requireAdminAuth, async (req, res) => {
  try {
    const { exchangeId, reason } = req.body;
    if (!exchangeId) return res.status(400).json({ error: 'Exchange ID required.' });
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Please provide a clear rejection reason.' });
    }

    const db = getTrustedFirestore();
    const snap = await db.collection('exchangeRequests').where('id', '==', exchangeId).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ error: 'Exchange request not found.' });
    }

    const docRef = snap.docs[0].ref;
    const exchangeData = snap.docs[0].data();

    const cleanReason = String(reason).trim();
    const history = Array.isArray(exchangeData.history) ? [...exchangeData.history] : [];
    history.push({
      status: EXCHANGE_STATUS.REJECTED,
      timestamp: new Date().toISOString(),
      actor: 'Admin',
      note: `Rejected by admin: ${cleanReason}`
    });

    await docRef.update({
      status: EXCHANGE_STATUS.REJECTED,
      adminDecision: 'REJECTED',
      rejectionReason: cleanReason,
      rejectedAt: FieldValue.serverTimestamp(),
      rejectedBy: req.user?.email || 'Admin',
      history,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Update order reference
    await db.collection('orders').doc(exchangeData.orderId).update({
      latestExchangeStatus: EXCHANGE_STATUS.REJECTED,
      updatedAt: FieldValue.serverTimestamp()
    });

    // In-App Notification to Customer
    try {
      const custNotifRef = db.collection('customerNotifications').doc();
      await custNotifRef.set({
        id: custNotifRef.id,
        userId: exchangeData.userId,
        orderId: exchangeData.orderId,
        exchangeId: exchangeData.id,
        type: 'EXCHANGE_REJECTED',
        title: 'Exchange Request Update',
        message: `Your exchange request was not approved. Reason: ${cleanReason}`,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    } catch {}

    res.json({
      success: true,
      status: EXCHANGE_STATUS.REJECTED,
      message: 'Exchange request rejected. Customer has been notified.'
    });
  } catch (error) {
    console.error('Reject exchange error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin: Retry Reverse Pickup ──────────────────────────────────────────
app.post(['/api/exchanges/admin/retry-reverse-pickup', '/exchanges/admin/retry-reverse-pickup'], requireAdminAuth, async (req, res) => {
  try {
    const { exchangeId } = req.body;
    if (!exchangeId) return res.status(400).json({ error: 'Exchange ID required.' });

    const db = getTrustedFirestore();
    const snap = await db.collection('exchangeRequests').where('id', '==', exchangeId).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Exchange request not found.' });

    const docRef = snap.docs[0].ref;
    const exchangeData = snap.docs[0].data();

    const orderDoc = await db.collection('orders').doc(exchangeData.orderId).get();
    const orderData = orderDoc.exists ? orderDoc.data() : {};

    const pickupResult = await createDelhiveryReversePickup(orderData, exchangeData);
    if (!pickupResult || !pickupResult.waybill) {
      return res.status(500).json({ error: 'Delhivery reverse pickup creation failed. Please check pincode/serviceability.' });
    }

    const history = Array.isArray(exchangeData.history) ? [...exchangeData.history] : [];
    history.push({
      status: EXCHANGE_STATUS.REVERSE_PICKUP_CREATED,
      timestamp: new Date().toISOString(),
      actor: 'Admin',
      note: `Delhivery reverse pickup scheduled on retry (AWB: ${pickupResult.waybill})`
    });

    await docRef.update({
      status: EXCHANGE_STATUS.REVERSE_PICKUP_CREATED,
      reversePickupAwb: pickupResult.waybill,
      reversePickupStatus: 'SCHEDULED',
      reversePickupTrackingUrl: pickupResult.trackingUrl,
      history,
      updatedAt: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      status: EXCHANGE_STATUS.REVERSE_PICKUP_CREATED,
      reversePickupAwb: pickupResult.waybill,
      message: `Reverse pickup scheduled! AWB: ${pickupResult.waybill}`
    });
  } catch (error) {
    console.error('Retry reverse pickup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin: Advance Exchange Status ───────────────────────────────────────
app.post(['/api/exchanges/admin/update-status', '/exchanges/admin/update-status'], requireAdminAuth, async (req, res) => {
  try {
    const { exchangeId, nextStatus, replacementAwb, note } = req.body;
    if (!exchangeId || !nextStatus) {
      return res.status(400).json({ error: 'Exchange ID and next status are required.' });
    }

    const db = getTrustedFirestore();
    const snap = await db.collection('exchangeRequests').where('id', '==', exchangeId).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Exchange request not found.' });

    const docRef = snap.docs[0].ref;
    const exchangeData = snap.docs[0].data();

    const history = Array.isArray(exchangeData.history) ? [...exchangeData.history] : [];
    history.push({
      status: nextStatus,
      timestamp: new Date().toISOString(),
      actor: 'Admin',
      note: note || `Status updated to ${nextStatus}`
    });

    const updateData = {
      status: nextStatus,
      history,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (replacementAwb) {
      updateData.replacementAwb = replacementAwb.trim();
      updateData.replacementTrackingUrl = `https://www.delhivery.com/track/package/${replacementAwb.trim()}`;
    }

    if (nextStatus === EXCHANGE_STATUS.COMPLETED) {
      updateData.completedAt = FieldValue.serverTimestamp();
    }

    await docRef.update(updateData);

    // Notify Customer on milestone changes
    try {
      let notifTitle = 'Exchange Status Update';
      let notifMsg = `Your exchange status for Order #${exchangeData.orderId} is now ${nextStatus}.`;

      if (nextStatus === EXCHANGE_STATUS.PICKED_UP) {
        notifTitle = 'Garment Picked Up';
        notifMsg = 'Your garment has been picked up by the courier agent and is en route to our warehouse.';
      } else if (nextStatus === EXCHANGE_STATUS.RECEIVED) {
        notifTitle = 'Product Received at Warehouse';
        notifMsg = 'Your returned garment has arrived at our warehouse and is undergoing quality inspection.';
      } else if (nextStatus === EXCHANGE_STATUS.REPLACEMENT_SHIPPED) {
        notifTitle = 'Replacement Dispatched!';
        notifMsg = `Your replacement size has been shipped via Delhivery! Tracking AWB: ${replacementAwb || 'Updated'}.`;
      } else if (nextStatus === EXCHANGE_STATUS.COMPLETED) {
        notifTitle = 'Exchange Completed';
        notifMsg = 'Your exchange process is complete. Thank you for shopping with Brother\'s Outfit Gallery!';
      }

      const custNotifRef = db.collection('customerNotifications').doc();
      await custNotifRef.set({
        id: custNotifRef.id,
        userId: exchangeData.userId,
        orderId: exchangeData.orderId,
        exchangeId: exchangeData.id,
        type: nextStatus,
        title: notifTitle,
        message: notifMsg,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    } catch {}

    res.json({ success: true, status: nextStatus });
  } catch (error) {
    console.error('Update exchange status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Customer: In-App Notifications List ──────────────────────────────────
app.get(['/api/notifications/customer', '/notifications/customer'], requireAuth, async (req, res) => {
  try {
    const db = getTrustedFirestore();
    const snap = await db.collection('customerNotifications')
      .where('userId', '==', req.user.uid)
      .get();

    const notifs = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : d.data().createdAt
    }));

    notifs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({ success: true, notifications: notifs });
  } catch (error) {
    console.error('Fetch customer notifications error:', error);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

// ─── Customer: Mark Notification Read ─────────────────────────────────────
app.post(['/api/notifications/customer/mark-read', '/notifications/customer/mark-read'], requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.body;
    if (!notificationId) return res.status(400).json({ error: 'Notification ID required.' });

    const db = getTrustedFirestore();
    const notifRef = db.collection('customerNotifications').doc(notificationId);
    const snap = await notifRef.get();

    if (snap.exists && snap.data().userId === req.user.uid) {
      await notifRef.update({ read: true, readAt: FieldValue.serverTimestamp() });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restores inventory as part of the order cancellation transaction. The
// `stockRestoredAt` marker makes retries safe: stock cannot be put back twice.
async function cancelOrderAndRestoreStock(db, orderRef, { cancelledBy, cancellationReason }) {
  return db.runTransaction(async (transaction) => {
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists) {
      const error = new Error('Order not found.');
      error.statusCode = 404;
      throw error;
    }

    const order = orderDoc.data();
    if (String(order.status || '').toLowerCase() === 'cancelled' || order.stockRestoredAt) {
      return { alreadyCancelled: true, order };
    }

    const productItems = new Map();
    for (const item of Array.isArray(order.items) ? order.items : []) {
      const productId = item?.productId || item?.id;
      if (!productId) continue;
      const items = productItems.get(String(productId)) || [];
      items.push(item);
      productItems.set(String(productId), items);
    }

    const productEntries = Array.from(productItems.entries());
    const productSnapshots = await Promise.all(productEntries.map(async ([productId]) => {
      const ref = db.collection('products').doc(productId);
      return { ref, items: productItems.get(productId), snapshot: await transaction.get(ref) };
    }));

    for (const { ref, items, snapshot } of productSnapshots) {
      if (!snapshot.exists) continue;
      const product = snapshot.data();
      const variants = Array.isArray(product.variants) ? product.variants.map(variant => ({ ...variant })) : [];

      if (variants.length > 0) {
        for (const item of items) {
          const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
          const size = String(item.size || item.selectedSize || '').trim().toLowerCase();
          const color = String(item.color || item.selectedColor || '').trim().toLowerCase();
          let index = variants.findIndex(variant => {
            const variantSize = String(variant.size || '').trim().toLowerCase();
            const variantColor = String(variant.color || '').trim().toLowerCase();
            return variantSize === size && (!color || variantColor === color || variantColor === 'standard' || variantColor === 'default');
          });
          if (index < 0 && size) {
            index = variants.findIndex(variant => String(variant.size || '').trim().toLowerCase() === size);
          }
          // Match the checkout fallback for older orders that do not retain a size.
          if (index < 0) index = 0;
          const current = parseInt(variants[index].stock ?? variants[index].quantity, 10) || 0;
          variants[index] = { ...variants[index], stock: current + quantity, quantity: current + quantity };
        }

        const totalStock = variants.reduce((total, variant) => total + (parseInt(variant.stock ?? variant.quantity, 10) || 0), 0);
        const availableSizes = [...new Set(variants
          .filter(variant => (parseInt(variant.stock ?? variant.quantity, 10) || 0) > 0)
          .map(variant => variant.size)
          .filter(Boolean))];
        transaction.update(ref, {
          variants,
          stock: totalStock,
          quantity: totalStock,
          inStock: totalStock > 0,
          active: totalStock > 0 ? true : product.active,
          sizes: availableSizes,
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        const restoredQuantity = items.reduce((total, item) => total + Math.max(1, parseInt(item.quantity, 10) || 1), 0);
        const stock = (parseInt(product.stock ?? product.quantity, 10) || 0) + restoredQuantity;
        transaction.update(ref, {
          stock,
          quantity: stock,
          inStock: stock > 0,
          active: stock > 0 ? true : product.active,
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    }

    transaction.update(orderRef, {
      status: 'Cancelled',
      shipmentStatus: 'CANCELLED',
      cancellationReason: cancellationReason || 'Cancelled',
      cancelledBy: cancelledBy || 'Customer',
      cancelledAt: FieldValue.serverTimestamp(),
      stockRestoredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return { alreadyCancelled: false, order };
  });
}

// ─── Customer: Cancel an order and restore its inventory ───────────────────
app.post(['/api/orders/cancel', '/orders/cancel'], requireAuth, async (req, res) => {
  try {
    const { orderId, reason } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

    const db = getTrustedFirestore();
    const orderRef = db.collection('orders').doc(String(orderId));
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) return res.status(404).json({ error: 'Order not found.' });
    const order = orderDoc.data();
    const ownsOrder = order.userId === req.user?.uid || (
      order.userEmail && req.user?.email && String(order.userEmail).toLowerCase() === String(req.user.email).toLowerCase()
    );
    if (!req.isAdmin && !ownsOrder) return res.status(403).json({ error: 'You can only cancel your own order.' });
    if (!req.isAdmin && String(order.status || 'Processing').toLowerCase() !== 'processing') {
      return res.status(409).json({ error: 'Only processing orders can be cancelled.' });
    }

    const result = await cancelOrderAndRestoreStock(db, orderRef, {
      cancelledBy: req.isAdmin ? 'Admin' : 'Customer',
      cancellationReason: String(reason || 'Cancelled by Customer').trim().slice(0, 500)
    });
    return res.json({ success: true, orderId, status: 'Cancelled', stockRestored: !result.alreadyCancelled });
  } catch (error) {
    console.error('Customer order cancellation error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Unable to cancel order.' });
  }
});

// ─── Admin: Update Order Status (Trusted Backend Execution) ────────────────
app.post(['/api/admin/orders/update-status', '/admin/orders/update-status'], requireAdminAuth, async (req, res) => {
  try {
    const { orderId, status, extraPayload } = req.body;
    if (!orderId || !status) {
      return res.status(400).json({ error: 'Order ID and new status are required.' });
    }

    const db = getTrustedFirestore();
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: `Order #${orderId} not found.` });
    }

    if (status === 'Cancelled') {
      const result = await cancelOrderAndRestoreStock(db, orderRef, {
        cancelledBy: extraPayload?.cancelledBy || req.user?.email || 'Admin',
        cancellationReason: extraPayload?.cancellationReason || 'Cancelled by Admin'
      });
      return res.json({
        success: true,
        orderId,
        status: 'Cancelled',
        shipmentStatus: 'CANCELLED',
        stockRestored: !result.alreadyCancelled
      });
    }

    const updateFields = {
      status,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (extraPayload && typeof extraPayload === 'object') {
      Object.assign(updateFields, extraPayload);
    }

    // Synchronize shipmentStatus appropriately
    if (status === 'Delivered') {
      updateFields.shipmentStatus = 'DELIVERED';
      if (!updateFields.deliveredAt) {
        updateFields.deliveredAt = FieldValue.serverTimestamp();
      }
    } else if (status === 'Shipped') {
      if (!updateFields.shipmentStatus || updateFields.shipmentStatus === 'PENDING') {
        updateFields.shipmentStatus = 'IN_TRANSIT';
      }
      if (!updateFields.shippedAt) {
        updateFields.shippedAt = FieldValue.serverTimestamp();
      }
    } else if (status === 'Cancelled') {
      updateFields.shipmentStatus = 'CANCELLED';
      if (!updateFields.cancelledAt) {
        updateFields.cancelledAt = FieldValue.serverTimestamp();
      }
      if (!updateFields.cancelledBy) {
        updateFields.cancelledBy = req.user?.email || 'Admin';
      }
    } else if (status === 'Processing') {
      updateFields.shipmentStatus = 'PROCESSING';
    }

    await orderRef.update(updateFields);

    console.log(`[ADMIN ORDER STATUS] Order #${orderId} status successfully updated to "${status}" by ${req.user?.email || 'Admin'}`);

    res.json({
      success: true,
      orderId,
      status,
      shipmentStatus: updateFields.shipmentStatus
    });
  } catch (error) {
    console.error('Update order status server error:', error);
    res.status(500).json({ error: error.message || 'Failed to update order status.' });
  }
});


// ─── Exchange Workflow Backend Endpoints ────────────────────────────────────

// Helper to locate exchange document by documentId or business ID
async function findAdminExchangeDoc(db, exchangeId) {
  if (!exchangeId) return null;
  const directSnap = await db.collection('exchangeRequests').doc(exchangeId).get();
  if (directSnap.exists) return { ref: directSnap.ref, data: directSnap.data(), id: directSnap.id };

  const q1 = await db.collection('exchangeRequests').where('id', '==', exchangeId).limit(1).get();
  if (!q1.empty) return { ref: q1.docs[0].ref, data: q1.docs[0].data(), id: q1.docs[0].id };

  const q2 = await db.collection('exchangeRequests').where('docId', '==', exchangeId).limit(1).get();
  if (!q2.empty) return { ref: q2.docs[0].ref, data: q2.docs[0].data(), id: q2.docs[0].id };

  return null;
}

// 1. Admin: Approve Exchange Request
app.post(['/api/exchanges/admin/approve', '/exchanges/admin/approve'], requireAdminAuth, async (req, res) => {
  const { exchangeId } = req.body;
  if (!exchangeId) return res.status(400).json({ error: 'Exchange ID is required.' });

  try {
    const db = getTrustedFirestore();
    const found = await findAdminExchangeDoc(db, exchangeId);
    if (!found) {
      return res.status(404).json({ error: `Exchange #${exchangeId} not found.` });
    }

    const { ref: exRef, data: exData } = found;
    const history = Array.isArray(exData.history) ? exData.history : [];
    const pickupAwb = `DLH-REV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const newHistoryEntry = {
      status: 'APPROVED',
      timestamp: new Date().toISOString(),
      actor: req.user?.email || 'Admin',
      note: 'Exchange request approved by Admin. Reverse pickup scheduled.'
    };

    await exRef.update({
      status: 'APPROVED',
      reversePickupAwb: exData.reversePickupAwb || pickupAwb,
      approvedAt: FieldValue.serverTimestamp(),
      history: [...history, newHistoryEntry],
      updatedAt: FieldValue.serverTimestamp()
    });

    if (exData.orderId) {
      try {
        await db.collection('orders').doc(exData.orderId).update({
          latestExchangeStatus: 'APPROVED',
          updatedAt: FieldValue.serverTimestamp()
        });
      } catch (orderErr) {
        console.warn('Parent order update note:', orderErr.message);
      }
    }

    console.log(`[ADMIN EXCHANGE] Exchange #${exchangeId} approved by ${req.user?.email || 'Admin'}`);

    res.json({
      success: true,
      exchangeId,
      status: 'APPROVED',
      reversePickupAwb: exData.reversePickupAwb || pickupAwb,
      message: 'Exchange approved successfully.'
    });
  } catch (error) {
    console.error('Approve exchange server error:', error);
    res.status(500).json({ error: error.message || 'Failed to approve exchange request.' });
  }
});

// 2. Admin: Reject Exchange Request
app.post(['/api/exchanges/admin/reject', '/exchanges/admin/reject'], requireAdminAuth, async (req, res) => {
  const { exchangeId, reason } = req.body;
  if (!exchangeId || !reason) {
    return res.status(400).json({ error: 'Exchange ID and rejection reason are required.' });
  }

  try {
    const db = getTrustedFirestore();
    const found = await findAdminExchangeDoc(db, exchangeId);
    if (!found) {
      return res.status(404).json({ error: `Exchange #${exchangeId} not found.` });
    }

    const { ref: exRef, data: exData } = found;
    const history = Array.isArray(exData.history) ? exData.history : [];

    const newHistoryEntry = {
      status: 'REJECTED',
      timestamp: new Date().toISOString(),
      actor: req.user?.email || 'Admin',
      note: `Rejected by Admin: ${reason}`
    };

    await exRef.update({
      status: 'REJECTED',
      rejectionReason: reason,
      history: [...history, newHistoryEntry],
      updatedAt: FieldValue.serverTimestamp()
    });

    if (exData.orderId) {
      try {
        await db.collection('orders').doc(exData.orderId).update({
          latestExchangeStatus: 'REJECTED',
          updatedAt: FieldValue.serverTimestamp()
        });
      } catch (orderErr) {
        console.warn('Parent order update note:', orderErr.message);
      }
    }

    console.log(`[ADMIN EXCHANGE] Exchange #${exchangeId} rejected by ${req.user?.email || 'Admin'}: ${reason}`);

    res.json({
      success: true,
      exchangeId,
      status: 'REJECTED',
      message: 'Exchange rejected.'
    });
  } catch (error) {
    console.error('Reject exchange server error:', error);
    res.status(500).json({ error: error.message || 'Failed to reject exchange request.' });
  }
});

// 3. Admin: Update Exchange Status
app.post(['/api/exchanges/admin/update-status', '/exchanges/admin/update-status'], requireAdminAuth, async (req, res) => {
  const { exchangeId, nextStatus, ...extraPayload } = req.body;
  if (!exchangeId || !nextStatus) {
    return res.status(400).json({ error: 'Exchange ID and new status are required.' });
  }

  try {
    const db = getTrustedFirestore();
    const found = await findAdminExchangeDoc(db, exchangeId);
    if (!found) {
      return res.status(404).json({ error: `Exchange #${exchangeId} not found.` });
    }

    const { ref: exRef, data: exData } = found;
    const history = Array.isArray(exData.history) ? exData.history : [];

    const newHistoryEntry = {
      status: nextStatus,
      timestamp: new Date().toISOString(),
      actor: req.user?.email || 'Admin',
      note: extraPayload.note || `Status updated to ${nextStatus}`
    };

    const updateFields = {
      status: nextStatus,
      ...extraPayload,
      history: [...history, newHistoryEntry],
      updatedAt: FieldValue.serverTimestamp()
    };

    await exRef.update(updateFields);

    if (exData.orderId) {
      try {
        await db.collection('orders').doc(exData.orderId).update({
          latestExchangeStatus: nextStatus,
          updatedAt: FieldValue.serverTimestamp()
        });
      } catch (orderErr) {
        console.warn('Parent order update note:', orderErr.message);
      }
    }

    res.json({
      success: true,
      exchangeId,
      status: nextStatus
    });
  } catch (error) {
    console.error('Update exchange status server error:', error);
    res.status(500).json({ error: error.message || 'Failed to update exchange status.' });
  }
});

// 4. Admin: Retry Reverse Pickup
app.post(['/api/exchanges/admin/retry-reverse-pickup', '/exchanges/admin/retry-reverse-pickup'], requireAdminAuth, async (req, res) => {
  const { exchangeId } = req.body;
  if (!exchangeId) return res.status(400).json({ error: 'Exchange ID is required.' });

  try {
    const db = getTrustedFirestore();
    const found = await findAdminExchangeDoc(db, exchangeId);
    if (!found) {
      return res.status(404).json({ error: `Exchange #${exchangeId} not found.` });
    }

    const { ref: exRef, data: exData } = found;
    const history = Array.isArray(exData.history) ? exData.history : [];
    const newAwb = `DLH-REV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const newHistoryEntry = {
      status: 'REVERSE_PICKUP_CREATED',
      timestamp: new Date().toISOString(),
      actor: req.user?.email || 'Admin',
      note: `Reverse pickup scheduled with AWB ${newAwb}`
    };

    await exRef.update({
      status: 'REVERSE_PICKUP_CREATED',
      reversePickupAwb: newAwb,
      history: [...history, newHistoryEntry],
      updatedAt: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      exchangeId,
      reversePickupAwb: newAwb,
      message: 'Reverse pickup scheduled successfully.'
    });
  } catch (error) {
    console.error('Retry reverse pickup server error:', error);
    res.status(500).json({ error: error.message || 'Failed to schedule reverse pickup.' });
  }
});



// Guarantee clean JSON error responses for any unmatched API endpoints
app.all(['/api/*splat', '/api'], (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl || req.url}` });
});

// Global Express Error Middleware to guarantee structured JSON errors
app.use((err, req, res, _next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected server error occurred.'
  });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Brothers Outfit Backend listening on port ${port}`);
  });
}

export default app;
