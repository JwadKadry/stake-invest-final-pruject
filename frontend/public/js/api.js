// public/js/api.js
const BASE_URL = "/api/properties";

function buildQuery(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (!s) continue;
    qs.set(k, s);
  }
  return qs.toString();
}

async function requestJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export async function fetchProperties(params = {}) {
  const url = new URL("/api/properties", window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const r = await fetch(url, { credentials: "include" });
  return r.json();
}

/**
 * Helper function to load properties by postal code
 * Example: loadPropertiesByZip("19977")
 */
export async function loadPropertiesByZip(zip) {
  const res = await fetch(`/api/properties?postalCode=${encodeURIComponent(zip)}`, {
    credentials: "include",
  });
  const json = await res.json();
  if (json.status !== "OK") throw new Error(json.message);
  return json.data || [];
}

/**
 * Helper function to load properties by address
 * Example: loadPropertiesByAddress("468 SEQUOIA DR", "SMYRNA, DE 19977")
 */
export async function loadPropertiesByAddress(address1, address2) {
  const params = new URLSearchParams({
    address1: encodeURIComponent(address1),
    address2: encodeURIComponent(address2),
  });
  const res = await fetch(`/api/properties?${params.toString()}`, {
    credentials: "include",
  });
  const json = await res.json();
  if (json.status !== "OK") throw new Error(json.message);
  return json.data || [];
}
