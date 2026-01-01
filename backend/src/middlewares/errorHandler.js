module.exports = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
  
    // לוג שרואים מיד בטרמינל
    console.error("ERROR:", {
      message: err.message,
      statusCode,
      path: req.originalUrl,
      method: req.method,
    });
  
    res.status(statusCode).json({
      status: "ERROR",
      message: err.message || "Something went wrong",
    });
  };
  