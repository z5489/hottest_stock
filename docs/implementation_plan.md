# Implementation Plan — ADR% Hottest Stock Screener

Implementation of a GitHub Actions-powered stock screener running nightly, downloading data from Yahoo Finance across 6 batches, and displaying results in a dark-themed browser dashboard served by Vercel.

## Proposed Changes

We will create the following files in the `c:\Users\ziyen\hottest_stock` workspace.

---

### Universe and Dependencies

#### [NEW] [tickers.txt](file:///c:/Users/ziyen/hottest_stock/tickers.txt)
Define a default list of 16 popular stock tickers to test the batch splitting and data fetching.

#### [NEW] [requirements.txt](file:///c:/Users/ziyen/hottest_stock/requirements.txt)
Define the Python package dependencies for the GitHub Action environment.

---

### Python Scripts

#### [NEW] [split_batches.py](file:///c:/Users/ziyen/hottest_stock/scripts/split_batches.py)
Reads `tickers.txt` and splits them round-robin across 6 batch files (`data/batch_input_0.txt` ... `data/batch_input_5.txt`).

#### [NEW] [fetch_batch.py](file:///c:/Users/ziyen/hottest_stock/scripts/fetch_batch.py)
Processes a single batch input file:
- Queries `yfinance` for ticker info (`regularMarketPrice`, `marketCap`, `floatShares`, `regularMarketVolume`).
- Queries `yfinance` for history data (`period="1y", interval="1d"`).
- Computes `avgVolume60D`, `relVol`, `perf1W`, `perf1M`, `perfYTD`, `volatility1W`, and `adr14`.
- Implements retry/sleep logic on network exceptions.
- Runs PASS/FAIL screening logic and saves JSON array to `data/batch_N.json`.

#### [NEW] [merge_results.py](file:///c:/Users/ziyen/hottest_stock/scripts/merge_results.py)
Merges `data/batch_0.json` ... `data/batch_5.json` into a single, sorted `data/results.json`, and writes metadata to `data/meta.json`.

---

### Github Actions Workflow & Vercel Configuration

#### [NEW] [screener.yml](file:///c:/Users/ziyen/hottest_stock/.github/workflows/screener.yml)
Runs nightly Monday-Friday at 21:00 UTC, executing the split, fetch (sequentially), and merge scripts, then committing findings back to the repository.

#### [NEW] [vercel.json](file:///c:/Users/ziyen/hottest_stock/vercel.json)
Configures static routing for the dashboard and the generated data outputs.

---

### Frontend Dashboard

#### [NEW] [index.html](file:///c:/Users/ziyen/hottest_stock/index.html)
A self-contained, premium dark-themed dashboard built with vanilla HTML/CSS/JS:
- Fetches data and metadata dynamically.
- Interactive filtering (Show PASS only vs Show All) and column sorting.
- Exports tickers-only CSV or all-fields CSV for currently visible rows.
- High-fidelity dark terminal styling using JetBrains Mono, glassmorphism, hover transition animations, and status badges.

---

## Verification Plan

### Automated/Local Execution
- Run `split_batches.py` to create the input batch files.
- Run `fetch_batch.py` with `--batch` parameters to fetch live Yahoo Finance data (with small/zero sleep intervals for local testing speed).
- Run `merge_results.py` to compile `data/results.json` and `data/meta.json`.
- Inspect the output files to verify fields, data types, and status checks.

### UI Inspection
- Launch a local HTTP server to view `index.html` and verify data rendering, sorting, status badges, CSV download triggers, and dark theme alignment.
