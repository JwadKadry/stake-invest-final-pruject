function qs(id) {
  return document.getElementById(id);
}

function fmtILS(n) {
  return `${Number(n || 0).toLocaleString("he-IL")} ₪`;
}

function showErr(msg) {
  const el = qs("err");
  el.style.display = "block";
  el.textContent = msg || "שגיאה";
}

function hideErr() {
  const el = qs("err");
  el.style.display = "none";
  el.textContent = "";
}

// Query string parsing via URLSearchParams (standard) 
const params = new URLSearchParams(window.location.search);

const propertyId = params.get("propertyId");

if (!propertyId || propertyId === "undefined") {
  showErr("propertyId is required");
} else {
  hideErr();
}

const title = params.get("title") || "—";
const city = params.get("city") || "—";
const imageUrl = params.get("imageUrl") || "";
let amount = Number(params.get("amount") || 0);
const targetAmountParam = params.get("targetAmount"); // Optional, from property page

const feeRate = 0.01;

let summary = { invested: 0, target: 0, remaining: 0 };

async function loadSummary() {
  const r = await fetch(`/api/investments/summary?propertyId=${encodeURIComponent(propertyId)}`, {
    credentials: "include",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.message || "summary failed");
  return j.data;
}

function calcMaxAmount(remaining) {
  return Math.floor(remaining / (1 + feeRate));
}

function clampAmountToMax(inputAmount, maxAmount) {
  const a = Number(inputAmount || 0);
  if (!Number.isFinite(a)) return 0;
  return Math.min(a, maxAmount);
}

function renderCheckoutSummary(data) {
  const { amount: amt, feeRate: rate, maxAmount } = data;
  const f = Math.round(amt * rate);
  const t = amt + f;

  qs("sTitle").textContent = title;
  qs("sCity").textContent = city;
  qs("sAmount").textContent = fmtILS(amt);
  qs("sFee").textContent = fmtILS(f);
  qs("sTotal").textContent = fmtILS(t);
}

async function initLimitUI() {
  try {
    summary = await loadSummary();

    const maxAmount = calcMaxAmount(summary.remaining);

    // הצג מידע למשתמש
    const remainingEl = qs("remainingInfo");
    if (remainingEl) {
      remainingEl.textContent = `נותר להשקעה: ${summary.remaining.toLocaleString("he-IL")} ₪ (יעד: ${summary.target.toLocaleString("he-IL")} ₪)`;
    }

    const payBtn = qs("payBtn");

    // אם אין מקום בכלל
    if (maxAmount <= 0) {
      if (payBtn) payBtn.disabled = true;
      showErr("הנכס הגיע ל-100% (אין יתרה להשקעה)");
      return;
    }

    // אם הגיע amount מה-URL, נחתוך אותו למקסימום
    const current = Number(params.get("amount") || 0);
    const safe = clampAmountToMax(current, maxAmount);

    if (safe !== current && current > 0) {
      showErr(`הסכום עודכן למקסימום המותר: ${safe.toLocaleString("he-IL")} ₪`);
    }

    amount = safe;

    // עדכן את ה-summary
    renderCheckoutSummary({ amount: safe, feeRate, maxAmount });
  } catch (e) {
    console.error("Failed to load summary:", e);
    // במקרה של שגיאה, נציג את הנתונים המקוריים
    renderCheckoutSummary({ amount, feeRate, maxAmount: Infinity });
  }
}

qs("backBtn").onclick = () => history.back(); // History API standard 
qs("cancelBtn").onclick = () => history.back();

qs("payBtn").onclick = async () => {
  if (!propertyId) {
    alert("שגיאה: לא נמצא מזהה נכס");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    showErr("לא ניתן לבצע תשלום דמו: נתונים חסרים.");
    return;
  }

  const fee = Math.round(amount * feeRate);
  const total = amount + fee;

  const paymentMethod = document.querySelector('input[name="pay"]:checked')?.value || "card";

  const payload = {
    propertyId,
    title,
    city,
    imageUrl,
    amount,
    fee,
    total,
    paymentMethod,
  };
  
  // Include targetAmount if available (from query params or summary)
  const targetAmountToSend = targetAmountParam ? Number(targetAmountParam) : (summary?.target || null);
  if (targetAmountToSend && Number.isFinite(targetAmountToSend) && targetAmountToSend > 0) {
    payload.targetAmount = targetAmountToSend;
  }

  const resp = await fetch("/api/investments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    showErr(err.message || "שגיאה בשמירה לשרת");
    return;
  }

  qs("successBox").style.display = "block";
  qs("payBtn").disabled = true;

  // optional: after 1.2s go back to property (no async tools; just UI)
  setTimeout(() => {
    window.location.href = `property.html?id=${encodeURIComponent(propertyId)}`;
  }, 1200);
};

// Initialize limit UI
initLimitUI();

