require("dotenv").config();
const mongoose = require("mongoose");
const Property = require("../models/Property");

// רשימת ערים + מרכזי קואורדינטות (בערך) + מחיר בסיס למ"ר
const CITIES = [
  { city: "Tel Aviv", lat: 32.0853, lng: 34.7818, nisPerSqm: 48000 },
  { city: "Jerusalem", lat: 31.7683, lng: 35.2137, nisPerSqm: 36000 },
  { city: "Haifa", lat: 32.7940, lng: 34.9896, nisPerSqm: 22000 },
  { city: "Rishon LeZion", lat: 31.9640, lng: 34.8048, nisPerSqm: 27000 },
  { city: "Netanya", lat: 32.3215, lng: 34.8532, nisPerSqm: 29000 },
  { city: "Beersheba", lat: 31.25297, lng: 34.79146, nisPerSqm: 16000 },
  { city: "Ashdod", lat: 31.8014, lng: 34.6435, nisPerSqm: 18000 },
  { city: "Holon", lat: 32.0158, lng: 34.7874, nisPerSqm: 32000 },
  { city: "Petah Tikva", lat: 32.0840, lng: 34.8878, nisPerSqm: 28000 },
  { city: "Eilat", lat: 29.5577, lng: 34.9519, nisPerSqm: 25000 },
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate unique Unsplash image URL for each property
 * Uses Unsplash Source API with unique signature based on property index + type
 * This ensures every property gets a different image
 */
function generateUniqueImageUrl(type, index) {
  // Map property types to Unsplash search terms
  const typeQueries = {
    Apartment: "apartment,interior,modern",
    House: "house,exterior,residential",
    Penthouse: "penthouse,luxury,apartment",
    Studio: "studio,apartment,interior",
  };

  const query = typeQueries[type] || "real-estate,property";
  
  // Create unique signature from index + type (ensures different image per property)
  // Using index ensures deterministic but unique images
  const sig = `prop-${index}-${type.toLowerCase()}`;
  
  // Unsplash Source API: https://source.unsplash.com/featured/WIDTHxHEIGHT/?QUERY&sig=SIGNATURE
  return `https://source.unsplash.com/featured/1200x800/?${encodeURIComponent(query)}&sig=${encodeURIComponent(sig)}`;
}

function jitterCoord(base, amount = 0.05) {
  return base + randFloat(-amount, amount);
}

function buildTitle(type, beds, city) {
  if (type === "Studio") {
    return `${type} • ${city}`;
  }
  return `${type} • ${beds}BR • ${city}`;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const N = Number(process.env.SEED_COUNT || 5000);
    console.log(`📦 Generating ${N} properties...`);

    const docs = [];
    for (let i = 0; i < N; i++) {
      const c = pick(CITIES);
      const type = pick(["Apartment", "House", "Penthouse", "Studio"]);

      const beds = type === "Studio" ? 0 : randInt(1, 5);
      const baths = type === "Studio" ? randInt(1, 1) : randInt(1, 3);
      const sqm = type === "House" ? randInt(90, 260) : type === "Studio" ? randInt(25, 40) : randInt(45, 160);

      // מחיר ריאליסטי: מ"ר * מחיר בסיס +- סטייה + בונוס לפי סוג
      let multiplier = 1;
      if (type === "Penthouse") multiplier = 1.35;
      if (type === "House") multiplier = 1.15;
      if (type === "Studio") multiplier = 0.85;

      const noise = randFloat(0.85, 1.25);
      const price = Math.round(sqm * c.nisPerSqm * multiplier * noise);

      const lat = jitterCoord(c.lat, 0.06);
      const lng = jitterCoord(c.lng, 0.06);

      const streetNum = randInt(1, 220);
      const streets = [
        "Herzl", "Ben Yehuda", "Rothschild", "Allenby", "HaNasi", 
        "Bialik", "Weizmann", "Jabotinsky", "Dizengoff", "King George",
        "Ibn Gvirol", "HaYarkon", "Arlozorov", "Nordau", "Ben Gurion"
      ];
      const street = pick(streets);
      const address = `${street} ${streetNum}, ${c.city}, Israel`;

      // Set targetAmount to price * random factor (for investment properties)
      const targetAmount = Math.round(price * randFloat(1.0, 1.5));

      // ✅ Generate unique image URL for each property
      const imageUrl = generateUniqueImageUrl(type, i);

      docs.push({
        title: buildTitle(type, beds, c.city),
        address,
        city: c.city,
        price,
        beds,
        baths,
        sqm,
        type,
        imageUrl, // ✅ Unique image per property
        lat,
        lng,
        targetAmount,
        investedAmount: 0,
        status: "open",
      });

      // Log progress every 1000 items
      if ((i + 1) % 1000 === 0) {
        console.log(`  Generated ${i + 1}/${N} properties...`);
      }
    }

    console.log(`🗑️  Clearing existing properties...`);
    await Property.deleteMany({});
    
    console.log(`💾 Inserting ${docs.length} properties...`);
    await Property.insertMany(docs);

    const stats = await Property.aggregate([
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 },
          avgPrice: { $avg: "$price" },
          avgSqm: { $avg: "$sqm" },
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log("\n📊 Statistics by city:");
    stats.forEach(s => {
      console.log(`  ${s._id}: ${s.count} properties, avg price: ₪${Math.round(s.avgPrice).toLocaleString()}, avg sqm: ${Math.round(s.avgSqm)}`);
    });

    console.log(`\n✅ Seeded ${docs.length} properties successfully!`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error("❌ Seed error:", e);
    process.exit(1);
  }
}

run();