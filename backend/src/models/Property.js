const express = require("express");
const router = express.Router();

const {
  // נשאיר את CRUD של MongoDB כמו שהוא
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
} = require("../controllers/propertyController");

// ✅ ייבוא של ה-CKAN handler
const { getPropertiesCkan } = require("../controllers/propertyCkanController");

// ✅ GET /api/properties -> CKAN
router.get("/", getPropertiesCkan);

// שאר הראוטים נשארים על MongoDB
router.get("/:id", getPropertyById);
router.post("/", createProperty);
router.put("/:id", updateProperty);
router.delete("/:id", deleteProperty);

module.exports = router;
