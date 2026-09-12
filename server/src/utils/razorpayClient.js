const Razorpay = require('razorpay');

let razorpayInstance;

const getKeyMode = (keyId) => {
  if (String(keyId || '').startsWith('rzp_live_')) return 'LIVE';
  if (String(keyId || '').startsWith('rzp_test_')) return 'TEST';
  return 'UNKNOWN';
};

const hasRealValue = (value) => {
  if (!value) {
    return false;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (!normalizedValue) {
    return false;
  }

  return ![
    'your_actual_secret',
    'your_key_id',
    'your_key_secret',
    'rzp_test_your_actual_key',
    'rzp_test_xxxxxxxxxxxx',
    'xxxxxxxxxxxxxxxxxxxx',
  ].includes(normalizedValue);
};

const isRazorpayConfigured = () =>
  hasRealValue(process.env.RAZORPAY_KEY_ID) && hasRealValue(process.env.RAZORPAY_KEY_SECRET);

const getRazorpayClient = () => {
  if (!isRazorpayConfigured()) {
    throw new Error('Razorpay keys are missing or still using placeholder values');
  }

  if (!razorpayInstance) {
    console.log('[Razorpay] Key configured:', hasRealValue(process.env.RAZORPAY_KEY_ID));
    console.log('[Razorpay] Secret configured:', hasRealValue(process.env.RAZORPAY_KEY_SECRET));
    console.log('[Razorpay] Key mode:', getKeyMode(process.env.RAZORPAY_KEY_ID));

    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  return razorpayInstance;
};

module.exports = getRazorpayClient;
module.exports.isRazorpayConfigured = isRazorpayConfigured;
module.exports.hasRealValue = hasRealValue;
module.exports.getKeyMode = getKeyMode;
