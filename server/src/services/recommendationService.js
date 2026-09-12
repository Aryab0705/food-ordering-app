const mongoose = require('mongoose');
const FoodItem = require('../models/FoodItem');
const Order = require('../models/Order');

/**
 * Generates personalized food recommendations for a given student.
 *
 * Algorithm overview:
 * 1. Analyzes student's non-canceled orders to determine category affinity, vendor affinity,
 *    and item order frequency.
 * 2. Aggregates campus-wide popularity across all student orders.
 * 3. Filters strictly for available food items with active vendors.
 * 4. Applies a weighted scoring model balancing category preference, vendor preference,
 *    popularity, vendor rating, and discovery bonuses (to prevent just repeating past orders).
 * 5. Handles cold-start users (0 orders) by defaulting to campus popularity + ratings.
 * 6. Generates human-readable explanation reasons based on the highest-scoring signal.
 *
 * @param {string|mongoose.Types.ObjectId} studentId - Authenticated student's ID
 * @param {string|mongoose.Types.ObjectId} studentId - Authenticated student's ID
 * @param {number} [limit=5] - Maximum number of recommendations to return
 * @returns {Promise<Array<object>>} Scored and explained recommendation items
 */
const getRecommendationsForStudent = async (studentId, limit = 5) => {
  const studentObjectId = new mongoose.Types.ObjectId(studentId);

  // 1. Fetch student's completed/active orders (exclude canceled and rejected)
  const studentOrders = await Order.find({
    student: studentObjectId,
    status: { $nin: ['canceled', 'rejected'] },
  })
    .populate('items.food', 'category name isAvailable')
    .select('items createdAt')
    .lean();

  const categoryCounts = {};
  const vendorCounts = {};
  const orderedFoodCounts = {};
  let totalStudentItems = 0;

  for (const order of studentOrders) {
    if (!Array.isArray(order.items)) continue;

    for (const item of order.items) {
      const quantity = Number(item.quantity) || 1;
      totalStudentItems += quantity;

      const foodIdStr = item.food?._id ? String(item.food._id) : (item.food ? String(item.food) : null);
      if (foodIdStr) {
        orderedFoodCounts[foodIdStr] = (orderedFoodCounts[foodIdStr] || 0) + quantity;
      }

      const category = item.food?.category;
      if (category) {
        categoryCounts[category] = (categoryCounts[category] || 0) + quantity;
      }

      const vendorIdStr = item.vendor ? String(item.vendor) : null;
      if (vendorIdStr) {
        vendorCounts[vendorIdStr] = (vendorCounts[vendorIdStr] || 0) + quantity;
      }
    }
  }

  // 2. Fetch campus-wide popularity (aggregated order counts across all students)
  const campusPopularityAgg = await Order.aggregate([
    { $match: { status: { $nin: ['canceled', 'rejected'] } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.food',
        totalQuantity: { $sum: '$items.quantity' },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 100 },
  ]);

  const popularityMap = new Map();
  let maxCampusQuantity = 1;

  for (const entry of campusPopularityAgg) {
    if (entry._id) {
      const qty = Number(entry.totalQuantity) || 0;
      popularityMap.set(String(entry._id), qty);
      if (qty > maxCampusQuantity) {
        maxCampusQuantity = qty;
      }
    }
  }

  // 3. Query all currently available food items with their active vendors
  const availableFoods = await FoodItem.find({ isAvailable: true })
    .populate('vendor', 'name shopName shopAddress averageRating reviewCount')
    .lean();

  // Filter out items without an existing/active vendor
  const validFoods = availableFoods.filter((food) => food.vendor && food.vendor._id);

  if (!validFoods.length) {
    return [];
  }

  const isColdStart = totalStudentItems === 0;

  // 4. Score each available food item (maintains distinct FoodItem + Vendor identity)
  const scoredItems = validFoods.map((food) => {
    const foodIdStr = String(food._id);
    const vendorIdStr = String(food.vendor._id);
    const vendorName = food.vendor.shopName || food.vendor.name || 'Campus Canteen';

    let categoryScore = 0;
    let vendorScore = 0;
    let discoveryScore = 0;
    let repeatScore = 0;

    const studentTimesOrdered = orderedFoodCounts[foodIdStr] || 0;
    const categoryOrders = food.category ? (categoryCounts[food.category] || 0) : 0;
    const vendorOrders = vendorCounts[vendorIdStr] || 0;

    if (!isColdStart) {
      // Category Affinity: up to 10 points
      categoryScore = (categoryOrders / totalStudentItems) * 10;

      // Vendor Affinity: up to 6 points
      vendorScore = (vendorOrders / totalStudentItems) * 6;

      // Avoid "just repeat past orders":
      // Give a discovery bonus for items student hasn't tried yet in categories or vendors they love
      if (studentTimesOrdered === 0) {
        if (categoryOrders > 0 || vendorOrders > 0) {
          discoveryScore = 5.0; // Boost unexplored items in favorite categories/vendors
        }
      } else if (studentTimesOrdered >= 3) {
        // High repeat favorite (e.g. daily coffee or favorite snack)
        repeatScore = 3.5;
      } else if (studentTimesOrdered === 2) {
        repeatScore = 2.0;
      } else {
        // Ordered just once: minor familiarity
        repeatScore = 0.5;
      }
    }

    // Popularity Score: up to 8 points
    const campusOrderedCount = popularityMap.get(foodIdStr) || 0;
    const popularityScore = (campusOrderedCount / maxCampusQuantity) * 8;

    // Vendor Rating Score: up to 2 points
    const averageRating = Number(food.vendor.averageRating) || 0;
    const ratingScore = (Math.min(averageRating, 5) / 5) * 2;

    const totalScore = Number(
      (categoryScore + vendorScore + discoveryScore + repeatScore + popularityScore + ratingScore).toFixed(1),
    );

    // 5. Generate human-readable reason from the dominant signal
    let reason = 'Recommended for you';

    if (isColdStart) {
      if (popularityScore >= 3.0) {
        reason = 'Popular among students on campus';
      } else if (averageRating >= 4.0) {
        reason = 'Highly rated on campus';
      } else {
        reason = 'Popular on campus';
      }
    } else {
      // Find the strongest signal that recommended this dish
      if (discoveryScore > 0 && categoryScore >= vendorScore && categoryOrders > 0) {
        reason = `Because you often order ${food.category}`;
      } else if (discoveryScore > 0 && vendorScore > categoryScore && vendorOrders > 0) {
        reason = `Popular from ${vendorName}`;
      } else if (repeatScore >= 3.0) {
        reason = 'One of your frequent favorites';
      } else if (categoryScore >= 3.0) {
        reason = `Because you enjoy ${food.category}`;
      } else if (vendorScore >= 2.5) {
        reason = `From your preferred vendor, ${vendorName}`;
      } else if (popularityScore >= 3.5) {
        reason = 'Popular among students on campus';
      } else if (averageRating >= 4.2) {
        reason = 'Top-rated dish on campus';
      } else {
        reason = 'Based on campus trends';
      }
    }

    return {
      ...food,
      score: totalScore,
      reason,
      signals: {
        categoryScore: Number(categoryScore.toFixed(1)),
        vendorScore: Number(vendorScore.toFixed(1)),
        popularityScore: Number(popularityScore.toFixed(1)),
        discoveryScore: Number(discoveryScore.toFixed(1)),
        repeatScore: Number(repeatScore.toFixed(1)),
        ratingScore: Number(ratingScore.toFixed(1)),
      },
    };
  });

  // 6. Select Top-N recommendations with score-aware diversity
  return selectTopRecommendations(scoredItems, limit);
};

/**
 * Selects top recommendations with score-aware diversity:
 * - Operates on (FoodItem + Vendor) units; does NOT blindly collapse by name.
 * - Allows up to 2 variations of the same food dish across different vendors if both
 *   have strong personalized scores (delta <= 3.0 points from primary instance).
 * - Defers 3rd+ vendor variations of the same dish to a fallback pool to prevent
 *   a single food name from dominating the Top-5 list when diverse alternatives exist.
 * - If fewer than limit items are selected, backfills from the deferred pool.
 * - Guarantees maximum `limit` items returned (or all eligible items if total < limit).
 *
 * @param {Array<object>} scoredItems - Array of scored food items with vendor information
 * @param {number} [limit=5] - Number of items to select
 * @returns {Array<object>} Final selected recommendation items
 */
const selectTopRecommendations = (scoredItems, limit = 5) => {
  if (!Array.isArray(scoredItems) || scoredItems.length === 0) {
    return [];
  }

  // Ensure items are sorted descending by score
  const sorted = [...scoredItems].sort((a, b) => b.score - a.score);

  const selected = [];
  const deferredPool = [];
  const nameCounts = new Map();
  const topScoresByName = new Map();

  for (const item of sorted) {
    if (selected.length >= limit) break;

    const normalizedName = (item.name || '').toLowerCase().trim();
    const count = nameCounts.get(normalizedName) || 0;

    if (count === 0) {
      // First instance of this dish name: always select
      selected.push(item);
      nameCounts.set(normalizedName, 1);
      topScoresByName.set(normalizedName, item.score);
    } else if (count === 1) {
      // Second vendor serving the same dish name:
      // Allow if score is close to the top instance (score delta <= 3.0)
      const primaryScore = topScoresByName.get(normalizedName) ?? item.score;
      const scoreDelta = primaryScore - item.score;

      if (scoreDelta <= 3.0) {
        selected.push(item);
        nameCounts.set(normalizedName, count + 1);
      } else {
        // Score difference is large; defer so other distinct dishes have a chance
        deferredPool.push(item);
      }
    } else {
      // 3rd+ vendor serving the same dish: defer to avoid crowding out variety
      deferredPool.push(item);
    }
  }

  // Backfill from deferred pool if limit hasn't been met and deferred items exist
  if (selected.length < limit && deferredPool.length > 0) {
    for (const item of deferredPool) {
      if (selected.length >= limit) break;
      selected.push(item);
    }
  }

  return selected.slice(0, limit);
};

module.exports = {
  getRecommendationsForStudent,
  selectTopRecommendations,
};
