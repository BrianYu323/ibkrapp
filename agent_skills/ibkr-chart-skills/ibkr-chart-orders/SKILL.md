---
name: ibkr-chart-orders
description: "How to place and track orders using the Interactive Brokers (IBKR) TWS API within a custom Python UI. Use this skill when implementing hotkey trading, programmatically submitting Buy/Sell market or limit orders based on chart events, or tracking order IDs."
---

# IBKR Order Execution & Hotkeys

This skill covers how to generate `Order` and `Contract` objects, assign client order IDs, and execute trades based on user input (like hotkeys) from a UI such as `lightweight-charts`.

## 1. Requesting the Next Valid Order ID

Before placing an order, you must know the next valid order ID. IBKR tracks orders using unique IDs.

When the client connects, it automatically receives the `nextValidId` callback. Store this in your client class.

```python
    # Inside IBClient (EWrapper)
    def __init__(self, ...):
        # ...
        self.next_order_id = None

    def nextValidId(self, orderId: int):
        """Receives the next valid order ID upon connection."""
        self.next_order_id = orderId
```

## 2. Creating Contracts and Orders

To place a trade, you need a `Contract` (what you are trading) and an `Order` (how you are trading it).

```python
from ibapi.contract import Contract
from ibapi.order import Order

def place_market_order(app, symbol, action, quantity=1):
    """
    Places a simple market order.
    action: "BUY" or "SELL"
    """
    if app.next_order_id is None:
        print("Wait for next valid order ID.")
        return

    # 1. Define Contract
    contract = Contract()
    contract.symbol = symbol
    contract.secType = "STK"
    contract.exchange = "SMART"
    contract.currency = "USD"
    
    # 2. Define Order
    order = Order()
    order.action = action
    order.orderType = "MKT"
    order.totalQuantity = quantity
    
    # 3. Place Order via EClient
    app.placeOrder(app.next_order_id, contract, order)
    
    print(f"Placed {action} order for {quantity} {symbol} (ID: {app.next_order_id})")
    
    # 4. Increment order ID for the next trade!
    app.next_order_id += 1
```

## 3. Implementing Hotkeys in lightweight-charts

You can attach hotkey listeners to the chart UI. When a user presses a designated key combination, it triggers a callback function that executes an order.

```python
def setup_hotkeys(chart, app):
    """Configures hotkeys to execute trades."""
    
    # Add hotkey combinations to the chart
    chart.hotkey('shift', 'O') # Example: Buy
    chart.hotkey('shift', 'P') # Example: Sell
    
    def handle_hotkey(chart, key):
        symbol = chart.topbar['symbol'].value
        
        if key == 'O':
            # Execute Buy
            place_market_order(app, symbol, "BUY", 1)
        elif key == 'P':
            # Execute Sell
            place_market_order(app, symbol, "SELL", 1)
            
    # Attach event listener
    chart.events.hotkey += handle_hotkey
```

## 4. Tracking Order Callbacks

When an order is executed, updated, or encounters an error, IBKR sends callbacks via `EWrapper`.

```python
    # Inside IBClient (EWrapper)
    def orderStatus(self, orderId, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld, mktCapPrice):
        """Called when an order changes status (e.g., Submitted, Filled, Cancelled)."""
        msg = f"OrderStatus. Id: {orderId}, Status: {status}, Filled: {filled}, Remaining: {remaining}"
        self.message_queue.put(msg)

    def openOrder(self, orderId, contract, order, orderState):
        """Called when an open order is updated."""
        msg = f"OpenOrder. Id: {orderId}, Symbol: {contract.symbol}, Action: {order.action}, Status: {orderState.status}"
        self.message_queue.put(msg)
```

## Considerations

- **Market Data Dependencies:** If your orders rely on real-time prices (like dynamically setting Limit prices based on the chart's current high/low), ensure your UI state has the latest price data parsed from `reqMktData` or the historical chart state before executing.
- **Order Callbacks in UI:** Like historical data, `orderStatus` and `openOrder` run on the background API thread. Use the `message_queue` to log them or display notifications in the main UI thread.