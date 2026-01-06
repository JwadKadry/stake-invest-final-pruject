// frontend/public/js/auth-ui.js
export async function getMe() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  });
}

// מעדכן את הניווט (מסתיר Login/Register ומציג Logout כשמחוברים)
export async function updateAuthNav() {
  const user = await getMe();

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

