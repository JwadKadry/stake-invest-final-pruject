// Authentication middleware - requires session
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    // Check if user has valid session
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        status: "ERROR", 
        message: "Unauthorized" 
      });
    }

    // Load user from database
    const user = await User.findById(req.session.userId);
    if (!user) {
      // Invalid userId in session, clear it
      req.session.destroy(() => {});
      return res.status(401).json({ 
        status: "ERROR", 
        message: "Unauthorized" 
      });
    }

    // Attach user to request
    req.user = {
      _id: user._id,
      id: user._id, // Support both _id and id
      email: user.email,
      name: user.name
    };

    next();
  } catch (e) {
    console.error("Auth middleware error:", e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
};

