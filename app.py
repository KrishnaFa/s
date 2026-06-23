from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import numpy as np
import io
import os
import json

app = Flask(__name__)
CORS(app)

# ── In-memory session store (per-server, per-upload) ──────────────────────────
# Maps session_id -> {workbook_bytes, sheets}
_store = {}

# ── Helper: safe JSON-serialisable ──────────────────────────────────────────
def _safe(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return None if np.isnan(v) else float(v)
    if isinstance(v, float) and np.isnan(v):
        return None
    if pd.isna(v):
        return None
    return v

def _df_to_records(df):
    rows = []
    for _, row in df.iterrows():
        rows.append({str(k): _safe(v) for k, v in row.items()})
    return rows

# ── Smart header-row finder ─────────────────────────────────────────────────
def _find_header_row(df_raw):
    """Return the row index (0-based) that has the most non-null cells."""
    best, best_idx = -1, 0
    limit = min(len(df_raw), 15)
    for i in range(limit):
        count = df_raw.iloc[i].notna().sum()
        if count > best:
            best = count
            best_idx = i
    return best_idx

def _load_sheet(wb_bytes, sheet_name):
    """Parse a sheet and return (headers, rows_as_list_of_dicts)."""
    df_raw = pd.read_excel(io.BytesIO(wb_bytes), sheet_name=sheet_name, header=None)
    hdr_idx = _find_header_row(df_raw)
    headers = [str(c).strip() if not pd.isna(c) else f"Col_{i}" for i, c in enumerate(df_raw.iloc[hdr_idx])]

    # De-duplicate headers
    seen = {}
    clean = []
    for h in headers:
        if h in seen:
            seen[h] += 1
            clean.append(f"{h}_{seen[h]}")
        else:
            seen[h] = 0
            clean.append(h)
    headers = clean

    df = df_raw.iloc[hdr_idx + 1:].reset_index(drop=True)
    df.columns = headers

    # Drop fully empty rows
    df = df.dropna(how='all')

    # Coerce numerics
    for col in df.columns:
        try:
            df[col] = pd.to_numeric(df[col], errors='ignore')
        except Exception:
            pass

    return headers, _df_to_records(df), df

# ── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def api_upload():
    """Accept an .xlsx/.xls upload; return sheet names + auto-selected default."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    wb_bytes = f.read()

    # Read sheet names
    xl = pd.ExcelFile(io.BytesIO(wb_bytes))
    sheet_names = xl.sheet_names

    # Choose a default sheet (skip instruction-style sheets)
    skip_kw  = ['instruction', 'readme', 'dictionary', 'config', 'guide', 'cover']
    prio_kw  = ['request', 'form', 'tracking', 'plan', 'data', 'sales', 'detail', 'master', 'resource']
    default  = sheet_names[0]
    for name in sheet_names:
        low = name.lower()
        if any(p in low for p in prio_kw) and not any(s in low for s in skip_kw):
            default = name
            break

    # Cache workbook bytes keyed by filename
    session_key = f.filename
    _store[session_key] = wb_bytes

    return jsonify({
        'session_key': session_key,
        'sheets': sheet_names,
        'default_sheet': default,
        'filename': f.filename,
        'file_size': len(wb_bytes)
    })


@app.route('/api/sheet', methods=['POST'])
def api_sheet():
    """Return parsed rows + headers for a given sheet."""
    body = request.get_json(force=True)
    session_key = body.get('session_key')
    sheet_name  = body.get('sheet_name')

    if session_key not in _store:
        return jsonify({'error': 'Session expired. Please re-upload.'}), 400

    try:
        headers, rows, df = _load_sheet(_store[session_key], sheet_name)

        if not headers or len(rows) == 0:
            return jsonify({'headers': headers, 'rows': [], 'numeric_cols': [],
                            'warning': 'Sheet appears to be empty or layout-only.'}), 200

        numeric_cols = df.select_dtypes(include='number').columns.tolist()
        return jsonify({
            'headers': headers,
            'rows': rows,
            'numeric_cols': numeric_cols,
            'total_rows': len(rows),
            'total_cols': len(headers)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stats', methods=['POST'])
def api_stats():
    """Return per-column statistical summary."""
    body = request.get_json(force=True)
    session_key = body.get('session_key')
    sheet_name  = body.get('sheet_name')

    if session_key not in _store:
        return jsonify({'error': 'Session expired.'}), 400

    try:
        headers, _, df = _load_sheet(_store[session_key], sheet_name)
        result = []
        for col in df.columns:
            series = df[col].dropna()
            total  = len(df)
            count  = len(series)
            missing= total - count
            uniques= series.nunique()

            if pd.api.types.is_numeric_dtype(series) and count > 0:
                mean   = _safe(series.mean())
                median = _safe(series.median())
                std    = _safe(series.std())
                mn     = _safe(series.min())
                mx     = _safe(series.max())
                result.append({
                    'column': col, 'type': 'numeric', 'count': count,
                    'missing': missing, 'uniques': uniques,
                    'mean': mean, 'median': median, 'std': std,
                    'min': mn, 'max': mx
                })
            else:
                mode_val = str(series.mode().iloc[0]) if count > 0 and not series.mode().empty else '—'
                mode_count = int((series == series.mode().iloc[0]).sum()) if count > 0 and not series.mode().empty else 0
                mode_pct  = round(mode_count / count * 100, 1) if count > 0 else 0
                result.append({
                    'column': col, 'type': 'categorical', 'count': count,
                    'missing': missing, 'uniques': uniques,
                    'mode': mode_val, 'mode_count': mode_count, 'mode_pct': mode_pct
                })
        return jsonify({'stats': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/aggregate', methods=['POST'])
def api_aggregate():
    """Run sum/avg/min/max/count on a column."""
    body = request.get_json(force=True)
    session_key = body.get('session_key')
    sheet_name  = body.get('sheet_name')
    column      = body.get('column')
    func        = body.get('func', 'count')

    if session_key not in _store:
        return jsonify({'error': 'Session expired.'}), 400

    try:
        _, _, df = _load_sheet(_store[session_key], sheet_name)

        if column not in df.columns:
            return jsonify({'error': f'Column "{column}" not found'}), 400

        series = df[column].dropna()
        is_num = pd.api.types.is_numeric_dtype(series)

        if is_num:
            num = pd.to_numeric(series, errors='coerce').dropna()
            ops = {'sum': num.sum(), 'avg': num.mean(), 'count': len(num),
                   'min': num.min(), 'max': num.max()}
            result = _safe(ops.get(func, len(num)))
            label  = f"{func.capitalize()} of {column}"
        else:
            if func == 'count':
                result = int(len(series))
                label  = f"Count of {column}"
            elif func == 'min':
                result = str(sorted(series.astype(str))[0])
                label  = f"Alphabetical Min of {column}"
            elif func == 'max':
                result = str(sorted(series.astype(str))[-1])
                label  = f"Alphabetical Max of {column}"
            else:
                result = int(len(series))
                label  = f"Count of {column}"

        return jsonify({'result': result, 'label': label, 'column': column, 'func': func})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5050)
