const cache = new Map();
const TTL = 24 * 60 * 60 * 1000; // יום

/**
 * Simple hash function (djb2-like) to convert seed to positive integer
 * @param {string|number} seed - Seed value
 * @returns {number} Hash value (positive integer)
 */
function hash(seed) {
  const str = String(seed || "");
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

async function getPexelsImage(query, seed) {
  // Use seed to deterministically select a page (1-20)
  const page = seed ? (hash(seed) % 20) + 1 : 1;
  
  // Cache key includes both query and page
  const cacheKey = `${query.toLowerCase()}::${page}`;
  const now = Date.now();

  if (cache.has(cacheKey) && cache.get(cacheKey).exp > now) {
    return cache.get(cacheKey).url;
  }

  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&page=${page}`,
    {
      headers: {
        Authorization: process.env.PEXELS_API_KEY,
      },
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const url =
    data?.photos?.[0]?.src?.large2x ||
    data?.photos?.[0]?.src?.large ||
    null;

  cache.set(cacheKey, { url, exp: now + TTL });
  return url;
}

module.exports = { getPexelsImage };
