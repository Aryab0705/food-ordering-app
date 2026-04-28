const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const VendorReview = require('../models/VendorReview');
const asyncHandler = require('../utils/asyncHandler');

const updateVendorRatingSummary = async (vendorId) => {
  const normalizedVendorId = new mongoose.Types.ObjectId(String(vendorId));
  const summary = await VendorReview.aggregate([
    { $match: { vendor: normalizedVendorId } },
    {
      $group: {
        _id: '$vendor',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const [vendorSummary] = summary;

  await User.findByIdAndUpdate(normalizedVendorId, {
    averageRating: vendorSummary ? Number(vendorSummary.averageRating.toFixed(1)) : 0,
    reviewCount: vendorSummary ? vendorSummary.reviewCount : 0,
  });
};

const createVendorReview = asyncHandler(async (req, res) => {
  const { orderId, vendorId, rating } = req.body;

  if (!orderId || !vendorId || !rating) {
    res.status(400);
    throw new Error('Order, vendor, and rating are required');
  }

  const numericRating = Number(rating);

  if (numericRating < 1 || numericRating > 5) {
    res.status(400);
    throw new Error('Rating must be between 1 and 5');
  }

  const order = await Order.findOne({
    _id: orderId,
    student: req.user._id,
  });

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const vendorItems = order.items.filter((item) => String(item.vendor) === String(vendorId));
  const hasVendorInOrder = vendorItems.length > 0;

  if (!hasVendorInOrder) {
    res.status(400);
    throw new Error('This hotel is not part of the selected order');
  }

  const vendorDelivered = vendorItems.every(
    (item) => (item.status || order.status || 'pending') === 'delivered',
  );

  if (!vendorDelivered) {
    res.status(400);
    throw new Error('You can rate this hotel only after it is delivered');
  }

  const existingReview = await VendorReview.findOne({
    vendor: vendorId,
    order: orderId,
    student: req.user._id,
  });

  if (existingReview) {
    res.status(400);
    throw new Error('You already rated this hotel for this order');
  }

  const review = await VendorReview.create({
    vendor: vendorId,
    order: orderId,
    student: req.user._id,
    rating: numericRating,
  });

  await updateVendorRatingSummary(vendorId);

  const vendor = await User.findById(vendorId).select('averageRating reviewCount shopName name');

  res.status(201).json({
    message: 'Hotel rating submitted successfully',
    review: {
      _id: review._id,
      vendor: review.vendor,
      order: review.order,
      rating: review.rating,
    },
    vendor: {
      _id: vendor._id,
      averageRating: vendor.averageRating,
      reviewCount: vendor.reviewCount,
      shopName: vendor.shopName || vendor.name,
    },
  });
});

module.exports = {
  createVendorReview,
};
