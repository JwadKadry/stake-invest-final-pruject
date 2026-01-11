// Admin middleware - requires user to be in ADMIN_EMAILS env var
// ✅ Must be used AFTER requireAuth middleware
module.exports = function requireAdmin(req, res, next) {
  const email = (req.user?.email || "").toLowerCase();

  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  if (!email || !admins.includes(email)) {
    return res.status(403).json({
      status: "ERROR",
      message: "Admin access only"
    });
  }

  next();
};

