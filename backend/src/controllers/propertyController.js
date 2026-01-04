// src/controllers/propertyController.js
const mongoose = require("mongoose");
const { getPropertyDetail, searchByCity } = require("../services/attom.service");
const { getPexelsImage } = require("../services/pexels.service");
const Investment = require("../models/Investment");
const PropertyMeta = require("../models/PropertyMeta");
const { computeTargetAmount } = require("../utils/targetAmount");

/**
 * Map ATTOM property to internal DTO
 */
async function mapPropertyToDTO(p) {
  const identifier = p.identifier || {};
  const addr = p.address || {};
  const loc = p.location || {};
  const summary = p.summary || {};
  const building = p.building || {};
  const rooms = building.rooms || {};
  const size = building.size || {};

  const id = identifier.attomId || "";
  const title = summary.propertyType || "";
  const city = addr.locality || "";
  const state = addr.countrySubd || "";

  const dto = {
    id,
    title,
    addressOneLine: addr.oneLine || "",
    city,
    state,
    postalCode: addr.postal1 || "",
    lat: loc.latitude ? Number(loc.latitude) : null,
    lng: loc.longitude ? Number(loc.longitude) : null,
    beds: rooms.beds ?? null,
    baths: rooms.bathstotal ?? null,
    areaSqft: size.livingsize ?? null,
    yearBuilt: summary.yearbuilt ?? null,
    price: null,
    imageUrl: null, // Will be set from Pexels
    source: "ATTOM",
  };

  // Get image from Pexels using query: `${city} ${state} ${title} house exterior real estate`
  if (city && state && title) {
    const query = `${city} ${state} ${title} house exterior real estate`;
    dto.imageUrl = await getPexelsImage(query);
  } else if (city && state) {
    // Fallback if no propertyType
    const query = `${city} ${state} house exterior real estate`;
    dto.imageUrl = await getPexelsImage(query);
  }

  return dto;
}

// GET /api/properties?address1=4529%20Winona%20Court&address2=Denver,%20CO
// OR GET /api/properties?city=Denver&limit=12&page=1
exports.getProperties = async (req, res) => {
  try {
    const { address1, address2, city, limit = 12, page = 1 } = req.query;

    let raw;
    let propertyArray = [];

    // Mode 1: City listing mode
    if (city) {
      const pageNum = Number(page) || 1;
      const pageSize = Number(limit) || 12;
      raw = await searchByCity(city, pageNum, pageSize);
      propertyArray = raw?.property || [];
    }
    // Mode 2: Address detail mode (existing)
    else if (address1 && address2) {
      raw = await getPropertyDetail(address1, address2);
      propertyArray = raw?.property || [];
    }
    // Validation: need either city OR (address1 + address2)
    else {
      return res.status(400).json({
        status: "ERROR",
        message: "Provide city OR (address1 AND address2)",
      });
    }

    // If empty, return OK with count 0
    if (!Array.isArray(propertyArray) || propertyArray.length === 0) {
      return res.json({ status: "OK", count: 0, data: [] });
    }

    // Map all properties to DTO (with Pexels images)
    const items = await Promise.all(
      propertyArray.map(async (p) => {
        const cityName = p?.address?.locality || "";
        const state = p?.address?.countrySubd || "";
        const addressLine = p?.address?.oneLine || "";
        const propertyType = p?.summary?.propertyType || "House";

        // Priority order for Pexels query:
        // a) Full address when available
        // b) City + state + residential building
        // c) City + house exterior (fallback)
        let pexelsQuery;
        if (addressLine) {
          pexelsQuery = `${addressLine} exterior building`;
        } else if (cityName && state) {
          pexelsQuery = `${cityName} ${state} residential building exterior`;
        } else {
          pexelsQuery = `${cityName} house exterior real estate`;
        }

        const propertyId = p?.identifier?.attomId || "";
        const imageUrl = await getPexelsImage(pexelsQuery, propertyId);

        return {
          id: p?.identifier?.attomId,
          title: addressLine || propertyType,
          city: cityName,
          price: p?.assessment?.assessed?.assdTtlValue || 0,
          imageUrl,
        };
      })
    );

    res.json({ status: "OK", count: items.length, data: items });
  } catch (err) {
    res.status(err.status || 500).json({
      status: "ERROR",
      message: err.message || "Unknown error",
      details: err.payload || null,
    });
  }
};

// GET /api/properties/:id (single property detail)
exports.getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // For ATTOM, we need address1+address2 to get detail
    // Since we only have ID, we'll need to call detail endpoint with id parameter
    const { attomFetch } = require("../services/attom.service");
    const raw = await attomFetch("/property/detail", { id });

    const propertyArray = raw?.property || [];
    const p = propertyArray[0] || raw?.property || raw;
    if (!p) {
      return res.status(404).json({
        status: "ERROR",
        message: "Property not found",
      });
    }

    const addressLine = p?.address?.oneLine || "";
    const propertyType = p?.summary?.propertyType || "House";
    const cityName = p?.address?.locality || "";
    const state = p?.address?.countrySubd || "";
    const propertyId = p?.identifier?.attomId || "";
    const price = p?.assessment?.assessed?.assdTtlValue || 0;

    const item = {
      id: propertyId,
      title: addressLine || propertyType,
      city: cityName,
      price,
    };

    // Priority order for Pexels query:
    // a) Full address when available
    // b) City + state + residential building
    // c) City + house exterior (fallback)
    let pexelsQuery;
    if (addressLine) {
      pexelsQuery = `${addressLine} exterior building`;
    } else if (cityName && state) {
      pexelsQuery = `${cityName} ${state} residential building exterior`;
    } else {
      pexelsQuery = `${cityName} house exterior real estate`;
    }

    item.imageUrl = await getPexelsImage(pexelsQuery, propertyId);

    // Get or create PropertyMeta for targetAmount
    let targetAmount;
    try {
      let meta = await PropertyMeta.findOne({ propertyId });
      if (!meta) {
        // Compute targetAmount from property data
        const computedTarget = computeTargetAmount(p);
        meta = await PropertyMeta.create({ propertyId, targetAmount: computedTarget });
      }
      targetAmount = meta.targetAmount;
    } catch (err) {
      console.error("Error getting PropertyMeta:", err);
      // Fallback to computed value if DB operation fails
      targetAmount = computeTargetAmount(p);
    }

    // Compute totalInvested for this propertyId
    let totalInvested = 0;
    try {
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
      totalInvested = agg[0]?.totalInvested ? Number(agg[0].totalInvested) : 0;
    } catch (err) {
      console.error("Error computing totalInvested:", err);
    }

    // Compute userInvested if user is logged in
    let userInvested = 0;
    const userId = req.user?._id ? String(req.user._id) : null;
    if (userId) {
      try {
        const userAgg = await Investment.aggregate([
          {
            $match: {
              propertyId: String(propertyId),
              userId: mongoose.Types.ObjectId(userId),
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
        userInvested = userAgg[0]?.userInvested ? Number(userAgg[0].userInvested) : 0;
      } catch (err) {
        console.error("Error computing userInvested:", err);
      }
    }

    // Calculate fundedPercent, remaining
    const fundedPercent = targetAmount > 0 
      ? Math.min(100, Math.round((totalInvested / targetAmount) * 100))
      : 0;
    const remaining = Math.max(0, targetAmount - totalInvested);

    item.targetAmount = targetAmount;
    item.totalInvested = totalInvested;
    item.userInvested = userInvested;
    item.fundedPercent = fundedPercent;
    item.remaining = remaining;

    res.json({ status: "OK", data: item });
  } catch (err) {
    res.status(err.status || 500).json({
      status: "ERROR",
      message: err.message || "Unknown error",
      details: err.payload || null,
    });
  }
};
