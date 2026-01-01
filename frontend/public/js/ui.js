// public/js/ui.js
export function setLoading(isLoading) {
    const el = document.getElementById("loading");
    el.hidden = !isLoading;
  }
  
  export function showError(message) {
    const el = document.getElementById("error");
    el.textContent = message;
    el.hidden = false;
  }
  
  export function clearError() {
    const el = document.getElementById("error");
    el.textContent = "";
    el.hidden = true;
  }
  
  export function setMeta(text) {
    document.getElementById("meta").textContent = text || "";
  }
  
  export function renderProperties(items) {
    const root = document.getElementById("results");
    root.innerHTML = "";
  
    if (!Array.isArray(items) || items.length === 0) {
      root.innerHTML = `<div class="empty">אין תוצאות</div>`;
      return;
    }
  
    for (const p of items) {
      const card = document.createElement("article");
      card.className = "card";
  
      card.innerHTML = `
        <h3>${escapeHtml(p.title || "ללא כותרת")}</h3>
        <div class="line">עיר: ${escapeHtml(p.city || "-")}</div>
        <div class="line">סוג: ${escapeHtml(p.type || "-")}</div>
        <div class="line">סטטוס: ${escapeHtml(p.listingStatus || "-")}</div>
        <div class="price">₪ ${Number(p.price ?? 0).toLocaleString("he-IL")}</div>
      `;
  
      root.appendChild(card);
    }
  }
  
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  