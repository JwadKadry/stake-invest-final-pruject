// favorites.js - Favorites utility functions

// Check if user is logged in
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

// Check if property is favorited
async function isFavorited(propertyId) {
  try {
    const resp = await fetch("/api/favorites", {
      credentials: "include",
    });
    if (!resp.ok) return false;
    const json = await resp.json();
    const favorites = json.data || [];
    return favorites.some(f => String(f.propertyId) === String(propertyId));
  } catch {
    return false;
  }
}

// Add favorite
async function addFavorite(propertyId, title, city, imageUrl) {
  try {
    const resp = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ propertyId, title, city, imageUrl }),
    });
    return resp.ok;
  } catch {
    return false;
  }
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

// Toggle favorite
async function toggleFavorite(propertyId, title, city, imageUrl, buttonElement) {
  const isLoggedIn = await checkUserLoggedIn();
  if (!isLoggedIn) {
    alert("Login to save favorites");
    return false;
  }

  const currentlyFavorited = buttonElement.classList.contains("favorited");
  
  if (currentlyFavorited) {
    const success = await removeFavorite(propertyId);
    if (success) {
      buttonElement.classList.remove("favorited");
      buttonElement.title = "Add to favorites";
      return false;
    }
  } else {
    const success = await addFavorite(propertyId, title, city, imageUrl);
    if (success) {
      buttonElement.classList.add("favorited");
      buttonElement.title = "Remove from favorites";
      return true;
    }
  }
  return currentlyFavorited;
}

// Create favorites button element
function createFavoritesButton(propertyId, title, city, imageUrl) {
  const btn = document.createElement("button");
  btn.className = "favorite-btn";
  btn.type = "button";
  btn.innerHTML = "★";
  btn.title = "Add to favorites";
  btn.style.cssText = `
    background: transparent;
    border: none;
    font-size: 24px;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px 8px;
    transition: color 0.2s;
  `;
  
  btn.onmouseenter = () => {
    if (!btn.classList.contains("favorited")) {
      btn.style.color = "#fbbf24";
    }
  };
  
  btn.onmouseleave = () => {
    if (!btn.classList.contains("favorited")) {
      btn.style.color = "#9ca3af";
    }
  };

  // Check initial state
  (async () => {
    const favorited = await isFavorited(propertyId);
    if (favorited) {
      btn.classList.add("favorited");
      btn.style.color = "#fbbf24";
      btn.title = "Remove from favorites";
    }
  })();

  btn.onclick = async () => {
    await toggleFavorite(propertyId, title, city, imageUrl, btn);
  };

  return btn;
}

export { 
  checkUserLoggedIn, 
  isFavorited, 
  addFavorite, 
  removeFavorite, 
  toggleFavorite, 
  createFavoritesButton 
};

