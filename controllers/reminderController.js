const User = require("../models/User");
const { sendExpiryAlert } = require("../services/emailService");

// GET /api/reminders/settings
const getSettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("reminderSettings");
    res.json(user.reminderSettings || {
      daysBeforeExpiry: [1, 7, 15, 30],
      emailNotifications: true,
      dashboardNotifications: true,
    });
  } catch (err) { next(err); }
};

// PUT /api/reminders/settings
const updateSettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.reminderSettings = { ...user.reminderSettings, ...req.body };
    await user.save();
    res.json(user.reminderSettings);
  } catch (err) { next(err); }
};

// POST /api/reminders/test
const sendTestEmail = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    await sendExpiryAlert(user.email, [
      {
        name: "Test Product — Milk",
        category: "Dairy",
        expiryDate: new Date(Date.now() + 3 * 86400000),
        quantity: 2,
        status: "urgent",
        daysUntilExpiry: 3,
      },
      {
        name: "Test Product — Bread",
        category: "Bakery",
        expiryDate: new Date(Date.now() + 7 * 86400000),
        quantity: 1,
        status: "expiring_soon",
        daysUntilExpiry: 7,
      },
    ]);
    res.json({ success: true, message: `Test email sent to ${user.email}` });
  } catch (err) {
    console.error("Test email error:", err.message);
    res.status(500).json({ error: "Failed to send email. Check EMAIL_USER and EMAIL_PASS in .env" });
  }
};

module.exports = { getSettings, updateSettings, sendTestEmail };