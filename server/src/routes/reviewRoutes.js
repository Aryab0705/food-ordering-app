const express = require('express');
const { createReview } = require('../controllers/reviewController');
const { authorize, protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, authorize('student'), createReview);

module.exports = router;
