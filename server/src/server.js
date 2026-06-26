require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/db');
const { isRazorpayConfigured, hasRealValue } = require('./utils/razorpayClient');
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
  await connectDatabase();
  try {
    await verifyEmailConfig();
  } catch (error) {
    console.error(`OTP email configuration check failed: ${error.message}`);
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
    console.log(
      isRazorpayConfigured()
        ? 'Razorpay payment integration is ready'
        : 'Razorpay payment integration is not ready',
    );
    console.log(`Server running on port ${PORT}`);
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
