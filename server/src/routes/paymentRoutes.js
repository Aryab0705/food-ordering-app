const express = require('express');
const {
  getPaymentConfig,
  createRazorpayOrder,
  verifyPayment,
  saveOrder,
  saveCashOrder,
} = require('../controllers/paymentController');
const { authorize, protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/payment-config', protect, authorize('student'), getPaymentConfig);
router.post('/create-order', protect, authorize('student'), createRazorpayOrder);
router.post('/verify-payment', protect, authorize('student'), verifyPayment);
router.post('/save-order', protect, authorize('student'), saveOrder);
router.post('/save-cash-order', protect, authorize('student'), saveCashOrder);

module.exports = router;
