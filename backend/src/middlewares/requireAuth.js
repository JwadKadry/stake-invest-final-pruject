// Simple authentication middleware
// TODO: Replace with your actual authentication logic
module.exports = (req, res, next) => {
  // For now, create a mock user for development
  // In production, verify JWT token or session here
  
  // Mock user object (replace with actual user from token/session)
  req.user = {
    _id: "507f1f77bcf86cd799439011", // Mock ObjectId
  };
  
  // Uncomment below to require actual authentication:
  // if (!req.user) {
  //   return res.status(401).json({ status: "ERROR", message: "Unauthorized" });
  // }
  
  next();
};

