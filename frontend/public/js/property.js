// ===== Get Property ID from URL =====
const params = new URLSearchParams(window.location.search);
const propertyId = params.get("id");

if (!propertyId) {
  alert("שגיאה: מזהה נכס (id) חסר");
  throw new Error("Missing propertyId in URL");
}

// ===== Property Type Classification =====
// Updated for MongoDB schema: Apartment, House, Penthouse, Studio
const SINGLE_UNIT_TYPES = [
  "HOUSE", // Single family house
  "PENTHOUSE", // Penthouse (single unit, even if in building)
  "STUDIO", // Studio apartment (single unit)
];

const MULTI_UNIT_TYPES = [
  "APARTMENT", // Can be multi-unit building
];

function classifyPropertyType(propertyType) {
  const type = (propertyType || "").toUpperCase().trim();
  
  // For our MongoDB schema:
  // - House, Penthouse, Studio = Single unit (show beds/baths/area)
  // - Apartment = Can be single or multi, but we'll treat as single unit by default
  const isSingleUnit = SINGLE_UNIT_TYPES.some(t => type === t) || type === "APARTMENT";
  const isMultiUnit = MULTI_UNIT_TYPES.some(t => type === t && type !== "APARTMENT"); // Reserved for future
  
  return { isSingleUnit, isMultiUnit, type };
}

// ===== Load Property from API =====
async function loadPropertyFromApi() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  
  if (!id) {
    console.error("No property ID in URL");
    return null;
  }

  try {
    const resp = await fetch(`/api/properties/${id}`, {
      credentials: "include",
    });
    if (!resp.ok) {
      console.error("Failed to load property:", resp.status);
      return null;
    }
    const json = await resp.json();
    const property = json.data || json;
    window.currentProperty = property;
    return property;
  } catch (e) {
    console.error("Error loading property:", e);
    return null;
  }
}

// טעינת הנכס מיד כשהדף נטען
let p = null;
loadPropertyFromApi().then((property) => {
  if (property) {
    p = property;
    // עדכון p לאחר הטעינה
    if (window.currentProperty) {
      Object.assign(p, window.currentProperty);
    }
    initAfterPropertyLoaded();
  }
});

// ===== Invest Modal (Stake-style) =====
const dialog = document.getElementById("investModal");
const investBtn = document.getElementById("investBtn");

// ✅ Function to close investment modal
function closeInvestmentModal() {
  if (!dialog) return;
  dialog.close();
}

const investAmount = document.getElementById("investAmount");
const investRange = document.getElementById("investRange");
const rangeHint = document.getElementById("rangeHint");
const investError = document.getElementById("investError");

const feeText = document.getElementById("feeText");
const totalText = document.getElementById("totalText");
const unitsText = document.getElementById("unitsText");
const pctText = document.getElementById("pctText");
const confirmBtn = document.getElementById("confirmInvestBtn");
const closeBtn = document.getElementById("investmentModalClose");
const cancelBtn = document.getElementById("investmentCancelBtn");

// ✅ Close button handlers (X button and Cancel button)
closeBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  closeInvestmentModal();
});

cancelBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  closeInvestmentModal();
});

// דמו: אם p לא קיים עדיין, נשתמש בערך ברירת מחדל
// (החלף את זה ב-p האמיתי כשאתה טוען את הנכס)
if (!p) {
  p = window.currentProperty || { totalValue: 0 };
}

// דמו: שווי נכס לחישוב אחוז בעלות
const demoPropertyValue = Math.max(Number(p?.totalValue || p?.targetAmount || 0), 2_000_000);
const unitPrice = 50;          // יחידת דמו = ₪50
const feeRate = 0.01;          // 1% עמלה
const MIN_INVEST = 2000;       // ✅ מינימום השקעה חדש: 2000₪
const STEP = 1;                // ✅ אין כפולות יותר

function fmtILS(n) {
  return `${Number(n || 0).toLocaleString("he-IL")} ₪`;
}

function setError(msg) {
  if (!investError) return;
  if (!msg) {
    investError.style.display = "none";
    investError.textContent = "";
    return;
  }
  investError.style.display = "block";
  investError.textContent = msg;
}

// ✅ Validation function with exception for closing property
function validateInvestmentAmount(amount, remaining) {
  if (!Number.isFinite(amount)) return { ok: false, msg: "סכום לא תקין" };

  // מינימום 2000
  if (amount < MIN_INVEST) {
    return { ok: false, msg: `מינימום השקעה הוא ₪${MIN_INVEST.toLocaleString("he-IL")}` };
  }

  // ✅ אסור לעבור remaining (כולל אם רוצים לסגור נכס - זה עדיין חייב להיות <= remaining)
  if (Number.isFinite(remaining) && remaining > 0 && amount > remaining) {
    return { ok: false, msg: `אפשר להשקיע עד ₪${remaining.toLocaleString("he-IL")}` };
  }

  // ✅ אין יותר בדיקת כפולות
  return { ok: true };
}

// Legacy function for backward compatibility (used in recalc)
function isValidAmount(amt) {
  if (!Number.isFinite(amt) || amt < MIN_INVEST) return `מינימום השקעה: ${fmtILS(MIN_INVEST)}`;
  return "";
}

function recalc() {
  // ✅ amount = נטו לנכס (מה שהמשתמש מזין)
  const amount = Number(investAmount.value || 0);

  // ✅ Calculate remaining if property data is available
  const targetAmount = p?.targetAmount || 0;
  const totalInvested = p?.totalInvested || 0;
  const remaining = Math.max(0, targetAmount - totalInvested);
  
  // ✅ Set slider max dynamically based on remaining
  if (investRange && Number.isFinite(remaining) && remaining > 0) {
    investRange.max = String(remaining);
  }
  
  // ✅ Use validateInvestmentAmount if we have remaining, otherwise use isValidAmount
  let err = "";
  if (targetAmount > 0 && remaining > 0) {
    const v = validateInvestmentAmount(amount, remaining);
    if (!v.ok) {
      err = v.msg;
    }
  } else {
    err = isValidAmount(amount);
  }
  
  setError(err);

  // enable/disable confirm
  if (confirmBtn) confirmBtn.disabled = Boolean(err);

  // ✅ fee = עמלה, totalCharged = מה שהמשתמש ישלם בפועל
  const fee = Math.round(amount * feeRate);
  const totalCharged = amount + fee;

  const units = Math.floor(amount / unitPrice);
  const pct = (amount / demoPropertyValue) * 100;

  // ✅ UI למשתמש: מציגים amount (נטו), fee (עמלה), totalCharged (סה"כ לתשלום)
  if (feeText) feeText.textContent = fmtILS(fee);
  if (totalText) totalText.textContent = fmtILS(totalCharged);
  if (unitsText) unitsText.textContent = units.toLocaleString("he-IL");
  if (pctText) pctText.textContent = `${pct.toFixed(3)}%`;

  if (rangeHint) rangeHint.textContent = fmtILS(amount);
}

// sync number -> range
investAmount?.addEventListener("input", () => {
  const amt = Number(investAmount.value || 0);
  if (investRange) investRange.value = String(amt);
  recalc();
});

// sync range -> number
investRange?.addEventListener("input", () => {
  const amt = Number(investRange.value || 0);
  if (investAmount) investAmount.value = String(amt);
  recalc();
});

// Check if user is logged in (simple check - if investments endpoint works, user is logged in)
async function checkUserLoggedIn() {
  try {
    const resp = await fetch("/api/investments", {
      method: "GET",
      credentials: "include",
    });
    return resp.ok; // If 401/403, user is not logged in
  } catch {
    return false;
  }
}

// ✅ No frontend auth check - server decides (button is always enabled)
// If user clicks and not logged in, server will return 401

// open modal
investBtn?.addEventListener("click", async () => {
  if (!dialog) return;
  
  // ✅ No frontend auth check - server decides (will return 401 if not logged in)
  
  // default value
  if (investAmount) investAmount.value = "2000";
  if (investRange) investRange.value = "2000";
  recalc();

  dialog.showModal();
  investAmount?.focus();
});

// confirm investment
confirmBtn?.addEventListener("click", async () => {
  // ✅ amount = נטו לנכס (מה שהמשתמש מזין)
  const amount = Number(investAmount.value || 0);
  
  // ✅ Use propertyId from URL (already extracted at top of file)
  if (!propertyId) {
    alert("שגיאה: מזהה נכס חסר");
    return;
  }

  // Get additional property data
  const title = p?.title || p?.addressOneLine || "";
  const city = p?.city || "";
  const imageUrl = p?.imageUrl || "";
  const targetAmount = p?.targetAmount || null;
  const totalInvested = p?.totalInvested || 0;
  
  // ✅ Calculate remaining amount
  const remaining = Math.max(0, (targetAmount || 0) - (totalInvested || 0));
  
  // ✅ Check if amount exceeds remaining
  if (amount > remaining) {
    alert(`אפשר להשקיע עד ₪${remaining.toLocaleString("he-IL")} כדי לא לעבור 100%`);
    return;
  }
  
  // ✅ Validate with exception for closing property
  const v = validateInvestmentAmount(amount, remaining);
  if (!v.ok) {
    alert(v.msg);
    return;
  }

  // ✅ Fee and totalCharged are calculated on server - not needed here

  // ✅ Use apiFetch if available, otherwise fallback to fetch with credentials
  const fetchFn = (typeof window !== 'undefined' && window.apiFetch) || 
                  ((url, opts) => fetch(url, { ...opts, credentials: "include" }));

  try {
    // ✅ שולחים רק amount - השרת מחשב fee ו-totalCharged מחדש
    const payload = {
      propertyId,
      amount: amount, // ✅ נטו לנכס בלבד
      paymentMethod: "card", // Default for demo
      title,
      city,
      imageUrl,
    };

    // Add targetAmount if available
    if (targetAmount && Number.isFinite(Number(targetAmount)) && Number(targetAmount) > 0) {
      payload.targetAmount = targetAmount;
    }

    const res = await fetchFn("/api/investments", {
      method: "POST",
      credentials: "include", // ✅ חובה - שולח session cookie
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      alert("צריך להתחבר כדי להשקיע");
      return;
    }

    if (!res.ok) {
      throw new Error(data?.message || "Investment failed");
    }

    // ✅ Close modal
    if (dialog) dialog.close();

    // ✅ Go to payment page
    window.location.href = `/payment.html?investmentId=${encodeURIComponent(data.investmentId)}&propertyId=${encodeURIComponent(data.propertyId || propertyId)}`;
  } catch (err) {
    console.error("Investment error:", err);
    setError(err.message || "שגיאה כללית בהשקעה");
  }
});

// ===== Investments Table =====

let cachedInvs = [];

async function loadInvestmentsForProperty(propertyId) {
  const qs = new URLSearchParams({ propertyId: String(propertyId) });
  const resp = await fetch(`/api/investments?${qs.toString()}`, {
    credentials: "include",
  });
  if (!resp.ok) throw new Error("Failed to load investments");
  const json = await resp.json();
  return json.data || [];
}

function getViewItems(items) {
  const showCanceled = document.getElementById("showCanceled")?.checked;
  if (showCanceled) return items;
  // ✅ Show ACTIVE and CANCEL_REQUESTED (hide only CANCELED unless checkbox is checked)
  return items.filter((x) => {
    const status = x.status || "ACTIVE";
    return status === "ACTIVE" || status === "CANCEL_REQUESTED";
  });
}

function calcKpis(itemsAll) {
  const active = itemsAll.filter((x) => (x.status || "ACTIVE") === "ACTIVE");

  // ✅ sumActive = סכום של amount (נטו לנכס) בלבד - לא כולל fee
  // זה מה שנכנס למימון הנכס
  const sumActive = active.reduce((acc, x) => acc + Number(x.amount ?? 0), 0);
  const avgActive = active.length ? sumActive / active.length : 0;

  const feesPaid = itemsAll.reduce((acc, x) => acc + Number(x.fee ?? 0), 0);

  return { activeCount: active.length, sumActive, avgActive, feesPaid, totalCount: itemsAll.length };
}

function renderFundingProgress(property) {
  const bar = document.getElementById("fundedBar");
  const txt = document.getElementById("fundedText");
  const meta = document.getElementById("fundedMeta");
  const remainingEl = document.getElementById("remainingAmount");
  if (!bar || !txt || !meta) return;

  // Use fundedPercent from API, default to 0 if missing/invalid
  const fundedPercent = Number(property?.fundedPercent ?? 0);
  const validPercent = (Number.isFinite(fundedPercent) && fundedPercent >= 0 && fundedPercent <= 100) 
    ? fundedPercent 
    : 0;

  const targetAmount = Number(property?.targetAmount ?? 0);
  const totalInvested = Number(property?.totalInvested ?? 0);
  const userInvested = Number(property?.userInvested ?? 0);
  const remainingAmount = Number(property?.remainingAmount ?? Math.max(targetAmount - totalInvested, 0));

  bar.style.width = `${validPercent.toFixed(1)}%`;
  txt.textContent = `${validPercent.toFixed(1)}%`;

  // ✅ Show totalInvested / targetAmount in ₪ (ILS), and user investment if logged in
  let metaText = `${totalInvested.toLocaleString("he-IL")} ₪ מתוך ${targetAmount.toLocaleString("he-IL")} ₪`;
  if (userInvested > 0) {
    metaText += ` • השקעת: ${userInvested.toLocaleString("he-IL")} ₪`;
  }
  meta.textContent = metaText;

  // Show remaining amount
  if (remainingEl) {
    remainingEl.textContent = `${remainingAmount.toLocaleString("he-IL")} ₪ נותרו להשקעה`;
  }
}

function renderInvestmentsTable(itemsAll) {
  const rows = document.getElementById("invRows");
  const empty = document.getElementById("invEmpty");
  const meta = document.getElementById("invMeta");
  if (!rows || !empty || !meta) return;

  rows.innerHTML = "";

  const { activeCount, sumActive, avgActive, feesPaid, totalCount } = calcKpis(itemsAll);

  // Meta: KPI על ACTIVE + מונה כולל
  meta.textContent =
    `${activeCount} השקעות פעילות · סה״כ ${fmtILS(sumActive)} · ממוצע ${fmtILS(avgActive)} · עמלות ${fmtILS(feesPaid)} · סה״כ רשומות ${totalCount}`;

  const view = getViewItems(itemsAll);

  if (!view.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const inv of view) {
    const status = inv.status || "ACTIVE";
    const statusText = status === "CANCELED" ? "בוטל" : status === "CANCEL_REQUESTED" ? "בקשה נשלחה" : "פעיל";
    
    const tr = document.createElement("tr");
    tr.style.background = "#fff";
    tr.style.border = "1px solid #e5e7eb";
    tr.style.borderRadius = "14px";

    const date = new Date(inv.createdAt || Date.now()).toLocaleString("he-IL");

    // ✅ amount = נטו לנכס, fee = עמלה, totalCharged = מה ששולם בפועל
    const totalCharged = inv.totalCharged || inv.total || (inv.amount + inv.fee);
    
    // ✅ Render action button/badge based on status
    let actionCell = "";
    if (status === "ACTIVE") {
      // ✅ If ACTIVE - show "בקשה לביטול" button
      actionCell = `
        <button class="details-btn" data-request-cancel="${inv._id}">
          בקשה לביטול
        </button>
      `;
    } else if (status === "CANCEL_REQUESTED") {
      // ✅ If CANCEL_REQUESTED - show "בקשה נשלחה" badge
      actionCell = `
        <span class="badge warning" style="padding:6px 12px;background:#fbbf24;color:#fff;border-radius:6px;font-size:13px">
          בקשה נשלחה
        </span>
      `;
    } else if (status === "CANCELED") {
      // ✅ If CANCELED - show "בוטל" badge
      actionCell = `
        <span class="badge danger" style="padding:6px 12px;background:#ef4444;color:#fff;border-radius:6px;font-size:13px">
          בוטל
        </span>
      `;
    }
    
    tr.innerHTML = `
      <td style="padding:12px 10px;border-radius:14px">${date}</td>
      <td style="padding:12px 10px"><strong>${fmtILS(inv.amount)}</strong></td>
      <td style="padding:12px 10px">${fmtILS(inv.fee)}</td>
      <td style="padding:12px 10px"><strong>${fmtILS(totalCharged)}</strong></td>
      <td style="padding:12px 10px">${inv.paymentMethod || "card"}</td>
      <td style="padding:12px 10px">${statusText}</td>
      <td style="padding:12px 10px">${actionCell}</td>
    `;

    rows.appendChild(tr);
  }

  // ✅ Bind request cancel handlers
  document.querySelectorAll("[data-request-cancel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-request-cancel");
      if (!id) return;

      const ok = confirm("לבקש ביטול השקעה? הבקשה תישלח למנהל.");
      if (!ok) return;

      try {
        const resp = await fetch(`/api/investments/${encodeURIComponent(id)}/request-cancel`, {
          method: "POST",
          credentials: "include",
        });
        
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          alert(data?.message || "שגיאה בשליחת בקשה לביטול");
          return;
        }

        // Reload investments and re-render
        const propertyId = p?.id || p?.attomId;
        if (propertyId) {
          cachedInvs = await loadInvestmentsForProperty(propertyId);
          renderInvestmentsTable(cachedInvs);
          // Progress is calculated from property object, not investments
          renderFundingProgress(p);
        }
      } catch (err) {
        console.error("Request cancel error:", err);
        alert("שגיאה בשליחת בקשה לביטול");
      }
    });
  });
}

// UI helpers for conditional display
function showEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "";
}

function hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function setTextEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Render property details to UI
function renderPropertyDetails(property) {
  // Basic info
  const titleEl = document.getElementById("title");
  const subtitleEl = document.getElementById("subtitle");
  const descEl = document.getElementById("desc");
  const heroImgEl = document.getElementById("heroImg");
  
  // ✅ Support both old format (addressOneLine) and new (address/title)
  if (titleEl) titleEl.textContent = property?.title || property?.addressOneLine || property?.address || "Property";
  if (subtitleEl) {
    // ✅ Support new format: use address if available, otherwise build from parts
    if (property?.address) {
      subtitleEl.textContent = property.address;
    } else {
      const locationParts = [
        property?.city,
        property?.state,
        property?.zip || property?.postalCode
      ].filter(Boolean);
      subtitleEl.textContent = locationParts.join(", ") || "—";
    }
  }
  
  if (heroImgEl && property?.imageUrl) {
    heroImgEl.src = property.imageUrl;
    heroImgEl.alt = property?.title || "Property";
  }
  
  // Classify property type
  const { isSingleUnit, isMultiUnit } = classifyPropertyType(property?.propertyType);
  
  // KPIs - always shown
  setTextEl("city", property?.city || "—");
  setTextEl("type", property?.propertyType || "—");
  setTextEl("yearBuilt", property?.yearBuilt ?? "—");
  
  // ✅ Price in ₪ (ILS) for Israeli properties
  // ✅ Price in ₪ (ILS) for Israeli properties
  const price = property?.price || 0;
  setTextEl("price", price > 0 ? `₪${price.toLocaleString("he-IL")}` : "—");
  
  // ✅ Show price in description if available
  if (descEl && !descEl.textContent && price > 0) {
    descEl.textContent = `מחיר: ₪${price.toLocaleString("he-IL")}`;
  }
  
  // Conditional display based on property type
  if (isSingleUnit) {
    // Single-unit: show beds/baths/area
    showEl("bedsRow");
    showEl("bathsRow");
    showEl("areaRow");
    hideEl("buildingNotice");
    
    // ✅ Support both old format (bedrooms/bathrooms/livingAreaSqft) and new (beds/baths/sqm)
    const beds = property?.bedrooms ?? property?.beds;
    const baths = property?.bathrooms ?? property?.baths;
    const areaSqm = property?.sqm ?? (property?.livingAreaSqft ? Math.round(property.livingAreaSqft / 10.764) : null);
    const area = areaSqm; // Show in sqm for Israeli properties
    
    // Sanity checks - hide unreasonable values for single-unit
    if (beds && beds <= 10) {
      setTextEl("bedrooms", beds);
    } else if (beds > 10) {
      hideEl("bedsRow"); // Unreasonable for single unit
    } else {
      setTextEl("bedrooms", "—");
    }
    
    if (baths && baths <= 10) {
      setTextEl("bathrooms", baths);
    } else if (baths > 10) {
      hideEl("bathsRow"); // Unreasonable for single unit
    } else {
      setTextEl("bathrooms", "—");
    }
    
    if (areaSqm) {
      setTextEl("area", `${areaSqm.toLocaleString("he-IL")} מ״ר`);
    } else {
      setTextEl("area", "—");
    }
    
    // Description with property details
    if (descEl) {
      const details = [];
      if (beds && beds <= 10) details.push(`${beds} חדרים`);
      if (baths && baths <= 10) details.push(`${baths} חדרי רחצה`);
      if (areaSqm) details.push(`${areaSqm.toLocaleString("he-IL")} מ״ר`);
      if (property?.yearBuilt) details.push(`נבנה ${property.yearBuilt}`);
      descEl.textContent = details.join(" · ") || property?.propertyType || "";
    }
  } else if (isMultiUnit) {
    // Multi-unit: hide beds/baths/area, show building notice
    hideEl("bedsRow");
    hideEl("bathsRow");
    hideEl("areaRow");
    showEl("buildingNotice");
    
    // Description for multi-unit
    if (descEl) {
      const details = [];
      details.push(property?.propertyType || "Multi-Unit Building");
      if (property?.unitsTotal) details.push(`${property.unitsTotal} units`);
      if (property?.yearBuilt) details.push(`Built ${property.yearBuilt}`);
      descEl.textContent = details.join(" · ");
    }
  } else {
    // Unknown type - show all but with caution
    showEl("bedsRow");
    showEl("bathsRow");
    showEl("areaRow");
    hideEl("buildingNotice");
    
    // ✅ Support both formats
    const bedsFallback = property?.bedrooms ?? property?.beds;
    const bathsFallback = property?.bathrooms ?? property?.baths;
    const areaSqmFallback = property?.sqm ?? (property?.livingAreaSqft ? Math.round(property.livingAreaSqft / 10.764) : null);
    
    setTextEl("bedrooms", bedsFallback ?? "—");
    setTextEl("bathrooms", bathsFallback ?? "—");
    setTextEl("area", areaSqmFallback 
      ? `${areaSqmFallback.toLocaleString("he-IL")} מ״ר`
      : "—");
    
    if (descEl) {
      const details = [];
      if (bedsFallback) details.push(`${bedsFallback} חדרים`);
      if (bathsFallback) details.push(`${bathsFallback} חדרי רחצה`);
      if (areaSqmFallback) details.push(`${areaSqmFallback.toLocaleString("he-IL")} מ״ר`);
      if (property?.yearBuilt) details.push(`נבנה ${property.yearBuilt}`);
      descEl.textContent = details.join(" · ") || property?.propertyType || "";
    }
  }
}

// הפעלה: אחרי שיש p.id או p.attomId
async function initAfterPropertyLoaded() {
  try {
    // Render property details first
    renderPropertyDetails(p);
    
    const propertyId = p?.id || p?.attomId;
    if (p && propertyId) {
      // Render funding progress using property data from API
      renderFundingProgress(p);
      
      cachedInvs = await loadInvestmentsForProperty(propertyId);
      renderInvestmentsTable(cachedInvs);
      
      // Re-render progress after investments load (in case API data was stale)
      renderFundingProgress(p);

      document.getElementById("showCanceled")?.addEventListener("change", () => {
        renderInvestmentsTable(cachedInvs);
        // Progress doesn't change based on canceled filter, but keep consistent
        renderFundingProgress(p);
      });

        // Initialize favorites button
        const favoriteBtn = document.getElementById("favoriteBtn");
        if (favoriteBtn) {
          const { isFavorited, toggleFavorite, invalidateFavoritesCache } = await import("./favorites.js");
          
          // ✅ חשוב: לנקות cache כדי למשוך מצב עדכני אם הוסיפו/הסירו בדף אחר
          invalidateFavoritesCache();
          
          // Check initial state
          const favorited = await isFavorited(propertyId);
        if (favorited) {
          favoriteBtn.classList.add("favorited");
          favoriteBtn.style.color = "#fbbf24";
          favoriteBtn.title = "Remove from favorites";
        } else {
          favoriteBtn.style.color = "#9ca3af";
          favoriteBtn.title = "Add to favorites";
        }

        favoriteBtn.onmouseenter = () => {
          if (!favoriteBtn.classList.contains("favorited")) {
            favoriteBtn.style.color = "#fbbf24";
          }
        };

        favoriteBtn.onmouseleave = () => {
          if (!favoriteBtn.classList.contains("favorited")) {
            favoriteBtn.style.color = "#9ca3af";
          }
        };

        favoriteBtn.onclick = async () => {
          // ✅ No frontend auth check - server decides (toggleFavorite handles 401)
          const title = p?.title || p?.addressOneLine || "";
          const city = p?.city || "";
          const imageUrl = p?.imageUrl || "";

          await toggleFavorite(propertyId, title, city, imageUrl, favoriteBtn);
        };
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// ===== Back Button Handler =====
document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.getElementById("backBtn") || document.querySelector('[data-action="back"]');
  if (!backBtn) return;

  backBtn.addEventListener("click", () => {
    window.location.href = "/index.html";
  });
});
