const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema(
  {
    email: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: { 
      type: String, 
      required: true 
    },
    name: { 
      type: String, 
      default: "" 
    },
  },
  { timestamps: true }
);

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model("User", UserSchema);

