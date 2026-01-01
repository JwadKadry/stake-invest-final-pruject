const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: 0,
      // set: (v) => Math.round(v), // אופציונלי
    },
    currency: {
      type: String,
      default: "ILS",
      enum: ["ILS", "USD", "EUR", "AED"],
    },

    address: { type: String, trim: true, maxlength: 200, default: "" },
    city: {
      type: String,
      trim: true,
      maxlength: 80,
      required: [true, "City is required"],
    },
    country: { type: String, trim: true, maxlength: 80, default: "Israel" },

    bedrooms: { type: Number, min: 0, default: 0 },
    bathrooms: { type: Number, min: 0, default: 0 },
    areaSqm: { type: Number, min: 0 },

    type: {
      type: String,
      required: [true, "Type is required"],
      enum: ["apartment", "house", "villa", "office", "land", "other"],
      default: "apartment",
    },
    listingStatus: {
      type: String,
      enum: ["for-sale", "for-rent", "sold", "rented"],
      default: "for-sale",
    },

    images: { type: [{ type: String, trim: true }], default: [] },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

propertySchema.index({ city: 1, type: 1, listingStatus: 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ createdAt: -1 });






module.exports = mongoose.model("Property", propertySchema);
