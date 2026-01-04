console.log("property.js loaded ✅");

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
    console.log("currentProperty:", window.currentProperty);
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
const investAmount = document.getElementById("investAmount");
const investRange = document.getElementById("investRange");
const rangeHint = document.getElementById("rangeHint");
const investError = document.getElementById("investError");

const feeText = document.getElementById("feeText");
const totalText = document.getElementById("totalText");
const unitsText = document.getElementById("unitsText");
const pctText = document.getElementById("pctText");
const confirmBtn = document.getElementById("confirmInvestBtn");

// דמו: אם p לא קיים עדיין, נשתמש בערך ברירת מחדל
// (החלף את זה ב-p האמיתי כשאתה טוען את הנכס)
if (!p) {
  p = window.currentProperty || { totalValue: 0 };
}

// דמו: שווי נכס לחישוב אחוז בעלות
const demoPropertyValue = Math.max(Number(p?.totalValue || p?.targetAmount || 0), 2_000_000);
const unitPrice = 50;          // יחידת דמו = ₪50
const feeRate = 0.01;          // 1% עמלה
const minInvest = 250;
const step = 50;

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

function isValidAmount(amt) {
  if (!Number.isFinite(amt) || amt < minInvest) return `מינימום השקעה: ${fmtILS(minInvest)}`;
  if (amt % step !== 0) return `הסכום חייב להיות בקפיצות של ₪${step}`;
  return "";
}

function recalc() {
  const amt = Number(investAmount.value || 0);

  // validate
  const err = isValidAmount(amt);
  setError(err);

  // enable/disable confirm
  if (confirmBtn) confirmBtn.disabled = Boolean(err);

  const fee = Math.round(amt * feeRate);
  const total = amt + fee;

  const units = Math.floor(amt / unitPrice);
  const pct = (amt / demoPropertyValue) * 100;

  if (feeText) feeText.textContent = fmtILS(fee);
  if (totalText) totalText.textContent = fmtILS(total);
  if (unitsText) unitsText.textContent = units.toLocaleString("he-IL");
  if (pctText) pctText.textContent = `${pct.toFixed(3)}%`;

  if (rangeHint) rangeHint.textContent = fmtILS(amt);
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

// Enable/disable Invest button based on login status
(async function initInvestButton() {
  const isLoggedIn = await checkUserLoggedIn();
  if (investBtn) {
    if (!isLoggedIn) {
      investBtn.disabled = true;
      investBtn.textContent = "Login to invest";
      investBtn.title = "You must be logged in to invest";
    }
  }
})();

// open modal
investBtn?.addEventListener("click", async () => {
  if (!dialog) return;
  
  // Double-check login status
  const isLoggedIn = await checkUserLoggedIn();
  if (!isLoggedIn) {
    alert("Please login to invest");
    return;
  }

  // default value
  if (investAmount) investAmount.value = "1000";
  if (investRange) investRange.value = "1000";
  recalc();

  dialog.showModal();
  investAmount?.focus();
});

// confirm (דמו)
confirmBtn?.addEventListener("click", () => {
  const amt = Number(investAmount.value || 0);
  const err = isValidAmount(amt);
  if (err) {
    setError(err);
    return;
  }

  // לקחת את ה-id מהנכס (id או attomId)
  const propertyId = p?.id || p?.attomId;

  if (!propertyId) {
    alert("שגיאה: מזהה נכס (id) חסר");
    return;
  }

  const title = p?.title ?? "";
  const city = p?.city ?? "";
  const targetAmount = p?.targetAmount;

  // סוגרים את המודאל, ואז עוברים ל-Checkout
  // מעבירים נתונים ב-query string (תקני עם encodeURIComponent)
  let url =
    `/checkout.html?propertyId=${encodeURIComponent(propertyId)}` +
    `&title=${encodeURIComponent(title)}` +
    `&city=${encodeURIComponent(city)}` +
    `&amount=${encodeURIComponent(String(amt))}`;
  
  // Add targetAmount if available
  if (targetAmount && Number.isFinite(Number(targetAmount)) && Number(targetAmount) > 0) {
    url += `&targetAmount=${encodeURIComponent(String(targetAmount))}`;
  }

  window.location.href = url;
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
  return items.filter((x) => (x.status || "ACTIVE") === "ACTIVE");
}

function calcKpis(itemsAll) {
  const active = itemsAll.filter((x) => (x.status || "ACTIVE") === "ACTIVE");

  const sumActive = active.reduce((acc, x) => acc + Number(x.total ?? x.amount ?? 0), 0);
  const avgActive = active.length ? sumActive / active.length : 0;

  const feesPaid = itemsAll.reduce((acc, x) => acc + Number(x.fee ?? 0), 0);

  return { activeCount: active.length, sumActive, avgActive, feesPaid, totalCount: itemsAll.length };
}

function renderFundingProgress(property) {
  const bar = document.getElementById("fundedBar");
  const txt = document.getElementById("fundedText");
  const meta = document.getElementById("fundedMeta");
  if (!bar || !txt || !meta) return;

  // Use fundedPercent from API, default to 0 if missing/invalid
  const fundedPercent = Number(property?.fundedPercent ?? 0);
  const validPercent = (Number.isFinite(fundedPercent) && fundedPercent >= 0 && fundedPercent <= 100) 
    ? fundedPercent 
    : 0;

  const targetAmount = Number(property?.targetAmount ?? 0);
  const totalInvested = Number(property?.totalInvested ?? 0);
  const userInvested = Number(property?.userInvested ?? 0);

  bar.style.width = `${validPercent.toFixed(1)}%`;
  txt.textContent = `${validPercent.toFixed(1)}%`;

  // Show totalInvested / targetAmount, and user investment if logged in
  let metaText = `${totalInvested.toLocaleString("he-IL")} ₪ מתוך ${targetAmount.toLocaleString("he-IL")} ₪`;
  if (userInvested > 0) {
    metaText += ` • השקעת: ${userInvested.toLocaleString("he-IL")} ₪`;
  }
  meta.textContent = metaText;
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
    const statusText = status === "CANCELED" ? "בוטל" : "פעיל";
    const canCancel = status !== "CANCELED";

    const tr = document.createElement("tr");
    tr.style.background = "#fff";
    tr.style.border = "1px solid #e5e7eb";
    tr.style.borderRadius = "14px";

    const date = new Date(inv.createdAt || Date.now()).toLocaleString("he-IL");

    tr.innerHTML = `
      <td style="padding:12px 10px;border-radius:14px">${date}</td>
      <td style="padding:12px 10px"><strong>${fmtILS(inv.amount)}</strong></td>
      <td style="padding:12px 10px">${fmtILS(inv.fee)}</td>
      <td style="padding:12px 10px"><strong>${fmtILS(inv.total)}</strong></td>
      <td style="padding:12px 10px">${inv.paymentMethod || "card"}</td>
      <td style="padding:12px 10px">${statusText}</td>
      <td style="padding:12px 10px">
        <button class="details-btn" ${canCancel ? "" : "disabled"} data-cancel="${inv._id}">
          בטל
        </button>
      </td>
    `;

    rows.appendChild(tr);
  }

  // bind cancel handlers
  document.querySelectorAll("[data-cancel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-cancel");
      if (!id) return;

      const ok = confirm("לבטל השקעה? יוחזר הסכום ללא העמלה.");
      if (!ok) return;

      const resp = await fetch(`/api/investments/${encodeURIComponent(id)}/cancel`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!resp.ok) {
        alert("שגיאה בביטול");
        return;
      }

      const propertyId = p?.id || p?.attomId;
      if (propertyId) {
        cachedInvs = await loadInvestmentsForProperty(propertyId);
        renderInvestmentsTable(cachedInvs);
        // Progress is calculated from property object, not investments
        renderFundingProgress(p);
      }
    });
  });
}

// הפעלה: אחרי שיש p.id או p.attomId
async function initAfterPropertyLoaded() {
  try {
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
    }
  } catch (e) {
    console.error(e);
  }
}
