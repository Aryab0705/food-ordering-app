const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const cartItemSchema = new mongoose.Schema(
  {
    food: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodItem',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['student', 'vendor'],
      required: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    shopName: {
      type: String,
      trim: true,
      required: function requireShopName() {
        return this.role === 'vendor';
      },
    },
    shopAddress: {
      type: String,
      trim: true,
      required: function requireShopAddress() {
        return this.role === 'vendor';
      },
    },
    upiId: {
      type: String,
      trim: true,
      default: '',
    },
    bankDetails: {
      bankName: {
        type: String,
        trim: true,
        default: '',
      },
      accountHolderName: {
        type: String,
        trim: true,
        default: '',
      },
      accountNumber: {
        type: String,
        trim: true,
        default: '',
      },
      ifscCode: {
        type: String,
        trim: true,
        default: '',
      },
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    bookmarkedVendors: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
    cart: {
      type: [cartItemSchema],
      default: [],
    },
    loginOtpHash: {
      type: String,
      default: '',
    },
    loginOtpExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.pre('save', async function savePassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
