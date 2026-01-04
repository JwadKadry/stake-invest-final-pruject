const mongoose = require("mongoose");

const PropertyMetaSchema = new mongoose.Schema(
  {
    propertyId: { type: String, required: true, unique: true, index: true },
    targetAmount: { type: Number, default: 250000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PropertyMeta", PropertyMetaSchema);

