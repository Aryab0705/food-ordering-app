const express = require('express');
const {
  addBookmark,
  deleteProfile,
  getBookmarks,
  getProfile,
  loginUser,
  removeBookmark,
  registerUser,
  resendLoginOtp,
  updateProfile,
  verifyLoginOtp,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-login-otp', verifyLoginOtp);
router.post('/resend-login-otp', resendLoginOtp);
router.get('/me', protect, getProfile);
router.get('/bookmarks', protect, getBookmarks);
router.post('/bookmarks', protect, addBookmark);
router.delete('/bookmarks/:vendorId', protect, removeBookmark);
router.put('/me', protect, updateProfile);
router.delete('/me', protect, deleteProfile);

module.exports = router;
