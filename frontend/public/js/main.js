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

async function loadAndRender(params = {}) {
  clearError();
  setMessage("");
  setLoading(true);

  try {
    const res = await fetchProperties(params);

    const count = res?.count ?? (res?.data?.length ?? 0);
    setMetaText(`Found ${count} properties`);

    renderResults(res.data || []);
  } catch (e) {
    showError(e.message || "Error loading properties");
  } finally {
    setLoading(false);
  }
}

function getFilterParamsFromUI() {
  const address1 = document.getElementById("address1")?.value.trim() || "";
  const address2 = document.getElementById("address2")?.value.trim() || "";

  // Mode A: address1 AND address2 (address detail mode)
  if (address1 && address2) {
    return { address1, address2 };
  }
  // Mode B: address1 empty, address2 as city (city listing mode)
  else if (!address1 && address2) {
    return { city: address2, limit: 12, page: 1 };
  }
  // Invalid: need at least address2 (city) or both address1+address2
  return null;
}

document.getElementById("filtersForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const params = getFilterParamsFromUI();
  if (!params) {
    showError("Enter address or city");
    return;
  }
  await loadAndRender(params);
});

document.getElementById("resetBtn").addEventListener("click", async () => {
  const address1El = document.getElementById("address1");
  const address2El = document.getElementById("address2");
  if (address1El) address1El.value = "";
  if (address2El) address2El.value = "";
  await loadAndRender({});
});

// Auto-load on boot with default city
(async function boot() {
  // Check if we're on the properties page (has results container)
  const results = document.getElementById("results");
  if (!results) return;
  
  setLoading(true);
  setMetaText("Loading properties...");
  
  try {
    const res = await fetchProperties({ city: "Denver", limit: 12, page: 1 });
    const count = res?.count ?? (res?.data?.length ?? 0);
    setMetaText(`Found ${count} properties`);
    renderResults(res.data || []);
    
    // Set address2 input to "Denver" after successful load
    const address2El = document.getElementById("address2");
    if (address2El) address2El.value = "Denver";
  } catch (e) {
    showError(e.message || "Error loading properties");
    setMetaText("Enter address or city to search properties");
  } finally {
    setLoading(false);
  }
})();
