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
  
  export function setMetaText(text) {
    document.getElementById("meta").textContent = text || "";
  }
  
  export function setMessage(text) {
    document.getElementById("msg").textContent = text || "";
  }
  
  export function clearResults() {
    document.getElementById("results").innerHTML = "";
  }
  
  export function renderResults(properties) {
    const root = document.getElementById("results");
    root.innerHTML = "";
  
    for (const p of properties) {
      const card = document.createElement("article");
      card.className = "card";
  
      const imgUrl = p?.images?.[0] || "";
      if (imgUrl) {
        const img = document.createElement("img");
        img.className = "card-img";
        img.src = imgUrl;
        img.alt = p.title || "property";
        card.appendChild(img);
      }
  
      const h = document.createElement("h3");
      h.className = "card-title";
      h.textContent = p.title || "ללא כותרת";
  
      const meta = document.createElement("div");
      meta.className = "card-meta";
      meta.innerHTML = `
        <div>עיר: <b>${p.city ?? "-"}</b></div>
        <div>סוג: <b>${p.type ?? "-"}</b></div>
        <div>סטטוס: <b>${p.listingStatus ?? "-"}</b></div>
      `;
  
      const price = document.createElement("div");
      price.className = "card-price";
      const num = Number(p.price || 0);
      price.textContent = `${num.toLocaleString("he-IL")} ₪ למ״ר`;
  
      const desc = document.createElement("p");
      desc.className = "card-desc";
      desc.textContent = p.description || "";
  
      card.appendChild(h);
      card.appendChild(meta);
      card.appendChild(desc);
      card.appendChild(price);
  
      root.appendChild(card);
    }
  }
  
  export function fillSelect(selectId, values, allLabel = "הכל") {
    const select = document.getElementById(selectId);
    select.innerHTML = "";
  
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = allLabel;
    select.appendChild(optAll);
  
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    }
  }
  