const mongoose = require("mongoose");

const InvestmentSchema = new mongoose.Schema(
  {
    // בהמשך: userId (אם יש login)
    propertyId: { type: String, required: true },
    title: { type: String, default: "" },
    city: { type: String, default: "" },

    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "card" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Investment", InvestmentSchema);

