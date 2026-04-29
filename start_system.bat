@echo off
echo ==========================================
echo       Starting IBKR Trading System
echo ==========================================
echo.
echo Launching Backend (FastAPI)...
start "IBKR Backend" cmd /k "cd backend && .\venv\Scripts\activate && uvicorn main:app --reload"

echo Launching Frontend (React Native Web)...
start "IBKR Frontend" cmd /k "cd frontend && npm run web"

echo.
echo Both servers are starting in new windows.
echo - Backend API will be at: http://127.0.0.1:8000
echo - Frontend Web will be at: http://localhost:8081
echo ==========================================
