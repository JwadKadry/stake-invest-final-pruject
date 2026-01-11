const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/User");
const { sendMail } = require("../services/mailer");

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

    // ✅ Regenerate session (best practice against session fixation)
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regenerate error:", err);
        return res.status(500).json({ 
          status: "ERROR", 
          message: "Session error" 
        });
      }

      // ✅ Set session userId (source of truth for authentication)
      req.session.userId = user._id.toString();

      // ✅ Save session before responding (ensures cookie is set)
      // Use Promise wrapper since req.session.save() is callback-based
      new Promise((resolve, reject) => {
        req.session.save((saveErr) => {
          if (saveErr) reject(saveErr);
          else resolve();
        });
      })
      .then(() => {
        // Return user data (without password)
        return res.status(201).json({ 
          status: "OK", 
          user: { 
            id: user._id, 
            email: user.email, 
            name: user.name || "" 
          } 
        });
      })
      .catch((saveErr) => {
        console.error("Session save error:", saveErr);
        return res.status(500).json({ 
          status: "ERROR", 
          message: "Session save failed" 
        });
      });
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

    // ✅ Regenerate session (best practice against session fixation)
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regenerate error:", err);
        return res.status(500).json({ 
          status: "ERROR", 
          message: "Session error" 
        });
      }

      // ✅ Set session userId (source of truth for authentication)
      req.session.userId = user._id.toString();

      // ✅ Save session before responding (ensures cookie is set)
      // Use Promise wrapper since req.session.save() is callback-based
      new Promise((resolve, reject) => {
        req.session.save((saveErr) => {
          if (saveErr) reject(saveErr);
          else resolve();
        });
      })
      .then(() => {
        // Return user data (without password)
        return res.json({ 
          status: "OK", 
          user: { 
            id: user._id, 
            email: user.email, 
            name: user.name || "" 
          } 
        });
      })
      .catch((saveErr) => {
        console.error("Session save error:", saveErr);
        return res.status(500).json({ 
          status: "ERROR", 
          message: "Session save failed" 
        });
      });
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// GET /api/auth/me - Returns current user session status
router.get("/me", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(200).json({ 
        loggedIn: false,
        user: null,
        isAdmin: false
      });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      // Session has invalid userId, clear it
      req.session.destroy(() => {});
      return res.status(200).json({ 
        loggedIn: false,
        user: null,
        isAdmin: false
      });
    }

    // Check if user is admin
    const email = (user.email || "").toLowerCase();
    const admins = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = admins.includes(email);

    // ✅ Return consistent format with loggedIn flag and isAdmin
    res.json({ 
      loggedIn: true,
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name || "" 
      },
      isAdmin
    });
  } catch (e) {
    console.error("Me error:", e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ status: "ERROR", message: "email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // תמיד מחזירים OK כדי לא לחשוף אם המייל קיים או לא
    if (!user) {
      return res.json({ status: "OK" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 דקות
    await user.save();

    const base = process.env.FRONTEND_BASE_URL || "http://localhost:5000";
    const resetLink = `${base}/reset-password.html?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    await sendMail({
      to: user.email,
      subject: "Reset your password",
      text: `Reset your password using this link (valid 15 minutes): ${resetLink}`,
      html: `
        <div style="font-family:Arial;line-height:1.6">
          <h2>Password reset</h2>
          <p>Click the button to reset your password (valid for 15 minutes):</p>
          <p><a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:8px">Reset Password</a></p>
          <p>If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    });

    return res.json({ status: "OK" });
  } catch (err) {
    console.error("forgot-password error:", err);
    return res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ status: "ERROR", message: "email, token, newPassword are required" });
    }

    // (לא חובה) בדיקת חוזק סיסמה בסיסית
    if (newPassword.length < 8) {
      return res.status(400).json({ status: "ERROR", message: "password must be at least 8 chars" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.resetPasswordTokenHash || !user.resetPasswordExpiresAt) {
      return res.status(400).json({ status: "ERROR", message: "Invalid or expired token" });
    }

    if (user.resetPasswordExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ status: "ERROR", message: "Invalid or expired token" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    if (tokenHash !== user.resetPasswordTokenHash) {
      return res.status(400).json({ status: "ERROR", message: "Invalid or expired token" });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.passwordHash = passwordHash;

    // מנקים טוקן אחרי שימוש
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;

    await user.save();

    return res.json({ status: "OK" });
  } catch (err) {
    console.error("reset-password error:", err);
    return res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  // ✅ Clear session cookie explicitly (use the custom name from app.js)
  res.clearCookie("stake.sid", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ status: "ERROR", message: "server error" });
    }
    res.json({ status: "OK" });
  });
});

module.exports = router;

