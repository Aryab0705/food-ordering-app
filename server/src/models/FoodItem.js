const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    foodType: {
      type: String,
      enum: ['veg', 'non-veg'],
      default: 'veg',
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    estimatedPrepTime: {
      type: Number,
      default: 10,
      min: 1,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

foodItemSchema.index({ isAvailable: 1 });

module.exports = mongoose.model('FoodItem', foodItemSchema);
