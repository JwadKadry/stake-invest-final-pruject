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

/**
 * Normalize property fields to handle both old and new API field names
 * Makes all fields null-safe to prevent render crashes
 */
function normalizeProperty(p) {
  if (!p || typeof p !== "object") {
    return {
      id: "",
      title: "Property",
      addressOneLine: "",
      city: "",
      state: "",
      postalCode: "",
      zip: "",
      beds: null,
      baths: null,
      bedrooms: null,
      bathrooms: null,
      areaSqft: null,
      livingAreaSqft: null,
      yearBuilt: null,
      price: null,
      imageUrl: "",
      fundedPercent: 0,
    };
  }
  
  // ✅ Safe string extraction
  const safeStr = (val) => (val && typeof val === "string") ? val.trim() : "";
  const safeNum = (val) => (typeof val === "number" && Number.isFinite(val)) ? val : null;
  
  return {
    ...p,
    // ✅ Safe ID with multiple fallbacks
    id: safeStr(p.id) || safeStr(p.attomId) || safeStr(p.identifier?.attomId) || "",
    // ✅ Safe title with fallbacks
    title: safeStr(p.title) || safeStr(p.addressOneLine) || "Property",
    addressOneLine: safeStr(p.addressOneLine) || safeStr(p.title) || "",
    // ✅ Safe location fields
    city: safeStr(p.city),
    state: safeStr(p.state),
    zip: safeStr(p.zip) || safeStr(p.postalCode),
    postalCode: safeStr(p.postalCode) || safeStr(p.zip),
    // ✅ Safe numeric fields with fallbacks
    beds: safeNum(p.beds) ?? safeNum(p.bedrooms),
    baths: safeNum(p.baths) ?? safeNum(p.bathrooms),
    bedrooms: safeNum(p.bedrooms) ?? safeNum(p.beds),
    bathrooms: safeNum(p.bathrooms) ?? safeNum(p.baths),
    areaSqft: safeNum(p.areaSqft) ?? safeNum(p.livingAreaSqft),
    livingAreaSqft: safeNum(p.livingAreaSqft) ?? safeNum(p.areaSqft),
    yearBuilt: safeNum(p.yearBuilt),
    price: safeNum(p.price),
    fundedPercent: safeNum(p.fundedPercent) ?? 0,
    // ✅ Safe image URL
    imageUrl: safeStr(p.imageUrl) || PLACEHOLDER_IMAGE,
  };
}

export async function renderResults(properties) {
  const root = document.getElementById("results");
  if (!root) return;
  
  // Clear skeleton if present
  removeSkeletonCards(root);
  root.innerHTML = "";

  // 🔍 DEBUG: log what we received
  console.log("[renderResults] Received", properties?.length, "properties");

  if (!properties || properties.length === 0) {
    root.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">לא נמצאו נכסים</div>';
    return;
  }

  // Import favorites module
  const { createFavoritesButton } = await import("./favorites.js");

  let renderedCount = 0;
  
  for (const rawP of properties) {
    // ✅ Wrap each card render in try/catch to prevent one bad property from breaking all
    try {
      // ✅ Normalize property fields (null-safe)
      const p = normalizeProperty(rawP);
      
      const card = document.createElement("article");
      card.className = "card";

      // media
      const media = document.createElement("div");
      media.className = "card-media";

      const img = document.createElement("img");
      img.className = "card-img";
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = p.title || "Property";
      img.src = p.imageUrl || PLACEHOLDER_IMAGE;
      img.onerror = () => { img.src = PLACEHOLDER_IMAGE; };

      const badges = document.createElement("div");
      badges.className = "badges";

      // Investment strategy badge
      const strategyBadge = document.createElement("span");
      strategyBadge.className = "badge badge-strategy";
      const strategies = [
        { label: "Income", color: "#22c55e", icon: "🟢" },
        { label: "Capital Growth", color: "#0ea5e9", icon: "🔵" },
        { label: "Fix & Flip", color: "#f97316", icon: "🟠" }
      ];
      // ✅ Safe charCodeAt with fallback
      const idStr = String(p.id || "");
      const strategyIndex = idStr.length > 0 ? (idStr.charCodeAt(0) % 3) : 0;
      const strategy = strategies[strategyIndex];
      strategyBadge.innerHTML = `${strategy.icon} ${strategy.label}`;
      strategyBadge.style.background = strategy.color;
      strategyBadge.style.color = "#fff";
      badges.appendChild(strategyBadge);

      if (p.city) {
        const b1 = document.createElement("span");
        b1.className = "badge";
        b1.textContent = p.city;
        badges.appendChild(b1);
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
      h.textContent = p.title || "Property";

      const sub = document.createElement("div");
      sub.className = "card-sub";
      const locationParts = [p.city, p.state, p.postalCode].filter(Boolean);
      sub.textContent = locationParts.join(", ") || "";

      const desc = document.createElement("p");
      desc.className = "card-desc";
      const details = [];
      // ✅ Safe numeric formatting
      if (p.beds !== null && p.beds !== undefined) details.push(`${p.beds} beds`);
      if (p.baths !== null && p.baths !== undefined) details.push(`${p.baths} baths`);
      if (p.areaSqft !== null && p.areaSqft !== undefined) {
        details.push(`${Number(p.areaSqft).toLocaleString("en-US")} sqft`);
      }
      if (p.yearBuilt !== null && p.yearBuilt !== undefined) details.push(`Built ${p.yearBuilt}`);
      desc.textContent = details.join(" · ") || "";

      // progress (using fundedPercent, already normalized to 0 if invalid)
      const funded = p.fundedPercent || 0;
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

      // Investment info line
      const investInfo = document.createElement("div");
      investInfo.className = "card-invest-info";
      investInfo.textContent = "השקעה קבוצתית בנכס מניב";

      body.appendChild(h);
      if (sub.textContent) body.appendChild(sub);
      body.appendChild(investInfo);
      if (desc.textContent) body.appendChild(desc);
      body.appendChild(progressRow);
      
      // Minimum investment label
      const minInvest = document.createElement("div");
      minInvest.className = "card-min-invest";
      minInvest.textContent = "השקעה מינימלית: ₪1,000";

      // footer
      const footer = document.createElement("div");
      footer.className = "card-footer";

      const priceEl = document.createElement("div");
      priceEl.className = "price";
      // ✅ Safe price formatting
      const priceNum = p.price;
      if (priceNum !== null && priceNum !== undefined && priceNum > 0) {
        priceEl.innerHTML = `$${Number(priceNum).toLocaleString("en-US")} <small>USD</small>`;
      } else {
        priceEl.innerHTML = `<small>Price not available</small>`;
      }

      const btn = document.createElement("button");
      btn.className = "details-btn";
      btn.type = "button";
      btn.textContent = "פרטים";
      
      // ✅ Get ID with multiple fallbacks and store it immediately
      const propertyId = p.id || p.attomId || rawP?.id || rawP?.attomId || rawP?.identifier?.attomId || "";
      
      if (!propertyId) {
        console.warn("[renderResults] Missing ID for property:", { p, rawP });
      }
      
      // ✅ Store ID in dataset for debugging
      btn.dataset.propertyId = propertyId;
      
      btn.onclick = () => {
        if (!propertyId) return alert("No property ID");
        window.location.href = `property.html?id=${encodeURIComponent(propertyId)}`;
      };

      // Add favorites button (use same propertyId we extracted above)
      const favoriteBtn = createFavoritesButton(
        propertyId,
        p.title || "Property",
        p.city || "",
        p.imageUrl || ""
      );

      footer.appendChild(priceEl);
      footer.appendChild(btn);
      footer.appendChild(favoriteBtn);

      card.appendChild(media);
      card.appendChild(body);
      body.appendChild(minInvest);
      card.appendChild(footer);

      root.appendChild(card);
      renderedCount++;
    } catch (err) {
      // ✅ Log error but continue rendering other cards
      console.error("[renderResults] Failed to render card:", err, rawP);
    }
  }
  
  console.log("[renderResults] Successfully rendered", renderedCount, "of", properties.length, "cards");
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
