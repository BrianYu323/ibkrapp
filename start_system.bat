@echo off
echo ==========================================
echo       Starting IBKR Trading System
echo ==========================================
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set LOCAL_IP=%%a
)
if defined LOCAL_IP set LOCAL_IP=%LOCAL_IP:~1%

echo Launching Backend (FastAPI on 0.0.0.0:8000)...
start "IBKR Backend" cmd /k "cd backend && (if exist .\venv\Scripts\activate.bat (call .\venv\Scripts\activate.bat) else (python -m venv venv && call .\venv\Scripts\activate.bat && pip install -r requirements.txt)) && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Launching Frontend (React Native Web on 0.0.0.0:8081)...
start "IBKR Frontend" cmd /k "cd frontend && (if not exist node_modules call npm install) && npm run web"

echo.
echo Both servers are starting in new windows.
echo - Local Web:     http://localhost:8081
if defined LOCAL_IP (
    echo - Other Devices ^(Same Wi-Fi^): http://%LOCAL_IP%:8081
)
echo - Backend API:   http://localhost:8000
echo ==========================================

