/* app.js — main coordinator: upload, sheet, KPIs, stats, tab routing */
"use strict";
import { $, formatFileSize, showToast } from "./utils.js";
import { initTheme, setupThemeToggle } from "./theme.js";
import { configureAxes, updateAllCharts, syncChartState, destroyAllCharts, attachAxisListeners } from "./charts.js";
import { initTable, applySearch, getFilteredRows, exportCSV, exportJSON } from "./table.js";
import { initAggregator, runAggregation } from "./aggregator.js";

/* ── State ──────────────────────────────────────────────────────────────── */
let _sessionKey  = null;
let _sheetName   = null;
let _allRows     = [];
let _headers     = [];
let _numericCols = [];
let _filename    = "";
let _activeTab   = "table";

/* ── Boot ────────────────────────────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupThemeToggle();
  attachAxisListeners();
  setupDropzone();
  setupSearch();
  setupSheetSelect();
  setupTabs();
  setupExport();
  $("calcBtn").addEventListener("click", runAggregation);
  $("resetBtn").addEventListener("click", resetApp);
  $("closeExportModal").addEventListener("click", closeExportModal);
});

/* ── Dropzone ────────────────────────────────────────────────────────────── */
function setupDropzone() {
  const dropzone  = $("dropzone");
  const fileInput = $("fileInput");

  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => fileInput.files[0] && uploadFile(fileInput.files[0]));

  dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("dragover"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", e => {
    e.preventDefault(); dropzone.classList.remove("dragover");
    const f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  });
}

/* ── File Upload ─────────────────────────────────────────────────────────── */
function uploadFile(file) {
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    showErrorBanner("Please upload a valid .xlsx or .xls file.");
    return;
  }
  hideErrorBanner();
  showLoading();
  _filename = file.name;

  const fd = new FormData();
  fd.append("file", file);

  fetch("/api/upload", { method:"POST", body:fd })
    .then(r => r.json())
    .then(d => {
      if (d.error) { showErrorBanner(d.error); hideLoading(); return; }
      _sessionKey = d.session_key;
      populateSheetSelect(d.sheets, d.default_sheet);
      buildFilePill(d.filename, d.file_size);
      loadSheet(d.default_sheet);
    })
    .catch(() => { showErrorBanner("Upload failed. Is the Flask server running?"); hideLoading(); });
}

/* ── Sheet Selector ──────────────────────────────────────────────────────── */
function populateSheetSelect(sheets, defaultSheet) {
  const sel = $("sheetSelect");
  sel.innerHTML = "";
  sheets.forEach(s => {
    const o = document.createElement("option");
    o.value = s; o.textContent = s;
    if (s === defaultSheet) o.selected = true;
    sel.appendChild(o);
  });

  if (sheets.length > 1) {
    $("sheetSelectWrapper").classList.remove("hidden");
  } else {
    $("sheetSelectWrapper").classList.add("hidden");
  }
}

function setupSheetSelect() {
  $("sheetSelect").addEventListener("change", e => loadSheet(e.target.value));
}

/* ── Load Sheet Data ─────────────────────────────────────────────────────── */
function loadSheet(sheetName) {
  _sheetName = sheetName;
  showLoading();

  fetch("/api/sheet", {
    method: "POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ session_key:_sessionKey, sheet_name:sheetName })
  })
  .then(r => r.json())
  .then(d => {
    hideLoading();
    if (d.error) { showErrorBanner(d.error); return; }

    _headers     = d.headers     || [];
    _allRows     = d.rows        || [];
    _numericCols = d.numeric_cols || [];

    if (!_headers.length || !_allRows.length) {
      showErrorBanner(d.warning || "This sheet appears empty or has no readable data.");
      return;
    }

    updateKPIs(d);
    destroyAllCharts();
    initTable(_headers, _allRows);
    configureAxes(_headers, _numericCols);
    syncChartState(_allRows, _numericCols, _headers);
    initAggregator(_sessionKey, _sheetName, _headers, _numericCols);
    showDashboard();

    if (d.warning) showToast(d.warning, "info");
    else showToast(`"${sheetName}" loaded — ${_allRows.length.toLocaleString()} rows`);
  })
  .catch(() => { hideLoading(); showErrorBanner("Failed to load sheet data."); });
}

/* ── KPI Cards ───────────────────────────────────────────────────────────── */
function updateKPIs(d) {
  $("kpiRows").textContent    = d.total_rows.toLocaleString();
  $("kpiCols").textContent    = d.total_cols.toLocaleString();
  $("kpiNumeric").textContent = _numericCols.length;

  // Missing values count
  let missing = 0;
  _allRows.forEach(row => _headers.forEach(h => { if (row[h] === null || row[h] === undefined || row[h] === "") missing++; }));
  $("kpiMissing").textContent = missing.toLocaleString();
}

/* ── Stats Tab ───────────────────────────────────────────────────────────── */
function loadStats() {
  const container = $("statsContainer");
  container.innerHTML = `<div class="loading-overlay"><div class="loader"></div><p style="color:var(--muted);font-weight:600">Computing statistics…</p></div>`;

  fetch("/api/stats", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ session_key:_sessionKey, sheet_name:_sheetName })
  })
  .then(r => r.json())
  .then(d => {
    if (d.error) { container.innerHTML = `<p style="padding:2rem;color:var(--danger)">${d.error}</p>`; return; }
    renderStats(d.stats, container);
  })
  .catch(() => { container.innerHTML = `<p style="padding:2rem;color:var(--danger)">Stats request failed.</p>`; });
}

function renderStats(stats, container) {
  if (!stats.length) { container.innerHTML = `<p style="padding:2rem;color:var(--muted)">No statistics available.</p>`; return; }

  const fmt = v => (v === null || v === undefined) ? "—" : (typeof v === "number" ? v.toLocaleString(undefined,{maximumFractionDigits:2}) : v);

  let html = `<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th>Column</th><th>Type</th><th>Count</th><th>Missing</th><th>Unique</th>
      <th>Mean / Mode</th><th>Median / Mode%</th><th>Std / —</th><th>Min</th><th>Max</th>
    </tr></thead><tbody>`;

  stats.forEach(s => {
    const badge = `<span class="stat-type-badge ${s.type}">${s.type}</span>`;
    if (s.type === "numeric") {
      html += `<tr>
        <td><strong>${s.column}</strong></td>
        <td>${badge}</td>
        <td>${s.count.toLocaleString()}</td>
        <td>${s.missing > 0 ? `<span style="color:var(--warning)">${s.missing}</span>` : "0"}</td>
        <td>${s.uniques.toLocaleString()}</td>
        <td style="font-family:var(--font-mono)">${fmt(s.mean)}</td>
        <td style="font-family:var(--font-mono)">${fmt(s.median)}</td>
        <td style="font-family:var(--font-mono)">${fmt(s.std)}</td>
        <td style="font-family:var(--font-mono)">${fmt(s.min)}</td>
        <td style="font-family:var(--font-mono)">${fmt(s.max)}</td>
      </tr>`;
    } else {
      html += `<tr>
        <td><strong>${s.column}</strong></td>
        <td>${badge}</td>
        <td>${s.count.toLocaleString()}</td>
        <td>${s.missing > 0 ? `<span style="color:var(--warning)">${s.missing}</span>` : "0"}</td>
        <td>${s.uniques.toLocaleString()}</td>
        <td colspan="3">${s.mode}</td>
        <td>${s.mode_count} (${s.mode_pct}%)</td>
        <td>—</td>
      </tr>`;
    }
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

/* ── Tab Routing ─────────────────────────────────────────────────────────── */
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  _activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("hidden", p.id !== `tab-${tab}`));
  if (tab === "stats" && _sessionKey) loadStats();
  if (tab === "charts") { syncChartState(getFilteredRows(), _numericCols, _headers); updateAllCharts(); }
}

/* ── Search ──────────────────────────────────────────────────────────────── */
function setupSearch() {
  let debounce;
  const inp = $("searchInput");
  const col = $("columnFilterSelect");

  const doSearch = () => {
    applySearch(inp.value, col.value);
    syncChartState(getFilteredRows(), _numericCols, _headers);
    if (_activeTab === "charts") updateAllCharts();
  };

  inp.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(doSearch, 250); });
  col.addEventListener("change", doSearch);

  $("clearSearchBtn").addEventListener("click", () => {
    inp.value = ""; col.value = "";
    applySearch("", "");
    syncChartState(getFilteredRows(), _numericCols, _headers);
    if (_activeTab === "charts") updateAllCharts();
  });
}

/* ── Export ──────────────────────────────────────────────────────────────── */
function setupExport() {
  $("exportBtn").addEventListener("click", () => {
    if (!_allRows.length) { showToast("Upload data first", "error"); return; }
    $("exportModal").classList.add("active");
  });
  $("exportCSVBtn").addEventListener("click",  () => { exportCSV(_filename.replace(/\..+$/,"")); closeExportModal(); });
  $("exportJSONBtn").addEventListener("click", () => { exportJSON(_filename.replace(/\..+$/,"")); closeExportModal(); });
  $("exportModal").addEventListener("click", e => { if (e.target === $("exportModal")) closeExportModal(); });
}
function closeExportModal() { $("exportModal").classList.remove("active"); }

/* ── File Pill ───────────────────────────────────────────────────────────── */
function buildFilePill(name, size) {
  $("filePillName").textContent = name;
  $("filePillSize").textContent = formatFileSize(size);
  $("dashboardToolbar").classList.remove("hidden");
}

/* ── UI state helpers ────────────────────────────────────────────────────── */
function showLoading() {
  $("heroSection").classList.add("hidden");
  $("dashboardContent").classList.add("hidden");
  $("loadingOverlay").classList.remove("hidden");
}
function hideLoading() { $("loadingOverlay").classList.add("hidden"); }
function showDashboard() {
  $("heroSection").classList.add("hidden");
  $("loadingOverlay").classList.add("hidden");
  $("dashboardContent").classList.remove("hidden");
  $("dashboardContent").classList.add("slide-up");
  switchTab(_activeTab);
}

function showErrorBanner(msg) {
  const banner = $("errorBanner");
  banner.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${msg}`;
  banner.classList.remove("hidden");
  $("heroSection").classList.remove("hidden");
  hideLoading();
}
function hideErrorBanner() { $("errorBanner").classList.add("hidden"); }

function resetApp() {
  _sessionKey = null; _sheetName = null;
  _allRows = []; _headers = []; _numericCols = [];
  destroyAllCharts();
  $("fileInput").value = "";
  $("sheetSelect").innerHTML = "";
  $("searchInput").value = "";
  $("aggregationResults").innerHTML = "";
  $("dashboardContent").classList.add("hidden");
  $("dashboardToolbar").classList.add("hidden");
  $("heroSection").classList.remove("hidden");
  hideErrorBanner();
  showToast("Dashboard reset");
}
