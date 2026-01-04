const express = require("express");
const cors = require("cors");
const path = require("path");

const propertyRoutes = require("./routes/propertyRoutes");
const investmentRoutes = require("./routes/investments");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

// Static frontend
app.use(express.static(path.join(__dirname, "../../frontend/public")));

// Root → index.html
app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../frontend/public/index.html")
  );
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// API
app.use("/api/properties", propertyRoutes);
app.use("/api/investments", investmentRoutes);

// Errors
app.use(errorHandler);

module.exports = app;
const mongoose = require("mongoose");

app.get("/db-status", (req, res) => {
  const s = mongoose.connection.readyState;
  res.json({
    readyState: s,
    meaning: { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" }[s],
  });
});
