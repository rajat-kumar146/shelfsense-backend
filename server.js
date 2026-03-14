/**
 * ShelfSense - Main Express Server
 */
const dotenv = require("dotenv");
dotenv.config(); // Must be first

const express    = require("express");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");
const connectDB  = require("./config/db");
const { errorHandler }           = require("./middleware/errorMiddleware");
const { verifyEmailTransporter } = require("./services/emailService");

// ─── Route imports ────────────────────────────────────────────────────────────
const authRoutes     = require("./routes/authRoutes");
const productRoutes  = require("./routes/productRoutes");
const reportRoutes   = require("./routes/reportRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const aiRoutes       = require("./routes/aiRoutes");
const lookupRoutes   = require("./routes/lookupRoutes");

// ─── Cron job ─────────────────────────────────────────────────────────────────
require("./cron/expiryChecker");

// ─── DB + Email ───────────────────────────────────────────────────────────────
connectDB();
verifyEmailTransporter();

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
}));

app.get("/", (req, res) => {
  res.send("ShelfSense API is running 🚀");
});


// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);
app.use("/api/products",  productRoutes);
app.use("/api/reports",   reportRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/ai",        aiRoutes);
app.use("/api/lookup",    lookupRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "ShelfSense API is running" });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 ShelfSense server running on port ${PORT}`);
});