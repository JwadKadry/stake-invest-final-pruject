const express = require("express");
const mongoose = require("mongoose");
const Investment = require("../models/Investment");
const PropertyMeta = require("../models/PropertyMeta");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();

// כל הראוטים כאן דורשים התחברות
router.use(requireAuth);

// Helper: קבלת נכס מ-CKAN API לפי ID (legacy - לא בשימוש יותר)
async function getPropertyById(propertyId) {
  try {
    const base = process.env.CKAN_BASE;
    const rid = process.env.CKAN_RID;

    if (!base || !rid) {
      return null;
    }

    // CKAN datastore_search עם פילטר לפי _id
    const url = new URL(`${base}/datastore_search`);
    url.searchParams.set("resource_id", rid);
    url.searchParams.set("filters", JSON.stringify({ _id: propertyId }));
    url.searchParams.set("limit", "1");

    const r = await fetch(url);
    if (!r.ok) return null;

    const json = await r.json();
    if (!json.success || !json.result.records || json.result.records.length === 0) {
      return null;
    }

    const rec = json.result.records[0];
    
    // normalize כמו ב-propertyCkanController
    function toNumberFromText(v) {
      const n = Number(String(v ?? "0").replace(/,/g, ""));
      return Number.isFinite(n) ? n : 0;
    }

    return {
      _id: String(rec._id ?? ""),
      price: toNumberFromText(rec.PriceForMeter || rec.price || 0),
    };
  } catch (err) {
    return null;
  }
}

// GET /api/investments (רק שלי)
router.get("/", async (req, res) => {
  try {
    const userId = req.user._id;
    const { propertyId } = req.query;

    const filter = { userId };
    if (propertyId) filter.propertyId = String(propertyId);

    const items = await Investment.find(filter).sort({ createdAt: -1 });
    res.json({ status: "OK", data: items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// GET /api/investments/summary (summary לנכס)
router.get("/summary", async (req, res) => {
  try {
    const { propertyId } = req.query; // propertyId הוא attomId

    if (!propertyId) {
      return res.status(400).json({ status: "ERROR", message: "propertyId is required" });
    }

    // 1. Get or create PropertyMeta for targetAmount
    let targetAmount = 250000; // Default
    try {
      let meta = await PropertyMeta.findOne({ propertyId: String(propertyId) });
      if (!meta) {
        meta = await PropertyMeta.create({ propertyId: String(propertyId), targetAmount: 250000 });
      }
      targetAmount = meta.targetAmount;
    } catch (e) {
      console.error("Error getting PropertyMeta:", e);
    }

    // 2. Compute totalInvested from aggregation (ACTIVE only)
    const agg = await Investment.aggregate([
      {
        $match: {
          propertyId: String(propertyId),
          status: { $ne: "CANCELED" }
        }
      },
      {
        $group: {
          _id: "$propertyId",
          invested: { $sum: "$amount" }
        }
      }
    ]);

    const invested = agg[0]?.invested || 0;
    const remaining = Math.max(0, targetAmount - invested);
    const percent = targetAmount > 0 ? Math.round((invested / targetAmount) * 100) : 0;

    res.json({ status: "OK", data: { target: targetAmount, invested, remaining, percent } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// POST /api/investments (שומר עם userId)
router.post("/", async (req, res) => {
  try {
    const userId = req.user._id;
    const { propertyId, title, city, amount, fee, total, paymentMethod, targetAmount: clientTargetAmount } = req.body;

    if (!propertyId || propertyId === "undefined") {
      return res.status(400).json({ status: "ERROR", message: "propertyId is required" });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ status: "ERROR", message: "amount must be a positive number" });
    }

    const feeRate = 0.01; // 1% עמלה
    const f = Number(fee) || Math.round(amt * feeRate);
    const t = Number(total) || (amt + f);

    // 1. Get or create PropertyMeta for targetAmount
    let targetAmount;
    try {
      let meta = await PropertyMeta.findOne({ propertyId: String(propertyId) });
      if (!meta) {
        // PropertyMeta doesn't exist - create it
        let initialTargetAmount = 250000; // Safe default fallback
        
        // If client provided targetAmount, validate and use it
        if (clientTargetAmount !== undefined) {
          const clientTarget = Number(clientTargetAmount);
          if (Number.isFinite(clientTarget) && clientTarget > 0) {
            // Validate range: 120000..1200000
            const MIN_TARGET = 120000;
            const MAX_TARGET = 1200000;
            if (clientTarget >= MIN_TARGET && clientTarget <= MAX_TARGET) {
              initialTargetAmount = clientTarget;
            } else {
              console.warn(`[PropertyMeta] Client targetAmount ${clientTarget} out of range [${MIN_TARGET}..${MAX_TARGET}], using default`);
            }
          } else {
            console.warn(`[PropertyMeta] Invalid client targetAmount: ${clientTargetAmount}, using default`);
          }
        } else {
          console.warn(`[PropertyMeta] PropertyMeta not found for propertyId ${propertyId} and no client targetAmount provided, using default ${initialTargetAmount}`);
        }
        
        meta = await PropertyMeta.create({ propertyId: String(propertyId), targetAmount: initialTargetAmount });
      }
      // If PropertyMeta exists, ignore client targetAmount (server value takes precedence)
      targetAmount = meta.targetAmount;
    } catch (err) {
      console.error("Error getting/creating PropertyMeta:", err);
      // Fallback to safe default if DB operation fails
      targetAmount = 250000;
    }

    // 2. Compute totalInvested (ACTIVE only)
    const agg = await Investment.aggregate([
      {
        $match: {
          propertyId: String(propertyId),
          status: { $ne: "CANCELED" }
        }
      },
      {
        $group: {
          _id: "$propertyId",
          totalInvested: { $sum: "$amount" }
        }
      }
    ]);
    const totalInvested = agg[0]?.totalInvested || 0;
    const remaining = Math.max(0, targetAmount - totalInvested);

    // 3. Validate amount > 0 and remaining > 0
    if (amt <= 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Amount must be greater than 0",
      });
    }

    if (remaining <= 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Property is fully funded",
        targetAmount,
        totalInvested,
        remaining: 0,
      });
    }

    // 4. Check if amount exceeds remaining
    if (amt > remaining) {
      return res.status(400).json({
        status: "ERROR",
        message: "Amount exceeds remaining capacity",
        remaining,
        targetAmount,
        totalInvested,
      });
    }

    // 5. Save investment
    const doc = await Investment.create({
      userId,
      propertyId: String(propertyId),
      title: title || "",
      city: city || "",
      amount: amt,
      fee: f,
      total: t,
      paymentMethod: paymentMethod || "card",
    });

    // 6. Recompute totals after investment
    const updatedAgg = await Investment.aggregate([
      {
        $match: {
          propertyId: String(propertyId),
          status: { $ne: "CANCELED" }
        }
      },
      {
        $group: {
          _id: "$propertyId",
          totalInvested: { $sum: "$amount" }
        }
      }
    ]);
    const updatedTotalInvested = updatedAgg[0]?.totalInvested || 0;
    const updatedRemaining = Math.max(0, targetAmount - updatedTotalInvested);
    const updatedFundedPercent = targetAmount > 0 
      ? Math.min(100, Math.round((updatedTotalInvested / targetAmount) * 100))
      : 0;

    res.status(201).json({ 
      status: "OK", 
      data: doc,
      totals: {
        targetAmount,
        totalInvested: updatedTotalInvested,
        remaining: updatedRemaining,
        fundedPercent: updatedFundedPercent,
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// DELETE /api/investments/:id (רק שלי)
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const investment = await Investment.findOne({ _id: id, userId });
    if (!investment) {
      return res.status(404).json({ status: "ERROR", message: "not found" });
    }

    // מחיקת ההשקעה (אין צורך לעדכן Property model - הכל מחושב מ-aggregation)
    await Investment.findOneAndDelete({ _id: id, userId });

    res.json({ status: "OK" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// PATCH /api/investments/:id/cancel
router.patch("/:id/cancel", async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const inv = await Investment.findOne({ _id: id, userId });
    if (!inv) {
      return res.status(404).json({ status: "ERROR", message: "investment not found" });
    }

    if (inv.status === "CANCELED") {
      return res.json({ status: "OK", data: inv });
    }

    // החזר חלקי: מחזירים amount בלי fee (העמלה נשארת)
    const refundAmount = Math.max(0, Number(inv.amount || 0) - Number(inv.fee || 0));
    const retainedFee = Number(inv.fee || 0);

    inv.status = "CANCELED";
    inv.refundAmount = refundAmount;
    inv.retainedFee = retainedFee;
    inv.canceledAt = new Date();
    await inv.save();

    // חישוב סכום מושקע חדש (אחרי ביטול) - מ-aggregation
    const agg = await Investment.aggregate([
      {
        $match: {
          propertyId: String(inv.propertyId),
          status: { $ne: "CANCELED" }
        }
      },
      {
        $group: {
          _id: null,
          sum: { $sum: "$amount" }
        }
      }
    ]);

    const newInvestedAmount = agg[0]?.sum || 0;

    // Get PropertyMeta for targetAmount
    let targetAmount = 250000; // Default
    try {
      let meta = await PropertyMeta.findOne({ propertyId: String(inv.propertyId) });
      if (meta) {
        targetAmount = meta.targetAmount;
      }
    } catch (e) {
      console.error("Error getting PropertyMeta in cancel:", e);
    }

    const fundedPercent = targetAmount > 0 ? Math.min(100, Math.round((newInvestedAmount / targetAmount) * 100)) : 0;
    const remaining = Math.max(0, targetAmount - newInvestedAmount);

    res.json({ 
      status: "OK", 
      data: inv,
      property: {
        id: inv.propertyId, // attomId
        investedAmount: newInvestedAmount,
        fundedPercent,
        remaining
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

module.exports = router;

