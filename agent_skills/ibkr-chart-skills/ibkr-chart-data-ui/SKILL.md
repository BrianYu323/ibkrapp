---
name: ibkr-chart-data-ui
description: "How to fetch historical data from IBKR TWS API, format it into Pandas DataFrames, and render it using lightweight-charts in Python. Use this skill to handle historicalData callbacks, build chart updates, draw indicators like moving averages, and manage UI callbacks like timeframe switching or horizontal line drags."
---

# IBKR Data & lightweight-charts UI Integration

This skill details how to fetch historical data via the TWS API, process the incoming callbacks, and render the results using the Python `lightweight-charts` package.

## 1. Requesting Historical Data

Create a `Contract` object and call `reqHistoricalData`.

```python
from ibapi.contract import Contract

def get_bar_data(app, symbol, timeframe):
    """Creates a contract and requests historical data."""
    contract = Contract()
    contract.symbol = symbol
    contract.secType = "STK"
    contract.exchange = "SMART"
    contract.currency = "USD"
    
    # Map timeframe to IBKR duration and bar size strings
    bar_size = "5 mins" if timeframe == "5m" else "1 hour"
    duration = "30 D"
    
    req_id = 1 # In practice, generate unique IDs
    app.reqHistoricalData(req_id, contract, "", duration, bar_size, "TRADES", 1, 1, False, [])
```

## 2. Handling Callbacks & Queuing Data

Implement the `EWrapper` methods `historicalData` and `historicalDataEnd` to receive the data on the background thread and push it to the main thread via a queue.

```python
    # Inside your IBClient (EWrapper) class:
    def historicalData(self, reqId, bar):
        """Called for each bar of data."""
        bar_dict = {
            "date": bar.date,
            "open": bar.open,
            "high": bar.high,
            "low": bar.low,
            "close": bar.close,
            "volume": bar.volume
        }
        self.data_queue.put(bar_dict)

    def historicalDataEnd(self, reqId, start, end):
        """Called when all bars have been received."""
        self.message_queue.put("HISTORICAL_DATA_END")
```

## 3. Processing Data into Pandas DataFrames

In the main UI thread, consume the queue and convert the data into a Pandas DataFrame. The `lightweight-charts` library expects column names: `time` (or `date`), `open`, `high`, `low`, `close`, `volume`.

```python
import pandas as pd

def process_queue_data(app):
    bars = []
    while not app.data_queue.empty():
        bars.append(app.data_queue.get())
    
    if bars:
        df = pd.DataFrame(bars)
        # Format dates if necessary
        # df['date'] = pd.to_datetime(df['date'])
        return df
    return None
```

## 4. Rendering with lightweight-charts

Initialize the chart and update its data.

```python
from lightweight_charts import Chart

# Initialize Chart
chart = Chart(width=1000, inner_width=0.6, toolbox=True)

# Process Data
df = process_queue_data(app)
if df is not None and not df.empty:
    chart.set(df)
    chart.watermark(symbol)

# Show Chart
chart.show(block=False) # Non-blocking if updating periodically
```

## 5. Adding Indicators and Lines

You can calculate indicators using Pandas and add them to the chart as overlay lines.

```python
def add_indicators(chart, df):
    # Calculate 50 SMA
    df['SMA50'] = df['close'].rolling(window=50).mean()
    
    # Create and set a new line on the chart
    sma_line = chart.create_line(name='SMA 50')
    
    # lightweight-charts expects lines to have 'time' and 'value' 
    # (or you can pass a DataFrame with the index/date and the series)
    sma_df = df[['date', 'SMA50']].rename(columns={'SMA50': 'value'})
    sma_line.set(sma_df)

    # Add a horizontal line at the maximum high
    max_high = df['high'].max()
    chart.horizontal_line(max_high, color='blue', width=2)
```

## 6. UI Callbacks (Interactivity)

`lightweight-charts` supports UI events (e.g., search, timeframe changes, line drags).

```python
# Setup a top bar text box and switcher
chart.topbar.textbox('symbol', 'AAPL')
chart.topbar.switcher('timeframe', ('5m', '15m', '1H'), default='5m')

# Define what happens when UI elements are interacted with
def on_search(chart, searched_string):
    print(f"User searched for: {searched_string}")
    # Call get_bar_data() with the new symbol

def on_timeframe_selection(chart):
    timeframe = chart.topbar['timeframe'].value
    symbol = chart.topbar['symbol'].value
    # Call get_bar_data() with the new timeframe

# Attach events
chart.events.search += on_search
```