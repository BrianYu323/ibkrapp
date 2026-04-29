import threading
import queue
import time
import tkinter as tk
from tkinter import scrolledtext

from ibapi.client import EClient
from ibapi.wrapper import EWrapper

class IBApi(EWrapper, EClient):
    def __init__(self, msg_queue):
        EClient.__init__(self, self)
        self.msg_queue = msg_queue

    def error(self, reqId, errorCode, errorString, advancedOrderRejectJson=""):
        msg = f"Error. Id: {reqId}, Code: {errorCode}, Msg: {errorString}"
        self.msg_queue.put(msg)

    def nextValidId(self, orderId: int):
        super().nextValidId(orderId)
        self.msg_queue.put(f"Connected. Next Valid Id: {orderId}")

class TradingApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("TWS API Trading Dashboard")
        self.geometry("600x400")

        self.msg_queue = queue.Queue()

        self.log_area = scrolledtext.ScrolledText(self, wrap=tk.WORD, width=70, height=20)
        self.log_area.pack(padx=10, pady=10)

        # Start API thread
        self.api_thread = threading.Thread(target=self.run_api, daemon=True)
        self.api_thread.start()

        # Start UI update loop
        self.after(100, self.process_queue)

    def run_api(self):
        self.api = IBApi(self.msg_queue)
        
        # Connect to TWS or IB Gateway (Default ports: TWS=7496, Gateway=4001, Paper TWS=7497)
        try:
            self.api.connect("127.0.0.1", 7497, 1)
            self.api.run()
        except Exception as e:
            self.msg_queue.put(f"Connection error: {e}")

    def process_queue(self):
        try:
            while True:
                msg = self.msg_queue.get_nowait()
                self.log_area.insert(tk.END, msg + "\n")
                self.log_area.see(tk.END)
        except queue.Empty:
            pass
        finally:
            self.after(100, self.process_queue)

if __name__ == "__main__":
    app = TradingApp()
    app.mainloop()