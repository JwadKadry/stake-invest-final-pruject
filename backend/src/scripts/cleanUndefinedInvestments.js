require("dotenv").config();
const mongoose = require("mongoose");
const Investment = require("../models/Investment");

async function cleanUndefinedInvestments() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error("MONGO_URI is missing in backend/.env");
    }

    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");

    // מוחק השקעות עם propertyId: "undefined"
    const result = await Investment.deleteMany({ propertyId: "undefined" });

    console.log(`✅ Deleted ${result.deletedCount} investments with propertyId: "undefined"`);

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

cleanUndefinedInvestments();

