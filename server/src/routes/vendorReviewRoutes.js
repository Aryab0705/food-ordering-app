const express = require('express');
const { createVendorReview } = require('../controllers/vendorReviewController');
const { authorize, protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, authorize('student'), createVendorReview);

module.exports = router;
