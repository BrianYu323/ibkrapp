import threading
import time
import queue
from ibapi.client import EClient
from ibapi.wrapper import EWrapper

class IBapi(EWrapper, EClient):
    def __init__(self):
        EClient.__init__(self, self)
        self.error_queue = queue.Queue()

    def error(self, reqId, errorCode, errorString, advancedOrderRejectJson=""):
        # Store error messages in a thread-safe queue
        # This prevents the IBKR background thread from blocking on IO
        msg = f"Error. Id: {reqId}, Code: {errorCode}, Msg: {errorString}"
        if advancedOrderRejectJson:
            msg += f", AdvancedReject: {advancedOrderRejectJson}"
        self.error_queue.put(msg)


def run_loop(app):
    app.run()


def main():
    app = IBapi()
    
    # Connect to IBKR on port 7497 (default for paper trading)
    app.connect("127.0.0.1", 7497, clientId=1)

    # Run the IBKR message loop in a background thread so the main program doesn't freeze
    api_thread = threading.Thread(target=run_loop, args=(app,), daemon=True)
    api_thread.start()

    # Give it a second to connect
    time.sleep(1)

    print("Application running. Press Ctrl+C to exit.")

    try:
        # Main program loop
        while True:
            # Safely process and print any errors received from the background thread
            while not app.error_queue.empty():
                try:
                    err_msg = app.error_queue.get_nowait()
                    print(err_msg)
                except queue.Empty:
                    break
            
            # Do other main program work here...
            time.sleep(0.1)
            
    except KeyboardInterrupt:
        print("Disconnecting from IBKR...")
        app.disconnect()

if __name__ == '__main__':
    main()
