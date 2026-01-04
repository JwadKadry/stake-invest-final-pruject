// public/js/ui.js

export function setLoading(isLoading) {
  const el = document.getElementById("loading");
  if (el) el.hidden = !isLoading;
  
  // Show/hide skeleton cards
  const results = document.getElementById("results");
  if (results && isLoading && results.children.length === 0) {
    showSkeletonCards(results);
  } else if (results && !isLoading) {
    removeSkeletonCards(results);
  }
}

function showSkeletonCards(container) {
  for (let i = 0; i < 6; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton-card";
    skeleton.innerHTML = `
      <div class="skeleton skeleton-img"></div>
      <div style="padding:14px">
        <div class="skeleton skeleton-text" style="height:20px;margin-bottom:8px"></div>
        <div class="skeleton skeleton-text medium" style="margin-bottom:12px"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
      <div style="padding:12px 14px;border-top:1px solid var(--border)">
        <div class="skeleton skeleton-text" style="width:100px"></div>
      </div>
    `;
    container.appendChild(skeleton);
  }
}

function removeSkeletonCards(container) {
  const skeletons = container.querySelectorAll(".skeleton-card");
  skeletons.forEach(s => s.remove());
}

export function showError(message) {
  const el = document.getElementById("error");
  if (el) {
    el.textContent = message || "שגיאה";
    el.hidden = false;
  }
}

export function clearError() {
  const el = document.getElementById("error");
  if (el) {
    el.textContent = "";
    el.hidden = true;
  }
}

export function setMetaText(text) {
  const el = document.getElementById("meta");
  if (el) el.textContent = text || "";
}

export function setMessage(text) {
  const el = document.getElementById("msg");
  if (el) el.textContent = text || "";
}

// אחוז "מימון" דטרמיניסטי כדי שיראה כמו Stake (יציב לכל כרטיס)
function seededPercent(seed) {
  const s = String(seed ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 50 + (h % 46); // 50..95
}

// Placeholder image URL for fallback
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='700'%3E%3Crect fill='%23e9eef6' width='1200' height='700'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' fill='%2364748b'%3ENo Image%3C/text%3E%3C/svg%3E";

export function renderResults(properties) {
  const root = document.getElementById("results");
  if (!root) return;
  
  // Clear skeleton if present
  removeSkeletonCards(root);
  root.innerHTML = "";

  if (!properties || properties.length === 0) {
    root.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No properties found</div>';
    return;
  }

  for (const p of properties) {
    const card = document.createElement("article");
    card.className = "card";

    // media
    const media = document.createElement("div");
    media.className = "card-media";

    const img = document.createElement("img");
    img.className = "card-img";
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = p.title || p.addressOneLine || "Property";
    img.src = p.imageUrl || "/img/property-placeholder.jpg";

    const badges = document.createElement("div");
    badges.className = "badges";

    if (p.city) {
      const b1 = document.createElement("span");
      b1.className = "badge";
      b1.textContent = p.city;
      badges.appendChild(b1);
    }

    if (p.state) {
      const b2 = document.createElement("span");
      b2.className = "badge";
      b2.textContent = p.state;
      badges.appendChild(b2);
    }

    media.appendChild(img);
    if (badges.children.length > 0) {
      media.appendChild(badges);
    }

    // body
    const body = document.createElement("div");
    body.className = "card-body";

    const h = document.createElement("h3");
    h.className = "card-title";
    h.textContent = p.title || p.addressOneLine || "Property";

    const sub = document.createElement("div");
    sub.className = "card-sub";
    const locationParts = [p.city, p.state, p.postalCode].filter(Boolean);
    sub.textContent = locationParts.join(", ") || "";

    const desc = document.createElement("p");
    desc.className = "card-desc";
    const details = [];
    if (p.beds) details.push(`${p.beds} beds`);
    if (p.baths) details.push(`${p.baths} baths`);
    if (p.areaSqft) details.push(`${p.areaSqft.toLocaleString("en-US")} sqft`);
    if (p.yearBuilt) details.push(`Built ${p.yearBuilt}`);
    desc.textContent = details.join(" · ") || "";

    // progress (using fundedPercent from API, default to 0 if missing/invalid)
    const fundedPercent = Number(p.fundedPercent || 0);
    const funded = (Number.isFinite(fundedPercent) && fundedPercent >= 0 && fundedPercent <= 100) 
      ? fundedPercent 
      : 0;
    const progressRow = document.createElement("div");
    progressRow.className = "progress-row";

    const progress = document.createElement("div");
    progress.className = "progress";
    const bar = document.createElement("div");
    bar.style.width = `${funded}%`;
    progress.appendChild(bar);

    const progLabel = document.createElement("div");
    progLabel.className = "progress-label";
    progLabel.textContent = funded > 0 ? `${funded}% funded` : "Not funded yet";

    progressRow.appendChild(progress);
    progressRow.appendChild(progLabel);

    body.appendChild(h);
    if (sub.textContent) body.appendChild(sub);
    if (desc.textContent) body.appendChild(desc);
    body.appendChild(progressRow);

    // footer
    const footer = document.createElement("div");
    footer.className = "card-footer";

    const price = document.createElement("div");
    price.className = "price";
    const num = Number(p.price || 0);
    if (num > 0) {
      price.innerHTML = `$${num.toLocaleString("en-US")} <small>USD</small>`;
    } else {
      price.innerHTML = `<small>Price not available</small>`;
    }

    const btn = document.createElement("button");
    btn.className = "details-btn";
    btn.type = "button";
    btn.textContent = "פרטים";
    btn.onclick = () => {
      const id = p.id;
      if (!id) return alert("No property ID");
      window.location.href = `property.html?id=${encodeURIComponent(id)}`;
    };

    footer.appendChild(price);
    footer.appendChild(btn);

    card.appendChild(media);
    card.appendChild(body);
    card.appendChild(footer);

    root.appendChild(card);
  }
}

export function fillSelect(selectId, values, allLabel = "הכל") {
  const select = document.getElementById(selectId);
  if (!select) return;
  
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
