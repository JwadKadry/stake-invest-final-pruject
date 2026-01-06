// favorites-page.js - Favorites page functionality

// Load favorites
async function loadFavorites() {
  const resp = await fetch("/api/favorites", {
    credentials: "include",
  });
  if (resp.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  if (!resp.ok) throw new Error("Failed to load favorites");
  const json = await resp.json();
  return json.data || [];
}

// Remove favorite
async function removeFavorite(propertyId) {
  try {
    const resp = await fetch(`/api/favorites/${encodeURIComponent(propertyId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function renderFavorites(favorites) {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");

  if (!grid || !empty) return;

  grid.innerHTML = "";

  if (!favorites.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const fav of favorites) {
    const card = document.createElement("article");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";

    // Property image if available
    if (fav.imageUrl) {
      const imgWrap = document.createElement("div");
      imgWrap.style.cssText = "width:100%;height:200px;overflow:hidden;border-radius:8px;margin-bottom:12px;background:#f3f4f6";
      const img = document.createElement("img");
      img.src = fav.imageUrl;
      img.style.cssText = "width:100%;height:100%;object-fit:cover";
      img.alt = fav.title || "Property";
      img.onerror = () => { imgWrap.style.display = "none"; };
      imgWrap.appendChild(img);
      head.appendChild(imgWrap);
    }

    const titleWrap = document.createElement("div");
    const h = document.createElement("h3");
    h.className = "card-title";
    h.textContent = fav.title || "נכס";
    const sub = document.createElement("div");
    sub.className = "muted";
    sub.textContent = `${fav.city || "—"} • ${fav.propertyId || "—"}`;
    titleWrap.appendChild(h);
    titleWrap.appendChild(sub);

    head.appendChild(titleWrap);

    const body = document.createElement("div");
    body.className = "card-body";
    body.style.cssText = "padding:12px";

    const date = new Date(fav.createdAt || Date.now()).toLocaleDateString("he-IL");
    const dateText = document.createElement("div");
    dateText.className = "muted";
    dateText.textContent = `Added: ${date}`;
    body.appendChild(dateText);

    const foot = document.createElement("div");
    foot.className = "card-foot";

    const openBtn = document.createElement("button");
    openBtn.className = "primary";
    openBtn.type = "button";
    openBtn.textContent = "פתח נכס";
    openBtn.onclick = () => {
      window.location.href = `property.html?id=${encodeURIComponent(fav.propertyId)}`;
    };

    const removeBtn = document.createElement("button");
    removeBtn.className = "dangerBtn";
    removeBtn.type = "button";
    removeBtn.textContent = "הסר";
    removeBtn.onclick = async () => {
      const ok = confirm("האם להסיר את הנכס מהמועדפים?");
      if (!ok) return;
      
      const success = await removeFavorite(fav.propertyId);
      if (success) {
        await applyAndRender();
      } else {
        alert("שגיאה בהסרת המועדף");
      }
    };

    foot.appendChild(removeBtn);
    foot.appendChild(openBtn);

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(foot);

    grid.appendChild(card);
  }
}

async function applyAndRender() {
  try {
    const favorites = await loadFavorites();
    renderFavorites(favorites);
  } catch (e) {
    if (e.message === "UNAUTHORIZED") {
      // Show login message and hide favorites
      const loginMsg = document.getElementById("loginMessage");
      const grid = document.getElementById("grid");
      const empty = document.getElementById("empty");
      
      if (loginMsg) loginMsg.style.display = "block";
      if (grid) grid.style.display = "none";
      if (empty) empty.style.display = "none";
    } else {
      console.error("Error loading favorites:", e);
      alert("שגיאה בטעינת המועדפים");
    }
  }
}

// UI events
const backBtn = document.getElementById("backBtn");
if (backBtn) {
  backBtn.onclick = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/index.html";
    }
  };
}

// Auto-load favorites on page entry
(async function init() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  
  await applyAndRender();
})();

