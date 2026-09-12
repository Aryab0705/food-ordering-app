const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { isRazorpayConfigured, hasRealValue } = require('./utils/razorpayClient');
const authRoutes = require('./routes/authRoutes');
const foodRoutes = require('./routes/foodRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const vendorReviewRoutes = require('./routes/vendorReviewRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allowed origins:
//   1. Local development
//   2. Production Vercel deployment (canonical URL)
//   3. Vercel preview/branch deployments — Vercel generates per-commit URLs
//      like https://food-ordering-<hash>-<owner>-projects.vercel.app.
//      We whitelist any *.vercel.app URL that belongs to the same project owner
//      (aryab0705s-projects) so that preview deployments never hit CORS errors.
//
// Security: arbitrary vercel.app subdomains (e.g. attacker.vercel.app) are
// NOT allowed — only URLs that match the project-owner suffix pattern.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  // Vite also answers on the loopback IP, which the browser treats as a
  // different origin than localhost.
  'http://127.0.0.1:5173',
  'https://campus-canteen-hub.vercel.app',
  // Lets a deployment point at a different client without a code change.
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];

// Matches any Vercel preview URL for this project owner.
// Pattern: https://<anything>-aryab0705s-projects.vercel.app
const VERCEL_PREVIEW_PATTERN = /^https:\/\/[\w-]+-aryab0705s-projects\.vercel\.app$/;

const corsOriginFn = (origin, callback) => {
  // Non-browser requests (curl, server-to-server) send no Origin header.
  // Allow them so health checks and internal calls keep working.
  if (!origin) return callback(null, true);

  if (
    ALLOWED_ORIGINS.includes(origin) ||
    VERCEL_PREVIEW_PATTERN.test(origin)
  ) {
    return callback(null, true);
  }

  console.warn('[CORS] Blocked origin:', origin);
  // Tagged with a status so errorHandler answers 403 instead of a 500 that
  // echoes the caller-supplied origin straight back in the response body.
  const corsError = new Error('Origin not allowed by CORS policy');
  corsError.status = 403;
  return callback(corsError);
};

app.use(
  cors({
    origin: corsOriginFn,
    credentials: true,
    // Explicitly list allowed methods so preflight OPTIONS succeeds
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Express 5 no longer accepts "*" here, so use a regex to catch all preflight requests.
app.options(/.*/, cors({ origin: corsOriginFn, credentials: true }));
app.use(express.json());

// Declared after the CORS middleware so these two responses also carry the
// Access-Control-* headers. Previously they were registered above it, so
// /api/health — the obvious CORS smoke test — failed misleadingly.
app.get('/', (req, res) => {
  res.send('Backend root working');
});

app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.json({
    message: 'API is running',
    databaseConnected,
    database: databaseConnected ? mongoose.connection.name : null,
  });
});

app.get(['/test-key', '/api/test-key'], (req, res) => {
  const keyLoaded = hasRealValue(process.env.RAZORPAY_KEY_ID);
  const secretLoaded = hasRealValue(process.env.RAZORPAY_KEY_SECRET);

  res.json({
    razorpayEnabled: isRazorpayConfigured(),
    keyLoaded,
    secretLoaded,
    message: isRazorpayConfigured()
      ? 'Razorpay keys are configured.'
      : 'Razorpay keys are missing or still using placeholder values. Add your real Razorpay keys in server/.env to enable online payment.',
  });
});

// Everything below this line needs MongoDB. Answering 503 with a plain message
// beats the driver's opaque "Client must be connected before running operations"
// 500, and it keeps /api/health and /api/test-key usable while the DB is down.
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  // If Mongoose is currently connecting (readyState === 2), give it up to 3s to complete
  if (mongoose.connection.readyState === 2) {
    for (let i = 0; i < 30; i += 1) {
      await new Promise((resolve) => { setTimeout(resolve, 100); });
      if (mongoose.connection.readyState === 1) {
        return next();
      }
    }
  }

  res.status(503);
  const unavailableError = new Error(
    'Database unavailable. The API is running but has not connected to MongoDB yet'
    + ' — check the server terminal for the connection error.',
  );
  unavailableError.status = 503;
  return next(unavailableError);
});

app.use('/api/auth', authRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api', paymentRoutes);
app.use('/api/vendor-reviews', vendorReviewRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/recommendations', recommendationRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
