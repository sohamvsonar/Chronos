/**
 * Calculate VIP tier based on total spent
 * @param {number} totalSpent - Total amount spent by customer
 * @returns {string} VIP tier (Gold, Silver, or Bronze)
 */
function calculateVipTier(totalSpent) {
  const amount = parseFloat(totalSpent) || 0;

  if (amount > 10000) {
    return 'Gold';
  } else if (amount > 5000) {
    return 'Silver';
  } else {
    return 'Bronze';
  }
}

module.exports = {
  calculateVipTier,
};
