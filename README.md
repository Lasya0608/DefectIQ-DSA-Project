# DefectIQ — Manufacturing Quality Control using Disjoint Sparse Table

A runnable, zero-third-party-dependency Python web app for automobile and electronics manufacturing inspection data.

## Run

1. Install Python 3.10 or later.
2. Open a terminal in this project folder.
3. Run `python server.py` (on some systems use `python3 server.py`).
4. Open http://127.0.0.1:8000 in your browser.
5. Press Ctrl+C in the terminal to stop.

No pip installation, internet connection, or database is required.

## Features

- Historical production shift inspection records with automobile/electronics sample data
- Upload a CSV with `date,shift,line,inspected,defects` columns
- Constant-time inclusive min/max range queries via two disjoint sparse tables
- Configurable defect threshold and range-specific warnings
- Dashboard totals, defect rates, interactive trend chart, inspection table
- Download records as CSV, restore sample data

## Algorithm

For each level `k`, divide records into blocks of length `2^(k+1)`. Store suffix aggregates for each left half and prefix aggregates for each right half. To query distinct indices `[L,R]`, compute `k = floor(log2(L XOR R))` and combine the precomputed aggregates at `table[k][L]` and `table[k][R]`. A singleton range directly returns its element.

Build: O(n log n) time, O(n log n) space. Each min/max query: O(1). Uploading new data rebuilds the tables. This is a static-data solution, not a real-time streaming sensor integration.

## CSV example

```csv
date,shift,line,inspected,defects
2026-10-01,Morning,Automobile,200,8
2026-10-01,Evening,Electronics,180,13
2026-10-01,Night,Automobile,210,5
```

## API

- `GET /api/data` — list records
- `POST /api/query` — JSON `{"left":0,"right":10}`; inclusive, zero-based
- `POST /api/upload` — JSON `{"csv":"date,shift,line,inspected,defects\n..."}`
- `POST /api/reset` — reset to sample data

## Tests

Run `python -m unittest discover -s tests -v` from the project folder.

## Team roll numbers


