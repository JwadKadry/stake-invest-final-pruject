// public/js/main.js
import { fetchProperties } from "./api.js";
import {
  setLoading,
  showError,
  clearError,
  setMetaText,
  setMessage,
  renderResults,
} from "./ui.js";

// ✅ Store last loaded properties and active tab for filtering
let lastLoadedProperties = [];
let activeTab = "available"; // available | funded | pending
const PAGE_SIZE = 24;
let currentPage = 1;

// ✅ Apply tab filter to list
function applyTabFilter(list) {
  const arr = Array.isArray(list) ? list : [];

  if (activeTab === "funded") {
    return arr.filter(p => Number(p.fundedPercent || 0) >= 100);
  }
  if (activeTab === "available") {
    return arr.filter(p => Number(p.fundedPercent || 0) < 100);
  }
  if (activeTab === "exited") {
    return []; // כרגע אין לך שדה EXITED אמיתי
  }
  return arr;
}

// ========================================
// Central API Fetch Function
// ========================================
const API_BASE = "http://localhost:5000";

async function apiFetch(url, options = {}) {
  const res = await fetch(url.startsWith("http") ? url : `${API_BASE}${url}`, {
    ...options,
    credentials: "include", // ✅ הכי חשוב - שולח cookies/session
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  // ✅ Throw error for 401 (login required)
  if (res.status === 401) {
    throw new Error("LOGIN_REQUIRED");
  }

  return res;
}

// Expose apiFetch globally for other scripts (like favorites.js, property.js)
if (typeof window !== 'undefined') {
  window.apiFetch = apiFetch;
}

// ========================================
// Load Properties By City (exposed for cities-autocomplete.js)
// ========================================
export async function loadPropertiesByCity(city, page = 1, limit = 12) {
  if (!city) return;
  
  currentPage = page; // Update current page
  setLoading(true);
  clearError();
  
  try {
    // If status filter is active, use the new aggregation API
    if (activeTab === "funded" || activeTab === "available" || activeTab === "pending") {
      await loadWithCurrentFilters();
      return;
    }

    // Otherwise use old logic for backward compatibility
    const params = {
      city: city,
      page: page.toString(),
      limit: limit.toString(),
    };
    
    // Get type filter if selected
    const typeFilter = document.getElementById("typeFilter")?.value;
    if (typeFilter && typeFilter !== "ALL" && typeFilter !== "ALL TYPES") {
      params.type = typeFilter;
    }
    
    const data = await fetchProperties(params);
    let properties = data.data || [];

    // ✅ Filter by text search if address1 (search query) is provided
    const searchQuery = document.getElementById("address1")?.value.trim() || "";
    if (searchQuery) {
      properties = properties.filter(p => matchesQuery(p, searchQuery));
    }

    // ✅ Save last loaded properties (no local filtering - server already filtered)
    lastLoadedProperties = properties;
    renderResults(lastLoadedProperties);
    renderPagination(data.total || 0, data.page || page, data.limit || limit);
    setMetaText(properties.length ? `נמצאו ${data.total || properties.length} נכסים` : "");
  } catch (err) {
    console.error("Error loading properties:", err);
    showError("שגיאה בטעינת נכסים");
  } finally {
    setLoading(false);
  }
}

// Expose to window for cities-autocomplete.js (standalone script)
if (typeof window !== 'undefined') {
  window.loadPropertiesByCity = loadPropertiesByCity;
  window.renderResults = renderResults;
  window.setMetaText = setMetaText;
  window.setLoading = setLoading;
  window.clearError = clearError;
  window.showError = showError;
}

// ========================================
// Text Search Functions (Normalize & Match)
// ========================================
function normalizeText(s) {
  return (s ?? "")
    .toString()
    .normalize("NFKD")              // תומך בפירוק תווים/דיאקריטיקה
    .replace(/[\u0300-\u036f]/g, "")// מסיר סימני ניקוד/דיאקריטיקה
    .toLowerCase()
    .replace(/[•|,.-]/g, " ")       // מחליף תווים מפרידים לרווח
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchText(p) {
  // תתאים לשמות השדות אצלך (title/type/city/bedrooms וכו')
  const br = p.bedrooms || p.beds ? `${p.bedrooms || p.beds}br` : "";
  return normalizeText([
    p.title,
    p.addressOneLine || p.address,
    p.propertyType || p.type,
    br,
    p.city,
    p.description,
  ].filter(Boolean).join(" "));
}

function matchesQuery(property, query) {
  const q = normalizeText(query);
  if (!q) return true;

  const hay = buildSearchText(property);

  // טוקנים: "penthouse 3br jerusalem" => ["penthouse","3br","jerusalem"]
  const tokens = q.split(" ").filter(Boolean);

  // כל טוקן חייב להופיע איפשהו במחרוזת המאוחדת
  return tokens.every(t => hay.includes(t));
}

// ========================================
// Properties Search Logic
// ========================================
async function loadAndRender(params = {}) {
  clearError();
  setMessage("");
  setLoading(true);

    try {
      // ✅ Add status parameter if activeTab is funded/available/pending
      if (activeTab === "funded" || activeTab === "available" || activeTab === "pending") {
        params.status = activeTab;
      }

      const res = await fetchProperties(params);
      let properties = res.data || [];

      // ✅ Filter by text search if address1 (search query) is provided
      const searchQuery = document.getElementById("address1")?.value.trim() || "";
      if (searchQuery) {
        properties = properties.filter(p => matchesQuery(p, searchQuery));
      }

      // ✅ Save last loaded properties (no local filtering - server already filtered)
      lastLoadedProperties = properties;
      const count = properties.length;
      setMetaText(`נמצאו ${count} נכסים`);

      renderResults(lastLoadedProperties);
  } catch (e) {
    showError(e.message || "שגיאה בטעינת נכסים");
  } finally {
    setLoading(false);
  }
}

function getFilterParamsFromUI() {
  const address1 = document.getElementById("address1")?.value.trim() || "";
  const cityInputEl = document.getElementById("cityInput");
  const city = cityInputEl?.value.trim() || "";

  // ❌ אין עיר
  if (!city) return null;

  // ❌ עיר לא נבחרה מה-autocomplete
  if (cityInputEl?.dataset.validCity !== "true") {
    showError("בחר עיר מהרשימה בלבד");
    return null;
  }

  const params = { city, limit: 12, page: 1 };

  if (address1) {
    params.q = address1; // 🔍 חיפוש טקסט בתוך העיר
  }

  const type = document.getElementById("typeFilter")?.value;
  if (type && type !== "ALL") params.type = type;

  // ✅ Add status parameter if activeTab is funded/available/pending
  if (activeTab === "funded" || activeTab === "available" || activeTab === "pending") {
    params.status = activeTab;
  }

  return params;
}

document.getElementById("filtersForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  currentPage = 1; // Reset to page 1 on new search
  
  // If we have status filter active, use loadWithCurrentFilters
  if (activeTab === "funded" || activeTab === "available" || activeTab === "pending") {
    await loadWithCurrentFilters();
  } else {
    const params = getFilterParamsFromUI();
    if (!params) {
      showError("הזן עיר לחיפוש");
      return;
    }
    await loadAndRender(params);
  }
});

document.getElementById("resetBtn").addEventListener("click", async () => {
  const address1El = document.getElementById("address1");
  const cityInputEl = document.getElementById("cityInput");
  if (address1El) address1El.value = "";
  if (cityInputEl) cityInputEl.value = "";
  // hideDropdown is from cities-autocomplete.js, might not be available
  const cityDropdown = document.getElementById("cityDropdown");
  if (cityDropdown) cityDropdown.classList.add("hidden");
  await loadAndRender({});
});

// ========================================
// Load Random Properties (for homepage)
// ========================================
async function loadRandomProperties() {
  const results = document.getElementById("results");
  if (!results) return;
  
  setLoading(true);
  clearError();
  setMetaText("טוען נכסים...");
  
  try {
    // ✅ Use apiFetch with random=true (note: random doesn't support status filter)
    const res = await apiFetch(`/api/properties?random=true&limit=20`);
    
    const json = await res.json();
    let properties = json.data || [];

    // ✅ Filter by text search if address1 (search query) is provided
    const searchQuery = document.getElementById("address1")?.value.trim() || "";
    if (searchQuery) {
      properties = properties.filter(p => matchesQuery(p, searchQuery));
    }

    // ✅ Save last loaded properties (for random, we do local filtering if status tab is active)
    lastLoadedProperties = properties;
    const count = properties.length;
    setMetaText(count > 0 ? `נמצאו ${count} נכסים` : "לא נמצאו נכסים");
    
    // For random properties, apply local filter if status tab is active (backend doesn't support status with random)
    if (activeTab === "funded" || activeTab === "available") {
      renderResults(applyTabFilter(lastLoadedProperties));
    } else {
      renderResults(lastLoadedProperties);
    }
  } catch (err) {
    console.error("Error loading random properties:", err);
    showError("שגיאה בטעינת נכסים");
    setMetaText("הזן עיר לחיפוש נכסים");
  } finally {
    setLoading(false);
  }
}

// ========================================
// Build Query Parameters
// ========================================
function buildQuery() {
  const params = new URLSearchParams();

  params.set("page", String(currentPage));
  params.set("limit", String(PAGE_SIZE));
  params.set("status", activeTab);
  params.set("sort", "funded_desc"); // מיון: "התקדמות מימון" קודם

  const cityInputEl = document.getElementById("cityInput");
  const city = cityInputEl?.value?.trim();
  const address1 = document.getElementById("address1")?.value?.trim();

  // funded / pending = מכל הערים (לא כולל city)
  if (activeTab !== "funded" && activeTab !== "pending" && city) {
    params.set("city", city);
  }
  
  if (address1) {
    params.set("q", address1);
  }

  const type = document.getElementById("typeFilter")?.value;
  if (type && type !== "ALL" && type !== "ALL TYPES") {
    params.set("type", type);
  }

  return params.toString();
}

// ========================================
// Load with current filters and status
// ========================================
async function loadWithCurrentFilters() {
  setLoading(true);
  clearError();

  try {
    // If we have status filter (funded/available/pending), always use aggregation API
    if (activeTab === "funded" || activeTab === "available" || activeTab === "pending") {
      const qs = buildQuery();
      const res = await fetch(`/api/properties?${qs}`, { credentials: "include" });
      const json = await res.json();

      if (json.status === "OK") {
        lastLoadedProperties = json.data || [];
        renderResults(lastLoadedProperties);
        renderPagination(json.total || 0, json.page || 1, json.limit || PAGE_SIZE);
        setMetaText(lastLoadedProperties.length ? `נמצאו ${json.total || 0} נכסים` : "לא נמצאו נכסים");
      } else {
        showError(json.message || "שגיאה בטעינת נכסים");
      }
    } else {
      // No status filter - use existing logic
      const params = getFilterParamsFromUI();
      
      if (params) {
        // We have city filters - use loadAndRender
        await loadAndRender(params);
      } else {
        // No city filters - might be random properties or initial load
        await loadRandomProperties();
      }
    }
  } catch (err) {
    console.error("Error loading properties:", err);
    showError("שגיאה בטעינת נכסים");
  } finally {
    setLoading(false);
  }
}

// ========================================
// Render Pagination UI
// ========================================
function renderPagination(total, page, limit) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const el = document.getElementById("pagination");
  if (!el) return;

  el.innerHTML = `
    <button id="prevPage" ${page <= 1 ? "disabled" : ""} class="pagination-btn">הקודם</button>
    <span class="pagination-info">עמוד ${page} מתוך ${totalPages}</span>
    <button id="nextPage" ${page >= totalPages ? "disabled" : ""} class="pagination-btn">הבא</button>
  `;

  document.getElementById("prevPage")?.addEventListener("click", async () => {
    if (currentPage > 1) {
      currentPage--;
      await loadWithCurrentFilters();
    }
  });

  document.getElementById("nextPage")?.addEventListener("click", async () => {
    if (currentPage < totalPages) {
      currentPage++;
      await loadWithCurrentFilters();
    }
  });
}

// ✅ Initialize property status tabs
function initTabs() {
  const tabs = document.querySelectorAll(".property-tab");
  if (!tabs.length) return;

  tabs.forEach(btn => {
    btn.addEventListener("click", async () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      activeTab = btn.dataset.tab || "available";
      currentPage = 1; // ✅ Reset to page 1 when changing tabs
      
      // ✅ Fetch from server with status parameter instead of local filtering
      await loadWithCurrentFilters();
    });
  });
}

// Auto-load random properties on boot
(async function boot() {
  // Check if we're on the properties page (has results container)
  const results = document.getElementById("results");
  if (!results) return;

  initTabs();
  await loadRandomProperties();
})();
