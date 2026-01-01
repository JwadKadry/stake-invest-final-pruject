const express = require("express");
const cors = require("cors");
const path = require("path");

const propertyRoutes = require("./routes/propertyRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, "../../frontend/public")));

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});
app.use("/api/properties", propertyRoutes);

app.use(errorHandler);

module.exports = app;

