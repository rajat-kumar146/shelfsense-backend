/**
 * ShelfSense — Daily Expiry Checker Cron Job
 * Runs at midnight every day.
 * For each user with email notifications ON, sends an alert
 * if any products match their configured alert thresholds.
 */

const cron = require("node-cron");
const User = require("../models/User");
const Product = require("../models/Product");
const { sendExpiryAlert } = require("../services/emailService");
let sendPushToUser = null;
try { sendPushToUser = require("../routes/pushRoutes").sendPushToUser; } catch(e) { /* optional */ }
const { computeStatus } = require("../utils/helpers");

const runExpiryCheck = async () => {
  console.log(`\n🕛 [ExpiryChecker] Running at ${new Date().toLocaleString("en-IN")}`);

  try {
    // Get all users who have email notifications enabled
    const users = await User.find({
      "reminderSettings.emailNotifications": true,
    });

    console.log(`   Found ${users.length} user(s) with email notifications ON`);

    if (users.length === 0) {
      console.log("   No users to notify. Done.");
      return;
    }

    for (const user of users) {
      try {
        const settings = user.reminderSettings || {};
        const thresholds = settings.daysBeforeExpiry?.length
          ? settings.daysBeforeExpiry
          : [1, 7, 15, 30]; // default thresholds

        console.log(`\n   👤 Checking ${user.email} | thresholds: [${thresholds.join(", ")}]d`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find all non-expired products for this user
        const allProducts = await Product.find({
          userId: user._id,
          expiryDate: { $gte: today },
        }).lean();

        console.log(`      Total active products: ${allProducts.length}`);

        if (allProducts.length === 0) {
          console.log("      No active products — skipping.");
          continue;
        }

        // Find products that match any of the alert thresholds
        // A product matches if its days-until-expiry equals one of the thresholds exactly
        // ALSO always include expired products (daysLeft < 0) and urgent (≤ 3 days)
        const alertProducts = [];

        for (const product of allProducts) {
          const msLeft   = new Date(product.expiryDate) - new Date();
          const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

          // Recompute and update status
          const newStatus = computeStatus(new Date(product.expiryDate));
          if (newStatus !== product.status) {
            await Product.findByIdAndUpdate(product._id, { status: newStatus });
            product.status = newStatus;
          }

          // Include if daysLeft matches any threshold (±0 day window)
          // or if product is expired or urgent
          const matchesThreshold = thresholds.some(t => daysLeft <= t && daysLeft > (t - 1));
          const isUrgentOrExpired = daysLeft <= 3;

          if (matchesThreshold || isUrgentOrExpired) {
            alertProducts.push({ ...product, daysUntilExpiry: daysLeft });
          }
        }

        console.log(`      Products triggering alerts: ${alertProducts.length}`);

        if (alertProducts.length === 0) {
          console.log("      No products hit thresholds today — skipping email.");
          continue;
        }

        // Sort by days left ascending (most urgent first)
        alertProducts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

        // Send the alert email
        await sendExpiryAlert(user.email, alertProducts.map(p => ({
          name:           p.productName || p.name || "Unknown Product",
          category:       p.category || "—",
          expiryDate:     p.expiryDate,
          quantity:       p.quantity,
          status:         p.status,
          daysUntilExpiry: p.daysUntilExpiry,
        })));

        console.log(`      ✅ Alert sent to ${user.email} (${alertProducts.length} products)`);

        // Send push notification
        if (sendPushToUser) {
          const expiredCount = alertProducts.filter(p => p.status === "expired").length;
          const urgentCount  = alertProducts.filter(p => p.status === "urgent").length;
          const type = expiredCount > 0 ? "expired" : urgentCount > 0 ? "urgent" : "expiring_soon";
          try {
            await sendPushToUser(user, {
              title: expiredCount > 0 ? "⛔ Products Expired!"
                   : urgentCount  > 0 ? "⚠️ Urgent: Products Expiring Soon!"
                   : "📦 Products Expiring Soon",
              body:  `${alertProducts.length} product${alertProducts.length > 1 ? "s" : ""} need your attention in ShelfSense.`,
              type,
              count: alertProducts.length,
            });
          } catch(pushErr) {
            console.warn("      ⚠️ Push failed:", pushErr.message);
          }
        }

      } catch (userErr) {
        console.error(`      ❌ Error processing user ${user.email}:`, userErr.message);
      }
    }

    console.log("\n🕛 [ExpiryChecker] Done.\n");

  } catch (err) {
    console.error("❌ [ExpiryChecker] Fatal error:", err.message);
  }
};

// ── Push-only check (no email) — runs every 6 hours ─────────────────────────
const runPushOnlyCheck = async () => {
  console.log(`
🔔 [PushChecker] Running at ${new Date().toLocaleString("en-IN")}`);
  if (!sendPushToUser) {
    console.log("   Push not available — skipping.");
    return;
  }

  try {
    const users = await User.find({});
    for (const user of users) {
      try {
        if (!user.pushSubscriptions?.length) continue;

        const now = new Date();
        const urgent = await Product.find({
          userId: user._id,
          status: { $in: ["expired", "urgent", "expiring_soon"] },
        }).lean();

        if (!urgent.length) continue;

        const expiredCount      = urgent.filter(p => p.status === "expired").length;
        const urgentCount       = urgent.filter(p => p.status === "urgent").length;
        const expiringSoonCount = urgent.filter(p => p.status === "expiring_soon").length;

        const type = expiredCount > 0 ? "expired"
                   : urgentCount  > 0 ? "urgent"
                   : "expiring_soon";

        const title = expiredCount > 0 ? `⛔ ${expiredCount} product${expiredCount > 1 ? "s" : ""} expired!`
                    : urgentCount  > 0 ? `⚠️ ${urgentCount} product${urgentCount > 1 ? "s" : ""} expiring very soon!`
                    : `📦 ${expiringSoonCount} product${expiringSoonCount > 1 ? "s" : ""} expiring soon`;

        const body = [
          expiredCount      > 0 && `${expiredCount} expired`,
          urgentCount       > 0 && `${urgentCount} urgent`,
          expiringSoonCount > 0 && `${expiringSoonCount} expiring soon`,
        ].filter(Boolean).join(" · ") + " — tap to view";

        await sendPushToUser(user, { title, body, type, count: urgent.length });
        console.log(`   🔔 Push sent to ${user.email} (${urgent.length} products)`);
      } catch (err) {
        console.warn(`   ⚠️ Push failed for ${user.email}:`, err.message);
      }
    }
    console.log("[PushChecker] Done.");
  } catch (err) {
    console.error("❌ [PushChecker] Fatal error:", err.message);
  }
};

// ── Email check — once daily at 10 AM IST ────────────────────────────────────
cron.schedule("0 10 * * *", runExpiryCheck, {
  timezone: "Asia/Kolkata",
});
console.log("📅 Email alerts scheduled — daily at 10 AM IST");

// ── Push notifications — every 6 hours (6 AM, 12 PM, 6 PM, 12 AM IST) ────────
cron.schedule("0 6,12,18,0 * * *", runPushOnlyCheck, {
  timezone: "Asia/Kolkata",
});
console.log("🔔 Push notifications scheduled — every 6 hours IST");

// Export for manual triggering
module.exports = { runExpiryCheck, runPushOnlyCheck };