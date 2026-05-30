const express = require('express');
const cors = require('cors');
const { isRazorpayConfigured, hasRealValue } = require('./utils/razorpayClient');
const authRoutes = require('./routes/authRoutes');
const foodRoutes = require('./routes/foodRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const vendorReviewRoutes = require('./routes/vendorReviewRoutes');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

const app = express();
app.get("/", (req, res) => {
  res.send("Backend root working");
});

app.get('/api/health', (req, res) => {
  res.json({ message: 'API is running' });
});

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
  'https://campus-canteen-hub.vercel.app',
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
  return callback(new Error(`CORS: origin "${origin}" is not allowed`));
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

// Ensure preflight OPTIONS requests are handled before any auth middleware
app.options('*', cors({ origin: corsOriginFn, credentials: true }));
app.use(express.json());

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

app.use('/api/auth', authRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api', paymentRoutes);
app.use('/api/vendor-reviews', vendorReviewRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
