function formatILS(n) {
  try {
    return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(n || 0);
  } catch {
    return `₪${Number(n || 0).toLocaleString("he-IL")}`;
  }
}

async function apiGet(url) {
  const res = await fetch(url, {
    credentials: "include", // ✅ Use session cookies (not Authorization header)
  });

  if (res.status === 401) throw new Error("צריך להתחבר כדי לראות Rewards");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `שגיאה: ${res.status}`);
  }
  return res.json();
}

async function loadRewards() {
  try {
    const summaryRes = await apiGet("/api/rewards/summary");
    const referralRes = await apiGet("/api/rewards/referral");

    const summary = summaryRes.status === "OK" ? summaryRes : summaryRes;
    const referral = referralRes.status === "OK" ? referralRes : referralRes;

    document.getElementById("totalRewards").textContent = formatILS(summary.totalRewards || 0);
    document.getElementById("cashback").textContent = formatILS(summary.breakdown?.cashback || 0);
    document.getElementById("referrals").textContent = formatILS(summary.breakdown?.referrals || 0);
    document.getElementById("promotions").textContent = formatILS(summary.breakdown?.promotions || 0);

    document.getElementById("tierPill").textContent = summary.tier?.name || "Intro";
    document.getElementById("invested12m").textContent = `השקעת ב־12 חודשים: ${formatILS(summary.invested12m || 0)}`;

    const fill = document.getElementById("progressFill");
    fill.style.width = `${summary.tier?.progressPct || 0}%`;

    document.getElementById("progressText").textContent =
      summary.tier?.name === "Plus"
        ? "הגעת ל־Plus 🎉"
        : `השקע עוד ${formatILS(summary.tier?.remainingToPlus || 0)} כדי להגיע ל־Plus (יעד: ${formatILS(summary.tier?.threshold || 10000)})`;

    const refInput = document.getElementById("refLink");
    refInput.value = referral.link || "";

    // Web Share API (אם הדפדפן תומך)
    const btnShare = document.getElementById("btnShare");
    if (navigator.share) {
      btnShare.style.display = "inline-block";
      btnShare.addEventListener("click", async () => {
        try {
          await navigator.share({ title: "Stake Invest (Demo)", text: "הצטרף דרך הקישור שלי:", url: referral.link });
        } catch (e) {
          // המשתמש ביטל שיתוף — לא נחשב שגיאה
        }
      });
    }
  } catch (err) {
    console.error("Load rewards error:", err);
    throw err;
  }
}

async function copyReferral() {
  const msg = document.getElementById("copyMsg");
  msg.textContent = "";
  msg.className = "msg";

  const text = document.getElementById("refLink").value;

  try {
    // Clipboard API: פעולה אסינכרונית, זמינה בהקשר מאובטח (localhost נחשב לרוב כמאובטח)
    await navigator.clipboard.writeText(text);
    msg.textContent = "הקישור הועתק ✅";
    msg.classList.add("ok");
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();

    msg.textContent = "הקישור הועתק ✅";
    msg.classList.add("ok");
  }
}

document.getElementById("btnCopy")?.addEventListener("click", copyReferral);

loadRewards().catch((err) => {
  const el = document.getElementById("copyMsg");
  if (el) {
    el.textContent = err.message || "שגיאה בטעינת Rewards";
    el.className = "msg err";
  }
  console.error("Rewards load error:", err);
});

