const User = require('../models/User');
const FoodItem = require('../models/FoodItem');
const asyncHandler = require('../utils/asyncHandler');

const populateCart = (userId) =>
  User.findById(userId).populate({
    path: 'cart.food',
    populate: { path: 'vendor', select: 'name shopName shopAddress' },
  });

const getCart = asyncHandler(async (req, res) => {
  const user = await populateCart(req.user._id);
  res.json(user.cart.filter((item) => item.food && item.food.vendor));
});

const addToCart = asyncHandler(async (req, res) => {
  const { foodId, quantity = 1 } = req.body;

  const food = await FoodItem.findById(foodId);

  if (!food || !food.isAvailable) {
    res.status(404);
    throw new Error('Food item is not available');
  }

  const user = await User.findById(req.user._id);
  const existingItem = user.cart.find((item) => item.food.toString() === foodId);

  if (existingItem) {
    existingItem.quantity += Number(quantity);
  } else {
    user.cart.push({ food: foodId, quantity: Number(quantity) });
  }

  await user.save();

  const updatedUser = await populateCart(req.user._id);
  res.json(updatedUser.cart.filter((item) => item.food && item.food.vendor));
});

const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const user = await User.findById(req.user._id);
  const cartItem = user.cart.find((item) => item.food.toString() === req.params.foodId);

  if (!cartItem) {
    res.status(404);
    throw new Error('Cart item not found');
  }

  if (quantity <= 0) {
    user.cart = user.cart.filter((item) => item.food.toString() !== req.params.foodId);
  } else {
    cartItem.quantity = Number(quantity);
  }

  await user.save();

  const updatedUser = await populateCart(req.user._id);
  res.json(updatedUser.cart.filter((item) => item.food && item.food.vendor));
});

const clearCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.cart = [];
  await user.save();
  res.json([]);
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  clearCart,
};
