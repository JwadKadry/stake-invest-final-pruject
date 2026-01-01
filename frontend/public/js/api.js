// public/js/api.js
const BASE_URL = "/api/properties";

function buildQuery(params) {
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([key, val]) => {
    if (val === undefined || val === null) return;
    const s = String(val).trim();
    if (s === "") return;
    qs.set(key, s);
  });

  return qs.toString();
}

export async function fetchProperties(params, signal) {
  const query = buildQuery(params);
  const url = query ? `${BASE_URL}?${query}` : BASE_URL;

  const res = await fetch(url, { signal });

  // אם השרת מחזיר JSON בפורמט שלך (status/message), נקרא אותו
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
