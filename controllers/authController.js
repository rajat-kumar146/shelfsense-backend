/**
 * Authentication Controller
 * Handles register, login, profile operations
 */

const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/User");

// ─── Generate JWT Token ────────────────────────────────────────────────────────
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// ─── Register User ─────────────────────────────────────────────────────────────
// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, email, password, companyName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }

    // Create user (password hashed in model pre-save hook)
    const user = await User.create({
      name,
      email,
      password,
      companyName,
    });

    res.status(201).json({
      message: "Account created successfully",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        role: user.role,
        reminderSettings: user.reminderSettings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Login User ────────────────────────────────────────────────────────────────
// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    // Find user with password field included
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({
      message: "Login successful",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        role: user.role,
        reminderSettings: user.reminderSettings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Profile ───────────────────────────────────────────────────────────────
// GET /api/auth/profile
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      companyName: user.companyName,
      role: user.role,
      reminderSettings: user.reminderSettings,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Update Profile ────────────────────────────────────────────────────────────
// PUT /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, companyName } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, companyName },
      { new: true, runValidators: true }
    );

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Update Password ───────────────────────────────────────────────────────────
// PUT /api/auth/password
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getProfile, updateProfile, updatePassword };