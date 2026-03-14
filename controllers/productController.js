/**
 * Product Controller
 * CRUD operations for inventory products
 */

const { validationResult } = require("express-validator");
const Product = require("../models/Product");
const { computeStatus } = require("../utils/helpers");

// ─── Get All Products ──────────────────────────────────────────────────────────
// GET /api/products
const getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status,
      sortBy = "expiryDate",
      sortOrder = "asc",
    } = req.query;

    const filter = { userId: req.user._id };

    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
        { batchNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (category && category !== "All") filter.category = category;
    if (status) filter.status = status;

    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Dashboard Stats ───────────────────────────────────────────────────────
// GET /api/products/stats
const getStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Status counts
    const statusAgg = await Product.aggregate([
      { $match: { userId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statusCounts = { safe: 0, expiring_soon: 0, urgent: 0, expired: 0 };
    statusAgg.forEach((s) => {
      if (s._id in statusCounts) statusCounts[s._id] = s.count;
    });

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    // Category breakdown — field name: "categories" (matches Dashboard)
    const categories = await Product.aggregate([
      { $match: { userId } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    // Monthly forecast — next 6 months (field name: "monthly", matches Dashboard)
    const now = new Date();
    const monthly = [];

    for (let i = 0; i < 6; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59);

      const count = await Product.countDocuments({
        userId,
        expiryDate: { $gte: start, $lte: end },
      });

      monthly.push({
        month: start.toLocaleString("default", { month: "short", year: "2-digit" }),
        count,
      });
    }

    res.json({
      total,
      ...statusCounts,
      // expiringSoon alias so Dashboard can read either key
      expiringSoon: statusCounts.expiring_soon,
      categories,
      monthly,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Single Product ────────────────────────────────────────────────────────
// GET /api/products/:id
const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
};

// ─── Add Product ───────────────────────────────────────────────────────────────
// POST /api/products
const addProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const {
      productName,
      barcode,
      batchNumber,
      manufactureDate,
      expiryDate,
      quantity,
      category,
      notes,
    } = req.body;

    const status = computeStatus(new Date(expiryDate));

    const product = await Product.create({
      userId: req.user._id,
      productName,
      barcode,
      batchNumber,
      manufactureDate,
      expiryDate,
      quantity,
      category,
      notes,
      status,
    });

    res.status(201).json({ message: "Product added successfully", product });
  } catch (error) {
    next(error);
  }
};

// ─── Update Product ────────────────────────────────────────────────────────────
// PUT /api/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (req.body.expiryDate) {
      req.body.status = computeStatus(new Date(req.body.expiryDate));
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({ message: "Product updated successfully", product: updated });
  } catch (error) {
    next(error);
  }
};

// ─── Delete Product ────────────────────────────────────────────────────────────
// DELETE /api/products/:id
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getStats,
  getProduct,
  addProduct,
  updateProduct,
  deleteProduct,
};