// frontend/public/js/auth-ui.js
// ✅ Central function to fetch current user from server (source of truth)
export async function fetchMe() {
  try {
    const r = await fetch("/api/auth/me", { credentials: "include" });
    if (!r.ok) return null;
    const data = await r.json();
    
    // ✅ Handle both old format (status/user) and new format (loggedIn/user)
    if (data.loggedIn === false) return null;
    if (data.loggedIn === true && data.user) return data.user;
    if (data.status === "OK" && data.user) return data.user; // Backward compatibility
    return null;
  } catch {
    return null;
  }
}

// Alias for backward compatibility
export async function getMe() {
  return fetchMe();
}

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  });
}

// מעדכן את הניווט (מסתיר Login/Register ומציג Logout כשמחוברים)
// ✅ Syncs UI with server session state (not localStorage)
export async function updateAuthNav() {
  const user = await fetchMe();
  
  // ✅ Clear any localStorage auth state if server says not logged in
  if (!user) {
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userId");
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  const loginLink = document.querySelector('[data-nav="login"]');
  const registerLink = document.querySelector('[data-nav="register"]');
  const logoutLink = document.querySelector('[data-nav="logout"]');
  const userBadge = document.querySelector('[data-auth="userBadge"]'); // אופציונלי

  if (user) {
    if (loginLink) loginLink.style.display = "none";
    if (registerLink) registerLink.style.display = "none";
    if (logoutLink) logoutLink.style.display = "";
    if (userBadge) userBadge.textContent = user.name || user.email || "User";
  } else {
    if (loginLink) loginLink.style.display = "";
    if (registerLink) registerLink.style.display = "";
    if (logoutLink) logoutLink.style.display = "none";
    if (userBadge) userBadge.textContent = "Guest";
  }

  return user;
}

