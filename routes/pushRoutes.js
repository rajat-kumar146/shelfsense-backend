const express   = require("express");
const webpush   = require("web-push");
const { protect } = require("../middleware/authMiddleware");
const User      = require("../models/User");

const router = express.Router();

// Configure VAPID
webpush.setVapidDetails(
  "mailto:" + (process.env.EMAIL_USER || "admin@shelfsense.app"),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// GET /api/push/vapid-public-key  — browser needs this to subscribe
router.get("/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe  — save browser subscription
router.post("/subscribe", protect, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ error: "Invalid subscription object" });
    }

    const user = await User.findById(req.user._id);

    // Store subscription — avoid duplicates by endpoint
    const exists = user.pushSubscriptions?.some(
      s => s.endpoint === subscription.endpoint
    );

    if (!exists) {
      if (!user.pushSubscriptions) user.pushSubscriptions = [];
      user.pushSubscriptions.push(subscription);
      await user.save();
    }

    console.log(`🔔 Push subscription saved for ${user.email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/push/unsubscribe  — remove subscription
router.post("/unsubscribe", protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const user = await User.findById(req.user._id);
    user.pushSubscriptions = (user.pushSubscriptions || []).filter(
      s => s.endpoint !== endpoint
    );
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/push/test  — send a test push to current user
router.post("/test", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const subs = user.pushSubscriptions || [];

    if (subs.length === 0) {
      return res.status(400).json({ error: "No push subscriptions found for this user. Enable notifications first." });
    }

    const payload = JSON.stringify({
      title:    "🛡️ ShelfSense Test",
      body:     "Push notifications are working!",
      type:     "test",
    });

    const results = await Promise.allSettled(
      subs.map(sub => webpush.sendNotification(sub, payload))
    );

    // Remove expired/invalid subscriptions
    const valid = subs.filter((_, i) => results[i].status === "fulfilled");
    if (valid.length !== subs.length) {
      user.pushSubscriptions = valid;
      await user.save();
    }

    res.json({ success: true, sent: valid.length });
  } catch (err) {
    console.error("Test push error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Helper — send push to a user (used by cron)
const sendPushToUser = async (user, payload) => {
  const subs = user.pushSubscriptions || [];
  if (subs.length === 0) return;

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(sub, JSON.stringify(payload)))
  );

  // Clean up invalid subscriptions
  const valid = subs.filter((_, i) => results[i].status === "fulfilled");
  if (valid.length !== subs.length) {
    user.pushSubscriptions = valid;
    await user.save();
  }

  console.log(`🔔 Push sent to ${user.email} (${valid.length}/${subs.length} endpoints)`);
};

module.exports = { router, sendPushToUser };