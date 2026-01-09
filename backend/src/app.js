const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const mongoose = require("mongoose");

const propertyRoutes = require("./routes/propertyRoutes");
const investmentRoutes = require("./routes/investments");
const favoritesRoutes = require("./routes/favorites");
const authRoutes = require("./routes/auth");
const citiesRoutes = require("./routes/citiesRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

// ✅ CORS configuration for cross-origin requests with credentials
const allowedOrigins = [
  "http://localhost:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5000",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list or same-origin
    if (allowedOrigins.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      callback(null, true);
    } else {
      callback(null, true); // For development, allow all. In production, use: callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // ✅ Required for cookies/session
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ✅ Cookie parser (must be before session middleware)
app.use(cookieParser());

// JSON body parser (must be before routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware (must be before routes)
// ✅ Use MongoDB store for session persistence (survives server restarts)
// Note: mongoUrl will connect when first session is created (lazy connection)
const sessionStore = process.env.MONGO_URI 
  ? MongoStore.create({
      mongoUrl: process.env.MONGO_URI, // ✅ Will connect when first session is saved (lazy)
      collectionName: "sessions", // ✅ Store sessions in "sessions" collection
      autoRemove: "native", // ✅ Use MongoDB TTL index for cleanup
    })
  : undefined; // Fallback to MemoryStore if MONGO_URI not set

app.use(session({
  name: "stake.sid", // ✅ Custom session cookie name
  secret: process.env.SESSION_SECRET || "stake-realestate-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  store: sessionStore, // ✅ Use MongoDB store if MONGO_URI is set, otherwise MemoryStore
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // ✅ false for localhost. In production with HTTPS: true
    maxAge: 1000 * 60 * 60 * 24, // ✅ 1 day
  }
}));

// Static frontend
app.use(express.static(path.join(__dirname, "../../frontend/public")));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// DB status
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
app.use("/api/cities", citiesRoutes);

// Errors
app.use(errorHandler);

// Catch-all for frontend pages (but NOT /api)
const INDEX_HTML_PATH = path.join(__dirname, "../../frontend/public/index.html");
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(INDEX_HTML_PATH);
});

module.exports = app;
