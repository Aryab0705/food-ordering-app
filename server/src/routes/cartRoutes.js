const express = require('express');
const {
  addToCart,
  clearCart,
  getCart,
  updateCartItem,
} = require('../controllers/cartController');
const { authorize, protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, authorize('student'));

router.get('/', getCart);
router.post('/', addToCart);
router.put('/:foodId', updateCartItem);
router.delete('/', clearCart);

module.exports = router;
