const crypto = require('crypto');
const PaymentAttempt = require('../models/PaymentAttempt');
const Order = require('../models/Order');
const User = require('../models/User');
const getRazorpayClient = require('../utils/razorpayClient');
const { isRazorpayConfigured } = require('../utils/razorpayClient');
const asyncHandler = require('../utils/asyncHandler');

const toValidNumber = (value) => {
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) ? normalizedValue : NaN;
};

const normalizeCartItem = (cartItem) => {
  const price = toValidNumber(cartItem.food?.price);
  const quantity = toValidNumber(cartItem.quantity);

  if (!cartItem.food?._id || !cartItem.food?.name || !cartItem.food?.vendor) {
    throw new Error('Cart contains an incomplete food item. Please refresh the cart and try again.');
  }

  if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Cart contains invalid pricing data for ${cartItem.food.name}. Please refresh the cart and try again.`);
  }

  return {
    food: cartItem.food._id,
    name: cartItem.food.name,
    price,
    quantity,
    vendor: cartItem.food.vendor,
  };
};

const buildCartItems = (cart) =>
  cart.map(normalizeCartItem);

const normalizePaymentAttemptItem = (item) => {
  const price = toValidNumber(item?.price);
  const quantity = toValidNumber(item?.quantity);

  if (!item?.food || !item?.name || !item?.vendor) {
    throw new Error('Saved payment items are incomplete. Please contact support with your payment ID.');
  }

  if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(
      `Saved payment data is invalid for ${item?.name || 'an item'}. Please contact support with your payment ID.`,
    );
  }

  return {
    ...item,
    price,
    quantity,
  };
};

const calculateTotalAmount = (items) => {
  const totalAmount = items.reduce((sum, item) => {
    const price = toValidNumber(item?.price);
    const quantity = toValidNumber(item?.quantity);

    if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
      return NaN;
    }

    return sum + price * quantity;
  }, 0);

  return Number.isFinite(totalAmount) ? totalAmount : NaN;
};

const createOrderGroups = (items) =>
  Object.values(
    items.reduce((groups, item) => {
      const vendorId = String(item.vendor);

      if (!groups[vendorId]) {
        groups[vendorId] = [];
      }

      groups[vendorId].push({
        ...item,
        status: 'pending',
      });

      return groups;
    }, {}),
  );

const getCartSnapshot = async (userId) => {
  const user = await User.findById(userId).populate('cart.food');

  if (!user || !user.cart.length) {
    return null;
  }

  const validCartItems = user.cart.filter((item) => {
    if (!item.food || !item.food.isAvailable) {
      return false;
    }

    try {
      normalizeCartItem(item);
      return true;
    } catch {
      return false;
    }
  });

  if (!validCartItems.length) {
    if (user.cart.length) {
      user.cart = [];
      await user.save();
    }
    return null;
  }

  if (validCartItems.length !== user.cart.length) {
    user.cart = validCartItems.map((item) => ({
      food: item.food._id,
      quantity: Number(item.quantity),
    }));
    await user.save();
  }

  const items = buildCartItems(validCartItems);
  const totalAmount = calculateTotalAmount(items);

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('Cart total could not be calculated. Please refresh the cart and try again.');
  }

  return {
    user,
    items,
    totalAmount,
  };
};

const clearPurchasedItemsFromCart = async (userId, items) => {
  const user = await User.findById(userId);

  if (!user) {
    return;
  }

  const purchasedFoodIds = new Set(items.map((item) => String(item.food)));
  user.cart = user.cart.filter((cartItem) => !purchasedFoodIds.has(String(cartItem.food)));
  await user.save();
};

const createPlatformOrders = async ({
  studentId,
  items,
  paymentStatus,
  paymentId = '',
  orderId = '',
  paymentMethod = '',
}) => {
  // Each vendor gets its own order so restaurant-side fulfillment stays isolated.
  const normalizedItems = items.map(normalizePaymentAttemptItem);
  const orderGroups = createOrderGroups(normalizedItems);
  const createdOrders = await Promise.all(
    orderGroups.map((groupedItems) =>
      Order.create({
        student: studentId,
        items: groupedItems,
        totalAmount: calculateTotalAmount(groupedItems),
        paymentStatus,
        paymentId,
        orderId,
        paymentMethod,
      }),
    ),
  );

  return Order.find({
    _id: { $in: createdOrders.map((order) => order._id) },
  })
    .populate('student', 'name email')
    .populate('items.vendor', 'name shopName shopAddress')
    .sort({ createdAt: -1 });
};

const getPaymentConfig = asyncHandler(async (_req, res) => {
  res.json({
    razorpayEnabled: isRazorpayConfigured(),
    message: isRazorpayConfigured()
      ? 'Razorpay is configured and ready for online payment.'
      : 'Online payment is not configured yet. Add Razorpay keys in server/.env to enable it.',
  });
});

const createRazorpayOrder = asyncHandler(async (req, res) => {
  try {
    const requestedTotalAmount = Number(req.body?.totalAmount);
    const cartSnapshot = await getCartSnapshot(req.user._id);

    if (!cartSnapshot) {
      res.status(400);
      throw new Error('Cart is empty or contains unavailable items');
    }

    if (!Number.isFinite(requestedTotalAmount) || requestedTotalAmount <= 0) {
      res.status(400);
      throw new Error('A valid total amount is required to create a payment order');
    }

    if (Math.round(requestedTotalAmount * 100) !== Math.round(cartSnapshot.totalAmount * 100)) {
      res.status(400);
      throw new Error('Cart total mismatch. Please refresh your cart and try again.');
    }

    if (!isRazorpayConfigured()) {
      res.status(503);
      throw new Error(
        'Online payment is not configured yet. Add Razorpay keys in server/.env or use cash payment for now.',
      );
    }

    const razorpay = getRazorpayClient();
    // Razorpay expects the amount in paise, so we multiply the rupee total by 100.
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(cartSnapshot.totalAmount * 100),
      currency: 'INR',
      receipt: `food_${Date.now()}`,
      notes: {
        userId: String(req.user._id),
        itemCount: String(cartSnapshot.items.length),
      },
    });

    await PaymentAttempt.create({
      user: req.user._id,
      items: cartSnapshot.items,
      totalAmount: cartSnapshot.totalAmount,
      currency: razorpayOrder.currency,
      razorpayOrderId: razorpayOrder.id,
      status: 'created',
    });

    res.status(200).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      itemCount: cartSnapshot.items.length,
    });
  } catch (error) {
    console.error('Razorpay create-order error:', error);
    if (!res.statusCode || res.statusCode === 200) {
      res.status(error.statusCode || 500);
    }

    if (error?.error?.description) {
      error.message = error.error.description;
    } else if (error?.description) {
      error.message = error.description;
    } else if (error?.message?.toLowerCase().includes('authentication')) {
      error.message =
        'Razorpay rejected the provided keys. Please check that server/.env contains your real test or live Razorpay credentials.';
    }
    throw error;
  }
});

const verifyPayment = asyncHandler(async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } =
      req.body;

    if (!orderId || !paymentId || !signature) {
      res.status(400);
      throw new Error('Payment verification details are required');
    }

    const paymentAttempt = await PaymentAttempt.findOne({
      razorpayOrderId: orderId,
      user: req.user._id,
    });

    if (!paymentAttempt) {
      res.status(404);
      throw new Error('Payment attempt not found');
    }

    // We recompute the signature server-side to ensure the payment callback is genuine.
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      paymentAttempt.status = 'failed';
      paymentAttempt.razorpayPaymentId = paymentId;
      paymentAttempt.razorpaySignature = signature;
      await paymentAttempt.save();

      res.status(400);
      throw new Error('Payment signature verification failed');
    }

    paymentAttempt.status = 'verified';
    paymentAttempt.razorpayPaymentId = paymentId;
    paymentAttempt.razorpaySignature = signature;
    await paymentAttempt.save();

    res.status(200).json({
      success: true,
      verified: true,
      orderId,
      paymentId,
    });
  } catch (error) {
    console.error('Razorpay verify-payment error:', error);
    if (!res.statusCode || res.statusCode === 200) {
      res.status(500);
    }
    throw error;
  }
});

const saveOrder = asyncHandler(async (req, res) => {
  const { razorpay_order_id: orderId, paymentMethod = '' } = req.body;

  if (!orderId) {
    res.status(400);
    throw new Error('Razorpay order id is required');
  }

  const paymentAttempt = await PaymentAttempt.findOne({
    razorpayOrderId: orderId,
    user: req.user._id,
  });

  if (!paymentAttempt) {
    res.status(404);
    throw new Error('Payment attempt not found');
  }

  if (paymentAttempt.status !== 'verified' && paymentAttempt.status !== 'completed') {
    res.status(400);
    throw new Error('Payment must be verified before saving the order');
  }

  if (paymentAttempt.status === 'completed' && paymentAttempt.createdOrderIds.length) {
    const existingOrders = await Order.find({
      _id: { $in: paymentAttempt.createdOrderIds },
    })
      .populate('student', 'name email')
      .populate('items.vendor', 'name shopName shopAddress');

    res.json(existingOrders);
    return;
  }

  const populatedOrders = await createPlatformOrders({
    studentId: req.user._id,
    items: paymentAttempt.items,
    paymentStatus: 'paid',
    paymentId: paymentAttempt.razorpayPaymentId,
    orderId: paymentAttempt.razorpayOrderId,
    paymentMethod,
  });

  await clearPurchasedItemsFromCart(req.user._id, paymentAttempt.items);

  paymentAttempt.status = 'completed';
  paymentAttempt.createdOrderIds = populatedOrders.map((order) => order._id);
  await paymentAttempt.save();

  res.status(201).json(populatedOrders);
});

const saveCashOrder = asyncHandler(async (req, res) => {
  const cartSnapshot = await getCartSnapshot(req.user._id);

  if (!cartSnapshot) {
    res.status(400);
    throw new Error('Cart is empty or contains unavailable items');
  }

  const populatedOrders = await createPlatformOrders({
    studentId: req.user._id,
    items: cartSnapshot.items,
    paymentStatus: 'pending',
    orderId: `cash_${Date.now()}`,
    paymentMethod: 'cash',
  });

  await clearPurchasedItemsFromCart(req.user._id, cartSnapshot.items);

  res.status(201).json(populatedOrders);
});

module.exports = {
  getPaymentConfig,
  createRazorpayOrder,
  verifyPayment,
  saveOrder,
  saveCashOrder,
};
