require("dotenv").config();
const mongoose = require("mongoose");
const Property = require("../models/Property");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  await Property.deleteMany({}); // אופציונלי: לנקות לפני
  await Property.insertMany([
    {
      title: "דירת בדיקה בחיפה",
      price: 1200000,
      currency: "ILS",
      city: "Haifa",
      type: "apartment",
      listingStatus: "for-sale",
    },
    {
      title: "דירת 2 חדרים תל אביב",
      price: 2100000,
      currency: "ILS",
      city: "Tel Aviv",
      type: "apartment",
      listingStatus: "for-sale",
    },
    {
      title: "בית פרטי בכרמיאל",
      price: 2850000,
      currency: "ILS",
      city: "Karmiel",
      type: "house",
      listingStatus: "for-sale",
    },
  ]);

  console.log("Seed completed ✅");
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
