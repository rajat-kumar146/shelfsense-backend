/**
 * Reports Controller
 * Generates CSV / Excel exports
 */

const Product = require("../models/Product");
const XLSX = require("xlsx");

// ─── Helper: Format product row ────────────────────────────────────────────────
const formatRow = (p) => ({
  "Product Name": p.productName,
  Category: p.category,
  Barcode: p.barcode || "",
  "Batch Number": p.batchNumber || "",
  Quantity: p.quantity,
  "Manufacture Date": p.manufactureDate
    ? new Date(p.manufactureDate).toLocaleDateString()
    : "",
  "Expiry Date": new Date(p.expiryDate).toLocaleDateString(),
  Status: p.status.replace("_", " ").toUpperCase(),
  Notes: p.notes || "",
  "Created At": new Date(p.createdAt).toLocaleDateString(),
});

// GET /api/reports/export?type=csv|excel&filter=all|expired|expiring
const exportReport = async (req, res, next) => {
  try {
    const { type = "csv", filter = "all" } = req.query;

    // Build filter
    const dbFilter = { userId: req.user._id };
    const today = new Date();

    if (filter === "expired") {
      dbFilter.status = "expired";
    } else if (filter === "expiring") {
      dbFilter.status = { $in: ["urgent", "expiring_soon"] };
    }

    const products = await Product.find(dbFilter).sort({ expiryDate: 1 });
    const rows = products.map(formatRow);

    if (type === "excel") {
      // Generate Excel file
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory Report");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=shelfsense-report-${Date.now()}.xlsx`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    } else {
      // Generate CSV
      if (rows.length === 0) {
        return res.status(404).json({ error: "No products found" });
      }

      const headers = Object.keys(rows[0]).join(",");
      const csvRows = rows.map((row) =>
        Object.values(row)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );

      const csv = [headers, ...csvRows].join("\n");

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=shelfsense-report-${Date.now()}.csv`
      );
      res.setHeader("Content-Type", "text/csv");
      return res.send(csv);
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { exportReport };