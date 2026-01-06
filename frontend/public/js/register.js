// register.js - Registration form handler

// Redirect if already logged in
fetch("/api/auth/me", { credentials: "include" })
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => {
    if (data?.status === "OK") {
      window.location.replace("/index.html");
    }
  });

async function register(payload) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try { 
    data = JSON.parse(text); 
  } catch { 
    data = { status: "ERROR", message: text }; 
  }

  if (!res.ok || data.status !== "OK") {
    throw new Error(data.message || "Registration failed");
  }
  return data;
}

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const msg = document.getElementById("msg");
  msg.style.display = "none";
  msg.textContent = "";

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await register({ name, email, password });
    window.location.href = "/index.html";
  } catch (err) {
    msg.style.display = "block";
    msg.textContent = err.message || "Registration failed";
    msg.style.background = "#fee2e2";
    msg.style.color = "#991b1b";
    msg.style.border = "1px solid #fecaca";
  }
});

