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

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://campus-canteen-hub.vercel.app'
    ],
    credentials: true,
  })
);
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
