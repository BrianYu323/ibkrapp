from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
import asyncio
import sys
import json
import os

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# --- Global state ---
ib = None
ib_connected = False
ib_account_id = ""

ACCOUNT_TAGS = {
    "NetLiquidation", "TotalCashValue", "UnrealizedPnL",
    "RealizedPnL", "BuyingPower", "GrossPositionValue",
}


async def connect_to_ibkr():
    """Connect to IBKR TWS and subscribe to account updates."""
    global ib, ib_connected, ib_account_id

    # Set the event loop so eventkit can find it
    loop = asyncio.get_running_loop()
    asyncio.set_event_loop(loop)

    from ib_insync import IB

    ib = IB()
    try:
        await ib.connectAsync("127.0.0.1", 7497, clientId=1)
        ib_connected = True
        print("✅ Connected to IBKR TWS on port 7497.")
    except Exception as e:
        ib_connected = False
        print(f"❌ Failed to connect to IBKR: {e}")
        return

    # Subscribe to account updates (separate try so connection stays valid)
    try:
        accounts = ib.managedAccounts()
        if accounts:
            ib_account_id = accounts[0]
            print(f"   Account ID: {ib_account_id}")
            ib.reqAccountUpdates(ib_account_id)
            await asyncio.sleep(2)
            # Verify we got data
            vals = ib.accountValues()
            print(f"✅ Account data loaded: {len(vals)} values cached")
    except Exception as e:
        print(f"⚠️ Account updates subscription error (connection still active): {e}")
        import traceback
        traceback.print_exc()


async def disconnect_from_ibkr():
    """Disconnect from IBKR TWS cleanly."""
    global ib, ib_connected
    if ib and ib_connected:
        try:
            ib.disconnect()
        except Exception:
            pass
    ib_connected = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_ibkr()
    yield
    # Shutdown
    await disconnect_from_ibkr()


app = FastAPI(title="IBKR Trading Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"status": "ok", "connected": ib_connected, "account": ib_account_id}


@app.get("/api/portfolio")
async def get_portfolio():
    """Get account summary and portfolio positions from cache."""
    if not ib or not ib_connected:
        return {"error": "Not connected to IBKR", "positions": [], "account": {}}

    try:
        positions = ib.positions()
        pos_list = []
        for pos in positions:
            pos_list.append({
                "symbol": pos.contract.symbol,
                "secType": pos.contract.secType,
                "exchange": pos.contract.exchange or "SMART",
                "currency": pos.contract.currency,
                "quantity": float(pos.position),
                "avgCost": float(pos.avgCost),
                "marketValue": float(pos.position) * float(pos.avgCost),
            })

        account = {}
        for av in ib.accountValues():
            if av.tag in ACCOUNT_TAGS:
                account[av.tag] = av.value

        return {"positions": pos_list, "account": account}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "positions": [], "account": {}}


@app.get("/api/orders")
async def get_orders():
    """Get all open orders."""
    if not ib or not ib_connected:
        return {"error": "Not connected to IBKR", "orders": []}

    try:
        trades = ib.openTrades()
        order_list = []
        for trade in trades:
            order_list.append({
                "orderId": trade.order.orderId,
                "symbol": trade.contract.symbol,
                "secType": trade.contract.secType,
                "action": trade.order.action,
                "orderType": trade.order.orderType,
                "quantity": float(trade.order.totalQuantity),
                "limitPrice": float(trade.order.lmtPrice) if trade.order.lmtPrice else None,
                "status": trade.orderStatus.status,
                "filled": float(trade.orderStatus.filled),
                "remaining": float(trade.orderStatus.remaining),
                "avgFillPrice": float(trade.orderStatus.avgFillPrice),
            })
        return {"orders": order_list}
    except Exception as e:
        return {"error": str(e), "orders": []}


@app.get("/api/order-history")
async def get_order_history():
    """Get all trades from the current session (including filled, cancelled, inactive)."""
    if not ib or not ib_connected:
        return {"error": "Not connected to IBKR", "orders": []}

    try:
        trades = ib.trades()  # All trades, not just open
        order_list = []
        for trade in trades:
            # Extract fill time from the last log entry if available
            fill_time = ""
            if trade.log:
                fill_time = str(trade.log[-1].time) if trade.log[-1].time else ""

            order_list.append({
                "orderId": trade.order.orderId,
                "symbol": trade.contract.symbol,
                "localSymbol": getattr(trade.contract, 'localSymbol', ''),
                "secType": trade.contract.secType,
                "action": trade.order.action,
                "orderType": trade.order.orderType,
                "quantity": float(trade.order.totalQuantity),
                "limitPrice": float(trade.order.lmtPrice) if trade.order.lmtPrice else None,
                "stopPrice": float(trade.order.auxPrice) if trade.order.auxPrice else None,
                "status": trade.orderStatus.status,
                "filled": float(trade.orderStatus.filled),
                "remaining": float(trade.orderStatus.remaining),
                "avgFillPrice": float(trade.orderStatus.avgFillPrice),
                "lastUpdate": fill_time,
                "tif": trade.order.tif,
            })
        # Sort by orderId descending (newest first)
        order_list.sort(key=lambda x: x["orderId"], reverse=True)
        return {"orders": order_list}
    except Exception as e:
        return {"error": str(e), "orders": []}

# Timeframe mapping: frontend label -> (barSizeSetting, durationStr)
TIMEFRAME_MAP = {
    "15m": ("15 mins", "5 D"),
    "1h":  ("1 hour",  "10 D"),
    "2h":  ("2 hours", "20 D"),
    "4h":  ("4 hours", "30 D"),
}

# Symbol mapping: TradingView-style names -> IBKR contract params
# Format: { "display_name": (symbol, secType, exchange, currency, lastTradeDateOrContractMonth) }
FUTURES_MAP = {
    "GC1!":  ("GC",  "CONTFUT", "COMEX",  "USD", ""),
    "SI1!":  ("SI",  "CONTFUT", "COMEX",  "USD", ""),
    "CL1!":  ("CL",  "CONTFUT", "NYMEX",  "USD", ""),
    "MCL1!": ("MCL", "CONTFUT", "NYMEX",  "USD", ""),
    "NQ0626": ("NQ", "FUT",     "CME",    "USD", "202606"),
}


@app.get("/api/bars")
async def get_bars(symbol: str = "AAPL", timeframe: str = "1h"):
    """Get historical bar (candlestick) data from IBKR."""
    if not ib or not ib_connected:
        return {"error": "Not connected to IBKR", "bars": []}

    from ib_insync import Stock, Forex, Future, ContFuture

    try:
        # Check if it's a mapped futures symbol
        if symbol.upper() in FUTURES_MAP:
            sym, sec_type, exch, curr, expiry = FUTURES_MAP[symbol.upper()]
            if sec_type == "CONTFUT":
                contract = ContFuture(sym, exch, curr)
            else:
                contract = Future(symbol=sym, lastTradeDateOrContractMonth=expiry, exchange=exch, currency=curr)
        elif symbol.upper().endswith("1!"):
            # Generic continuous future: strip "1!" suffix
            raw = symbol.upper().replace("1!", "")
            contract = ContFuture(raw, "SMART", "USD")
        else:
            # Default: treat as stock
            contract = Stock(symbol.upper(), "SMART", "USD")

        qualified = await ib.qualifyContractsAsync(contract)
        if not qualified:
            return {"error": f"Could not find contract for {symbol}", "bars": []}

        # Get timeframe settings
        tf = TIMEFRAME_MAP.get(timeframe, ("1 hour", "10 D"))
        bar_size, duration = tf

        # Futures use TRADES, forex uses MIDPOINT
        what_to_show = "TRADES"

        # Request historical data
        bars = await ib.reqHistoricalDataAsync(
            contract,
            endDateTime="",
            durationStr=duration,
            barSizeSetting=bar_size,
            whatToShow=what_to_show,
            useRTH=False,
            formatDate=1,
        )

        if bars is None:
            bars = []

        bar_list = []
        for bar in bars:
            bar_list.append({
                "date": str(bar.date),
                "open": float(bar.open),
                "high": float(bar.high),
                "low": float(bar.low),
                "close": float(bar.close),
                "volume": int(bar.volume) if bar.volume else 0,
            })

        print(f"📊 {symbol} [{timeframe}]: {len(bar_list)} bars loaded")
        return {"symbol": symbol, "timeframe": timeframe, "bars": bar_list}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "bars": []}


# ─── Contract Resolution ───
def resolve_contract(symbol: str):
    """Resolve a symbol string to an IBKR contract object."""
    from ib_insync import Stock, ContFuture, Future

    symbol = symbol.strip().upper()

    # Check futures map first
    if symbol in FUTURES_MAP:
        sym, sec_type, exch, curr, expiry = FUTURES_MAP[symbol]
        if sec_type == "CONTFUT":
            return ContFuture(sym, exch, curr)
        else:
            return Future(symbol=sym, lastTradeDateOrContractMonth=expiry, exchange=exch, currency=curr)

    # Continuous future pattern (e.g. "ES1!", "YM1!")
    if symbol.endswith("1!"):
        raw = symbol.replace("1!", "")
        return ContFuture(raw, "SMART", "USD")

    # Default: stock
    return Stock(symbol, "SMART", "USD")


@app.get("/api/resolve")
async def resolve_symbol(symbol: str):
    """Resolve a symbol and return contract details + current market price."""
    if not ib or not ib_connected:
        return {"error": "Not connected to IBKR"}

    try:
        contract = resolve_contract(symbol)
        qualified = await ib.qualifyContractsAsync(contract)
        if not qualified:
            return {"error": f"No contract found for '{symbol}'"}

        c = qualified[0]
        return {
            "found": True,
            "symbol": c.symbol,
            "secType": c.secType,
            "exchange": c.exchange,
            "currency": c.currency,
            "conId": c.conId,
            "localSymbol": getattr(c, 'localSymbol', ''),
            "multiplier": getattr(c, 'multiplier', ''),
            "lastTradeDateOrContractMonth": getattr(c, 'lastTradeDateOrContractMonth', ''),
        }
    except Exception as e:
        return {"error": str(e)}


# Track symbols where reqMktData has failed (no subscription), so we skip it on subsequent polls
_mktdata_failed_symbols: set = set()

@app.get("/api/market-price")
async def get_market_price(symbol: str):
    """Get current market price for a symbol."""
    if not ib or not ib_connected:
        return {"error": "Not connected to IBKR"}

    try:
        contract = resolve_contract(symbol)
        qualified = await ib.qualifyContractsAsync(contract)
        if not qualified:
            return {"error": f"No contract found for '{symbol}'"}

        c = qualified[0]
        price_data = {
            "symbol": symbol,
            "bid": None,
            "ask": None,
            "last": None,
            "close": None,
            "marketPrice": None,
            "source": None,
        }

        # ── Attempt 1: reqMktData (real-time or delayed snapshot) ──
        # Skip if this symbol has previously failed (no subscription)
        if symbol.upper() not in _mktdata_failed_symbols:
            try:
                ib.reqMarketDataType(4)  # Delayed-Frozen fallback
                ticker = ib.reqMktData(c, '', True, False)
                await asyncio.sleep(2)

                bid = float(ticker.bid) if ticker.bid and ticker.bid > 0 else None
                ask = float(ticker.ask) if ticker.ask and ticker.ask > 0 else None
                last = float(ticker.last) if ticker.last and ticker.last > 0 else None
                close = float(ticker.close) if ticker.close and ticker.close > 0 else None

                best = (
                    last
                    or close
                    or (((bid or 0) + (ask or 0)) / 2 if bid and ask else None)
                )

                try:
                    ib.cancelMktData(c)
                except Exception:
                    pass

                if best:
                    price_data.update({
                        "bid": bid, "ask": ask, "last": last, "close": close,
                        "marketPrice": best, "source": "live",
                    })
                    return price_data
                else:
                    # reqMktData returned no usable price → remember to skip next time
                    _mktdata_failed_symbols.add(symbol.upper())
                    print(f"⚠️ reqMktData returned no data for {symbol}, will use historical fallback from now on")
            except Exception as e:
                _mktdata_failed_symbols.add(symbol.upper())
                print(f"⚠️ reqMktData failed for {symbol}: {e}, will use historical fallback from now on")

        # ── Attempt 2: Historical data fallback (no subscription needed) ──
        try:
            bars = await ib.reqHistoricalDataAsync(
                c,
                endDateTime="",
                durationStr="2 D",
                barSizeSetting="1 min",
                whatToShow="TRADES",
                useRTH=False,
                formatDate=1,
            )
            if bars:
                last_bar = bars[-1]
                price_data.update({
                    "last": float(last_bar.close),
                    "marketPrice": float(last_bar.close),
                    "source": "historical",
                })
                return price_data
        except Exception as e:
            print(f"⚠️ Historical fallback also failed for {symbol}: {e}")

        return price_data
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


@app.post("/api/order")
async def place_order(order_data: dict = {}):
    """Place an order through IBKR."""
    if not ib or not ib_connected:
        return {"error": "Not connected to IBKR"}

    from ib_insync import MarketOrder, LimitOrder, StopOrder, StopLimitOrder, Order

    try:
        symbol = order_data.get("symbol", "")
        action = order_data.get("action", "BUY")  # BUY or SELL
        quantity = float(order_data.get("quantity", 0))
        order_type = order_data.get("orderType", "MKT")
        limit_price = order_data.get("limitPrice")
        stop_price = order_data.get("stopPrice")
        tif = order_data.get("tif", "DAY")  # DAY, GTC, IOC, FOK
        outside_rth = order_data.get("outsideRth", False)

        if not symbol or quantity <= 0:
            return {"error": "Invalid symbol or quantity"}

        # Resolve contract
        contract = resolve_contract(symbol)
        qualified = await ib.qualifyContractsAsync(contract)
        if not qualified:
            return {"error": f"Could not qualify contract for '{symbol}'"}

        # Build order
        if order_type == "MKT":
            order = MarketOrder(action, quantity)
        elif order_type == "LMT":
            if not limit_price:
                return {"error": "Limit price required for LMT order"}
            order = LimitOrder(action, quantity, float(limit_price))
        elif order_type == "STP":
            if not stop_price:
                return {"error": "Stop price required for STP order"}
            order = StopOrder(action, quantity, float(stop_price))
        elif order_type == "STP LMT":
            if not limit_price or not stop_price:
                return {"error": "Both limit and stop price required for STP LMT order"}
            order = Order(
                action=action,
                totalQuantity=quantity,
                orderType="STP LMT",
                lmtPrice=float(limit_price),
                auxPrice=float(stop_price),
            )
        elif order_type == "MOC":
            order = Order(action=action, totalQuantity=quantity, orderType="MOC")
        elif order_type == "LOC":
            if not limit_price:
                return {"error": "Limit price required for LOC order"}
            order = Order(action=action, totalQuantity=quantity, orderType="LOC", lmtPrice=float(limit_price))
        else:
            return {"error": f"Unsupported order type: {order_type}"}

        # Apply common settings
        order.tif = tif
        order.outsideRth = outside_rth

        # Attach parent stop-loss if provided
        attached_stop_price = order_data.get("attachedStopLossPrice")

        # Place the order
        trade = ib.placeOrder(qualified[0], order)
        
        if attached_stop_price:
            stop_action = "SELL" if action == "BUY" else "BUY"
            stop_order = StopOrder(stop_action, quantity, float(attached_stop_price))
            stop_order.parentId = trade.order.orderId
            stop_order.tif = tif
            ib.placeOrder(qualified[0], stop_order)

        await asyncio.sleep(1)

        print(f"🛒 Order placed: {action} {quantity} {symbol} @ {order_type}")
        return {
            "success": True,
            "orderId": trade.order.orderId,
            "status": trade.orderStatus.status,
            "symbol": symbol,
            "action": action,
            "quantity": quantity,
            "orderType": order_type,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

# ─── Custom Indicators Scripts API ───

SCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "scripts", "indicators")
os.makedirs(SCRIPTS_DIR, exist_ok=True)

class ScriptData(BaseModel):
    name: str
    code: str

@app.get("/api/scripts/indicators")
async def get_custom_indicators():
    scripts = []
    try:
        for filename in os.listdir(SCRIPTS_DIR):
            if filename.endswith(".ts"):
                with open(os.path.join(SCRIPTS_DIR, filename), "r", encoding="utf-8") as f:
                    scripts.append({
                        "name": filename[:-3],
                        "code": f.read()
                    })
        return {"scripts": scripts}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/scripts/indicators")
async def save_custom_indicator(data: ScriptData):
    try:
        filename = f"{data.name}.ts"
        filepath = os.path.join(SCRIPTS_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(data.code)
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/scripts/indicators/{name}")
async def delete_custom_indicator(name: str):
    try:
        filepath = os.path.join(SCRIPTS_DIR, f"{name}.ts")
        if os.path.exists(filepath):
            os.remove(filepath)
            return {"success": True}
        return {"error": "Not found"}
    except Exception as e:
        return {"error": str(e)}

# ─── Custom Bots Scripts API ───
BOTS_DIR = os.path.join(os.path.dirname(__file__), "scripts", "bots")
os.makedirs(BOTS_DIR, exist_ok=True)

@app.get("/api/scripts/bots")
async def get_custom_bots():
    scripts = []
    try:
        for filename in os.listdir(BOTS_DIR):
            if filename.endswith(".ts"):
                with open(os.path.join(BOTS_DIR, filename), "r", encoding="utf-8") as f:
                    scripts.append({
                        "name": filename[:-3],
                        "code": f.read()
                    })
        return {"scripts": scripts}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/scripts/bots")
async def save_custom_bot(data: ScriptData):
    try:
        filename = f"{data.name}.ts"
        filepath = os.path.join(BOTS_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(data.code)
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/scripts/bots/{name}")
async def delete_custom_bot(name: str):
    try:
        filepath = os.path.join(BOTS_DIR, f"{name}.ts")
        if os.path.exists(filepath):
            os.remove(filepath)
            return {"success": True}
        return {"error": "Not found"}
    except Exception as e:
        return {"error": str(e)}




@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except Exception:
        pass
