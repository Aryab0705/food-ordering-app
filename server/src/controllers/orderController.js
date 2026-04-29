const Order = require('../models/Order');
const User = require('../models/User');
const VendorReview = require('../models/VendorReview');
const asyncHandler = require('../utils/asyncHandler');
const { hasTwilioConfig, sendSMS } = require('../utils/sendSMS');

const calculateTotalAmount = (items) => {
  return items.reduce(
    (sum, item) =>
      sum +
      (Number(item?.price || item?.food?.price || 0) *
        Number(item?.quantity || 1)),
    0
  );
};
const getItemStatus = (item, fallbackStatus = 'pending') => item.status || fallbackStatus;

const deriveOrderStatus = (items, fallbackStatus = 'pending') => {
  const statuses = items.map((item) => getItemStatus(item, fallbackStatus));

  if (!statuses.length) {
    return fallbackStatus;
  }

  if (statuses.some((status) => status === 'pending')) {
    return 'pending';
  }

  if (statuses.some((status) => status === 'accepted')) {
    return 'accepted';
  }

  if (statuses.some((status) => status === 'prepared' || status === 'preparing')) {
    return 'prepared';
  }

  if (statuses.some((status) => status === 'delivered')) {
    return 'delivered';
  }

  if (statuses.some((status) => status === 'rejected')) {
    return 'rejected';
  }

  return 'canceled';
};

const normalizeGroupedItems = (items, fallbackStatus = 'pending') =>
  items.map((item) => ({
    ...item,
    status: getItemStatus(item, fallbackStatus),
  }));

const preparedSmsMessage =
  'Your order from Campus Canteen Hub is prepared and ready for pickup. Please collect your order from the vendor. Thank you!';

const sendPreparedOrderSms = async (order) => {
  if (!hasTwilioConfig() || order.preparedSmsSentAt) {
    return;
  }

  const student = await User.findById(order.student).select('phone');

  if (!student?.phone) {
    return;
  }

  const sent = await sendSMS(student.phone, preparedSmsMessage);

  if (!sent) {
    return;
  }

  order.preparedSmsSentAt = new Date();
  await order.save();
};

const splitLegacyOrder = async (order) => {
  const plainOrder = order.toObject ? order.toObject() : order;
  const vendorGroups = plainOrder.items.reduce((groups, item) => {
    const vendorId = String(item.vendor);

    if (!groups[vendorId]) {
      groups[vendorId] = [];
    }

    groups[vendorId].push({
      ...item,
      status: getItemStatus(item, plainOrder.status),
    });

    return groups;
  }, {});

  const vendorIds = Object.keys(vendorGroups);

  if (vendorIds.length <= 1) {
    return;
  }

  const createdOrders = [];

  for (const vendorId of vendorIds) {
    const items = normalizeGroupedItems(vendorGroups[vendorId], plainOrder.status);
    const createdOrder = await Order.create({
      student: plainOrder.student,
      items,
      totalAmount: calculateTotalAmount(items),
      status: deriveOrderStatus(items, plainOrder.status),
      preparedSmsSentAt: plainOrder.preparedSmsSentAt || null,
    });

    await Order.findByIdAndUpdate(createdOrder._id, {
      createdAt: plainOrder.createdAt,
      updatedAt: plainOrder.updatedAt,
    });

    await VendorReview.updateMany(
      { order: plainOrder._id, vendor: vendorId },
      { $set: { order: createdOrder._id } },
    );

    createdOrders.push(createdOrder);
  }

  await Order.findByIdAndDelete(plainOrder._id);

  return createdOrders;
};

const normalizeLegacyOrders = async (query) => {
  const orders = await Order.find(query);
  const legacyOrders = orders.filter(
    (order) => new Set(order.items.map((item) => String(item.vendor))).size > 1,
  );

  for (const order of legacyOrders) {
    await splitLegacyOrder(order);
  }
};

const sanitizeOrder = (order) => {
  const plainOrder = order.toObject ? order.toObject() : order;
  const visibleItems = plainOrder.items.filter((item) => item.vendor);

  if (!visibleItems.length) {
    return null;
  }

  return {
    ...plainOrder,
    items: visibleItems,
    status: deriveOrderStatus(visibleItems, plainOrder.status),
    totalAmount: calculateTotalAmount(visibleItems),
  };
};

const attachVendorRatings = async (orders, studentId) => {
  const orderIds = orders.map((order) => order._id);

  if (!orderIds.length) {
    return orders;
  }

  const reviews = await VendorReview.find({
    student: studentId,
    order: { $in: orderIds },
  }).select('order vendor rating');

  const reviewMap = reviews.reduce((accumulator, review) => {
    const orderId = review.order.toString();

    if (!accumulator[orderId]) {
      accumulator[orderId] = {};
    }

    accumulator[orderId][review.vendor.toString()] = review.rating;
    return accumulator;
  }, {});

  return orders.map((order) => ({
    ...order,
    vendorRatings: reviewMap[order._id.toString()] || {},
  }));
};

const placeOrder = asyncHandler(async (req, res) => {
  res.status(400);
  throw new Error('Direct order placement is disabled. Use the payment flow to complete checkout.');
});

const getStudentOrders = asyncHandler(async (req, res) => {
  await normalizeLegacyOrders({ student: req.user._id });

  const orders = await Order.find({ student: req.user._id })
    .populate('items.vendor', 'name shopName shopAddress')
    .sort({ createdAt: -1 });

  const sanitizedOrders = orders.map(sanitizeOrder).filter(Boolean);
  const ordersWithRatings = await attachVendorRatings(sanitizedOrders, req.user._id);

  res.json(ordersWithRatings);
});

const getVendorOrders = asyncHandler(async (req, res) => {
  const query = { 'items.vendor': req.user._id };
  const { date } = req.query;

  if (date) {
    const startDate = new Date(`${date}T00:00:00.000`);
    const endDate = new Date(`${date}T23:59:59.999`);

    if (Number.isNaN(startDate.getTime())) {
      res.status(400);
      throw new Error('Invalid date filter');
    }

    query.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  await normalizeLegacyOrders({ 'items.vendor': req.user._id });

  const orders = await Order.find(query)
    .populate('student', 'name email')
    .sort({ createdAt: -1 });

  res.json(
    orders.map((order) => ({
      ...order.toObject(),
      status: deriveOrderStatus(
        order.items.filter((item) => item.vendor.toString() === req.user._id.toString()),
        order.status,
      ),
      items: order.items.filter((item) => item.vendor.toString() === req.user._id.toString()),
    })),
  );
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const requestedStatus = req.body.status;
  const status = requestedStatus === 'preparing' ? 'prepared' : requestedStatus;
  const allowedStatuses = ['accepted', 'prepared', 'preparing', 'delivered', 'rejected'];

  if (!allowedStatuses.includes(requestedStatus)) {
    res.status(400);
    throw new Error('Invalid order status');
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const vendorItems = order.items.filter(
    (item) => item.vendor.toString() === req.user._id.toString(),
  );
  const vendorOrderStatus = deriveOrderStatus(vendorItems, order.status);

  if (['canceled', 'rejected', 'delivered'].includes(vendorOrderStatus)) {
    res.status(400);
    throw new Error('This order can no longer be updated');
  }

  if (!vendorItems.length) {
    res.status(403);
    throw new Error('You cannot update this order');
  }

  if (vendorOrderStatus === 'pending' && !['accepted', 'rejected'].includes(status)) {
    res.status(400);
    throw new Error('Pending orders must be accepted or rejected first');
  }

  if (vendorOrderStatus === 'accepted' && !['prepared', 'rejected'].includes(status)) {
    res.status(400);
    throw new Error('Accepted orders can move to prepared or rejected');
  }

  if (['prepared', 'preparing'].includes(vendorOrderStatus) && status !== 'delivered') {
    res.status(400);
    throw new Error('Prepared orders can only be marked delivered');
  }

  order.items = order.items.map((item) => {
    if (item.vendor.toString() === req.user._id.toString()) {
      item.status = status;
    }

    return item;
  });
  order.status = deriveOrderStatus(order.items, order.status);
  await order.save();

  if (status === 'prepared') {
    await sendPreparedOrderSms(order);
  }

  const updatedOrder = await Order.findById(order._id)
    .populate('student', 'name email phone')
    .populate('items.vendor', 'name shopName shopAddress');

  res.json(sanitizeOrder(updatedOrder));
});

const updateStudentOrder = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || !items.length) {
    res.status(400);
    throw new Error('Updated order items are required');
  }

  const order = await Order.findOne({
    _id: req.params.id,
    student: req.user._id,
  });

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const currentStatus = deriveOrderStatus(order.items, order.status);

  if (currentStatus !== 'pending') {
    res.status(400);
    throw new Error('Only pending orders can be changed');
  }

  const quantityByFoodId = new Map(
    items
      .filter((item) => item.foodId && Number(item.quantity) > 0)
      .map((item) => [String(item.foodId), Number(item.quantity)]),
  );

  order.items = order.items
    .map((item) => {
      const nextQuantity = quantityByFoodId.get(String(item.food));

      if (!nextQuantity) {
        return null;
      }

      item.quantity = nextQuantity;
      return item;
    })
    .filter(Boolean);

  if (!order.items.length) {
    order.status = 'canceled';
    order.totalAmount = 0;
  } else {
    order.items = order.items.map((item) => {
      item.status = 'pending';
      return item;
    });
    order.status = deriveOrderStatus(order.items, order.status);
    order.totalAmount = calculateTotalAmount(order.items);
  }

  await order.save();

  const updatedOrder = await Order.findById(order._id)
    .populate('student', 'name email')
    .populate('items.vendor', 'name shopName shopAddress');

  res.json(sanitizeOrder(updatedOrder));
});

const cancelStudentOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    student: req.user._id,
  });

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const currentStatus = deriveOrderStatus(order.items, order.status);

  if (currentStatus !== 'pending') {
    res.status(400);
    throw new Error('Only pending orders can be canceled');
  }

  order.items = order.items.map((item) => {
    item.status = 'canceled';
    return item;
  });
  order.status = 'canceled';
  await order.save();

  const updatedOrder = await Order.findById(order._id)
    .populate('student', 'name email')
    .populate('items.vendor', 'name shopName shopAddress');

  res.json(sanitizeOrder(updatedOrder));
});

module.exports = {
  placeOrder,
  getStudentOrders,
  getVendorOrders,
  updateOrderStatus,
  updateStudentOrder,
  cancelStudentOrder,
};
