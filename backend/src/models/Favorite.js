const mongoose = require("mongoose");

const FavoriteSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: true, 
      ref: "User",
      index: true
    },
    propertyId: { 
      type: String, 
      required: true,
      index: true
    },
    title: { type: String, default: "" },
    city: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

// Unique compound index to prevent duplicates
FavoriteSchema.index({ userId: 1, propertyId: 1 }, { unique: true });

module.exports = mongoose.model("Favorite", FavoriteSchema);

