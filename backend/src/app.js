const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");

const propertyRoutes = require("./routes/propertyRoutes");
const investmentRoutes = require("./routes/investments");
const favoritesRoutes = require("./routes/favorites");
const authRoutes = require("./routes/auth");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Session middleware (must be before routes)
app.use(session({
  secret: process.env.SESSION_SECRET || "stake-realestate-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // false for localhost (true only in production with HTTPS)
    httpOnly: true,
    sameSite: "lax", // Allows cookies on same-site requests
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static frontend
app.use(express.static(path.join(__dirname, "../../frontend/public")));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// DB status
const mongoose = require("mongoose");
app.get("/db-status", (req, res) => {
  const s = mongoose.connection.readyState;
  res.json({
    readyState: s,
    meaning: { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" }[s],
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/investments", investmentRoutes);
app.use("/api/favorites", favoritesRoutes);

// Errors
app.use(errorHandler);

// Catch-all for frontend pages (but NOT /api)
const INDEX_HTML_PATH = path.join(__dirname, "../../frontend/public/index.html");
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(INDEX_HTML_PATH);
});

module.exports = app;
