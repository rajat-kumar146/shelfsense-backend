const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const Product = require("../models/Product");
const router = express.Router();

// GET /api/notifications
// Returns categorized alerts based on current inventory state
router.get("/", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    const notifications = [];

    // Expired products
    const expired = await Product.find({ userId, status: "expired" })
      .sort({ expiryDate: 1 }).limit(10).lean();
    expired.forEach(p => {
      const daysAgo = Math.abs(Math.ceil((new Date(p.expiryDate) - now) / 86400000));
      notifications.push({
        id:       `exp-${p._id}`,
        type:     "expired",
        title:    "Product Expired",
        message:  `${p.productName} expired ${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`,
        product:  p.productName,
        imageBase64: p.imageBase64 || null,
        category: p.category,
        time:     p.expiryDate,
        priority: 1,
      });
    });

    // Urgent products (≤3 days)
    const urgent = await Product.find({ userId, status: "urgent" })
      .sort({ expiryDate: 1 }).limit(10).lean();
    urgent.forEach(p => {
      const daysLeft = Math.ceil((new Date(p.expiryDate) - now) / 86400000);
      notifications.push({
        id:       `urg-${p._id}`,
        type:     "urgent",
        title:    "Expires Very Soon",
        message:  `${p.productName} expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        product:  p.productName,
        imageBase64: p.imageBase64 || null,
        category: p.category,
        time:     p.expiryDate,
        priority: 2,
      });
    });

    // Expiring soon (≤7 days)
    const expiringSoon = await Product.find({ userId, status: "expiring_soon" })
      .sort({ expiryDate: 1 }).limit(10).lean();
    expiringSoon.forEach(p => {
      const daysLeft = Math.ceil((new Date(p.expiryDate) - now) / 86400000);
      notifications.push({
        id:       `soon-${p._id}`,
        type:     "expiring_soon",
        title:    "Expiring Soon",
        message:  `${p.productName} expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        product:  p.productName,
        imageBase64: p.imageBase64 || null,
        category: p.category,
        time:     p.expiryDate,
        priority: 3,
      });
    });

    // Sort by priority then by expiry date
    notifications.sort((a, b) => a.priority - b.priority || new Date(a.time) - new Date(b.time));

    res.json({
      notifications,
      counts: {
        total:        notifications.length,
        expired:      expired.length,
        urgent:       urgent.length,
        expiringSoon: expiringSoon.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;