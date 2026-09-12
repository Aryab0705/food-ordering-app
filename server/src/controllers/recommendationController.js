const asyncHandler = require('../utils/asyncHandler');
const recommendationService = require('../services/recommendationService');

/**
 * @desc    Get personalized food recommendations for the authenticated student
 * @route   GET /api/recommendations
 * @access  Private (Student only)
 */
const getRecommendations = asyncHandler(async (req, res) => {
  // Always enforce the student ID strictly from the authenticated token
  const studentId = req.user._id;

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);

  const recommendations = await recommendationService.getRecommendationsForStudent(studentId, limit);

  res.json({
    success: true,
    count: recommendations.length,
    recommendations,
  });
});

module.exports = {
  getRecommendations,
};
