// backend/src/controllers/propertyCkanController.js

const CKAN_BASE = process.env.CKAN_BASE;
const CKAN_RID = process.env.CKAN_RID;

function toInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// Cache קטן בזיכרון כדי לא להפציץ את CKAN
const CACHE_TTL_MS = 30_000;
const cache = new Map(); // key -> { expiresAt, payload }

function cacheGet(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.payload;
}
function cacheSet(key, payload) {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
}

function placeholderImage({ city = "Israel", type = "property" }) {
  return `https://source.unsplash.com/featured/800x600?real-estate,${encodeURIComponent(
    city
  )},${encodeURIComponent(type)}`;
}

function normalizeRecord(rec) {
  const title = rec.title || rec.Title || rec.name || "נכס";
  const city = rec.city || rec.City || rec.yishuv || rec["יישוב"] || "Israel";
  const type = (rec.type || rec.Type || "apartment").toString().toLowerCase();

  const priceRaw = rec.price || rec.Price || rec.sum || rec["מחיר"] || 0;
  const price = Number(String(priceRaw).replace(/[,₪]/g, "")) || 0;

  const img =
    rec.imageUrl ||
    rec.image ||
    rec.ImageURL ||
    placeholderImage({ city, type });

  return {
    _id: String(rec._id || rec.id || `${title}-${city}-${price}`),
    title,
    description: rec.description || "",
    price,
    currency: "ILS",
    address: rec.address || "",
    city,
    country: "Israel",
    bedrooms: Number(rec.bedrooms || 0),
    bathrooms: Number(rec.bathrooms || 0),
    type,
    listingStatus: (rec.listingStatus || "for-sale").toString().toLowerCase(),
    images: [img],
    isPublished: true,
    createdAt: rec.createdAt || new Date().toISOString(),
    updatedAt: rec.updatedAt || new Date().toISOString(),
  };
}

// GET /api/properties  (CKAN)
exports.getPropertiesCkan = async (req, res) => {
  try {
    if (!CKAN_BASE || !CKAN_RID) {
      return res.status(500).json({
        status: "ERROR",
        message: "Missing CKAN_BASE or CKAN_RID in .env",
      });
    }

    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 10)));
    const offset = (page - 1) * limit;

    const q = (req.query.q || "").toString().trim().toLowerCase();
    const city = (req.query.city || "").toString().trim().toLowerCase();
    const type = (req.query.type || "").toString().trim().toLowerCase();

    const minPrice =
      req.query.minPrice !== undefined ? toInt(req.query.minPrice, undefined) : undefined;
    const maxPrice =
      req.query.maxPrice !== undefined ? toInt(req.query.maxPrice, undefined) : undefined;

    const cacheKey = JSON.stringify({ page, limit, q, city, type, minPrice, maxPrice });
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    // CKAN datastore_search: limit + offset + resource_id
    const url = new URL(`${CKAN_BASE}/datastore_search`);
    url.searchParams.set("resource_id", CKAN_RID);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const r = await fetch(url);
    if (!r.ok) {
      return res.status(502).json({ status: "ERROR", message: `CKAN HTTP ${r.status}` });
    }
    const json = await r.json();
    if (!json.success) {
      return res.status(502).json({ status: "ERROR", message: "CKAN success=false" });
    }

    const total = Number(json.result.total || 0);
    let records = (json.result.records || []).map(normalizeRecord);

    // פילטרים מקומיים (מינימליים) כדי שה-UI יעבוד
    if (q) records = records.filter((p) => (p.title || "").toLowerCase().includes(q));
    if (city) records = records.filter((p) => (p.city || "").toLowerCase() === city);
    if (type) records = records.filter((p) => (p.type || "").toLowerCase() === type);
    if (minPrice !== undefined) records = records.filter((p) => Number(p.price) >= minPrice);
    if (maxPrice !== undefined) records = records.filter((p) => Number(p.price) <= maxPrice);

    const payload = {
      status: "OK",
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        sort: "-createdAt",
        filter: {},
        source: "CKAN",
      },
      count: records.length,
      data: records,
    };

    cacheSet(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ status: "ERROR", message: err.message });
  }
};
