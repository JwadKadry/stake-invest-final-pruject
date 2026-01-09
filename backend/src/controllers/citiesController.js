// src/controllers/citiesController.js
const Property = require("../models/Property");

/**
 * GET /api/cities?q=te&limit=10
 * Returns list of unique cities from MongoDB based on search query
 * Response format: { status: "OK", count: number, data: string[] }
 */
exports.getCities = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(25, Math.max(1, Number(req.query.limit || 10)));

    // Build filter - if q is provided, use regex search
    const filter = q 
      ? { city: { $regex: q, $options: "i" } } // Case-insensitive regex
      : {};

    // Get distinct cities from MongoDB
    const cities = await Property.distinct("city", filter);

    // Sort alphabetically (English locale)
    const sortedCities = cities
      .filter(Boolean) // Remove null/undefined
      .sort((a, b) => a.localeCompare(b, "en"));

    // Apply limit
    const result = sortedCities.slice(0, limit);

    res.json({
      status: "OK",
      count: result.length,
      data: result,
    });
  } catch (err) {
    console.error("[getCities] Error:", err);
    res.status(500).json({ 
      status: "ERROR",
      message: "Failed to load cities" 
    });
  }
};

