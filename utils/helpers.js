/**
 * Utility Helper Functions
 */

/**
 * Computes product status based on expiry date
 * @param {Date} expiryDate
 * @returns {string} status
 */
const computeStatus = (expiryDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return "expired";
  if (daysLeft <= 7) return "urgent";
  if (daysLeft <= 30) return "expiring_soon";
  return "safe";
};

/**
 * Format date to readable string
 * @param {Date} date
 * @returns {string}
 */
const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

module.exports = { computeStatus, formatDate };