const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
    return mongoose.connection;
  } catch (err) {
    // חשוב: לזרוק החוצה כדי ש-server.js יחליט מה לעשות
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }
}

module.exports = connectDB;
