import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createDatabase } from './database.js';
import { cleanupTempFiles, createUploadMiddleware, ensureRuntimeFolders, persistAsset } from './storage.js';
import {
  initializeCinetPayCheckout,
  isCinetPayConfigured,
  normalizeCinetPayWebhookPayload,
} from './payments/cinetpay.js';
import {
  initializeWaveCheckout,
  isWaveConfigured,
  normalizeWaveWebhookPayload,
  verifyWaveWebhook,
} from './payments/wave.js';
import { sendOrderConfirmationEmail } from './email.js';
import { generateReceiptPdf } from './pdf-receipt.js';
import { generateInvoicePdf } from './pdf-invoice.js';
import { buildVisitPayload } from './analytics.js';
import { extractVoiceData, isGroqConfigured } from './services/voice-llm.js';
import { suggestTheme } from './services/voice-theme.js';
import multer from 'multer';
import Groq from 'groq-sdk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serverPort = Number(process.env.SERVER_PORT ?? 4000);
const dataDir = path.resolve(rootDir, path.dirname(process.env.DATABASE_PATH ?? './data/cardtap.db'));
const databasePath = path.resolve(rootDir, process.env.DATABASE_PATH ?? './data/cardtap.db');
const uploadDir = path.resolve(rootDir, process.env.UPLOAD_DIR ?? './uploads');
const distDir = path.join(rootDir, 'dist');
const indexFile = path.join(distDir, 'index.html');
const publicCardBaseUrl = (process.env.PUBLIC_CARD_BASE_URL ?? 'https://tapal.geochifa.com/c').replace(/\/$/, '');

const adminTokenFromEnv = process.env.ADMIN_DASHBOARD_TOKEN?.trim();
const isProduction = process.env.NODE_ENV === 'production';
const adminToken = adminTokenFromEnv
  || (isProduction ? '' : 'tekko-admin-local');
if (isProduction && !adminToken) {
  console.error('FATAL: Set ADMIN_DASHBOARD_TOKEN when NODE_ENV=production.');
  process.exit(1);
}

const packageCatalog = {
  starter: {
    key: 'starter',
    name: 'Starter',
    price: 15000,
    quantity: 1,
    leadTime: '72h',
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    price: 22500,
    quantity: 1,
    leadTime: '48h',
  },
  business: {
    key: 'business',
    name: 'Business',
    price: 150000,
    quantity: 5,
    leadTime: '5 days',
  },
};

function createSlug(input) {
  return String(input ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolvePackage(packageKey) {
  return packageCatalog[packageKey] ?? packageCatalog.pro;
}

function buildPublicCardUrl(slug) {
  return `${publicCardBaseUrl}/${slug}`;
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Hide portal token from admin API responses (not from customer checkout/create). */
function orderWithoutPortalToken(order) {
  if (!order) return null;
  const { portalToken: _omit, ...rest } = order;
  return rest;
}

function escapeHtmlAttr(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildPaymentSuccessUrl(publicUrl, order) {
  const base = (publicUrl || 'https://tapal.geochifa.com').replace(/\/$/, '');
  let url = `${base}/payment/success?orderId=${encodeURIComponent(order.orderId)}`;
  if (order.portalToken) {
    url += `&portalToken=${encodeURIComponent(order.portalToken)}`;
  }
  return url;
}

function requireAdmin(request, response, next) {
  const providedToken = request.header('x-admin-token');

  if (!providedToken || !safeEqual(providedToken, adminToken)) {
    response.status(401).json({ error: 'Unauthorized admin access.' });
    return;
  }

  next();
}

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

ensureRuntimeFolders({ uploadDir, dataDir });

const database = createDatabase({ databasePath });
const upload = createUploadMiddleware(uploadDir);
const app = express();
app.set('trust proxy', 1); // trust first proxy (Caddy)

app.use(helmet({
  contentSecurityPolicy: false,  // CSP handled by Caddy or fine-tuned later
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = [
  'https://tapal.geochifa.com',
  'https://saytutekko.geochifa.com',
  'https://tekko.geochifa.com',
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:4000');
}
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez plus tard.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez plus tard.' },
});
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de commandes en peu de temps. Réessayez dans quelques minutes.' },
});
const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de vérifications de coupons. Réessayez plus tard.' },
});
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes vocales. Réessayez dans une minute.' },
});
app.use('/api/', apiLimiter);

app.use(express.json({
  limit: '2mb',
  verify(req, _res, buf) {
    if (req.url.includes('/webhook')) {
      req.rawBody = buf.toString();
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/uploads', express.static(uploadDir, {
  setHeaders(res) {
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    paymentConfigured: isWaveConfigured() || isCinetPayConfigured(),
    adminConfigured: Boolean(process.env.ADMIN_DASHBOARD_TOKEN),
    voiceConfigured: isGroqConfigured(),
  });
});

app.post('/api/admin/login', authLimiter, (request, response) => {
  const { email, password } = request.body ?? {};
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return response.status(503).json({ error: 'Admin login not configured on server.' });
  }

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !safeEqual(email.trim(), adminEmail) ||
    !safeEqual(password, adminPassword)
  ) {
    return response.status(401).json({ error: 'Invalid credentials.' });
  }

  return response.json({ token: adminToken });
});

app.get('/api/cards/:slug', (request, response) => {
  const order = database.getOrderBySlug(request.params.slug);

  if (!order) {
    response.status(404).json({ error: 'Card not found.' });
    return;
  }

  // Card is only publicly accessible if payment is confirmed,
  // or within a 2-hour preview window after order creation.
  if (order.paymentStatus !== 'paid') {
    const createdMs = new Date(order.createdAt).getTime();
    const nowMs = Date.now();
    const PREVIEW_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
    if (nowMs - createdMs > PREVIEW_WINDOW_MS) {
      response.status(403).json({ error: 'expired_preview' });
      return;
    }
  }

  response.json({
    card: {
      slug: order.slug,
      finalCardUrl: order.finalCardUrl,
      profile: order.profile,
      customization: order.customization,
      assets: order.assets,
      packageSelection: order.packageSelection,
    },
  });
});

app.post(
  '/api/orders',
  orderLimiter,
  upload.fields([
    { name: 'avatarFile', maxCount: 1 },
    { name: 'artworkFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
    { name: 'logoFile', maxCount: 1 },
    { name: 'customRefFile', maxCount: 1 },
  ]),
  asyncRoute(async (request, response) => {
    let payload;
    try {
      payload = JSON.parse(request.body.payload ?? '{}');
    } catch {
      return response.status(400).json({ error: 'Invalid order payload JSON.' });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return response.status(400).json({ error: 'Order payload must be a JSON object.' });
    }
    const packageSelection = resolvePackage(payload.packageSelection?.key ?? payload.packageKey);
    const orderId = randomUUID();
    const firstName = createSlug((payload.profile?.fullName ?? '').split(' ')[0]) || 'card';
    const token = randomBytes(6).toString('hex'); // 12 hex chars, 281T combinations
    const desiredSlug = `${firstName}-${token}`;
    const uniqueSlug = database.ensureUniqueSlug(desiredSlug);
    const finalCardUrl = buildPublicCardUrl(uniqueSlug);
    const assetsPayload = payload.assets ?? {};

    try {
    const savedAvatar = await persistAsset({
      orderId,
      assetKey: 'avatar',
      asset: assetsPayload.avatar,
      file: request.files?.avatarFile?.[0],
      uploadDir,
    });

    const savedArtwork = await persistAsset({
      orderId,
      assetKey: 'artwork',
      asset: assetsPayload.artwork,
      file: request.files?.artworkFile?.[0],
      uploadDir,
    });

    const savedCustomRef = request.files?.customRefFile?.[0]
      ? await persistAsset({
          orderId,
          assetKey: 'customRef',
          asset: null,
          file: request.files.customRefFile[0],
          uploadDir,
        })
      : null;

    const savedCover = request.files?.coverFile?.[0]
      ? await persistAsset({
          orderId,
          assetKey: 'cover',
          asset: null,
          file: request.files.coverFile[0],
          uploadDir,
        })
      : (payload.assets?.cover?.remoteUrl
          ? { sourceType: 'url', remoteUrl: payload.assets.cover.remoteUrl, storedUrl: null }
          : null);

    const savedLogo = request.files?.logoFile?.[0]
      ? await persistAsset({
          orderId,
          assetKey: 'logo',
          asset: null,
          file: request.files.logoFile[0],
          uploadDir,
        })
      : (payload.assets?.logo?.remoteUrl
          ? { sourceType: 'url', remoteUrl: payload.assets.logo.remoteUrl, storedUrl: null }
          : null);

    const now = new Date().toISOString();
    const order = database.createOrder({
      orderId,
      slug: uniqueSlug,
      customerName: payload.orderContact?.name ?? payload.profile?.fullName ?? 'TEKKO Customer',
      customerEmail: payload.orderContact?.email ?? payload.profile?.email ?? '',
      customerPhone: payload.orderContact?.phone ?? payload.profile?.phone ?? '',
      packKey: packageSelection.key,
      packPrice: packageSelection.price,
      currency: 'XOF',
      profile: {
        ...(payload.profile ?? {}),
        slug: uniqueSlug,
        ...(payload.businessCards ? { businessCards: payload.businessCards } : {}),
      },
      customization: {
        ...(payload.customization ?? {}),
        publicCardUrl: finalCardUrl,
      },
      orderContact: payload.orderContact ?? {},
      assets: {
        avatar: savedAvatar,
        artwork: savedArtwork,
        ...(savedCover ? { cover: savedCover } : {}),
        ...(savedLogo ? { logo: savedLogo } : {}),
        ...(savedCustomRef ? { customRef: savedCustomRef } : {}),
      },
      packageSelection,
      finalCardUrl,
      orderStatus: 'submitted',
      paymentProvider: isWaveConfigured() ? 'wave' : 'cinetpay',
      paymentStatus: 'pending',
      paymentReference: null,
      paymentUrl: null,
      paymentPayload: null,
      adminNotes: '',
      deliveryNotes: payload.orderContact?.deliveryNotes ?? '',
      couponCode: payload.couponCode ?? null,
      discountAmount: payload.discountAmount ?? 0,
      portalToken: randomBytes(32).toString('hex'),
      createdAt: now,
      updatedAt: now,
    });

    response.status(201).json({ order });
    } finally {
      cleanupTempFiles(request.files);
    }
  }),
);

app.post(
  '/api/orders/:orderId/checkout',
  asyncRoute(async (request, response) => {
    const order = database.getOrderById(request.params.orderId);

    if (!order) {
      response.status(404).json({ error: 'Order not found.' });
      return;
    }

    // ── Server-side price computation (ignore client totalPrice) ──
    const packInfo = packageCatalog[order.packKey] ?? packageCatalog.pro;
    const customization = order.customization ?? {};
    const materialAdds = { 'Brushed metal': 20000 };
    const foilAdds = { 'Gold foil': 5000, 'Silver foil': 5000, 'Copper foil': 5000 };
    let totalPrice = packInfo.price
      + (materialAdds[customization.material] ?? 0)
      + (foilAdds[customization.foil] ?? 0);

    // Apply coupon discount server-side
    if (order.couponCode) {
      const coupon = database.getCoupon(order.couponCode);
      if (coupon && coupon.active && (coupon.maxUses === 0 || coupon.usedCount < coupon.maxUses)) {
        if (coupon.discountType === 'percent') {
          totalPrice -= Math.round(totalPrice * coupon.discountValue / 100);
        } else {
          totalPrice -= Math.min(coupon.discountValue, totalPrice);
        }
      }
    }

    // Add domain surcharge if applicable
    const domainSurcharge = Number(customization.domainUserShareFcfa) || 0;
    if (domainSurcharge > 0) totalPrice += domainSurcharge;

    if (totalPrice < 100) totalPrice = packInfo.price; // safety floor

    // Try Wave first
    if (isWaveConfigured()) {
      const publicUrl = process.env.SERVER_PUBLIC_URL || 'https://tapal.geochifa.com';
      const overrideSuccessUrl = buildPaymentSuccessUrl(publicUrl, order);
      const wave = await initializeWaveCheckout({ order, totalPrice, overrideSuccessUrl });
      if (wave.configured && !wave.error) {
        const updatedOrder = database.updatePayment({
          orderId: order.orderId,
          paymentStatus: 'pending',
          paymentReference: wave.checkoutId,
          paymentUrl: wave.paymentUrl,
          paymentPayload: wave.raw,
        });
        return response.json({
          paymentConfigured: true,
          paymentUrl: wave.paymentUrl,
          transactionId: wave.transactionId,
          order: updatedOrder,
        });
      }
      if (wave.error) {
        console.error('[Checkout] Wave error, trying CinetPay fallback:', wave.error);
      }
    }

    // Fallback to CinetPay
    const checkout = await initializeCinetPayCheckout({ order });

    if (!checkout.configured) {
      response.json({
        paymentConfigured: false,
        reason: checkout.reason ?? 'No payment provider configured.',
      });
      return;
    }

    const updatedOrder = database.updatePayment({
      orderId: order.orderId,
      paymentStatus: 'pending',
      paymentReference: checkout.transactionId,
      paymentUrl: checkout.paymentUrl,
      paymentPayload: checkout.raw,
    });

    response.json({
      paymentConfigured: true,
      paymentUrl: checkout.paymentUrl,
      transactionId: checkout.transactionId,
      order: updatedOrder,
    });
  }),
);

// ── CLÉ EN MAIN — WhatsApp order (no upfront payment) ──────────────
app.post(
  '/api/cle-en-main',
  orderLimiter,
  asyncRoute(async (request, response) => {
    const body = request.body ?? {};
    const name = String(body.name ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    if (!name || !phone) {
      return response.status(400).json({ error: 'Nom et WhatsApp requis.' });
    }

    const orderId = randomUUID();
    const baseSlug = createSlug(name) || `cle-${Date.now()}`;
    const uniqueSlug = database.ensureUniqueSlug(baseSlug);
    const finalCardUrl = buildPublicCardUrl(uniqueSlug);

    const packKey = String(body.packKey ?? 'pro');
    const packInfo = resolvePackage(packKey);
    const qty = Math.max(1, Math.min(999, parseInt(body.quantity ?? 1, 10) || 1));

    // Per-card price = pack price / pack included quantity (e.g. Business: 60000/5 = 12000/card)
    const perCardPrice = Math.round(packInfo.price / (packInfo.quantity ?? 1));

    // Volume pricing (same tiers as frontend)
    let totalPrice = perCardPrice * qty;
    if (qty >= 10) totalPrice = Math.round(totalPrice * 0.70);
    else if (qty >= 5) totalPrice = Math.round(totalPrice * 0.80);
    else if (qty >= 3) totalPrice = Math.round(totalPrice * 0.90);

    const now = new Date().toISOString();
    const order = database.createOrder({
      orderId,
      slug: uniqueSlug,
      customerName: name,
      customerEmail: '',
      customerPhone: phone,
      packKey,
      packPrice: totalPrice,
      currency: 'XOF',
      profile: { fullName: name, phone },
      customization: {},
      orderContact: { deliveryCity: String(body.city ?? '').trim() },
      assets: {},
      packageSelection: packInfo,
      finalCardUrl,
      orderStatus: 'submitted',
      paymentProvider: 'whatsapp',
      paymentStatus: 'whatsapp_pending',
      paymentReference: null,
      paymentUrl: null,
      paymentPayload: null,
      adminNotes: '',
      deliveryNotes: '',
      couponCode: null,
      discountAmount: 0,
      portalToken: null,
      source: 'cle_en_main',
      description: String(body.description ?? '').trim(),
      quantity: qty,
      createdAt: now,
      updatedAt: now,
    });

    response.status(201).json({ orderId: order.orderId });
  }),
);

// ── PDF RECEIPT DOWNLOAD ────────────────────────────────────────────
app.get(
  '/api/orders/:orderId/receipt.pdf',
  asyncRoute(async (request, response) => {
    const order = database.getOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ error: 'Order not found.' });
    }
    if (order.paymentStatus !== 'paid') {
      return response.status(403).json({ error: 'Receipt available only for paid orders.' });
    }

    const totalPrice = order.packPrice - (order.discountAmount ?? 0);
    const pdfBuffer = await generateReceiptPdf({ order, totalPrice });
    const filename = `recu-tekko-${(order.orderId ?? '').slice(0, 8).toUpperCase()}.pdf`;

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Content-Length', pdfBuffer.length);
    response.send(pdfBuffer);
  }),
);

// ── VERIFY PAYMENT (called from success page as webhook fallback) ──
app.post(
  '/api/orders/:orderId/verify-payment',
  asyncRoute(async (request, response) => {
    const order = database.getOrderById(request.params.orderId);
    if (!order) {
      console.log('[VerifyPayment] Order not found:', request.params.orderId);
      return response.status(404).json({ error: 'Order not found.' });
    }

    console.log(`[VerifyPayment] orderId=${order.orderId} current=${order.paymentStatus} ref=${order.paymentReference}`);

    // Already paid – return immediately
    if (order.paymentStatus === 'paid') {
      return response.json({ paymentStatus: 'paid', finalCardUrl: order.finalCardUrl });
    }

    // Try to verify with Wave API if we have a checkout id
    const checkoutId = order.paymentReference;
    if (checkoutId && isWaveConfigured()) {
      try {
        const waveUrl = `https://api.wave.com/v1/checkout/sessions/${checkoutId}`;
        console.log('[VerifyPayment] Checking Wave:', waveUrl);
        const waveRes = await fetch(waveUrl, {
          headers: { Authorization: `Bearer ${process.env.WAVE_API_KEY}` },
        });
        console.log('[VerifyPayment] Wave response status:', waveRes.status);
        if (waveRes.ok) {
          const session = await waveRes.json();
          console.log('[VerifyPayment] Wave session payment_status:', session.payment_status);
          if (session.payment_status === 'succeeded') {
            database.updatePayment({
              orderId: order.orderId,
              paymentStatus: 'paid',
              paymentReference: checkoutId,
              paymentUrl: order.paymentUrl,
              paymentPayload: session,
            });
            // Mark coupon as used now that payment succeeded
            if (order.couponCode) {
              try { database.useCoupon(order.couponCode); } catch { /* ignore */ }
            }
            const totalPrice = order.packPrice - (order.discountAmount ?? 0);
            sendOrderConfirmationEmail({ order, totalPrice }).catch((err) =>
              console.error('[VerifyPayment] Email error:', err.message),
            );
            console.log('[VerifyPayment] Marked PAID for orderId:', order.orderId);
            return response.json({ paymentStatus: 'paid', finalCardUrl: order.finalCardUrl });
          }
        } else {
          const errBody = await waveRes.text();
          console.error('[VerifyPayment] Wave API error response:', waveRes.status, errBody);
        }
      } catch (err) {
        console.error('[VerifyPayment] Wave API error:', err.message);
      }
    } else {
      console.log('[VerifyPayment] Skipped Wave check: checkoutId=', checkoutId, 'waveConfigured=', isWaveConfigured());
    }

    return response.json({ paymentStatus: order.paymentStatus, finalCardUrl: order.finalCardUrl });
  }),
);

// ── ORDER PORTAL (signed link via portal_token on the order) ───────
app.get(
  '/api/orders/:orderId/portal',
  asyncRoute(async (request, response) => {
    const token = typeof request.query.token === 'string' ? request.query.token : '';
    const order = database.getOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ error: 'Order not found.' });
    }
    if (!order.portalToken || !safeEqual(order.portalToken, token)) {
      return response.status(403).json({ error: "Lien d'acces invalide ou expire." });
    }
    response.json({
      orderId: order.orderId,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      finalCardUrl: order.finalCardUrl,
      paymentUrl: order.paymentUrl,
      slug: order.slug,
      customerName: order.customerName,
      packName: order.packageSelection?.name ?? order.packKey,
    });
  }),
);

app.get(
  '/api/orders/:orderId/card-analytics',
  asyncRoute(async (request, response) => {
    const token = typeof request.query.token === 'string' ? request.query.token : '';
    const daysRaw = Number(request.query.days ?? 30);
    const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 30, 1), 366);
    const order = database.getOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ error: 'Order not found.' });
    }
    if (!order.portalToken || !safeEqual(order.portalToken, token)) {
      return response.status(403).json({ error: "Lien d'acces invalide ou expire." });
    }
    if (order.paymentStatus !== 'paid') {
      return response.status(403).json({ error: 'Statistiques disponibles apres confirmation du paiement.' });
    }
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const stats = database.getVisitStatsForSlug({ slug: order.slug, since });
    response.json({ periodDays: days, slug: order.slug, ...stats });
  }),
);

app.post(
  '/api/payments/cinetpay/webhook',  asyncRoute(async (request, response) => {
    console.log('[CinetPay Webhook] Received:', JSON.stringify(request.body).slice(0, 500));
    const { paymentReference, paymentStatus, payload } = normalizeCinetPayWebhookPayload(request.body);

    if (!paymentReference) {
      response.status(400).json({ error: 'Payment reference is missing.' });
      return;
    }

    // Verify with CinetPay API before trusting the webhook
    if (paymentStatus === 'paid') {
      const cinetPayApiKey = process.env.CINETPAY_API_KEY;
      const cinetPaySiteId = process.env.CINETPAY_SITE_ID;
      if (cinetPayApiKey && cinetPaySiteId) {
        try {
          const verifyRes = await fetch('https://api-checkout.cinetpay.com/v2/payment/check/trans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apikey: cinetPayApiKey, site_id: cinetPaySiteId, transaction_id: paymentReference }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.code !== '00') {
            console.error('[CinetPay Webhook] Verification failed:', verifyData);
            return response.status(403).json({ error: 'Payment verification failed.' });
          }
        } catch (err) {
          console.error('[CinetPay Webhook] Verification error:', err.message);
          return response.status(500).json({ error: 'Could not verify payment.' });
        }
      }
    }

    database.updatePaymentByReference({
      paymentReference,
      paymentStatus,
      paymentPayload: payload,
    });

    response.json({ ok: true });
  }),
);

app.post(
  '/api/payments/wave/webhook',
  asyncRoute(async (request, response) => {
    console.log('[Wave Webhook] Received:', JSON.stringify(request.body).slice(0, 500));

    // Verify Wave webhook signature
    const webhookSecret = process.env.WAVE_WEBHOOK_SECRET || process.env.WAVE_SIGNING_SECRET;
    if (webhookSecret) {
      const rawBody = request.rawBody || JSON.stringify(request.body);
      const sig = request.header('wave-signature') || '';
      if (!verifyWaveWebhook(rawBody, sig)) {
        console.error('[Wave Webhook] Invalid signature, sig header:', sig ? 'present' : 'missing');
        return response.status(403).json({ error: 'Invalid webhook signature.' });
      }
    }

    const { clientReference, checkoutId, paymentStatus, payload } = normalizeWaveWebhookPayload(request.body);

    if (!clientReference && !checkoutId) {
      // Wave health-check ping — signature already verified, just acknowledge
      console.log('[Wave Webhook] Health-check ping, no reference — returning 200.');
      return response.json({ ok: true });
    }

    // Update by client_reference (orderId) or by checkoutId (paymentReference)
    if (clientReference) {
      const order = database.getOrderById(clientReference);
      if (order) {
        database.updatePayment({
          orderId: order.orderId,
          paymentStatus,
          paymentReference: checkoutId || order.paymentReference,
          paymentUrl: order.paymentUrl,
          paymentPayload: payload,
        });

        // Send email on successful payment
        if (paymentStatus === 'paid') {
          // Mark coupon as used now that payment succeeded
          if (order.couponCode) {
            try { database.useCoupon(order.couponCode); } catch { /* ignore */ }
          }
          const totalPrice = order.packPrice - (order.discountAmount ?? 0);
          sendOrderConfirmationEmail({ order, totalPrice }).catch((err) =>
            console.error('[Webhook] Email error:', err.message),
          );
        }
      }
    } else if (checkoutId) {
      database.updatePaymentByReference({
        paymentReference: checkoutId,
        paymentStatus,
        paymentPayload: payload,
      });
    }

    response.json({ ok: true });
  }),
);

app.get('/api/admin/orders', requireAdmin, (_request, response) => {
  response.json({ orders: database.listOrders().map(orderWithoutPortalToken) });
});

app.get('/api/inventory', (_request, response) => {
  response.json({ inventory: database.getInventory() });
});

app.put('/api/admin/inventory/:type/:key', requireAdmin, (request, response) => {
  const { type, key } = request.params;
  if (type !== 'material' && type !== 'foil') {
    response.status(400).json({ error: 'Invalid inventory type. Must be "material" or "foil".' });
    return;
  }
  const inStock = Boolean(request.body.inStock);
  database.setInventoryItem({ itemType: type, itemKey: decodeURIComponent(key), inStock });
  response.json({ ok: true, inventory: database.getInventory() });
});

app.patch(
  '/api/admin/orders/:orderId',
  requireAdmin,
  asyncRoute(async (request, response) => {
    const existingOrder = database.getOrderById(request.params.orderId);

    if (!existingOrder) {
      response.status(404).json({ error: 'Order not found.' });
      return;
    }

    const updatedOrder = database.updateAdminOrder({
      orderId: existingOrder.orderId,
      orderStatus: request.body.orderStatus ?? existingOrder.orderStatus,
      paymentStatus: request.body.paymentStatus ?? existingOrder.paymentStatus,
      adminNotes: request.body.adminNotes ?? existingOrder.adminNotes,
      deliveryNotes: request.body.deliveryNotes ?? existingOrder.deliveryNotes,
    });

    response.json({ order: orderWithoutPortalToken(updatedOrder) });
  }),
);

// ── ADMIN: UPDATE CARD PROFILE & CUSTOMIZATION ──────────────────────
app.patch(
  '/api/admin/orders/:orderId/card',
  requireAdmin,
  asyncRoute(async (request, response) => {
    const existingOrder = database.getOrderById(request.params.orderId);
    if (!existingOrder) {
      return response.status(404).json({ error: 'Order not found.' });
    }

    const profile = { ...existingOrder.profile, ...request.body.profile };
    const customization = { ...existingOrder.customization, ...request.body.customization };

    const updatedOrder = database.updateOrderCard({
      orderId: existingOrder.orderId,
      profile,
      customization,
    });

    response.json({ order: orderWithoutPortalToken(updatedOrder) });
  }),
);

// ── ADMIN: APPLY / REMOVE COUPON ON ORDER ───────────────────────────
app.post(
  '/api/admin/orders/:orderId/coupon',
  requireAdmin,
  asyncRoute(async (request, response) => {
    const order = database.getOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ error: 'Order not found.' });
    }

    const code = (request.body.code ?? '').trim().toUpperCase();

    // Remove coupon if code is empty
    if (!code) {
      const updatedOrder = database.updateOrderCoupon({ orderId: order.orderId, couponCode: null, discountAmount: 0 });
      return response.json({ order: orderWithoutPortalToken(updatedOrder), discountAmount: 0 });
    }

    const coupon = database.getCoupon(code);
    if (!coupon || !coupon.active) {
      return response.status(400).json({ error: 'Code coupon invalide ou inactif.' });
    }
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return response.status(400).json({ error: 'Ce coupon a atteint son nombre maximum d\'utilisations.' });
    }

    // Compute base price
    const packInfo = packageCatalog[order.packKey] ?? packageCatalog.pro;
    const customization = order.customization ?? {};
    const materialAdds = { 'Brushed metal': 20000 };
    const foilAdds = { 'Gold foil': 5000, 'Silver foil': 5000, 'Copper foil': 5000 };
    const basePrice = packInfo.price
      + (materialAdds[customization.material] ?? 0)
      + (foilAdds[customization.foil] ?? 0);

    // Atomic coupon application (prevents race conditions)
    try {
      const { discountAmount, coupon: appliedCoupon } = database.applyCouponAtomically({
        orderId: order.orderId, code, basePrice,
      });
      const updatedOrder = database.getOrderById(order.orderId);
      console.log(`[Admin] Applied coupon ${code} to order ${order.orderId.slice(0, 8)}`);
      response.json({ order: orderWithoutPortalToken(updatedOrder), discountAmount, coupon: appliedCoupon });
    } catch (err) {
      return response.status(400).json({ error: err.message });
    }
  }),
);

// ── ADMIN: UPLOAD AVATAR OR LOGO ────────────────────────────────────
app.post(
  '/api/admin/orders/:orderId/upload-asset',
  requireAdmin,
  upload.fields([{ name: 'avatarFile', maxCount: 1 }, { name: 'logoFile', maxCount: 1 }]),
  asyncRoute(async (request, response) => {
    const order = database.getOrderById(request.params.orderId);
    if (!order) {
      cleanupTempFiles(request.files);
      return response.status(404).json({ error: 'Order not found.' });
    }

    const currentAssets = order.assets ?? {};

    let newAvatar = currentAssets.avatar ?? null;
    let newLogo = currentAssets.logo ?? null;

    if (request.files?.avatarFile?.[0]) {
      newAvatar = await persistAsset({
        orderId: order.orderId,
        assetKey: 'avatar',
        asset: { sourceType: 'file' },
        file: request.files.avatarFile[0],
        uploadDir,
      });
    }

    if (request.files?.logoFile?.[0]) {
      newLogo = await persistAsset({
        orderId: order.orderId,
        assetKey: 'logo',
        asset: { sourceType: 'file' },
        file: request.files.logoFile[0],
        uploadDir,
      });
    }

    const newAssets = { ...currentAssets, avatar: newAvatar, logo: newLogo };
    database.updateOrderAssets({ orderId: order.orderId, assets: newAssets });

    response.json({ assets: newAssets });
  }),
);

// ── ADMIN: REGENERATE PAYMENT LINK ──────────────────────────────────
app.post(
  '/api/admin/orders/:orderId/payment-link',
  requireAdmin,
  asyncRoute(async (request, response) => {
    const order = database.getOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ error: 'Order not found.' });
    }

    if (!isWaveConfigured()) {
      return response.status(400).json({ error: 'Wave payment not configured.' });
    }

    // Recompute total price server-side
    const packInfo = packageCatalog[order.packKey] ?? packageCatalog.pro;
    const customization = order.customization ?? {};
    const materialAdds = { 'Brushed metal': 20000 };
    const foilAdds = { 'Gold foil': 5000, 'Silver foil': 5000, 'Copper foil': 5000 };
    let totalPrice = packInfo.price
      + (materialAdds[customization.material] ?? 0)
      + (foilAdds[customization.foil] ?? 0);

    // Use the discount already stored on the order (avoids re-validating used-up coupons
    // for orders where payment failed — the coupon was already counted against the order)
    if (order.discountAmount > 0) {
      totalPrice -= Math.min(order.discountAmount, totalPrice);
    }

    const domainSurcharge = Number(customization.domainUserShareFcfa) || 0;
    if (domainSurcharge > 0) totalPrice += domainSurcharge;
    if (totalPrice < 100) totalPrice = packInfo.price;

    const publicUrl = process.env.SERVER_PUBLIC_URL || 'https://tapal.geochifa.com';
    const overrideSuccessUrl = buildPaymentSuccessUrl(publicUrl, order);
    const wave = await initializeWaveCheckout({ order, totalPrice, overrideSuccessUrl });

    if (!wave.configured || wave.error) {
      return response.status(500).json({ error: wave.error || 'Wave checkout failed.' });
    }

    const updatedOrder = database.updatePayment({
      orderId: order.orderId,
      paymentStatus: 'pending',
      paymentReference: wave.checkoutId,
      paymentUrl: wave.paymentUrl,
      paymentPayload: wave.raw,
    });

    response.json({ paymentUrl: wave.paymentUrl, order: orderWithoutPortalToken(updatedOrder) });
  }),
);

// ── ADMIN: DOWNLOAD RECEIPT FOR ANY ORDER ───────────────────────────
app.get(
  '/api/admin/orders/:orderId/receipt.pdf',
  requireAdmin,
  asyncRoute(async (request, response) => {
    const order = database.getOrderById(request.params.orderId);
    if (!order) {
      return response.status(404).json({ error: 'Order not found.' });
    }

    const totalPrice = order.packPrice - (order.discountAmount ?? 0);
    const pdfBuffer = await generateReceiptPdf({ order, totalPrice });
    const filename = `recu-tekko-${(order.orderId ?? '').slice(0, 8).toUpperCase()}.pdf`;

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Content-Length', pdfBuffer.length);
    response.send(pdfBuffer);
  }),
);

// ── DOMAIN CHECK ─────────────────────────────────────────────────────
// TLD base cost in FCFA (annual RENEWAL prices — highest tier, not promo)
const TLD_BASE_PRICES = {
  'com': 10500, 'net': 11000, 'org': 10500, 'fr': 8500, 'biz': 12500,
  'info': 12500, 'online': 25000, 'me': 15500, 'dev': 10500, 'app': 12500,
  'co': 21500, 'tech': 31000, 'store': 31000, 'africa': 11000,
  'io': 31000, 'sn': 22000, 'ai': 61000,
};
const DOMAIN_MARGIN = 0.20; // 20% margin
const TEKKO_DOMAIN_BUDGET = 6000; // FCFA included by TEKKO

// Check via DNS + RDAP for reliable availability detection
async function checkDomainAvailability(domain) {
  // Method 1: DNS lookup — if no records at all, very likely available
  try {
    const dnsRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    });
    const dnsData = await dnsRes.json();
    const hasRecords = dnsData.Status === 0 && Array.isArray(dnsData.Answer) && dnsData.Answer.length > 0;

    // Method 2: RDAP for authoritative registration check
    try {
      const rdapRes = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json' },
      });
      if (rdapRes.status === 404) return true;   // not registered
      if (rdapRes.ok) return false;               // registered
    } catch { /* RDAP failed, fall through */ }

    // If DNS has no records and RDAP was inconclusive, likely available
    return !hasRecords;
  } catch {
    // Method 3: fallback RDAP-only if DNS failed
    try {
      const rdapRes = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json' },
      });
      if (rdapRes.status === 404) return true;
      if (rdapRes.ok) return false;
    } catch { /* both failed */ }
    return false; // assume unavailable (conservative)
  }
}

app.get('/api/domain/check', async (request, response) => {
  const domain = String(request.query.domain ?? '').toLowerCase().trim();
  if (!domain || !/^[a-z0-9][a-z0-9-]*(\.[a-z]{2,})+$/.test(domain)) {
    return response.status(400).json({ error: 'Nom de domaine invalide.' });
  }
  const parts = domain.split('.');
  const tld = parts.slice(1).join('.');
  const basePrice = TLD_BASE_PRICES[tld] ?? 7200;
  const price = Math.round(basePrice * (1 + DOMAIN_MARGIN));
  const coveredByUs = price <= TEKKO_DOMAIN_BUDGET;
  const userShareFcfa = coveredByUs ? 0 : price - TEKKO_DOMAIN_BUDGET;

  const available = await checkDomainAvailability(domain);
  if (available === null) {
    return response.json({ available: null, price, tld, domain, coveredByUs, userShareFcfa, error: 'Vérification impossible pour le moment. Réessayez.' });
  }
  return response.json({ available, price, tld, domain, coveredByUs, userShareFcfa });
});

// ── COUPONS ──────────────────────────────────────────────────────────
// Public: validate a coupon code
app.get('/api/coupons/validate', couponLimiter, (request, response) => {
  const code = String(request.query.code ?? '').trim().toUpperCase();
  if (!code) return response.status(400).json({ error: 'Code manquant.' });

  const coupon = database.getCoupon(code);
  if (!coupon || !coupon.active) return response.status(404).json({ error: 'Code invalide ou expiré.' });
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    return response.status(410).json({ error: 'Ce coupon a atteint son nombre maximum d\'utilisations.' });
  }

  response.json({ coupon });
});

// Admin: list all coupons
app.get('/api/admin/coupons', requireAdmin, (_request, response) => {
  response.json({ coupons: database.listCoupons() });
});

// Admin: create coupon
app.post('/api/admin/coupons', requireAdmin, (request, response) => {
  const { code, discountType, discountValue, maxUses } = request.body ?? {};
  if (!code || !discountType || !discountValue) {
    return response.status(400).json({ error: 'code, discountType et discountValue sont requis.' });
  }
  if (!['percent', 'fixed'].includes(discountType)) {
    return response.status(400).json({ error: 'discountType doit être "percent" ou "fixed".' });
  }
  try {
    const coupon = database.createCoupon({ code, discountType, discountValue: Number(discountValue), maxUses: Number(maxUses ?? 0) });
    response.status(201).json({ coupon });
  } catch {
    response.status(409).json({ error: 'Ce code existe déjà.' });
  }
});

// Admin: delete coupon
app.delete('/api/admin/coupons/:code', requireAdmin, (request, response) => {
  database.deleteCoupon(request.params.code);
  response.json({ ok: true });
});

// ── CEREMONIES ──────────────────────────────────────────────
const VALID_EVENT_TYPES = ['mariage', 'gala', 'seminaire', 'formation', 'corporate', 'festival', 'autre'];

app.post('/api/ceremonies', (request, response) => {
  const body = request.body;
  if (!body?.contactName?.trim() || !body?.contactPhone?.trim() || !body?.eventType?.trim()) {
    return response.status(400).json({ error: 'Champs obligatoires manquants (nom, telephone, type).' });
  }
  const eventType = body.eventType.trim();
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return response.status(400).json({ error: 'Type d\'événement invalide.' });
  }
  const id = randomUUID();
  const ceremony = database.createCeremony({
    id,
    contactName: body.contactName.trim(),
    contactEmail: body.contactEmail?.trim() ?? '',
    contactPhone: body.contactPhone.trim(),
    company: body.company?.trim() ?? '',
    eventType: body.eventType.trim(),
    eventName: body.eventName?.trim() ?? '',
    eventDate: body.eventDate?.trim() ?? '',
    eventCity: body.eventCity?.trim() ?? '',
    guestCount: body.guestCount ?? '',
    services: Array.isArray(body.services) ? body.services : [],
    customDesign: body.customDesign?.trim() ?? '',
    budget: body.budget?.trim() ?? '',
    notes: body.notes?.trim() ?? '',
  });
  response.status(201).json({ ceremony });
});

app.get('/api/admin/ceremonies', requireAdmin, (_request, response) => {
  response.json({ ceremonies: database.listCeremonies() });
});

app.patch('/api/admin/ceremonies/:id', requireAdmin, (request, response) => {
  const existing = database.getCeremonyById(request.params.id);
  if (!existing) return response.status(404).json({ error: 'Ceremony not found.' });
  const updated = database.updateCeremony({
    id: request.params.id,
    status: request.body.status ?? existing.status,
    adminNotes: request.body.adminNotes ?? existing.adminNotes,
  });
  response.json({ ceremony: updated });
});

// ── ADMIN INVOICE GENERATION ────────────────────────────────────────
let invoiceCounter = 0;
app.post(
  '/api/admin/invoices/generate',
  requireAdmin,
  asyncRoute(async (request, response) => {
    const { clientName, clientPhone, clientEmail, items, notes } = request.body;

    if (!clientName || !items?.length) {
      return response.status(400).json({ error: 'Client name and at least one item are required.' });
    }

    // Compute total
    const total = items.reduce((sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 0), 0);
    if (total <= 0) {
      return response.status(400).json({ error: 'Total must be greater than zero.' });
    }

    // Generate invoice ID
    invoiceCounter += 1;
    const invoiceId = `INV-${Date.now().toString(36).toUpperCase()}-${String(invoiceCounter).padStart(3, '0')}`;

    // Create Wave checkout session for standalone payment
    let paymentUrl = null;
    if (isWaveConfigured()) {
      const publicUrl = process.env.SERVER_PUBLIC_URL || 'https://tapal.geochifa.com';
      const overrideSuccessUrl = `${publicUrl}/payment/success`;
      const fakeOrder = { orderId: `invoice-${invoiceId}` };
      const wave = await initializeWaveCheckout({ order: fakeOrder, totalPrice: total, overrideSuccessUrl });
      if (wave.configured && !wave.error) {
        paymentUrl = wave.paymentUrl;
      }
    }

    // Generate invoice PDF
    const pdfBuffer = await generateInvoicePdf({
      invoiceId,
      clientName,
      clientPhone: clientPhone || '',
      clientEmail: clientEmail || '',
      items,
      total,
      paymentUrl,
      notes: notes || '',
    });

    // Return PDF as base64 + payment URL
    response.json({
      invoiceId,
      paymentUrl,
      total,
      pdfBase64: pdfBuffer.toString('base64'),
      pdfFilename: `facture-tekko-${invoiceId}.pdf`,
    });
  }),
);

// ── ANALYTICS: public beacon ────────────────────────────────────────
app.post('/api/track', trackLimiter, (request, response) => {
  try {
    const body = request.body ?? {};
    const payload = buildVisitPayload(request, {
      path: body.path,
      referrer: body.referrer,
      screen: body.screen,
    });
    // Dedup: ignore if same visitor hit the same page within the last 30 seconds
    const recent = database.getLastVisitByIpHashPath(payload.ipHash, payload.path, 30 * 1000);
    if (!recent) {
      database.insertVisit(payload);
    }
  } catch (err) {
    console.error('[Track] Error:', err.message);
  }
  // Always respond 200 — tracking must never break the app
  response.json({ ok: true });
});

function getSincePeriod(period) {
  const d = new Date();
  if (period === '24h') d.setHours(d.getHours() - 24);
  else if (period === '30d') d.setDate(d.getDate() - 30);
  else if (period === '90d') d.setDate(d.getDate() - 90);
  else d.setDate(d.getDate() - 7); // default 7d
  return d.toISOString();
}

// ── ANALYTICS: admin summary (aggregates) ─────────────────────────
app.get('/api/admin/analytics', requireAdmin, (request, response) => {
  const VALID = ['24h', '7d', '30d', '90d'];
  const period = VALID.includes(request.query.period) ? request.query.period : '7d';
  const since = getSincePeriod(period);
  response.json({
    period,
    summary: database.getVisitSummary(since),
    timeSeries: database.getVisitTimeSeries(since),
    topPages: database.getTopPages(since, 20),
    countries: database.getVisitCountries(since, 20),
    cities: database.getVisitCities(since, 20),
    devices: database.getVisitDevices(since),
    browsers: database.getVisitBrowsers(since, 10),
    os: database.getVisitOs(since, 10),
    referrers: database.getVisitReferrers(since, 20),
    locations: database.getVisitLocations(since),
  });
});

// ── ANALYTICS: admin raw visit log ────────────────────────────────
app.get('/api/admin/analytics/visits', requireAdmin, (request, response) => {
  const limit = Math.min(Number(request.query.limit) || 100, 500);
  response.json({ visits: database.getRecentVisits(limit) });
});

// ── VOICE ASSISTANT ROUTES ────────────────────────────────────────
app.post(
  '/api/voice/extract',
  voiceLimiter,
  asyncRoute(async (request, response) => {
    const { transcript, collectedData, stepIndex, language, sessionId } = request.body;

    if (!transcript || typeof transcript !== 'string') {
      return response.status(400).json({ error: 'Missing transcript.' });
    }

    if (!isGroqConfigured()) {
      return response.status(503).json({ error: 'Voice service not configured.' });
    }

    // Log turn if session exists
    if (sessionId) {
      database.appendVoiceTurn({ sessionId, role: 'user', content: transcript });
    }

    try {
      const result = await extractVoiceData({
        transcript,
        collectedData: collectedData ?? {},
        stepIndex: stepIndex ?? 0,
        language: language ?? 'fr',
      });

      // Log assistant turn
      if (sessionId) {
        database.appendVoiceTurn({ sessionId, role: 'assistant', content: result.nextPrompt });
      }

      response.json(result);
    } catch (err) {
      console.error('[Voice/extract]', err.message);
      const isTimeout = err.message === 'Groq API timeout';
      response.status(isTimeout ? 504 : 500).json({
        error: isTimeout
          ? "L'assistant Tapal ne répond pas. Réessai automatique..."
          : 'Erreur de reconnaissance vocale. Veuillez réessayer.',
        retry: true,
      });
    }
  }),
);

app.post(
  '/api/voice/design-suggest',
  voiceLimiter,
  asyncRoute(async (request, response) => {
    const { orderId, profileData } = request.body;

    if (!orderId) {
      return response.status(400).json({ error: 'Missing orderId.' });
    }

    const order = database.getOrderById(orderId);
    if (!order) {
      return response.status(404).json({ error: 'Order not found.' });
    }

    const suggestion = suggestTheme({
      role: profileData?.role ?? order.profile?.role ?? '',
      company: profileData?.company ?? order.profile?.company ?? '',
    });

    // Apply theme to order customization
    const currentCustomization = order.customization ?? {};
    const updatedCustomization = {
      ...currentCustomization,
      theme: suggestion.theme,
      accent: suggestion.accent,
      material: suggestion.material,
      finish: suggestion.finish,
      foil: suggestion.foil,
    };

    database.updateOrderCard({
      orderId,
      profile: order.profile,
      customization: updatedCustomization,
    });

    // Mark this order as voice-sourced
    database.updateOrderSource({
      orderId,
      source: 'voice',
      detectedLanguage: request.body.language ?? 'fr',
    });

    response.json({
      themeName: suggestion.label,
      slug: order.slug,
      accent: suggestion.accent,
      theme: suggestion.theme,
      material: suggestion.material,
      finish: suggestion.finish,
      foil: suggestion.foil,
    });
  }),
);

app.post(
  '/api/voice/validate/:orderId',
  voiceLimiter,
  asyncRoute(async (request, response) => {
    const order = database.getOrderById(request.params.orderId);

    if (!order) {
      return response.status(404).json({ error: 'Order not found.' });
    }

    database.updateAdminOrder({
      orderId: order.orderId,
      orderStatus: 'submitted',
      paymentStatus: 'pending',
    });

    response.json({ ok: true, slug: order.slug, orderId: order.orderId });
  }),
);

// ─── Local-language transcription via Groq Whisper ──────────────
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.post(
  '/api/voice/transcribe-wolof',
  voiceLimiter,
  audioUpload.single('audio'),
  asyncRoute(async (request, response) => {
    if (!process.env.GROQ_API_KEY) {
      return response.status(503).json({ error: 'Transcription API not configured.' });
    }
    if (!request.file) {
      return response.status(400).json({ error: 'No audio file provided.' });
    }

    const lang = request.body?.lang || 'wo';

    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const file = new File([request.file.buffer], 'recording.webm', { type: 'audio/webm' });
      // Whisper doesn't support Wolof/Pulaar codes — use auto-detect
      // It still transcribes the spoken content as best it can
      const transcription = await groq.audio.transcriptions.create({
        file,
        model: 'whisper-large-v3',
        prompt: lang === 'wo'
          ? 'Wolof spoken in Senegal. Names like Mamadou, Diallo, Ndiaye, Sow.'
          : 'Pulaar Fula spoken in Senegal. Names like Amadou, Bah, Barry, Diallo.',
      });

      const text = transcription.text || '';
      console.log(`[Voice/${lang}] Whisper transcript:`, text);
      response.json({ text: text.trim() });
    } catch (err) {
      console.error(`[Voice/${lang}] Whisper error:`, err.message);
      response.status(500).json({ error: 'Transcription failed.' });
    }
  }),
);

// ── Social preview (Open Graph) for WhatsApp / Telegram ─────────────
app.get('/share/:slug', (request, response) => {
  const order = database.getOrderBySlug(request.params.slug);
  if (!order || order.paymentStatus !== 'paid') {
    response.status(404).type('html').send('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Tapal</title></head><body><p>Carte introuvable.</p></body></html>');
    return;
  }
  const profile = order.profile || {};
  const title = escapeHtmlAttr(profile.fullName || 'Carte Tapal');
  const desc = escapeHtmlAttr(profile.role || profile.company || 'Carte de visite numerique Tapal.');
  const host = request.get('host') || 'localhost';
  const proto = (request.headers['x-forwarded-proto'] || request.protocol || 'https').split(',')[0].trim();
  const cardPath = `/c/${encodeURIComponent(order.slug)}`;
  const absUrl = `${proto}://${host}${cardPath}`;
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${escapeHtmlAttr(absUrl)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtmlAttr(absUrl)}" />
  <link rel="canonical" href="${escapeHtmlAttr(absUrl)}" />
</head>
<body>
  <p style="font-family:system-ui,sans-serif;padding:1.5rem"><a href="${escapeHtmlAttr(absUrl)}">Ouvrir la carte</a></p>
</body>
</html>`;
  response.type('html').send(html);
});

if (fs.existsSync(distDir)) {
  // Assets (hashed filenames) get long cache; index.html is served by the catch-all below
  app.use(express.static(distDir, { index: false, maxAge: '7d' }));
}

app.get('*', (request, response, next) => {
  if (request.path.startsWith('/api') || request.path.startsWith('/uploads')) {
    next();
    return;
  }

  if (!fs.existsSync(indexFile)) {
    response.status(404).send('Frontend build not found. Run npm run build before starting the production server.');
    return;
  }

  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  response.setHeader('Content-Type', 'text/html; charset=UTF-8');
  response.send(fs.readFileSync(indexFile));
});

app.use((error, request, response, _next) => {
  cleanupTempFiles(request.files);

  // CORS errors
  if (error.message === 'Not allowed by CORS') {
    return response.status(403).json({ error: 'Origin not allowed.' });
  }

  const statusCode = error.message?.includes('Only JPG, PNG, and WEBP images are allowed') ? 400 : 500;
  if (statusCode === 500) console.error('[500]', error);
  const safeMessage = statusCode === 500
    ? 'Something went wrong while processing the request.'
    : error.message;
  response.status(statusCode).json({ error: safeMessage });
});

app.listen(serverPort, () => {
  console.log(`Tapal server listening on http://localhost:${serverPort}`);
});

// ── CLEANUP CRON — purge draft orders that never started checkout ────
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // run every 10 minutes
const ORPHAN_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours — only drafts with no payment_reference

function cleanupOrphanedOrders() {
  try {
    const expired = database.listExpiredUnpaidOrders(ORPHAN_MAX_AGE_MS);
    for (const order of expired) {
      // Delete uploaded files
      const orderDir = path.join(uploadDir, order.orderId);
      if (fs.existsSync(orderDir)) {
        fs.rmSync(orderDir, { recursive: true, force: true });
      }
      // Delete DB record
      database.deleteOrder(order.orderId);
    }
    if (expired.length > 0) {
      console.log(`[Cleanup] Purged ${expired.length} unpaid order(s) older than ${ORPHAN_MAX_AGE_MS / 60000} min without checkout.`);
    }
  } catch (err) {
    console.error('[Cleanup] Error:', err.message);
  }
}

// Run once at startup, then every 10 minutes
setTimeout(cleanupOrphanedOrders, 5000);
setInterval(cleanupOrphanedOrders, CLEANUP_INTERVAL_MS);