const router = require("express").Router();
const requireAuth = require("../middlewares/requireAuth");
const requireAdmin = require("../middlewares/requireAdmin");
const Investment = require("../models/Investment");
const User = require("../models/User");

// GET /api/admin/investments
router.get("/investments", requireAuth, requireAdmin, async (req, res) => {
  try {
    const investments = await Investment.find({})
      .populate("userId", "email name")
      .sort({ createdAt: -1 })
      .lean();

    let totalInvested = 0;
    let totalFees = 0;

    const data = investments.map(inv => {
      totalInvested += inv.amount || 0;
      totalFees += inv.fee || 0;

      return {
        id: String(inv._id),
        investorEmail: inv.userId?.email || "",
        investorName: inv.userId?.name || "",
        propertyId: inv.propertyId,
        title: inv.title || inv.propertyTitle,
        city: inv.city || inv.propertyCity,
        amount: inv.amount,
        fee: inv.fee,
        totalCharged: inv.totalCharged || inv.total,
        status: inv.status,
        createdAt: inv.createdAt
      };
    });

    res.json({
      status: "OK",
      stats: {
        totalInvested,
        totalFees,
        count: data.length
      },
      data
    });
  } catch (e) {
    console.error("[adminRoutes] Error:", e);
    res.status(500).json({ status: "ERROR", message: e.message || "server error" });
  }
});

// GET /api/admin/cancel-requests
router.get("/cancel-requests", requireAuth, requireAdmin, async (req, res) => {
  try {
    const requests = await Investment.find({ status: "CANCEL_REQUESTED" })
      .populate("userId", "email name")
      .sort({ cancelRequestedAt: -1, createdAt: -1 })
      .lean();

    const data = requests.map(inv => ({
      id: String(inv._id),
      investorEmail: inv.userId?.email || "",
      investorName: inv.userId?.name || "",
      propertyId: inv.propertyId,
      title: inv.propertyTitle || inv.title || "",
      city: inv.propertyCity || inv.city || "",
      amount: inv.amount,
      fee: inv.fee,
      totalCharged: inv.totalCharged || inv.total,
      cancelReason: inv.cancelReason || "",
      cancelRequestedAt: inv.cancelRequestedAt,
      createdAt: inv.createdAt
    }));

    res.json({ status: "OK", data });
  } catch (e) {
    console.error("[adminRoutes] cancel-requests Error:", e);
    res.status(500).json({ status: "ERROR", message: e.message || "server error" });
  }
});

// POST /api/admin/investments/:id/approve-cancel (legacy - keep for backward compatibility)
router.post("/investments/:id/approve-cancel", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const inv = await Investment.findById(id);
    
    if (!inv) {
      return res.status(404).json({ status: "ERROR", message: "Not found" });
    }

    if (inv.status !== "CANCEL_REQUESTED") {
      return res.status(400).json({ 
        status: "ERROR", 
        message: "Investment is not in CANCEL_REQUESTED status" 
      });
    }

    inv.status = "CANCELED";
    inv.cancelReviewedAt = new Date();
    inv.cancelReviewedBy = req.user._id || req.user.id;
    await inv.save();

    res.json({ status: "OK", message: "Cancel approved" });
  } catch (e) {
    console.error("[adminRoutes] approve-cancel Error:", e);
    res.status(500).json({ status: "ERROR", message: e.message || "server error" });
  }
});

// POST /api/admin/investments/:id/review-cancel
router.post("/investments/:id/review-cancel", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "approve" | "reject"

    const investment = await Investment.findById(id);
    if (!investment) {
      return res.status(404).json({ status: "ERROR", message: "Investment not found" });
    }

    if (investment.status !== "CANCEL_REQUESTED") {
      return res.status(400).json({ status: "ERROR", message: "No cancel request" });
    }

    if (action === "approve") {
      investment.status = "CANCELED";
    } else if (action === "reject") {
      investment.status = "ACTIVE";
    } else {
      return res.status(400).json({ status: "ERROR", message: "Invalid action. Use 'approve' or 'reject'" });
    }

    investment.cancelReviewedAt = new Date();
    investment.cancelReviewedBy = req.user._id || req.user.id;

    await investment.save();

    res.json({ status: "OK", message: `Cancel ${action}d successfully` });
  } catch (e) {
    console.error("[adminRoutes] review-cancel Error:", e);
    res.status(500).json({ status: "ERROR", message: e.message || "server error" });
  }
});

// GET /api/admin/user-history?email=someone@mail.com
router.get("/user-history", requireAuth, requireAdmin, async (req, res) => {
  try {
    const email = String(req.query.email || "").toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ status: "ERROR", message: "email query is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ status: "OK", user: null, investments: [] });
    }

    // propertyId is String, not ref, so no populate needed
    const investments = await Investment.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = investments.map(inv => ({
      createdAt: inv.createdAt,
      status: inv.status,
      amount: inv.amount,
      fee: inv.fee,
      totalCharged: inv.totalCharged || inv.total,
      property: {
        id: inv.propertyId,
        title: inv.propertyTitle || inv.title || "",
        city: inv.propertyCity || inv.city || "",
      }
    }));

    return res.json({
      status: "OK",
      user: { email: user.email, name: user.name, id: String(user._id) },
      investments: formatted,
    });
  } catch (err) {
    console.error("[adminRoutes] user-history Error:", err);
    return res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

module.exports = router;

