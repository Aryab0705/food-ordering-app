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
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { getEmailConfig } = require('./utils/sendOtpEmail');

const app = express();

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://campus-canteen-hub.vercel.app',
];

const configuredAllowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || '').split(','),
]
  .map((origin) => String(origin || '').trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins])];

const isAllowedDevOrigin = (origin) => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || isAllowedDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/', (req, res) => {
  res.json({ message: 'Backend root working' });
});

app.get('/api/health', (req, res) => {
  const emailConfig = getEmailConfig();

  res.json({
    status: 'ok',
    message: 'API is running',
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      state: mongoose.connection.readyState,
      connected: mongoose.connection.readyState === 1,
      name: mongoose.connection.name || '',
    },
    env: {
      jwtConfigured: Boolean(process.env.JWT_SECRET),
      mongoConfigured: Boolean(process.env.MONGODB_URI),
      emailConfigured: Boolean(emailConfig.user && emailConfig.pass),
    },
  });
});

app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'Campus Canteen Hub API is running' });
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

app.use('/api/auth', authRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api', paymentRoutes);
app.use('/api/vendor-reviews', vendorReviewRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
