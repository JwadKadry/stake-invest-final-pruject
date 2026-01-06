const express = require("express");
const Favorite = require("../models/Favorite");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/favorites - return user favorites sorted by createdAt desc
router.get("/", async (req, res) => {
  try {
    const userId = req.user._id;
    const favorites = await Favorite.find({ userId })
      .sort({ createdAt: -1 });
    
    res.json({ status: "OK", data: favorites });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// POST /api/favorites - add favorite
router.post("/", async (req, res) => {
  try {
    const userId = req.user._id;
    const { propertyId, title, city, imageUrl } = req.body;

    if (!propertyId) {
      return res.status(400).json({ 
        status: "ERROR", 
        message: "propertyId is required" 
      });
    }

    // Check if already exists (upsert behavior)
    const existing = await Favorite.findOne({ 
      userId, 
      propertyId: String(propertyId) 
    });

    if (existing) {
      // Update existing favorite with new snapshot data
      existing.title = title || existing.title || "";
      existing.city = city || existing.city || "";
      existing.imageUrl = imageUrl || existing.imageUrl || "";
      await existing.save();
      return res.json({ status: "OK", data: existing });
    }

    // Create new favorite
    const favorite = await Favorite.create({
      userId,
      propertyId: String(propertyId),
      title: title || "",
      city: city || "",
      imageUrl: imageUrl || "",
    });

    res.status(201).json({ status: "OK", data: favorite });
  } catch (e) {
    // Handle duplicate key error (shouldn't happen due to check, but just in case)
    if (e.code === 11000) {
      return res.status(409).json({ 
        status: "ERROR", 
        message: "Favorite already exists" 
      });
    }
    console.error(e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// DELETE /api/favorites/:propertyId - remove favorite
router.delete("/:propertyId", async (req, res) => {
  try {
    const userId = req.user._id;
    const { propertyId } = req.params;

    const favorite = await Favorite.findOneAndDelete({ 
      userId, 
      propertyId: String(propertyId) 
    });

    if (!favorite) {
      return res.status(404).json({ 
        status: "ERROR", 
        message: "Favorite not found" 
      });
    }

    res.json({ status: "OK" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

module.exports = router;

