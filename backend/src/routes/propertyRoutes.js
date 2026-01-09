const router = require("express").Router();
const propertyController = require("../controllers/propertyController");
const Property = require("../models/Property");

// GET /api/properties/random?limit=20
// Returns random properties using MongoDB $sample aggregation
router.get("/random", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));

    const properties = await Property.aggregate([
      { $sample: { size: limit } }
    ]);

    // Map to DTO format (same as getProperties)
    const mappedProperties = properties.map(propertyController.mapPropertyToDTO);

    res.json({
      status: "OK",
      count: mappedProperties.length,
      data: mappedProperties,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "ERROR", message: "Failed to load random properties" });
  }
});

router.get("/", propertyController.getProperties);
router.get("/stats", propertyController.getStats);
router.get("/:id", propertyController.getPropertyById);

module.exports = router;
