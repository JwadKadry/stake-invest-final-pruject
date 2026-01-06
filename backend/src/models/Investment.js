const mongoose = require("mongoose");

const InvestmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },

    propertyId: { type: String, required: true },
    title: { type: String, default: "" },
    city: { type: String, default: "" },

    // Snapshot fields (stored at investment time for consistency)
    propertyTitle: { type: String, default: "" },
    propertyCity: { type: String, default: "" },
    propertyImageUrl: { type: String, default: "" },
    targetAmount: { type: Number, default: 0 },

    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "card" },

    status: { type: String, enum: ["ACTIVE", "CANCELED"], default: "ACTIVE" },
    refundAmount: { type: Number, default: 0 },
    retainedFee: { type: Number, default: 0 },
    canceledAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Investment", InvestmentSchema);

