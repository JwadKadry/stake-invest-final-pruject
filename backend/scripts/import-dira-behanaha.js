// backend/scripts/import-dira-behanaha.js
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
const RESOURCE_ID = process.env.RESOURCE_ID;

if (!MONGO_URI) throw new Error("Set MONGO_URI first");
if (!RESOURCE_ID) throw new Error("Set RESOURCE_ID first");

const PropertySchema = new mongoose.Schema(
  {
    source: { type: String, default: "data.gov.il" },
    sourceResourceId: String,
    externalId: Number,

    city: String,
    neighborhood: String,
    address: String,
    type: String,

    pricePerMeter: Number,
    housingUnits: Number,
    status: String,

    dealDate: Date, // כאן זה תאריך ביצוע הגרלה (לא עסקת מכירה)
    raw: Object,
  },
  { timestamps: true }
);

PropertySchema.index({ city: 1, type: 1, status: 1, pricePerMeter: 1, dealDate: -1 });

const Property = mongoose.model("Property", PropertySchema);

async function fetchBatch(limit, offset) {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=${limit}&offset=${offset}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json?.success) throw new Error("CKAN datastore_search failed");
  return json.result.records || [];
}

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(+d) ? null : d;
}

function mapRec(r) {
  return {
    source: "data.gov.il",
    sourceResourceId: RESOURCE_ID,
    externalId: r._id,

    city: r.LamasName || null,
    neighborhood: r.Neighborhood || null,
    address: null,
    type: "דירה בהנחה",

    pricePerMeter: toNumber(r.PriceForMeter),
    housingUnits: toNumber(r.LotteryHousingUnits),
    status: r.ProjectStatus || r.LotteryStatusValue || null,

    dealDate: toDate(r.LotteryExecutionDate) || toDate(r.LotteryEndSignupDate),
    raw: r,
  };
}

async function main() {
  await mongoose.connect(MONGO_URI);

  let offset = 0;
  const limit = 5000;

  while (true) {
    const records = await fetchBatch(limit, offset);
    if (!records.length) break;

    const ops = records.map((r) => {
      const doc = mapRec(r);
      return {
        updateOne: {
          filter: { sourceResourceId: RESOURCE_ID, externalId: doc.externalId },
          update: { $set: doc },
          upsert: true,
        },
      };
    });

    const res = await Property.bulkWrite(ops, { ordered: false });
    console.log("offset", offset, "upserted", res.upsertedCount || 0);

    offset += records.length;
    if (records.length < limit) break;
  }

  console.log("Done");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
