import threading
import queue
import time
from ibapi.client import EClient
from ibapi.wrapper import EWrapper

# Default connection settings
DEFAULT_HOST = "127.0.0.1"
PAPER_TRADING_PORT = 7497
DEFAULT_CLIENT_ID = 1

class IBClient(EWrapper, EClient):
    def __init__(self, host=DEFAULT_HOST, port=PAPER_TRADING_PORT, client_id=DEFAULT_CLIENT_ID):
        EClient.__init__(self, self)
        
        # Queue for thread-safe communication with the UI or main thread
        self.message_queue = queue.Queue()
        
        # Connect to TWS/Gateway
        self.connect(host, port, client_id)

    def error(self, reqId, errorCode, errorString, advancedOrderRejectJson=""):
        """Called when there is an error or informational message from IBKR."""
        msg = f"Error. Id: {reqId} Code: {errorCode} Msg: {errorString}"
        # Push to queue to safely pass it to the main thread
        self.message_queue.put(msg)

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
    
    print("Application started. Processing messages...")
    
    # Main program loop: process messages without freezing
    try:
        while True:
            # Periodically check queues in the main thread
            while not app.message_queue.empty():
                msg = app.message_queue.get()
                print(f"Main Thread Processed: {msg}")
            
            # Prevent 100% CPU usage on main thread
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("Application exiting...")
        app.disconnect()
