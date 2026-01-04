const mongoose = require("mongoose");
const Property = require("../models/Property");

async function findPropertyByAnyId(propertyId) {
  if (!propertyId) return null;

  // אם זה ObjectId אמיתי
  if (mongoose.isValidObjectId(propertyId)) {
    const byMongoId = await Property.findById(propertyId);
    if (byMongoId) return byMongoId;
  }

  // אחרת זה externalId ("1", "308", וכו')
  return Property.findOne({ externalId: String(propertyId) });
}

module.exports = { findPropertyByAnyId };

