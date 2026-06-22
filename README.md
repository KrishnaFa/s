# DataViz Pro — Enterprise Data Analytics Dashboard

DataViz Pro is a premium, client-side, self-contained single page application (SPA) designed to parse, aggregate, and visualize Excel spreadsheets (.xlsx, .xls) directly in the browser with state-of-the-art aesthetics and real-time responsiveness.

## Key Features

- **Light & Dark Mode Support**: Sleek, themeable design with gridlines, tooltip panels, and ticks in the Chart.js visual canvas updating dynamically.
- **Smart Worksheet Sheet Selector**: Detects sheets in the uploaded workbook, intelligently loads the primary data sheet by default (skipping instructions or roles dictionaries), and updates charts and tables in real-time when switching tabs.
- **Automated Charting (Gradients & Rotation)**: Maps category and numeric axes automatically. For non-numeric sheets, it defaults to a **Row Count Frequency** layout. Features custom color gradients, tick label tilting, and automatic tick skipping to keep charts neat.
- **Row Calculator & Pivots**: Allows calculations (Sum, Average, Min, Max, Count) across all numeric or text columns.
- **Detailed Data Explorer**: Includes instant global search, column-specific filters, click-to-sort columns (with `▲` / `▼` sort direction indicators), and responsive pagination.
- **Statistical Summary Tab**: Provides standard statistical evaluations (mean, median, standard deviation, uniques, occupancy rates, and mode values) for all columns.
- **Export Capabilities**: Allows downloading the structured dataset to CSV or JSON formats, and downloading charts as high-resolution PNG images.

---

## How to Run Locally

Since the application is fully client-side and secure, it does not require complex installations or backend configurations. You can run it locally in two ways:

### Option 1: Start a Local HTTP Server (Recommended)

1. Open your terminal in this directory.
2. Run Python's built-in lightweight HTTP server module:
   ```bash
   python3 -m http.server 8080
   ```
3. Open your browser and navigate to:
   👉 **[http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html)**

### Option 2: Open Directly
Double-click the `dashboard.html` file in your file explorer to open it directly via the `file://` protocol in your browser (e.g., Chrome, Safari, Edge, or Firefox).

---

## Technologies Used

- **HTML5 & Vanilla CSS**: Premium custom layout variables, glassmorphic header, transitions, and inline SVGs.
- **SheetJS (xlsx.full.min.js)**: Local browser parsing of Excel binary files.
- **Chart.js**: Dynamic rendering of Bar, Line, Pie, and Area charts.
- **Plus Jakarta Sans & JetBrains Mono Fonts**: Modern typography for professional data dashboards.
