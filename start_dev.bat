@echo off
REM Factory Map Development Startup Script (Windows)
REM This script starts both backend and frontend in development mode

echo Starting Factory Map Development Environment...
echo OS: Windows
echo Mode: Development
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python and try again
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

echo Starting Backend Server (Port 7998)...
start "Backend Server" cmd /k "cd apps\backend && ..\..\.layout_proizvodnja_backend_fastapi\Scripts\activate && python run_server.py"

echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

echo Starting Frontend Server (Port 8077)...
start "Frontend Server" cmd /k "cd apps\frontend && npm install && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:7998
echo Frontend: http://localhost:8077
echo.
echo Press any key to exit this window...
pause >nul
