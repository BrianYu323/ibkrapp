@echo off
echo =========================================================
echo   IBKR Trading Pro - One-Click Public & LAN Demo Server
echo =========================================================
echo.

echo [1/3] Building static Web UI (frontend/dist)...
cd frontend
if not exist node_modules call npm install
call npx expo export --platform web
cd ..

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set LOCAL_IP=%%a
)
if defined LOCAL_IP set LOCAL_IP=%LOCAL_IP:~1%

echo.
echo [2/3] Starting Unified Backend + Web UI on port 8000...
start "IBKR Unified Server" cmd /k "cd backend && (if exist .\venv\Scripts\activate.bat (call .\venv\Scripts\activate.bat) else (python -m venv venv && call .\venv\Scripts\activate.bat && pip install -r requirements.txt)) && uvicorn main:app --host 0.0.0.0 --port 8000"

echo.
echo =========================================================
echo   Local URL:            http://localhost:8000
if defined LOCAL_IP (
    echo   Same Wi-Fi Devices:   http://%LOCAL_IP%:8000
)
echo =========================================================
echo.
echo [3/3] Starting Free Public HTTPS Tunnel (Cloudflare)...
echo Copy the "https://....trycloudflare.com" link below to open on ANY device anywhere!
echo.
npx --yes cloudflared tunnel --url http://localhost:8000
