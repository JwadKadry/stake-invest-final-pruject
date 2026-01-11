// Admin Panel - Investments View
(async function() {
  const loadingEl = document.getElementById("loading");
  const errorEl = document.getElementById("error");
  const tableEl = document.getElementById("investmentsTable");
  const tbody = document.getElementById("rows");

  try {
    const res = await fetch("/api/admin/investments", {
      credentials: "include"
    });

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error("⛔ אין הרשאת Admin");
      } else if (res.status === 401) {
        throw new Error("צריך להתחבר");
      }
      throw new Error(`שגיאה: ${res.status}`);
    }

    const json = await res.json();
    
    if (json.status !== "OK") {
      throw new Error(json.message || "שגיאה בטעינת נתונים");
    }

    const investments = json.data || [];
    const stats = json.stats || { totalInvested: 0, totalFees: 0, count: 0 };

    // Hide loading
    if (loadingEl) loadingEl.style.display = "none";

    // Show and populate statistics
    const statsEl = document.getElementById("adminStats");
    if (statsEl) {
      statsEl.style.display = "flex";
      document.getElementById("sInvested").textContent = "₪" + Number(stats.totalInvested || 0).toLocaleString("he-IL");
      document.getElementById("sFees").textContent = "₪" + Number(stats.totalFees || 0).toLocaleString("he-IL");
      document.getElementById("sCount").textContent = stats.count || 0;
    }

    if (investments.length === 0) {
      if (errorEl) {
        errorEl.textContent = "אין השקעות להצגה";
        errorEl.style.display = "block";
      }
      return;
    }

    // Show table
    if (tableEl) tableEl.style.display = "table";

    // Render rows
    investments.forEach(inv => {
      const tr = document.createElement("tr");
      
      const date = new Date(inv.createdAt).toLocaleString("he-IL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });

      const statusText = 
        inv.status === "CANCELED" ? "בוטל" :
        inv.status === "CANCEL_REQUESTED" ? "בקשה נשלחה" :
        "פעיל";

      const statusColor = 
        inv.status === "CANCELED" ? "#ef4444" :
        inv.status === "CANCEL_REQUESTED" ? "#f59e0b" :
        "#22c55e";

      // Actions column - show approve button only for CANCEL_REQUESTED
      let actions = "";
      if (inv.status === "CANCEL_REQUESTED") {
        actions = `<button onclick="approveCancel('${inv.id}')" style="padding:6px 12px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">אשר ביטול</button>`;
      }

      tr.innerHTML = `
        <td>${inv.investorEmail}<br><small style="color:#6b7280">${inv.investorName || ""}</small></td>
        <td>${inv.title || inv.propertyId || "—"}</td>
        <td>${inv.city || "—"}</td>
        <td><strong>₪${Number(inv.amount || 0).toLocaleString("he-IL")}</strong></td>
        <td>₪${Number(inv.fee || 0).toLocaleString("he-IL")}</td>
        <td><strong>₪${Number(inv.totalCharged || 0).toLocaleString("he-IL")}</strong></td>
        <td><span style="color:${statusColor};font-weight:600">${statusText}</span></td>
        <td><small>${date}</small></td>
        <td>${actions}</td>
      `;
      
      if (tbody) tbody.appendChild(tr);
    });

    // Make approveCancel function available globally
    window.approveCancel = async function(id) {
      if (!confirm("לאשר ביטול השקעה זו?")) return;

      try {
        const res = await fetch(`/api/admin/investments/${id}/approve-cancel`, {
          method: "POST",
          credentials: "include"
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.message || "שגיאה באישור ביטול");
          return;
        }

        // Reload page to show updated data
        location.reload();
      } catch (err) {
        console.error("Approve cancel error:", err);
        alert("שגיאה באישור ביטול");
      }
    };

  } catch (err) {
    console.error("Admin panel error:", err);
    
    if (loadingEl) loadingEl.style.display = "none";
    if (errorEl) {
      errorEl.textContent = err.message || "שגיאה בטעינת נתונים";
      errorEl.style.display = "block";
    }
  }
})();

// User history search
async function loadUserHistoryByEmail(email) {
  const box = document.getElementById("userHistoryBox");
  if (!box) return;

  box.textContent = "טוען היסטוריה...";
  box.style.padding = "12px";
  box.style.background = "#f3f4f6";
  box.style.borderRadius = "8px";

  try {
    const r = await fetch(`/api/admin/user-history?email=${encodeURIComponent(email)}`, {
      credentials: "include"
    });
    const data = await r.json();

    if (!r.ok) {
      box.textContent = data?.message || "שגיאה";
      box.style.background = "#fee2e2";
      box.style.color = "#991b1b";
      return;
    }

    if (!data.user) {
      box.textContent = "לא נמצא משתמש.";
      box.style.background = "#fee2e2";
      box.style.color = "#991b1b";
      return;
    }

    const rows = (data.investments || []).map(x => {
      const date = new Date(x.createdAt).toLocaleString("he-IL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
      const statusText = 
        x.status === "CANCELED" ? "בוטל" :
        x.status === "CANCEL_REQUESTED" ? "בקשה נשלחה" :
        "פעיל";
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${date}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${x.property?.title || "-"}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${x.property?.city || "-"}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">₪${Number(x.amount || 0).toLocaleString("he-IL")}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${statusText}</td>
        </tr>
      `;
    }).join("");

    box.innerHTML = `
      <div style="padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:white">
        <div style="font-weight:700;margin-bottom:12px;font-size:16px">
          היסטוריה: ${data.user.name || ""} (${data.user.email})
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f9fafb">
              <th style="text-align:right;border-bottom:2px solid #e5e7eb;padding:8px">תאריך</th>
              <th style="text-align:right;border-bottom:2px solid #e5e7eb;padding:8px">נכס</th>
              <th style="text-align:right;border-bottom:2px solid #e5e7eb;padding:8px">עיר</th>
              <th style="text-align:right;border-bottom:2px solid #e5e7eb;padding:8px">סכום</th>
              <th style="text-align:right;border-bottom:2px solid #e5e7eb;padding:8px">סטטוס</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="5" style="padding:12px;text-align:center;color:#6b7280">אין השקעות</td></tr>`}</tbody>
        </table>
      </div>
    `;
    box.style.background = "transparent";
    box.style.color = "";
  } catch (err) {
    console.error("User history error:", err);
    box.textContent = "שגיאה בטעינת היסטוריה";
    box.style.background = "#fee2e2";
    box.style.color = "#991b1b";
  }
}

document.getElementById("btnUserSearch")?.addEventListener("click", async () => {
  const email = document.getElementById("userEmailSearch")?.value.trim();
  if (!email) return;
  try {
    await loadUserHistoryByEmail(email);
  } catch (e) {
    console.error("Search error:", e);
  }
});

document.getElementById("btnClearSearch")?.addEventListener("click", () => {
  const emailInput = document.getElementById("userEmailSearch");
  const box = document.getElementById("userHistoryBox");
  if (emailInput) emailInput.value = "";
  if (box) box.innerHTML = "";
});

