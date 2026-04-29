---
name: ibkr-chart-architecture
description: "How to set up the foundational architecture for an Interactive Brokers (IBKR) TWS API trading application integrated with a UI. Use this skill when building a desktop app, setting up a background thread for the API connection, subclassing EWrapper and EClient, or passing data between the API thread and the main UI thread using queues."
---

# IBKR TWS API + UI Architecture

This skill provides the foundational architectural pattern for building a Python desktop application that integrates the Interactive Brokers (IBKR) TWS API with a user interface (such as a chart or dashboard).

## Core Architectural Concepts

When integrating the TWS API with a UI, you must manage two primary tasks simultaneously:
1. Maintaining a persistent socket connection to IBKR to send commands and receive asynchronous callbacks.
2. Running a responsive graphical user interface (UI) on the main thread.

To achieve this without blocking the UI, the standard pattern involves:
- **Dedicated API Thread**: Running the TWS API connection loop in a separate background daemon thread.
- **Thread-Safe Data Passing**: Using thread-safe queues (e.g., Python's `queue.Queue`) to pass data (like historical bars or live ticks) from the API's callback methods (running on the background thread) to the main UI thread where it can be rendered.

## Implementation Pattern

### 1. Imports and Basic Setup

```python
import threading
import queue
import time
from ibapi.client import EClient
from ibapi.wrapper import EWrapper

# Default connection settings
DEFAULT_HOST = "127.0.0.1"
PAPER_TRADING_PORT = 7497
LIVE_TRADING_PORT = 7496
DEFAULT_CLIENT_ID = 1
```

### 2. Subclassing EWrapper and EClient

Create a client class that inherits from both `EWrapper` (to receive messages from IBKR) and `EClient` (to send messages to IBKR).

```python
class IBClient(EWrapper, EClient):
    def __init__(self, host=DEFAULT_HOST, port=PAPER_TRADING_PORT, client_id=DEFAULT_CLIENT_ID):
        EClient.__init__(self, self) # Initialize EClient with the wrapper (self)
        
        # Queues for thread-safe communication with the UI
        self.data_queue = queue.Queue()
        self.message_queue = queue.Queue()
        
        # Connect to TWS/Gateway
        self.connect(host, port, client_id)

    # ----------------------------------------------------
    # EWrapper Callback Examples
    # ----------------------------------------------------
    def error(self, reqId, errorCode, errorString, advancedOrderRejectJson=""):
        """Called when there is an error or informational message from IBKR."""
        msg = f"Error. Id: {reqId} Code: {errorCode} Msg: {errorString}"
        self.message_queue.put(msg)
        print(msg)

    # (Other callbacks like historicalData, nextValidId, etc., will put data into self.data_queue)
```

### 3. Starting the API in a Background Thread

The `EClient.run()` method contains an infinite loop that processes network messages. If called on the main thread, it will block the application. It must be run in a separate thread.

```python
def start_api_thread(client):
    """Runs the API message loop in a background thread."""
    api_thread = threading.Thread(target=client.run, daemon=True)
    api_thread.start()
    return api_thread
```

### 4. Application Bootstrapping

In your main application script, instantiate the client, start the background thread, and allow time for the connection to establish before initializing the UI.

```python
if __name__ == "__main__":
    # 1. Instantiate the client
    app = IBClient(port=PAPER_TRADING_PORT)
    
    # 2. Start the API loop in a background thread
    api_thread = start_api_thread(app)
    
    # Give the connection a moment to establish
    time.sleep(1)
    
    # 3. Initialize your UI (e.g., lightweight-charts) on the main thread
    # ... UI setup code here ...
    
    # 4. Periodically check queues in the UI thread to update visuals
    # Example generic loop:
    # while True:
    #     while not app.data_queue.empty():
    #         data = app.data_queue.get()
    #         # update_ui(data)
    #     time.sleep(0.1)
```

## Best Practices

- **Never update UI components directly from `EWrapper` callbacks.** Callbacks execute on the API thread, and most UI frameworks are not thread-safe. Always place the data into a `Queue` and let the main thread consume it.
- **Daemon Threads:** Set the API thread as a daemon thread (`daemon=True`) so that it automatically terminates when the main UI thread exits.
- **Connection State:** The `error` callback with codes like 2104, 2106, 2158 often indicates successful market data farm connections rather than fatal errors.

## Next Steps
Once the architecture is established, you can proceed to request historical data (`reqHistoricalData`) and map the callbacks (`historicalData`, `historicalDataEnd`) to push data into the queue for UI rendering.