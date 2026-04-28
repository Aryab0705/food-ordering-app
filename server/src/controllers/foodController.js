const FoodItem = require('../models/FoodItem');
const VendorReview = require('../models/VendorReview');
const asyncHandler = require('../utils/asyncHandler');

const getAllFoodItems = asyncHandler(async (req, res) => {
  const foods = await FoodItem.find()
    .populate('vendor', 'name shopName shopAddress averageRating reviewCount')
    .sort({ createdAt: -1 })
    .lean();

  const foodsWithVendors = foods.filter((food) => food.vendor);
  const vendorIds = [...new Set(foodsWithVendors.map((food) => String(food.vendor._id)))];

  if (!vendorIds.length) {
    res.json([]);
    return;
  }

  const ratingSummary = await VendorReview.aggregate([
    {
      $match: {
        vendor: { $in: vendorIds.map((vendorId) => new FoodItem.db.base.Types.ObjectId(vendorId)) },
      },
    },
    {
      $group: {
        _id: '$vendor',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const ratingMap = ratingSummary.reduce((summary, vendor) => {
    summary[String(vendor._id)] = {
      averageRating: Number(vendor.averageRating.toFixed(1)),
      reviewCount: vendor.reviewCount,
    };
    return summary;
  }, {});

  res.json(
    foodsWithVendors.map((food) => {
      const vendorId = String(food.vendor._id);
      const liveRating = ratingMap[vendorId];

      return {
        ...food,
        vendor: {
          ...food.vendor,
          averageRating: liveRating?.averageRating ?? food.vendor.averageRating ?? 0,
          reviewCount: liveRating?.reviewCount ?? food.vendor.reviewCount ?? 0,
        },
      };
    }),
  );
});

const getVendorFoodItems = asyncHandler(async (req, res) => {
  const foods = await FoodItem.find({ vendor: req.user._id }).sort({ createdAt: -1 });
  res.json(foods);
});

const createFoodItem = asyncHandler(async (req, res) => {
  const food = await FoodItem.create({
    ...req.body,
    vendor: req.user._id,
  });

  res.status(201).json(food);
});

const updateFoodItem = asyncHandler(async (req, res) => {
  const food = await FoodItem.findOne({
    _id: req.params.id,
    vendor: req.user._id,
  });

  if (!food) {
    res.status(404);
    throw new Error('Food item not found');
  }

  Object.assign(food, req.body);
  await food.save();

  res.json(food);
});

const deleteFoodItem = asyncHandler(async (req, res) => {
  const food = await FoodItem.findOneAndDelete({
    _id: req.params.id,
    vendor: req.user._id,
  });

  if (!food) {
    res.status(404);
    throw new Error('Food item not found');
  }

  res.json({ message: 'Food item deleted successfully' });
});

const seedSampleFoods = asyncHandler(async (req, res) => {
  const existingCount = await FoodItem.countDocuments({ vendor: req.user._id });

  if (existingCount > 0) {
    res.status(400);
    throw new Error('Sample data is only available for empty vendor menus');
  }

  const sampleFoods = [
    {
      name: 'Masala Dosa',
      description: 'Crispy dosa with potato masala and coconut chutney.',
      category: 'South Indian',
      price: 50,
      imageUrl: '',
      foodType: 'veg',
      vendor: req.user._id,
    },
    {
      name: 'Veg Burger',
      description: 'Loaded burger with patty, lettuce, and college-style sauce.',
      category: 'Fast Food',
      price: 80,
      imageUrl: '',
      foodType: 'veg',
      vendor: req.user._id,
    },
    {
      name: 'Cold Coffee',
      description: 'Chilled coffee shake topped with chocolate drizzle.',
      category: 'Beverage',
      price: 60,
      imageUrl: '',
      foodType: 'veg',
      vendor: req.user._id,
    },
  ];

  const createdFoods = await FoodItem.insertMany(sampleFoods);
  res.status(201).json(createdFoods);
});

module.exports = {
  getAllFoodItems,
  getVendorFoodItems,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
  seedSampleFoods,
};
