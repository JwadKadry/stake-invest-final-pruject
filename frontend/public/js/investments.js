// investments.js - Portfolio and Recent Activity
function fmtILS(n) {
  return `${Number(n || 0).toLocaleString("he-IL")} ₪`;
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
  return {
    data: json.data || [],
    summary: json.summary || {
      totalUserInvested: 0,
      totalInvestmentsCount: 0,
      uniquePropertiesCount: 0,
      topCity: null,
      topCityValue: 0,
      avgInvestment: 0
    }
  };
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
    const da = new Date(a.lastInvestmentAt || 0).getTime();
    const db = new Date(b.lastInvestmentAt || 0).getTime();
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

function updateKpis(summary) {
  const kpiCount = document.getElementById("kpiCount");
  const kpiTotal = document.getElementById("kpiTotal");
  const kpiUnique = document.getElementById("kpiUnique");
  const kpiAvg = document.getElementById("kpiAvg");
  const kpiTopCity = document.getElementById("kpiTopCity");

  if (!kpiCount || !kpiTotal || !kpiUnique) return;

  kpiCount.textContent = (summary.totalInvestmentsCount || 0).toLocaleString("he-IL");
  kpiTotal.textContent = fmtILS(summary.totalUserInvested || 0);
  kpiUnique.textContent = (summary.uniquePropertiesCount || 0).toLocaleString("he-IL");
  if (kpiAvg) kpiAvg.textContent = fmtILS(summary.avgInvestment || 0);
  if (kpiTopCity) {
    if (summary.topCity) {
      kpiTopCity.textContent = `${summary.topCity} · ${fmtILS(summary.topCityValue || 0)}`;
    } else {
      kpiTopCity.textContent = "—";
    }
  }
}

function renderPortfolio(portfolio) {
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

    // Property image - always show (will use placeholder if missing)
    const imgWrap = document.createElement("div");
    imgWrap.style.cssText = "width:100%;height:200px;overflow:hidden;border-radius:8px;margin-bottom:12px;background:#f3f4f6";
    const img = document.createElement("img");
    img.src = item.imageUrl || item.propertyImageUrl || "/img/placeholder.jpg";
    img.style.cssText = "width:100%;height:100%;object-fit:cover";
    img.alt = item.propertyTitle || "Property";
    img.onerror = () => { 
      img.src = "/img/placeholder.jpg";
    };
    imgWrap.appendChild(img);
    head.appendChild(imgWrap);

    const titleWrap = document.createElement("div");
    const h = document.createElement("h3");
    h.className = "card-title";
    h.textContent = item.propertyTitle || `Property • ${item.propertyId || "unknown"}`;
    const sub = document.createElement("div");
    sub.className = "muted";
    // Only show city if it exists and is not empty
    if (item.propertyCity && item.propertyCity.trim()) {
      sub.textContent = `${item.propertyCity} • ${item.propertyId || "—"}`;
    } else {
      sub.textContent = item.propertyId || "—";
    }
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
    const propertyName = inv.propertyTitle || `Property • ${inv.propertyId || "unknown"}`;
    const status = inv.status || "ACTIVE";
    const statusText = 
      status === "CANCELED" ? "בוטל" :
      status === "CANCEL_REQUESTED" ? "ממתין לאישור מנהל" :
      "פעיל";
    
    // Build property cell with title and optional city
    let propertyCell = propertyName;
    if (inv.propertyCity && inv.propertyCity.trim()) {
      propertyCell = `${propertyName}<br><small style="color:#6b7280">${inv.propertyCity}</small>`;
    }

    // Actions column - show cancel request button only for ACTIVE investments
    let actionsCell = "";
    if (status === "ACTIVE" && inv._id) {
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
      <td style="padding:12px 8px">${propertyCell}</td>
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
  const searchInput = document.getElementById("search");
  const sortSelect = document.getElementById("sort");
  const q = searchInput?.value || "";
  const sort = sortSelect?.value || "newest";

  try {
    const portfolioResult = await loadPortfolio();
    const portfolio = portfolioResult.data;
    const summary = portfolioResult.summary;
    
    updateKpis(summary);

    const view = portfolio
      .filter((x) => matchesSearch(x, q))
      .sort(bySort(sort));

    renderPortfolio(view);

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
      const controls = document.querySelector(".controls");
      
      if (loginMsg) loginMsg.style.display = "block";
      if (grid) grid.style.display = "none";
      if (empty) empty.style.display = "none";
      if (recentPanel) recentPanel.style.display = "none";
      if (controls) controls.style.display = "none";
    } else {
      console.error("Error loading portfolio:", e);
      alert("שגיאה בטעינת הפורטפוליו");
    }
  }
}

// UI event handlers
const backBtn = document.getElementById("backBtn");
if (backBtn) {
  backBtn.onclick = () => {
    // תמיד חוזר לדף הבית (גם אם יש history)
    window.location.assign("/index.html");
  };
}

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

