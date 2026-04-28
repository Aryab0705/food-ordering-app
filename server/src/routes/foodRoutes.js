const express = require('express');
const {
  createFoodItem,
  deleteFoodItem,
  getAllFoodItems,
  getVendorFoodItems,
  seedSampleFoods,
  updateFoodItem,
} = require('../controllers/foodController');
const { authorize, protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getAllFoodItems);
router.get('/vendor', protect, authorize('vendor'), getVendorFoodItems);
router.post('/', protect, authorize('vendor'), createFoodItem);
router.post('/seed', protect, authorize('vendor'), seedSampleFoods);
router.put('/:id', protect, authorize('vendor'), updateFoodItem);
router.delete('/:id', protect, authorize('vendor'), deleteFoodItem);

module.exports = router;
