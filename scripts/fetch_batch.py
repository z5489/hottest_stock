import os
import sys
import json
import time
import math
import argparse
import datetime
import pandas as pd
import numpy as np
import yfinance as yf

def parse_args():
    parser = argparse.ArgumentParser(description="Fetch Yahoo Finance data for a batch of tickers.")
    parser.add_argument("--batch", type=int, required=True, help="Batch index (0-5)")
    parser.add_argument("--sleep", type=float, default=90, help="Seconds to sleep on retry")
    parser.add_argument("--retries", type=int, default=2, help="Number of retries per ticker")
    return parser.parse_args()

def clean_val(val):
    if val is None:
        return None
    try:
        fval = float(val)
        if math.isnan(fval) or math.isinf(fval):
            return None
        return fval
    except (ValueError, TypeError):
        return None

def get_ytd_start_price(history, symbol):
    current_year = datetime.datetime.now().year
    start_limit = datetime.date(current_year, 1, 1)
    end_limit = datetime.date(current_year, 1, 10)
    
    dates = history.index.date
    mask = (dates >= start_limit) & (dates <= end_limit)
    ytd_rows = history[mask]
    
    if not ytd_rows.empty:
        return clean_val(ytd_rows.iloc[0]["Close"])
        
    # Fallback: query yfinance history directly
    try:
        fallback_ticker = yf.Ticker(symbol)
        fallback_hist = fallback_ticker.history(start=f"{current_year}-01-01", end=f"{current_year}-01-10")
        if not fallback_hist.empty:
            return clean_val(fallback_hist.iloc[0]["Close"])
    except Exception as e:
        print(f"Fallback YTD fetch failed for {symbol}: {e}", file=sys.stderr)
        
    return None

def evaluate(ticker_data):
    criteria = [
        ("marketCap",    lambda v: v > 25_000_000),
        ("perf1M",       lambda v: v > 30),
        ("avgVolume60D", lambda v: v > 300_000),
        ("volume",       lambda v: v > 100_000),
        ("price",        lambda v: v >= 1.0),
        ("float",        lambda v: v <= 75_000_000),
        ("volatility1W", lambda v: v > 3),
        ("perf1W",       lambda v: -10 <= v <= 10),
    ]

    failed = []
    all_null = True

    for field, check in criteria:
        value = ticker_data.get(field)
        if value is None:
            continue          # skip — N/A for this field
        all_null = False
        if not check(value):
            failed.append(field)

    if all_null:
        return "N/A", []
    elif failed:
        return "FAIL", failed
    else:
        return "PASS", []

def main():
    args = parse_args()
    batch_idx = args.batch
    sleep_sec = args.sleep
    retries = args.retries
    
    input_file = f"data/batch_input_{batch_idx}.csv"
    output_file = f"data/batch_{batch_idx}.json"
    
    if not os.path.exists(input_file):
        print(f"Error: input file {input_file} not found.", file=sys.stderr)
        sys.exit(1)
        
    tickers = []
    try:
        import csv
        with open(input_file, mode="r", newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            
            if header is not None:
                header_lower = [h.strip().lower() for h in header]
                ticker_idx = -1
                for name in ["ticker", "symbol"]:
                    if name in header_lower:
                        ticker_idx = header_lower.index(name)
                        break
                if ticker_idx == -1:
                    ticker_idx = 0
            else:
                ticker_idx = 0
                
            for row in reader:
                if not row or len(row) <= ticker_idx:
                    continue
                val = row[ticker_idx].strip()
                if val:
                    tickers.append(val.upper())
    except Exception as e:
        print(f"Error reading {input_file}: {e}", file=sys.stderr)
        sys.exit(1)
        
    results = []
    
    for symbol in tickers:
        print(f"Processing ticker: {symbol}")
        success = False
        retries_left = retries
        
        info = {}
        history = pd.DataFrame()
        
        while retries_left >= 0 and not success:
            try:
                ticker_obj = yf.Ticker(symbol)
                # Fetch info
                info = ticker_obj.info
                # Fetch history
                history = ticker_obj.history(period="1y", interval="1d")
                if history.empty:
                    raise ValueError(f"No history data fetched for {symbol}")
                success = True
            except Exception as e:
                print(f"Error fetching data for {symbol}: {e}", file=sys.stderr)
                if retries_left > 0:
                    print(f"Retrying in {sleep_sec} seconds... ({retries_left} retries left)", file=sys.stderr)
                    time.sleep(sleep_sec)
                else:
                    print(f"Failed to fetch data for {symbol} after {retries} retries.", file=sys.stderr)
                retries_left -= 1
                
        if success:
            # Info fields
            price = clean_val(info.get("regularMarketPrice"))
            if price is None:
                price = clean_val(info.get("currentPrice"))
                if price is None and not history.empty:
                    price = clean_val(history.iloc[-1]["Close"])
                    
            marketCap = clean_val(info.get("marketCap"))
            float_shares = clean_val(info.get("floatShares"))
            name = info.get("longName") or info.get("shortName") or symbol
            
            volume = clean_val(info.get("regularMarketVolume"))
            if volume is None and not history.empty:
                volume = clean_val(history.iloc[-1]["Volume"])
                
            # History fields
            avgVolume60D = None
            if len(history) >= 60:
                avgVolume60D = clean_val(history.iloc[-60:]["Volume"].mean())
                
            relVol = None
            if volume is not None and avgVolume60D is not None and avgVolume60D > 0:
                relVol = clean_val(volume / avgVolume60D)
                
            perf1W = None
            if len(history) >= 6:
                price_today = clean_val(history.iloc[-1]["Close"])
                price_5d_ago = clean_val(history.iloc[-6]["Close"])
                if price_today is not None and price_5d_ago is not None and price_5d_ago > 0:
                    perf1W = clean_val((price_today - price_5d_ago) / price_5d_ago * 100)
                    
            perf1M = None
            if len(history) >= 22:
                price_today = clean_val(history.iloc[-1]["Close"])
                price_21d_ago = clean_val(history.iloc[-22]["Close"])
                if price_today is not None and price_21d_ago is not None and price_21d_ago > 0:
                    perf1M = clean_val((price_today - price_21d_ago) / price_21d_ago * 100)
                    
            perfYTD = None
            if not history.empty:
                price_today = clean_val(history.iloc[-1]["Close"])
                price_ytd_start = clean_val(get_ytd_start_price(history, symbol))
                if price_today is not None and price_ytd_start is not None and price_ytd_start > 0:
                    perfYTD = clean_val((price_today - price_ytd_start) / price_ytd_start * 100)
                    
            volatility1W = None
            if len(history) >= 6:
                try:
                    last_6 = history.iloc[-6:]["Close"]
                    daily_returns = last_6.pct_change().dropna()
                    if not daily_returns.empty:
                        volatility1W = clean_val(daily_returns.std(ddof=1) * 100)
                except Exception as e:
                    print(f"Error calculating volatility for {symbol}: {e}", file=sys.stderr)
                    
            adr14 = None
            if len(history) >= 14:
                try:
                    last_14 = history.iloc[-14:]
                    adr_series = (last_14["High"] - last_14["Low"]) / last_14["Close"]
                    adr14 = clean_val(adr_series.mean() * 100)
                except Exception as e:
                    print(f"Error calculating adr14 for {symbol}: {e}", file=sys.stderr)
                    
            ticker_data = {
                "price": price,
                "marketCap": marketCap,
                "float": float_shares,
                "avgVolume60D": avgVolume60D,
                "volume": volume,
                "relVol": relVol,
                "perf1W": perf1W,
                "perf1M": perf1M,
                "perfYTD": perfYTD,
                "volatility1W": volatility1W,
                "adr14": adr14
            }
            
            status, failed_criteria = evaluate(ticker_data)
            
            results.append({
                "ticker": symbol,
                "name": name,
                "price": price,
                "marketCap": marketCap,
                "float": float_shares,
                "avgVolume60D": avgVolume60D,
                "volume": volume,
                "relVol": relVol,
                "perf1W": perf1W,
                "perf1M": perf1M,
                "perfYTD": perfYTD,
                "volatility1W": volatility1W,
                "adr14": adr14,
                "status": status,
                "failedCriteria": failed_criteria
            })
        else:
            # Failed to fetch data, store nulls and status "N/A"
            results.append({
                "ticker": symbol,
                "name": symbol,
                "price": None,
                "marketCap": None,
                "float": None,
                "avgVolume60D": None,
                "volume": None,
                "relVol": None,
                "perf1W": None,
                "perf1M": None,
                "perfYTD": None,
                "volatility1W": None,
                "adr14": None,
                "status": "N/A",
                "failedCriteria": []
            })
            
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
        
    print(f"Saved {len(results)} results to {output_file}")

if __name__ == "__main__":
    main()
