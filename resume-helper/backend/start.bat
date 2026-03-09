@echo off
chcp 65001 >nul
setlocal
title Resume Helper Launcher

echo === Resume Helper ===
echo.

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "BACKEND_DIR=%%~fI"
for %%I in ("%BACKEND_DIR%\..") do set "APP_DIR=%%~fI"
set "FRONTEND_DIR=%APP_DIR%\frontend"

cd /d "%BACKEND_DIR%"

if not exist "%BACKEND_DIR%\main.py" (
    echo [ERROR] Missing backend app in %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Missing frontend app in %FRONTEND_DIR%
    pause
    exit /b 1
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found in PATH
    pause
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found in PATH
    pause
    exit /b 1
)

echo [1/4] Checking backend dependencies...
python -c "import fastapi" >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing backend dependencies...
    python -m pip install -r "%BACKEND_DIR%\requirements.txt"
)

echo.
echo [2/4] Checking frontend dependencies...
if not exist "%FRONTEND_DIR%\node_modules" (
    echo Installing frontend dependencies...
    call npm --prefix "%FRONTEND_DIR%" install
)

echo.
echo [3/4] Checking backend environment file...
if not exist "%BACKEND_DIR%\.env" (
    if exist "%BACKEND_DIR%\.env.example" (
        copy /Y "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
        echo Created backend\.env from backend\.env.example
    )
)

echo.
echo [4/4] Starting services...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.

start "Resume Helper - Backend" cmd /k "cd /d \"%BACKEND_DIR%\" && python -m uvicorn backend.main:app --app-dir .. --reload --reload-dir . --port 8000"
timeout /t 3 /nobreak >nul
start "Resume Helper - Frontend" cmd /k "cd /d \"%BACKEND_DIR%\" && npm --prefix ..\frontend run dev"

echo Services started in new windows.
pause
