@echo off
title AI-Based Voice Command Recognition for Assistive Robotic Systems
cls
echo =========================================================================
echo    AI-Based Voice Command Recognition for Assistive Robotic Systems
echo    College Engineering Research Project Demonstration
echo =========================================================================
echo.
echo Starting local web server at http://localhost:8000 ...
echo (Web Speech API requires http://localhost or HTTPS for microphone access)
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    where py >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Python not found in PATH!
        echo Please open index.html directly in Google Chrome or Microsoft Edge.
        start "" "index.html"
        pause
        exit /b 1
    ) else (
        py server.py
        pause
        exit /b 0
    )
)

python server.py
pause
