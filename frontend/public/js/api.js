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
  const qs = buildQuery(params);
  const url = qs ? `${BASE_URL}?${qs}` : BASE_URL;
  return requestJson(url);
}
