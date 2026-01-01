const Property = require("../models/Property");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/properties
// Query params supported:
// city, type, status, q, minPrice, maxPrice, page, limit, sort
// Examples:
// /api/properties?city=Haifa&type=apartment&minPrice=500000&maxPrice=2000000&q=דירה&page=1&limit=10&sort=-createdAt
// /api/properties?sort=-price
exports.getProperties = async (req, res) => {
  try {
    const {
      city,
      type,
      status,
      q,
      minPrice,
      maxPrice,
      page = "1",
      limit = "10",
      sort = "-createdAt",
    } = req.query;

    const filter = {};

    // basic filters
    if (city) filter.city = city;
    if (type) filter.type = type;
    if (status) filter.listingStatus = status;

    // price range validation + filter
    const min = minPrice !== undefined ? Number(minPrice) : undefined;
    const max = maxPrice !== undefined ? Number(maxPrice) : undefined;

    if (minPrice !== undefined && Number.isNaN(min)) {
      return res
        .status(400)
        .json({ status: "ERROR", message: "minPrice must be a number" });
    }
    if (maxPrice !== undefined && Number.isNaN(max)) {
      return res
        .status(400)
        .json({ status: "ERROR", message: "maxPrice must be a number" });
    }

    if (min !== undefined || max !== undefined) {
      filter.price = {};
      if (min !== undefined) filter.price.$gte = min;
      if (max !== undefined) filter.price.$lte = max;
    }

    // simple text search (regex)
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    // pagination
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    // query + count in parallel
    const [items, total] = await Promise.all([
      Property.find(filter).sort(sort).skip(skip).limit(limitNum),
      Property.countDocuments(filter),
    ]);

    return res.json({
      status: "OK",
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        sort,
        filter,
      },
      count: items.length,
      data: items,
    });
  } catch (err) {
    return res.status(500).json({ status: "ERROR", message: err.message });
  }
};

// GET /api/properties/:id
exports.getPropertyById = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) {
    const err = new Error("Property not found");
    err.statusCode = 404;
    throw err;
  }
  res.json({ status: "OK", data: property });
});


// POST /api/properties
exports.createProperty = async (req, res) => {
  try {
    const created = await Property.create(req.body);
    return res.status(201).json({ status: "OK", data: created });
  } catch (err) {
    return res.status(400).json({ status: "ERROR", message: err.message });
  }
};

// PUT/PATCH /api/properties/:id
exports.updateProperty = async (req, res) => {
  try {
    const updated = await Property.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "Property not found" });
    }

    return res.json({ status: "OK", data: updated });
  } catch (err) {
    return res.status(400).json({ status: "ERROR", message: err.message });
  }
};

// DELETE /api/properties/:id
exports.deleteProperty = async (req, res) => {
  try {
    const deleted = await Property.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "Property not found" });
    }
    return res.json({ status: "OK", message: "Deleted successfully", data: deleted });
  } catch (err) {
    return res.status(400).json({ status: "ERROR", message: err.message });
  }
};
