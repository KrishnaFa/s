/* aggregator.js — quick-calc panel powered by Flask /api/aggregate */
"use strict";
import { $, showToast } from "./utils.js";

let _sessionKey  = null;
let _sheetName   = null;
let _headers     = [];
let _numericCols = [];

export function initAggregator(sessionKey, sheetName, headers, numericCols) {
  _sessionKey  = sessionKey;
  _sheetName   = sheetName;
  _headers     = headers;
  _numericCols = numericCols;
  buildColumnSelect();
}

function buildColumnSelect() {
  const sel = $("aggColumn");
  sel.innerHTML = `<option value="">Select Column…</option>`;
  _headers.forEach(h => {
    const o = document.createElement("option");
    o.value = h; o.textContent = h;
    sel.appendChild(o);
  });

  // Show/hide ops based on column type
  sel.addEventListener("change", () => {
    const col = sel.value;
    const isNum = _numericCols.includes(col);
    document.querySelectorAll("#aggFunc option[data-num]").forEach(o => {
      o.disabled = !isNum;
      o.style.color = isNum ? "" : "var(--muted)";
    });
    if (!isNum) $("aggFunc").value = "count";
  });
}

export function runAggregation() {
  const col  = $("aggColumn").value;
  const func = $("aggFunc").value;

  if (!col)          { showToast("Choose a column first", "error"); return; }
  if (!_sessionKey)  { showToast("Upload a file first", "error"); return; }

  fetch("/api/aggregate", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ session_key:_sessionKey, sheet_name:_sheetName, column:col, func })
  })
  .then(r => r.json())
  .then(d => {
    if (d.error) { showToast(d.error, "error"); return; }
    addAggResult(d.label, d.result, func);
  })
  .catch(() => showToast("Aggregation failed", "error"));
}

const FUNC_ICONS = {
  sum:   `<svg class="icon" viewBox="0 0 24 24"><line x1="19" y1="4" x2="5" y2="4"/><line x1="19" y1="20" x2="5" y2="20"/><polyline points="5 4 5 12 5 20"/><polyline points="19 12 5 12 19 4"/></svg>`,
  avg:   `<svg class="icon" viewBox="0 0 24 24"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="8" y2="6"/><line x1="16" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="8" y2="18"/><line x1="16" y1="18" x2="20" y2="18"/></svg>`,
  count: `<svg class="icon" viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>`,
  min:   `<svg class="icon" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  max:   `<svg class="icon" viewBox="0 0 24 24"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
};

function addAggResult(label, value, func) {
  const container = $("aggregationResults");
  const div = document.createElement("div");
  div.className = "agg-result";

  const display = typeof value === "number"
    ? value.toLocaleString(undefined, {maximumFractionDigits: 2})
    : String(value ?? "—");

  div.innerHTML = `
    <div class="agg-result-icon">${FUNC_ICONS[func] || FUNC_ICONS.count}</div>
    <div style="flex:1">
      <div class="agg-result-value">${display}</div>
      <div class="agg-result-label">${label}</div>
    </div>
    <button class="agg-result-remove" title="Remove" onclick="this.closest('.agg-result').remove()">
      <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  container.appendChild(div);
}
