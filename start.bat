@echo off
chcp 65001 >nul
title Resume Helper Launcher

echo === Resume Helper ===
echo.

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%resume-helper"
set "PROJECT_START=%PROJECT_DIR%\start.bat"

if not exist "%PROJECT_START%" (
    echo [ERROR] Missing project start script: %PROJECT_START%
    pause
    exit /b 1
)

echo Delegating to %PROJECT_START%
cd /d "%PROJECT_DIR%"
call "%PROJECT_START%"