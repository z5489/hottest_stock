# ADR% Hottest Stock Screener

A GitHub Actions-powered stock screener that runs nightly after US market close, fetches data from Yahoo Finance across 9 sequential batches, and serves results through a dark-themed browser dashboard deployed on Vercel.

## Features

- **Automated Nightly Runs**: GitHub Actions workflow runs every weekday to scrape data from Yahoo Finance.
- **Robust Rate Limiting**: The universe of tickers is split into 9 batches processed sequentially with built-in retries and sleeps to respect rate limits.
- **Dynamic Frontend**: A static pure HTML/CSS/JS frontend served via Vercel.
- **Historical Data**: Ability to view data from past runs through the date picker.
- **Export Options**: Export the current view to CSV (either full data or tickers only).
- **Strict Screening Criteria**: Filters based on market cap, performance, volume, price, float, and volatility.

## Repository Structure

```
/
├── universe.csv                 # Universe of tickers (CSV format)
├── requirements.txt             # Python dependencies for GitHub Actions
├── scripts/                     # Python pipeline scripts
│   ├── split_batches.py         # Splits universe.csv into 9 batch files (CSV format)
│   ├── fetch_batch.py           # Fetches Yahoo Finance data for one batch
│   └── merge_results.py         # Merges batch JSONs into frontend/output/
├── data/                        # Temporary intermediate batch files (ignored by Git)
└── frontend/                    # Web dashboard deployed to Vercel
    ├── index.html               # Browser dashboard
    ├── vercel.json              # Vercel config
    └── output/                  # Final compiled metrics and historical runs
        ├── runs.json            # Registry of all run dates
        ├── results.json         # Latest merged screener output
        ├── meta.json            # Latest metadata
        ├── results_YYYY-MM-DD.json # Date-specific results
        └── meta_YYYY-MM-DD.json    # Date-specific metadata
```

## Screening Criteria & Logic

All criteria below must be satisfied for a stock to receive a **PASS** status. Each criterion is evaluated independently. 

| # | Criterion | Field | Operator | Threshold |
|---|-----------|-------|----------|-----------|
| 1 | Market Cap | `marketCap` | `>` | $25,000,000 |
| 2 | Performance 1 Month | `perf1M` | `>` | 30% |
| 3 | Average Volume 60D | `avgVolume60D` | `>` | 300,000 |
| 4 | Volume (latest session) | `volume` | `>` | 100,000 |
| 5 | Price | `price` | `>=` | $1.00 |
| 6 | Float | `float` | `<=` | 75,000,000 shares |
| 7 | Volatility 1 Week | `volatility1W` | `>` | 3% |
| 8 | Performance 1 Week | `perf1W` | between | -10% and +10% (inclusive) |

*Note: If the data field required to evaluate a criterion is missing, that criterion is skipped (it does not contribute a failure).*

## Deployment

### Vercel (Frontend)
The frontend is built to be deployed on Vercel. 
1. Connect your repository to Vercel.
2. The `vercel.json` configuration is set to deploy the `frontend/` directory statically.
3. Every time GitHub Actions pushes new results to `frontend/output/`, Vercel automatically deploys the updated data.

### GitHub Actions (Backend)
There are two workflows located in `.github/workflows/`:
1. **Split Universe (`split_universe.yml`)**: Runs on changes to `universe.csv` or manually. Splits the universe into 9 separate `.csv` files for batch processing.
2. **Screener (`screener.yml`)**: Runs daily at 21:00 UTC (Mon-Fri) or manually. Fetches data in 9 batches sequentially to avoid Yahoo Finance rate limits, merges the results into `frontend/output/`, and commits the results to the repository.

## Adding/Removing Tickers

To update the list of stocks being screened:
1. Edit the `universe.csv` file in the root of the repository. Ensure there is a column header (e.g. `ticker`).
2. Commit and push the changes.
3. The `split_universe.yml` GitHub Action will automatically run and prepare the new batches.
4. The new tickers will be screened during the next nightly run.
