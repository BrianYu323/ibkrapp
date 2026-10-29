
<img width="1792" height="1989" alt="image" src="https://github.com/user-attachments/assets/0d04551e-6b5f-4c6a-b1f1-4943c57dbc96" />

<img width="1784" height="1990" alt="image1" src="https://github.com/user-attachments/assets/8d5b1ba5-87ab-4768-9ff0-7dc848df9cae" />

## Features

### Automatic Trading Mode
- **SMA-Based Trading**: Automatically trades futures based on 10-hour Simple Moving Average (SMA)
- **Auto Stop Loss**: Automatically places and updates stop loss orders (SMA ± 50)
- **Hourly Execution**: Runs trading logic every hour, synchronized with IBKR server time
- **Position Management**: Monitors and manages all futures positions

### Manual Trading Mode (UI)
- **Manual Buy/Sell Controls**: Place market, limit, or stop orders manually
- **Stop Loss Configuration**: Add custom stop loss to any order
- **Position Monitoring**: Real-time view of positions, P&L, and current prices
- **Order Management**: View and track all open orders
- **Flexible Connection**: Connect/disconnect from IBKR at any time

## Setup

### Prerequisites

1. **Install IBKR TWS or Gateway**
   - Download: https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#tws-download
   - TWS Settings: https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#bp-memory-alloc

2. **Python 3.11.0 or higher**
   - Download: https://www.python.org/downloads/

3. **Enable API in TWS**
   - File → Global Configuration → API → Settings
   - Enable "Enable ActiveX and Socket Clients"
   - Set Socket Port: 7497 (Paper Trading) or 7496 (Live Trading)
   - Trusted IP addresses: 127.0.0.1

### Installation

1. **Install Python Dependencies**
```bash
pip install -r requirements.txt
```

2. **Port Settings**
   - Paper Trading: Port 7497
   - Live Trading: Port 7496
   - Make sure TWS/Gateway is running before starting the program

<img width="131" height="249" alt="image" src="https://github.com/user-attachments/assets/77e052ca-1b7b-469f-b275-b39ea2f4b7b2" />

## Usage

### Running with UI (Recommended)

Start the application with the graphical interface:

```bash
python main_with_ui.py
```

Or simply:

```bash
python trading_ui.py
```

#### Using the UI:

1. **Connect to IBKR**
   - Enter Host (default: 127.0.0.1)
   - Enter Port (default: 7497 for paper trading)
   - Enter Client ID (default: 1)
   - Click "Connect"

2. **Trading Modes**
   - **Manual Mode**: Control all trades through the UI
   - **Auto Trading Mode**: Enable checkbox to use SMA-based automatic trading

3. **Manual Trading**
   - Enter Symbol (e.g., ZC for Corn)
   - Enter Contract Month (e.g., 202412)
   - Enter Exchange (e.g., CBOT)
   - Enter Quantity
   - Select Order Type (MKT, LMT, STP)
   - Optionally enter Stop Loss price
   - Click BUY or SELL

4. **Monitor Positions**
   - Click "Refresh Positions" to update
   - View real-time P&L
   - See all open orders and their status

### Running without UI (Original Mode)

For headless/server deployment:

```bash
python main_with_ui.py --no-ui
```

Or use the original script:

```bash
python main.py
```

## Files

- `trading_ui.py` - Standalone UI application
- `main_with_ui.py` - Enhanced version with UI and auto-trading integration
- `main.py` - Original automatic trading script (no UI)
- `requirements.txt` - Python dependencies
- `ui/uidesign.jpg` - UI design reference

## Trading Logic

### Automatic Mode (SMA-Based)
- **Long Positions**: 
  - Sell if current price < SMA-10
  - Place/update stop loss at SMA-10 - 50
  
- **Short Positions**:
  - Buy to close if current price > SMA-10
  - Place/update stop loss at SMA-10 + 50

### Manual Mode
- Full control over order placement
- Custom stop loss levels
- Support for Market, Limit, and Stop orders

## Logging

All trading activities are logged to:
- `trading_ui.log` - UI application logs
- `trading.log` - Trading bot logs
- Console output for real-time monitoring

## Safety Features

- Connection status indicator
- Manual override of automatic trading
- Confirmation dialogs for critical actions
- Comprehensive error handling and logging
- Real-time position and P&L monitoring

## Troubleshooting

1. **Connection Failed**
   - Ensure TWS/Gateway is running
   - Check API is enabled in TWS settings
   - Verify port number (7497 for paper, 7496 for live)
   - Check firewall settings

2. **Orders Not Executing**
   - Verify account permissions
   - Check position limits
   - Ensure sufficient margin
   - Review TWS error messages

3. **UI Not Responding**
   - Check log files for errors
   - Restart the application
   - Verify IBKR connection is active

## Important Notes

- Always test with paper trading account first (Port 7497)
- Monitor positions regularly when auto-trading is enabled
- Review logs for any errors or warnings
- Ensure proper risk management settings
- Keep TWS/Gateway running while the program operates

## Support

For IBKR API documentation and support:
- API Documentation: https://www.interactivebrokers.com/campus/ibkr-api-page/
- TWS API Guide: https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/
