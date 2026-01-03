// public/js/main.js
import { fetchProperties } from "./api.js";
import {
  setLoading,
  showError,
  clearError,
  setMetaText,
  setMessage,
  renderResults,
  fillSelect,
} from "./ui.js";

function uniqSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
    String(a).localeCompare(String(b), "he")
  );
}

async function loadAndRender(params = {}) {
  clearError();
  setMessage("");
  setLoading(true);

  try {
    const res = await fetchProperties(params);

    const total = res?.meta?.total ?? 0;
    const count = res?.count ?? 0;
    setMetaText(`נמצאו ${total} רשומות · מוצג: ${count}`);

    renderResults(res.data || []);
  } catch (e) {
    showError(e.message || "שגיאה");
  } finally {
    setLoading(false);
  }
}

async function initFilters() {
  // נטען דוגמית גדולה כדי למלא select של ערים/סוגים
  const res = await fetchProperties({ limit: 100 });
  const data = res.data || [];

  const cities = uniqSorted(data.map((x) => x.city));
  const types = uniqSorted(data.map((x) => x.type));

  fillSelect("city", cities, "כל הערים");
  fillSelect("type", types, "כל הסוגים");
}

function getFilterParamsFromUI() {
  const q = document.getElementById("q").value.trim();
  const city = document.getElementById("city").value.trim();
  const type = document.getElementById("type").value.trim();

  // optional: add these inputs later if you want
  // const minPrice = document.getElementById("minPrice")?.value?.trim();
  // const maxPrice = document.getElementById("maxPrice")?.value?.trim();

  return { q, city, type, limit: 10, page: 1 };
}

document.getElementById("filtersForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await loadAndRender(getFilterParamsFromUI());
});

document.getElementById("resetBtn").addEventListener("click", async () => {
  document.getElementById("q").value = "";
  document.getElementById("city").value = "";
  document.getElementById("type").value = "";
  await loadAndRender({ limit: 10, page: 1 });
});

(async function boot() {
  setLoading(true);
  try {
    await initFilters();
    await loadAndRender({ limit: 10, page: 1 });
  } catch (e) {
    showError(e.message || "שגיאה");
  } finally {
    setLoading(false);
  }
})();
