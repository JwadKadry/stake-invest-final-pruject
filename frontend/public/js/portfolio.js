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

async function loadInvestments() {
  const resp = await fetch("/api/investments", {
    credentials: "include",
  });
  if (!resp.ok) throw new Error("Failed to load investments");
  const json = await resp.json();
  return json.data || [];
}

function saveInvestments(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function bySort(mode) {
  return (a, b) => {
    const da = new Date(a.createdAt || 0).getTime();
    const db = new Date(b.createdAt || 0).getTime();
    const aa = Number(a.amount || 0);
    const ab = Number(b.amount || 0);

    switch (mode) {
      case "oldest": return da - db;
      case "amountAsc": return aa - ab;
      case "amountDesc": return ab - aa;
      case "newest":
      default: return db - da;
    }
  };
}

function matchesSearch(inv, q) {
  if (!q) return true;
  const s = q.toLowerCase().trim();
  return (
    String(inv.title || "").toLowerCase().includes(s) ||
    String(inv.city || "").toLowerCase().includes(s) ||
    String(inv.propertyId || "").toLowerCase().includes(s)
  );
}

function updateKpis(listAll) {
  const kpiCount = document.getElementById("kpiCount");
  const kpiTotal = document.getElementById("kpiTotal");
  const kpiUnique = document.getElementById("kpiUnique");
  const kpiAvg = document.getElementById("kpiAvg");
  const kpiTopCity = document.getElementById("kpiTopCity");

  const count = listAll.length;

  // סכום כולל (מעדיף total, ואם אין אז amount)
  const sum = listAll.reduce((acc, x) => acc + Number(x.total ?? x.amount ?? 0), 0);

  // נכסים ייחודיים לפי propertyId
  const unique = new Set(listAll.map((x) => String(x.propertyId || ""))).size;

  // ממוצע השקעה
  const avg = count ? sum / count : 0;

  // Top city לפי סכום השקעה
  const byCity = listAll.reduce((acc, x) => {
    const city = String(x.city || "—").trim() || "—";
    const val = Number(x.total ?? x.amount ?? 0);
    acc[city] = (acc[city] || 0) + val;
    return acc;
  }, {});

  let topCity = "—";
  let topValue = -1;

  for (const city of Object.keys(byCity)) { // Object.keys standard 
    const v = byCity[city];
    if (v > topValue) {
      topValue = v;
      topCity = city;
    }
  }

  kpiCount.textContent = count.toLocaleString("he-IL");
  kpiTotal.textContent = fmtILS(sum);
  kpiUnique.textContent = unique.toLocaleString("he-IL");

  if (kpiAvg) kpiAvg.textContent = fmtILS(avg);
  if (kpiTopCity) {
    kpiTopCity.textContent = topCity === "—" ? "—" : `${topCity} · ${fmtILS(topValue)}`;
  }
}

function render(list) {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const meta = document.getElementById("meta");

  grid.innerHTML = "";

  if (!list.length) {
    empty.style.display = "block";
    meta.textContent = "";
    return;
  }
  empty.style.display = "none";
  meta.textContent = `סה״כ השקעות: ${list.length}`;

  for (const inv of list) {
    const card = document.createElement("article");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";

    const titleWrap = document.createElement("div");
    const h = document.createElement("h3");
    h.className = "card-title";
    h.textContent = inv.title || "נכס";
    const sub = document.createElement("div");
    sub.className = "muted";
    sub.textContent = `${inv.city || "—"} • ${new Date(inv.createdAt || Date.now()).toLocaleString("he-IL")}`;
    titleWrap.appendChild(h);
    titleWrap.appendChild(sub);

    const badge = document.createElement("div");
    badge.className = "muted";
    badge.textContent = `ID: ${inv.propertyId || "—"}`;

    head.appendChild(titleWrap);
    head.appendChild(badge);

    const body = document.createElement("div");
    body.className = "card-body";

    const rows = document.createElement("div");
    rows.className = "rows";

    const r1 = document.createElement("div");
    r1.className = "row";
    r1.innerHTML = `<small>סכום השקעה</small><strong>${fmtILS(inv.amount)}</strong>`;

    const r2 = document.createElement("div");
    r2.className = "row";
    r2.innerHTML = `<small>עמלה</small><strong>${fmtILS(inv.fee)}</strong>`;

    const r3 = document.createElement("div");
    r3.className = "row";
    r3.innerHTML = `<small>סה״כ</small><strong>${fmtILS(inv.total)}</strong>`;

    const r4 = document.createElement("div");
    r4.className = "row";
    r4.innerHTML = `<small>אמצעי תשלום</small><strong>${inv.paymentMethod || "card"}</strong>`;

    rows.appendChild(r1);
    rows.appendChild(r2);
    rows.appendChild(r3);
    rows.appendChild(r4);

    body.appendChild(rows);

    const foot = document.createElement("div");
    foot.className = "card-foot";

    const openBtn = document.createElement("button");
    openBtn.className = "primary";
    openBtn.type = "button";
    openBtn.textContent = "פתח נכס";
    openBtn.onclick = () => {
      // מעבר חזרה לעמוד הנכס עם id (Query string) 
      window.location.href = `property.html?id=${encodeURIComponent(inv.propertyId)}`;
    };

    const delBtn = document.createElement("button");
    delBtn.className = "dangerBtn";
    delBtn.type = "button";
    delBtn.textContent = "מחק";
    delBtn.onclick = () => removeOne(inv);

    foot.appendChild(delBtn);
    foot.appendChild(openBtn);

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(foot);

    grid.appendChild(card);
  }
}

async function removeOne(inv) {
  const id = inv._id;
  if (!id) return;

  const resp = await fetch(`/api/investments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) {
    alert("שגיאה במחיקה");
    return;
  }
  await applyAndRender();
}

async function applyAndRender() {
  const q = document.getElementById("search").value || "";
  const sort = document.getElementById("sort").value || "newest";

  const all = await loadInvestments();
  updateKpis(all);

  const view = all
    .filter((x) => matchesSearch(x, q))
    .sort(bySort(sort));

  render(view);
}

// UI events
document.getElementById("backBtn").onclick = () => history.back();
document.getElementById("refreshBtn").onclick = applyAndRender;

document.getElementById("search").addEventListener("input", applyAndRender);
document.getElementById("sort").addEventListener("change", applyAndRender);

document.getElementById("clearBtn").onclick = () => {
  const ok = confirm("למחוק את כל ההשקעות מהפורטפוליו? (Demo)");
  if (!ok) return;
  saveInvestments([]);
  applyAndRender();
};

// Auto-load properties on page entry
(async function init() {
  // Check if we're on the portfolio page (has grid container)
  const grid = document.getElementById("grid");
  if (!grid) return;
  
  try {
    // Import fetchProperties for properties API
    const { fetchProperties } = await import("./api.js");
    
    // Auto-load properties with default city
    const res = await fetchProperties({ city: "Denver", limit: 12, page: 1 });
    if (res?.status === "OK" && res?.data && res.data.length > 0) {
      // Render properties using the same render function
      // Map properties to investment-like format for compatibility
      const mapped = res.data.map(p => ({
        _id: p.id,
        propertyId: p.id,
        title: p.title,
        city: p.city,
        amount: p.price || 0,
        total: p.price || 0,
        fee: 0,
        paymentMethod: "card",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      }));
      render(mapped);
      updateKpis(mapped);
    } else {
      // Fall back to existing investments loading
      applyAndRender();
    }
  } catch (e) {
    console.error("Error loading properties:", e);
    // Fall back to existing investments loading
    applyAndRender();
  }
})();

