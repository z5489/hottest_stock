import os
import sys
import csv

def main():
    universe_file = "universe.csv"
    if not os.path.exists(universe_file):
        print(f"Error: {universe_file} not found.", file=sys.stderr)
        sys.exit(1)
        
    tickers = []
    try:
        with open(universe_file, mode="r", newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            
            if header is None:
                print(f"Error: {universe_file} is empty.", file=sys.stderr)
                sys.exit(1)
            
            # Normalize headers to lowercase to find ticker column
            header_lower = [h.strip().lower() for h in header]
            ticker_idx = -1
            for name in ["ticker", "symbol"]:
                if name in header_lower:
                    ticker_idx = header_lower.index(name)
                    break
            
            # If no ticker/symbol column found, default to first column
            if ticker_idx == -1:
                ticker_idx = 0
                
            for row in reader:
                if not row or len(row) <= ticker_idx:
                    continue
                val = row[ticker_idx].strip()
                # Skip blank values, comments, and tickers containing slashes
                if not val or val.startswith("#") or "/" in val:
                    continue
                tickers.append(val.upper())
    except Exception as e:
        print(f"Error reading {universe_file}: {e}", file=sys.stderr)
        sys.exit(1)
        
    if not tickers:
        print(f"Error: No tickers found in {universe_file}.", file=sys.stderr)
        sys.exit(1)
        
    os.makedirs("data", exist_ok=True)
    
    batches = [[] for _ in range(9)]
    for idx, ticker in enumerate(tickers):
        batches[idx % 9].append(ticker)
        
    for i in range(9):
        batch_file = f"data/batch_input_{i}.csv"
        with open(batch_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["ticker"])
            for ticker in batches[i]:
                writer.writerow([ticker])
                
    print(f"Total tickers found: {len(tickers)}")
    for i in range(9):
        print(f"Batch {i}: {len(batches[i])} tickers")

if __name__ == "__main__":
    main()
