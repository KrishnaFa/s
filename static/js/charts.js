/* charts.js — all Chart.js chart rendering */
"use strict";
import { $, showToast } from "./utils.js";

const PALETTE = [
  "#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444",
  "#8b5cf6","#ec4899","#14b8a6","#f97316","#3b82f6",
  "#65a30d","#dc2626","#7c3aed","#0891b2","#d97706"
];

let charts = {};
let _filteredData = [];
let _numericCols = [];
let _headers = [];

/* ── State sync (called by app.js after data loads) ── */
export function syncChartState(filteredData, numericCols, headers) {
  _filteredData = filteredData;
  _numericCols  = numericCols;
  _headers      = headers;
}

/* ── Destroy all active charts ── */
export function destroyAllCharts() {
  Object.values(charts).forEach(c => c && c.destroy());
  charts = {};
}

/* ── Populate axis selectors ── */
export function configureAxes(headers, numericCols) {
  _headers     = headers;
  _numericCols = numericCols;

  const nonNumericCols = headers.filter(h => !numericCols.includes(h));
  const defaultX = nonNumericCols[0] || headers[0] || "";
  const defaultY = numericCols[0] || "ROW_COUNT";

  const pairs = [
    ["barXAxis","barYAxis"],
    ["lineXAxis","lineYAxis"],
    ["pieLabel","pieValue"],
    ["areaXAxis","areaYAxis"],
  ];

  pairs.forEach(([xId, yId]) => {
    _buildSelect(xId, headers, false, defaultX);
    _buildSelect(yId, headers, true,  defaultY);
  });

  // Trigger all charts with defaults
  updateAllCharts();
}

function _buildSelect(id, headers, isY, defaultVal) {
  const sel = $(id);
  sel.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = ""; placeholder.textContent = isY ? "Select Metric" : "Select Label";
  sel.appendChild(placeholder);

  if (isY) {
    const rcOpt = document.createElement("option");
    rcOpt.value = "ROW_COUNT"; rcOpt.textContent = "📊 Row Count (Frequency)";
    if (defaultVal === "ROW_COUNT") rcOpt.selected = true;
    sel.appendChild(rcOpt);
  }

  headers.forEach(h => {
    const opt = document.createElement("option");
    opt.value = h; opt.textContent = h;
    if (h === defaultVal) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ── Aggregate by X, sum/count by Y ── */
function _aggregate(xCol, yCol) {
  if (!xCol) return { labels: [], data: [] };
  const isNumericY = yCol && yCol !== "ROW_COUNT" && _numericCols.includes(yCol);
  const map = {};

  _filteredData.forEach(row => {
    const key = (row[xCol] !== undefined && row[xCol] !== null && row[xCol] !== "")
      ? String(row[xCol]) : "(Empty)";
    if (!map[key]) map[key] = 0;
    map[key] += isNumericY ? (Number(row[yCol]) || 0) : 1;
  });

  const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]);
  const top    = sorted.slice(0, 15);
  const other  = sorted.slice(15).reduce((s, [,v]) => s + v, 0);
  if (other > 0) top.push(["Other", other]);

  return { labels: top.map(e => e[0]), data: top.map(e => e[1]) };
}

/* ── Shared chart options factory ── */
function _opts(xLabel, yLabel) {
  const dark = document.body.classList.contains("dark-mode");
  const tc = dark ? "#cbd5e1" : "#475569";
  const gc = dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)";
  const tooltipBg = dark ? "#1f2937" : "#ffffff";
  const tooltipTitle = dark ? "#f9fafb" : "#0f172a";

  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg, titleColor: tooltipTitle, bodyColor: tc,
        borderColor: dark ? "#374151" : "#e2e8f0", borderWidth: 1,
        padding: 10, cornerRadius: 8,
        titleFont: { family: "Plus Jakarta Sans", weight: "700" },
        bodyFont:  { family: "Plus Jakarta Sans" }
      }
    },
    scales: {
      y: {
        grid: { color: gc }, border: { dash: [5,5] },
        ticks: { color: tc, font: { family:"Plus Jakarta Sans", size:10 } },
        title: { display: !!yLabel, text: yLabel, color: tc, font:{family:"Plus Jakarta Sans",weight:"700",size:11} }
      },
      x: {
        grid: { display: false },
        ticks: { color: tc, font:{family:"Plus Jakarta Sans",size:9}, maxRotation:45, minRotation:0, autoSkip:true, maxTicksLimit:12 },
        title: { display: !!xLabel, text: xLabel, color: tc, font:{family:"Plus Jakarta Sans",weight:"700",size:11} }
      }
    }
  };
}

function _pieOpts() {
  const dark = document.body.classList.contains("dark-mode");
  const tc = dark ? "#cbd5e1" : "#475569";
  const tooltipBg = dark ? "#1f2937" : "#ffffff";
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position:"right", labels:{ color:tc, font:{family:"Plus Jakarta Sans",size:11,weight:"600"}, boxWidth:10, padding:12 } },
      tooltip: { backgroundColor:tooltipBg, titleColor:dark?"#f9fafb":"#0f172a", bodyColor:tc, borderColor:dark?"#374151":"#e2e8f0", borderWidth:1, padding:10, cornerRadius:8 }
    }
  };
}

/* ── Individual chart updaters ── */
export function updateBarChart() {
  const x = $("barXAxis").value, y = $("barYAxis").value;
  const ph = $("barChartPlaceholder");
  if (charts.bar) { charts.bar.destroy(); charts.bar = null; }
  if (!x || !y) { ph.classList.remove("hidden"); return; }
  ph.classList.add("hidden");

  const { labels, data } = _aggregate(x, y);
  if (!labels.length) { ph.classList.remove("hidden"); return; }

  const ctx = $("barChart").getContext("2d");
  const g = ctx.createLinearGradient(0,0,0,300);
  g.addColorStop(0, "rgba(99,102,241,.9)"); g.addColorStop(1, "rgba(14,165,233,.1)");

  charts.bar = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: g, hoverBackgroundColor:"rgba(99,102,241,1)", borderColor:"#6366f1", borderWidth:1.5, borderRadius:6 }] },
    options: _opts(x, y)
  });
}

export function updateLineChart() {
  const x = $("lineXAxis").value, y = $("lineYAxis").value;
  const ph = $("lineChartPlaceholder");
  if (charts.line) { charts.line.destroy(); charts.line = null; }
  if (!x || !y) { ph.classList.remove("hidden"); return; }
  ph.classList.add("hidden");

  const { labels, data } = _aggregate(x, y);
  if (!labels.length) { ph.classList.remove("hidden"); return; }

  const ctx = $("lineChart").getContext("2d");
  const g = ctx.createLinearGradient(0,0,0,300);
  g.addColorStop(0,"rgba(16,185,129,.35)"); g.addColorStop(1,"rgba(16,185,129,0)");

  const dark = document.body.classList.contains("dark-mode");
  charts.line = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ data, borderColor:"#10b981", backgroundColor:g, borderWidth:3.5, fill:true, tension:.35, pointBackgroundColor:"#10b981", pointBorderColor:dark?"#111827":"#ffffff", pointBorderWidth:2, pointRadius:5, pointHoverRadius:7 }] },
    options: _opts(x, y)
  });
}

export function updatePieChart() {
  const l = $("pieLabel").value, v = $("pieValue").value;
  const ph = $("pieChartPlaceholder");
  if (charts.pie) { charts.pie.destroy(); charts.pie = null; }
  if (!l || !v) { ph.classList.remove("hidden"); return; }
  ph.classList.add("hidden");

  const { labels, data } = _aggregate(l, v);
  if (!labels.length) { ph.classList.remove("hidden"); return; }

  const dark = document.body.classList.contains("dark-mode");
  const ctx = $("pieChart").getContext("2d");
  charts.pie = new Chart(ctx, {
    type: "pie",
    data: { labels, datasets: [{ data, backgroundColor:PALETTE.slice(0, labels.length), borderWidth:1.5, borderColor:dark?"#111827":"#ffffff" }] },
    options: _pieOpts()
  });
}

export function updateAreaChart() {
  const x = $("areaXAxis").value, y = $("areaYAxis").value;
  const ph = $("areaChartPlaceholder");
  if (charts.area) { charts.area.destroy(); charts.area = null; }
  if (!x || !y) { ph.classList.remove("hidden"); return; }
  ph.classList.add("hidden");

  const { labels, data } = _aggregate(x, y);
  if (!labels.length) { ph.classList.remove("hidden"); return; }

  const ctx = $("areaChart").getContext("2d");
  const g = ctx.createLinearGradient(0,0,0,300);
  g.addColorStop(0,"rgba(14,165,233,.45)"); g.addColorStop(1,"rgba(14,165,233,0)");

  charts.area = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ data, borderColor:"#0ea5e9", backgroundColor:g, fill:true, tension:.3, pointRadius:2, borderWidth:2 }] },
    options: _opts(x, y)
  });
}

export function updateAllCharts() {
  updateBarChart(); updateLineChart(); updatePieChart(); updateAreaChart();
}

/* ── Chart image download ── */
window.exportChartImage = function(canvasId, name) {
  const canvas = $(canvasId);
  if (!canvas) return;
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url; a.download = `${name}_export.png`; a.click();
  showToast("Chart image saved!");
};

/* ── Rerender on theme change ── */
document.addEventListener("themeChanged", () => updateAllCharts());

/* ── Axis change listeners ── */
export function attachAxisListeners() {
  [["barXAxis","barYAxis", updateBarChart],
   ["lineXAxis","lineYAxis", updateLineChart],
   ["pieLabel","pieValue", updatePieChart],
   ["areaXAxis","areaYAxis", updateAreaChart],
  ].forEach(([xId, yId, fn]) => {
    $(xId).addEventListener("change", fn);
    $(yId).addEventListener("change", fn);
  });
}
