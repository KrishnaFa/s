/* theme.js — dark/light mode toggle */
"use strict";
import { $ } from "./utils.js";

export function initTheme() {
  const saved = localStorage.getItem("dvp-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved === "dark" || (!saved && prefersDark));
}

export function applyTheme(dark) {
  document.body.classList.toggle("dark-mode", dark);
  $("sunIcon").classList.toggle("hidden", dark);
  $("moonIcon").classList.toggle("hidden", !dark);
  localStorage.setItem("dvp-theme", dark ? "dark" : "light");
  // Notify charts module to re-style
  document.dispatchEvent(new CustomEvent("themeChanged", { detail: { dark } }));
}

export function setupThemeToggle() {
  $("themeToggleBtn").addEventListener("click", () => {
    applyTheme(!document.body.classList.contains("dark-mode"));
  });
}
