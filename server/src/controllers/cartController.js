const User = require('../models/User');
const FoodItem = require('../models/FoodItem');
const asyncHandler = require('../utils/asyncHandler');

const isValidCartQuantity = (value) => {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0;
};

const populateCart = (userId) =>
  User.findById(userId).populate({
    path: 'cart.food',
    populate: { path: 'vendor', select: 'name shopName shopAddress' },
  });

const sanitizeCartItems = async (user) => {
  if (!user) {
    return user;
  }

  const sanitizedCart = user.cart.filter(
    (item) => item.food && item.food.vendor && isValidCartQuantity(item.quantity),
  );

  if (sanitizedCart.length !== user.cart.length) {
    user.cart = sanitizedCart.map((item) => ({
      food: item.food._id || item.food,
      quantity: Number(item.quantity),
    }));
    await user.save();
    return populateCart(user._id);
  }

  return user;
};

const getCart = asyncHandler(async (req, res) => {
  const user = await sanitizeCartItems(await populateCart(req.user._id));
  res.json(user.cart.filter((item) => item.food && item.food.vendor));
});

const addToCart = asyncHandler(async (req, res) => {
  const { foodId, quantity = 1 } = req.body;
  const nextQuantity = Number(quantity);

  const food = await FoodItem.findById(foodId);

  if (!food || !food.isAvailable) {
    res.status(404);
    throw new Error('Food item is not available');
  }

  if (!isValidCartQuantity(nextQuantity)) {
    res.status(400);
    throw new Error('Quantity must be a valid positive number');
  }

  const user = await User.findById(req.user._id);
  const existingItem = user.cart.find((item) => item.food.toString() === foodId);

  if (existingItem) {
    existingItem.quantity += nextQuantity;
  } else {
    user.cart.push({ food: foodId, quantity: nextQuantity });
  }

  await user.save();

  const updatedUser = await sanitizeCartItems(await populateCart(req.user._id));
  res.json(updatedUser.cart.filter((item) => item.food && item.food.vendor));
});

const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const nextQuantity = Number(quantity);
  const user = await User.findById(req.user._id);
  const cartItem = user.cart.find((item) => item.food.toString() === req.params.foodId);

  if (!cartItem) {
    res.status(404);
    throw new Error('Cart item not found');
  }

  if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
    user.cart = user.cart.filter((item) => item.food.toString() !== req.params.foodId);
  } else {
    cartItem.quantity = nextQuantity;
  }

  await user.save();

  const updatedUser = await sanitizeCartItems(await populateCart(req.user._id));
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
