const express = require("express");
const { getSettings, updateSettings, sendTestEmail } = require("../controllers/reminderController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/settings", protect, getSettings);
router.put("/settings", protect, updateSettings);
router.post("/test",    protect, sendTestEmail);

module.exports = router;

// POST /api/reminders/run-check  (manual trigger for testing)
const { runExpiryCheck, runPushOnlyCheck } = require("../cron/expiryChecker");

router.post("/run-check", protect, async (req, res) => {
  try {
    await runExpiryCheck();
    res.json({ success: true, message: "Email check completed — check backend terminal for details" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/run-push", protect, async (req, res) => {
  try {
    await runPushOnlyCheck();
    res.json({ success: true, message: "Push notification sent — check backend terminal for details" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});