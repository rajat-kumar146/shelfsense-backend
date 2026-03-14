/**
 * JWT Authentication Middleware
 * Protects routes from unauthorized access
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  // Check for Bearer token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Extract token
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request (excluding password)
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res
          .status(401)
          .json({ error: "User not found, authorization denied" });
      }

      next();
    } catch (error) {
      console.error("Auth middleware error:", error.message);
      return res
        .status(401)
        .json({ error: "Token invalid or expired, please log in again" });
    }
  }

  if (!token) {
    return res
      .status(401)
      .json({ error: "No authentication token, access denied" });
  }
};

module.exports = { protect };