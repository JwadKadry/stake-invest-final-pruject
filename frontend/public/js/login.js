// login.js - Login form handler

// Redirect if already logged in
fetch("/api/auth/me", { credentials: "include" })
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => {
    if (data?.status === "OK") {
      window.location.href = "/index.html";
    }
  });

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const msgDiv = document.getElementById("msg");

function showMessage(text, isError = false) {
  msgDiv.textContent = text;
  msgDiv.style.display = "block";
  msgDiv.style.background = isError ? "#fee2e2" : "#d1fae5";
  msgDiv.style.color = isError ? "#991b1b" : "#065f46";
  msgDiv.style.border = `1px solid ${isError ? "#fecaca" : "#a7f3d0"}`;
}

function hideMessage() {
  msgDiv.style.display = "none";
  msgDiv.textContent = "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessage();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("Please enter both email and password", true);
    return;
  }

  try {
    // Login request
    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const json = await resp.json();

    if (!resp.ok) {
      showMessage(json.message || "Login failed", true);
      return;
    }

    // Verify session with /me endpoint
    const meResp = await fetch("/api/auth/me", {
      credentials: "include",
    });

    if (!meResp.ok) {
      showMessage("Session verification failed", true);
      return;
    }

    // Success - redirect to portfolio
    showMessage("Login successful! Redirecting...", false);
    setTimeout(() => {
      window.location.href = "/portfolio.html";
    }, 500);
  } catch (error) {
    console.error("Login error:", error);
    showMessage("Network error. Please try again.", true);
  }
});

