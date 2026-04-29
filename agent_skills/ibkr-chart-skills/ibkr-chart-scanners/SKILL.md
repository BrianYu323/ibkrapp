---
name: ibkr-chart-scanners
description: "How to implement IBKR Market Scanners (ScannerSubscription) in Python and render the results in a UI table (e.g., lightweight-charts table). Use this skill when you need to scan the market for top percent gainers, most active stocks, or other criteria, and dynamically update a display list."
---

# IBKR Market Scanners & Table UI

This skill demonstrates how to utilize the TWS API `ScannerSubscription` to find trade candidates (e.g., top gainers, most active) and display the results in a table alongside a chart.

## 1. Creating a Scanner Subscription

To request a scan, create a `ScannerSubscription` object, define the criteria (like scan code and instrument type), and optionally pass `TagValue` filters.

```python
from ibapi.scanner import ScannerSubscription
from ibapi.tag_value import TagValue

def request_market_scan(app, scan_code="HOT_BY_VOLUME"):
    """Requests a market scan from IBKR."""
    sub = ScannerSubscription()
    sub.instrument = "STK"
    sub.locationCode = "STK.US.MAJOR"
    sub.scanCode = scan_code # e.g., "HOT_BY_VOLUME", "TOP_PERC_GAIN"
    
    # Optional: Add filters (e.g., min price, min volume)
    # See IBKR documentation for specific tag values for different scan codes
    options = []
    # options.append(TagValue("volumeAbove", "1000000"))
    
    req_id = 2 # Unique ID for this scanner request
    
    # Send request
    app.reqScannerSubscription(req_id, sub, [], options)
```

## 2. Handling Scanner Callbacks

The API will return scan results via the `scannerData` callback, one row at a time. When the scan is complete, `scannerDataEnd` is called.

```python
    # Inside IBClient (EWrapper)
    def scannerData(self, reqId, rank, contractDetails, distance, benchmark, projection, legsStr):
        """Called for each individual result in the scan."""
        result = {
            "rank": rank,
            "symbol": contractDetails.contract.symbol,
            "exchange": contractDetails.contract.primaryExchange,
        }
        self.data_queue.put({"type": "SCAN", "data": result})

    def scannerDataEnd(self, reqId):
        """Called when the scan finishes outputting rows."""
        self.message_queue.put("SCANNER_DATA_END")
```

## 3. UI Integration (lightweight-charts Table)

The `lightweight-charts` library provides a table widget that can sit alongside the main chart. You consume the scan results from the queue and populate the table.

### Setting up the Layout

```python
from lightweight_charts import Chart

# Create chart taking up 60% of the width
chart = Chart(width=1000, inner_width=0.6)

# Create a table that takes up the remaining space
# We pass the chart object to link them in the same window
table = chart.create_table(width=0.4, headings=('Rank', 'Symbol', 'Exchange'))
```

### Populating the Table

In your main UI loop, listen for scanner data and add rows to the table.

```python
def process_scanner_data(app, table):
    """Reads scan results from the queue and adds them to the UI table."""
    while not app.data_queue.empty():
        item = app.data_queue.get()
        
        if item.get("type") == "SCAN":
            data = item["data"]
            
            # Add a row to the table using the data
            table.new_row(
                data["rank"],
                data["symbol"],
                data["exchange"]
            )
```

## 4. Interactive Table Rows

You can make the table interactive so that clicking a row updates the main chart with that symbol's historical data.

```python
def on_row_click(row):
    """Callback for when a table row is clicked."""
    symbol = row['Symbol']
    print(f"Selected {symbol} from scanner.")
    
    # Update the top bar textbox
    chart.topbar['symbol'].value = symbol
    
    # Fetch new historical data for the selected symbol
    # get_bar_data(app, symbol, chart.topbar['timeframe'].value)

# Bind the event to the table
table.events.row_click += on_row_click
```

## Best Practices
- **Cancellation:** If you only need a snapshot scan, call `app.cancelScannerSubscription(req_id)` inside your `scannerDataEnd` callback. Otherwise, IBKR may continuously stream updates for that scan.
- **Pacing Violations:** Do not request too many scans too quickly, or IBKR will throw pacing violation errors.
- **Clearing the Table:** Before running a new scan, make sure to clear the existing rows in your table (`table.clear()`) so new results don't append to old ones.