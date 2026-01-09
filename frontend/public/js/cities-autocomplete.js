// cities-autocomplete.js
// Standalone city autocomplete that integrates with existing property search

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const cityInput = document.getElementById("cityInput");
    const cityDropdown = document.getElementById("cityDropdown");

    if (!cityInput || !cityDropdown) {
      console.warn("[cities-autocomplete] cityInput or cityDropdown not found");
      return;
    }

    let suggestions = [];
    let activeIndex = -1;
    let debounceTimer = null;

    function showDropdown() {
      cityDropdown.classList.remove("hidden");
    }

    function hideDropdown() {
      cityDropdown.classList.add("hidden");
      activeIndex = -1;
    }

    function renderDropdown(items) {
      cityDropdown.innerHTML = "";
      if (!items.length) {
        hideDropdown();
        return;
      }

      items.forEach((name, idx) => {
        const div = document.createElement("div");
        div.className = "dropdown-item";
        div.textContent = name;

        div.addEventListener("mousedown", (e) => {
          e.preventDefault(); // בוחר לפני blur
          selectCity(idx);
        });

        cityDropdown.appendChild(div);
      });

      showDropdown();
    }

    function setActive(index) {
      const nodes = cityDropdown.querySelectorAll(".dropdown-item");
      nodes.forEach((n) => n.classList.remove("active"));
      activeIndex = index;

      if (activeIndex >= 0 && activeIndex < nodes.length) {
        nodes[activeIndex].classList.add("active");
        nodes[activeIndex].scrollIntoView({ block: "nearest" });
      }
    }

    async function fetchCitySuggestions(q) {
      const url = `/api/cities?q=${encodeURIComponent(q)}&limit=10`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`cities fetch failed: ${res.status}`);
      const json = await res.json();
      // Handle both new format and legacy format
      if (json.status === "OK" && Array.isArray(json.data)) {
        return json.data;
      }
      if (Array.isArray(json.cities)) {
        return json.cities;
      }
      return [];
    }

    function selectCity(idx) {
      const city = suggestions[idx];
      if (!city) return;

      cityInput.value = city;
      cityInput.dataset.validCity = "true"; // ✅ עיר תקפה לחיפוש
      hideDropdown();

      // ✅ תן ל-main.js לבצע את הטעינה (הפונקציה שלו כבר על window)
      if (typeof window.loadPropertiesByCity === "function") {
        window.loadPropertiesByCity(city, 1, 12);
      }
    }

    async function loadPropertiesByCity(city, page = 1, limit = 12) {
      if (!city) return;

      // Wait for main.js to load and expose functions
      function waitForMainJs() {
        return new Promise((resolve) => {
          if (typeof window.loadPropertiesByCity === 'function') {
            resolve();
          } else {
            let attempts = 0;
            const checkInterval = setInterval(() => {
              attempts++;
              if (typeof window.loadPropertiesByCity === 'function') {
                clearInterval(checkInterval);
                resolve();
              } else if (attempts > 50) { // 5 seconds max wait
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          }
        });
      }

      await waitForMainJs();

      // Use window.loadPropertiesByCity if available (from main.js)
      if (typeof window.loadPropertiesByCity === 'function') {
        window.loadPropertiesByCity(city, page, limit);
        return;
      }

      // Fallback: do direct fetch if main.js not loaded yet
      try {
        const params = new URLSearchParams({
          city: city,
          page: page.toString(),
          limit: limit.toString(),
        });

        const typeFilter = document.getElementById("typeFilter")?.value;
        if (typeFilter && typeFilter !== "ALL" && typeFilter !== "ALL TYPES") {
          params.set("type", typeFilter);
        }

        const url = `/api/properties?${params.toString()}`;
        const res = await fetch(url, { credentials: "include" });
        const json = await res.json();

        if (typeof window.renderResults === 'function' && json.data) {
          window.renderResults(json.data || []);
          if (typeof window.setMetaText === 'function') {
            window.setMetaText(json.count ? `נמצאו ${json.count} נכסים` : "");
          }
        } else {
          // Dispatch event as fallback
          window.dispatchEvent(new CustomEvent('citySelected', {
            detail: { city, properties: json.data || [], count: json.count || 0 }
          }));
          console.log("[cities-autocomplete] Loaded properties (fallback):", json);
        }
      } catch (err) {
        console.error("[cities-autocomplete] Error loading properties:", err);
        if (typeof window.showError === 'function') {
          window.showError("שגיאה בטעינת נכסים");
        }
      }
    }

    // Input event with debounce
    cityInput.addEventListener("input", () => {
      cityInput.dataset.validCity = "false"; // ❌ לא תקף עד בחירה
      const q = cityInput.value.trim();
      clearTimeout(debounceTimer);

      debounceTimer = setTimeout(async () => {
        if (q.length < 1) {
          hideDropdown();
          return;
        }

        try {
          suggestions = await fetchCitySuggestions(q);
          renderDropdown(suggestions);
        } catch (err) {
          console.error("[cities-autocomplete] Error:", err);
          hideDropdown();
        }
      }, 180); // debounce קטן כדי לא להפציץ את השרת
    });

    // Keyboard navigation
    cityInput.addEventListener("keydown", (e) => {
      if (cityDropdown.classList.contains("hidden")) return;
      const max = suggestions.length - 1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(activeIndex < max ? activeIndex + 1 : 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(activeIndex > 0 ? activeIndex - 1 : max);
      } else if (e.key === "Enter") {
        if (activeIndex >= 0) {
          e.preventDefault();
          selectCity(activeIndex);
        }
      } else if (e.key === "Escape") {
        hideDropdown();
      }
    });

    // Show suggestions on focus if there's text
    cityInput.addEventListener("focus", async () => {
      const q = cityInput.value.trim();
      if (!q) return;

      try {
        suggestions = await fetchCitySuggestions(q);
        renderDropdown(suggestions);
      } catch {
        hideDropdown();
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (e.target !== cityInput && !cityDropdown.contains(e.target)) {
        hideDropdown();
      }
    });

    console.log("[cities-autocomplete] Initialized");
  }
})();

