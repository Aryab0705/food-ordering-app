require('dotenv').config();
const app = require('./app');
const {
  connectDatabase,
  connectWithRetry,
  installConnectionMonitoring,
} = require('./config/db');
const { isRazorpayConfigured, hasRealValue, getKeyMode } = require('./utils/razorpayClient');
const { verifyEmailConfig } = require('./utils/sendOtpEmail');

const PORT = process.env.PORT || 5000;

const validateEnvironment = () => {
  const requiredVariables = ['MONGODB_URI', 'JWT_SECRET'];
  const missingVariables = requiredVariables.filter((name) => !process.env[name]);

  if (missingVariables.length) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }
};

const startServer = async () => {
  validateEnvironment();
  installConnectionMonitoring();

  // Connect to the database first so requests never hit a 503 race condition on startup.
  // If the initial connection fails (e.g. network down), start background retries.
  try {
    await connectDatabase({ logFailure: true });
  } catch {
    console.warn('[MongoDB] Initial connection failed; starting background retries.');
    connectWithRetry();
  }

  app.listen(PORT, () => {
    console.log(
      hasRealValue(process.env.RAZORPAY_KEY_ID)
        ? 'Razorpay Key loaded'
        : 'Razorpay Key missing or placeholder',
    );
    console.log(
      hasRealValue(process.env.RAZORPAY_KEY_SECRET)
        ? 'Razorpay Secret loaded'
        : 'Razorpay Secret missing or placeholder',
    );
    console.log('[Razorpay] Key configured:', hasRealValue(process.env.RAZORPAY_KEY_ID));
    console.log('[Razorpay] Secret configured:', hasRealValue(process.env.RAZORPAY_KEY_SECRET));
    console.log('[Razorpay] Key mode:', getKeyMode(process.env.RAZORPAY_KEY_ID));
    console.log(
      isRazorpayConfigured()
        ? 'Razorpay payment integration is ready'
        : 'Razorpay payment integration is not ready',
    );
    console.log(`Server running on port ${PORT}`);
  });

  // Validate email config in background (non-blocking)
  verifyEmailConfig().catch((error) => {
    console.error(`OTP email configuration check failed: ${error.message}`);
  });
};

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
