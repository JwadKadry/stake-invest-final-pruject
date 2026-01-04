// src/services/attom.service.js
const BASE = process.env.ATTOM_BASE_URL || "https://api.gateway.attomdata.com/propertyapi/v1.0.0";
const API_KEY = process.env.ATTOM_API_KEY;

if (!API_KEY) {
  console.warn("⚠️  Missing ATTOM_API_KEY in .env");
}

// Cache TTL 60 seconds
const cache = new Map(); // key -> { exp, data }
const TTL_MS = 60_000;

function toQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.set(k, String(v));
  });
  return usp.toString();
}

async function attomFetch(path, params = {}) {
  const qs = toQuery(params);
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;

  const cacheKey = url;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.exp > now) return hit.data;

  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      apikey: API_KEY,
    },
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`ATTOM error ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  cache.set(cacheKey, { exp: now + TTL_MS, data });
  return data;
}

/**
 * Get property detail by address
 * @param {string} address1 - Street address
 * @param {string} address2 - City, state, zip
 * @returns {Promise<Object>} ATTOM property data
 */
async function getPropertyDetail(address1, address2) {
  return attomFetch("/property/detail", {
    address1,
    address2,
  });
}

/**
 * Geocode city name to latitude/longitude using Nominatim (OpenStreetMap)
 * @param {string} city - City name
 * @returns {Promise<{lat: number, lng: number}|null>} Coordinates or null
 */
async function geocodeCity(city) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Stake-RealEstate-API/1.0",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.[0];
    if (!result || !result.lat || !result.lon) return null;

    return {
      lat: Number(result.lat),
      lng: Number(result.lon),
    };
  } catch (err) {
    console.warn("Geocoding error:", err.message);
    return null;
  }
}

/**
 * Search properties by city using radius search
 * @param {string} city - City name
 * @param {number} page - Page number
 * @param {number} pagesize - Page size
 * @returns {Promise<Object>} ATTOM property search results
 */
async function searchByCity(city, page = 1, pagesize = 12) {
  // First, geocode the city to get coordinates
  const coords = await geocodeCity(city);
  if (!coords) {
    throw new Error(`Could not geocode city: ${city}`);
  }

  // Use radius search with ATTOM
  return attomFetch("/property/address", {
    latitude: coords.lat,
    longitude: coords.lng,
    radius: 2,
    page,
    pagesize,
  });
}

module.exports = { attomFetch, getPropertyDetail, searchByCity };
