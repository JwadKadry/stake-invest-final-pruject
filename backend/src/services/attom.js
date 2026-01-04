// backend/src/services/attom.js
const BASE = process.env.ATTOM_BASE_URL || "https://api.developer.attomdata.com";
const KEY  = process.env.ATTOM_API_KEY;

if (!KEY) console.warn("⚠️  Missing ATTOM_API_KEY in .env");

async function attomFetch(path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const resp = await fetch(url, {
    headers: {
      // ATTOM בדרך כלל מצפה ל־apikey header (כך מופיע לרוב בדוגמאות שלהם)
      apikey: KEY,
      accept: "application/json",
    },
  });

  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!resp.ok) {
    const err = new Error(`ATTOM error ${resp.status}`);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

module.exports = { attomFetch };

