// public/js/api.js
const BASE_URL = "/api/properties";

/**
 * Central API fetch function that always includes credentials
 * This ensures cookies/session are sent with every request
 */
export function apiFetch(path, options = {}) {
  // Remove leading slash if API_BASE already has it, or add if needed
  const url = path.startsWith("/") ? path : `/${path}`;
  
  return fetch(url, {
    ...options,
    credentials: "include", // ✅ Always send cookies/session
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

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
  const res = await fetch(url, { 
    headers: { Accept: "application/json" },
    credentials: "include", // ✅ Ensure credentials for all requests
  });
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
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, v);
  });
  const queryString = qs.toString();
  const url = `/api/properties${queryString ? `?${queryString}` : ""}`;
  
  // 🔍 DEBUG: log request URL
  console.log("[fetchProperties] URL:", url);
  
  const r = await fetch(url, { credentials: "include" });
  const json = await r.json();
  
  // 🔍 DEBUG: log response
  console.log("[fetchProperties] Response count:", json?.count, "data length:", json?.data?.length);
  
  return json;
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
