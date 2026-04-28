const crypto = require('crypto');
const User = require('../models/User');
const FoodItem = require('../models/FoodItem');
const Order = require('../models/Order');
const VendorReview = require('../models/VendorReview');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('../utils/asyncHandler');
const sendOtpEmail = require('../utils/sendOtpEmail');

const OTP_EXPIRY_MINUTES = 10;

const formatAuthResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  shopName: user.shopName,
  shopAddress: user.shopAddress,
  upiId: user.upiId,
  bankDetails: user.bankDetails,
  token: generateToken(user._id),
});

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

const createOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;

const saveAndSendOtp = async (user) => {
  const otp = createOtp();

  user.loginOtpHash = hashOtp(otp);
  user.loginOtpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await user.save();

  await sendOtpEmail({
    email: user.email,
    name: user.name,
    otp,
  });
};

const BOOKMARK_VENDOR_FIELDS = 'name shopName shopAddress averageRating reviewCount';

const getBookmarkedVendors = async (userId) => {
  const user = await User.findById(userId).populate('bookmarkedVendors', BOOKMARK_VENDOR_FIELDS);
  const bookmarks = user?.bookmarkedVendors || [];

  if (!bookmarks.length) {
    return [];
  }

  const vendorIds = bookmarks.map((vendor) => vendor._id);
  const summary = await VendorReview.aggregate([
    { $match: { vendor: { $in: vendorIds } } },
    {
      $group: {
        _id: '$vendor',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const ratingMap = summary.reduce((result, vendor) => {
    result[String(vendor._id)] = {
      averageRating: Number(vendor.averageRating.toFixed(1)),
      reviewCount: vendor.reviewCount,
    };
    return result;
  }, {});

  return bookmarks.map((vendor) => ({
    ...vendor.toObject(),
    averageRating: ratingMap[String(vendor._id)]?.averageRating ?? vendor.averageRating ?? 0,
    reviewCount: ratingMap[String(vendor._id)]?.reviewCount ?? vendor.reviewCount ?? 0,
  }));
};

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, shopName, shopAddress, upiId, bankDetails } = req.body;

  if (!name || !email || !password || !role) {
    res.status(400);
    throw new Error('Name, email, password, and role are required');
  }

  if (!['student', 'vendor'].includes(role)) {
    res.status(400);
    throw new Error('Role must be student or vendor');
  }

  if (role === 'vendor' && (!shopName || !shopAddress)) {
    res.status(400);
    throw new Error('Vendor accounts require a shop name and shop address');
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });

  if (existingUser) {
    res.status(400);
    throw new Error('User already exists with this email');
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    shopName: role === 'vendor' ? shopName : '',
    shopAddress: role === 'vendor' ? shopAddress : '',
    upiId: role === 'vendor' ? upiId || '' : '',
    bankDetails:
      role === 'vendor'
        ? {
            bankName: bankDetails?.bankName || '',
            accountHolderName: bankDetails?.accountHolderName || '',
            accountNumber: bankDetails?.accountNumber || '',
            ifscCode: bankDetails?.ifscCode || '',
          }
        : undefined,
  });

  res.status(201).json(formatAuthResponse(user));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email?.toLowerCase() });

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  await saveAndSendOtp(user);

  res.json({
    requiresOtp: true,
    email: user.email,
    message: 'OTP sent to your email address',
  });
});

const verifyLoginOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error('Email and OTP are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user || !user.loginOtpHash || !user.loginOtpExpiresAt) {
    res.status(400);
    throw new Error('Please request a new OTP and try again');
  }

  if (user.loginOtpExpiresAt.getTime() < Date.now()) {
    user.loginOtpHash = '';
    user.loginOtpExpiresAt = null;
    await user.save();

    res.status(400);
    throw new Error('OTP has expired. Please request a new one');
  }

  if (user.loginOtpHash !== hashOtp(otp)) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  user.loginOtpHash = '';
  user.loginOtpExpiresAt = null;
  await user.save();

  res.json(formatAuthResponse(user));
});

const resendLoginOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  await saveAndSendOtp(user);

  res.json({ message: 'A fresh OTP has been sent to your email' });
});

const getProfile = asyncHandler(async (req, res) => {
  res.json(req.user);
});

const getBookmarks = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') {
    res.status(403);
    throw new Error('Only students can manage bookmarked restaurants');
  }

  const bookmarks = await getBookmarkedVendors(req.user._id);
  res.json(bookmarks);
});

const addBookmark = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') {
    res.status(403);
    throw new Error('Only students can manage bookmarked restaurants');
  }

  const { vendorId } = req.body;

  if (!vendorId) {
    res.status(400);
    throw new Error('Vendor is required');
  }

  const vendor = await User.findOne({ _id: vendorId, role: 'vendor' });

  if (!vendor) {
    res.status(404);
    throw new Error('Restaurant not found');
  }

  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { bookmarkedVendors: vendor._id },
  });

  const bookmarks = await getBookmarkedVendors(req.user._id);
  res.json(bookmarks);
});

const removeBookmark = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') {
    res.status(403);
    throw new Error('Only students can manage bookmarked restaurants');
  }

  await User.findByIdAndUpdate(req.user._id, {
    $pull: { bookmarkedVendors: req.params.vendorId },
  });

  const bookmarks = await getBookmarkedVendors(req.user._id);
  res.json(bookmarks);
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const { name, email, phone, password, shopName, shopAddress, upiId, bankDetails } = req.body;

  if (email && email.toLowerCase() !== user.email) {
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      res.status(400);
      throw new Error('Another user already uses this email');
    }
  }

  user.name = name || user.name;
  user.email = email ? email.toLowerCase() : user.email;
  user.phone = phone ?? user.phone;

  if (user.role === 'vendor') {
    if (!shopName || !shopAddress) {
      res.status(400);
      throw new Error('Vendor accounts require a shop name and shop address');
    }

    user.shopName = shopName;
    user.shopAddress = shopAddress;
    user.upiId = upiId ?? user.upiId;
    user.bankDetails = {
      bankName: bankDetails?.bankName ?? user.bankDetails?.bankName ?? '',
      accountHolderName:
        bankDetails?.accountHolderName ?? user.bankDetails?.accountHolderName ?? '',
      accountNumber: bankDetails?.accountNumber ?? user.bankDetails?.accountNumber ?? '',
      ifscCode: bankDetails?.ifscCode ?? user.bankDetails?.ifscCode ?? '',
    };
  }

  if (password) {
    user.password = password;
  }

  const updatedUser = await user.save();
  res.json(formatAuthResponse(updatedUser));
});

const deleteProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.role === 'vendor') {
    const vendorFoodItems = await FoodItem.find({ vendor: user._id }).select('_id');
    const foodIds = vendorFoodItems.map((item) => item._id);

    await User.updateMany({}, { $pull: { bookmarkedVendors: user._id } });

    if (foodIds.length) {
      await User.updateMany({}, { $pull: { cart: { food: { $in: foodIds } } } });
      await FoodItem.deleteMany({ vendor: user._id });
    }
  }

  if (user.role === 'student') {
    await Order.deleteMany({ student: user._id });
  }

  await user.deleteOne();

  res.json({ message: 'Account deleted successfully' });
});

module.exports = {
  registerUser,
  loginUser,
  verifyLoginOtp,
  resendLoginOtp,
  getProfile,
  getBookmarks,
  addBookmark,
  removeBookmark,
  updateProfile,
  deleteProfile,
};
