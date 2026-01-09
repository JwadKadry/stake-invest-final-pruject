// Authentication middleware - requires session
// ✅ Checks session.userId (source of truth) - not cookies or localStorage
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    // 🔍 DEBUG (enable with DEBUG_AUTH=1)
    if (process.env.DEBUG_AUTH === "1") {
      console.log("AUTH HEADERS cookie:", req.headers.cookie);
      console.log("AUTH PARSED cookies:", req.cookies);
      console.log("AUTH session:", req.session);
      console.log("AUTH session.userId:", req.session?.userId);
    }

    // ✅ Check session (source of truth for authentication - not cookies/localStorage)
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        status: "ERROR", 
        message: "Unauthorized" 
      });
    }

    // Load user from database for backward compatibility (controllers use req.user._id)
    const user = await User.findById(req.session.userId);
    if (!user) {
      // Invalid userId in session, clear it
      req.session.destroy(() => {});
      return res.status(401).json({ 
        status: "ERROR", 
        message: "Unauthorized" 
      });
    }

    // Attach user and userId to request
    req.userId = req.session.userId;
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

