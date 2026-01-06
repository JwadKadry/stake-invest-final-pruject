const express = require("express");
const mongoose = require("mongoose");
const Investment = require("../models/Investment");
const PropertyMeta = require("../models/PropertyMeta");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();

// Helper: Normalize investment snapshot fields
function normalizeInvestmentSnapshot(inv) {
  const title = inv.propertyTitle || inv.title || inv.snapshot?.title || null;
  const city = inv.propertyCity || inv.city || inv.snapshot?.city || null;
  const image = inv.propertyImageUrl || inv.imageUrl || inv.snapshot?.imageUrl || "/img/placeholder.jpg";
  
  // If title is missing, use Property • ID format (more product-like)
  const finalTitle = title || `Property • ${inv.propertyId || "unknown"}`;
  // If city missing, use empty string
  const finalCity = city || "";
  
  return {
    title: finalTitle,
    city: finalCity,
    imageUrl: image
  };
}

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
    // Always use userId from req.user, never from body
    const uid = req.user?._id || req.user?.id;
    if (!uid) {
      return res.status(401).json({ status: "ERROR", message: "Unauthorized" });
    }
    
    const { propertyId, amount, targetAmount: clientTargetAmount, title, city, imageUrl } = req.body;

    if (!propertyId || propertyId === "undefined") {
      return res.status(400).json({ status: "ERROR", message: "propertyId is required" });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ status: "ERROR", message: "amount must be a positive number" });
    }

    const feeRate = 0.01; // 1% עמלה
    const f = Math.round(amt * feeRate);
    const t = amt + f;

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

    // 5. Save investment with snapshot fields (always use uid from req.user)
    const doc = await Investment.create({
      userId: uid,
      propertyId: String(propertyId),
      title: title || "",
      city: city || "",
      // Snapshot fields for portfolio consistency
      propertyTitle: title || "",
      propertyCity: city || "",
      propertyImageUrl: imageUrl || "",
      targetAmount: targetAmount,
      amount: amt,
      fee: f,
      total: t,
      paymentMethod: "card", // Default payment method
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

    // Calculate user's total investment in this property
    const userIdMatch = { $in: [uid, String(uid)] };
    const userAgg = await Investment.aggregate([
      {
        $match: {
          userId: userIdMatch,
          propertyId: String(propertyId),
          status: { $ne: "CANCELED" }
        }
      },
      {
        $group: {
          _id: "$propertyId",
          userInvested: { $sum: "$amount" }
        }
      }
    ]);
    const userInvested = userAgg[0]?.userInvested || 0;

    res.status(201).json({ 
      status: "OK", 
      data: doc,
      summary: {
        userInvested,
        totalInvested: updatedTotalInvested,
        fundedPercent: updatedFundedPercent,
        remaining: updatedRemaining
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

// GET /api/investments/portfolio (auth required)
router.get("/portfolio", async (req, res) => {
  try {
    // DEBUG: Print auth user info
    
    // Define uid from req.user (supports both _id and id)
    const uid = req.user?._id || req.user?.id;

    // Verify userId exists and is valid
    if (!uid) {
      console.error("ERROR: userId is missing!");
      return res.status(401).json({ status: "ERROR", message: "Unauthorized" });
    }

    // Use $in to match both ObjectId and string formats
    const userIdMatch = { $in: [uid, String(uid)] };


    // 1. Aggregate user's investments grouped by propertyId
    // First, sort by createdAt descending to get most recent first
    const userInvestments = await Investment.aggregate([
      {
        $match: {
          userId: userIdMatch,
          status: { $ne: "CANCELED" },
          propertyId: { $nin: ["undefined", null, undefined] }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$propertyId",
          userInvested: { $sum: "$amount" },
          maxCreatedAt: { $max: "$createdAt" },
          // Get the most recent snapshot fields (first after sorting desc)
          propertyTitle: { $first: "$propertyTitle" },
          propertyCity: { $first: "$propertyCity" },
          propertyImageUrl: { $first: "$propertyImageUrl" },
          targetAmount: { $first: "$targetAmount" },
          // Also get regular title/city as fallback
          title: { $first: "$title" },
          city: { $first: "$city" }
        }
      }
    ]);

    if (userInvestments.length === 0) {
      return res.json({ 
        status: "OK", 
        data: [],
        summary: {
          totalUserInvested: 0,
          totalInvestmentsCount: 0,
          uniquePropertiesCount: 0,
          topCity: null,
          topCityValue: 0,
          avgInvestment: 0
        }
      });
    }

    const propertyIds = userInvestments.map(inv => inv._id);

    // 2. Aggregate totalInvested across ALL users for these propertyIds
    const allUsersTotals = await Investment.aggregate([
      {
        $match: {
          propertyId: { $in: propertyIds },
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

    // Create a map for quick lookup
    const totalsMap = {};
    for (const tot of allUsersTotals) {
      totalsMap[tot._id] = tot.totalInvested;
    }

    // 3. Get PropertyMeta for targetAmount (fallback if snapshot targetAmount is missing)
    const propertyMetas = await PropertyMeta.find({ propertyId: { $in: propertyIds } });
    const metaMap = {};
    for (const meta of propertyMetas) {
      metaMap[meta.propertyId] = meta.targetAmount;
    }

    // 4. Get total investment count for summary
    const totalInvestmentsCount = await Investment.countDocuments({
      userId: userIdMatch,
      status: { $ne: "CANCELED" }
    });

    // 5. Combine data and compute fundedPercent and remaining, normalize snapshots
    const portfolio = userInvestments.map(inv => {
      const propertyId = inv._id;
      const totalInvested = totalsMap[propertyId] || 0;
      // Use snapshot targetAmount if available, otherwise PropertyMeta, otherwise 0
      const targetAmount = inv.targetAmount || metaMap[propertyId] || 0;
      const fundedPercent = targetAmount > 0 
        ? Math.min(100, Math.round((totalInvested / targetAmount) * 100))
        : 0;
      const remaining = Math.max(0, targetAmount - totalInvested);

      // Normalize snapshot fields
      const snapshot = normalizeInvestmentSnapshot({
        propertyId,
        propertyTitle: inv.propertyTitle,
        title: inv.title,
        propertyCity: inv.propertyCity,
        city: inv.city,
        propertyImageUrl: inv.propertyImageUrl,
        imageUrl: null
      });

      return {
        propertyId,
        userInvested: inv.userInvested,
        totalInvested,
        targetAmount,
        fundedPercent,
        remaining,
        propertyTitle: snapshot.title,
        propertyCity: snapshot.city,
        imageUrl: snapshot.imageUrl,
        lastInvestmentAt: inv.maxCreatedAt
      };
    });

    // 6. Sort by userInvested desc
    portfolio.sort((a, b) => b.userInvested - a.userInvested);

    // 7. Calculate summary stats
    const totalUserInvested = portfolio.reduce((sum, item) => sum + (item.userInvested || 0), 0);
    const uniquePropertiesCount = portfolio.length;
    const avgInvestment = totalUserInvested / Math.max(1, totalInvestmentsCount);

    // Find top city (ignore empty city)
    const cityTotals = {};
    for (const item of portfolio) {
      if (item.propertyCity && item.propertyCity.trim()) {
        const city = item.propertyCity.trim();
        cityTotals[city] = (cityTotals[city] || 0) + (item.userInvested || 0);
      }
    }
    let topCity = "";
    let topCityValue = 0;
    for (const [city, value] of Object.entries(cityTotals)) {
      if (value > topCityValue) {
        topCityValue = value;
        topCity = city;
      }
    }

    res.json({ 
      status: "OK", 
      data: portfolio,
      summary: {
        totalUserInvested,
        totalInvestmentsCount,
        uniquePropertiesCount,
        topCity: topCity || null,
        topCityValue: topCity ? topCityValue : 0,
        avgInvestment
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

// GET /api/investments/recent (auth required)
router.get("/recent", async (req, res) => {
  try {
    // DEBUG: Print auth user info
    
    // Define uid from req.user (supports both _id and id)
    const uid = req.user?._id || req.user?.id;

    // Verify userId exists and is valid
    if (!uid) {
      console.error("ERROR: userId is missing!");
      return res.status(401).json({ status: "ERROR", message: "Unauthorized" });
    }

    // Use $in to match both ObjectId and string formats
    const userIdMatch = { $in: [uid, String(uid)] };

    const investments = await Investment.find({ 
      userId: userIdMatch,
      status: { $ne: "CANCELED" }
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    

    // Normalize each investment
    const normalized = investments.map(inv => {
      const snapshot = normalizeInvestmentSnapshot(inv);
      return {
        status: inv.status || "ACTIVE",
        amount: inv.amount || 0,
        createdAt: inv.createdAt,
        propertyId: inv.propertyId || "",
        propertyTitle: snapshot.title,
        propertyCity: snapshot.city,
        imageUrl: snapshot.imageUrl
      };
    });

    res.json({ status: "OK", data: normalized });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "ERROR", message: "server error" });
  }
});

module.exports = router;

