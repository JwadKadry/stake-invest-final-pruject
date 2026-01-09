// src/routes/citiesRoutes.js
const express = require("express");
const router = express.Router();
const { getCities } = require("../controllers/citiesController");

// GET /api/cities?q=search_term
router.get("/", getCities);

module.exports = router;

