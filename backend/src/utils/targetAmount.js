function clamp(min, max, v) {
  return Math.max(min, Math.min(max, v));
}

function roundToNearest(step, v) {
  return Math.round(v / step) * step;
}

// hash קטן ומהיר (djb2)
function hashDjb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h |= 0; // keep 32-bit
  }
  return Math.abs(h);
}

/**
 * @param {object} p - property object (ATTOM)
 * @returns {number} target amount in USD (demo)
 */
function computeTargetAmount(p) {
  const attomId = String(p?.identifier?.attomId ?? "");
  const sqftRaw = Number(p?.building?.size?.livingsize ?? 0);
  const yearBuilt = Number(p?.summary?.yearbuilt ?? 0);

  const sqft = Number.isFinite(sqftRaw) && sqftRaw > 0 ? sqftRaw : 900; // fallback
  const base = sqft * 280;

  let ageBonus = 0;
  if (yearBuilt >= 2010) ageBonus = 60000;
  else if (yearBuilt >= 1980) ageBonus = 25000;

  const noise = attomId ? (hashDjb2(attomId) % 50000) : 15000;

  const raw = base + ageBonus + noise;
  return clamp(120000, 1200000, roundToNearest(5000, raw));
}

module.exports = { computeTargetAmount };

