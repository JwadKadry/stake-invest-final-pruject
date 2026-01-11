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

    amount: { type: Number, required: true }, // נטו לנכס
    fee: { type: Number, default: 0 }, // עמלה
    total: { type: Number, default: 0 }, // תאימות לאחור - totalCharged
    totalCharged: { type: Number, default: 0 }, // מה שהמשתמש שילם בפועל = amount + fee
    paymentMethod: { type: String, default: "card" },

    status: { type: String, enum: ["ACTIVE", "CANCEL_REQUESTED", "CANCELED"], default: "ACTIVE" },
    refundAmount: { type: Number, default: 0 },
    retainedFee: { type: Number, default: 0 },
    canceledAt: { type: Date },
    paidAt: { type: Date }, // Payment confirmation timestamp
    
    // ✅ Cancel request fields
    cancelReason: { type: String, default: null },
    cancelRequestedAt: { type: Date, default: null },
    cancelReviewedAt: { type: Date, default: null },
    cancelReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Investment", InvestmentSchema);

