# 📊 DataViz Pro — Enterprise Data Analytics Dashboard

A professional, full-stack data analytics dashboard built with **Python (Flask + pandas)** on the backend and **Chart.js** on the frontend.

---

## 🗂️ Project Structure

```
s/
├── app.py                    ← Flask server & API endpoints (Python)
├── requirements.txt          ← Python dependencies
├── README.md
│
├── templates/
│   └── index.html            ← Main HTML page (Jinja2)
│
└── static/
    ├── css/
    │   └── styles.css        ← All styles
    └── js/
        ├── app.js            ← Main coordinator (upload, KPIs, tab routing)
        ├── charts.js         ← Bar, Line, Pie, Area chart rendering
        ├── table.js          ← Table render, sort, search, pagination, export
        ├── aggregator.js     ← Quick-calc panel (calls /api/aggregate)
        ├── theme.js          ← Dark / light mode toggle
        └── utils.js          ← Shared helpers (toast, formatFileSize)
```

---

## 🚀 How to Run

### 1. Install Dependencies
```bash
cd /Users/apple/Downloads/Kamal/s
pip install -r requirements.txt
```

### 2. Start the Flask Server
```bash
python3 app.py
```

### 3. Open in Browser
```
http://127.0.0.1:5050
```

---

## ✨ Features

| Feature | Description |
|---|---|
| **File Upload** | Drag & drop or click to upload `.xlsx` / `.xls` |
| **Sheet Selector** | Auto-detects all sheets; smart default selection |
| **KPI Cards** | Total rows, columns, numeric cols, missing values |
| **Bar Chart** | Gradient bars with configurable X/Y axes |
| **Line Chart** | Smooth trend line with fill area |
| **Pie Chart** | Colour-coded distribution, groups excess into "Other" |
| **Area Chart** | Cumulative area fill |
| **Data Table** | Sortable, searchable, column-filterable with pagination |
| **Statistics** | Per-column mean, median, std, min, max, mode (via pandas) |
| **Quick Calc** | SUM / AVG / COUNT / MIN / MAX powered by pandas backend |
| **CSV Export** | Download filtered data as CSV |
| **JSON Export** | Download filtered data as JSON |
| **Dark Mode** | Persistent dark/light theme toggle |

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Serve the dashboard HTML |
| `/api/upload` | POST | Upload file → returns sheet names |
| `/api/sheet` | POST | Load a sheet → returns headers + rows |
| `/api/stats` | POST | Per-column statistics via pandas |
| `/api/aggregate` | POST | SUM/AVG/COUNT/MIN/MAX on a column |

---

## 📦 Tech Stack

- **Backend:** Python 3.x, Flask, pandas, openpyxl, numpy
- **Frontend:** Vanilla JS (ES Modules), Chart.js 4, CSS Custom Properties
- **Typography:** Plus Jakarta Sans, JetBrains Mono (Google Fonts)

---

## 🧑‍💻 GitHub

Push this project with:
```bash
git add .
git commit -m "feat: Flask + pandas full-stack refactor"
git push origin main
```
