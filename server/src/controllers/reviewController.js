const FoodItem = require('../models/FoodItem');
const Order = require('../models/Order');
const Review = require('../models/Review');
const asyncHandler = require('../utils/asyncHandler');

const updateFoodRatingSummary = async (foodId) => {
  const summary = await Review.aggregate([
    { $match: { food: foodId } },
    {
      $group: {
        _id: '$food',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const [ratingSummary] = summary;

  await FoodItem.findByIdAndUpdate(foodId, {
    averageRating: ratingSummary ? Number(ratingSummary.averageRating.toFixed(1)) : 0,
    reviewCount: ratingSummary ? ratingSummary.reviewCount : 0,
  });
};

const createReview = asyncHandler(async (req, res) => {
  const { foodId, orderId, rating } = req.body;

  if (!foodId || !orderId || !rating) {
    res.status(400);
    throw new Error('Food, order, and rating are required');
  }

  const numericRating = Number(rating);

  if (numericRating < 1 || numericRating > 5) {
    res.status(400);
    throw new Error('Rating must be between 1 and 5');
  }

  const order = await Order.findOne({
    _id: orderId,
    student: req.user._id,
    status: 'delivered',
  });

  if (!order) {
    res.status(404);
    throw new Error('Delivered order not found');
  }

  const hasOrderedFood = order.items.some((item) => String(item.food) === String(foodId));

  if (!hasOrderedFood) {
    res.status(400);
    throw new Error('This food item is not part of the selected order');
  }

  const existingReview = await Review.findOne({
    food: foodId,
    order: orderId,
    student: req.user._id,
  });

  if (existingReview) {
    res.status(400);
    throw new Error('You already rated this food item for this order');
  }

  const review = await Review.create({
    food: foodId,
    order: orderId,
    student: req.user._id,
    rating: numericRating,
  });

  await updateFoodRatingSummary(foodId);

  const food = await FoodItem.findById(foodId).select('averageRating reviewCount');

  res.status(201).json({
    message: 'Rating submitted successfully',
    review: {
      _id: review._id,
      food: review.food,
      order: review.order,
      rating: review.rating,
    },
    food: {
      _id: food._id,
      averageRating: food.averageRating,
      reviewCount: food.reviewCount,
    },
  });
});

module.exports = {
  createReview,
};
