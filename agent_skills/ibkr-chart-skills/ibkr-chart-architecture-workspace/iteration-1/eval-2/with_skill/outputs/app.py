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

class IBClient(EWrapper, EClient):
    def __init__(self, host=DEFAULT_HOST, port=PAPER_TRADING_PORT, client_id=DEFAULT_CLIENT_ID):
        EClient.__init__(self, self) # Initialize EClient with the wrapper (self)
        
        # Queues for thread-safe communication with the UI/main thread
        self.data_queue = queue.Queue()
        self.message_queue = queue.Queue()
        
        # Connect to TWS/Gateway
        self.connect(host, port, client_id)

    def error(self, reqId, errorCode, errorString, advancedOrderRejectJson=""):
        """Called when there is an error or informational message from IBKR."""
        msg = f"Error. Id: {reqId} Code: {errorCode} Msg: {errorString}"
        self.message_queue.put(msg)
        print(msg)

def start_api_thread(client):
    """Runs the API message loop in a background thread."""
    api_thread = threading.Thread(target=client.run, daemon=True)
    api_thread.start()
    return api_thread

if __name__ == "__main__":
    # 1. Instantiate the client
    app = IBClient(port=PAPER_TRADING_PORT)
    
    # 2. Start the API loop in a background thread
    api_thread = start_api_thread(app)
    
    # Give the connection a moment to establish
    time.sleep(1)
    
    # 3. Main loop reading from data queue safely
    print("Starting main loop to read from data queue safely...")
    try:
        while True:
            # Process data queue
            while not app.data_queue.empty():
                data = app.data_queue.get()
                print(f"Received data: {data}")
                
            # Process message queue
            while not app.message_queue.empty():
                msg = app.message_queue.get()
                # Assuming messages were already printed in the callback or handle here
                
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("Disconnecting...")
        app.disconnect()
