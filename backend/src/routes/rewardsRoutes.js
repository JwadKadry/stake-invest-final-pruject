const express = require("express");
const requireAuth = require("../middlewares/requireAuth");
const Investment = require("../models/Investment");

const router = express.Router();

// הגדרות פשוטות (אפשר להעביר ל-.env בהמשך)
const PLUS_THRESHOLD_ILS = 10000;       // להגיע ל-Plus אחרי השקעה של 10,000₪ ב-12 חודשים
const CASHBACK_RATE = 0.01;             // 1% Cashback (דמו)
const DEFAULT_BASE_URL = "http://localhost:5000";

function startOfLast12Months() {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d;
}

// GET /api/rewards/summary
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const uid = req.user._id || req.user.id;
    if (!uid) {
      return res.status(401).json({ status: "ERROR", message: "Unauthorized" });
    }

    // Use $in to match both ObjectId and string formats
    const userIdMatch = { $in: [uid, String(uid)] };
    const from = startOfLast12Months();

    const investments = await Investment.find({
      userId: userIdMatch,
      status: "ACTIVE",
      createdAt: { $gte: from },
    }).select("amount fee totalCharged createdAt").lean();

    const invested12m = investments.reduce((sum, x) => sum + (x.amount || 0), 0);
    const cashback = Math.round(invested12m * CASHBACK_RATE);

    // בדמו: אין לנו מערכת referrals/promotions עדיין
    const referrals = 0;
    const promotions = 0;

    const totalRewards = cashback + referrals + promotions;

    const progressPct = Math.max(
      0,
      Math.min(100, Math.round((invested12m / PLUS_THRESHOLD_ILS) * 100))
    );

    res.json({
      status: "OK",
      invested12m,
      totalRewards,
      breakdown: {
        cashback,
        referrals,
        promotions,
      },
      tier: {
        name: invested12m >= PLUS_THRESHOLD_ILS ? "Plus" : "Intro",
        threshold: PLUS_THRESHOLD_ILS,
        progressPct,
        remainingToPlus: Math.max(0, PLUS_THRESHOLD_ILS - invested12m),
      },
    });
  } catch (err) {
    console.error("[rewardsRoutes] summary error:", err);
    res.status(500).json({ status: "ERROR", message: "Failed to load rewards summary" });
  }
});

// GET /api/rewards/referral
router.get("/referral", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const base = process.env.FRONTEND_BASE_URL || DEFAULT_BASE_URL;
    const code = String(userId); // דמו: משתמשים ב-id כקוד הפניה
    const link = `${base}/register.html?ref=${encodeURIComponent(code)}`;
    res.json({ status: "OK", code, link });
  } catch (err) {
    console.error("[rewardsRoutes] referral error:", err);
    res.status(500).json({ status: "ERROR", message: "Failed to load referral" });
  }
});

module.exports = router;

