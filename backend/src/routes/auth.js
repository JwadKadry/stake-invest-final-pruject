const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        status: "ERROR", 
        message: "Email and password are required" 
      });
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await User.findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (existingUser) {
      return res.status(409).json({ 
        status: "ERROR", 
        message: "User with this email already exists" 
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name || ""
    });

    // Set session
    req.session.userId = user._id;

    // Return user data (without password)
    res.status(201).json({ 
      status: "OK", 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name || "" 
      } 
    });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        status: "ERROR", 
        message: "Email and password are required" 
      });
    }

    // Find user by email (case-insensitive)
    const user = await User.findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (!user) {
      return res.status(401).json({ 
        status: "ERROR", 
        message: "Invalid credentials" 
      });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        status: "ERROR", 
        message: "Invalid credentials" 
      });
    }

    // Set session
    req.session.userId = user._id;

    // Return user data (without password)
    res.json({ 
      status: "OK", 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name || "" 
      } 
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ 
        status: "ERROR", 
        message: "Not logged in" 
      });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      // Session has invalid userId, clear it
      req.session.destroy(() => {});
      return res.status(401).json({ 
        status: "ERROR", 
        message: "Not logged in" 
      });
    }

    res.json({ 
      status: "OK", 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name || "" 
      } 
    });
  } catch (e) {
    console.error("Me error:", e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ status: "ERROR", message: "server error" });
    }
    res.json({ status: "OK" });
  });
});

module.exports = router;

