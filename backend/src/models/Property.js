const mongoose = require("mongoose");

const PropertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, index: true },
    address: { type: String, required: true },
    city: { type: String, required: true, index: true },
    price: { type: Number, required: true, index: true }, // ₪
    beds: { type: Number, default: 0 },
    baths: { type: Number, default: 0 },
    sqm: { type: Number, default: 0 }, // Square meters
    type: { 
      type: String, 
      enum: ["Apartment", "House", "Penthouse", "Studio"],
      required: true,
      index: true
    },
    imageUrl: { type: String, default: "" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    
    // Investment fields (for backward compatibility with PropertyMeta)
    targetAmount: { type: Number, default: null }, // Optional: for investment properties
    investedAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "funded"], default: "open" },
  },
  { timestamps: true }
);

// Indexes for common queries
PropertySchema.index({ city: 1, price: 1 });
PropertySchema.index({ city: 1, type: 1 });
PropertySchema.index({ lat: 1, lng: 1 });

// Virtual field: אחוז = investedAmount / targetAmount * 100
PropertySchema.virtual("investedPercent").get(function () {
  if (!this.targetAmount || this.targetAmount === 0) return 0;
  return Math.round((this.investedAmount / this.targetAmount) * 100 * 100) / 100;
});

// Ensure virtual fields are serialized
PropertySchema.set("toJSON", { virtuals: true });
PropertySchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Property", PropertySchema);
