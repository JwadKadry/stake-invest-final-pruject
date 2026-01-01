const express = require("express");
const router = express.Router();

const {
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
} = require("../controllers/propertyController");

router.get("/", getProperties);
router.get("/:id", getPropertyById);
router.post("/", createProperty);
router.put("/:id", updateProperty);
router.delete("/:id", deleteProperty);



module.exports = router;
