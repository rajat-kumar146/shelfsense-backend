const express = require("express");
const { body } = require("express-validator");
const {
  getProducts,
  getStats,
  getProduct,
  addProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// All routes require authentication
router.use(protect);

const productValidation = [
  body("productName").trim().notEmpty().withMessage("Product name is required"),
  body("expiryDate").isISO8601().withMessage("Valid expiry date is required"),
  body("quantity")
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage("Valid quantity is required"),
  body("category").notEmpty().withMessage("Category is required"),
];

router.get("/stats", getStats);
router.get("/", getProducts);
router.get("/:id", getProduct);
router.post("/", productValidation, addProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;