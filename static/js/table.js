/* table.js — table render, sort, search, filter, pagination */
"use strict";
import { $, showToast } from "./utils.js";

let _headers = [];
let _allRows  = [];
let _filtered = [];
let _sortCol  = null;
let _sortAsc  = true;
let _page     = 1;
const PAGE_SIZE = 50;

/* ── Called by app.js after data loads ── */
export function initTable(headers, rows) {
  _headers = headers;
  _allRows  = rows;
  _filtered = [...rows];
  _sortCol  = null;
  _sortAsc  = true;
  _page     = 1;

  buildColumnFilter();
  renderTable();
}

/* ── Column filter dropdown ── */
function buildColumnFilter() {
  const sel = $("columnFilterSelect");
  sel.innerHTML = `<option value="">All Columns</option>`;
  _headers.forEach(h => {
    const o = document.createElement("option");
    o.value = h; o.textContent = h;
    sel.appendChild(o);
  });
}

/* ── Main render ── */
export function renderTable() {
  const container = $("tableContainer");
  if (!_filtered.length || !_headers.length) {
    container.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--muted);font-weight:600">No data to display</div>`;
    $("paginationBar").classList.add("hidden");
    return;
  }

  const total = _filtered.length;
  const start = (_page - 1) * PAGE_SIZE;
  const end   = Math.min(start + PAGE_SIZE, total);
  const slice = _filtered.slice(start, end);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Build table
  let html = `<table class="data-table" id="dataTable" role="grid">
    <thead><tr>
      <th style="width:48px;text-align:center;color:var(--muted)">#</th>`;

  _headers.forEach(h => {
    const active = _sortCol === h;
    const arrow  = active ? (_sortAsc ? "↑" : "↓") : "↕";
    html += `<th onclick="window._sortTable('${_esc(h)}')" title="Sort by ${_esc(h)}">${_esc(h)} <span class="sort-indicator">${arrow}</span></th>`;
  });
  html += `</tr></thead><tbody>`;

  slice.forEach((row, i) => {
    html += `<tr>`;
    html += `<td style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:.72rem">${start + i + 1}</td>`;
    _headers.forEach(h => {
      const val = row[h] !== undefined && row[h] !== null ? row[h] : "";
      const display = typeof val === "number"
        ? (Number.isInteger(val) ? val.toLocaleString() : val.toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:2}))
        : String(val);
      html += `<td title="${_esc(String(val))}">${_esc(display)}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;

  // Pagination
  const bar = $("paginationBar");
  const info = $("paginationInfo");
  const btns = $("paginationButtons");

  bar.classList.remove("hidden");
  info.innerHTML = `Showing <strong>${start+1}–${end}</strong> of <strong>${total.toLocaleString()}</strong> rows`;

  // Build pagination controls
  btns.innerHTML = "";
  _addPageBtn(btns,"‹", _page-1, _page===1);
  const windowPgs = pageBtns(totalPages, _page);
  let prev = null;
  windowPgs.forEach(p => {
    if (prev !== null && p - prev > 1) {
      const sp = document.createElement("span");
      sp.textContent = "…"; sp.style.cssText="padding:0 .4rem;color:var(--muted);align-self:center;font-size:.85rem";
      btns.appendChild(sp);
    }
    _addPageBtn(btns, p, p, false, _page===p);
    prev = p;
  });
  _addPageBtn(btns,"›",_page+1,_page===totalPages);
}

function pageBtns(total, current) {
  const pages = new Set([1, total]);
  for (let i = Math.max(2,current-1); i <= Math.min(total-1,current+1); i++) pages.add(i);
  return [...pages].sort((a,b)=>a-b);
}

function _addPageBtn(container, label, target, disabled, active=false) {
  const b = document.createElement("button");
  b.className = "pagination-btn" + (active?" active":"");
  b.textContent = label; b.disabled = disabled;
  if (!disabled && !active) b.addEventListener("click", () => { _page = target; renderTable(); });
  container.appendChild(b);
}

/* ── Sort ── */
window._sortTable = function(col) {
  if (_sortCol === col) _sortAsc = !_sortAsc;
  else { _sortCol = col; _sortAsc = true; }
  _filtered.sort((a,b) => {
    let va = a[col] ?? "", vb = b[col] ?? "";
    if (typeof va === "number" && typeof vb === "number") return _sortAsc ? va-vb : vb-va;
    va = String(va); vb = String(vb);
    return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  _page = 1; renderTable();
};

/* ── Search ── */
export function applySearch(query, colFilter) {
  const q = query.trim().toLowerCase();
  _filtered = !q
    ? [..._allRows]
    : _allRows.filter(row => {
        if (colFilter) return String(row[colFilter] ?? "").toLowerCase().includes(q);
        return _headers.some(h => String(row[h] ?? "").toLowerCase().includes(q));
      });
  _page = 1;
  renderTable();
}

/* ── Return filtered rows (for charts) ── */
export function getFilteredRows() { return _filtered; }

/* ── Export CSV ── */
export function exportCSV(filename="data_export") {
  if (!_filtered.length) { showToast("No data to export", "error"); return; }
  const esc = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const rows = [_headers.map(esc).join(","), ..._filtered.map(r => _headers.map(h => esc(r[h])).join(","))];
  const blob = new Blob([rows.join("\n")], {type:"text/csv"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`; a.click();
  showToast("CSV exported!");
}

/* ── Export JSON ── */
export function exportJSON(filename="data_export") {
  if (!_filtered.length) { showToast("No data to export", "error"); return; }
  const blob = new Blob([JSON.stringify(_filtered, null, 2)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `${filename}.json`; a.click();
  showToast("JSON exported!");
}

function _esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
