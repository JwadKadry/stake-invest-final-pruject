// public/js/main.js
import { fetchProperties } from "./api.js";
import { setLoading, showError, clearError, renderProperties, setMeta } from "./ui.js";

const form = document.getElementById("filtersForm");
const resetBtn = document.getElementById("resetBtn");

let currentController = null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  await runSearch();
});

resetBtn.addEventListener("click", async () => {
  form.reset();
  await runSearch();
});

async function runSearch() {
  clearError();
  setMeta("");
  setLoading(true);

  // מבטל בקשה קודמת אם המשתמש לחץ שוב מהר
  if (currentController) currentController.abort();
  currentController = new AbortController();

  const params = getFormParams(form);

  try {
    const data = await fetchProperties(params, currentController.signal);

    // התאמה לפורמט תגובה שלך:
    // אם השרת מחזיר { status: "OK", data: [...] } או משהו אחר — תעדכן כאן
    const items = data?.data ?? data?.items ?? data;
    renderProperties(items);

    const count = Array.isArray(items) ? items.length : 0;
    setMeta(`נמצאו ${count} תוצאות`);
  } catch (err) {
    if (err.name === "AbortError") return;
    showError(err.message || "שגיאה לא צפויה");
  } finally {
    setLoading(false);
  }
}

function getFormParams(formEl) {
  const fd = new FormData(formEl);

  // חשוב: השמות כאן חייבים להתאים ל-query שה־Backend שלך מצפה לו:
  // city, type, status, q, minPrice, maxPrice
  return {
    q: fd.get("q"),
    city: fd.get("city"),
    type: fd.get("type"),
    status: fd.get("status"),
    minPrice: fd.get("minPrice"),
    maxPrice: fd.get("maxPrice"),
  };
}

// הרצה ראשונה כשנטען הדף
runSearch();
