// src/services/attomClient.js
const BASE = process.env.ATTOM_BASE_URL || "https://api.developer.attomdata.com";
const KEY = process.env.ATTOM_API_KEY;

async function attomFetch(path, params = {}) {
  if (!KEY) throw new Error("Missing ATTOM_API_KEY in .env");

  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const resp = await fetch(url, {
    headers: {
      apikey: KEY,              // <- זה הקריטי
      accept: "application/json",
    },
  });

  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!resp.ok) {
    const msg = typeof data === "string" ? data : (data?.message || "ATTOM error");
    throw new Error(`ATTOM ${resp.status}: ${msg}`);
  }
  return data;
}

module.exports = { attomFetch };
