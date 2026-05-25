import os
import json
import datetime

def main():
    merged = []
    
    for i in range(9):
        batch_file = f"data/batch_{i}.json"
        if os.path.exists(batch_file):
            with open(batch_file, "r") as f:
                try:
                    data = json.load(f)
                    if isinstance(data, list):
                        merged.extend(data)
                except Exception as e:
                    print(f"Error loading {batch_file}: {e}")
        else:
            print(f"Warning: {batch_file} not found.")

    # Sort alphabetically by ticker
    merged.sort(key=lambda x: x.get("ticker", "").upper())
    
    # Ensure frontend output directory exists
    output_dir = os.path.join("frontend", "output")
    os.makedirs(output_dir, exist_ok=True)
    
    # Write latest results
    with open(os.path.join(output_dir, "results.json"), "w") as f:
        json.dump(merged, f, indent=2)
        
    # Calculate counts
    total = len(merged)
    pass_count = sum(1 for x in merged if x.get("status") == "PASS")
    fail_count = sum(1 for x in merged if x.get("status") == "FAIL")
    na_count = sum(1 for x in merged if x.get("status") == "N/A")
    
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    date_str = now_utc.strftime("%Y-%m-%d")
    timestamp_str = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    meta = {
        "runDate": date_str,
        "runTimestampUTC": timestamp_str,
        "totalTickers": total,
        "passCount": pass_count,
        "failCount": fail_count,
        "naCount": na_count
    }
    
    # Write latest meta
    with open(os.path.join(output_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
        
    # Write date-specific results and meta
    with open(os.path.join(output_dir, f"results_{date_str}.json"), "w") as f:
        json.dump(merged, f, indent=2)
        
    with open(os.path.join(output_dir, f"meta_{date_str}.json"), "w") as f:
        json.dump(meta, f, indent=2)
        
    # Maintain runs registry
    runs_file = os.path.join(output_dir, "runs.json")
    runs = []
    if os.path.exists(runs_file):
        try:
            with open(runs_file, "r") as f:
                runs = json.load(f)
                if not isinstance(runs, list):
                    runs = []
        except Exception as e:
            print(f"Error reading runs registry: {e}")
            
    if date_str not in runs:
        runs.append(date_str)
        
    # Sort runs reverse chronologically
    runs.sort(reverse=True)
    
    with open(runs_file, "w") as f:
        json.dump(runs, f, indent=2)
        
    print(f"Merged {total} tickers for date {date_str} in {output_dir}.")
    print(f"PASS: {pass_count}, FAIL: {fail_count}, N/A: {na_count}")

if __name__ == "__main__":
    main()
