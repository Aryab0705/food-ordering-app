require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/db');
const { isRazorpayConfigured, hasRealValue } = require('./utils/razorpayClient');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log('KEY:', process.env.RAZORPAY_KEY_ID || 'MISSING');
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

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
