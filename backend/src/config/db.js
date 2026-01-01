const mongoose = require("mongoose");

async function connectDB() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables. Please create a .env file with MONGO_URI.");
    }
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected:", conn.connection.host);
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
