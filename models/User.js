/**
 * User Model - Multi-tenant SaaS user schema
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const reminderSettingsSchema = new mongoose.Schema({
  daysBeforeExpiry: {
    type: [Number],
    default: [30, 15, 7, 1], // Default reminder days
  },
  emailNotifications: {
    type: Boolean,
    default: true,
  },
  dashboardNotifications: {
    type: Boolean,
    default: true,
  },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password in queries by default
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: [200, "Company name cannot exceed 200 characters"],
    },
    role: {
      type: String,
      enum: ["admin", "manager", "staff"],
      default: "admin",
    },
    reminderSettings: {
      type: reminderSettingsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// ─── Hash password before saving ──────────────────────────────────────────────
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── Compare entered password with hashed password ────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
