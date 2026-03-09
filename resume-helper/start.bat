@echo off
chcp 65001 >nul
REM Resume Helper - Windows Startup Script

echo ===================================
echo   Resume Helper - Starting...
echo ===================================

REM Check directories
if not exist "backend" (
    echo Error: Please run in resume-helper root directory
    exit /b 1
)

REM Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Python not found
    exit /b 1
)

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js not found
    exit /b 1
)

echo.
echo [1/3] Checking backend dependencies...
cd backend
python -c "import fastapi" >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing backend dependencies...
    python -m pip install -r requirements.txt
)
cd ..

echo.
echo [2/3] Checking frontend dependencies...
cd frontend
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)
cd ..

echo.
echo [3/3] Starting services...
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.

start "Resume Helper - Backend" cmd /k "python -m uvicorn backend.main:app --reload --reload-dir backend --port 8000"
timeout /t 3 /nobreak >nul
start "Resume Helper - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Services started in new windows
pause
