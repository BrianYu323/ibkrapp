import threading
import time
import queue
from ibapi.client import EClient
from ibapi.wrapper import EWrapper
from ibapi.contract import Contract

class IBapi(EWrapper, EClient):
    def __init__(self, data_queue):
        EClient.__init__(self, self)
        self.data_queue = data_queue

    def error(self, reqId, errorCode, errorString, advancedOrderRejectJson=""):
        self.data_queue.put({"type": "error", "reqId": reqId, "code": errorCode, "msg": errorString})
        
    def nextValidId(self, orderId: int):
        super().nextValidId(orderId)
        self.nextorderId = orderId
        self.data_queue.put({"type": "nextValidId", "orderId": orderId})

    def tickPrice(self, reqId, tickType, price, attrib):
        self.data_queue.put({"type": "tickPrice", "reqId": reqId, "tickType": tickType, "price": price})

    def tickSize(self, reqId, tickType, size):
        self.data_queue.put({"type": "tickSize", "reqId": reqId, "tickType": tickType, "size": size})

def run_loop(app):
    app.run()

def main():
    # Thread-safe queue for communicating between IBKR thread and main thread
    data_queue = queue.Queue()
    
    # Initialize the IB app
    app = IBapi(data_queue)
    
    # Connect to paper trading port (7497 is default for TWS paper, 4002 for IB Gateway paper)
    app.connect("127.0.0.1", 7497, 1)

    # Start the IB message loop in a separate thread
    api_thread = threading.Thread(target=run_loop, args=(app,), daemon=True)
    api_thread.start()

    # Give it a moment to connect and get nextValidId
    time.sleep(1)

    # Example: request market data
    contract = Contract()
    contract.symbol = "AAPL"
    contract.secType = "STK"
    contract.exchange = "SMART"
    contract.currency = "USD"
    
    app.reqMktData(1, contract, "", False, False, [])

    print("Listening for data on main thread...")
    
    # Main thread loop
    try:
        while True:
            try:
                # Read from the data queue safely with a timeout
                msg = data_queue.get(timeout=1.0)
                print(f"Main thread received: {msg}")
                data_queue.task_done()
            except queue.Empty:
                # Do other things in the main thread if needed
                pass
    except KeyboardInterrupt:
        print("Exiting...")
        
    app.disconnect()

if __name__ == "__main__":
    main()
