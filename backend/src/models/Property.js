const mongoose = require("mongoose");

const PropertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    city: { type: String, required: true },
    externalId: { type: String, index: true }, // "1" מהדאטה שלך
    targetAmount: { type: Number, required: true }, // למשל 1,000,000 ₪
    investedAmount: { type: Number, default: 0 }, // מתעדכן
    status: { type: String, enum: ["open", "funded"], default: "open" },
  },
  { timestamps: true }
);

// Virtual field: אחוז = investedAmount / targetAmount * 100
PropertySchema.virtual("investedPercent").get(function () {
  if (!this.targetAmount || this.targetAmount === 0) return 0;
  return (this.investedAmount / this.targetAmount) * 100;
});

// Ensure virtual fields are serialized
PropertySchema.set("toJSON", { virtuals: true });
PropertySchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Property", PropertySchema);
