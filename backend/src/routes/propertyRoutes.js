const router = require("express").Router();
const propertyController = require("../controllers/propertyController");

router.get("/", propertyController.getProperties);
router.get("/:id", propertyController.getPropertyById);

module.exports = router;
