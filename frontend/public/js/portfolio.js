const STORAGE_KEY = "stake_demo_investments";

function fmtILS(n) {
  return `${Number(n || 0).toLocaleString("he-IL")} ₪`;
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

// Load portfolio data (grouped by propertyId)
async function loadPortfolio() {
  const resp = await fetch("/api/investments/portfolio", {
    credentials: "include",
  });
  if (resp.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  if (!resp.ok) throw new Error("Failed to load portfolio");
  const json = await resp.json();
  return json.data || [];
}

// Load recent investments
async function loadRecentActivity() {
  const resp = await fetch("/api/investments/recent", {
    credentials: "include",
  });
  if (resp.status === 401) {
    return [];
  }
  if (!resp.ok) return [];
  const json = await resp.json();
  return json.data || [];
}

function bySort(mode) {
  return (a, b) => {
    const da = new Date(a.lastInvestedAt || 0).getTime();
    const db = new Date(b.lastInvestedAt || 0).getTime();
    const aa = Number(a.userInvested || 0);
    const ab = Number(b.userInvested || 0);

    switch (mode) {
      case "oldest": return da - db;
      case "amountAsc": return aa - ab;
      case "amountDesc": return ab - aa;
      case "newest":
      default: return db - da;
    }
  };
}

function matchesSearch(item, q) {
  if (!q) return true;
  const s = q.toLowerCase().trim();
  return (
    String(item.propertyTitle || "").toLowerCase().includes(s) ||
    String(item.propertyCity || "").toLowerCase().includes(s) ||
    String(item.propertyId || "").toLowerCase().includes(s)
  );
}

function updateKpis(portfolio) {
  const kpiCount = document.getElementById("kpiCount");
  const kpiTotal = document.getElementById("kpiTotal");
  const kpiUnique = document.getElementById("kpiUnique");
  const kpiAvg = document.getElementById("kpiAvg");
  const kpiTopCity = document.getElementById("kpiTopCity");

  const count = portfolio.length;
  const sum = portfolio.reduce((acc, x) => acc + Number(x.userInvested || 0), 0);
  const unique = portfolio.length; // Already grouped by propertyId
  const avg = count ? sum / count : 0;

  // Top city by user investment amount
  const byCity = portfolio.reduce((acc, x) => {
    const city = String(x.propertyCity || "—").trim() || "—";
    const val = Number(x.userInvested || 0);
    acc[city] = (acc[city] || 0) + val;
    return acc;
  }, {});

  let topCity = "—";
  let topValue = -1;

  for (const city of Object.keys(byCity)) {
    const v = byCity[city];
    if (v > topValue) {
      topValue = v;
      topCity = city;
    }
  }

  if (kpiCount) kpiCount.textContent = count.toLocaleString("he-IL");
  if (kpiTotal) kpiTotal.textContent = fmtILS(sum);
  if (kpiUnique) kpiUnique.textContent = unique.toLocaleString("he-IL");
  if (kpiAvg) kpiAvg.textContent = fmtILS(avg);
  if (kpiTopCity) {
    kpiTopCity.textContent = topCity === "—" ? "—" : `${topCity} · ${fmtILS(topValue)}`;
  }
}

function render(portfolio) {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const meta = document.getElementById("meta");

  if (!grid || !empty || !meta) return;

  grid.innerHTML = "";

  if (!portfolio.length) {
    empty.style.display = "block";
    meta.textContent = "";
    return;
  }
  empty.style.display = "none";
  meta.textContent = `סה״כ נכסים: ${portfolio.length}`;

  for (const item of portfolio) {
    const card = document.createElement("article");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";

    // Property image if available
    if (item.propertyImageUrl) {
      const imgWrap = document.createElement("div");
      imgWrap.style.cssText = "width:100%;height:200px;overflow:hidden;border-radius:8px;margin-bottom:12px;background:#f3f4f6";
      const img = document.createElement("img");
      img.src = item.propertyImageUrl;
      img.style.cssText = "width:100%;height:100%;object-fit:cover";
      img.alt = item.propertyTitle || "Property";
      imgWrap.appendChild(img);
      head.appendChild(imgWrap);
    }

    const titleWrap = document.createElement("div");
    const h = document.createElement("h3");
    h.className = "card-title";
    h.textContent = item.propertyTitle || "נכס";
    const sub = document.createElement("div");
    sub.className = "muted";
    sub.textContent = `${item.propertyCity || "—"} • ${item.propertyId || "—"}`;
    titleWrap.appendChild(h);
    titleWrap.appendChild(sub);

    const badge = document.createElement("div");
    badge.className = "muted";
    badge.textContent = `${item.fundedPercent || 0}% Funded`;

    head.appendChild(titleWrap);
    head.appendChild(badge);

    const body = document.createElement("div");
    body.className = "card-body";

    const rows = document.createElement("div");
    rows.className = "rows";

    const r1 = document.createElement("div");
    r1.className = "row";
    r1.innerHTML = `<small>Your Investment</small><strong>${fmtILS(item.userInvested)}</strong>`;

    const r2 = document.createElement("div");
    r2.className = "row";
    r2.innerHTML = `<small>Total Invested</small><strong>${fmtILS(item.totalInvested)}</strong>`;

    const r3 = document.createElement("div");
    r3.className = "row";
    r3.innerHTML = `<small>Target Amount</small><strong>${fmtILS(item.targetAmount)}</strong>`;

    const r4 = document.createElement("div");
    r4.className = "row";
    r4.innerHTML = `<small>Remaining</small><strong>${fmtILS(item.remaining)}</strong>`;

    // Progress bar
    const progressWrap = document.createElement("div");
    progressWrap.style.cssText = "width:100%;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin-top:8px";
    const progressBar = document.createElement("div");
    progressBar.style.cssText = `width:${Math.min(100, item.fundedPercent || 0)}%;height:100%;background:#3b82f6;transition:width 0.3s`;
    progressWrap.appendChild(progressBar);

    rows.appendChild(r1);
    rows.appendChild(r2);
    rows.appendChild(r3);
    rows.appendChild(r4);
    rows.appendChild(progressWrap);

    body.appendChild(rows);

    const foot = document.createElement("div");
    foot.className = "card-foot";

    const openBtn = document.createElement("button");
    openBtn.className = "primary";
    openBtn.type = "button";
    openBtn.textContent = "פתח נכס";
    openBtn.onclick = () => {
      window.location.href = `property.html?id=${encodeURIComponent(item.propertyId)}`;
    };

    foot.appendChild(openBtn);

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(foot);

    grid.appendChild(card);
  }
}

function renderRecentActivity(recent) {
  const tbody = document.getElementById("recentActivityBody");
  const empty = document.getElementById("recentEmpty");
  const panel = document.getElementById("recentActivityPanel");

  if (!tbody || !empty || !panel) return;

  if (!recent.length) {
    empty.style.display = "block";
    tbody.innerHTML = "";
    panel.style.display = "none";
    return;
  }

  empty.style.display = "none";
  panel.style.display = "block";
  tbody.innerHTML = "";

  for (const inv of recent) {
    const tr = document.createElement("tr");
    tr.style.cssText = "border-bottom:1px solid #e5e7eb";

    const date = new Date(inv.createdAt || Date.now()).toLocaleString("he-IL");
    const propertyName = inv.propertyTitle || inv.propertyId || "—";
    const status = inv.status || "ACTIVE";
    const statusText = 
      status === "CANCELED" ? "בוטל" :
      status === "CANCEL_REQUESTED" ? "ממתין לאישור מנהל" :
      "פעיל";

    // Actions column - show cancel request button only for ACTIVE investments
    let actionsCell = "";
    if (status === "ACTIVE") {
      actionsCell = `
        <td style="padding:12px 8px">
          <button onclick="requestCancel('${inv._id}')" style="padding:6px 12px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">
            בקשת ביטול
          </button>
        </td>
      `;
    } else {
      actionsCell = `<td style="padding:12px 8px">—</td>`;
    }

    tr.innerHTML = `
      <td style="padding:12px 8px">${date}</td>
      <td style="padding:12px 8px">${propertyName}</td>
      <td style="padding:12px 8px"><strong>${fmtILS(inv.amount)}</strong></td>
      <td style="padding:12px 8px">${statusText}</td>
      ${actionsCell}
    `;

    tbody.appendChild(tr);
  }
}

// Request cancel function (available globally)
window.requestCancel = async function(investmentId) {
  const reason = prompt("סיבת ביטול (אופציונלי):");
  if (reason === null) return; // User cancelled

  try {
    const res = await fetch(`/api/investments/${encodeURIComponent(investmentId)}/request-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reason: reason || "" }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.message || "שגיאה בשליחת בקשה לביטול");
      return;
    }

    const data = await res.json().catch(() => ({}));
    alert(data?.message || "בקשה לביטול נשלחה למנהל");
    
    // Reload page to show updated data
    location.reload();
  } catch (err) {
    console.error("Request cancel error:", err);
    alert("שגיאה בשליחת בקשה לביטול");
  }
};

async function applyAndRender() {
  const q = document.getElementById("search")?.value || "";
  const sort = document.getElementById("sort")?.value || "newest";

  try {
    const portfolio = await loadPortfolio();
    updateKpis(portfolio);

    const view = portfolio
      .filter((x) => matchesSearch(x, q))
      .sort(bySort(sort));

    render(view);

    // Load and render recent activity
    const recent = await loadRecentActivity();
    renderRecentActivity(recent);
  } catch (e) {
    if (e.message === "UNAUTHORIZED") {
      // Show login message and hide invest-only data
      const loginMsg = document.getElementById("loginMessage");
      const grid = document.getElementById("grid");
      const empty = document.getElementById("empty");
      const recentPanel = document.getElementById("recentActivityPanel");
      
      if (loginMsg) loginMsg.style.display = "block";
      if (grid) grid.style.display = "none";
      if (empty) empty.style.display = "none";
      if (recentPanel) recentPanel.style.display = "none";
      
      // Hide controls that require login
      const controls = document.querySelector(".controls");
      if (controls) controls.style.display = "none";
    } else {
      console.error("Error loading portfolio:", e);
      alert("שגיאה בטעינת הפורטפוליו");
    }
  }
}

// Always go to home (Properties)
function goHome() {
  window.location.href = "/index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const backBtn =
    document.querySelector('[data-action="back"]') ||
    document.getElementById("backBtn") ||
    document.querySelector(".btn-back");

  if (backBtn) {
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      goHome();
    });
  }
});

const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) refreshBtn.onclick = applyAndRender;

const searchInput = document.getElementById("search");
if (searchInput) searchInput.addEventListener("input", applyAndRender);

const sortSelect = document.getElementById("sort");
if (sortSelect) sortSelect.addEventListener("change", applyAndRender);

const clearBtn = document.getElementById("clearBtn");
if (clearBtn) {
  clearBtn.onclick = () => {
    const ok = confirm("למחוק את כל ההשקעות מהפורטפוליו? (Demo)");
    if (!ok) return;
    // Note: This would need to be implemented via API if needed
    applyAndRender();
  };
}

// Auto-load portfolio on page entry
(async function init() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  
  await applyAndRender();
})();
