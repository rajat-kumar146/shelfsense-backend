const nodemailer = require("nodemailer");

let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return _transporter;
}

const verifyEmailTransporter = () => {
  getTransporter().verify((err) => {
    if (err) {
      console.error("❌ Email transporter error:", err.message);
      console.error("   Check EMAIL_USER and EMAIL_PASS in your .env");
    } else {
      console.log("✅ Email ready:", process.env.EMAIL_USER);
    }
  });
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

const statusMeta = (s) => ({
  expired:       { label: "EXPIRED",       bg: "#450a0a", border: "#991b1b", color: "#fca5a5", dot: "#ef4444" },
  urgent:        { label: "URGENT",        bg: "#431407", border: "#9a3412", color: "#fdba74", dot: "#f97316" },
  expiring_soon: { label: "EXPIRING SOON", bg: "#451a03", border: "#92400e", color: "#fcd34d", dot: "#f59e0b" },
  safe:          { label: "SAFE",          bg: "#052e16", border: "#166534", color: "#86efac", dot: "#34d399" },
}[s] || { label: s, bg: "#1a1a24", border: "#252535", color: "#9ca3af", dot: "#6b7280" });

const sendExpiryAlert = async (toEmail, products = []) => {
  if (!products.length) return;

  const urgentCount      = products.filter(p => p.status === "urgent").length;
  const expiredCount     = products.filter(p => p.status === "expired").length;
  const expiringSoonCount = products.filter(p => p.status === "expiring_soon").length;

  const summaryItems = [
    expiredCount      > 0 && `<td style="padding:0 8px;text-align:center;"><div style="background:#450a0a;border:1px solid #991b1b;border-radius:10px;padding:14px 20px;min-width:80px;"><p style="color:#fca5a5;font-size:22px;font-weight:800;margin:0;font-family:Georgia,serif;">${expiredCount}</p><p style="color:#f87171;font-size:11px;font-weight:600;margin:4px 0 0;text-transform:uppercase;letter-spacing:0.08em;">Expired</p></div></td>`,
    urgentCount       > 0 && `<td style="padding:0 8px;text-align:center;"><div style="background:#431407;border:1px solid #9a3412;border-radius:10px;padding:14px 20px;min-width:80px;"><p style="color:#fdba74;font-size:22px;font-weight:800;margin:0;font-family:Georgia,serif;">${urgentCount}</p><p style="color:#fb923c;font-size:11px;font-weight:600;margin:4px 0 0;text-transform:uppercase;letter-spacing:0.08em;">Urgent</p></div></td>`,
    expiringSoonCount > 0 && `<td style="padding:0 8px;text-align:center;"><div style="background:#451a03;border:1px solid #92400e;border-radius:10px;padding:14px 20px;min-width:80px;"><p style="color:#fcd34d;font-size:22px;font-weight:800;margin:0;font-family:Georgia,serif;">${expiringSoonCount}</p><p style="color:#fbbf24;font-size:11px;font-weight:600;margin:4px 0 0;text-transform:uppercase;letter-spacing:0.08em;">Expiring Soon</p></div></td>`,
  ].filter(Boolean).join("");

  const rows = products.map((p, i) => {
    const meta = statusMeta(p.status);
    const daysText = p.daysUntilExpiry < 0
      ? `${Math.abs(p.daysUntilExpiry)}d ago`
      : p.daysUntilExpiry === 0
      ? "Today"
      : `${p.daysUntilExpiry}d left`;
    const rowBg = i % 2 === 0 ? "#0d0d14" : "#111118";
    return `
      <tr style="background:${rowBg};">
        <td style="padding:14px 18px;border-bottom:1px solid #1a1a24;">
          <p style="color:#f1f5f9;font-size:14px;font-weight:600;margin:0;">${p.name}</p>
          ${p.quantity ? `<p style="color:#4b5563;font-size:12px;margin:3px 0 0;">Qty: ${p.quantity}</p>` : ""}
        </td>
        <td style="padding:14px 18px;border-bottom:1px solid #1a1a24;">
          <span style="color:#6b7280;font-size:13px;">${p.category || "—"}</span>
        </td>
        <td style="padding:14px 18px;border-bottom:1px solid #1a1a24;">
          <span style="color:#9ca3af;font-size:13px;">${formatDate(p.expiryDate)}</span>
        </td>
        <td style="padding:14px 18px;border-bottom:1px solid #1a1a24;">
          <span style="display:inline-block;padding:4px 12px;border-radius:99px;background:${meta.bg};border:1px solid ${meta.border};color:${meta.color};font-size:11px;font-weight:700;letter-spacing:0.06em;">
            ${meta.label}
          </span>
        </td>
        <td style="padding:14px 18px;border-bottom:1px solid #1a1a24;text-align:right;">
          <span style="color:${meta.dot};font-size:13px;font-weight:700;font-family:'Courier New',monospace;">${daysText}</span>
        </td>
      </tr>`;
  }).join("");

  const now = new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ShelfSense Alert</title>
</head>
<body style="margin:0;padding:0;background:#06060a;font-family:'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#06060a;padding:40px 16px;">
    <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- ── Header bar ── -->
      <tr>
        <td style="background:linear-gradient(135deg,#111118 0%,#1a1208 100%);border:1px solid #2a1f08;border-radius:16px 16px 0 0;padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#f59e0b;border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                      <span style="font-size:22px;line-height:44px;">🛡️</span>
                    </td>
                    <td style="padding-left:14px;vertical-align:middle;">
                      <p style="color:#ffffff;font-size:20px;font-weight:800;margin:0;letter-spacing:-0.3px;">ShelfSense</p>
                      <p style="color:#78716c;font-size:12px;margin:2px 0 0;">Inventory Management</p>
                    </td>
                  </tr>
                </table>
              </td>
              <td align="right" style="vertical-align:middle;">
                <span style="background:#1f1508;border:1px solid #f59e0b44;color:#f59e0b;font-size:11px;font-weight:600;padding:5px 12px;border-radius:99px;letter-spacing:0.06em;">
                  ⚠️ EXPIRY ALERT
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ── Hero section ── -->
      <tr>
        <td style="background:#0d0d14;border-left:1px solid #1a1a24;border-right:1px solid #1a1a24;padding:32px 32px 24px;">
          <p style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px;">
            ${now}
          </p>
          <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 12px;line-height:1.2;letter-spacing:-0.5px;">
            ${products.length} product${products.length > 1 ? "s require" : " requires"} your attention
          </h1>
          <p style="color:#6b7280;font-size:15px;margin:0;line-height:1.7;">
            Your ShelfSense inventory scan has detected items that are expiring soon or have already expired.
            Take action now to minimise waste and stay compliant.
          </p>
        </td>
      </tr>

      <!-- ── Summary tiles ── -->
      <tr>
        <td style="background:#0d0d14;border-left:1px solid #1a1a24;border-right:1px solid #1a1a24;padding:0 32px 28px;">
          <table cellpadding="0" cellspacing="0">
            <tr>${summaryItems}</tr>
          </table>
        </td>
      </tr>

      <!-- ── Divider ── -->
      <tr>
        <td style="background:#0d0d14;border-left:1px solid #1a1a24;border-right:1px solid #1a1a24;padding:0 32px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,#f59e0b44,transparent);"></div>
        </td>
      </tr>

      <!-- ── Products table ── -->
      <tr>
        <td style="background:#0d0d14;border-left:1px solid #1a1a24;border-right:1px solid #1a1a24;padding:24px 32px 0;">
          <p style="color:#374151;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px;">
            Product Details
          </p>
        </td>
      </tr>
      <tr>
        <td style="border-left:1px solid #1a1a24;border-right:1px solid #1a1a24;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <thead>
              <tr style="background:#0a0a10;border-top:1px solid #1a1a24;border-bottom:1px solid #1a1a24;">
                <th style="padding:11px 18px;text-align:left;color:#374151;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Product</th>
                <th style="padding:11px 18px;text-align:left;color:#374151;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Category</th>
                <th style="padding:11px 18px;text-align:left;color:#374151;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Expiry Date</th>
                <th style="padding:11px 18px;text-align:left;color:#374151;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Status</th>
                <th style="padding:11px 18px;text-align:right;color:#374151;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Days</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </td>
      </tr>

      <!-- ── CTA ── -->
      <tr>
        <td style="background:#0d0d14;border-left:1px solid #1a1a24;border-right:1px solid #1a1a24;padding:32px;text-align:center;">
          <a href="${clientUrl}/products"
            style="display:inline-block;background:#f59e0b;color:#111111;font-size:15px;font-weight:800;padding:15px 40px;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;box-shadow:0 4px 24px #f59e0b44;">
            View Full Inventory →
          </a>
          <p style="color:#374151;font-size:12px;margin:16px 0 0;">
            Or visit <a href="${clientUrl}/dashboard" style="color:#f59e0b;text-decoration:none;">${clientUrl}/dashboard</a>
          </p>
        </td>
      </tr>

      <!-- ── Tips box ── -->
      <tr>
        <td style="background:#0a0a10;border:1px solid #1a1a24;border-top:none;padding:20px 32px;">
          <p style="color:#374151;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;">💡 Quick Tips</p>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="color:#4b5563;font-size:12px;padding:3px 0;line-height:1.6;">• Use FIFO (First In, First Out) to rotate stock and reduce waste.</td>
            </tr>
            <tr>
              <td style="color:#4b5563;font-size:12px;padding:3px 0;line-height:1.6;">• Expired products should be removed and disposed of immediately.</td>
            </tr>
            <tr>
              <td style="color:#4b5563;font-size:12px;padding:3px 0;line-height:1.6;">• Adjust your alert thresholds in ShelfSense Reminder Settings.</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ── Footer ── -->
      <tr>
        <td style="background:#06060a;border:1px solid #111118;border-top:none;border-radius:0 0 16px 16px;padding:24px 32px;text-align:center;">
          <p style="color:#1f2937;font-size:12px;margin:0 0 6px;">
            Sent by <strong style="color:#374151;">ShelfSense</strong> · Inventory Expiry Tracker
          </p>
          <p style="color:#111827;font-size:11px;margin:0;">
            You're receiving this because email alerts are enabled for your account.<br>
            To unsubscribe, disable email notifications in
            <a href="${clientUrl}/reminders" style="color:#374151;text-decoration:underline;">Reminder Settings</a>.
          </p>
          <p style="color:#0f172a;font-size:11px;margin:12px 0 0;">© ${new Date().getFullYear()} ShelfSense. All rights reserved.</p>
        </td>
      </tr>

    </table>
    </td></tr>
  </table>

</body>
</html>`;

  await getTransporter().sendMail({
    from: `"ShelfSense Alerts" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `⚠️ ${products.length} product${products.length > 1 ? "s" : ""} expiring soon — ShelfSense`,
    html,
  });

  console.log(`📧 Alert sent to ${toEmail} (${products.length} products)`);
};

module.exports = { sendExpiryAlert, verifyEmailTransporter };