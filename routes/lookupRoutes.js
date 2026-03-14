const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

// GET /api/lookup/:barcode
// Proxies Open Food Facts to avoid CORS issues in the browser
router.get("/:barcode", protect, async (req, res) => {
  try {
    // Clean the barcode — strip anything that isn't digits
    const barcode = req.params.barcode.replace(/\D/g, "");

    if (!barcode || barcode.length < 4) {
      return res.status(400).json({ error: "Invalid barcode" });
    }

    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    console.log(`[Lookup] Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "ShelfSense/1.0 (inventory tracker)",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Open Food Facts request failed" });
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return res.status(404).json({ found: false, message: "Product not found in Open Food Facts" });
    }

    const p = data.product;

    // Map category
    const rawCategory = (p.categories || "").toLowerCase();
    let category = "Other";
    if (rawCategory.includes("beverage") || rawCategory.includes("drink") || rawCategory.includes("juice") || rawCategory.includes("water")) category = "Food & Beverages";
    else if (rawCategory.includes("dairy") || rawCategory.includes("milk") || rawCategory.includes("cheese") || rawCategory.includes("yogurt")) category = "Food & Beverages";
    else if (rawCategory.includes("snack") || rawCategory.includes("biscuit") || rawCategory.includes("chip") || rawCategory.includes("chocolate")) category = "Food & Beverages";
    else if (rawCategory.includes("cereal") || rawCategory.includes("bread") || rawCategory.includes("flour") || rawCategory.includes("rice")) category = "Food & Beverages";
    else if (rawCategory.includes("pharma") || rawCategory.includes("medicine") || rawCategory.includes("tablet") || rawCategory.includes("capsule")) category = "Pharmaceuticals";
    else if (rawCategory.includes("cosmetic") || rawCategory.includes("shampoo") || rawCategory.includes("soap") || rawCategory.includes("cream")) category = "Cosmetics & Personal Care";
    else if (rawCategory.includes("clean") || rawCategory.includes("detergent") || rawCategory.includes("wash")) category = "Cleaning Products";
    else if (p.product_name) category = "Food & Beverages"; // sensible default for food apps

    res.json({
      found: true,
      barcode,
      name:     p.product_name || p.product_name_en || "",
      brand:    p.brands || "",
      category,
      imageUrl: p.image_front_url || p.image_url || "",
      quantity: p.quantity || "",
      raw:      { categories: p.categories, labels: p.labels },
    });

  } catch (err) {
    console.error("[Lookup] Error:", err.message);
    res.status(500).json({ error: "Lookup failed: " + err.message });
  }
});

module.exports = router;