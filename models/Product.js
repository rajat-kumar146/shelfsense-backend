/**
 * Product Model - Core inventory item schema
 */

const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // Multi-tenancy: each product belongs to a user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    barcode: {
      type: String,
      trim: true,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    manufactureDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "Food & Beverages",
        "Pharmaceuticals",
        "Cosmetics & Personal Care",
        "Cleaning Products",
        "Electronics",
        "Industrial",
        "Other",
      ],
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    // Computed status - updated by cron job
    status: {
      type: String,
      enum: ["safe", "expiring_soon", "urgent", "expired"],
      default: "safe",
      index: true,
    },
    // Track if reminder was sent for each threshold
    remindersSent: {
      type: [Number],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ─── Virtual: days until expiry ───────────────────────────────────────────────
productSchema.virtual("daysUntilExpiry").get(function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(this.expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
});

// ─── Compound index for efficient user+status queries ─────────────────────────
productSchema.index({ userId: 1, status: 1 });
productSchema.index({ userId: 1, expiryDate: 1 });
productSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model("Product", productSchema);