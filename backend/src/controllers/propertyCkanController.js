// backend/src/controllers/propertyCkanController.js
// CKAN -> Normalize to "Property" format for your frontend

function toNumberFromText(v) {
    // "9,242.00" -> 9242
    const n = Number(String(v ?? "0").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  
  function makeImage(city) {
    // placeholder image (works without storing images in DB)
    return `https://source.unsplash.com/featured/800x600?housing,${encodeURIComponent(city || "Israel")}`;
  }
  
  function normalizeRecord(rec) {
    const title = rec.ProjectName || "פרויקט";
    const city = rec.LamasName || "—";
    const type = rec.MarketingMethodDesc || "—";
    const status = rec.LotteryStatusValue || rec.ProjectStatus || "—";
  
    const price = toNumberFromText(rec.PriceForMeter); // price per meter in ILS
  
    const descriptionParts = [];
    if (rec.Neighborhood && rec.Neighborhood !== "-") descriptionParts.push(rec.Neighborhood);
    if (rec.ProviderName && rec.ProviderName !== "-") descriptionParts.push(rec.ProviderName);
  
    return {
      _id: String(rec._id ?? ""),
      title,
      description: descriptionParts.join(" • "),
      price,
      currency: "ILS",
      address: "",
      city,
      country: "Israel",
      bedrooms: 0,
      bathrooms: 0,
      type,
      listingStatus: status,
      images: [makeImage(city)],
      isPublished: true,
      createdAt: rec.LotteryExecutionDate || new Date().toISOString(),
      updatedAt: rec.LotteryExecutionDate || new Date().toISOString(),
  
      // optional: keep raw for debugging
      raw: rec,
    };
  }
  
  exports.getPropertiesCkan = async (req, res) => {
    try {
      const base = process.env.CKAN_BASE;
      const rid = process.env.CKAN_RID;
  
      if (!base || !rid) {
        return res.status(500).json({
          status: "ERROR",
          message: "Missing CKAN_BASE/CKAN_RID in backend/.env",
        });
      }
  
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
      const offset = (page - 1) * limit;
  
      const q = String(req.query.q || "").trim().toLowerCase();
      const cityFilter = String(req.query.city || "").trim().toLowerCase();
      const typeFilter = String(req.query.type || "").trim().toLowerCase();
  
      const minPrice =
        req.query.minPrice !== undefined && String(req.query.minPrice).trim() !== ""
          ? Number(req.query.minPrice)
          : undefined;
  
      const maxPrice =
        req.query.maxPrice !== undefined && String(req.query.maxPrice).trim() !== ""
          ? Number(req.query.maxPrice)
          : undefined;
  
      // CKAN datastore_search (limit/offset + total)
      const url = new URL(`${base}/datastore_search`);
      url.searchParams.set("resource_id", rid);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));
  
      const r = await fetch(url);
      const json = await r.json();
  
      if (!r.ok || !json.success) {
        return res.status(502).json({
          status: "ERROR",
          message: "CKAN request failed",
          payload: json,
        });
      }
  
      // Normalize records for frontend
      let data = (json.result.records || []).map(normalizeRecord);
  
      // Local filtering (simple & safe)
      if (q) {
        data = data.filter((p) => {
          const t = (p.title || "").toLowerCase();
          const d = (p.description || "").toLowerCase();
          return t.includes(q) || d.includes(q);
        });
      }
      if (cityFilter) data = data.filter((p) => (p.city || "").toLowerCase() === cityFilter);
      if (typeFilter) data = data.filter((p) => (p.type || "").toLowerCase() === typeFilter);
      if (Number.isFinite(minPrice)) data = data.filter((p) => Number(p.price) >= minPrice);
      if (Number.isFinite(maxPrice)) data = data.filter((p) => Number(p.price) <= maxPrice);
  
      return res.json({
        status: "OK",
        meta: {
          page,
          limit,
          total: Number(json.result.total || 0),
          pages: Math.ceil(Number(json.result.total || 0) / limit),
          source: "CKAN",
        },
        count: data.length,
        data,
      });
    } catch (err) {
      return res.status(500).json({ status: "ERROR", message: err.message });
    }
  };
  