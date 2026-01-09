const mongoose = require("mongoose");

const PropertyMetaSchema = new mongoose.Schema(
  {
    propertyId: { type: String, required: true, unique: true, index: true },
    targetAmount: { type: Number, default: 250000 },
    imageUrl: { type: String, default: null }, // Cached image URL from Pexels
  },
  { timestamps: true }
);

module.exports = mongoose.model("PropertyMeta", PropertyMetaSchema);

