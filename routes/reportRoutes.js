const express = require("express");
const { exportReport } = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/export", exportReport);

module.exports = router;