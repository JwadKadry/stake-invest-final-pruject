// src/controllers/propertyController.js
const Property = require("../models/Property");
const Investment = require("../models/Investment");
const PropertyMeta = require("../models/PropertyMeta");

/**
 * Map MongoDB Property to API DTO format
 * Supports multiple field name variations (beds/bedrooms, baths/bathrooms, etc.)
 */
function mapPropertyToDTO(p) {
  if (!p) return null;

  // Convert sqm to sqft if needed
  const sqm = p.sqm ?? null;
  const areaSqftFromSqm = sqm ? Math.round(sqm * 10.764) : null;

  return {
    id: String(p._id),
    title: p.title || "",
    addressOneLine: p.addressOneLine || p.address || "",
    city: p.city || "",
    state: p.state || "",
    postalCode: p.postalCode || "",
    lat: p.lat ?? null,
    lng: p.lng ?? null,

    beds: p.beds ?? p.bedrooms ?? null,
    baths: p.baths ?? p.bathrooms ?? null,
    bedrooms: p.bedrooms ?? p.beds ?? null,
    bathrooms: p.bathrooms ?? p.baths ?? null,

    areaSqft: p.areaSqft ?? p.livingAreaSqft ?? areaSqftFromSqm ?? null,
    livingAreaSqft: p.livingAreaSqft ?? p.areaSqft ?? areaSqftFromSqm ?? null,
    sqm: sqm ?? null,
    yearBuilt: p.yearBuilt ?? null,

    propertyType: p.propertyType || p.type || "",
    price: p.price ?? null,

    imageUrl: p.imageUrl || "",
    targetAmount: p.targetAmount ?? null,
    fundedPercent: p.fundedPercent ?? p.investedPercent ?? 0,

    source: p.source || "MONGODB",
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// Export for use in routes
exports.mapPropertyToDTO = mapPropertyToDTO;

/**
 * Map property type filter (RESIDENTIAL/COMMERCIAL/RENTAL) to our enum values
 */
function mapTypeFilter(filterType) {
  const normalized = String(filterType || "").toUpperCase().trim();
  
  if (normalized === "RESIDENTIAL") {
    return ["Apartment", "House", "Penthouse", "Studio"];
  }
  if (normalized === "COMMERCIAL") {
    return []; // No commercial in our schema yet
  }
  if (normalized === "RENTAL") {
    return ["Apartment", "Studio"]; // Typically rental properties
  }
  return null; // ALL types
}

// ========================================
// Aggregation Pipeline for Funding Status Filter
// ========================================
async function getPropertiesWithFundingFilter({ baseMatch, status, page, limit, sort = "funded_desc" }) {
  const skip = (page - 1) * limit;

  // Build sort stage based on sort parameter
  const sortStage = 
    sort === "newest" ? { createdAt: -1 } :
    sort === "price_asc" ? { price: 1 } :
    sort === "price_desc" ? { price: -1 } :
    // default: funded_desc (fundedPercent desc, then createdAt desc)
    { fundedPercent: -1, createdAt: -1 };

  const pipeline = [
    { $match: baseMatch },

    // 1) bring targetAmount from PropertyMeta (propertyId is String, _id is ObjectId)
    {
      $lookup: {
        from: "propertymetas",
        let: { pid: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$propertyId", "$$pid"] }
            }
          }
        ],
        as: "meta"
      }
    },
    { $addFields: { meta: { $first: "$meta" } } },

    // 2) sum ACTIVE investments
    {
      $lookup: {
        from: "investments",
        let: { pid: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$propertyId", "$$pid"] },
                  { $eq: ["$status", "ACTIVE"] }
                ]
              }
            }
          },
          { $group: { _id: null, totalInvested: { $sum: "$amount" } } }
        ],
        as: "inv"
      }
    },
    { $addFields: { inv: { $first: "$inv" } } },

    // 3) computed fields
    {
      $addFields: {
        targetAmount: {
          $ifNull: ["$meta.targetAmount", { $multiply: [{ $ifNull: ["$price", 0] }, 1.2] }]
        },
        totalInvested: { $ifNull: ["$inv.totalInvested", 0] }
      }
    },
    {
      $addFields: {
        fundedPercent: {
          $cond: [
            { $gt: ["$targetAmount", 0] },
            {
              $divide: [
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$totalInvested", "$targetAmount"] }, 
                        10000
                      ]
                    },
                    0
                  ]
                },
                100
              ]
            },
            0
          ]
        }
      }
    },
    {
      $addFields: {
        remainingAmount: {
          $max: [
            { $subtract: ["$targetAmount", "$totalInvested"] },
            0
          ]
        }
      }
    },

    // 4) filter by status
    ...(status === "funded"
      ? [{ $match: { fundedPercent: { $gte: 100 } } }]
      : status === "pending"
        ? [{ $match: { totalInvested: { $gt: 0 }, fundedPercent: { $lt: 100 } } }]
        : status === "available"
          ? [{ $match: { totalInvested: { $lte: 0 }, fundedPercent: { $lt: 100 } } }]
          : []),

    // 5) sort + paginate + total in one roundtrip
    {
      $facet: {
        items: [
          { $sort: sortStage },
          { $skip: skip },
          { $limit: limit }
        ],
        total: [{ $count: "count" }]
      }
    }
  ];

  const out = await Property.aggregate(pipeline);
  const items = out?.[0]?.items || [];
  const total = out?.[0]?.total?.[0]?.count || 0;

  return { items, total };
}

// GET /api/properties?city=Tel%20Aviv&limit=12&page=1&type=RESIDENTIAL&minPrice=1000000&maxPrice=5000000
// GET /api/properties?random=true&limit=20
// GET /api/properties?status=funded|available|exited&city=Tel%20Aviv
exports.getProperties = async (req, res) => {
  try {
    console.log("[getProperties] QUERY:", req.query);

    const { 
      city, 
      q, // Search query
      limit = 12, 
      page = 1,
      type = "ALL",
      minPrice,
      maxPrice,
      random, // ✅ Random flag
      status, // ✅ Status filter: "funded" | "available" | "exited"
    } = req.query;

    // ❌ אם אין עיר ואין random ואין status – לא מחזירים כלום
    if (!city && random !== "true" && random !== true && !status) {
      return res.status(400).json({
        status: "ERROR",
        message: "City is required for search (or use random=true or status filter)",
      });
    }

    // ✅ Handle random=true (fast path - no filters)
    if (random === "true" || random === true) {
      const limitNum = Math.min(50, Math.max(1, Number(limit) || 20));
      
      const properties = await Property.aggregate([
        { $sample: { size: limitNum } }
      ]).exec();

      // ===== Compute fundedPercent for RANDOM items (same logic as getPropertyById) =====
      const ids = properties.map(p => String(p._id));

      // 1) bring targetAmount from PropertyMeta (if exists)
      const metas = await PropertyMeta.find({ propertyId: { $in: ids } }).lean();
      const targetMap = new Map(metas.map(m => [String(m.propertyId), Number(m.targetAmount || 0)]));

      // 2) sum ACTIVE investments per propertyId
      const sums = await Investment.aggregate([
        { $match: { status: "ACTIVE", propertyId: { $in: ids } } },
        { $group: { _id: "$propertyId", totalInvested: { $sum: "$amount" } } },
      ]).exec();

      const investedMap = new Map(sums.map(x => [String(x._id), Number(x.totalInvested || 0)]));

      // 3) attach computed fields to each item
      for (const p of properties) {
        const id = String(p._id);

        const price = Number(p.price || 0);
        const target = targetMap.get(id) || Math.round(price * 1.2); // same fallback
        const invested = investedMap.get(id) || 0;

        const fundedPercent = target > 0 ? Math.round((invested / target) * 10000) / 100 : 0;

        p.targetAmount = target;
        p.totalInvested = invested;
        p.remainingAmount = Math.max(target - invested, 0);
        p.fundedPercent = fundedPercent;
      }

      // Map to DTO format
      const data = properties.map(mapPropertyToDTO);

      return res.json({
        status: "OK",
        count: data.length,
        data,
      });
    }

    // Pagination
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(60, Math.max(1, Number(limit) || 24));
    const statusLower = (status || "").toLowerCase();
    const sortLower = (req.query.sort || "funded_desc").toLowerCase();

    // ✅ Handle status filter with Aggregation Pipeline
    if (statusLower === "funded" || statusLower === "available" || statusLower === "pending" || statusLower === "exited") {
      // Build base match filter
      const baseMatch = {};

      // City filter - but status=funded or status=pending ignores city (shows from all cities)
      if (city && statusLower !== "funded" && statusLower !== "pending") {
        baseMatch.city = city.trim();
      }

      // Type filter
      const typeFilter = mapTypeFilter(type);
      if (typeFilter && typeFilter.length > 0) {
        baseMatch.type = { $in: typeFilter };
      }

      // Text search (title, address, city)
      if (q) {
        baseMatch.$or = [
          { title: new RegExp(q.trim(), "i") },
          { address: new RegExp(q.trim(), "i") },
          { city: new RegExp(q.trim(), "i") },
        ];
      }

      // Price range filter
      if (minPrice || maxPrice) {
        baseMatch.price = {};
        if (minPrice) baseMatch.price.$gte = Number(minPrice);
        if (maxPrice) baseMatch.price.$lte = Number(maxPrice);
      }

      // Use aggregation pipeline for funding status filtering
      const { items, total } = await getPropertiesWithFundingFilter({
        baseMatch,
        status: statusLower,
        page: pageNum,
        limit: limitNum,
        sort: sortLower
      });

      // Map to DTO format
      const data = items.map(mapPropertyToDTO);

      console.log(`[getProperties] Status filter "${statusLower}": Found ${total} total, returning ${data.length} items`);

      return res.json({
        status: "OK",
        page: pageNum,
        limit: limitNum,
        total,
        data,
      });
    }

    // Build MongoDB filter (regular query path - no status filter)
    const filter = {};

    // City filter (חובה - כבר נבדק למעלה)
    if (city) {
      filter.city = city.trim();
    }

    // Type filter
    const typeFilter = mapTypeFilter(type);
    if (typeFilter && typeFilter.length > 0) {
      filter.type = { $in: typeFilter };
    }

    // Text search (title, address, city)
    if (q) {
      filter.$or = [
        { title: new RegExp(q.trim(), "i") },
        { address: new RegExp(q.trim(), "i") },
        { city: new RegExp(q.trim(), "i") },
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [items, total] = await Promise.all([
      Property.find(filter)
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Property.countDocuments(filter),
    ]);

    // ===== Compute fundedPercent for LIST items (same logic as getPropertyById) =====
    const ids = items.map(p => String(p._id));

    // 1) bring targetAmount from PropertyMeta (if exists)
    const metas = await PropertyMeta.find({ propertyId: { $in: ids } }).lean();
    const targetMap = new Map(metas.map(m => [String(m.propertyId), Number(m.targetAmount || 0)]));

    // 2) sum ACTIVE investments per propertyId
    const sums = await Investment.aggregate([
      { $match: { status: "ACTIVE", propertyId: { $in: ids } } },
      { $group: { _id: "$propertyId", totalInvested: { $sum: "$amount" } } },
    ]).exec();

    const investedMap = new Map(sums.map(x => [String(x._id), Number(x.totalInvested || 0)]));

    // 3) attach computed fields to each item
    for (const p of items) {
      const id = String(p._id);

      const price = Number(p.price || 0);
      const target = targetMap.get(id) || Math.round(price * 1.2); // same fallback
      const invested = investedMap.get(id) || 0;

      const fundedPercent = target > 0 ? Math.round((invested / target) * 10000) / 100 : 0;

      p.targetAmount = target;
      p.totalInvested = invested;
      p.remainingAmount = Math.max(target - invested, 0);
      p.fundedPercent = fundedPercent;
    }

    // Map to DTO format
    const data = items.map(mapPropertyToDTO);

    console.log(`[getProperties] Found ${total} total, returning ${data.length} items`);

    res.json({
      status: "OK",
      count: data.length,
      total,
      page: pageNum,
      limit: limitNum,
      data,
    });
  } catch (err) {
    console.error("[getProperties] Error:", err);
    res.status(500).json({
      status: "ERROR",
      message: err.message || "Failed to fetch properties",
    });
  }
};

// GET /api/properties/:id (single property detail)
exports.getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("[getPropertyById] ID:", id);

    // Try MongoDB ObjectId first
    let property = null;
    try {
      property = await Property.findById(id).lean();
    } catch (e) {
      // Invalid ObjectId format, try to find by custom id
      property = await Property.findOne({ _id: id }).lean();
    }

    if (!property) {
      return res.status(404).json({
        status: "ERROR",
        message: "Property not found",
      });
    }

    // ✅ Return document directly with id field (property is already plain object from .lean())
    const normalized = { ...property, id: String(property._id) };

    // Get or create PropertyMeta for targetAmount (if not set in property)
    let targetAmount = normalized.targetAmount;
    if (!targetAmount) {
      try {
        let meta = await PropertyMeta.findOne({ propertyId: id });
        if (!meta) {
          // Compute targetAmount from price (default: 1.2x price)
          const computedTarget = Math.round(normalized.price * 1.2);
          meta = await PropertyMeta.create({ propertyId: id, targetAmount: computedTarget });
        }
        targetAmount = meta.targetAmount;
        normalized.targetAmount = targetAmount;
      } catch (err) {
        console.error("Error getting PropertyMeta:", err);
        // Fallback: use 1.2x price
        targetAmount = Math.round(normalized.price * 1.2);
        normalized.targetAmount = targetAmount;
      }
    }

    // Compute totalInvested for this propertyId
    // ✅ חשוב: משתמשים רק ב-amount (נטו לנכס) - לא כולל fee
    // העמלה לא נכנסת למימון הנכס
    let totalInvested = 0;
    let userInvested = 0;
    try {
      const investments = await Investment.find({ propertyId: id, status: "ACTIVE" });
      totalInvested = investments.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
      
      // If user is logged in, calculate their investment
      if (req.user && req.user.id) {
        const userInvs = investments.filter(inv => inv.userId && inv.userId.toString() === req.user.id.toString());
        userInvested = userInvs.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
      }
    } catch (err) {
      console.error("Error calculating investments:", err);
    }

    const fundedPercent = targetAmount > 0 
      ? Math.round((totalInvested / targetAmount) * 100 * 100) / 100 
      : 0;

    const remainingAmount = Math.max(
      targetAmount - totalInvested,
      0
    );

    normalized.fundedPercent = fundedPercent;
    normalized.totalInvested = totalInvested;
    normalized.userInvested = userInvested;
    normalized.remainingAmount = remainingAmount;

    console.log("[getPropertyById] NORMALIZED:", {
      id: normalized.id,
      title: normalized.title,
      city: normalized.city,
      price: normalized.price,
      fundedPercent: normalized.fundedPercent,
    });

    res.json({
      status: "OK",
      data: normalized,
    });
  } catch (err) {
    console.error("[getPropertyById] Error:", err);
    res.status(500).json({
      status: "ERROR",
      message: err.message || "Failed to fetch property",
    });
  }
};

// GET /api/properties/stats?city=Tel%20Aviv
exports.getStats = async (req, res) => {
  try {
    const { city } = req.query;
    const filter = city ? { city: new RegExp(city.trim(), "i") } : {};

    const stats = await Property.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProperties: { $sum: 1 },
          avgPrice: { $avg: "$price" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
          avgSqm: { $avg: "$sqm" },
          avgBeds: { $avg: "$beds" },
          avgBaths: { $avg: "$baths" },
          // Fake ROI (for demo purposes)
          avgROI: { $avg: { $multiply: [{ $divide: ["$price", "$sqm"] }, 0.05] } },
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        status: "OK",
        data: {
          totalProperties: 0,
          avgPrice: 0,
          minPrice: 0,
          maxPrice: 0,
          avgSqm: 0,
          avgBeds: 0,
          avgBaths: 0,
          avgROI: 0,
        }
      });
    }

    const result = stats[0];
    res.json({
      status: "OK",
      data: {
        totalProperties: result.totalProperties,
        avgPrice: Math.round(result.avgPrice || 0),
        minPrice: result.minPrice || 0,
        maxPrice: result.maxPrice || 0,
        avgSqm: Math.round(result.avgSqm || 0),
        avgBeds: Math.round(result.avgBeds || 0),
        avgBaths: Math.round(result.avgBaths || 0),
        avgROI: Math.round((result.avgROI || 0) * 100) / 100, // Fake 5% ROI
      }
    });
  } catch (err) {
    console.error("[getStats] Error:", err);
    res.status(500).json({
      status: "ERROR",
      message: err.message || "Failed to fetch stats",
    });
  }
};
