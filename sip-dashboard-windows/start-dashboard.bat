@echo off
REM SIP Dashboard Launcher for Windows Server 81
REM Run this script to start the dashboard

echo ================================================
echo   SIP Registration Dashboard
echo   Starting on Server 81 (Windows)
echo ================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher from https://www.python.org
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install flask flask-cors --quiet

REM Set environment variable for log path
set LOG_PATH=D:\gcti_logs\SIP_P

REM Start the dashboard
echo.
echo ================================================
echo   Dashboard starting...
echo   URL: http://localhost:5000
echo   URL: http://192.168.210.81:5000
echo ================================================
echo.
echo Press Ctrl+C to stop
echo.

python sip-dashboard-windows.py

pause
