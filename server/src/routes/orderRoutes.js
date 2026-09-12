const express = require('express');
const {
  cancelStudentOrder,
  getStudentOrders,
  getVendorOrders,
  placeOrder,
  updateStudentOrder,
  updateOrderStatus,
  getOrderQueue,
} = require('../controllers/orderController');
const { authorize, protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, authorize('student'), placeOrder);
router.get('/student', protect, authorize('student'), getStudentOrders);
router.get('/:id/queue', protect, authorize('student'), getOrderQueue);
router.put('/:id', protect, authorize('student'), updateStudentOrder);
router.put('/:id/cancel', protect, authorize('student'), cancelStudentOrder);
router.get('/vendor', protect, authorize('vendor'), getVendorOrders);
router.put('/:id/status', protect, authorize('vendor'), updateOrderStatus);

module.exports = router;
