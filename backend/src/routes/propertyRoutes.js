const express = require("express");
const router = express.Router();

const { getPropertiesCkan } = require("../controllers/propertyCkanController");

// GET /api/properties -> CKAN
router.get("/", getPropertiesCkan);

module.exports = router;
