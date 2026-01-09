// payment.js - Payment page handler

const params = new URLSearchParams(window.location.search);
const investmentId = params.get("investmentId");
const propertyId = params.get("propertyId");

if (!investmentId || !propertyId) {
  alert("שגיאה: פרטי השקעה חסרים");
  window.location.href = "/index.html";
}

// Back button
document.getElementById("backBtn").addEventListener("click", (e) => {
  e.preventDefault();
  window.history.back();
});

// Payment method selection
const paymentMethods = document.querySelectorAll(".payment-method");
let selectedMethod = "card";

paymentMethods.forEach((method) => {
  method.addEventListener("click", () => {
    paymentMethods.forEach((m) => m.classList.remove("selected"));
    method.classList.add("selected");
    const input = method.querySelector('input[type="radio"]');
    if (input) {
      input.checked = true;
      selectedMethod = input.value;
    }
  });
});

// Load investment details
async function loadInvestmentDetails() {
  try {
    const res = await fetch(`/api/investments/${investmentId}`, {
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error("Failed to load investment details");
    }

    const json = await res.json();
    const inv = json.data || json;

    // Update summary
    const amount = Number(inv.amount || 0);
    const fee = Number(inv.fee || 0);
    const total = Number(inv.total || amount + fee);

    document.getElementById("amount").textContent = `${amount.toLocaleString("he-IL")} ₪`;
    document.getElementById("fee").textContent = `${fee.toLocaleString("he-IL")} ₪`;
    document.getElementById("total").textContent = `${total.toLocaleString("he-IL")} ₪`;
  } catch (e) {
    console.error("Error loading investment:", e);
    showError("שגיאה בטעינת פרטי השקעה");
  }
}

function showError(msg) {
  const errorEl = document.getElementById("error");
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }
}

function hideError() {
  const errorEl = document.getElementById("error");
  if (errorEl) {
    errorEl.style.display = "none";
  }
}

// Pay button
document.getElementById("payBtn").addEventListener("click", async () => {
  const payBtn = document.getElementById("payBtn");
  payBtn.disabled = true;
  hideError();

  try {
    const res = await fetch(`/api/investments/${investmentId}/pay`, {
      method: "POST",
      credentials: "include", // ✅ Required - sends session cookie
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod: selectedMethod,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || "Payment failed");
    }

    // ✅ Return to property page
    window.location.href = `/property.html?id=${encodeURIComponent(propertyId)}`;
  } catch (err) {
    console.error("Payment error:", err);
    showError(err.message || "שגיאה באישור התשלום");
    payBtn.disabled = false;
  }
});

// Load investment details on page load
loadInvestmentDetails();

