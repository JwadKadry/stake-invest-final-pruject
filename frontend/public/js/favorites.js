// favorites.js - Favorites utility functions (with cache + optimistic UI)

// -----------------------------
// Favorites cache (in-memory)
// -----------------------------
let favoritesCache = null;           // Array of favorites
let favoritesCacheAt = 0;            // timestamp (ms)
let favoritesFetchPromise = null;    // in-flight dedupe

const CACHE_TTL_MS = 30_000; // 30 seconds

// ✅ Favorites version for cross-tab synchronization
const FAVORITES_VERSION_KEY = "favorites_version";

function bumpFavoritesVersion() {
  try {
    const v = Number(localStorage.getItem(FAVORITES_VERSION_KEY) || "0") + 1;
    localStorage.setItem(FAVORITES_VERSION_KEY, String(v));
  } catch {}
}

// ✅ כשיש שינוי ב-localStorage בטאב אחר → ננקה cache בטאב הנוכחי
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === FAVORITES_VERSION_KEY) {
      invalidateFavoritesCache();
    }
  });

  // ✅ כשחוזרים לטאב (visibility) → נרענן cache כדי לא להיות "תקועים"
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      invalidateFavoritesCache();
    }
  });
}

function nowMs() {
  return Date.now();
}

function isCacheValid() {
  return Array.isArray(favoritesCache) && (nowMs() - favoritesCacheAt) < CACHE_TTL_MS;
}

function invalidateFavoritesCache() {
  favoritesCache = null;
  favoritesCacheAt = 0;
  favoritesFetchPromise = null;
}

function normalizeId(x) {
  return String(x ?? "").trim();
}

// -----------------------------
// Fetch favorites once (cached)
// -----------------------------
async function getFavoritesCached({ force = false } = {}) {
  try {
    if (!force && isCacheValid()) return favoritesCache;

    if (!force && favoritesFetchPromise) return favoritesFetchPromise;

    favoritesFetchPromise = (async () => {
      const resp = await fetch("/api/favorites", {
        credentials: "include",
      });

      if (!resp.ok) {
        // If unauthorized or error, treat as empty cache
        favoritesCache = [];
        favoritesCacheAt = nowMs();
        return favoritesCache;
      }

      const json = await resp.json();
      favoritesCache = Array.isArray(json.data) ? json.data : [];
      favoritesCacheAt = nowMs();
      return favoritesCache;
    })();

    const data = await favoritesFetchPromise;
    favoritesFetchPromise = null;
    return data;
  } catch {
    favoritesFetchPromise = null;
    // Don't lock bad results in cache
    return [];
  }
}

// -----------------------------
// Check if property is favorited (uses cache)
// -----------------------------
async function isFavorited(propertyId) {
  try {
    const pid = normalizeId(propertyId);
    if (!pid) return false;

    const favorites = await getFavoritesCached();
    return favorites.some((f) => normalizeId(f.propertyId) === pid);
  } catch {
    return false;
  }
}

// -----------------------------
// Add / Remove favorite (API)
// -----------------------------
async function addFavorite(propertyId, title, city, imageUrl) {
  // ✅ Use apiFetch if available (from main.js), otherwise fallback to fetch with credentials
  const fetchFn = (typeof window !== 'undefined' && window.apiFetch) || 
                  ((url, opts) => fetch(url, { ...opts, credentials: "include" }));
  
  const resp = await fetchFn("/api/favorites", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId, title, city, imageUrl }),
  });
  
  const data = await resp.json().catch(() => ({}));
  
  // ✅ Server decides: 401 = not logged in
  if (resp.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  
  if (!resp.ok) {
    throw new Error(data.message || `HTTP ${resp.status}`);
  }
  
  invalidateFavoritesCache();
  bumpFavoritesVersion(); // ✅ הודע לכל הדפים על השינוי
  return true;
}

async function removeFavorite(propertyId) {
  // ✅ Use apiFetch if available (from main.js), otherwise fallback to fetch with credentials
  const fetchFn = (typeof window !== 'undefined' && window.apiFetch) || 
                  ((url, opts) => fetch(url, { ...opts, credentials: "include" }));
  
  const resp = await fetchFn(`/api/favorites/${encodeURIComponent(propertyId)}`, {
    method: "DELETE",
  });
  
  const data = await resp.json().catch(() => ({}));
  
  // ✅ Server decides: 401 = not logged in
  if (resp.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  
  if (!resp.ok) {
    throw new Error(data.message || `HTTP ${resp.status}`);
  }
  
  invalidateFavoritesCache();
  bumpFavoritesVersion(); // ✅ הודע לכל הדפים על השינוי
  return true;
}

// -----------------------------
// UI helpers for favorite button
// -----------------------------
function applyButtonState(btn, favorited) {
  if (!btn) return;

  if (favorited) {
    btn.classList.add("favorited");
    btn.title = "Remove from favorites";
    btn.style.color = "#fbbf24";
  } else {
    btn.classList.remove("favorited");
    btn.title = "Add to favorites";
    btn.style.color = "#9ca3af";
  }
}

// -----------------------------
// Toggle favorite (Optimistic UI + rollback)
// -----------------------------
async function toggleFavorite(propertyId, title, city, imageUrl, buttonElement) {
  // ✅ No frontend auth check - server decides!
  
  const pid = normalizeId(propertyId);
  if (!pid) return false;

  const currentlyFavorited = buttonElement.classList.contains("favorited");
  const nextState = !currentlyFavorited;

  // ✅ Optimistic UI: update immediately
  applyButtonState(buttonElement, nextState);

  // Also update cache optimistically (if exists)
  if (Array.isArray(favoritesCache)) {
    if (nextState) {
      // Add a minimal snapshot to cache
      favoritesCache.push({
        propertyId: pid,
        title: title || "",
        city: city || "",
        imageUrl: imageUrl || "",
        createdAt: new Date().toISOString(),
      });
    } else {
      favoritesCache = favoritesCache.filter((f) => normalizeId(f.propertyId) !== pid);
    }
    favoritesCacheAt = nowMs();
  }

  // Call server - server will return 401 if not logged in
  try {
    if (nextState) {
      await addFavorite(pid, title, city, imageUrl);
    } else {
      await removeFavorite(pid);
    }
  } catch (err) {
    // ❌ Rollback if failed
    applyButtonState(buttonElement, currentlyFavorited);

    // rollback cache
    if (Array.isArray(favoritesCache)) {
      if (currentlyFavorited) {
        // should be favorited
        const exists = favoritesCache.some((f) => normalizeId(f.propertyId) === pid);
        if (!exists) {
          favoritesCache.push({
            propertyId: pid,
            title: title || "",
            city: city || "",
            imageUrl: imageUrl || "",
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        // should be not favorited
        favoritesCache = favoritesCache.filter((f) => normalizeId(f.propertyId) !== pid);
      }
      favoritesCacheAt = nowMs();
    }

    // ✅ Server returned 401 = not logged in
    if (err.message === "UNAUTHORIZED" || err.message.includes("401")) {
      alert("צריך להתחבר כדי לשמור למועדפים");
    } else {
      alert(err.message || (nextState ? "שגיאה בהוספת מועדף" : "שגיאה בהסרת מועדף"));
    }
    return currentlyFavorited;
  }

  // Success → keep optimistic state
  return nextState;
}

// -----------------------------
// Create favorites button element
// -----------------------------
function createFavoritesButton(propertyId, title, city, imageUrl) {
  const btn = document.createElement("button");
  btn.className = "favorite-btn";
  btn.type = "button";
  btn.innerHTML = "★";
  btn.title = "Add to favorites";
  btn.style.cssText = `
    background: transparent;
    border: none;
    font-size: 24px;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px 8px;
    transition: color 0.2s;
  `;

  btn.onmouseenter = () => {
    if (!btn.classList.contains("favorited")) {
      btn.style.color = "#fbbf24";
    }
  };

  btn.onmouseleave = () => {
    if (!btn.classList.contains("favorited")) {
      btn.style.color = "#9ca3af";
    }
  };

  // Check initial state (now cached + deduped across buttons)
  (async () => {
    const favorited = await isFavorited(propertyId);
    applyButtonState(btn, favorited);
  })();

  btn.onclick = async () => {
    await toggleFavorite(propertyId, title, city, imageUrl, btn);
  };

  return btn;
}

export {
  isFavorited,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  createFavoritesButton,
  // optional exports if you want to use them elsewhere:
  invalidateFavoritesCache,
};
