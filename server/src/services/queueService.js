const mongoose = require('mongoose');
const Order = require('../models/Order');

const ACTIVE_QUEUE_STATUSES = ['pending', 'accepted', 'preparing'];
const DEFAULT_PREP_TIME_MINUTES = 10;
const MAX_ACTIVE_WINDOW_HOURS = 12;

/**
 * Calculates preparation time in minutes for a single order.
 *
 * Rather than summing every item's cooking time (which ignores parallel preparation),
 * this uses:
 *   Max(item.prepTime) + min(6, (totalQuantity - 1) * 1.5)
 *
 * Uses FoodItem's estimatedPrepTime when present, falling back to 10 minutes.
 *
 * @param {object} order - Order object with items array
 * @returns {number} Estimated preparation time in minutes
 */
const calculateOrderPrepTime = (order) => {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return DEFAULT_PREP_TIME_MINUTES;
  }

  let maxItemPrep = 0;
  let totalQuantity = 0;

  for (const item of order.items) {
    const qty = Number(item.quantity) || 1;
    totalQuantity += qty;

    // Use populated food.estimatedPrepTime, or inline item.estimatedPrepTime, or fallback to 10
    const rawPrep = item.food?.estimatedPrepTime ?? item.estimatedPrepTime;
    const itemPrep = Number(rawPrep) && Number(rawPrep) >= 1
      ? Number(rawPrep)
      : DEFAULT_PREP_TIME_MINUTES;

    if (itemPrep > maxItemPrep) {
      maxItemPrep = itemPrep;
    }
  }

  if (maxItemPrep === 0) {
    maxItemPrep = DEFAULT_PREP_TIME_MINUTES;
  }

  // Small incremental overhead for preparing additional items/quantities
  const quantityOverhead = Math.min(6, Math.max(0, totalQuantity - 1) * 1.5);

  return Math.round(maxItemPrep + quantityOverhead);
};

/**
 * Formats estimated wait time into an intuitive range with friendly rounding.
 *
 * @param {number} totalMinutes
 * @returns {{ min: number, max: number, text: string }}
 */
const formatEtaRange = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) {
    return { min: 0, max: 0, text: 'Ready for pickup!' };
  }

  if (totalMinutes <= 5) {
    return { min: 3, max: 5, text: '3–5 mins' };
  }

  if (totalMinutes <= 12) {
    const min = Math.max(2, Math.round(totalMinutes * 0.85));
    const max = Math.round(totalMinutes * 1.15) + 1;
    return { min, max, text: `${min}–${max} mins` };
  }

  // For waits >= 13 minutes, round to intuitive 5-minute increments (e.g. 15–20 mins, 25–35 mins)
  const min = Math.max(5, Math.round((totalMinutes * 0.88) / 5) * 5);
  let max = Math.round(((totalMinutes * 1.12) + 1) / 5) * 5;
  if (max <= min) {
    max = min + 5;
  }

  return { min, max, text: `${min}–${max} mins` };
};

/**
 * Extracts the single vendor ID from an order document.
 *
 * @param {object} order
 * @returns {string|null}
 */
const extractVendorId = (order) => {
  if (!order || !Array.isArray(order.items) || !order.items[0]) {
    return null;
  }

  const rawVendor = order.items[0].vendor;
  if (!rawVendor) return null;

  return rawVendor._id ? String(rawVendor._id) : String(rawVendor);
};

/**
 * Computes queue position and ETA for a specific order.
 *
 * @param {string|mongoose.Types.ObjectId} vendorId
 * @param {object} targetOrder
 * @param {Array<object>} [cachedVendorOrders] - Optional pre-fetched active orders for the vendor
 * @returns {Promise<object|null>}
 */
const getOrderQueueDetails = async (vendorId, targetOrder, cachedVendorOrders = null) => {
  if (!targetOrder) return null;

  const currentStatus = targetOrder.status || 'pending';

  // If already prepared, it's ready for counter pickup
  if (currentStatus === 'prepared') {
    return {
      isPrepared: true,
      position: 0,
      ordersAhead: 0,
      estimatedWaitMinutes: { min: 0, max: 0 },
      estimatedWaitText: 'Ready for pickup!',
      statusText: 'Your order is prepared and ready for pickup at the counter.',
    };
  }

  // Terminal states don't have an active queue
  if (!ACTIVE_QUEUE_STATUSES.includes(currentStatus)) {
    return null;
  }

  const resolvedVendorId = vendorId || extractVendorId(targetOrder);
  if (!resolvedVendorId) return null;

  let activeVendorOrders = cachedVendorOrders;

  if (!activeVendorOrders) {
    const twelveHoursAgo = new Date(Date.now() - MAX_ACTIVE_WINDOW_HOURS * 60 * 60 * 1000);
    activeVendorOrders = await Order.find({
      'items.vendor': new mongoose.Types.ObjectId(resolvedVendorId),
      status: { $in: ACTIVE_QUEUE_STATUSES },
      createdAt: { $gte: twelveHoursAgo },
    })
      .populate('items.food', 'name estimatedPrepTime')
      .select('items createdAt status')
      .sort({ createdAt: 1 })
      .lean();
  }

  const targetOrderIdStr = String(targetOrder._id);
  const targetCreatedAt = new Date(targetOrder.createdAt || Date.now()).getTime();

  // Find active orders strictly created before target order
  const aheadOrders = [];

  for (const order of activeVendorOrders) {
    const orderIdStr = String(order._id);
    if (orderIdStr === targetOrderIdStr) {
      continue;
    }

    const orderCreatedAt = new Date(order.createdAt).getTime();
    if (orderCreatedAt < targetCreatedAt) {
      aheadOrders.push(order);
    }
  }

  const ordersAhead = aheadOrders.length;
  const queuePosition = ordersAhead + 1;

  const baseWaitTime = aheadOrders.reduce((sum, order) => sum + calculateOrderPrepTime(order), 0);
  const ownPrepTime = calculateOrderPrepTime(targetOrder);
  const totalWaitTime = baseWaitTime + ownPrepTime;

  const etaRange = formatEtaRange(totalWaitTime);

  let statusText;
  if (ordersAhead === 0) {
    statusText = "You're next in line! The vendor is working on your order.";
  } else if (ordersAhead === 1) {
    statusText = '1 order ahead of yours in the kitchen queue.';
  } else {
    statusText = `${ordersAhead} orders ahead of yours in the kitchen queue.`;
  }

  return {
    isPrepared: false,
    position: queuePosition,
    ordersAhead,
    estimatedWaitMinutes: { min: etaRange.min, max: etaRange.max },
    estimatedWaitText: etaRange.text,
    statusText,
    ownPrepTimeMinutes: ownPrepTime,
    baseWaitTimeMinutes: baseWaitTime,
  };
};

/**
 * Attaches queue information to a list of student orders.
 * Efficiently batches vendor lookups to prevent N+1 queries.
 *
 * @param {Array<object>} orders - List of sanitized student orders
 * @returns {Promise<Array<object>>}
 */
const attachQueueToOrders = async (orders) => {
  if (!Array.isArray(orders) || orders.length === 0) {
    return [];
  }

  // Identify distinct vendors among active orders
  const vendorIdsToFetch = new Set();

  for (const order of orders) {
    if (ACTIVE_QUEUE_STATUSES.includes(order.status)) {
      const vendorId = extractVendorId(order);
      if (vendorId) {
        vendorIdsToFetch.add(vendorId);
      }
    }
  }

  // Fetch active queue per distinct vendor in parallel
  const vendorOrdersCache = new Map();
  const twelveHoursAgo = new Date(Date.now() - MAX_ACTIVE_WINDOW_HOURS * 60 * 60 * 1000);

  await Promise.all(
    Array.from(vendorIdsToFetch).map(async (vendorId) => {
      try {
        const vendorOrders = await Order.find({
          'items.vendor': new mongoose.Types.ObjectId(vendorId),
          status: { $in: ACTIVE_QUEUE_STATUSES },
          createdAt: { $gte: twelveHoursAgo },
        })
          .populate('items.food', 'name estimatedPrepTime')
          .select('items createdAt status')
          .sort({ createdAt: 1 })
          .lean();

        vendorOrdersCache.set(vendorId, vendorOrders);
      } catch (err) {
        console.warn(`[QueueService] Failed to load queue for vendor ${vendorId}:`, err.message);
        vendorOrdersCache.set(vendorId, []);
      }
    }),
  );

  // Attach queue info to each order
  const enrichedOrders = [];

  for (const order of orders) {
    const plainOrder = order.toObject ? order.toObject() : { ...order };

    if (plainOrder.status === 'prepared') {
      plainOrder.queue = {
        isPrepared: true,
        position: 0,
        ordersAhead: 0,
        estimatedWaitMinutes: { min: 0, max: 0 },
        estimatedWaitText: 'Ready for pickup!',
        statusText: 'Your order is prepared and ready for pickup at the counter.',
      };
    } else if (ACTIVE_QUEUE_STATUSES.includes(plainOrder.status)) {
      const vendorId = extractVendorId(plainOrder);
      const cachedOrders = vendorId ? vendorOrdersCache.get(vendorId) : null;
      plainOrder.queue = await getOrderQueueDetails(vendorId, plainOrder, cachedOrders);
    } else {
      plainOrder.queue = null;
    }

    enrichedOrders.push(plainOrder);
  }

  return enrichedOrders;
};

module.exports = {
  ACTIVE_QUEUE_STATUSES,
  DEFAULT_PREP_TIME_MINUTES,
  calculateOrderPrepTime,
  formatEtaRange,
  getOrderQueueDetails,
  attachQueueToOrders,
};
