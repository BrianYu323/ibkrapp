import threading
import queue
import time
import tkinter as tk
from ibapi.client import EClient
from ibapi.wrapper import EWrapper

# Default connection settings
DEFAULT_HOST = "127.0.0.1"
PAPER_TRADING_PORT = 7497
LIVE_TRADING_PORT = 7496
DEFAULT_CLIENT_ID = 1

class IBClient(EWrapper, EClient):
    def __init__(self, host=DEFAULT_HOST, port=PAPER_TRADING_PORT, client_id=DEFAULT_CLIENT_ID):
        EClient.__init__(self, self)
        
        # Queues for thread-safe communication with the UI
        self.data_queue = queue.Queue()
        self.message_queue = queue.Queue()
        
        # Connect to TWS/Gateway
        self.connect(host, port, client_id)

    def error(self, reqId, errorCode, errorString, advancedOrderRejectJson=""):
        """Called when there is an error or informational message from IBKR."""
        msg = f"Error. Id: {reqId} Code: {errorCode} Msg: {errorString}"
        self.message_queue.put(msg)
        print(msg)

    # Example of a callback that would put data into the queue
    def nextValidId(self, orderId: int):
        super().nextValidId(orderId)
        self.data_queue.put({"type": "nextValidId", "orderId": orderId})


def start_api_thread(client):
    """Runs the API message loop in a background thread."""
    api_thread = threading.Thread(target=client.run, daemon=True)
    api_thread.start()
    return api_thread


class TradingApp(tk.Tk):
    def __init__(self, ib_client):
        super().__init__()
        self.title("IBKR Trading Dashboard")
        self.geometry("600x400")
        
        self.ib_client = ib_client
        
        self.label = tk.Label(self, text="Messages from IBKR will appear below:")
        self.label.pack(pady=10)
        
        self.text_area = tk.Text(self, height=20, width=70)
        self.text_area.pack(pady=10)
        
        # Start checking the queues
        self.check_queues()

    def check_queues(self):
        # Check message queue
        while not self.ib_client.message_queue.empty():
            msg = self.ib_client.message_queue.get()
            self.text_area.insert(tk.END, f"[MSG] {msg}\n")
            self.text_area.see(tk.END)
            
        # Check data queue
        while not self.ib_client.data_queue.empty():
            data = self.ib_client.data_queue.get()
            self.text_area.insert(tk.END, f"[DATA] {data}\n")
            self.text_area.see(tk.END)
            
        # Schedule the next check in 100ms
        self.after(100, self.check_queues)


if __name__ == "__main__":
    # 1. Instantiate the client
    client = IBClient(port=PAPER_TRADING_PORT)
    
    # 2. Start the API loop in a background thread
    api_thread = start_api_thread(client)
    
    # Give the connection a moment to establish
    time.sleep(1)
    
    # 3. Initialize your UI on the main thread
    app = TradingApp(client)
    
    # 4. Start the Tkinter main loop (this blocks the main thread and runs the UI)
    app.mainloop()
    
    # Clean up on exit
    client.disconnect()
